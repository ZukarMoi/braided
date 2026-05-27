<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
// import { useStreaming } from '@/composables/useStreaming'
import { T } from '@/i18n'
import CompositeCard from './CompositeCard.vue'
import MergeBlock from './MergeBlock.vue'
import ConsolidationBlock from './ConsolidationBlock.vue'

const sessionStore = useSessionStore()
const uiStore = useUiStore()
// useStreaming()

function openNewQuestion() {
  sessionStore.clearBranchCtx()
  uiStore.continueModel = null
  uiStore.openFib('normal')
}

const lang = computed(() => uiStore.lang)
const s = computed(() => sessionStore.curSess)

// top-level Qノードの一覧（CompositeCardに渡す）
const topLevelQNodes = computed(() => {
  if (!s.value) return []
  return sessionStore.getMainQChain(s.value)
})

const mergeNodes = computed(() => s.value?.nodes.filter(n => n.type === 'merge' && n.parentIds) ?? [])
// 複数カード統合結果（parentIds を持つ consolidation ノード）
const crossConsolidationNodes = computed(() =>
  s.value?.nodes.filter(n => n.type === 'consolidation' && n.parentIds) ?? []
)

const hasContent = computed(() => topLevelQNodes.value.length > 0)

const emits = defineEmits<{
  toggleContextPanel: []
}>()

// ノード数の変化（統合・シグマ完了など）でもスクロールを追従させる
const nodeCount = computed(() => s.value?.nodes.length ?? 0)

watch(
  [topLevelQNodes, mergeNodes, crossConsolidationNodes, nodeCount],
  async () => {
    await nextTick()
    const el = document.getElementById('chat')
    if (el) el.scrollTop = el.scrollHeight
  },
)
</script>

<template>
  <div id="chat">
    <!-- Context injected indicator -->
    <div
      v-if="s?.injectedContext"
      class="ctx-indicator"
      @click="emits('toggleContextPanel')"
    >
      <span class="ctx-ind-icon">📄</span>
      <span class="ctx-ind-label">{{ T[lang].ctxActive }}</span>
      <span class="ctx-ind-preview">{{ (s.injectedContext ?? '').slice(0, 60) }}…</span>
    </div>

    <!-- Welcome screen -->
    <div v-if="!hasContent" class="welcome" @click="openNewQuestion">
      <span class="wicon">🧵</span>
      <h2>{{ T[lang].welcomeTitle }}</h2>
      <p>{{ T[lang].welcomeBody }}</p>
    </div>

    <!-- Turns (CompositeCard) -->
    <CompositeCard
      v-for="q in topLevelQNodes"
      :key="q.id"
      :q-node-id="q.id"
      :depth="0"
    />

    <!-- Merge nodes -->
    <MergeBlock
      v-for="mn in mergeNodes"
      :key="mn.id"
      :node="mn"
    />

    <!-- 複数カード統合結果 -->
    <ConsolidationBlock
      v-for="cn in crossConsolidationNodes"
      :key="cn.id"
      :node="cn"
    />

    <!-- 新しい質問トリガー（セッション開始時のみ） -->
    <div v-if="!hasContent" class="cc-continue-below cv-new-q-bar" @click="openNewQuestion">
      <button class="cc-continue-btn">
        {{ T[lang].newQuestionBtn }}
      </button>
    </div>
  </div>
</template>
