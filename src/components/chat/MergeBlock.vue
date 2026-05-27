<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import { useStreaming } from '@/composables/useStreaming'
import { T } from '@/i18n'
import { mdToHtml } from '@/composables/useMarkdown'
import type { BraidedNode } from '@/types'

const props = defineProps<{ node: BraidedNode }>()

const uiStore = useUiStore()
const sessionStore = useSessionStore()
const { isStreaming } = useStreaming()
const lang = computed(() => uiStore.lang)

const stratLabel = computed(() => {
  const strat = props.node.strategy ?? ''
  const full = (T[lang.value].strategies as Record<string, string>)[strat] ?? strat
  return full.split(' — ')[0]
})

const bodyHtml = computed(() => props.node.content ? mdToHtml(props.node.content) : '<span class="cur"></span>')
const streaming = computed(() => isStreaming(props.node.id))

function continueFromMerge() {
  sessionStore.setBranchCtx(props.node.id)
  uiStore.openFib('normal')
}
</script>

<template>
  <div class="merge-area" :data-id="node.id">
    <div class="merge-head">
      <span class="mtitle">🔀 {{ T[lang].mergeLabel }}</span>
      <span class="msources">{{ stratLabel }}</span>
    </div>
    <div class="merge-body md" v-html="bodyHtml"></div>
  </div>
  <!-- マージ完了後の継続ボタン -->
  <div v-if="!streaming && node.content" class="cc-continue-below">
    <button class="cc-continue-btn" @click="continueFromMerge">
      ➕ {{ T[lang].continueAsking }}
    </button>
  </div>
</template>
