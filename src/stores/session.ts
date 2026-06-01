import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, BraidedNode, DisplayTurn } from '@/types'
import { useUiStore } from '@/stores/ui'
import { T } from '@/i18n'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<Session[]>([])
  const currentSessId = ref<string | null>(null)
  const activeBranchId = ref<string | null>(null)

  // pinia-plugin-persistedstate が自動保存するため save() は互換性のみ
  function save() { /* auto-persisted by plugin */ }

  const curSess = computed(() => sessions.value.find(s => s.id === currentSessId.value) ?? null)

  function getNode(s: Session, id: string): BraidedNode | null {
    return s.nodes.find(n => n.id === id) ?? null
  }

  function addNode(s: Session, node: BraidedNode): void {
    s.nodes.push(node)
  }

  function getAncestors(s: Session, nodeId: string): BraidedNode[] {
    const result: BraidedNode[] = []
    let cur: BraidedNode | null = getNode(s, nodeId)
    while (cur) {
      result.unshift(cur)
      cur = cur.parentId ? getNode(s, cur.parentId) : null
    }
    return result
  }

  function getQSeq(s: Session, qId: string): number | string {
    const qs = s.nodes.filter(n => n.type === 'q').sort((a, b) => a.timestamp - b.timestamp)
    const i = qs.findIndex(n => n.id === qId)
    return i >= 0 ? i + 1 : '?'
  }

  /**
   * 階層付きQラベルを返す
   * メインスレッド: Q1, Q2 …
   * ブランチ:       Q1-1, Q1-2, Q1-1-1 …
   * 続けて質問:     Q1.1, Q1.2, Q1-1.1 …
   */
  function getQLabel(s: Session, qId: string): string {
    const node = getNode(s, qId)
    if (!node) return 'Q?'

    // ① メインスレッド上にある場合
    const mainChain = getMainQChain(s)
    const mainIdx = mainChain.findIndex(q => q.id === qId)
    if (mainIdx >= 0) return `Q${mainIdx + 1}`

    if (!node.parentId) return `Q${getQSeq(s, qId)}`

    // ② 続けて質問 (continueModel が設定されている)
    if (node.continueModel) {
      // 親Rを辿ってルート（非continuation）のQとそのRを特定
      let curR = getNode(s, node.parentId)
      while (curR) {
        const parentQ = curR.parentId ? getNode(s, curR.parentId) : null
        if (!parentQ || parentQ.type !== 'q') break
        if (!parentQ.continueModel) {
          // parentQ がルートQ、curR がそのルートQの直下Rノード
          const rootLabel = getQLabel(s, parentQ.id)
          const thread = getContinuationThread(s, curR.id)
          const pos = thread.findIndex(pair => pair.q.id === qId)
          return pos >= 0 ? `${rootLabel}.${pos + 1}` : `${rootLabel}.?`
        }
        // さらに上へ
        if (!parentQ.parentId) break
        curR = getNode(s, parentQ.parentId)
      }
      return `Q${getQSeq(s, qId)}` // フォールバック
    }

    // ③ ブランチQ (parentId が r / consolidation / merge ノードを指す)
    const parentR = getNode(s, node.parentId)
    if (!parentR) return `Q${getQSeq(s, qId)}`

    const ownerQId = parentR.parentId ?? parentR.parentIds?.[0]
    if (!ownerQId) return `Q${getQSeq(s, qId)}`
    const ownerQ = getNode(s, ownerQId)
    if (!ownerQ || ownerQ.type !== 'q') return `Q${getQSeq(s, qId)}`

    const ownerLabel = getQLabel(s, ownerQ.id)

    // ownerQ に関連する r/consolidation/merge の id セット
    const ownerChildIds = new Set(
      s.nodes
        .filter(n => n.parentId === ownerQ.id || n.parentIds?.includes(ownerQ.id))
        .map(n => n.id),
    )
    const branches = s.nodes
      .filter(n => n.type === 'q' && n._branch && n.parentId && ownerChildIds.has(n.parentId))
      .sort((a, b) => a.timestamp - b.timestamp)

    const pos = branches.findIndex(n => n.id === qId)
    return pos >= 0 ? `${ownerLabel}-${pos + 1}` : `${ownerLabel}-?`
  }

  function getBranchSource(s: Session, q: BraidedNode): BraidedNode | null {
    if (!q.parentId) return null
    const parent = getNode(s, q.parentId)
    if (!parent) return null
    if (parent.type === 'sigma' || parent.type === 'q') return null
    return parent
  }

  function getMainQChain(s: Session): BraidedNode[] {
    const chain: BraidedNode[] = []
    let cur: BraidedNode | null =
      s.nodes.find(n => n.type === 'q' && !n.parentId && !n.parentIds) ?? null
    while (cur) {
      chain.push(cur)
      // 後続Qへの橋渡しノードを優先順で探す
      // 1. sigma（Q直下）
      const sigma = s.nodes.find(n => n.parentId === cur!.id && n.type === 'sigma')
      // 2. 単一カード統合（consolidation, parentId=Q, parentIdsなし）
      const singleCons = s.nodes
        .filter(n => n.parentId === cur!.id && n.type === 'consolidation' && !n.parentIds)
        .at(-1) ?? null
      // 3. マージ or クロス統合（parentIds に cur.id が含まれる）
      const multi = s.nodes
        .filter(n =>
          (n.type === 'merge' || (n.type === 'consolidation' && n.parentIds)) &&
          n.parentIds?.includes(cur!.id)
        )
        .at(-1) ?? null

      const parent = sigma ?? singleCons ?? multi ?? cur
      // _branch フラグが付いたQはメインスレッドに含めない
      cur = s.nodes.find(n => n.parentId === parent.id && n.type === 'q' && !n._branch) ?? null
    }
    return chain
  }

  function isOnMainThread(s: Session, qId: string): boolean {
    return getMainQChain(s).some(q => q.id === qId)
  }

  function buildDisplayTurns(s: Session): DisplayTurn[] {
    let qChain: BraidedNode[]
    if (activeBranchId.value) {
      const bn = getNode(s, activeBranchId.value)
      qChain = getAncestors(s, activeBranchId.value).filter(n => n.type === 'q')
      if (bn && bn.type !== 'q') {
        const parentQ = bn.parentId ? getNode(s, bn.parentId) : null
        if (parentQ && parentQ.type === 'q' && !qChain.find(q => q.id === parentQ.id)) {
          qChain.push(parentQ)
        }
      }
    } else {
      qChain = getMainQChain(s)
    }
    return qChain.map(q => ({
      q,
      responses: s.nodes.filter(n => n.parentId === q.id && n.type === 'r'),
      sigma: s.nodes.find(n => n.parentId === q.id && n.type === 'sigma') ?? null,
    }))
  }

  function buildCtxMessages(
    s: Session,
    qNodeId: string,
    overrideQuestion: string,
    maxHistoryChars?: number,   // 0 or undefined = no limit
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const qNode = getNode(s, qNodeId)
    const ancestors = qNode?.parentId ? getAncestors(s, qNode.parentId) : []
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const node of ancestors) {
      if (node.type === 'q') history.push({ role: 'user', content: node.content })
      else if (node.type === 'r' && !node.excluded) history.push({ role: 'assistant', content: node.content })
      else if (node.type === 'sigma') history.push({ role: 'assistant', content: `[Summary]\n${node.content}` })
      else if (node.type === 'merge') history.push({ role: 'assistant', content: `[Merged]\n${node.content}` })
      else if (node.type === 'manual') history.push({ role: 'assistant', content: `[Manual Context]\n${node.content}` })
    }

    // 文字数制限: 古いメッセージから削除（現在の質問は常に保持）
    if (maxHistoryChars && maxHistoryChars > 0 && history.length > 0) {
      let total = history.reduce((sum, m) => sum + m.content.length, 0)
      while (total > maxHistoryChars && history.length > 0) {
        total -= history.shift()!.content.length
      }
    }

    const currentQ = { role: 'user' as const, content: overrideQuestion || qNode?.content || '' }
    const messages = [...history, currentQ]

    if (s.injectedContext) {
      const firstUser = messages.findIndex(m => m.role === 'user')
      if (firstUser >= 0) {
        messages[firstUser] = {
          ...messages[firstUser],
          content: `[Background Context]\n${s.injectedContext}\n\n---\n\n${messages[firstUser].content}`,
        }
      }
    }
    return messages
  }

  function newSession() {
    const s: Session = { id: uid(), title: '…', created: Date.now(), nodes: [] }
    sessions.value.unshift(s)
    currentSessId.value = s.id
    activeBranchId.value = null
  }

  function openSession(id: string) {
    currentSessId.value = id
    activeBranchId.value = null
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter(s => s.id !== id)
    if (currentSessId.value === id) {
      currentSessId.value = sessions.value[0]?.id ?? null
      activeBranchId.value = null
    }
  }

  // バックアップ（sessions.json）からリストア
  function restoreFromBackup(imported: Session[]) {
    if (!Array.isArray(imported) || !imported.length) return
    // 既存セッションとマージ（IDが被らないものだけ追加）
    const existingIds = new Set(sessions.value.map(s => s.id))
    const newSessions = imported.filter(s => !existingIds.has(s.id))
    sessions.value = [...newSessions, ...sessions.value]
    if (!currentSessId.value) currentSessId.value = sessions.value[0]?.id ?? null
  }

  function setBranchCtx(nodeId: string) {
    activeBranchId.value = nodeId
  }

  function clearBranchCtx() {
    activeBranchId.value = null
  }

  // Rノードを起点に継続スレッドを取得（continueModelのQ→Rチェーン）
  function getContinuationThread(s: Session, rootRId: string): Array<{q: BraidedNode, r: BraidedNode}> {
    const pairs: Array<{q: BraidedNode, r: BraidedNode}> = []
    let rId = rootRId
    while (true) {
      const cq = s.nodes.find(n => n.parentId === rId && n.type === 'q' && n.continueModel)
      if (!cq) break
      const cr = s.nodes.find(n => n.parentId === cq.id && n.type === 'r')
      if (!cr) break
      pairs.push({ q: cq, r: cr })
      rId = cr.id
    }
    return pairs
  }

  // スレッド全体をQテキスト文字列に変換
  function buildQText(s: Session, rootQContent: string, rootRId: string): string {
    const r0 = getNode(s, rootRId)
    if (!r0) return ''
    let text = `Q: ${rootQContent}\nA: ${r0.content}\n`
    const pairs = getContinuationThread(s, rootRId)
    for (const {q, r} of pairs) {
      text += `\nQ: ${q.content}\nA: ${r.content}\n`
    }
    return text
  }

  function buildSessionMarkdown(s: Session): string {
    const lines: string[] = []
    const date = new Date(s.created).toLocaleString()
    lines.push(`# ${s.title}`)
    lines.push(`*Braided session — ${date}*`)
    lines.push('', '---', '')

    function nodeBlock(node: BraidedNode | undefined) {
      if (!node) return
      if (node.type === 'q') {
        const seq = getQSeq(s, node.id)
        const src = getBranchSource(s, node)
        lines.push(`## Q${seq}: ${node.content}`)
        if (src) {
          const model = src.model?.split(':').pop() ?? '?'
          const srcSeq = src.parentId ? getQSeq(s, src.parentId) : '?'
          lines.push(`*Q${srcSeq} の ${model} から派生*`)
        }
        lines.push('')

        const rNodes = s.nodes.filter(n => n.parentId === node.id && n.type === 'r')
        for (const r of rNodes) {
          const name = r.model?.split(':').pop() ?? '?'
          if (r.excluded) {
            lines.push(`### 🤖 ${name} *(除外済み)*`, '')
          } else {
            lines.push(`### 🤖 ${name}`, '', r.content || '', '')
            s.nodes.filter(n => n.parentId === r.id && n.type === 'q').forEach(bq => nodeBlock(bq))
          }
        }

        const sigma = s.nodes.find(n => n.parentId === node.id && n.type === 'sigma')
        if (sigma) {
          lines.push('### Σ 要約', '', sigma.content || '', '')
          s.nodes.filter(n => n.parentId === sigma.id && n.type === 'q').forEach(fq => nodeBlock(fq))
        } else {
          s.nodes.filter(n => n.parentId === node.id && n.type === 'q').forEach(dq => nodeBlock(dq))
        }
        lines.push('---', '')
      }
    }

    s.nodes.filter(n => n.type === 'q' && !n.parentId && !n.parentIds).forEach(n => nodeBlock(n))

    const merges = s.nodes.filter(n => n.parentIds)
    if (merges.length) {
      const lang = useUiStore().lang
      lines.push(`## 🔀 ${T[lang].mergeLabel}`, '')
      for (const m of merges) {
        const strat = (m.strategy ?? '').split(' — ')[0]
        lines.push(`### ${strat}`, '', m.content || '', '')
      }
      lines.push('---', '')
    }

    lines.push('*Generated by Braided*')
    return lines.join('\n')
  }

  return {
    sessions,
    currentSessId,
    activeBranchId,
    curSess,
    save,
    getNode,
    addNode,
    getAncestors,
    getQSeq,
    getQLabel,
    getBranchSource,
    getMainQChain,
    isOnMainThread,
    buildDisplayTurns,
    buildCtxMessages,
    getContinuationThread,
    buildQText,
    buildSessionMarkdown,
    newSession,
    openSession,
    deleteSession,
    setBranchCtx,
    clearBranchCtx,
    restoreFromBackup,
    uid,
  }
})
