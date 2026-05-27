<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useStreaming } from '@/composables/useStreaming'
import { mdToHtml } from '@/composables/useMarkdown'
import type { BraidedNode } from '@/types'
import { T } from '@/i18n'

const PROV_COLOR: Record<string, string> = {
  ollama:      '#4338ca',
  lmstudio:    '#0e7490',
  anythingllm: '#b45309',
  openai:      '#059669',
  anthropic:   '#d97706',
  gemini:      '#7c3aed',
}

const props = defineProps<{ node: BraidedNode }>()
const emit = defineEmits<{
  exclude:  [nodeId: string]
  cancel:   [nodeId: string]
  copy:     [nodeId: string]
  download: [nodeId: string]
}>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const { isStreaming } = useStreaming()

const [prov, ...rest] = (props.node.model ?? '').split(':')
const modelName  = computed(() => rest.join(':') || prov)
const color      = computed(() => PROV_COLOR[prov] ?? '#6b7280')
const isActive   = computed(() => sessionStore.activeBranchId === props.node.id)
const streaming  = computed(() => isStreaming(props.node.id))
const isExcluded = computed(() => props.node.excluded)
const isCancelled= computed(() => props.node._cancelled)
const lang       = computed(() => uiStore.lang)

const bodyHtml = computed(() => {
  if (props.node.content) {
    return mdToHtml(props.node.content) + (isCancelled.value ? '<span class="cancelled-label"> [停止]</span>' : '')
  }
  return '<span class="cur"></span>'
})

// Branch: set context so FloatingInputBar focuses and shows badge
function toggleBranch() {
  if (isActive.value) {
    sessionStore.clearBranchCtx()
  } else {
    sessionStore.setBranchCtx(props.node.id)
  }
}
</script>

<template>
  <div
    :class="['model-card', isActive && 'card-active', isExcluded && 'card-excluded']"
    :data-id="node.id"
  >
    <div class="card-head" :style="{ background: color }">
      <div class="ch-left">
        <span class="ch-model">{{ modelName }}</span>
        <span class="ch-prov">{{ prov }}</span>
      </div>
      <span v-if="streaming" class="ch-status"><span class="spinner"></span></span>
      <span v-else-if="isExcluded"  class="ch-status" style="font-size:.65rem;opacity:.8">🚫</span>
      <span v-else-if="isCancelled" class="ch-status" style="font-size:.65rem;opacity:.8">⏹</span>
    </div>
    <div class="card-body md" v-html="bodyHtml"></div>
    <div class="card-foot">
      <span v-if="isExcluded" class="excl-badge">{{ T[lang].excluded }}</span>
      <div class="cf-action-btns">
        <template v-if="streaming">
          <button class="icon-btn" :title="T[lang].stop"          @click="emit('cancel', node.id)">⏹</button>
          <button class="icon-btn excl-btn" :title="T[lang].excludeAndStop" @click="emit('exclude', node.id)">🚫</button>
        </template>
        <template v-else>
          <button class="btn-copy icon-btn" :title="T[lang].copy"     @click="emit('copy', node.id)">📋</button>
          <button class="icon-btn"          :title="T[lang].download" @click="emit('download', node.id)">⬇</button>
          <button
            :class="['icon-btn', isExcluded && 'excl-on']"
            :title="isExcluded ? T[lang].unexclude : T[lang].excludeFromCtx"
            @click="emit('exclude', node.id)"
          >🚫</button>
          <button
            :class="['btn-branch', isActive && 'btn-branch-active']"
            @click="toggleBranch"
          >
            {{ isActive ? T[lang].clearBranch : T[lang].branchFrom }}
          </button>
        </template>
      </div>
    </div>

  </div>
</template>
