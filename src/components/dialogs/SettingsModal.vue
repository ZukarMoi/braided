<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import type { AppConfig } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>()

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const sessionStore = useSessionStore()

const lang = computed(() => uiStore.lang)

type Tab = 'ollama' | 'lmstudio' | 'anythingllm' | 'openai' | 'anthropic' | 'gemini' | 'grok' | 'vault'
// アコーディオン: null = 全閉じ、クリックでトグル
const openSection = ref<Tab | null>('ollama')
function toggleSection(key: Tab) {
  openSection.value = openSection.value === key ? null : key
}

// Local form state
const ollamaUrl              = ref('')
const ollamaUnloadAfter      = ref(false)
const ollamaContextLimit     = ref(0)
const lmstudioUrl            = ref('')
const lmstudioContextLimit   = ref(0)
const anythingllmUrl  = ref('')
const anythingllmKey  = ref('')
const openaiKey = ref('')
const anthropicKey = ref('')
const geminiKey = ref('')
const grokKey   = ref('')
const vaultPath = ref('')
const vaultAutoSync = ref(false)
const ollamaTestResult = ref('')
const ollamaTestClass = ref('test-result')
const lmstudioTestResult = ref('')
const lmstudioTestClass = ref('test-result')

watch(() => props.open, (v) => {
  if (v) {
    const cfg = settingsStore.cfg
    ollamaUrl.value          = cfg.ollama.url               || 'http://localhost:11434'
    ollamaUnloadAfter.value  = cfg.ollama.unloadAfter        ?? false
    ollamaContextLimit.value = cfg.ollama.contextLimitChars  ?? 0
    lmstudioUrl.value          = cfg.lmstudio.url              || 'http://localhost:1234'
    lmstudioContextLimit.value = cfg.lmstudio.contextLimitChars ?? 0
    anythingllmUrl.value = cfg.anythingllm.url      || 'http://localhost:3001'
    anythingllmKey.value = cfg.anythingllm.apiKey   || ''
    openaiKey.value      = cfg.openai.apiKey        || ''
    anthropicKey.value = cfg.anthropic.apiKey || ''
    geminiKey.value    = cfg.gemini.apiKey    || ''
    grokKey.value      = cfg.grok.apiKey      || ''
    vaultPath.value    = cfg.vault?.path      || ''
    vaultAutoSync.value= cfg.vault?.autoSync  ?? false
    ollamaTestResult.value   = ''
    ollamaTestClass.value    = 'test-result'
    lmstudioTestResult.value = ''
    lmstudioTestClass.value  = 'test-result'
  }
})

function close() {
  emit('update:open', false)
}

function save() {
  const next: AppConfig = {
    ollama:    { url: ollamaUrl.value.trim() || 'http://localhost:11434', unloadAfter: ollamaUnloadAfter.value, contextLimitChars: ollamaContextLimit.value },
    lmstudio:  { url: lmstudioUrl.value.trim() || 'http://localhost:1234', contextLimitChars: lmstudioContextLimit.value },
    anythingllm: { url: anythingllmUrl.value.trim() || 'http://localhost:3001', apiKey: anythingllmKey.value.trim() },
    openai:      { apiKey: openaiKey.value.trim() },
    anthropic: { apiKey: anthropicKey.value.trim() },
    gemini:    { apiKey: geminiKey.value.trim() },
    grok:      { apiKey: grokKey.value.trim() },
    vault:     { path: vaultPath.value.trim(), autoSync: vaultAutoSync.value },
  }
  settingsStore.save(next)
  close()
  uiStore.toast(lang.value === 'ja' ? '設定を保存しました' : 'Settings saved')
  emit('saved')
}

async function testOllama() {
  const url = ollamaUrl.value.trim() || 'http://localhost:11434'
  ollamaTestResult.value = '…'
  ollamaTestClass.value = 'test-result'
  try {
    const r = await fetch(`${url}/api/tags`)
    if (r.ok) {
      ollamaTestResult.value = `✓ ${lang.value === 'ja' ? '接続成功' : 'Connection OK'}`
      ollamaTestClass.value = 'test-result ok'
    } else throw new Error(String(r.status))
  } catch {
    ollamaTestResult.value = `✗ ${lang.value === 'ja' ? '接続失敗' : 'Connection failed'}`
    ollamaTestClass.value = 'test-result err'
  }
}

async function testLMStudio() {
  const url = lmstudioUrl.value.trim() || 'http://localhost:1234'
  lmstudioTestResult.value = '…'
  lmstudioTestClass.value = 'test-result'
  try {
    const r = await fetch(`${url}/v1/models`)
    if (r.ok) {
      const d = await r.json() as { data?: Array<{ id: string }> }
      const count = d.data?.length ?? 0
      lmstudioTestResult.value = `✓ ${count}${lang.value === 'ja' ? ' モデル検出' : ' model(s) found'}`
      lmstudioTestClass.value = 'test-result ok'
    } else throw new Error(String(r.status))
  } catch {
    lmstudioTestResult.value = `✗ ${lang.value === 'ja' ? '接続失敗' : 'Connection failed'}`
    lmstudioTestClass.value = 'test-result err'
  }
}

async function syncNow() {
  const { useVaultSync } = await import('@/composables/useVaultSync')
  const { syncToVault } = useVaultSync()
  await syncToVault()
}

async function openLog() {
  try {
    const r = await fetch('/api/log/open')
    const d = await r.json() as { status: string; message?: string }
    if (d.status !== 'ok') uiStore.toast(d.message ?? 'エラー')
  } catch {
    uiStore.toast('ログを開けませんでした')
  }
}

async function clearLog() {
  try {
    await fetch('/api/log', { method: 'DELETE' })
    uiStore.clearCtxLog()
    uiStore.toast(lang.value === 'ja' ? 'ログを削除しました' : 'Log cleared')
  } catch {
    uiStore.toast('ログ削除に失敗しました')
  }
}

function overlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'settings-overlay') close()
}

// ── フルバックアップ ──
function downloadFullBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessionStore.sessions,
    settings: settingsStore.cfg,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `braided-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ナビ項目の設定済み状態
const configured = computed(() => ({
  ollama:      !!ollamaUrl.value,
  lmstudio:    !!lmstudioUrl.value,
  anythingllm: !!(anythingllmUrl.value && anythingllmKey.value),
  openai:      !!openaiKey.value,
  anthropic:   !!anthropicKey.value,
  gemini:      !!geminiKey.value,
  grok:        !!grokKey.value,
  vault:       !!vaultPath.value,
}))
</script>

<template>
  <div v-if="open" id="settings-overlay" @click="overlayClick">
    <div id="settings-modal">

      <div class="modal-head">
        <h2>⚙ {{ lang === 'ja' ? '設定' : 'Settings' }}</h2>
        <button class="modal-close" @click="close">✕</button>
      </div>

      <div class="modal-body">
        <!-- アコーディオンセクション群 -->

        <!-- ─ ローカルAI グループヘッダー ─ -->
        <div class="acc-group-label">{{ lang === 'ja' ? 'ローカル AI' : 'Local AI' }}</div>

        <!-- Ollama -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('ollama')">
            <span class="snav-dot" :class="configured.ollama ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">Ollama</span>
            <span class="acc-chevron">{{ openSection === 'ollama' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'ollama'" class="acc-body">
          <div class="field">
            <label>{{ lang === 'ja' ? '接続先 URL' : 'Connection URL' }}</label>
            <input type="url" v-model="ollamaUrl" placeholder="http://localhost:11434">
            <div class="hint">{{ lang === 'ja' ? 'OLLAMA_ORIGINS=* が必要です' : 'OLLAMA_ORIGINS=* required' }} — <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a></div>
          </div>
          <div class="test-row">
            <button class="btn-test" @click="testOllama">{{ lang === 'ja' ? '接続テスト' : 'Test Connection' }}</button>
            <span :class="ollamaTestClass">{{ ollamaTestResult }}</span>
          </div>
          <div class="field vault-autosync-row" style="margin-top:12px">
            <label class="toggle-label">
              <input type="checkbox" v-model="ollamaUnloadAfter">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span>{{ lang === 'ja' ? '応答後にモデルをメモリから解放 (keep_alive: 0)' : 'Unload model after response (keep_alive: 0)' }}</span>
            </label>
          </div>
          <div class="field" style="margin-top:12px">
            <label>{{ lang === 'ja' ? '履歴コンテキスト上限（文字数）' : 'History context limit (chars)' }}</label>
            <input type="number" v-model.number="ollamaContextLimit" min="0" step="1000" placeholder="0">
            <div class="hint">{{ lang === 'ja' ? '0 = モデルの設定値から自動計算。パラメータ数が多いほど大きな値になります。' : '0 = auto-detect from model info. Larger models get a higher limit.' }}</div>
          </div>
          </div>
        </div>

        <!-- LM Studio -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('lmstudio')">
            <span class="snav-dot" :class="configured.lmstudio ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">LM Studio</span>
            <span class="acc-chevron">{{ openSection === 'lmstudio' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'lmstudio'" class="acc-body">
            <div class="field">
              <label>{{ lang === 'ja' ? '接続先 URL' : 'Server URL' }}</label>
              <input type="url" v-model="lmstudioUrl" placeholder="http://localhost:1234">
              <div class="hint">{{ lang === 'ja' ? 'LM Studio → Local Server → Start Server で起動' : 'LM Studio → Local Server → Start Server' }} — <a href="https://lmstudio.ai" target="_blank" rel="noopener">lmstudio.ai</a></div>
            </div>
            <div class="test-row">
              <button class="btn-test" @click="testLMStudio">{{ lang === 'ja' ? '接続テスト' : 'Test Connection' }}</button>
              <span :class="lmstudioTestClass">{{ lmstudioTestResult }}</span>
            </div>
            <div class="field" style="margin-top:12px">
              <label>{{ lang === 'ja' ? '履歴コンテキスト上限（文字数）' : 'History context limit (chars)' }}</label>
              <input type="number" v-model.number="lmstudioContextLimit" min="0" step="1000" placeholder="0">
              <div class="hint">{{ lang === 'ja' ? '0 = モデル名からパラメータ数を推定して自動計算' : '0 = auto-estimate from model name parameter size' }}</div>
            </div>
          </div>
        </div>

        <!-- AnythingLLM -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('anythingllm')">
            <span class="snav-dot" :class="configured.anythingllm ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">AnythingLLM</span>
            <span class="acc-badge">RAG</span>
            <span class="acc-chevron">{{ openSection === 'anythingllm' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'anythingllm'" class="acc-body">
            <div class="hint" style="margin-bottom:12px;line-height:1.7">
              <template v-if="lang === 'ja'">RAG対応ローカルAI。ワークスペースに独自の知識を持たせてBraidedから呼び出せます。</template>
              <template v-else>RAG-enabled local AI. Each workspace can have its own knowledge base.</template>
            </div>
            <div class="field">
              <label>{{ lang === 'ja' ? 'サーバー URL' : 'Server URL' }}</label>
              <input type="url" v-model="anythingllmUrl" placeholder="http://localhost:3001">
              <div class="hint">{{ lang === 'ja' ? '他のMacからの場合はIPアドレスに変更' : 'Use IP address for remote Mac' }} — <a href="https://anythingllm.com" target="_blank" rel="noopener">anythingllm.com</a></div>
            </div>
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="anythingllmKey" placeholder="NXXXXXX-XXXXXXXX-...">
              <div class="hint">{{ lang === 'ja' ? 'AnythingLLM → 設定（⚙）→ APIキー で発行' : 'AnythingLLM → Settings (⚙) → API Keys' }}</div>
            </div>
          </div>
        </div>

        <!-- ─ クラウドAI グループヘッダー ─ -->
        <div class="acc-group-label" style="margin-top:8px">{{ lang === 'ja' ? 'クラウド AI' : 'Cloud AI' }}</div>

        <!-- OpenAI -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('openai')">
            <span class="snav-dot" :class="configured.openai ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">OpenAI</span>
            <span class="acc-chevron">{{ openSection === 'openai' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'openai'" class="acc-body">
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="openaiKey" placeholder="sk-...">
              <div class="hint"><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a></div>
            </div>
          </div>
        </div>

        <!-- Anthropic -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('anthropic')">
            <span class="snav-dot" :class="configured.anthropic ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">Anthropic</span>
            <span class="acc-chevron">{{ openSection === 'anthropic' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'anthropic'" class="acc-body">
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="anthropicKey" placeholder="sk-ant-...">
              <div class="hint"><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a></div>
            </div>
          </div>
        </div>

        <!-- Google AI Studio -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('gemini')">
            <span class="snav-dot" :class="configured.gemini ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">Google AI Studio</span>
            <span class="acc-chevron">{{ openSection === 'gemini' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'gemini'" class="acc-body">
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="geminiKey" placeholder="AIzaSy...">
              <div class="hint"><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a> {{ lang === 'ja' ? '（無料枠あり）' : '(free tier available)' }}</div>
            </div>
          </div>
        </div>

        <!-- xAI Grok -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('grok')">
            <span class="snav-dot" :class="configured.grok ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">xAI Grok</span>
            <span class="acc-chevron">{{ openSection === 'grok' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'grok'" class="acc-body">
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="grokKey" placeholder="xai-...">
              <div class="hint"><a href="https://console.x.ai/" target="_blank" rel="noopener">console.x.ai</a> {{ lang === 'ja' ? 'でAPIキーを発行' : '— get your API key' }}</div>
            </div>
          </div>
        </div>

        <!-- ─ 出力フォルダ ─ -->
        <div class="acc-group-label" style="margin-top:8px">{{ lang === 'ja' ? '出力' : 'Export' }}</div>

        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('vault')">
            <span class="snav-dot" :class="configured.vault ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">📁 {{ lang === 'ja' ? '出力フォルダ' : 'Output Folder' }}</span>
            <span class="acc-chevron">{{ openSection === 'vault' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'vault'" class="acc-body">
            <div class="hint" style="margin-bottom:12px;line-height:1.7">
              <template v-if="lang === 'ja'">会話を <strong>Markdown</strong> として書き出し。Obsidian・VS Code・Logseq 等で活用できます。</template>
              <template v-else>Exports conversations as <strong>Markdown</strong>. Compatible with Obsidian, VS Code, Logseq, and more.</template>
            </div>
            <div class="field">
              <label>{{ lang === 'ja' ? '出力フォルダのパス' : 'Output Folder Path' }}</label>
              <input type="text" v-model="vaultPath" placeholder="~/Documents/MyNotes">
              <div class="hint">{{ lang === 'ja' ? '~ はホームディレクトリに展開されます' : '~ expands to your home directory' }}</div>
            </div>
            <div class="field vault-autosync-row">
              <label class="toggle-label">
                <input type="checkbox" v-model="vaultAutoSync">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
                <span>{{ lang === 'ja' ? 'ストリーム完了時に自動で書き出す' : 'Auto-export on stream completion' }}</span>
              </label>
            </div>
            <div class="test-row" style="margin-top:12px">
              <button class="btn-test" @click="syncNow">📁 {{ lang === 'ja' ? '今すぐ書き出し' : 'Export now' }}</button>
            </div>
            <div class="field" style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:14px">
              <label>{{ lang === 'ja' ? '送信ログ (ctx-log.jsonl)' : 'Send Log (ctx-log.jsonl)' }}</label>
              <div class="hint" style="margin-bottom:8px">{{ lang === 'ja' ? '出力フォルダ/Braided/ctx-log.jsonl' : 'OutputFolder/Braided/ctx-log.jsonl' }}</div>
              <div style="display:flex;gap:8px">
                <button class="btn-test" @click="openLog">{{ lang === 'ja' ? '📄 ログを開く' : '📄 Open Log' }}</button>
                <button class="btn-test btn-danger" @click="clearLog">{{ lang === 'ja' ? '🗑 ログ全削除' : '🗑 Clear Log' }}</button>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /modal-body -->

      <div class="modal-foot">
        <button class="btn-backup" :title="lang === 'ja' ? '履歴・設定をJSONでバックアップ' : 'Download full backup (JSON)'" @click="downloadFullBackup">
          {{ lang === 'ja' ? '⬇ バックアップ' : '⬇ Backup' }}
        </button>
        <button class="btn-cancel" @click="close">{{ lang === 'ja' ? 'キャンセル' : 'Cancel' }}</button>
        <button class="btn-primary" @click="save">{{ lang === 'ja' ? '保存' : 'Save' }}</button>
      </div>
    </div>
  </div>
</template>
