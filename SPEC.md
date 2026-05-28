# Braided — 内部仕様書

> 自分用メモ。コード全体の構成・各機能の目的・データの流れをまとめたもの。

---

## 目次

1. [アーキテクチャ概観](#1-アーキテクチャ概観)
2. [データモデル](#2-データモデル)
3. [ノードグラフとトラバーサル](#3-ノードグラフとトラバーサル)
4. [ストア層](#4-ストア層)
5. [Streaming コンポーザブル](#5-streaming-コンポーザブル)
6. [コンテキスト管理](#6-コンテキスト管理)
7. [コンポーネント構成](#7-コンポーネント構成)
8. [主要機能の動作フロー](#8-主要機能の動作フロー)
9. [永続化・エクスポート](#9-永続化エクスポート)
10. [デプロイ・PWA](#10-デプロイpwa)
11. [新機能追加ガイド](#11-新機能追加ガイド)

---

## 1. アーキテクチャ概観

```
ブラウザのみで完結（バックエンドなし）
                                                        ┌─────────────┐
  ┌─────────────────────────────────────────────┐       │  Ollama     │
  │               Vue 3 SPA                    │──────▶│  LM Studio  │  (localhost)
  │                                             │       │  AnythingLLM│
  │  Pinia Store ──▶ useStreaming ──▶ Providers │──────▶│  OpenAI     │
  │       │                                     │       │  Anthropic  │  (cloud)
  │  IndexedDB (pinia-plugin-persistedstate)    │       │  Gemini     │
  │                                             │       │  Grok       │
  └─────────────────────────────────────────────┘       └─────────────┘
```

- **フレームワーク**: Vue 3 + TypeScript + Vite
- **状態管理**: Pinia（3 ストア）
- **永続化**: IndexedDB（`pinia-plugin-persistedstate` + `idb-keyval`）
- **通信**: 各 AI プロバイダーに直接 fetch（API キーはブラウザ内のみ）
- **Vault 連携**: `/api/vault/sync` ← ローカル dev サーバー (`server/app.py`) 経由で Obsidian に書き出し（本番では不使用）
- **PWA**: `vite-plugin-pwa`（Workbox）でアプリシェルをキャッシュ、API 呼び出しはキャッシュしない

---

## 2. データモデル

### `BraidedNode` — すべてのデータの基本単位

```typescript
interface BraidedNode {
  id: string              // ランダム 8 文字英数字
  type: NodeType          // 'q' | 'r' | 'sigma' | 'merge' | 'consolidation' | 'manual'
  parentId?: string       // 単一親ノードの ID
  parentIds?: string[]    // 複数親（merge / cross-consolidation のみ）
  content: string         // テキスト内容（ストリーミング中は随時追記）
  model?: string          // 'ollama:llama3', 'anthropic:claude-3-5-sonnet-20241022' など
  timestamp: number

  // フラグ類
  excluded?: boolean       // このRノードをコンテキストから除外
  _cancelled?: boolean     // キャンセル済み
  _branch?: boolean        // AddCard等による明示的ブランチQ
  _sigmaInclude?: boolean  // ブランチQ: 親Σ統合に含めるか（デフォルト true）
  continueModel?: string   // 単一モデル継続Qの場合にモデルキーを保持

  // 統合系
  strategy?: MergeStrategy              // merge ノード用
  consolidationStrategy?: ConsolidationStrategy  // consolidation ノード用
  customInstruction?: string            // カスタム統合指示

  // デバッグ・統計
  _ctx?: { messages, method, charLimit, originalChars }  // 送信コンテキストのスナップショット
  _stats?: StreamStats   // Ollama のみ: { totalMs, tokensPerSec, evalCount }
}
```

### ノードタイプ一覧

| type | 意味 | parentId の指す先 |
|------|------|-------------------|
| `q` | ユーザーの質問 | 前の q / r / sigma / merge / consolidation |
| `r` | モデルの回答 | q |
| `sigma` | Σ要約（1セッション1Q につき1つ） | q |
| `merge` | ブランチマージ結果 | なし（parentIds で複数Rを参照） |
| `consolidation` | カード統合結果（単一 or 複数カード） | q（単一）or なし（複数、parentIds 使用） |
| `manual` | 手動コンテキストカード | q |

### `Session`

```typescript
interface Session {
  id: string
  title: string      // 最初の質問の先頭 40 文字
  created: number
  nodes: BraidedNode[]    // 全ノードのフラット配列（ツリーではない）
  injectedContext?: string  // セッション全体に付与する背景テキスト
}
```

データ構造はフラット配列。ツリー関係は `parentId` / `parentIds` で表現され、必要に応じてトラバーサル関数で再構築する。

---

## 3. ノードグラフとトラバーサル

### メインスレッドチェーン (`getMainQChain`)

チャット画面に縦に並ぶ Q の連鎖。ルート Q（parentId なし）から始まり、各 Q の「橋渡しノード」を経由して次の Q を探す。

```
優先順: sigma → singleCons（最後の単一統合）→ multi（マージ/クロス統合）→ Q自身
```

例:
```
Q1 ──▶ [R1a, R1b] ──▶ Σ ──▶ Q2 ──▶ [R2a] ──▶ Cons ──▶ Q3
                ↕ ブランチQはカルーセル内に表示（メインスレッド外）
```

### ブランチ Q

- `_branch: true` が付いた Q はメインスレッドには含まれない
- CompositeCard のカルーセル内に表示される
- `_sigmaInclude` チェックボックスで親の Σ/統合に含めるか制御

### 続けて質問 (continueModel)

- 単一モデルに対して続けて会話するモード
- Q ノードに `continueModel: string` が付く（`_branch` はなし）
- `getQLabel` では `Q1.1`, `Q1.2` の形式でラベル付け

### Q ラベル体系

| 状況 | ラベル例 |
|------|---------|
| メインスレッド | Q1, Q2, Q3 |
| ブランチ | Q1-1, Q1-2, Q1-1-1 |
| 続けて質問 | Q1.1, Q1.2 |

---

## 4. ストア層

### `useSessionStore` (`src/stores/session.ts`)

セッション・ノードの CRUD とトラバーサルロジックを一手に担う。

**主要メソッド:**

| メソッド | 役割 |
|---------|------|
| `getMainQChain(s)` | メインスレッドの Q 配列を返す |
| `buildCtxMessages(s, qNodeId, ...)` | AI に送るメッセージ配列を構築（会話履歴 + 現在の質問） |
| `buildSessionMarkdown(s)` | セッション全体を Markdown 文字列に変換（エクスポート用） |
| `setBranchCtx(nodeId)` / `clearBranchCtx()` | 次の Q の親ノードを指定（ブランチ操作） |
| `restoreFromBackup(sessions)` | JSON バックアップからインポート（ID 重複は除外） |

**永続化**: `pinia-plugin-persistedstate` が IndexedDB に自動保存。`save()` は互換性のためのダミー。

---

### `useUiStore` (`src/stores/ui.ts`)

UI 状態のみ。セッションデータは持たない。

**主な状態:**

| 状態 | 型 | 役割 |
|------|-----|------|
| `selectedModels` | `Set<string>` | 送信先モデルのキーセット |
| `ollamaModels` / `lmstudioModels` / `anythingllmWorkspaces` | `string[]` | 自動検出済みローカルモデル一覧 |
| `fibOpen` / `fibMode` | `bool` / `'normal'\|'consolidation'` | Floating Input Bar の開閉・モード |
| `activeBranchId` | `string\|null` | 次の Q の親として使うノード ID |
| `continueModel` | `string\|null` | 単一モデル継続モード時のモデルキー |
| `selectedCardIds` | `Set<string>` | 統合対象として選択されたカード（Q ノード ID） |
| `collapsedCardIds` | `Set<string>` | 折りたたまれているカードの ID セット |
| `ctxLog` | `CtxLogEntry[]` | 送信ログパネル用（永続化なし） |
| `compressing` | `bool` | 履歴圧縮中バナー表示フラグ |

---

### `useSettingsStore` (`src/stores/settings.ts`)

各プロバイダーの URL・API キー・Vault 設定を保持。IndexedDB に永続化。

**デフォルト値:**

| プロバイダー | URL デフォルト |
|-------------|---------------|
| Ollama | `http://localhost:11434` |
| LM Studio | `http://localhost:1234` |
| AnythingLLM | `http://localhost:3001` |
| クラウド各種 | API キーのみ（URL なし） |

---

## 5. Streaming コンポーザブル

### ファイル構成

```
src/composables/
├── useStreaming.ts              メインオーケストレーター
├── streaming/
│   ├── parseSSE.ts             SSE（Server-Sent Events）汎用パーサー
│   ├── resolveCharLimit.ts     モデル名からコンテキスト制限を解決
│   └── providers/
│       ├── index.ts            バレルエクスポート
│       ├── ollama.ts           NDJSON ストリーム + 統計取得
│       ├── lmstudio.ts         OpenAI 互換 SSE
│       ├── anythingllm.ts      AnythingLLM SSE
│       ├── openai.ts           OpenAI SSE
│       ├── anthropic.ts        Anthropic SSE
│       ├── gemini.ts           Gemini SSE
│       └── grok.ts             Grok SSE（OpenAI 互換）
```

### `useStreaming.ts` の主要関数

#### `streamWith(modelKey, messages, onChunk, signal?, onStats?)`

プロバイダーを `modelKey` の先頭（`ollama:`、`anthropic:` など）で判別し、対応する provider 関数にディスパッチ。

**新プロバイダーの追加手順**: providers フォルダにファイル追加 → index.ts に export → `streamWith` に if 行 1 行追加。

---

#### `send(question, extraInstruction, onChunkUpdate, onDone)`

メインの送信関数。

```
1. selectedModels から有効なモデルを絞り込み
2. activeBranchId があればそれを parentId に使用
   なければ getMainQChain の末尾 Q を基準に
   sigma → lastCons → Q自身 の優先順で parentId を決定
3. Q ノードを生成して session に追加
4. 各モデルの R ノードを生成
5. resolveCharLimit でモデルごとの文字数制限を並列取得
6. 文字数が制限を超える場合は compressHistory で圧縮（C方式）
7. 各モデルに並列ストリーミング送信
8. Ollama のみ onStats コールバックで速度統計を受け取り R ノードに保存
```

**コンテキスト構築 3 方式:**

| 方式 | 条件 | 動作 |
|------|------|------|
| full-cloud | クラウドモデル or 制限なし | 全会話履歴をそのまま送信 |
| full-local | ローカルモデルで制限内 | 全会話履歴をそのまま送信 |
| compressed | 制限超過、圧縮成功 | AI で要約した履歴 + 現在の質問 |
| truncated | 圧縮失敗時 | 古いメッセージを削除して送信 |

---

#### `generateSummary(qNodeId, modelKey, onChunkUpdate, onDone)`

Σ（シグマ）要約を実行。

```
1. Q直下の R ノード + manual ノードを収集
2. _sigmaInclude=true のブランチ Q の回答も追加
3. プロンプトを組み立てて streamWith で送信
4. 結果を sigma ノードとして保存
```

---

#### `executeConsolidation(qNodeIds, strategies, customInstruction, modelKey, ...)`

カード統合を実行。

```
1. 指定 Q ノードの回答テキストをパーツ化
   （ブランチQの _sigmaInclude=true なものも含む）
2. 各ストラテジー（best / merge / diff / custom）のプロンプトを構築
3. 並列で consolidation ノードを作成しストリーミング
4. 単一カード選択 → parentId のみ設定
   複数カード選択 → parentIds に全Q IDを設定（クロス統合）
```

**ストラテジー:**

| キー | 日本語 | 内容 |
|------|--------|------|
| `merge` | 統合 | 全回答を1つの包括的な回答にまとめる |
| `diff` | 差異抽出 | 各回答の違い・共通点・矛盾点を整理 |
| `best` | 最良判定 | 最も質の高い回答をしたモデルを判定 |
| `custom` | カスタム | ユーザー指定のプロンプトで処理 |

---

#### `executeMerge(nodeIds, strategy, modelKey, ...)`

ブランチマージを実行（MergeDialog から呼ばれる）。

```
選択した R / sigma ノードのテキストを結合し、
merge ストラテジーのプロンプトで streamWith して
merge ノードとして保存。
```

---

#### `reAskWith(qNodeId, modelKey, onChunkUpdate, onDone)`

既存 Q に対して別モデルで再回答を追加。新しい R ノードを作成してストリーミング。

---

### Ollama 統計 (`StreamStats`)

```typescript
interface StreamStats {
  totalMs: number       // total_duration / 1e6
  tokensPerSec: number  // eval_count / (eval_duration / 1e9)、小数点1桁
  evalCount: number     // eval_count（生成トークン数）
}
```

UniModelCard のフッターに `⚡ 12.3 tok/s · 5.2s` の形で表示される。

---

### `resolveCharLimit.ts`

モデル名のパターンマッチ（例: `:32b` → 大きい文字数制限）とユーザー設定（contextLimitChars）から実際に使う制限値を決定。クラウドモデルは `null`（制限なし）を返す。

---

## 6. コンテキスト管理

### `buildCtxMessages(s, qNodeId, overrideQuestion, maxHistoryChars?)`

AI に送る `ChatMessage[]` を構築するコアロジック。

```
1. 対象 Q ノードの祖先チェーンをたどる
2. 各ノードタイプに応じてメッセージを追加:
   - q         → role: 'user'
   - r         → role: 'assistant'（excluded なものはスキップ）
   - sigma     → role: 'assistant'、[Summary] プレフィックス
   - merge     → role: 'assistant'、[Merged] プレフィックス
   - manual    → role: 'assistant'、[Manual Context] プレフィックス
3. maxHistoryChars を超える場合は古いメッセージを前から削除
4. injectedContext があれば最初の user メッセージ先頭に挿入
```

### `activeBranchId` の役割

「どのノードから続けて質問するか」を管理するポインタ。

- SigmaBlock の「このΣから分岐」ボタン → activeBranchId = sigma.id
- CompositeCard の「続けて質問」ボタン → activeBranchId = lastCons.id
- send() が activeBranchId を parentId として新 Q を作成後、クリア

---

## 7. コンポーネント構成

```
App.vue
├── Sidebar.vue          セッション一覧（リスト / ツリービュー）
├── TopBar.vue           モデルピッカー、言語切替、送信ログボタン
│   └── ModelPickerPopup.vue  モデル選択ドロップダウン
├── ChatView.vue         メインチャットエリア
│   ├── CompositeCard.vue    1つの Q + その回答群をまとめるカード
│   │   ├── UniModelCard.vue     個別モデルの回答カード
│   │   ├── ManualContextCard.vue  手動コンテキストカード
│   │   ├── AddCard.vue          ブランチ作成ボタン
│   │   ├── SigmaBlock.vue       Σ要約表示エリア
│   │   └── ConsolidationBlock.vue  統合結果表示エリア
│   ├── MergeBlock.vue       ブランチマージ結果（チャット最下部）
│   └── ConsolidationBlock.vue  クロス統合結果（チャット最下部）
├── FloatingInputBar.vue  入力バー（通常 / 統合モード）
│   └── ContextPanel.vue     インジェクトコンテキスト編集パネル
├── CtxLogPanel.vue      送信ログパネル（デバッグ用）
├── SettingsModal.vue    設定画面
├── MergeDialog.vue      ブランチマージ選択ダイアログ
└── IntroOverlay.vue     初回起動時の説明オーバーレイ
```

### CompositeCard の内部構造

```
CompositeCard（depth=0 or ネスト）
├── Header（Q番号・質問テキスト・チェックボックス・折りたたみ）
├── UMC トグルバー（▼ モデル回答 (N) ・ドットインジケーター・AddCard）
├── カルーセル（横スクロール）
│   ├── UniModelCard × N（Rノード）
│   ├── ManualContextCard × M
│   └── CompositeCard（depth+1、ブランチQ）
├── 結果エリア（SigmaBlock + ConsolidationBlock × N）
├── A エリア（統合なし・完了時に「回答を統合する」ボタン）
└── ── CompositeCard 外 ──
    └── 「続けて質問」ボタン（統合 or Σ完了後・次のQがまだない場合）
```

### FloatingInputBar (FIB) の2モード

| モード | 起動タイミング | 動作 |
|--------|--------------|------|
| `normal` | 通常の質問入力 | テキスト入力 → send() |
| `consolidation` | カード統合ボタン押下 | モデル/ストラテジー選択 → executeConsolidation() |

---

## 8. 主要機能の動作フロー

### 通常送信

```
ユーザー入力 → FloatingInputBar → send()
  → Q ノード作成（parentId = activeBranchId or sigma/cons/lastQ）
  → 各モデルの R ノード作成
  → 並列ストリーミング開始（activeStreamIds に追加）
  → チャンク受信 → R ノードの content に追記 → Vue リアクティブで即時反映
  → 完了 → activeStreamIds から削除 → isComplete = true
  → CompositeCard の「A エリア」や「続けて質問」ボタンが出現
```

### Σ要約

```
UniModelCard フッターの「Σ」ボタン → generateSummary()
  → sigma ノード作成（parentId = qNodeId）
  → streamWith でストリーミング
  → SigmaBlock に結果表示
  → 「続けて質問」ボタンが出現（consolidationNodes なくても表示）
```

### カード統合

```
「回答を統合する」ボタン → handleConsolidateFromFooter()
  → selectedCardIds に Q ノード追加
  → openFib('consolidation')
ユーザーがモデル・ストラテジー選択して実行
  → executeConsolidation([qNodeIds], [strategies], ...)
  → consolidation ノード × strategies.length 作成
  → 並列ストリーミング
  → ConsolidationBlock に表示
  → 「統合を再実行」ボタンと「続けて質問」ボタン出現
```

### ブランチマージ

```
TopBar の「🔀」ボタン → MergeDialog
  → R / sigma ノードを複数選択
  → executeMerge() → merge ノード作成
  → MergeBlock に表示（チャット最下部）
```

### 続けて質問

```
「続けて質問」ボタン → handleContinueBelow()
  → activeBranchId = lastCons.id (or sigma.id or lastR.id)
  → openFib('normal')
ユーザーが入力 → send()
  → parentId = activeBranchId (= lastCons.id)
  → 新 Q ノードが統合結果を親として作成される
  → hasNextQ = true となり「続けて質問」ボタンが消える
```

---

## 9. 永続化・エクスポート

### IndexedDB（自動）

`pinia-plugin-persistedstate` が `session` / `settings` / `ui` ストアを IndexedDB に自動保存。
`ui` ストアの `ctxLog`（送信ログ）は永続化対象外。

永続化対象:
- `session`: sessions 配列（全ノード含む）、currentSessId、activeBranchId
- `settings`: AppConfig（API キー、URL等）
- `ui`: selectedModelKeys、lang、sidebarOpen、introShown 等

### Markdown エクスポート

`buildSessionMarkdown(s)` でセッション全体を Markdown に変換。
TopBar のダウンロードボタンから `{title}.md` としてダウンロード。

### Obsidian Vault 同期

`useVaultSync` コンポーザブル経由で `/api/vault/sync` に POST。
ローカル dev サーバー (`server/app.py` または `vault.py`) が Obsidian の vault フォルダに書き出す。
**本番（GitHub Pages）では使用不可**（バックエンドなし）。

### セッション JSON バックアップ

設定画面からセッション全体を `sessions.json` としてダウンロード。
インポートは `restoreFromBackup()` で ID 重複を除外しつつマージ。

---

## 10. デプロイ・PWA

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
- npm ci
- npm run build  (VITE_BASE=/braided/)
- actions/upload-pages-artifact@v3 → actions/deploy-pages@v4
```

ビルド時に `VITE_BASE=/braided/` を設定することで：
- Vite の `base` オプション → アセットパスに `/braided/` プレフィックス
- PWA マニフェストの `start_url` / `scope` → `/braided/`（Android PWA の 404 回避）

### PWA マニフェスト

```typescript
// vite.config.ts
const base = process.env.VITE_BASE ?? '/'
manifest: {
  start_url: base,   // '/braided/' on GH Pages, '/' on localhost
  scope: base,
  display: 'standalone',
  theme_color: '#1e1b2e',
}
```

### Service Worker（Workbox）

| URL パターン | キャッシュ戦略 |
|------------|--------------|
| `*.{js,css,html,ico,png,svg,woff2}` | Pre-cache（アプリシェル） |
| Google Fonts | CacheFirst（1年間） |
| OpenAI / Anthropic / Gemini / xAI API | NetworkOnly（キャッシュなし） |

### デバイス別注意事項

| デバイス | ブラウザ | PWA | ローカル AI |
|---------|---------|-----|------------|
| Mac | ✅ | ✅ | ✅ localhost で利用可 |
| Android | ✅ | ✅ Chrome から追加 | ⚠️ CORS + ORIGINS 設定が必要 |
| iPhone / iPad | ✅（クラウドのみ） | ✅ Safari から追加 | ❌ WebKit の Mixed Content 制限 |

---

## 11. 新機能追加ガイド

### 新しい AI プロバイダーを追加する

1. `src/composables/streaming/providers/{name}.ts` を作成
   ```typescript
   export async function stream{Name}(
     apiKey: string, model: string, messages: ChatMessage[],
     onChunk: (chunk: string) => void, signal?: AbortSignal,
   ): Promise<void> { ... }
   ```

2. `providers/index.ts` に export 追加

3. `useStreaming.ts` の `streamWith()` に if 行追加
   ```typescript
   if (prov === '{name}') return stream{Name}(cfg.{name}.apiKey, model, messages, onChunk, signal)
   ```

4. `types/index.ts` の `Provider` 型に追加

5. `stores/settings.ts` の `AppConfig` / `DEF` に設定追加

6. `SettingsModal.vue` に設定 UI 追加

7. `components/layout/TopBar.vue` のモデルリストに追加

8. `i18n/index.ts` の `consolidationStrategies` 等に必要に応じてラベル追加

---

### 新しいノードタイプを追加する

1. `types/index.ts` の `NodeType` に追加
2. `stores/session.ts` の `buildCtxMessages` / `buildSessionMarkdown` に処理追加
3. 表示コンポーネントを作成して `CompositeCard.vue` または `ChatView.vue` に追加

---

### コンテキストに影響を与える新機能

`buildCtxMessages` が会話履歴の唯一の構築点。変更はここに集約する。
送信前の内容は送信ログ（`_ctx` フィールドと `ctxLog`）で確認できる。

---

*最終更新: 2026-05-28*
