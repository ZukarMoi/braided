<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useStreaming } from '@/composables/useStreaming'
import { useVaultSync } from '@/composables/useVaultSync'
import ContextPanel from './ContextPanel.vue'
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, GROK_MODELS } from '@/constants/models'
import type { ConsolidationStrategy } from '@/types'
import { T } from '@/i18n'

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const settingsStore = useSettingsStore()
const { send: streamSend, executeConsolidation, activeStreamIds, sending } = useStreaming()
const { scheduleVaultSync } = useVaultSync()

const lang        = computed(() => uiStore.lang)
const fibOpen     = computed(() => uiStore.fibOpen)
const fibMode     = computed(() => uiStore.fibMode)
const compressing = computed(() => uiStore.compressing)
const s        = computed(() => sessionStore.curSess)

// ── 選択カード状態（コンパクトモード用） ──
const selectedCardIds    = computed(() => uiStore.selectedCardIds)
const selectedCount      = computed(() => selectedCardIds.value.size)
const allSelectedComplete = computed(() => {
  if (!s.value || selectedCount.value === 0) return false
  return [...selectedCardIds.value].every(id => {
    const rNodes = s.value!.nodes.filter(n => n.parentId === id && n.type === 'r')
    return rNodes.length > 0 && !rNodes.some(r => activeStreamIds.has(r.id))
  })
})
const canConsolidate = computed(() => selectedCount.value >= 2 && allSelectedComplete.value)

// ── 利用可能なモデル一覧（通常・統合 共通） ──
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

// ── モデル選択（通常: 複数 / 統合: 単一） ──
// 統合モード専用の選択モデル（単一）
const consolidationModel = ref<string>('')

function isModelOn(key: string): boolean {
  return fibMode.value === 'consolidation'
    ? consolidationModel.value === key
    : uiStore.selectedModels.has(key)
}

function toggleModelChip(key: string) {
  if (fibMode.value === 'consolidation') {
    consolidationModel.value = key          // 単一選択
  } else {
    uiStore.toggleModel(key, !uiStore.selectedModels.has(key))  // 複数トグル
  }
}

// モード切替時に統合モデルを初期化
watch(fibMode, (mode) => {
  if (mode === 'consolidation') {
    consolidationModel.value = [...uiStore.selectedModels][0] ?? availableModels.value[0]?.key ?? ''
    selectedStrategies.value = new Set()
    customInstruction.value  = ''
  }
})

// ── 通常モード固有 ──
const promptText         = ref('')
const extraInstruction   = ref('')
const contextPanelOpen   = ref(false)
const hasContext         = computed(() => !!(sessionStore.curSess?.injectedContext))

const activeBranchId = computed(() => sessionStore.activeBranchId)
const continueModel  = computed(() => uiStore.continueModel)

// ── 送信ターゲット説明（常時表示） ──
const targetDescription = computed(() => {
  const tl = T[lang.value]
  if (!s.value) return { label: tl.newQuestion, icon: 'chat', detail: '' }

  // continueModel 固定（UMCの「引き続き質問」）
  if (continueModel.value) {
    const modelName = continueModel.value.split(':').pop() ?? continueModel.value
    const rNode = activeBranchId.value ? sessionStore.getNode(s.value, activeBranchId.value) : null
    const qNode = rNode?.parentId ? sessionStore.getNode(s.value, rNode.parentId) : null
    const qSeq  = qNode ? sessionStore.getQSeq(s.value, qNode.id) : '?'
    return { label: `Q${qSeq} › ${modelName} の続き`, icon: 'reply', detail: qNode?.content?.slice(0, 50) ?? '' }
  }

  // activeBranchId がある
  if (activeBranchId.value) {
    const node  = sessionStore.getNode(s.value, activeBranchId.value)
    if (!node) return { label: tl.newQuestion, icon: 'chat', detail: '' }

    if (node.type === 'consolidation') {
      const qNode = node.parentId ? sessionStore.getNode(s.value, node.parentId) : null
      const qSeq  = qNode ? sessionStore.getQSeq(s.value, qNode.id) : '?'
      return { label: `Q${qSeq} ${tl.consolidationStrategies.default.label}への続き`, icon: 'join_full', detail: node.content.slice(0, 50) }
    }
    if (node.type === 'sigma') {
      const qNode = node.parentId ? sessionStore.getNode(s.value, node.parentId) : null
      const qSeq  = qNode ? sessionStore.getQSeq(s.value, qNode.id) : '?'
      return { label: `Q${qSeq} Σ${tl.summaryLabel}への続き`, icon: 'summarize', detail: node.content.slice(0, 50) }
    }
    if (node.type === 'r') {
      const modelName = node.model?.split(':').pop() ?? 'R'
      const qNode = node.parentId ? sessionStore.getNode(s.value, node.parentId) : null
      const qSeq  = qNode ? sessionStore.getQSeq(s.value, qNode.id) : '?'
      return { label: `Q${qSeq} › ${modelName} からブランチ`, icon: 'account_tree', detail: node.content.slice(0, 50) }
    }
    if (node.type === 'q') {
      const qSeq = sessionStore.getQSeq(s.value, node.id)
      return { label: `Q${qSeq} へのブランチ`, icon: 'account_tree', detail: node.content.slice(0, 50) }
    }
  }

  // メインスレッド
  const qChain = s.value.nodes.filter(n => n.type === 'q' && !n._branch)
  if (qChain.length === 0) return { label: tl.newQuestionStart, icon: 'chat', detail: '' }
  return { label: tl.addToThread, icon: 'forum', detail: '' }
})

// ── FIB クローズ（activeBranchId も一緒にリセット） ──
function handleClose() {
  sessionStore.clearBranchCtx()
  uiStore.nextQIsBranch = false
  uiStore.continueModel = null   // キャンセル時は明示的にリセット
  uiStore.closeFib()
}

const showBranchCtx = computed(() => !!activeBranchId.value || !!continueModel.value)

const textareaRef = ref<HTMLTextAreaElement | null>(null)
watch(fibOpen, async (open) => {
  if (open && fibMode.value === 'normal') {
    await nextTick()
    textareaRef.value?.focus()
  }
})

// ── ターゲット変化の一元監視 ──
// activeBranchId / continueModel のどちらが変わっても FIB 側でまとめて対応する。
// これにより書き込み元8箇所にガードを散らばせなくて済む。
watch(
  [activeBranchId, continueModel],
  async ([newBranch, newModel], [oldBranch, oldModel]) => {
    // FIBが閉じている間の変化は無視（開いた時点の状態を使う）
    if (!fibOpen.value) return
    // 実際に変化があったときだけ処理
    if (newBranch === oldBranch && newModel === oldModel) return

    // 統合モード中にターゲットが切り替わったら通常モードへ戻す
    // （統合は selectedCardIds ドリブンなので continueModel/branch と両立しない）
    if (fibMode.value === 'consolidation' && (newBranch || newModel)) {
      uiStore.openFib('normal')
    }

    // 再フォーカス
    await nextTick()
    textareaRef.value?.focus()
  },
)

// コンテキストのみクリア（FIBは閉じない）
function clearBranchAndModel() {
  sessionStore.clearBranchCtx()
  uiStore.nextQIsBranch = false
  uiStore.continueModel = null
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function handleKey(e: KeyboardEvent) {
  const isMac = navigator.platform.startsWith('Mac')
  if ((isMac ? e.metaKey : e.shiftKey) && e.key === 'Enter') {
    e.preventDefault()
    handleSend()
  }
}

async function handleSend() {
  const question = promptText.value.trim()
  if (!question || sending.value) return
  promptText.value = ''
  if (textareaRef.value) textareaRef.value.style.height = 'auto'
  contextPanelOpen.value = false
  // FIBパネルを閉じる（activeBranchId / nextQIsBranch は streamSend 内で消費するため残す）
  uiStore.closeFib()
  await streamSend(question, extraInstruction.value.trim(), () => {}, () => { scheduleVaultSync() })
}

// ── 統合モード固有 ──
const STRATEGIES = computed(() => {
  const cs = T[lang.value].consolidationStrategies
  return [
    { key: 'best'   as ConsolidationStrategy, icon: 'emoji_events', label: cs.best.label,   desc: cs.best.desc   },
    { key: 'merge'  as ConsolidationStrategy, icon: 'join_full',    label: cs.merge.label,  desc: cs.merge.desc  },
    { key: 'diff'   as ConsolidationStrategy, icon: 'balance',      label: cs.diff.label,   desc: cs.diff.desc   },
    { key: 'custom' as ConsolidationStrategy, icon: 'edit',         label: cs.custom.label, desc: cs.custom.desc },
  ]
})

const selectedStrategies = ref<Set<ConsolidationStrategy>>(new Set())
const customInstruction  = ref('')
const executing          = ref(false)

const showCustomInput = computed(() => selectedStrategies.value.has('custom'))

const selectedCardPreviews = computed(() => {
  if (!s.value) return []
  return [...selectedCardIds.value].map(id => ({
    seq: sessionStore.getQSeq(s.value!, id),
    content: sessionStore.getNode(s.value!, id)?.content ?? '',
  }))
})

function toggleStrategy(key: ConsolidationStrategy) {
  if (selectedStrategies.value.has(key)) selectedStrategies.value.delete(key)
  else selectedStrategies.value.add(key)
}

const canExecute = computed(() =>
  selectedStrategies.value.size > 0 &&
  !!consolidationModel.value &&
  !executing.value &&
  (!showCustomInput.value || !!customInstruction.value.trim())
)

async function handleExecute() {
  if (!canExecute.value) return
  executing.value = true
  // 統合完了後に折りたたむカードIDを先に確保
  const sourceCardIds = [...selectedCardIds.value]
  handleClose()                 // 送信と同時に閉じる（handleSend と同じ動作）
  uiStore.clearCardSelection()  // チェックボックスをオフ
  try {
    await executeConsolidation(
      sourceCardIds,
      [...selectedStrategies.value],
      customInstruction.value.trim(),
      consolidationModel.value,
      () => {}, () => { scheduleVaultSync() },
    )
    // UMCエリアの折りたたみは CompositeCard 内の watch が担う
  } finally {
    executing.value = false
  }
}

defineEmits<{ openMergeDialog: [] }>()
defineExpose({ triggerGenerateSummary: () => {} })
</script>

<template>
  <!-- 履歴圧縮中バナー -->
  <div v-if="compressing" class="fib-compress-banner">
    <span class="fib-compress-dots">⟳</span> {{ T[lang].compressing }}
  </div>

  <!-- ══════════════════════════════════════
       複数カード統合準備バー（FIBとは独立）
  ══════════════════════════════════════ -->
  <div v-if="canConsolidate && !fibOpen" class="fib-consolidate-ready">
    <span class="fas-count">{{ T[lang].nSelected(selectedCount) }}</span>
    <button class="fas-clear" @click="uiStore.clearCardSelection()">✕</button>
    <button class="fas-btn fas-consolidate" @click="uiStore.openFib('consolidation')">
      <span class="material-icons" style="font-size:16px;vertical-align:middle">join_full</span> {{ T[lang].consolidate }}
    </button>
  </div>

  <!-- FIB バックドロップ（エリア外クリックで閉じる） -->
  <div v-if="fibOpen" class="fib-backdrop" @click="handleClose()" />

  <!-- ══════════════════════════════════════
       FIB 入力パネル（openFib() 時のみ表示）
  ══════════════════════════════════════ -->
  <div v-if="fibOpen" id="floating-input-bar">

      <!-- 常時表示クローズボタン -->
      <button class="fib-close-btn" :title="T[lang].close" @click="handleClose()">
        <span class="material-icons">close</span>
      </button>

      <!-- ── ターゲット行（常時表示）── -->
      <div
        class="fib-target-row"
        :class="[`fib-target-row--${fibMode}`, fibMode === 'normal' && showBranchCtx ? 'fib-target-has-ctx' : '']"
      >
        <span class="material-icons fib-target-icon">{{ fibMode === 'consolidation' ? 'join_full' : targetDescription.icon }}</span>
        <div class="fib-target-info">
          <span v-if="fibMode === 'consolidation'" class="fib-target-label">
            {{ T[lang].consolidate }}: {{ selectedCardPreviews.map(p => `Q${p.seq}`).join(' + ') }}
          </span>
          <span v-else class="fib-target-label">{{ targetDescription.label }}</span>
          <span
            v-if="fibMode === 'consolidation' && selectedCardPreviews[0]?.content"
            class="fib-target-detail"
          >{{ selectedCardPreviews[0].content.slice(0, 45) }}{{ (selectedCardPreviews[0].content.length ?? 0) > 45 ? '…' : '' }}</span>
          <span v-else-if="fibMode === 'normal' && targetDescription.detail" class="fib-target-detail">{{ targetDescription.detail }}{{ targetDescription.detail.length === 50 ? '…' : '' }}</span>
        </div>
        <!-- コンテキストクリアボタン（ブランチ/続き設定時のみ） -->
        <button
          v-if="fibMode === 'normal' && showBranchCtx"
          class="fib-target-clear"
          :title="T[lang].clearContext"
          @click="clearBranchAndModel()"
        >
          <span class="material-icons" style="font-size:14px">close</span>
        </button>
      </div>

      <!-- ── モデル選択（continueModel 固定時は非表示 / 通常: 複数☑ / 統合: 単一●） ── -->
      <div v-if="!continueModel" class="fib-model-row">
        <span class="fib-model-row-label">{{ T[lang].modelLabel }}</span>
        <div class="fib-model-chips">
          <button
            v-for="m in availableModels"
            :key="m.key"
            class="fib-model-chip"
            :class="{
              'fib-model-chip-on': isModelOn(m.key),
              'fib-model-chip-radio': fibMode === 'consolidation',
            }"
            @click="toggleModelChip(m.key)"
          >{{ m.label }}</button>
          <span v-if="!availableModels.length" class="fib-cons-no-model">{{ T[lang].noModelsAvail }}</span>
        </div>
      </div>

      <!-- ── 統合方針（統合モードのみ） ── -->
      <template v-if="fibMode === 'consolidation'">
        <div class="fib-cons-section-label">{{ T[lang].consolidatePolicy }}</div>
        <div class="fib-cons-strategies">
          <button
            v-for="st in STRATEGIES"
            :key="st.key"
            class="fib-cons-chip"
            :class="{ 'fib-cons-chip-on': selectedStrategies.has(st.key) }"
            :title="st.desc"
            @click="toggleStrategy(st.key)"
          ><span class="material-icons" style="font-size:15px;vertical-align:middle">{{ st.icon }}</span> {{ st.label }}</button>
        </div>
      </template>

      <!-- ── テキスト入力（通常: 質問 / 統合: カスタム指示） ── -->
      <ContextPanel v-if="fibMode === 'normal' && contextPanelOpen" />

      <div
        v-if="fibMode === 'normal' || showCustomInput"
        class="fib-input-row"
      >
        <!-- 通常モード用 textarea -->
        <textarea
          v-if="fibMode === 'normal'"
          ref="textareaRef"
          v-model="promptText"
          class="fib-textarea"
          rows="1"
          :placeholder="T[lang].fibPromptPh"
          @input="autoResize($event.target as HTMLTextAreaElement)"
          @keydown="handleKey"
        ></textarea>
        <!-- 統合モード カスタム指示 textarea -->
        <textarea
          v-else
          v-model="customInstruction"
          class="fib-textarea"
          rows="1"
          :placeholder="T[lang].customInstructionPh"
          @input="autoResize($event.target as HTMLTextAreaElement)"
        ></textarea>

        <div class="fib-actions">
          <button
            v-if="fibMode === 'normal'"
            class="fib-btn"
            :class="{ 'fib-btn-active': contextPanelOpen, 'fib-btn-dot': hasContext }"
            :title="T[lang].contextLabel"
            @click="contextPanelOpen = !contextPanelOpen"
          >📄</button>
          <button
            v-if="fibMode === 'normal'"
            class="fib-send"
            :disabled="sending || !promptText.trim()"
            @click="handleSend"
          >
            <span v-if="sending" class="fib-sending-dots">…</span>
            <span v-else>{{ T[lang].send }}</span>
          </button>
          <button
            v-else
            class="fib-send"
            :disabled="!canExecute"
            @click="handleExecute"
          >
            <span v-if="executing" class="fib-sending-dots">…</span>
            <span v-else>{{ T[lang].execute }}</span>
          </button>
        </div>
      </div>

      <!-- 統合モードで custom 未選択時の実行ボタン -->
      <div v-if="fibMode === 'consolidation' && !showCustomInput" class="fib-cons-exec-row">
        <button class="fib-send" :disabled="!canExecute" @click="handleExecute">
          <span v-if="executing" class="fib-sending-dots">…</span>
          <span v-else>{{ T[lang].execute }}</span>
        </button>
      </div>

  </div>
</template>
