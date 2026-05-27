<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS } from '@/constants/models'
import { T } from '@/i18n'

const props = defineProps<{
  connStatus: Record<string, string>
  anchorRect?: DOMRect | null
}>()

const emit = defineEmits<{ close: [] }>()

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)

interface ProviderGroup {
  label: string
  prov: string
  models: string[]
}

const groups = computed<ProviderGroup[]>(() => {
  const g: ProviderGroup[] = []
  const cfg = settingsStore.cfg
  if (cfg.ollama.url)
    g.push({ label: 'Ollama', prov: 'ollama', models: uiStore.ollamaModels })
  if (cfg.lmstudio.url)
    g.push({ label: 'LM Studio', prov: 'lmstudio', models: uiStore.lmstudioModels })
  if (cfg.anythingllm.url && cfg.anythingllm.apiKey)
    g.push({ label: 'AnythingLLM', prov: 'anythingllm', models: uiStore.anythingllmWorkspaces })
  if (cfg.openai.apiKey)    g.push({ label: 'OpenAI',    prov: 'openai',    models: OPENAI_MODELS })
  if (cfg.anthropic.apiKey) g.push({ label: 'Anthropic', prov: 'anthropic', models: ANTHROPIC_MODELS })
  if (cfg.gemini.apiKey)    g.push({ label: 'Gemini',    prov: 'gemini',    models: GEMINI_MODELS })
  return g
})

const allKeys = computed(() => groups.value.flatMap(g => g.models.map(m => `${g.prov}:${m}`)))
const selectedCount = computed(() => uiStore.selectedModels.size)

// Position the popup relative to anchor
const popupStyle = computed(() => {
  const rect = props.anchorRect
  if (!rect) return {}
  const top = rect.bottom + 8
  const right = window.innerWidth - rect.right
  return {
    top: `${top}px`,
    right: `${right}px`,
  }
})

function toggle(key: string, checked: boolean) {
  uiStore.toggleModel(key, checked)
}
function selectAll()  { uiStore.selectAll(allKeys.value) }
function deselectAll(){ uiStore.deselectAll() }

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('mpp-backdrop')) {
    emit('close')
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))

function statusIcon(prov: string) {
  const s = props.connStatus[prov]
  if (s === 'loading') return '⋯'
  if (s === 'ok')      return '✓'
  if (s === 'err')     return '✗'
  return ''
}
function statusClass(prov: string) {
  const s = props.connStatus[prov]
  return `mpp-status-${s ?? 'idle'}`
}
</script>

<template>
  <Teleport to="body">
    <div class="mpp-backdrop" @mousedown="onBackdrop">
      <div class="mpp-popup" :style="popupStyle" @mousedown.stop>
        <!-- Header -->
        <div class="mpp-header">
          <span class="mpp-title">
            {{ T[lang].selectModelsTitle }}
          </span>
          <span class="mpp-count">{{ T[lang].nModelsSelected(selectedCount) }}</span>
          <button class="mpp-close" @click="emit('close')">✕</button>
        </div>

        <!-- No providers configured -->
        <div v-if="groups.length === 0" class="mpp-empty">
          {{ T[lang].addProvider }}
        </div>

        <!-- Provider groups -->
        <div class="mpp-body">
          <div v-for="g in groups" :key="g.prov" class="mpp-group">
            <div class="mpp-group-header">
              <span class="mpp-group-label">{{ g.label }}</span>
              <span :class="['mpp-status', statusClass(g.prov)]">{{ statusIcon(g.prov) }}</span>
            </div>

            <div v-if="connStatus[g.prov] === 'err'" class="mpp-conn-err">
              {{ T[lang].testFail }}
            </div>
            <div v-else-if="g.models.length === 0" class="mpp-no-models">
              {{ T[lang].noModelsInGroup }}
            </div>
            <div v-else class="mpp-chips">
              <label
                v-for="m in g.models"
                :key="`${g.prov}:${m}`"
                :class="['mpp-chip', uiStore.selectedModels.has(`${g.prov}:${m}`) && 'mpp-chip-on']"
              >
                <input
                  type="checkbox"
                  :checked="uiStore.selectedModels.has(`${g.prov}:${m}`)"
                  @change="toggle(`${g.prov}:${m}`, ($event.target as HTMLInputElement).checked)"
                />
                {{ m }}
              </label>
            </div>
          </div>
        </div>

        <!-- Footer actions -->
        <div class="mpp-footer">
          <button class="mpp-foot-btn" @click="selectAll">
            {{ T[lang].allModels }}
          </button>
          <button class="mpp-foot-btn" @click="deselectAll">
            {{ T[lang].noneModels }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
