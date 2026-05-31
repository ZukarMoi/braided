<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useVaultSync } from '@/composables/useVaultSync'
import TreeNode from './TreeNode'
import { T } from '@/i18n'

const sessionStore = useSessionStore()
const uiStore      = useUiStore()
const { vaultSyncState, syncToVault } = useVaultSync()

const lang = computed(() => uiStore.lang)

// ── 裏コマンド: ロゴを5回クリックで IntroOverlay を再表示 ──
let _logoClickCount = 0
let _logoClickTimer: ReturnType<typeof setTimeout> | null = null
function onLogoClick() {
  _logoClickCount++
  if (_logoClickTimer) clearTimeout(_logoClickTimer)
  _logoClickTimer = setTimeout(() => { _logoClickCount = 0 }, 1500)
  if (_logoClickCount >= 5) {
    _logoClickCount = 0
    uiStore.introShown = true
  }
}

const emit = defineEmits<{ openSettings: [] }>()

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString()
}

function exportSession(id: string, e: Event) {
  e.stopPropagation()
  const s = sessionStore.sessions.find(sess => sess.id === id)
  if (!s || !s.nodes.length) {
    uiStore.toast(T[lang.value].exportEmpty)
    return
  }
  const md   = sessionStore.buildSessionMarkdown(s)
  const slug = s.title.slice(0, 30).replace(/[\s/\\:*?"<>|]/g, '-')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `braided-${slug}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function handleVaultSync(id: string, e: Event) {
  e.stopPropagation()
  await syncToVault(id)
}

function onTreeClick(nodeId: string) {
  const s = sessionStore.curSess
  if (!s) return
  const node = sessionStore.getNode(s, nodeId)
  if (!node) return
  if (node.type === 'q') {
    const sigma = s.nodes.find(n => n.parentId === node.id && n.type === 'sigma')
    const lastR = s.nodes.filter(n => n.parentId === node.id && n.type === 'r').at(-1)
    sessionStore.activeBranchId = sigma?.id ?? lastR?.id ?? node.parentId ?? null
  } else {
    sessionStore.setBranchCtx(nodeId)
  }
}

const vaultIndicator = computed(() => {
  const map: Record<string, { cls: string; icon: string; tip: string }> = {
    idle:    { cls: '',          icon: '',     tip: '' },
    syncing: { cls: 'vi-syncing', icon: '⟳',  tip: 'Vault 同期中…' },
    ok:      { cls: 'vi-ok',      icon: '📁✓', tip: 'Vault 同期済' },
    err:     { cls: 'vi-err',     icon: '📁✗', tip: 'Vault 同期失敗' },
  }
  return map[vaultSyncState.value] ?? map['idle']
})
</script>

<template>
  <aside id="sidebar" :class="{ collapsed: !uiStore.sidebarOpen }">
    <div class="sb-head">
      <div class="sb-brand" @click="onLogoClick" style="cursor:default;user-select:none">
        <span class="icon">🧵</span>
        <div class="sb-brand-text">
          <span class="sb-name">Braided</span>
          <span class="sb-tagline">Ask many AIs. Branch, explore, merge.</span>
        </div>
      </div>
      <button id="btn-collapse" :title="T[lang].sidebarClose" @click="uiStore.toggleSidebar()">‹</button>
    </div>

    <button id="btn-new-session" @click="sessionStore.newSession()">
      <span class="plus">＋</span>
      <span>{{ T[lang].newSession }}</span>
    </button>

    <div class="sb-tabs">
      <button
        :class="['sb-tab', { active: uiStore.sidebarView === 'list' }]"
        @click="uiStore.setSidebarView('list')"
      >{{ T[lang].tabList }}</button>
      <button
        :class="['sb-tab', { active: uiStore.sidebarView === 'tree' }]"
        @click="uiStore.setSidebarView('tree')"
      >{{ T[lang].tabTree }}</button>
    </div>

    <!-- List view -->
    <div :class="['sb-view', { active: uiStore.sidebarView === 'list' }]">
      <div id="session-list">
        <div v-if="!sessionStore.sessions.length" class="tree-empty">
          {{ T[lang].noSessions }}
        </div>
        <div
          v-for="sess in sessionStore.sessions"
          :key="sess.id"
          :class="['sess-item', { active: sess.id === sessionStore.currentSessId }]"
          @click="sessionStore.openSession(sess.id)"
        >
          <div class="si-title">{{ sess.title }}</div>
          <div class="si-time">{{ formatDate(sess.created) }}</div>
          <button class="si-exp" title="MDエクスポート" @click.stop="exportSession(sess.id, $event)">📤</button>
          <button
            class="si-vault"
            :title="T[lang].vaultBtnTitle"
            @click.stop="handleVaultSync(sess.id, $event)"
          >📁</button>
          <button class="si-del" @click.stop="sessionStore.deleteSession(sess.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- Tree view -->
    <div :class="['sb-view', { active: uiStore.sidebarView === 'tree' }]">
      <div id="tree-panel">
        <template v-if="sessionStore.curSess && sessionStore.curSess.nodes.length">
          <TreeNode
            v-for="node in sessionStore.curSess.nodes.filter(n => !n.parentId && !n.parentIds)"
            :key="node.id"
            :node="node"
            :depth="0"
            @click-node="onTreeClick"
          />
          <TreeNode
            v-for="node in sessionStore.curSess.nodes.filter(n => !!n.parentIds)"
            :key="node.id"
            :node="node"
            :depth="0"
            @click-node="onTreeClick"
          />
        </template>
        <div v-else class="tree-empty">{{ T[lang].noNodes }}</div>
      </div>
    </div>

    <div class="sb-footer">
      <button id="btn-settings" @click="emit('openSettings')">
        {{ T[lang].settings }}
      </button>
      <span
        :class="['vault-ind', vaultIndicator.cls]"
        :title="vaultIndicator.tip"
      >{{ vaultIndicator.icon }}</span>
      <button id="btn-lang" @click="uiStore.toggleLang()">{{ lang === 'ja' ? 'JA' : 'EN' }}</button>
    </div>
  </aside>

  <button v-if="!uiStore.sidebarOpen" id="btn-expand" style="display:flex" @click="uiStore.toggleSidebar()">›</button>
</template>
