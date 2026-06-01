import { defineComponent, computed, h } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import type { BraidedNode } from '@/types'

const TreeNode = defineComponent({
  name: 'TreeNode',
  props: {
    node:  { type: Object as () => BraidedNode, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ['clickNode'],
  setup(props, { emit }) {
    const sessionStore = useSessionStore()
    const uiStore      = useUiStore()
    const lang         = computed(() => uiStore.lang)

    const label = computed(() => {
      const n = props.node
      const s = sessionStore.curSess
      if (n.type === 'q') {
        const seq = s ? sessionStore.getQSeq(s, n.id) : '?'
        return `Q${seq} ${(n.content ?? '').slice(0, 18)}`
      }
      if (n.type === 'r')     return n.model?.split(':').pop() ?? '?'
      if (n.type === 'sigma')         return lang.value === 'ja' ? 'Σ 要約' : 'Σ Summary'
      if (n.type === 'consolidation') return lang.value === 'ja' ? '🔀 マージ' : '🔀 Merge'
      if (n.type === 'merge')         return lang.value === 'ja' ? '🔀 マージ' : '🔀 Merge'
      return '?'
    })

    const TYPE_DOT: Record<string, string>   = { q: 'type-q', sigma: 'type-sigma', merge: 'type-merge', r: '' }
    const TYPE_BADGE: Record<string, string> = { q: 'Q', sigma: 'Σ', merge: 'M', r: 'R' }
    const TYPE_CLS: Record<string, string>   = { q: 'q', sigma: 'sigma', merge: 'merge', r: 'r' }

    const dotClass  = computed(() => TYPE_DOT[props.node.type]  ?? '')
    const badge     = computed(() => TYPE_BADGE[props.node.type] ?? '?')
    const badgeCls  = computed(() => TYPE_CLS[props.node.type]   ?? '')
    const isActive  = computed(() => sessionStore.activeBranchId === props.node.id)

    const children = computed(() => {
      const s = sessionStore.curSess
      if (!s) return []
      return s.nodes.filter(n => n.parentId === props.node.id && !n.parentIds)
    })

    return () => {
      const nodeEl = h('div', {
        class: ['tree-node', isActive.value && 'active'],
        style: { paddingLeft: `${props.depth * 14}px` },
        onClick: () => emit('clickNode', props.node.id),
      }, [
        h('div', { class: 'tn-lines' }, props.depth > 0 ? [h('div', { class: 'tn-hline' })] : []),
        h('div', { class: `tn-dot ${dotClass.value}` }),
        badgeCls.value
          ? h('span', { class: `tn-badge ${badgeCls.value}` }, badge.value)
          : h('span', { class: 'tn-badge', style: 'background:#374151;color:#fff' }, badge.value),
        h('div', { class: 'tn-label' }, label.value),
      ])

      const childEls: ReturnType<typeof h>[] = children.value.map(c =>
        h(TreeNode, {
          key: c.id,
          node: c,
          depth: props.depth + 1,
          onClickNode: (id: string) => emit('clickNode', id),
        }),
      )

      return h('div', {}, [nodeEl, ...childEls])
    }
  },
})

export default TreeNode
