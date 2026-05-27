<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useStreaming } from '@/composables/useStreaming'
import { useVaultSync } from '@/composables/useVaultSync'
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, GROK_MODELS } from '@/constants/models'
import { T } from '@/i18n'

const props = defineProps<{ qNodeId: string }>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)
const settingsStore = useSettingsStore()
const { reAskWith } = useStreaming()
const { scheduleVaultSync } = useVaultSync()

type SubMode = 'none' | 'models' | 'context'
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const subMenuMode = ref<SubMode>('none')
const contextText = ref('')
const contextTextareaRef = ref<HTMLTextAreaElement | null>(null)

// sigma 存在チェック: sigma ありの場合は「ブランチを作成」を非表示
const hasSigma = computed(() => {
  const s = sessionStore.curSess
  if (!s) return false
  return s.nodes.some(n => n.parentId === props.qNodeId && n.type === 'sigma')
})

const availableModels = computed(() => {
  const cfg = settingsStore.cfg
  const list: { key: string; label: string }[] = []
  for (const m of uiStore.ollamaModels)          list.push({ key: `ollama:${m}`,      label: m })
  for (const m of uiStore.lmstudioModels)        list.push({ key: `lmstudio:${m}`,    label: `LMStudio / ${m}` })
  for (const m of uiStore.anythingllmWorkspaces) list.push({ key: `anythingllm:${m}`, label: `AnythingLLM / ${m}` })
  if (cfg.openai.apiKey)    OPENAI_MODELS.forEach(m    => list.push({ key: `openai:${m}`,    label: `OpenAI / ${m}` }))
  if (cfg.anthropic.apiKey) ANTHROPIC_MODELS.forEach(m => list.push({ key: `anthropic:${m}`, label: `Anthropic / ${m}` }))
  if (cfg.gemini.apiKey)    GEMINI_MODELS.forEach(m    => list.push({ key: `gemini:${m}`,    label: `Gemini / ${m}` }))
  if (cfg.grok.apiKey)      GROK_MODELS.forEach(m      => list.push({ key: `grok:${m}`,      label: `Grok / ${m}` }))
  return list
})

function openMenu(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  // 画面端からはみ出さないよう調整
  const menuW = 230
  menuX.value = Math.min(rect.left, window.innerWidth - menuW - 8)
  menuY.value = rect.bottom + 6
  subMenuMode.value = 'none'
  contextText.value = ''
  menuVisible.value = true
}

function closeMenu() {
  menuVisible.value = false
  subMenuMode.value = 'none'
  contextText.value = ''
}

async function showModelList() {
  subMenuMode.value = 'models'
}

async function showContextInput() {
  subMenuMode.value = 'context'
  await nextTick()
  contextTextareaRef.value?.focus()
}

async function selectModelForReAsk(modelKey: string) {
  closeMenu()
  await reAskWith(
    props.qNodeId,
    modelKey,
    (_nodeId, _content) => {},
    () => { scheduleVaultSync() },
  )
}

function handleBranch() {
  closeMenu()
  const s = sessionStore.curSess
  if (!s) return
  // ブランチ作成は「質問レベルの分岐」= Q または sigma を親にする。
  // 特定モデルの r-node は選ばない（それは UMC「引き続き質問」の役割）。
  // sigma があればそのコンテキストを引き継ぐ。なければ Q から並列分岐。
  const sigma = s.nodes.find(n => n.parentId === props.qNodeId && n.type === 'sigma')
  const branchParentId = sigma?.id ?? props.qNodeId
  uiStore.continueModel = null        // 以前の UMC 操作の残留をリセット
  sessionStore.setBranchCtx(branchParentId)
  uiStore.nextQIsBranch = true
  uiStore.openFib('normal')
}

function insertContext() {
  const text = contextText.value.trim()
  if (!text) return
  const s = sessionStore.curSess
  if (!s) return
  const node: import('@/types').BraidedNode = {
    id: sessionStore.uid(),
    type: 'manual',
    parentId: props.qNodeId,
    content: text,
    timestamp: Date.now(),
  }
  sessionStore.addNode(s, node)
  sessionStore.save()
  closeMenu()
}
</script>

<template>
  <div class="add-card" @click="openMenu">
    <span class="material-icons">add_box</span>
  </div>

  <Teleport to="body">
    <div v-if="menuVisible" class="add-card-backdrop" @click="closeMenu" />
    <div
      v-if="menuVisible"
      class="add-card-menu"
      :style="{ left: menuX + 'px', top: menuY + 'px' }"
    >
      <!-- メニューヘッダー（常時表示） -->
      <div class="acm-header">
        <span class="acm-header-title">{{ subMenuMode === 'models' ? T[lang].acmSelectModel : subMenuMode === 'context' ? T[lang].acmInsertCtx : T[lang].acmAdd }}</span>
        <button class="acm-close" @click.stop="closeMenu">
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- メインメニュー -->
      <template v-if="subMenuMode === 'none'">
        <button class="acm-item" @click.stop="showModelList">
          <span class="material-icons acm-icon">smart_toy</span> {{ T[lang].acmAddModel }}
        </button>
        <button v-if="!hasSigma" class="acm-item" @click.stop="handleBranch">
          <span class="material-icons acm-icon">account_tree</span> {{ T[lang].acmCreateBranch }}
        </button>
        <button class="acm-item" @click.stop="showContextInput">
          <span class="material-icons acm-icon">article</span> {{ T[lang].acmInsertCtx }}
        </button>
      </template>

      <!-- モデル選択サブメニュー -->
      <template v-else-if="subMenuMode === 'models'">
        <button class="acm-back" @click.stop="subMenuMode = 'none'">
          <span class="material-icons" style="font-size:14px">arrow_back</span> {{ T[lang].back }}
        </button>
        <div class="acm-model-list">
          <button
            v-for="m in availableModels"
            :key="m.key"
            class="acm-item"
            @click.stop="selectModelForReAsk(m.key)"
          >{{ m.label }}</button>
          <div v-if="!availableModels.length" class="acm-empty">{{ T[lang].noModelsAvail }}</div>
        </div>
      </template>

      <!-- コンテキスト挿入サブメニュー -->
      <template v-else-if="subMenuMode === 'context'">
        <button class="acm-back" @click.stop="subMenuMode = 'none'">
          <span class="material-icons" style="font-size:14px">arrow_back</span> {{ T[lang].back }}
        </button>
        <div class="acm-ctx-body">
          <textarea
            ref="contextTextareaRef"
            v-model="contextText"
            class="acm-ctx-textarea"
            :placeholder="T[lang].acmCtxPh"
            rows="6"
            @keydown.stop
          ></textarea>
          <div class="acm-ctx-actions">
            <button class="acm-ctx-submit" :disabled="!contextText.trim()" @click.stop="insertContext">
              <span class="material-icons" style="font-size:15px;vertical-align:middle">add_circle</span> {{ T[lang].insert }}
            </button>
            <button class="acm-ctx-cancel" @click.stop="closeMenu">{{ T[lang].cancelBtn }}</button>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>
