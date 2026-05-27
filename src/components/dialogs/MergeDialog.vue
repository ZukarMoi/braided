<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useStreaming } from '@/composables/useStreaming'
import { useVaultSync } from '@/composables/useVaultSync'
import { T } from '@/i18n'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean] }>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const { executeMerge } = useStreaming()
const { scheduleVaultSync } = useVaultSync()

const lang = computed(() => uiStore.lang)

const mergeSelNodes = ref(new Set<string>())
const mergeStrategy = ref('')

const candidates = computed(() => {
  const s = sessionStore.curSess
  if (!s) return []
  return s.nodes.filter(n => (n.type === 'r' || n.type === 'sigma') && !n.excluded)
})

const strategies = ['summary', 'contrast', 'judge', 'handoff'] as const

function resetState() {
  mergeSelNodes.value.clear()
  mergeStrategy.value = ''
}

function close() {
  emit('update:open', false)
}

function toggleNode(id: string) {
  if (mergeSelNodes.value.has(id)) mergeSelNodes.value.delete(id)
  else mergeSelNodes.value.add(id)
}

function pickStrategy(sk: string) {
  mergeStrategy.value = sk
}

function getCandidateLabel(nodeId: string): string {
  const s = sessionStore.curSess
  if (!s) return '?'
  const n = sessionStore.getNode(s, nodeId)
  return n?.type === 'sigma' ? 'Σ Summary' : (n?.model?.split(':').pop() ?? '?')
}

async function handleExecuteMerge() {
  const result = await executeMerge(
    mergeSelNodes.value,
    mergeStrategy.value,
    (_nodeId, _content) => {},
    () => { scheduleVaultSync() },
  )
  if (result) close()
}

function overlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'merge-overlay') close()
}

// expose resetState so parent can call it when opening the dialog
defineExpose({ resetState })
</script>

<template>
  <div v-if="open" id="merge-overlay" @click="overlayClick">
    <div id="merge-dialog">
      <div class="dialog-head">
        <h2>🔀 {{ lang === 'ja' ? 'ブランチを統合' : 'Merge Branches' }}</h2>
        <button class="modal-close" @click="close">✕</button>
      </div>
      <div class="dialog-body">
        <div class="field">
          <label>{{ lang === 'ja' ? '統合するノードを選択' : 'Select nodes to merge' }}</label>
          <div id="merge-node-list">
            <div
              v-for="n in candidates"
              :key="n.id"
              :class="['merge-node-item', mergeSelNodes.has(n.id) && 'selected']"
              @click="toggleNode(n.id)"
            >
              <div class="mni-info">
                <div class="mni-label">{{ getCandidateLabel(n.id) }}</div>
                <div class="mni-preview">{{ (n.content ?? '').slice(0, 80) }}</div>
              </div>
            </div>
            <div v-if="!candidates.length" style="color:#9ca3af;font-size:.8rem;padding:8px">
              {{ lang === 'ja' ? '回答がありません' : 'No responses yet' }}
            </div>
          </div>
        </div>
        <div class="field">
          <label>{{ lang === 'ja' ? '統合戦略' : 'Merge strategy' }}</label>
          <div id="merge-strategies">
            <div
              v-for="sk in strategies"
              :key="sk"
              :class="['strategy-item', mergeStrategy === sk && 'selected']"
              @click="pickStrategy(sk)"
            >
              <div class="strat-name">{{ (T[lang].strategies[sk] ?? sk).split(' — ')[0] }}</div>
              <div class="strat-desc">{{ (T[lang].strategies[sk] ?? '').split(' — ').slice(1).join(' — ') }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-foot">
        <button class="btn-cancel" @click="close">{{ lang === 'ja' ? 'キャンセル' : 'Cancel' }}</button>
        <button class="btn-primary" @click="handleExecuteMerge">{{ lang === 'ja' ? '統合して質問' : 'Merge & Ask' }}</button>
      </div>
    </div>
  </div>
</template>
