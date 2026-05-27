<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

const sessionStore = useSessionStore()
const uiStore = useUiStore()

const lang = computed(() => uiStore.lang)
const contextText = ref(sessionStore.curSess?.injectedContext ?? '')

// Sync contextText when session changes
watch(
  () => sessionStore.currentSessId,
  () => {
    contextText.value = sessionStore.curSess?.injectedContext ?? ''
  },
)

function onInput() {
  const s = sessionStore.curSess
  if (!s) return
  s.injectedContext = contextText.value
  sessionStore.save()
}

function clearContext() {
  contextText.value = ''
  const s = sessionStore.curSess
  if (!s) return
  s.injectedContext = ''
  sessionStore.save()
}
</script>

<template>
  <div id="context-panel">
    <div class="ctx-panel-head">
      <span>{{ lang === 'ja' ? '📄 セッションコンテキスト' : '📄 Session Context' }}</span>
      <button class="ctx-clear-btn" @click="clearContext">{{ lang === 'ja' ? 'クリア' : 'Clear' }}</button>
    </div>
    <textarea
      v-model="contextText"
      id="ctx-textarea"
      rows="5"
      :placeholder="lang === 'ja' ? '前回エクスポートしたMDや背景メモをここにペースト…' : 'Paste a previous export or background notes here…'"
      @input="onInput"
    ></textarea>
    <div class="ctx-panel-hint">
      {{ lang === 'ja' ? 'このセッションの全質問に自動的に含まれます' : 'Automatically included in every question in this session' }}
    </div>
  </div>
</template>
