export type Lang = 'ja' | 'en'

export interface TranslationKeys {
  // ── 既存キー ──
  newSession: string
  tabList: string
  tabTree: string
  settings: string
  selectAll: string
  deselectAll: string
  send: string
  welcomeTitle: string
  welcomeBody: string
  promptPh: string
  qLabel: string
  qPh: string
  mergeBtn: string
  mergeDialogTitle: string
  mergeSelectLabel: string
  mergeStrategyLabel: string
  cancelBtn: string
  mergeExecBtn: string
  modalTitle: string
  ollamaUrlLabel: string
  ollamaHint: string
  testBtn: string
  apiKeyLabel: string
  apiKeyUnset: string
  apiKeySet: string
  saveBtn: string
  branchFrom: string
  summarize: string
  clearBranch: string
  branching: string
  noModels: string
  testOk: string
  testFail: string
  saved: string
  mergeNeedTwo: string
  mergeNeedStrategy: string
  ctxPanelTitle: string
  ctxClear: string
  ctxPh: string
  ctxHint: string
  ctxActive: string
  exportEmpty: string
  vaultTab: string
  vaultPathLabel: string
  vaultPathHint: string
  vaultSyncing: string
  vaultSyncOk: string
  vaultSyncFail: string
  vaultNoPath: string
  vaultBtn: string
  vaultBtnTitle: string
  introWelcome: string
  introSub: string
  introF1: string
  introF2: string
  introF3: string
  introOllamaTitle: string
  introOllamaHint: string
  introCloudTitle: string
  introCloudHint: string
  introSkip: string
  introStart: string
  strategies: {
    summary: string
    contrast: string
    judge: string
    handoff: string
  }
  aiSumPrompt: (q: string, parts: string) => string
  aiMergePrompt: (strategy: string, nodes: Array<{ label: string; content: string }>) => string
  aiConsolidatePrompt: (strategy: string, parts: string, custom: string) => string
  aiCompressPrompt: (history: string) => string

  // ── 新規: 汎用アクション ──
  copy: string
  copied: string
  copySuccess: string
  copyFail: string
  download: string
  edit: string
  deleteBtn: string
  stop: string
  back: string
  close: string
  insert: string
  execute: string
  continueAsking: string
  continueHere: string
  processing: string
  includeInCtx: string
  noModelsAvail: string

  // ── 新規: CompositeCard ──
  excludeFromSigma: string
  includeInSigma: string
  selectForConsolidate: string
  modelResponses: string
  pendingInput: string
  reconsolidate: string
  consolidateResponses: string
  newQuestionBtn: string

  // ── 新規: チャット共通ラベル ──
  mergeLabel: string
  summaryLabel: string
  excluded: string
  excludeFromCtx: string
  unexclude: string
  excludeAndStop: string
  manualContextTitle: string
  cancelledLabel: string

  // ── 新規: AddCard メニュー ──
  acmSelectModel: string
  acmInsertCtx: string
  acmAdd: string
  acmAddModel: string
  acmCreateBranch: string
  acmCtxPh: string

  // ── 新規: 統合戦略（ConsolidationBlock / FloatingInputBar 共用） ──
  consolidationStrategies: {
    best:    { label: string; desc: string }
    merge:   { label: string; desc: string }
    diff:    { label: string; desc: string }
    custom:  { label: string; desc: string }
    default: { label: string }
  }

  // ── 新規: コンテキスト送信方式バッジ ──
  ctxMethod: {
    cloud: string
    local: string
    comp:  string
    trunc: string
  }

  // ── 新規: FloatingInputBar ──
  compressing: string
  modelLabel: string
  consolidatePolicy: string
  customInstructionPh: string
  contextLabel: string
  clearContext: string
  newQuestion: string
  newQuestionStart: string
  addToThread: string
  consolidate: string
  fibPromptPh: string
  nSelected: (n: number) => string

  // ── 新規: TopBar ──
  sendLog: string
  sendLogClose: string
  sendLogOpen: string
  connOk: string
  connChecking: string
  connFail: string
  connIdle: string
  selectModels: string
  nModelsSelected: (n: number) => string

  // ── 新規: Sidebar ──
  noSessions: string
  noNodes: string
  sidebarClose: string

  // ── 新規: ModelPickerPopup ──
  selectModelsTitle: string
  addProvider: string
  noModelsInGroup: string
  allModels: string
  noneModels: string

  // ── 新規: CtxLogPanel / UniModelCard debug ──
  sendLogEmpty: string
  currentQuestion: string
  collapseMsg: string
  expandMsg: string
  sendCtxTitle: string
}

export const T: Record<Lang, TranslationKeys> = {
  ja: {
    // ── 既存 ──
    newSession: '新しいセッション',
    tabList: '履歴',
    tabTree: '🌿 ツリー',
    settings: '⚙ 設定',
    selectAll: '全選択',
    deselectAll: '全解除',
    send: '送信 ▶',
    welcomeTitle: 'AIの視点を分岐させ、答えを編む',
    welcomeBody: 'モデルを選んで質問すると、回答をブランチとして展開できます',
    promptPh: '質問を入力… (Shift+Enter / ⌘+Enter で送信)',
    qLabel: '💬 質問への追加指示',
    qPh: '追加の指示を入力…',
    mergeBtn: '🔀',
    mergeDialogTitle: '🔀 ブランチを統合',
    mergeSelectLabel: '統合するノードを選択',
    mergeStrategyLabel: '統合戦略',
    cancelBtn: 'キャンセル',
    mergeExecBtn: '統合して質問',
    modalTitle: '⚙ 設定',
    ollamaUrlLabel: '接続先 URL',
    ollamaHint: 'OLLAMA_ORIGINS=* が必要です',
    testBtn: '接続テスト',
    apiKeyLabel: 'API Key',
    apiKeyUnset: 'APIキー未設定',
    apiKeySet: 'APIキー設定済み',
    saveBtn: '保存',
    branchFrom: '↳ ここから質問',
    summarize: 'Σ 要約',
    clearBranch: '✕ ブランチ解除',
    branching: '分岐元',
    noModels: 'モデルが選択されていません',
    testOk: '接続成功',
    testFail: '接続失敗',
    saved: '設定を保存しました',
    mergeNeedTwo: '2つ以上のノードを選択してください',
    mergeNeedStrategy: '統合戦略を選択してください',
    ctxPanelTitle: '📄 セッションコンテキスト',
    ctxClear: 'クリア',
    ctxPh: '前回エクスポートしたMDや背景メモをここにペースト…',
    ctxHint: 'このセッションの全質問に自動的に含まれます',
    ctxActive: '📄 コンテキスト注入中',
    exportEmpty: 'エクスポートできるデータがありません',
    vaultTab: '📁 Vault',
    vaultPathLabel: 'Vault パス',
    vaultPathHint: 'ObsidianのVaultフォルダのフルパスを指定してください（例: /Users/you/ObsidianVault）',
    vaultSyncing: 'Vaultに同期中…',
    vaultSyncOk: 'Vaultに同期しました ✓',
    vaultSyncFail: 'Vault同期失敗',
    vaultNoPath: '設定でVaultパスを設定してください',
    vaultBtn: '📁',
    vaultBtnTitle: 'Obsidian Vaultに同期',
    introWelcome: 'Braided へようこそ',
    introSub: '複数のAIに同時に問いを投げ、回答を分岐・統合して答えを編み上げるツールです。',
    introF1: '複数AIへ同時送信 — 視点を並べる',
    introF2: '回答からブランチ — 気になる方向へ深掘り',
    introF3: 'ブランチをマージ — 知見を1つに統合',
    introOllamaTitle: 'Ollama（ローカルAI）',
    introOllamaHint: 'Ollamaが起動していればモデルを自動検出します。<br>起動コマンド: <code>OLLAMA_ORIGINS=* ollama serve</code>',
    introCloudTitle: 'クラウドAI（任意）',
    introCloudHint: '1つ以上設定するとクラウドモデルが使用できます。後から⚙設定でも変更可能です。',
    introSkip: 'スキップして始める',
    introStart: '設定して始める →',
    strategies: {
      summary: '🧩 総合要約 — 全回答を1つにまとめる',
      contrast: '⚔ 対立抽出 — 意見の違いを浮き彫りにする',
      judge: '⚖ 判定委任 — どの回答が最適かを判定',
      handoff: '🔗 引き継ぎ — 1つを選んで深掘り',
    },
    aiSumPrompt: (q: string, parts: string) =>
      `以下の質問に対する複数のAIモデルの回答を統合・要約してください。\n\n質問: ${q}\n\n各モデルの回答:\n${parts}\n\n簡潔に要点をまとめてください。（日本語で返答してください）`,
    aiMergePrompt: (strategy: string, nodes: Array<{ label: string; content: string }>) => {
      const body = nodes.map(n => `[${n.label}]\n${n.content}`).join('\n\n---\n\n')
      return ({
        summary: `以下の複数のAI回答を統合して1つの包括的な回答を作成してください。（日本語で返答してください）\n\n${body}`,
        contrast: `以下の複数のAI回答の類似点と相違点を分析してください。（日本語で返答してください）\n\n${body}`,
        judge: `以下の複数のAI回答を評価し、最も優れた回答を選んで理由を説明してください。（日本語で返答してください）\n\n${body}`,
        handoff: `以下の回答の中から最も有望なものを選び、さらに詳細に展開してください。（日本語で返答してください）\n\n${body}`,
      } as Record<string, string>)[strategy] ?? body
    },
    aiConsolidatePrompt: (strategy: string, parts: string, custom: string) => ({
      best:   `以下の複数の質問と回答を総合的に評価し、最も適切・質の高い回答をしたモデルを判定してください。各回答の強みと弱みを述べ、最適なモデルを選んだ理由を示してください。（日本語で返答してください）\n\n${parts}`,
      merge:  `以下の複数の質問と回答を統合し、一つの包括的な回答にまとめてください。（日本語で返答してください）\n\n${parts}`,
      diff:   `以下の複数の質問と回答を比較し、各回答の違い・独自の観点・矛盾点・共通点を整理してください。（日本語で返答してください）\n\n${parts}`,
      custom: `${custom}\n\n[対象]\n${parts}`,
    } as Record<string, string>)[strategy] ?? parts,
    aiCompressPrompt: (history: string) =>
      `以下の会話履歴を、重要な情報・文脈・結論を保ちながら簡潔に要約してください。要約のみを出力し、説明文は不要です。（日本語で返答してください）\n\n${history}`,

    // ── 新規: 汎用アクション ──
    copy: 'コピー',
    copied: 'コピー済み',
    copySuccess: 'コピーしました',
    copyFail: 'コピー失敗',
    download: 'ダウンロード',
    edit: '編集',
    deleteBtn: '削除',
    stop: '■ 停止',
    back: '戻る',
    close: '閉じる',
    insert: '挿入',
    execute: '実行 ▶',
    continueAsking: '続けて質問',
    continueHere: '⌄ 引き続き質問',
    processing: '処理中…',
    includeInCtx: 'コンテキストに含める',
    noModelsAvail: '利用可能なモデルなし',

    // ── 新規: CompositeCard ──
    excludeFromSigma: '統合から除外する',
    includeInSigma: '統合に含める',
    selectForConsolidate: '統合対象として選択',
    modelResponses: 'モデル回答',
    pendingInput: '入力待ち…',
    reconsolidate: '統合を再実行',
    consolidateResponses: '回答を統合する',
    newQuestionBtn: '✏️ 新しい質問',

    // ── 新規: チャット共通ラベル ──
    mergeLabel: 'マージ',
    summaryLabel: '要約',
    excluded: '除外中',
    excludeFromCtx: 'コンテキストから除外',
    unexclude: '除外解除',
    excludeAndStop: '除外して停止',
    manualContextTitle: '手動コンテキスト',
    cancelledLabel: '[停止]',

    // ── 新規: AddCard メニュー ──
    acmSelectModel: 'モデルを選択',
    acmInsertCtx: 'コンテキスト挿入',
    acmAdd: '追加',
    acmAddModel: '別モデルの回答を追加',
    acmCreateBranch: 'ブランチを作成',
    acmCtxPh: 'Wikiの記事、他モデルの回答、参考テキストなど…',

    // ── 新規: 統合戦略 ──
    consolidationStrategies: {
      best:    { label: '最適回答判定', desc: '最も適切な回答のモデルを判定' },
      merge:   { label: '統合',         desc: '全回答を一つにまとめる' },
      diff:    { label: '差異抽出',     desc: '全回答の違いを明確化' },
      custom:  { label: 'カスタム指示', desc: '独自の指示で処理' },
      default: { label: '統合結果' },
    },

    // ── 新規: コンテキスト送信方式バッジ ──
    ctxMethod: {
      cloud: 'クラウド（全文送信）',
      local: 'ローカル（制限内）',
      comp:  '要約圧縮（C方式）',
      trunc: '切り詰め（B方式）',
    },

    // ── 新規: FloatingInputBar ──
    compressing: '履歴を圧縮中…',
    modelLabel: 'モデル',
    consolidatePolicy: '統合方針（複数選択可）',
    customInstructionPh: '💬 カスタム指示を入力…',
    contextLabel: 'コンテキスト',
    clearContext: 'コンテキストをクリア',
    newQuestion: '新しい質問',
    newQuestionStart: '新しい質問（スレッド開始）',
    addToThread: 'メインスレッドへ追加',
    consolidate: '統合',
    fibPromptPh: '質問を入力… (⌘+Enter で送信)',
    nSelected: (n: number) => `${n} 件選択中`,

    // ── 新規: TopBar ──
    sendLog: '送信ログ',
    sendLogClose: '送信ログを閉じる',
    sendLogOpen: '送信ログを表示',
    connOk: '✓ 接続済み',
    connChecking: '… 確認中',
    connFail: '✗ 接続失敗',
    connIdle: '– 未確認',
    selectModels: 'モデルを選択',
    nModelsSelected: (n: number) => `${n} モデル選択中`,

    // ── 新規: Sidebar ──
    noSessions: 'セッションなし',
    noNodes: 'ノードなし',
    sidebarClose: '閉じる',

    // ── 新規: ModelPickerPopup ──
    selectModelsTitle: 'モデル選択',
    addProvider: '設定からプロバイダーを追加してください',
    noModelsInGroup: 'モデルなし',
    allModels: '全選択',
    noneModels: '全解除',

    // ── 新規: CtxLogPanel / UniModelCard debug ──
    sendLogEmpty: '送信ログなし',
    currentQuestion: '★ 現在の質問',
    collapseMsg: 'クリックして折りたたむ',
    expandMsg: 'クリックして全文表示',
    sendCtxTitle: '送信コンテキスト',
  },

  en: {
    // ── 既存 ──
    newSession: 'New Session',
    tabList: 'History',
    tabTree: '🌿 Tree',
    settings: '⚙ Settings',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    send: 'Send ▶',
    welcomeTitle: 'Branch AI perspectives, weave the answer',
    welcomeBody: 'Select models and ask a question to explore branching responses',
    promptPh: 'Ask a question… (Shift+Enter / ⌘+Enter to send)',
    qLabel: '💬 Extra instruction',
    qPh: 'Add extra context for the AI…',
    mergeBtn: '🔀',
    mergeDialogTitle: '🔀 Merge Branches',
    mergeSelectLabel: 'Select nodes to merge',
    mergeStrategyLabel: 'Merge strategy',
    cancelBtn: 'Cancel',
    mergeExecBtn: 'Merge & Ask',
    modalTitle: '⚙ Settings',
    ollamaUrlLabel: 'Connection URL',
    ollamaHint: 'OLLAMA_ORIGINS=* required',
    testBtn: 'Test Connection',
    apiKeyLabel: 'API Key',
    apiKeyUnset: 'API key not set',
    apiKeySet: 'API key configured',
    saveBtn: 'Save',
    branchFrom: '↳ Branch from here',
    summarize: 'Σ Summarize',
    clearBranch: '✕ Clear branch',
    branching: 'Branching from',
    noModels: 'No models selected',
    testOk: 'Connection OK',
    testFail: 'Connection failed',
    saved: 'Settings saved',
    mergeNeedTwo: 'Select at least 2 nodes',
    mergeNeedStrategy: 'Select a merge strategy',
    ctxPanelTitle: '📄 Session Context',
    ctxClear: 'Clear',
    ctxPh: 'Paste a previous export or background notes here…',
    ctxHint: 'Automatically included in every question in this session',
    ctxActive: '📄 Context injected',
    exportEmpty: 'Nothing to export yet',
    vaultTab: '📁 Vault',
    vaultPathLabel: 'Vault Path',
    vaultPathHint: 'Full path to your Obsidian vault folder (e.g. /Users/you/ObsidianVault)',
    vaultSyncing: 'Syncing to Vault…',
    vaultSyncOk: 'Synced to Vault ✓',
    vaultSyncFail: 'Vault sync failed',
    vaultNoPath: 'Set a Vault path in Settings first',
    vaultBtn: '📁',
    vaultBtnTitle: 'Sync to Obsidian Vault',
    introWelcome: 'Welcome to Braided',
    introSub: 'Send questions to multiple AIs at once, branch from any response, and merge perspectives into a unified answer.',
    introF1: 'Send to multiple AIs — compare perspectives side by side',
    introF2: 'Branch from any response — dig deeper in any direction',
    introF3: 'Merge branches — synthesize insights into one',
    introOllamaTitle: 'Ollama (Local AI)',
    introOllamaHint: 'If Ollama is running, models are detected automatically.<br>Start command: <code>OLLAMA_ORIGINS=* ollama serve</code>',
    introCloudTitle: 'Cloud AI (Optional)',
    introCloudHint: 'Add one or more API keys to use cloud models. You can change these later in ⚙ Settings.',
    introSkip: 'Skip & start',
    introStart: 'Save & start →',
    strategies: {
      summary: '🧩 Unified Summary — merge all responses into one',
      contrast: '⚔ Contrast — highlight differences between responses',
      judge: '⚖ Judge — determine which response is best',
      handoff: '🔗 Handoff — pick one and go deeper',
    },
    aiSumPrompt: (q: string, parts: string) =>
      `Summarize and integrate the following AI responses to the question.\n\nQuestion: ${q}\n\nResponses:\n${parts}\n\nProvide a concise synthesis. (Respond in English)`,
    aiMergePrompt: (strategy: string, nodes: Array<{ label: string; content: string }>) => {
      const body = nodes.map(n => `[${n.label}]\n${n.content}`).join('\n\n---\n\n')
      return ({
        summary: `Synthesize the following AI responses into one comprehensive answer. (Respond in English)\n\n${body}`,
        contrast: `Analyze the similarities and differences between these AI responses. (Respond in English)\n\n${body}`,
        judge: `Evaluate these AI responses and identify the best one with reasoning. (Respond in English)\n\n${body}`,
        handoff: `Select the most promising response below and expand on it in greater depth. (Respond in English)\n\n${body}`,
      } as Record<string, string>)[strategy] ?? body
    },
    aiConsolidatePrompt: (strategy: string, parts: string, custom: string) => ({
      best:   `Evaluate the following questions and responses comprehensively, and determine which model gave the most appropriate and high-quality answer. Describe the strengths and weaknesses of each response and explain your choice. (Respond in English)\n\n${parts}`,
      merge:  `Consolidate the following questions and responses into one comprehensive answer. (Respond in English)\n\n${parts}`,
      diff:   `Compare the following questions and responses, and organize the differences, unique perspectives, contradictions, and common points. (Respond in English)\n\n${parts}`,
      custom: `${custom}\n\n[Target]\n${parts}`,
    } as Record<string, string>)[strategy] ?? parts,
    aiCompressPrompt: (history: string) =>
      `Summarize the following conversation history concisely while preserving important information, context, and conclusions. Output the summary only, no explanations needed. (Respond in English)\n\n${history}`,

    // ── 新規: 汎用アクション ──
    copy: 'Copy',
    copied: 'Copied',
    copySuccess: 'Copied',
    copyFail: 'Copy failed',
    download: 'Download',
    edit: 'Edit',
    deleteBtn: 'Delete',
    stop: '■ Stop',
    back: 'Back',
    close: 'Close',
    insert: 'Insert',
    execute: 'Execute ▶',
    continueAsking: 'Continue asking',
    continueHere: '⌄ Continue here',
    processing: 'Processing…',
    includeInCtx: 'Include in context',
    noModelsAvail: 'No models available',

    // ── 新規: CompositeCard ──
    excludeFromSigma: 'Exclude from synthesis',
    includeInSigma: 'Include in synthesis',
    selectForConsolidate: 'Select for consolidation',
    modelResponses: 'Model responses',
    pendingInput: 'Waiting for input…',
    reconsolidate: 'Re-run consolidation',
    consolidateResponses: 'Consolidate responses',
    newQuestionBtn: '✏️ New question',

    // ── 新規: チャット共通ラベル ──
    mergeLabel: 'Merge',
    summaryLabel: 'Summary',
    excluded: 'Excluded',
    excludeFromCtx: 'Exclude from context',
    unexclude: 'Un-exclude',
    excludeAndStop: 'Exclude and stop',
    manualContextTitle: 'Manual context',
    cancelledLabel: '[Stopped]',

    // ── 新規: AddCard メニュー ──
    acmSelectModel: 'Select model',
    acmInsertCtx: 'Insert context',
    acmAdd: 'Add',
    acmAddModel: 'Get response from another model',
    acmCreateBranch: 'Create branch',
    acmCtxPh: 'Wikipedia, other AI responses, reference text…',

    // ── 新規: 統合戦略 ──
    consolidationStrategies: {
      best:    { label: 'Best Answer',          desc: 'Determine the best model response' },
      merge:   { label: 'Merge',                desc: 'Combine all responses into one' },
      diff:    { label: 'Diff',                 desc: 'Highlight differences between responses' },
      custom:  { label: 'Custom Instruction',   desc: 'Process with custom instructions' },
      default: { label: 'Consolidation Result' },
    },

    // ── 新規: コンテキスト送信方式バッジ ──
    ctxMethod: {
      cloud: 'Cloud (full)',
      local: 'Local (within limit)',
      comp:  'Compressed (C)',
      trunc: 'Truncated (B)',
    },

    // ── 新規: FloatingInputBar ──
    compressing: 'Compressing history…',
    modelLabel: 'Model',
    consolidatePolicy: 'Consolidation strategy (multiple OK)',
    customInstructionPh: '💬 Enter custom instruction…',
    contextLabel: 'Context',
    clearContext: 'Clear context',
    newQuestion: 'New question',
    newQuestionStart: 'New question (start thread)',
    addToThread: 'Add to main thread',
    consolidate: 'Consolidate',
    fibPromptPh: 'Ask anything… (⌘+Enter to send)',
    nSelected: (n: number) => `${n} selected`,

    // ── 新規: TopBar ──
    sendLog: 'Send log',
    sendLogClose: 'Close send log',
    sendLogOpen: 'Open send log',
    connOk: '✓ Connected',
    connChecking: '… Checking',
    connFail: '✗ Connection failed',
    connIdle: '– Not checked',
    selectModels: 'Select models',
    nModelsSelected: (n: number) => `${n} model${n !== 1 ? 's' : ''}`,

    // ── 新規: Sidebar ──
    noSessions: 'No sessions',
    noNodes: 'No nodes',
    sidebarClose: 'Close',

    // ── 新規: ModelPickerPopup ──
    selectModelsTitle: 'Select Models',
    addProvider: 'Add a provider in Settings',
    noModelsInGroup: 'No models',
    allModels: 'All',
    noneModels: 'None',

    // ── 新規: CtxLogPanel / UniModelCard debug ──
    sendLogEmpty: 'No send logs',
    currentQuestion: '★ Current question',
    collapseMsg: 'Click to collapse',
    expandMsg: 'Click to expand',
    sendCtxTitle: 'Send context',
  },
}

export function t(lang: Lang, key: string): string {
  const dict = (T[lang] ?? T.ja) as unknown as Record<string, unknown>
  const val = dict[key]
  if (typeof val === 'string') return val
  return key
}
