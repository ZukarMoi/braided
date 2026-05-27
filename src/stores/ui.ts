import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SidebarView } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const lang = ref<'ja' | 'en'>('ja')
  const sidebarOpen = ref(true)
  const sidebarView = ref<SidebarView>('list')
  const ollamaModels          = ref<string[]>([])
  const lmstudioModels        = ref<string[]>([])
  const anythingllmWorkspaces = ref<string[]>([])

  // Set は JSON 非対応のため配列で永続化 → computed で Set として提供
  const selectedModelKeys = ref<string[]>([])
  const selectedModels = computed(() => new Set(selectedModelKeys.value))

  const introShown = ref(true)   // plugin hydrate 後に上書きされる
  const compressing = ref(false) // 履歴圧縮中フラグ
  const toastMsg = ref('')
  const toastVisible = ref(false)
  let _toastTimer: ReturnType<typeof setTimeout> | null = null
  const continueModel = ref<string | null>(null)
  const nextQIsBranch = ref(false)

  // ── デバッグ: 送信コンテキストログ（永続化なし） ──
  interface CtxLogEntry {
    id: string
    ts: number
    qLabel: string      // "Q1", "Q2 (続き)" など
    model: string       // "anthropic:claude-..." など
    method: string
    charLimit: number | null
    originalChars: number
    messages: Array<{ role: string; content: string }>
  }
  const ctxLog = ref<CtxLogEntry[]>([])
  const ctxLogOpen = ref(false)

  function addCtxLog(entry: Omit<CtxLogEntry, 'id' | 'ts'>) {
    const full: CtxLogEntry = { id: Math.random().toString(36).slice(2, 10), ts: Date.now(), ...entry }
    ctxLog.value.push(full)
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(full),
    }).catch(() => {})
  }
  function clearCtxLog() {
    ctxLog.value = []
    fetch('/api/log', { method: 'DELETE' }).catch(() => {})
  }

  // ── カード選択 & FIB ──
  const selectedCardIds   = ref<Set<string>>(new Set())
  const collapsedCardIds  = ref<Set<string>>(new Set())
  const fibOpen = ref(false)
  const fibMode = ref<'normal' | 'consolidation'>('normal')

  function openFib(mode: 'normal' | 'consolidation' = 'normal') {
    fibMode.value = mode
    fibOpen.value = true
  }

  function closeFib() {
    fibOpen.value = false
    fibMode.value = 'normal'      // 閉じたら常にノーマルモードへリセット
    // continueModel は send() 内で消費してクリアされる。
    // キャンセル時は handleClose 側で明示的にクリアする。
  }

  function toggleCardSelection(qNodeId: string, checked: boolean) {
    if (checked) selectedCardIds.value.add(qNodeId)
    else selectedCardIds.value.delete(qNodeId)
  }

  function clearCardSelection() {
    selectedCardIds.value.clear()
  }

  function collapseCards(ids: string[]) {
    ids.forEach(id => collapsedCardIds.value.add(id))
  }

  function toggleCardCollapse(id: string) {
    if (collapsedCardIds.value.has(id)) collapsedCardIds.value.delete(id)
    else collapsedCardIds.value.add(id)
  }

  function toggleLang() {
    lang.value = lang.value === 'ja' ? 'en' : 'ja'
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function setSidebarView(v: SidebarView) {
    sidebarView.value = v
  }

  function toggleModel(key: string, checked: boolean) {
    if (checked) {
      if (!selectedModelKeys.value.includes(key)) selectedModelKeys.value.push(key)
    } else {
      selectedModelKeys.value = selectedModelKeys.value.filter(k => k !== key)
    }
  }

  function selectAll(keys: string[]) {
    const current = new Set(selectedModelKeys.value)
    keys.forEach(k => current.add(k))
    selectedModelKeys.value = [...current]
  }

  function deselectAll() {
    selectedModelKeys.value = []
  }

  function cleanupSelections(validKeys: string[]) {
    const valid = new Set(validKeys)
    selectedModelKeys.value = selectedModelKeys.value.filter(k => valid.has(k))
  }

  function toast(msg: string, dur = 2500) {
    toastMsg.value = msg
    toastVisible.value = true
    if (_toastTimer !== null) clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => {
      toastVisible.value = false
    }, dur)
  }

  return {
    lang,
    sidebarOpen,
    sidebarView,
    ollamaModels,
    lmstudioModels,
    anythingllmWorkspaces,
    selectedModelKeys,
    selectedModels,
    introShown,
    toastMsg,
    toastVisible,
    toggleLang,
    toggleSidebar,
    setSidebarView,
    toggleModel,
    selectAll,
    deselectAll,
    cleanupSelections,
    toast,
    compressing,
    continueModel,
    nextQIsBranch,
    ctxLog,
    ctxLogOpen,
    addCtxLog,
    clearCtxLog,
    selectedCardIds,
    collapsedCardIds,
    fibOpen,
    fibMode,
    openFib,
    closeFib,
    toggleCardSelection,
    clearCardSelection,
    collapseCards,
    toggleCardCollapse,
  }
})
