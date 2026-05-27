<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import { T } from '@/i18n'
import type { AppConfig, Session } from '@/types'

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const sessionStore = useSessionStore()
const emit = defineEmits<{ saved: [] }>()

const lang = computed(() => uiStore.lang)
const show = computed(() => uiStore.introShown)

// フォーム状態（ストアの値で初期化 → IndexedDB ハイドレーション後に更新）
const ollamaUrl      = ref(settingsStore.cfg.ollama.url      || 'http://localhost:11434')
const lmstudioUrl    = ref(settingsStore.cfg.lmstudio.url    || 'http://localhost:1234')
const anythingllmUrl = ref(settingsStore.cfg.anythingllm.url || 'http://localhost:3001')
const anythingllmKey = ref(settingsStore.cfg.anythingllm.apiKey || '')
const openaiKey      = ref(settingsStore.cfg.openai.apiKey      || '')
const anthropicKey   = ref(settingsStore.cfg.anthropic.apiKey   || '')
const geminiKey      = ref(settingsStore.cfg.gemini.apiKey      || '')

// IndexedDB ハイドレーション完了後にフォームを再同期（ユーザーが未入力の場合のみ）
watch(() => settingsStore.cfg, (cfg) => {
  if (!openaiKey.value)      openaiKey.value      = cfg.openai.apiKey      || ''
  if (!anthropicKey.value)   anthropicKey.value   = cfg.anthropic.apiKey   || ''
  if (!geminiKey.value)      geminiKey.value      = cfg.gemini.apiKey      || ''
  if (!anythingllmKey.value) anythingllmKey.value = cfg.anythingllm.apiKey || ''
  // URL はデフォルト値と同じ場合のみ上書き（ユーザーが変更していたら触らない）
  if (ollamaUrl.value      === 'http://localhost:11434') ollamaUrl.value      = cfg.ollama.url      || 'http://localhost:11434'
  if (lmstudioUrl.value    === 'http://localhost:1234')  lmstudioUrl.value    = cfg.lmstudio.url    || 'http://localhost:1234'
  if (anythingllmUrl.value === 'http://localhost:3001')  anythingllmUrl.value = cfg.anythingllm.url || 'http://localhost:3001'
}, { deep: true, once: true })

// アコーディオン
type Section = 'ollama' | 'lmstudio' | 'anythingllm' | 'openai' | 'anthropic' | 'gemini'
const openSection = ref<Section | null>(null)
function toggleSection(key: Section) {
  openSection.value = openSection.value === key ? null : key
}

// 接続テスト
const ollamaTestResult   = ref('')
const ollamaTestClass    = ref('test-result')
const lmstudioTestResult = ref('')
const lmstudioTestClass  = ref('test-result')

async function testOllama() {
  const url = ollamaUrl.value.trim() || 'http://localhost:11434'
  ollamaTestResult.value = '…'; ollamaTestClass.value = 'test-result'
  try {
    const r = await fetch(`${url}/api/tags`)
    if (r.ok) { ollamaTestResult.value = `✓ ${T[lang.value].testOk}`; ollamaTestClass.value = 'test-result ok' }
    else throw new Error()
  } catch { ollamaTestResult.value = `✗ ${T[lang.value].testFail}`; ollamaTestClass.value = 'test-result err' }
}

async function testLMStudio() {
  const url = lmstudioUrl.value.trim() || 'http://localhost:1234'
  lmstudioTestResult.value = '…'; lmstudioTestClass.value = 'test-result'
  try {
    const r = await fetch(`${url}/v1/models`)
    if (r.ok) {
      const d = await r.json() as { data?: Array<{ id: string }> }
      const n = d.data?.length ?? 0
      lmstudioTestResult.value = `✓ ${n}${lang.value === 'ja' ? ' モデル検出' : ' model(s)'}`
      lmstudioTestClass.value = 'test-result ok'
    } else throw new Error()
  } catch { lmstudioTestResult.value = `✗ ${T[lang.value].testFail}`; lmstudioTestClass.value = 'test-result err' }
}

// 設定済みドット
const configured = computed(() => ({
  ollama:      !!ollamaUrl.value,
  lmstudio:    !!lmstudioUrl.value,
  anythingllm: !!(anythingllmUrl.value && anythingllmKey.value),
  openai:      !!openaiKey.value,
  anthropic:   !!anthropicKey.value,
  gemini:      !!geminiKey.value,
}))

function closeIntro(save: boolean) {
  if (save) {
    const cfg = settingsStore.cfg
    const next: AppConfig = {
      ...cfg,
      ollama:      { ...cfg.ollama,      url:    ollamaUrl.value.trim()      || cfg.ollama.url },
      lmstudio:    { ...cfg.lmstudio,    url:    lmstudioUrl.value.trim()    || cfg.lmstudio.url },
      anythingllm: { ...cfg.anythingllm, url:    anythingllmUrl.value.trim() || cfg.anythingllm.url,
                                         apiKey: anythingllmKey.value.trim() || cfg.anythingllm.apiKey },
      openai:      { ...cfg.openai,      apiKey: openaiKey.value.trim()    || cfg.openai.apiKey },
      anthropic:   { ...cfg.anthropic,   apiKey: anthropicKey.value.trim() || cfg.anthropic.apiKey },
      gemini:      { ...cfg.gemini,      apiKey: geminiKey.value.trim()    || cfg.gemini.apiKey },
    }
    settingsStore.save(next)
    emit('saved')          // TopBar の loadModels() を呼び出してもらう
  }
  uiStore.introShown = false
}

// ── バックアップからの復元 ──
const restoreFileRef = ref<HTMLInputElement | null>(null)
const restoreStatus = ref<'idle' | 'ok' | 'err'>('idle')
const restoreMessage = ref('')

function openRestorePicker() {
  restoreStatus.value = 'idle'
  restoreMessage.value = ''
  restoreFileRef.value?.click()
}

async function onRestoreFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = '' // 同ファイルを再選択できるようにリセット

  try {
    const text = await file.text()
    const data = JSON.parse(text) as unknown

    let sessions: Session[] = []
    let cfg: Partial<AppConfig> | null = null

    // 対応フォーマット:
    // 1. フルバックアップ: { version, sessions, settings }
    // 2. Vault sessions.json: Session[]
    if (Array.isArray(data)) {
      sessions = data as Session[]
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (Array.isArray(obj.sessions)) sessions = obj.sessions as Session[]
      if (obj.settings && typeof obj.settings === 'object') cfg = obj.settings as Partial<AppConfig>
    }

    if (!sessions.length && !cfg) {
      throw new Error(lang.value === 'ja' ? '有効なバックアップファイルではありません' : 'Invalid backup file')
    }

    // 履歴を復元
    if (sessions.length) sessionStore.restoreFromBackup(sessions)

    // 設定を復元（APIキーなど）
    if (cfg) {
      const current = settingsStore.cfg
      settingsStore.save({
        ollama:      { ...current.ollama,      ...(cfg.ollama      ?? {}) },
        lmstudio:    { ...current.lmstudio,    ...(cfg.lmstudio    ?? {}) },
        anythingllm: { ...current.anythingllm, ...(cfg.anythingllm ?? {}) },
        openai:      { ...current.openai,      ...(cfg.openai      ?? {}) },
        anthropic:   { ...current.anthropic,   ...(cfg.anthropic   ?? {}) },
        gemini:      { ...current.gemini,      ...(cfg.gemini      ?? {}) },
        grok:        { ...current.grok,        ...(cfg.grok        ?? {}) },
        vault:       { ...current.vault,       ...(cfg.vault       ?? {}) },
      })
    }

    const parts = []
    if (sessions.length) parts.push(lang.value === 'ja' ? `${sessions.length} 件の履歴` : `${sessions.length} session(s)`)
    if (cfg) parts.push(lang.value === 'ja' ? '設定' : 'settings')
    restoreStatus.value = 'ok'
    restoreMessage.value = (lang.value === 'ja' ? '復元しました: ' : 'Restored: ') + parts.join(' + ')
  } catch (err) {
    restoreStatus.value = 'err'
    restoreMessage.value = (err as Error).message
  }
}
</script>

<template>
  <div v-if="show" id="intro-overlay" class="open">
    <div id="intro-card">

      <!-- ヒーロー -->
      <div class="intro-hero">
        <span class="intro-logo">🧵</span>
        <h1 class="intro-title">{{ T[lang].introWelcome }}</h1>
        <p class="intro-sub">{{ T[lang].introSub }}</p>
      </div>

      <!-- 特徴 -->
      <div class="intro-features">
        <div class="intro-feat">
          <span class="if-icon" style="background:#312e81">💬</span>
          <span>{{ T[lang].introF1 }}</span>
        </div>
        <div class="intro-feat">
          <span class="if-icon" style="background:#3730a3">🔱</span>
          <span>{{ T[lang].introF2 }}</span>
        </div>
        <div class="intro-feat">
          <span class="if-icon" style="background:#064e3b">🔀</span>
          <span>{{ T[lang].introF3 }}</span>
        </div>
      </div>

      <!-- 接続設定アコーディオン -->
      <div class="intro-acc-wrap">
        <div class="acc-group-label">{{ lang === 'ja' ? 'ローカル AI' : 'Local AI' }}</div>

        <!-- Ollama -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('ollama')">
            <span class="snav-dot" :class="configured.ollama ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">Ollama</span>
            <span class="acc-chevron">{{ openSection === 'ollama' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'ollama'" class="acc-body">
            <div class="intro-row">
              <input type="url" v-model="ollamaUrl" placeholder="http://localhost:11434">
              <button class="btn-test" @click="testOllama">{{ T[lang].testBtn }}</button>
              <span :class="ollamaTestClass">{{ ollamaTestResult }}</span>
            </div>
            <div class="hint" v-html="T[lang].introOllamaHint"></div>
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
            <div class="intro-row">
              <input type="url" v-model="lmstudioUrl" placeholder="http://localhost:1234">
              <button class="btn-test" @click="testLMStudio">{{ T[lang].testBtn }}</button>
              <span :class="lmstudioTestClass">{{ lmstudioTestResult }}</span>
            </div>
            <div class="hint">{{ lang === 'ja' ? 'LM Studio → Local Server → Start Server で起動' : 'LM Studio → Local Server → Start Server' }}</div>
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
            <div class="field" style="margin-bottom:8px">
              <input type="url" v-model="anythingllmUrl" placeholder="http://localhost:3001">
            </div>
            <div class="field">
              <input type="password" v-model="anythingllmKey" placeholder="NXXXXXX-XXXXXXXX-...">
            </div>
            <div class="hint">{{ lang === 'ja' ? 'AnythingLLM → 設定（⚙）→ APIキー で発行' : 'AnythingLLM → Settings (⚙) → API Keys' }}</div>
          </div>
        </div>

        <div class="acc-group-label" style="margin-top:8px">{{ lang === 'ja' ? 'クラウド AI' : 'Cloud AI' }}</div>
        <div class="hint" style="margin-bottom:8px">{{ T[lang].introCloudHint }}</div>

        <!-- OpenAI -->
        <div class="acc-item">
          <button class="acc-header" @click="toggleSection('openai')">
            <span class="snav-dot" :class="configured.openai ? 'dot-on' : 'dot-off'"></span>
            <span class="acc-title">OpenAI</span>
            <span class="acc-chevron">{{ openSection === 'openai' ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSection === 'openai'" class="acc-body">
            <input type="password" v-model="openaiKey" placeholder="sk-...">
            <div class="hint"><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a></div>
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
            <input type="password" v-model="anthropicKey" placeholder="sk-ant-...">
            <div class="hint"><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a></div>
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
            <input type="password" v-model="geminiKey" placeholder="AIzaSy...">
            <div class="hint">
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a>
              {{ lang === 'ja' ? '（無料枠あり）' : '(free tier available)' }}
            </div>
          </div>
        </div>
      </div>

      <!-- バックアップから復元 -->
      <div class="intro-restore">
        <input
          ref="restoreFileRef"
          type="file"
          accept=".json"
          style="display:none"
          @change="onRestoreFile"
        />
        <button class="intro-restore-btn" @click="openRestorePicker">
          {{ lang === 'ja' ? '📂 バックアップから履歴・設定を復元' : '📂 Restore history & settings from backup' }}
        </button>
        <span
          v-if="restoreMessage"
          class="intro-restore-msg"
          :class="restoreStatus === 'ok' ? 'restore-ok' : 'restore-err'"
        >{{ restoreMessage }}</span>
      </div>

      <!-- フッター -->
      <div class="intro-foot">
        <button class="intro-lang-btn" @click="uiStore.toggleLang()">
          {{ lang === 'ja' ? 'EN' : 'JA' }}
        </button>
        <button class="btn-cancel" @click="closeIntro(false)">{{ T[lang].introSkip }}</button>
        <button class="btn-primary" @click="closeIntro(true)">{{ T[lang].introStart }}</button>
      </div>
    </div>
  </div>
</template>
