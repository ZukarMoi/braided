import { ref, reactive } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { mdToHtml } from '@/composables/useMarkdown'
import { T } from '@/i18n'
import type { ChatMessage, ConsolidationStrategy, StreamStats } from '@/types'
import { resolveCharLimit } from './streaming/resolveCharLimit'
import {
  streamOllama,
  streamLMStudio,
  streamAnythingLLM,
  streamOpenAI,
  streamAnthropic,
  streamGemini,
  streamGrok,
} from './streaming/providers'

// ── モジュールレベル共有状態 ──────────────────────────────────────────────────
const streamControllers = new Map<string, AbortController>()
// reactive(Set) にすることで CompositeCard 等の完了検知に利用できる
const activeStreamIds = reactive(new Set<string>())
const sending = ref(false)

// ─────────────────────────────────────────────────────────────────────────────

export function useStreaming() {
  function isStreaming(nodeId: string): boolean {
    return activeStreamIds.has(nodeId)
  }

  function cancelStream(nodeId: string) {
    streamControllers.get(nodeId)?.abort()
  }

  // ── Provider ディスパッチャ ────────────────────────────────────────────────
  // 新しい接続先を追加する場合は providers/index.ts にファイルを追加し、
  // ここに if 行を 1 行追加するだけでよい。
  async function streamWith(
    modelKey: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    onStats?: (stats: StreamStats) => void,
  ): Promise<void> {
    const [prov, ...rest] = modelKey.split(':')
    const model = rest.join(':')
    const cfg = useSettingsStore().cfg
    if (prov === 'ollama')      return streamOllama(cfg.ollama.url, model, messages, onChunk, signal, cfg.ollama.unloadAfter, onStats)
    if (prov === 'lmstudio')   return streamLMStudio(cfg.lmstudio.url, model, messages, onChunk, signal)
    if (prov === 'anythingllm') return streamAnythingLLM(cfg.anythingllm.url, cfg.anythingllm.apiKey, model, messages, onChunk, signal)
    if (prov === 'openai')     return streamOpenAI(cfg.openai.apiKey, model, messages, onChunk, signal)
    if (prov === 'anthropic')  return streamAnthropic(cfg.anthropic.apiKey, model, messages, onChunk, signal)
    if (prov === 'gemini')     return streamGemini(cfg.gemini.apiKey, model, messages, onChunk, signal)
    if (prov === 'grok')       return streamGrok(cfg.grok.apiKey, model, messages, onChunk, signal)
    throw new Error(`Unknown provider: ${prov}`)
  }

  // ── 古い会話履歴を AI で要約圧縮する（C方式） ───────────────────────────
  async function compressHistory(
    modelKey: string,
    historyMessages: ChatMessage[],
  ): Promise<string> {
    const historyText = historyMessages
      .map(m => `[${m.role === 'user' ? 'User' : 'AI'}]\n${m.content}`)
      .join('\n\n---\n\n')
    const prompt = `以下の会話履歴を、重要な情報・文脈・結論を保ちながら簡潔に要約してください。要約のみを出力し、説明文は不要です。\n\n${historyText}`
    let result = ''
    await streamWith(modelKey, [{ role: 'user', content: prompt }], chunk => { result += chunk })
    return result.trim()
  }

  // ── メイン送信 ────────────────────────────────────────────────────────────
  async function send(
    question: string,
    extraInstruction: string,
    onChunkUpdate: (nodeId: string, content: string) => void,
    onDone: () => void,
  ) {
    const sessionStore = useSessionStore()
    const uiStore = useUiStore()
    const lang = uiStore.lang

    const settingsStore = useSettingsStore()
    const cfg = settingsStore.cfg
    // continueModel が設定されている場合はそのモデルのみ使用
    const models = uiStore.continueModel
      ? [uiStore.continueModel]
      : [...uiStore.selectedModels].filter(key => {
          const [prov, ...rest] = key.split(':')
          const modelName = rest.join(':')
          if (prov === 'ollama')      return uiStore.ollamaModels.includes(modelName)
          if (prov === 'lmstudio')   return uiStore.lmstudioModels.includes(modelName)
          if (prov === 'anythingllm') return uiStore.anythingllmWorkspaces.includes(modelName)
          if (prov === 'openai')     return !!cfg.openai.apiKey
          if (prov === 'anthropic')  return !!cfg.anthropic.apiKey
          if (prov === 'gemini')     return !!cfg.gemini.apiKey
          if (prov === 'grok')       return !!cfg.grok.apiKey
          return false
        })
    if (!models.length) {
      uiStore.toast(T[lang].noModels)
      return
    }

    let s = sessionStore.curSess
    if (!s) {
      sessionStore.newSession()
      s = sessionStore.curSess!
    }

    // Determine parent for new Q node
    let parentId: string | undefined
    if (sessionStore.activeBranchId) {
      parentId = sessionStore.activeBranchId
    } else {
      const qChain = sessionStore.getMainQChain(s)
      const lastQ = qChain[qChain.length - 1]
      if (lastQ) {
        const sigma = s.nodes.find(n => n.parentId === lastQ.id && n.type === 'sigma')
        parentId = sigma ? sigma.id : lastQ.id
      }
    }

    const fullQuestion = extraInstruction ? `${question}\n\n---\n${extraInstruction}` : question
    const uiSt = uiStore
    const qNode = {
      id: sessionStore.uid(),
      type: 'q' as const,
      parentId,
      content: question,
      timestamp: Date.now(),
      ...(uiSt.continueModel ? { continueModel: uiSt.continueModel } : {}),
      ...(uiSt.nextQIsBranch.valueOf() ? { _branch: true } : {}),
    }
    uiSt.nextQIsBranch = false  // フラグを消費
    sessionStore.addNode(s, qNode)
    if (!s.title || s.title === '…') s.title = question.slice(0, 40)
    sessionStore.clearBranchCtx()
    uiSt.continueModel = null
    sessionStore.save()

    // モデルごとにコンテキスト文字数制限を解決（並列フェッチ）
    const charLimits = await Promise.all(models.map(k => resolveCharLimit(k)))

    // rNode と charLimit を対応付けて保持
    const rNodes = models.map((modelKey, i) => {
      const rNode: import('@/types').BraidedNode = {
        id: sessionStore.uid(),
        type: 'r',
        parentId: qNode.id,
        model: modelKey,
        content: '',
        timestamp: Date.now(),
      }
      sessionStore.addNode(s!, rNode)
      return { rNode, charLimit: charLimits[i] }
    })

    // ── C方式: ローカルモデルの制限を超える場合は履歴を圧縮 ──
    const fullMessages = sessionStore.buildCtxMessages(s!, qNode.id, fullQuestion)
    const historyMessages = fullMessages.slice(0, -1)
    const currentQMsg    = fullMessages[fullMessages.length - 1]
    const historyChars   = historyMessages.reduce((sum, m) => sum + m.content.length, 0)

    // ローカルモデルのうち最も小さい上限値
    const localLimits = charLimits.filter((l): l is number => l !== null)
    const minLimit    = localLimits.length > 0 ? Math.min(...localLimits) : null

    // 圧縮コンテキスト（全ローカルモデルで共用）
    let compressedCtxMessages: ChatMessage[] | null = null
    if (minLimit !== null && historyChars > minLimit && historyMessages.length > 0) {
      const comprModel = models.find((_, i) => charLimits[i] !== null)!
      uiStore.compressing = true
      try {
        const summary = await compressHistory(comprModel, historyMessages)
        compressedCtxMessages = [
          { role: 'user', content: `[会話履歴の要約]\n${summary}` },
          currentQMsg,
        ]
      } catch {
        // 圧縮失敗 → B方式フォールバック（制限内に切り詰め）
        compressedCtxMessages = null
      } finally {
        uiStore.compressing = false
      }
    }

    sending.value = true

    await Promise.all(
      rNodes.map(async ({ rNode, charLimit }) => {
        // ローカルモデルは圧縮済みコンテキスト or B方式フォールバック、クラウドはフル
        const ctxMessages = charLimit !== null
          ? (compressedCtxMessages ?? sessionStore.buildCtxMessages(s!, qNode.id, fullQuestion, charLimit))
          : fullMessages

        // デバッグ用コンテキスト情報を保存
        const method = charLimit === null
          ? 'full-cloud'
          : compressedCtxMessages !== null
            ? 'compressed'
            : historyChars <= charLimit
              ? 'full-local'
              : 'truncated'
        rNode._ctx = { messages: ctxMessages, method, charLimit, originalChars: historyChars }
        uiStore.addCtxLog({
          qLabel: sessionStore.getQLabel(s!, qNode.id),
          model: rNode.model!,
          method,
          charLimit,
          originalChars: historyChars,
          messages: ctxMessages,
        })

        const ctrl = new AbortController()
        streamControllers.set(rNode.id, ctrl)
        activeStreamIds.add(rNode.id)
        try {
          await streamWith(rNode.model!, ctxMessages, chunk => {
            const live = sessionStore.getNode(s!, rNode.id)
            if (live) {
              live.content += chunk
              onChunkUpdate(rNode.id, live.content)
            }
          }, ctrl.signal, stats => {
            const live = sessionStore.getNode(s!, rNode.id)
            if (live) live._stats = stats
          })
        } catch (e) {
          const live = sessionStore.getNode(s!, rNode.id)
          if ((e as Error).name === 'AbortError') {
            if (live) live._cancelled = true
          } else {
            if (live) live.content = live.content || `[Error: ${(e as Error).message}]`
          }
        } finally {
          streamControllers.delete(rNode.id)
          activeStreamIds.delete(rNode.id)
        }
        sessionStore.save()
      }),
    )

    sessionStore.save()
    sending.value = false
    onDone()
  }

  // ── Σ（シグマ）要約生成 ──────────────────────────────────────────────────
  async function generateSummary(
    qNodeId: string,
    modelKey: string,
    onChunkUpdate: (nodeId: string, content: string) => void,
    onDone: () => void,
  ) {
    const sessionStore = useSessionStore()
    const uiStore = useUiStore()
    const lang = uiStore.lang
    const s = sessionStore.curSess
    if (!s) return

    const qNode = sessionStore.getNode(s, qNodeId)
    const rNodes = s.nodes.filter(n =>
      n.parentId === qNodeId && (
        (n.type === 'r' && !n.excluded) ||
        n.type === 'manual'
      )
    )
    if (!rNodes.length) return

    // 直接のRノードのテキスト（manualノード含む）
    const parts = rNodes.map(r =>
      r.type === 'manual'
        ? `[手動コンテキスト]\n${r.content}`
        : `[${r.model?.split(':').pop()}]\n${r.content}`
    ).join('\n\n---\n\n')

    // _sigmaInclude=true のブランチQノードをΣ contextに追加
    const rNodeIdSet = new Set(rNodes.map(r => r.id))
    const existingSigmaId = s.nodes.find(n => n.parentId === qNodeId && n.type === 'sigma')?.id
    const branchQs = s.nodes.filter(n => {
      if (n.type !== 'q' || !n._sigmaInclude) return false
      if (n.parentId === qNodeId) return true
      if (existingSigmaId && n.parentId === existingSigmaId) return true
      if (n.parentId && rNodeIdSet.has(n.parentId)) return true
      return false
    })
    let fullParts = parts
    if (branchQs.length) {
      const branchTexts = branchQs.map(bq => {
        const bqRNodes = s.nodes.filter(r => r.parentId === bq.id && r.type === 'r' && !r.excluded)
        const bqText = bqRNodes.map(r => `[${r.model?.split(':').pop()}]\n${r.content}`).join('\n\n---\n\n')
        return `[追加質問: ${bq.content}]\n${bqText}`
      }).join('\n\n===\n\n')
      fullParts = `${parts}\n\n===\n\n[ブランチ質問の回答 (Σ包含対象)]\n${branchTexts}`
    }

    const prompt = T[lang].aiSumPrompt(qNode?.content ?? '', fullParts)
    const sigma = {
      id: sessionStore.uid(),
      type: 'sigma' as const,
      parentId: qNodeId,
      content: '',
      timestamp: Date.now(),
    }
    sessionStore.addNode(s, sigma)
    sessionStore.save()

    const model = modelKey || [...uiStore.selectedModels][0]
    if (!model) {
      sigma.content = '[No model selected]'
      sessionStore.save()
      return
    }

    try {
      await streamWith(model, [{ role: 'user', content: prompt }], chunk => {
        const live = sessionStore.getNode(s, sigma.id)
        if (live) {
          live.content += chunk
          onChunkUpdate(sigma.id, live.content)
        }
      })
    } catch (e) {
      const live = sessionStore.getNode(s, sigma.id)
      if (live) live.content = `[Error: ${(e as Error).message}]`
    }

    sessionStore.save()
    onDone()
  }

  // ── 統合（Consolidation） ─────────────────────────────────────────────────
  async function executeConsolidation(
    qNodeIds: string[],
    strategies: ConsolidationStrategy[],
    customInstruction: string,
    modelKey: string,
    onChunkUpdate: (nodeId: string, content: string) => void,
    onDone: () => void,
  ) {
    const sessionStore = useSessionStore()
    const uiStore = useUiStore()
    const s = sessionStore.curSess
    if (!s || !strategies.length || !modelKey || !qNodeIds.length) return

    // 各QノードのRノードをまとめてパーツ化
    const cardParts = qNodeIds.map(qNodeId => {
      const qNode = sessionStore.getNode(s, qNodeId)
      const rNodes = s.nodes.filter(n =>
        n.parentId === qNodeId && (
          (n.type === 'r' && !n.excluded) ||
          n.type === 'manual'
        )
      )
      if (!rNodes.length) return null
      const seq = sessionStore.getQSeq(s, qNodeId)
      const rText = rNodes.map(r =>
        r.type === 'manual'
          ? `  [手動コンテキスト]\n  ${r.content}`
          : `  [${r.model?.split(':').pop()}]\n  ${r.content}`
      ).join('\n\n---\n\n')

      // _sigmaInclude=true のブランチQ内容も追加
      const rNodeIdSet = new Set(rNodes.map(r => r.id))
      const branchQs = s.nodes.filter(n => {
        if (n.type !== 'q' || !n._sigmaInclude) return false
        if (n.parentId === qNodeId) return true
        if (n.parentId && rNodeIdSet.has(n.parentId)) return true
        return false
      })
      let fullRText = rText
      if (branchQs.length) {
        const branchTexts = branchQs.map(bq => {
          const bqRs = s.nodes.filter(r => r.parentId === bq.id && r.type === 'r' && !r.excluded)
          const bqText = bqRs.map(r => `[${r.model?.split(':').pop()}]\n${r.content}`).join('\n\n---\n\n')
          return `  [追加質問: ${bq.content}]\n  ${bqText}`
        }).join('\n\n')
        fullRText = `${rText}\n\n${branchTexts}`
      }
      return `[Q${seq}: ${qNode?.content ?? ''}]\n${fullRText}`
    }).filter(Boolean).join('\n\n===\n\n')

    if (!cardParts) return

    const buildPrompt = (strategy: ConsolidationStrategy): string => {
      if (strategy === 'best')
        return `以下の複数の質問と回答を総合的に評価し、最も適切・質の高い回答をしたモデルを判定してください。各回答の強みと弱みを述べ、最適なモデルを選んだ理由を示してください。\n\n${cardParts}`
      if (strategy === 'merge')
        return `以下の複数の質問と回答を統合し、一つの包括的な回答にまとめてください。\n\n${cardParts}`
      if (strategy === 'diff')
        return `以下の複数の質問と回答を比較し、各回答の違い・独自の観点・矛盾点・共通点を整理してください。\n\n${cardParts}`
      if (strategy === 'custom')
        return `${customInstruction}\n\n[対象]\n${cardParts}`
      return ''
    }

    // consolidationノードを一括作成（parentIds で全カードを参照）
    const consNodes = strategies.map(strategy => {
      const node: import('@/types').BraidedNode = {
        id: sessionStore.uid(),
        type: 'consolidation',
        parentId: qNodeIds[0],
        parentIds: qNodeIds.length > 1 ? qNodeIds : undefined,
        content: '',
        consolidationStrategy: strategy,
        model: modelKey,
        ...(strategy === 'custom' ? { customInstruction } : {}),
        timestamp: Date.now(),
      }
      sessionStore.addNode(s, node)
      return node
    })
    sessionStore.save()

    await Promise.all(consNodes.map(async node => {
      const prompt = buildPrompt(node.consolidationStrategy!)
      const ctxMessages: ChatMessage[] = [{ role: 'user', content: prompt }]
      uiStore.addCtxLog({
        qLabel: `cns.${node.consolidationStrategy}.${qNodeIds.map(id => sessionStore.getQLabel(s, id)).join('.')}`,
        model: modelKey,
        method: 'full-cloud',
        charLimit: null,
        originalChars: prompt.length,
        messages: ctxMessages,
      })
      try {
        await streamWith(modelKey, ctxMessages, chunk => {
          const live = sessionStore.getNode(s, node.id)
          if (live) {
            live.content += chunk
            onChunkUpdate(node.id, live.content)
          }
        })
      } catch (e) {
        const live = sessionStore.getNode(s, node.id)
        if (live) live.content = `[Error: ${(e as Error).message}]`
      }
      sessionStore.save()
    }))

    onDone()
  }

  // ── マージ（Merge） ────────────────────────────────────────────────────────
  async function executeMerge(
    mergeSelNodes: Set<string>,
    mergeStrategy: string,
    onChunkUpdate: (nodeId: string, content: string) => void,
    onDone: () => void,
  ): Promise<boolean> {
    const sessionStore = useSessionStore()
    const uiStore = useUiStore()
    const lang = uiStore.lang
    const s = sessionStore.curSess

    if (mergeSelNodes.size < 2) {
      uiStore.toast(T[lang].mergeNeedTwo)
      return false
    }
    if (!mergeStrategy) {
      uiStore.toast(T[lang].mergeNeedStrategy)
      return false
    }
    if (!s) return false

    const nodes = [...mergeSelNodes].map(id => {
      const n = sessionStore.getNode(s, id)
      return {
        id,
        label: n?.type === 'sigma' ? 'Summary' : (n?.model?.split(':').pop() ?? '?'),
        content: n?.content ?? '',
      }
    })

    const prompt = T[lang].aiMergePrompt(mergeStrategy, nodes)
    const mergeNode = {
      id: sessionStore.uid(),
      type: 'merge' as const,
      parentId: [...mergeSelNodes][0],
      parentIds: [...mergeSelNodes],
      content: '',
      strategy: mergeStrategy as import('@/types').MergeStrategy,
      timestamp: Date.now(),
    }
    sessionStore.addNode(s, mergeNode)
    sessionStore.save()

    const model = [...uiStore.selectedModels][0]
    if (!model) {
      mergeNode.content = '[No model selected]'
      sessionStore.save()
      onDone()
      return true
    }

    const ctxMessages: ChatMessage[] = [{ role: 'user', content: prompt }]
    uiStore.addCtxLog({
      qLabel: `mrg.${mergeStrategy}`,
      model,
      method: 'full-cloud',
      charLimit: null,
      originalChars: prompt.length,
      messages: ctxMessages,
    })

    try {
      await streamWith(model, ctxMessages, chunk => {
        const live = sessionStore.getNode(s, mergeNode.id)
        if (live) {
          live.content += chunk
          onChunkUpdate(mergeNode.id, live.content)
        }
      })
    } catch (e) {
      const live = sessionStore.getNode(s, mergeNode.id)
      if (live) live.content = `[Error: ${(e as Error).message}]`
    }

    sessionStore.save()
    onDone()
    return true
  }

  // ── 同じQに別モデルで再送信 ───────────────────────────────────────────────
  async function reAskWith(
    qNodeId: string,
    modelKey: string,
    onChunkUpdate: (nodeId: string, content: string) => void,
    onDone: () => void,
  ) {
    const sessionStore = useSessionStore()
    const s = sessionStore.curSess
    if (!s) return
    const qNode = sessionStore.getNode(s, qNodeId)
    if (!qNode) return

    const rNode: import('@/types').BraidedNode = {
      id: sessionStore.uid(),
      type: 'r',
      parentId: qNodeId,
      model: modelKey,
      content: '',
      timestamp: Date.now(),
    }
    sessionStore.addNode(s, rNode)
    sessionStore.save()

    const charLimit    = await resolveCharLimit(modelKey)
    const fullMessages = sessionStore.buildCtxMessages(s, qNodeId, qNode.content)
    let ctxMessages    = fullMessages
    let reAskMethod: 'full-cloud' | 'full-local' | 'compressed' | 'truncated' = charLimit === null ? 'full-cloud' : 'full-local'
    const reAskHistory = fullMessages.slice(0, -1)
    const reAskHistoryChars = reAskHistory.reduce((sum, m) => sum + m.content.length, 0)

    if (charLimit !== null) {
      const history      = reAskHistory
      const currentQMsg  = fullMessages[fullMessages.length - 1]
      const historyChars = reAskHistoryChars
      if (historyChars > charLimit && history.length > 0) {
        const uiStore = useUiStore()
        uiStore.compressing = true
        try {
          const summary = await compressHistory(modelKey, history)
          ctxMessages = [{ role: 'user', content: `[会話履歴の要約]\n${summary}` }, currentQMsg]
          reAskMethod = 'compressed'
        } catch {
          ctxMessages = sessionStore.buildCtxMessages(s, qNodeId, qNode.content, charLimit)
          reAskMethod = 'truncated'
        } finally {
          uiStore.compressing = false
        }
      }
    }
    rNode._ctx = { messages: ctxMessages, method: reAskMethod, charLimit, originalChars: reAskHistoryChars }
    const uiStoreReAsk = useUiStore()
    const reAskIdx = s.nodes.filter(n => n.parentId === qNodeId && n.type === 'r').length - 1
    uiStoreReAsk.addCtxLog({
      qLabel: `${sessionStore.getQLabel(s, qNodeId)}.r${reAskIdx > 0 ? reAskIdx : 1}`,
      model: modelKey,
      method: reAskMethod,
      charLimit,
      originalChars: reAskHistoryChars,
      messages: ctxMessages,
    })

    const ctrl = new AbortController()
    streamControllers.set(rNode.id, ctrl)
    activeStreamIds.add(rNode.id)
    try {
      await streamWith(modelKey, ctxMessages, chunk => {
        const live = sessionStore.getNode(s, rNode.id)
        if (live) {
          live.content += chunk
          onChunkUpdate(rNode.id, live.content)
        }
      }, ctrl.signal, stats => {
        const live = sessionStore.getNode(s, rNode.id)
        if (live) live._stats = stats
      })
    } catch (e) {
      const live = sessionStore.getNode(s, rNode.id)
      if (live) live.content = live.content || `[Error: ${(e as Error).message}]`
    } finally {
      streamControllers.delete(rNode.id)
      activeStreamIds.delete(rNode.id)
    }
    sessionStore.save()
    onDone()
  }

  // ── 除外トグル ────────────────────────────────────────────────────────────
  function toggleExclude(nodeId: string) {
    const sessionStore = useSessionStore()
    const s = sessionStore.curSess
    if (!s) return
    const node = sessionStore.getNode(s, nodeId)
    if (!node) return
    const ctrl = streamControllers.get(nodeId)
    if (ctrl) ctrl.abort()
    node.excluded = !node.excluded
    sessionStore.save()
  }

  return {
    sending,
    isStreaming,
    activeStreamIds,
    cancelStream,
    streamWith,
    send,
    generateSummary,
    executeConsolidation,
    executeMerge,
    toggleExclude,
    reAskWith,
    mdToHtml,
  }
}
