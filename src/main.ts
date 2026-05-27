import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { get, set } from 'idb-keyval'
import App from './App.vue'
import '../style.css'

// UI ストアで永続化する項目のみ
const UI_PERSIST_KEYS = ['lang', 'selectedModelKeys', 'introShown']

// ストアID → IndexedDB キー
const IDB_KEY: Record<string, string> = {
  session:  'braided_sess',
  settings: 'braided_cfg',
  ui:       'braided_ui',
}

function tryParse(s: string | undefined | null): Record<string, unknown> | null {
  if (!s) return null
  try { return JSON.parse(s) as Record<string, unknown> } catch { return null }
}

// ── localStorage → IndexedDB 一回限りのマイグレーション ──
async function migrateFromLocalStorage(): Promise<void> {
  // IndexedDB に既にセッションデータがあればスキップ
  const idbSess = await get<string>('braided_sess')
  if (idbSess) return

  const lsSess = localStorage.getItem('braided_sess')
  if (!lsSess) return

  try {
    const sessions = JSON.parse(lsSess)
    if (Array.isArray(sessions) && sessions.length > 0) {
      await set('braided_sess', JSON.stringify({
        sessions,
        currentSessId: (sessions[0] as { id: string })?.id ?? null,
        activeBranchId: null,
      }))
    }

    const lsCfg = localStorage.getItem('braided_cfg')
    if (lsCfg) {
      await set('braided_cfg', JSON.stringify({ cfg: JSON.parse(lsCfg) }))
    }

    const lang = (localStorage.getItem('braided_lang') as 'ja' | 'en') ?? 'ja'
    const selRaw = localStorage.getItem('braided_sel')
    const selectedModelKeys: string[] = selRaw ? (JSON.parse(selRaw) as string[]) : []
    const introShown = !localStorage.getItem('braided_intro_done')
    await set('braided_ui', JSON.stringify({ lang, selectedModelKeys, introShown }))

    console.info('[Braided] localStorage → IndexedDB マイグレーション完了')
  } catch (e) {
    console.warn('[Braided] マイグレーション失敗:', e)
  }
}

// ── IndexedDB からデータを事前ロード（app.mount 前に await）──
async function preloadFromIDB() {
  const [sessRaw, cfgRaw, uiRaw] = await Promise.all([
    get<string>('braided_sess'),
    get<string>('braided_cfg'),
    get<string>('braided_ui'),
  ])
  return {
    session:  tryParse(sessRaw),
    settings: tryParse(cfgRaw),
    ui:       tryParse(uiRaw),
  }
}

async function main() {
  await migrateFromLocalStorage()
  const preloaded = await preloadFromIDB()

  const pinia = createPinia()

  // ── カスタム永続化プラグイン ──
  // pinia-plugin-persistedstate は getItem() を同期として扱うため IDB 非対応。
  // 代わりに app.mount 前に全データを await で取得し、同期的にストアへ注入する。
  pinia.use(({ store }) => {
    const idbKey = IDB_KEY[store.$id]
    if (!idbKey) return

    // 事前ロード済みデータでハイドレーション（同期）
    const saved = preloaded[store.$id as keyof typeof preloaded]
    if (saved) {
      try {
        store.$patch(state => { Object.assign(state, saved) })
      } catch (e) {
        console.warn(`[Braided] store ${store.$id} hydration failed:`, e)
      }
    }

    // 状態変化を IndexedDB に書き込む（fire-and-forget）
    store.$subscribe((_mutation, state) => {
      // UI ストアは必要な項目のみ保存
      const toSave = store.$id === 'ui'
        ? Object.fromEntries(
            UI_PERSIST_KEYS.map(k => [k, (state as Record<string, unknown>)[k]])
          )
        : state
      set(idbKey, JSON.stringify(toSave)).catch(err =>
        console.warn(`[Braided] IDB write failed (${store.$id}):`, err)
      )
    }, { detached: true })
  })

  const app = createApp(App)
  app.use(pinia)
  app.mount('#app')
}

main()
