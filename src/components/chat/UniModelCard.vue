<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  grok:        '#000000',
}

const props = defineProps<{ node: BraidedNode; qContent?: string }>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const { isStreaming, cancelStream } = useStreaming()
const lang = computed(() => uiStore.lang)

const prov      = computed(() => (props.node.model ?? '').split(':')[0])
const modelName = computed(() => {
  const parts = (props.node.model ?? '').split(':')
  return parts.slice(1).join(':') || parts[0]
})
const provColor  = computed(() => PROV_COLOR[prov.value] ?? '#6b7280')
const streaming  = computed(() => isStreaming(props.node.id))
const isExcluded = computed(() => !!props.node.excluded)
const isCancelled = computed(() => !!props.node._cancelled)

const bodyHtml = computed(() => {
  if (props.node.content) {
    return mdToHtml(props.node.content) +
      (isCancelled.value ? `<span class="cancelled-label"> ${T[lang.value].cancelledLabel}</span>` : '')
  }
  return '<span class="cur"></span>'
})

// 継続スレッド
const continuationThread = computed(() => {
  const s = sessionStore.curSess
  if (!s) return []
  return sessionStore.getContinuationThread(s, props.node.id)
})

// チェックボックス: ストリーミング中はOFF表示、完了でON
const checkboxValue = computed(() => !streaming.value && !isExcluded.value)

// 応答完了時に自動チェック
watch(streaming, (nowStreaming) => {
  if (!nowStreaming) {
    const s = sessionStore.curSess
    if (!s) return
    const live = sessionStore.getNode(s, props.node.id)
    if (live) { live.excluded = false; sessionStore.save() }
  }
})

function onCheckboxChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const s = sessionStore.curSess
  if (!s) return
  const live = sessionStore.getNode(s, props.node.id)
  if (!live) return
  live.excluded = !checked
  sessionStore.save()
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.node.content ?? '')
    uiStore.toast(T[lang.value].copySuccess)
  } catch { uiStore.toast(T[lang.value].copyFail) }
}

function handleDownload() {
  const name = (modelName.value || 'response') + '.md'
  const blob = new Blob([props.node.content ?? ''], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function handleDelete() {
  const s = sessionStore.curSess
  if (!s) return
  if (streaming.value) cancelStream(props.node.id)
  const idx = s.nodes.findIndex(n => n.id === props.node.id)
  if (idx >= 0) s.nodes.splice(idx, 1)
  sessionStore.save()
}

function handleContinue() {
  const s = sessionStore.curSess
  let targetRId = props.node.id
  if (s) {
    const thread = sessionStore.getContinuationThread(s, props.node.id)
    if (thread.length > 0) targetRId = thread[thread.length - 1].r.id
  }
  sessionStore.setBranchCtx(targetRId)
  uiStore.continueModel = props.node.model ?? null
  uiStore.openFib('normal')
}

// ── デバッグ: コンテキスト表示 ──
const debugOpen = ref(false)
const ctx = computed(() => props.node._ctx ?? null)

const methodLabel = computed(() => {
  const m = T[lang.value].ctxMethod
  switch (ctx.value?.method) {
    case 'full-cloud':  return { text: m.cloud, cls: 'ctx-badge-cloud' }
    case 'full-local':  return { text: m.local, cls: 'ctx-badge-local' }
    case 'compressed':  return { text: m.comp,  cls: 'ctx-badge-comp'  }
    case 'truncated':   return { text: m.trunc, cls: 'ctx-badge-trunc' }
    default:            return null
  }
})

const ctxTotalChars = computed(() =>
  ctx.value?.messages.reduce((s, m) => s + m.content.length, 0) ?? 0
)

function ctxPreview(content: string): string {
  return content.length > 120 ? content.slice(0, 120) + '…' : content
}

function isCurrentQ(i: number): boolean {
  const msgs = ctx.value?.messages
  if (!msgs) return false
  for (let j = msgs.length - 1; j >= 0; j--) {
    if (msgs[j].role === 'user') return j === i
  }
  return false
}
</script>

<template>
  <!-- umc-wrap: カード本体 + 下の「引き続き質問」バーをまとめる -->
  <div class="umc-wrap">
    <div :class="['uni-model-card', isExcluded && 'umc-excluded']">

      <!-- ヘッダー: モデル名 + プロバイダーバッジ + チェックボックス -->
      <div class="umc-head">
        <span class="umc-model-name">{{ modelName }}</span>
        <span class="umc-prov-badge" :style="{ background: provColor }">{{ prov }}</span>
        <div class="umc-head-spacer"></div>
        <input
          v-if="!streaming"
          type="checkbox"
          class="umc-cb"
          :checked="checkboxValue"
          :title="T[lang].includeInCtx"
          @change="onCheckboxChange"
        />
      </div>

      <!-- ボディ + 継続スレッド（スクロール可能エリア） -->
      <div class="umc-content-scroll">
        <div class="umc-body md" v-html="bodyHtml"></div>
        <div v-if="continuationThread.length" class="cont-thread">
          <div v-for="pair in continuationThread" :key="pair.q.id" class="cont-pair">
            <div class="cont-pair-q">Q: {{ pair.q.content }}</div>
            <div class="cont-pair-a md" v-html="mdToHtml(pair.r.content)"></div>
          </div>
        </div>
      </div>

      <!-- フッター: ストリーミング中→停止ボタン / 完了後→アクションアイコン -->
      <div class="umc-foot">
        <template v-if="streaming">
          <button class="umc-stop-btn" :title="T[lang].stop" @click="cancelStream(node.id)">{{ T[lang].stop }}</button>
        </template>
        <template v-else>
          <button v-if="node.content" class="umc-icon-btn" :title="T[lang].copy" @click="handleCopy"><span class="material-icons">content_copy</span></button>
          <button v-if="node.content" class="umc-icon-btn" :title="T[lang].download" @click="handleDownload"><span class="material-icons">download</span></button>
          <button class="umc-icon-btn umc-del-btn" :title="T[lang].deleteBtn" @click="handleDelete"><span class="material-icons">delete</span></button>
          <div class="umc-foot-spacer"></div>
          <span v-if="node._stats" class="umc-stats-badge" :title="`${node._stats.evalCount} tokens`">
            ⚡ {{ node._stats.tokensPerSec }} tok/s &nbsp;·&nbsp; {{ (node._stats.totalMs / 1000).toFixed(1) }}s
          </span>
          <button
            v-if="ctx"
            :class="['umc-icon-btn', 'umc-dbg-btn', debugOpen && 'umc-dbg-btn-on']"
            :title="T[lang].sendCtxTitle"
            @click="debugOpen = !debugOpen"
          ><span class="material-icons">bug_report</span></button>
        </template>
      </div>

      <!-- デバッグ: コンテキスト表示パネル -->
      <div v-if="debugOpen && ctx" class="umc-dbg-panel">
        <div class="umc-dbg-header">
          <span class="umc-dbg-title">{{ T[lang].sendCtxTitle }}</span>
          <span v-if="methodLabel" :class="['umc-ctx-badge', methodLabel.cls]">{{ methodLabel.text }}</span>
          <span class="umc-dbg-summary">{{ ctx.messages.length }} msgs / {{ ctxTotalChars.toLocaleString() }} 字</span>
          <template v-if="ctx.method === 'compressed' || ctx.method === 'truncated'">
            <span class="umc-dbg-limit">元: {{ ctx.originalChars.toLocaleString() }} 字 → 制限: {{ ctx.charLimit?.toLocaleString() }} 字</span>
          </template>
          <template v-else-if="ctx.method === 'full-local' && ctx.charLimit">
            <span class="umc-dbg-limit">制限: {{ ctx.charLimit.toLocaleString() }} 字</span>
          </template>
        </div>
        <div class="umc-dbg-msgs">
          <div
            v-for="(msg, i) in ctx.messages"
            :key="i"
            :class="['umc-dbg-msg', `umc-dbg-msg-${msg.role}`, isCurrentQ(i) && 'umc-dbg-msg-current']"
          >
            <span class="umc-dbg-msg-meta">
              <span class="umc-dbg-msg-idx">[{{ i }}]</span>
              <span class="umc-dbg-msg-role">{{ msg.role }}</span>
              <span class="umc-dbg-msg-chars">{{ msg.content.length.toLocaleString() }}字</span>
              <span v-if="isCurrentQ(i)" class="umc-dbg-msg-star">{{ T[lang].currentQuestion }}</span>
            </span>
            <div class="umc-dbg-msg-preview">{{ ctxPreview(msg.content) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- カード外「引き続き質問」ボタン（応答完了後のみ） -->
    <div v-if="!streaming && node.content" class="umc-continue-bar">
      <button class="umc-continue-btn" @click="handleContinue">{{ T[lang].continueHere }}</button>
    </div>
  </div>
</template>
