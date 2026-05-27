<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BraidedNode } from '@/types'
import { useStreaming } from '@/composables/useStreaming'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { T } from '@/i18n'

const props = defineProps<{ node: BraidedNode; qSeq?: number | string }>()
const { mdToHtml, isStreaming } = useStreaming()
const sessionStore = useSessionStore()
const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)

// parentIds を持つ = クロス統合（ChatView直下）→ 継続ボタンを表示する
const isCross = computed(() => !!props.node.parentIds)

// モデル情報
const modelProv = computed(() => (props.node.model ?? '').split(':')[0])
const modelName = computed(() => {
  const parts = (props.node.model ?? '').split(':')
  return parts.slice(1).join(':') || parts[0]
})

const PROV_COLOR: Record<string, string> = {
  ollama: '#4338ca', lmstudio: '#0e7490', anythingllm: '#b45309',
  openai: '#059669', anthropic: '#d97706', gemini: '#7c3aed', grok: '#000000',
}
const provColor = computed(() => PROV_COLOR[modelProv.value] ?? '#6b7280')

function continueFromConsolidation() {
  sessionStore.setBranchCtx(props.node.id)
  uiStore.openFib('normal')
}

const STRATEGY_ICON: Record<string, string> = {
  best: 'emoji_events', merge: 'join_full', diff: 'balance', custom: 'edit',
}

const meta = computed(() => {
  const key = props.node.consolidationStrategy ?? ''
  const strats = T[lang.value].consolidationStrategies
  const icon = STRATEGY_ICON[key]
  if (key && icon) {
    const s = strats[key as 'best' | 'merge' | 'diff' | 'custom']
    return { icon, label: s.label }
  }
  return { icon: 'merge', label: strats.default.label }
})
const streaming = computed(() => isStreaming(props.node.id))
const html = computed(() => mdToHtml(props.node.content))

const copied = ref(false)
async function copyContent() {
  await navigator.clipboard.writeText(props.node.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function downloadContent() {
  const blob = new Blob([props.node.content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${meta.value.label}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="consolidation-block">
    <div class="cb-head">
      <span v-if="qSeq" class="cb-a-badge">A{{ qSeq }}</span>
      <span class="cb-strategy-badge">
        <span class="material-icons cb-strategy-icon">{{ meta.icon }}</span>{{ meta.label }}
      </span>
      <template v-if="modelName">
        <span class="cb-sep">—</span>
        <span class="cb-model-name">{{ modelName }}</span>
        <span class="cb-prov-badge" :style="{ background: provColor }">{{ modelProv }}</span>
      </template>
      <span v-if="node.customInstruction" class="cb-custom-hint" :title="node.customInstruction">
        {{ node.customInstruction.slice(0, 30) }}{{ node.customInstruction.length > 30 ? '…' : '' }}
      </span>
      <span v-if="streaming" class="cb-streaming-dot"></span>
      <div class="cb-actions">
        <button class="umc-icon-btn" :class="{ copied }" :title="copied ? T[lang].copied : T[lang].copy" @click="copyContent"><span class="material-icons">content_copy</span></button>
        <button class="umc-icon-btn" :title="T[lang].download" @click="downloadContent"><span class="material-icons">download</span></button>
      </div>
    </div>
    <div class="cb-body md" :class="{ cur: streaming }" v-html="html" />
  </div>
  <!-- クロス統合（parentIds あり）の場合のみ継続ボタンを表示 -->
  <div v-if="isCross && !streaming && node.content" class="cc-continue-below">
    <button class="cc-continue-btn" @click="continueFromConsolidation">
      ➕ {{ T[lang].continueAsking }}
    </button>
  </div>
</template>
