<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { T } from '@/i18n'

const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)
const log = computed(() => [...uiStore.ctxLog].reverse())  // 新しいものが上

const expandedIds = ref<Set<string>>(new Set())
function toggle(id: string) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
}

// メッセージ全文展開
const expandedMsgKeys = ref<Set<string>>(new Set())
function toggleMsg(key: string) {
  if (expandedMsgKeys.value.has(key)) expandedMsgKeys.value.delete(key)
  else expandedMsgKeys.value.add(key)
}
function isMsgExpanded(key: string) { return expandedMsgKeys.value.has(key) }

const METHOD_LABEL = computed(() => {
  const m = T[lang.value].ctxMethod
  return {
    'full-cloud': { text: m.cloud, cls: 'ctx-badge-cloud' },
    'full-local': { text: m.local, cls: 'ctx-badge-local' },
    'compressed': { text: m.comp,  cls: 'ctx-badge-comp'  },
    'truncated':  { text: m.trunc, cls: 'ctx-badge-trunc' },
  } as Record<string, { text: string; cls: string }>
})

function preview(s: string) {
  return s.length > 100 ? s.slice(0, 100) + '…' : s
}

function isCurrentQ(msgs: Array<{ role: string; content: string }>, i: number) {
  for (let j = msgs.length - 1; j >= 0; j--) {
    if (msgs[j].role === 'user') return j === i
  }
  return false
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div id="ctx-log-panel">
    <div class="clp-header">
      <span class="clp-title">{{ T[lang].sendLog }}</span>
      <span class="clp-count">{{ uiStore.ctxLog.length }} 件</span>
      <button class="clp-clear" title="ログをクリア" @click="uiStore.clearCtxLog(); expandedIds.clear()">
        <span class="material-icons">delete_sweep</span>
      </button>
      <button class="clp-close" @click="uiStore.ctxLogOpen = false">
        <span class="material-icons">close</span>
      </button>
    </div>

    <div class="clp-scroll">
    <div v-if="!log.length" class="clp-empty">{{ T[lang].sendLogEmpty }}</div>

    <div v-for="entry in log" :key="entry.id" class="clp-entry">
      <!-- エントリヘッダー -->
      <div class="clp-entry-head" @click="toggle(entry.id)">
        <span class="clp-expand-icon">{{ expandedIds.has(entry.id) ? '▼' : '▶' }}</span>
        <span class="clp-q-label">{{ entry.qLabel }}</span>
        <span class="clp-model">{{ entry.model.split(':').pop() }}</span>
        <span :class="['umc-ctx-badge', METHOD_LABEL[entry.method]?.cls ?? '']">
          {{ METHOD_LABEL[entry.method]?.text ?? entry.method }}
        </span>
        <span class="clp-meta">{{ entry.messages.length }}msgs / {{ entry.messages.reduce((s,m)=>s+m.content.length,0).toLocaleString() }}字</span>
        <span class="clp-time">{{ fmt(entry.ts) }}</span>
      </div>

      <!-- 圧縮・切詰の場合は元文字数 -->
      <div v-if="entry.method === 'compressed' || entry.method === 'truncated'" class="clp-limit-row">
        元: {{ entry.originalChars.toLocaleString() }} 字 → 制限: {{ entry.charLimit?.toLocaleString() }} 字
      </div>

      <!-- メッセージ展開 -->
      <div v-if="expandedIds.has(entry.id)" class="clp-msgs">
        <div
          v-for="(msg, i) in entry.messages"
          :key="i"
          :class="['clp-msg', `clp-msg-${msg.role}`, isCurrentQ(entry.messages, i) && 'clp-msg-current']"
        >
          <span class="clp-msg-role">{{ msg.role }}</span>
          <span class="clp-msg-chars">{{ msg.content.length.toLocaleString() }}字</span>
          <span v-if="isCurrentQ(entry.messages, i)" class="clp-msg-star">★</span>
          <div
            :class="['clp-msg-preview', isMsgExpanded(`${entry.id}-${i}`) && 'clp-msg-full', msg.content.length > 100 && 'clp-msg-clickable']"
            :title="msg.content.length > 100 ? (isMsgExpanded(`${entry.id}-${i}`) ? T[lang].collapseMsg : T[lang].expandMsg) : ''"
            @click.stop="msg.content.length > 100 && toggleMsg(`${entry.id}-${i}`)"
          >{{ isMsgExpanded(`${entry.id}-${i}`) ? msg.content : preview(msg.content) }}<span v-if="msg.content.length > 100 && !isMsgExpanded(`${entry.id}-${i}`)" class="clp-msg-expand-hint"> ▼</span></div>
        </div>
      </div>
    </div>
    </div><!-- clp-scroll -->
  </div>
</template>
