<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS } from '@/constants/models'
import ModelPickerPopup from './ModelPickerPopup.vue'
import { T } from '@/i18n'

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)

type ConnStatus = 'idle' | 'loading' | 'ok' | 'err'
const connStatus = ref<Record<string, ConnStatus>>({
  ollama:      'idle',
  lmstudio:    'idle',
  anythingllm: 'idle',
  openai:      'idle',
  anthropic:   'idle',
  gemini:      'idle',
})

// All valid model keys (for cleanup after load)
const allKeys = computed(() => {
  const cfg = settingsStore.cfg
  const keys: string[] = []
  uiStore.ollamaModels.forEach(m => keys.push(`ollama:${m}`))
  uiStore.lmstudioModels.forEach(m => keys.push(`lmstudio:${m}`))
  uiStore.anythingllmWorkspaces.forEach(m => keys.push(`anythingllm:${m}`))
  if (cfg.openai.apiKey)    OPENAI_MODELS.forEach(m => keys.push(`openai:${m}`))
  if (cfg.anthropic.apiKey) ANTHROPIC_MODELS.forEach(m => keys.push(`anthropic:${m}`))
  if (cfg.gemini.apiKey)    GEMINI_MODELS.forEach(m => keys.push(`gemini:${m}`))
  return keys
})

const selectedCount = computed(() => uiStore.selectedModels.size)

// Active provider dots for the compact summary
const activeDots = computed(() => {
  const dots: { prov: string; status: ConnStatus }[] = []
  const cfg = settingsStore.cfg
  if (cfg.ollama.url)
    dots.push({ prov: 'ollama', status: connStatus.value.ollama })
  if (cfg.lmstudio.url)
    dots.push({ prov: 'lmstudio', status: connStatus.value.lmstudio })
  if (cfg.anythingllm.url && cfg.anythingllm.apiKey)
    dots.push({ prov: 'anythingllm', status: connStatus.value.anythingllm })
  if (cfg.openai.apiKey)
    dots.push({ prov: 'openai', status: connStatus.value.openai })
  if (cfg.anthropic.apiKey)
    dots.push({ prov: 'anthropic', status: connStatus.value.anthropic })
  if (cfg.gemini.apiKey)
    dots.push({ prov: 'gemini', status: connStatus.value.gemini })
  return dots
})

// Popup state
const pickerOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const anchorRect = ref<DOMRect | null>(null)

function openPicker() {
  anchorRect.value = triggerRef.value?.getBoundingClientRect() ?? null
  pickerOpen.value = true
}
function closePicker() {
  pickerOpen.value = false
}

async function loadModels() {
  const cfg = settingsStore.cfg

  // Ollama
  connStatus.value.ollama = 'loading'
  try {
    const r = await fetch(`${settingsStore.ollamaUrl}/api/tags`)
    if (r.ok) {
      const d = await r.json() as { models?: Array<{ name: string }> }
      uiStore.ollamaModels = (d.models ?? []).map(m => m.name)
      connStatus.value.ollama = 'ok'
    } else {
      uiStore.ollamaModels = []
      connStatus.value.ollama = 'err'
    }
  } catch {
    uiStore.ollamaModels = []
    connStatus.value.ollama = 'err'
  }

  // LM Studio
  connStatus.value.lmstudio = 'loading'
  try {
    const r = await fetch(`${settingsStore.lmstudioUrl}/v1/models`)
    if (r.ok) {
      const d = await r.json() as { data?: Array<{ id: string }> }
      uiStore.lmstudioModels = (d.data ?? []).map(m => m.id)
      connStatus.value.lmstudio = 'ok'
    } else {
      uiStore.lmstudioModels = []
      connStatus.value.lmstudio = 'err'
    }
  } catch {
    uiStore.lmstudioModels = []
    connStatus.value.lmstudio = 'err'
  }

  // AnythingLLM
  if (cfg.anythingllm.url && cfg.anythingllm.apiKey) {
    connStatus.value.anythingllm = 'loading'
    try {
      const r = await fetch(`${cfg.anythingllm.url}/api/v1/workspaces`, {
        headers: { Authorization: `Bearer ${cfg.anythingllm.apiKey}` },
      })
      if (r.ok) {
        const d = await r.json() as { workspaces?: Array<{ slug: string }> }
        uiStore.anythingllmWorkspaces = (d.workspaces ?? []).map(w => w.slug)
        connStatus.value.anythingllm = 'ok'
      } else {
        uiStore.anythingllmWorkspaces = []
        connStatus.value.anythingllm = 'err'
      }
    } catch {
      uiStore.anythingllmWorkspaces = []
      connStatus.value.anythingllm = 'err'
    }
  } else {
    connStatus.value.anythingllm = 'idle'
  }

  // Cloud
  connStatus.value.openai    = cfg.openai.apiKey    ? 'ok' : 'idle'
  connStatus.value.anthropic = cfg.anthropic.apiKey ? 'ok' : 'idle'
  connStatus.value.gemini    = cfg.gemini.apiKey    ? 'ok' : 'idle'

  uiStore.cleanupSelections(allKeys.value)
}

function refreshCloudStatus() {
  const cfg = settingsStore.cfg
  connStatus.value.openai    = cfg.openai.apiKey    ? 'ok' : 'idle'
  connStatus.value.anthropic = cfg.anthropic.apiKey ? 'ok' : 'idle'
  connStatus.value.gemini    = cfg.gemini.apiKey    ? 'ok' : 'idle'
}

onMounted(loadModels)
defineExpose({ loadModels, refreshCloudStatus })
</script>

<template>
  <div id="top-bar">
    <!-- Model picker trigger button (接続ステータスドット統合) -->
    <button
      ref="triggerRef"
      class="tb-model-btn"
      :class="{ 'tb-model-btn-active': pickerOpen }"
      @click="pickerOpen ? closePicker() : openPicker()"
    >
      <span class="tb-model-icon">🤖</span>
      <span class="tb-model-count">
        {{ selectedCount > 0 ? T[lang].nModelsSelected(selectedCount) : T[lang].selectModels }}
      </span>
      <!-- プロバイダー接続ステータスドット -->
      <span class="tb-dot-strip">
        <span
          v-for="d in activeDots"
          :key="d.prov"
          :class="['tb-dot', `tb-dot-${d.status}`]"
          :title="`${d.prov}  ${d.status === 'ok' ? T[lang].connOk : d.status === 'loading' ? T[lang].connChecking : d.status === 'err' ? T[lang].connFail : T[lang].connIdle}`"
        ></span>
      </span>
      <span class="tb-model-chevron">{{ pickerOpen ? '▲' : '▼' }}</span>
    </button>

    <!-- 送信ログトグル -->
    <button
      :class="['tb-log-btn', uiStore.ctxLogOpen && 'tb-log-btn-on']"
      :title="uiStore.ctxLogOpen ? T[lang].sendLogClose : T[lang].sendLogOpen"
      @click="uiStore.ctxLogOpen = !uiStore.ctxLogOpen"
    >
      <span class="material-icons">receipt_long</span>
      <span>{{ T[lang].sendLog }}</span>
      <span v-if="uiStore.ctxLog.length" style="font-size:.7rem;opacity:.75">({{ uiStore.ctxLog.length }})</span>
    </button>
  </div>

  <!-- Model picker popup -->
  <ModelPickerPopup
    v-if="pickerOpen"
    :conn-status="connStatus"
    :anchor-rect="anchorRect"
    @close="closePicker"
  />
</template>
