import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { T } from '@/i18n'
import type { VaultSyncState } from '@/types'

export function useVaultSync() {
  const vaultSyncState = ref<VaultSyncState>('idle')
  let _vaultSyncTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleVaultSync() {
    const settingsStore = useSettingsStore()
    if (!settingsStore.vaultPath || !settingsStore.vaultAutoSync) return
    if (_vaultSyncTimer !== null) clearTimeout(_vaultSyncTimer)
    _vaultSyncTimer = setTimeout(_doAutoVaultSync, 1500)
  }

  async function _doAutoVaultSync() {
    const sessionStore = useSessionStore()
    const s = sessionStore.curSess
    if (!s || !s.nodes.length) return
    vaultSyncState.value = 'syncing'
    try {
      const resp = await fetch('/api/vault/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s }),
      })
      const result = (await resp.json()) as { status: string }
      vaultSyncState.value = result.status === 'ok' ? 'ok' : 'err'
      if (vaultSyncState.value === 'ok') {
        setTimeout(() => { vaultSyncState.value = 'idle' }, 4000)
      }
    } catch {
      vaultSyncState.value = 'err'
    }
  }

  async function syncToVault(sessionId?: string): Promise<void> {
    const sessionStore = useSessionStore()
    const settingsStore = useSettingsStore()
    const uiStore = useUiStore()
    const lang = uiStore.lang

    const s = sessionId
      ? sessionStore.sessions.find(sess => sess.id === sessionId) ?? null
      : sessionStore.curSess

    if (!s || !s.nodes.length) {
      uiStore.toast(T[lang].exportEmpty)
      return
    }
    if (!settingsStore.vaultPath) {
      uiStore.toast(T[lang].vaultNoPath)
      return
    }

    uiStore.toast(T[lang].vaultSyncing, 4000)
    vaultSyncState.value = 'syncing'

    try {
      const resp = await fetch('/api/vault/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s }),
      })
      const result = (await resp.json()) as { status: string; message?: string }
      if (result.status === 'ok') {
        uiStore.toast(T[lang].vaultSyncOk)
        vaultSyncState.value = 'ok'
        setTimeout(() => { vaultSyncState.value = 'idle' }, 4000)
      } else {
        uiStore.toast(`${T[lang].vaultSyncFail}: ${result.message ?? '?'}`)
        vaultSyncState.value = 'err'
      }
    } catch (err) {
      uiStore.toast(`${T[lang].vaultSyncFail}: ${(err as Error).message}`)
      vaultSyncState.value = 'err'
    }
  }

  return { vaultSyncState, scheduleVaultSync, syncToVault }
}
