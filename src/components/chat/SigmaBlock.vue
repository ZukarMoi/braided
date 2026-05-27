<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { mdToHtml } from '@/composables/useMarkdown'
import type { BraidedNode } from '@/types'
import { T } from '@/i18n'

const props = defineProps<{ node: BraidedNode; qId: string }>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()

const isActive = computed(() => sessionStore.activeBranchId === props.node.id)
const lang = computed(() => uiStore.lang)
const bodyHtml = computed(() => props.node.content ? mdToHtml(props.node.content) : '<span class="cur"></span>')

function toggleBranch() {
  if (isActive.value) {
    sessionStore.clearBranchCtx()
  } else {
    sessionStore.setBranchCtx(props.node.id)
  }
}
</script>

<template>
  <div :class="['summary-area', isActive && 'card-active']" :data-id="node.id">
    <div class="sum-head">
      <span class="stitle">Σ</span>
      <span class="slabel">{{ T[lang].summaryLabel }}</span>
    </div>
    <div class="sum-body md" v-html="bodyHtml"></div>
    <div v-if="node.content" class="sum-foot" style="display:flex">
      <span></span>
      <button
        :class="['btn-branch-sum', isActive && 'btn-branch-active']"
        @click="toggleBranch"
      >
        {{ isActive ? T[lang].clearBranch : T[lang].branchFrom }}
      </button>
    </div>
  </div>
</template>
