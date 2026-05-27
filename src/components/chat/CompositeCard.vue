<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useStreaming } from '@/composables/useStreaming'
import UniModelCard from './UniModelCard.vue'
import ManualContextCard from './ManualContextCard.vue'
import AddCard from './AddCard.vue'
import SigmaBlock from './SigmaBlock.vue'
import ConsolidationBlock from './ConsolidationBlock.vue'
import { T } from '@/i18n'

const props = defineProps<{
  qNodeId: string
  depth?: number
}>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const { activeStreamIds } = useStreaming()
const lang = computed(() => uiStore.lang)

const depth = computed(() => props.depth ?? 0)

// 折りたたみ状態はUIストアで管理
const collapsed = computed({
  get: () => uiStore.collapsedCardIds.has(props.qNodeId),
  set: (v: boolean) => {
    if (v) uiStore.collapsedCardIds.add(props.qNodeId)
    else uiStore.collapsedCardIds.delete(props.qNodeId)
  },
})

// ネストされた Branch CC はマウント時に自動折りたたみ
onMounted(() => {
  if (depth.value > 0) {
    uiStore.collapsedCardIds.add(props.qNodeId)
  }
})

const s = computed(() => sessionStore.curSess)

const qNode = computed(() => {
  if (!s.value) return null
  return sessionStore.getNode(s.value, props.qNodeId)
})

const qSeq = computed(() => {
  if (!s.value || !qNode.value) return '?'
  return sessionStore.getQSeq(s.value, qNode.value.id)
})

const rNodes = computed(() => {
  if (!s.value) return []
  return s.value.nodes.filter(n => n.parentId === props.qNodeId && n.type === 'r')
})

const manualNodes = computed(() => {
  if (!s.value) return []
  return s.value.nodes.filter(n => n.parentId === props.qNodeId && n.type === 'manual')
})

const sigmaNode = computed(() => {
  if (!s.value) return null
  return s.value.nodes.find(n => n.parentId === props.qNodeId && n.type === 'sigma') ?? null
})

const consolidationNodes = computed(() => {
  if (!s.value) return []
  return s.value.nodes.filter(n =>
    n.type === 'consolidation' && n.parentId === props.qNodeId && !n.parentIds
  )
})

const rNodeIds = computed(() => new Set(rNodes.value.map(r => r.id)))

// Branch Q ノード: このCCのカルーセル内に表示するネストCC
const branchQNodes = computed(() => {
  if (!s.value) return []
  const sigmaId = sigmaNode.value?.id
  return s.value.nodes.filter(n => {
    if (n.type !== 'q' || n.continueModel) return false
    if (n._branch) {
      if (n.parentId === props.qNodeId) return true
      if (sigmaId && n.parentId === sigmaId) return true
      if (n.parentId && rNodeIds.value.has(n.parentId)) return true
    }
    return false
  })
})

const activeBranchId = computed(() => sessionStore.activeBranchId)
const continueModel  = computed(() => uiStore.continueModel)
const showPendingPlaceholder = computed(() => {
  if (continueModel.value) return false
  if (!activeBranchId.value) return false
  return activeBranchId.value === props.qNodeId || rNodeIds.value.has(activeBranchId.value)
})

// ── カード完了状態 ──
const isComplete = computed(() => {
  const hasContent = rNodes.value.length > 0 || manualNodes.value.length > 0
  const streaming  = rNodes.value.some(r => activeStreamIds.has(r.id))
  return hasContent && !streaming
})

// ── UMCエリア折りたたみ ──
const umcCollapsed = ref(false)
const hasResults   = computed(() => !!sigmaNode.value || consolidationNodes.value.length > 0)

watch(
  () => consolidationNodes.value.length,
  (len, prevLen = 0) => {
    if (len > 0 && prevLen === 0) umcCollapsed.value = true
  },
)

// ── カード選択チェックボックス ──
const isSelected = computed(() => uiStore.selectedCardIds.has(props.qNodeId))

function onCardCheckChange(e: Event) {
  uiStore.toggleCardSelection(props.qNodeId, (e.target as HTMLInputElement).checked)
}

// ── ブランチΣ包含チェックボックス ──
const isBranch = computed(() => !!qNode.value?._branch)

watch(isComplete, (complete) => {
  if (complete && qNode.value && qNode.value._sigmaInclude === undefined) {
    qNode.value._sigmaInclude = true
    sessionStore.save()
  }
}, { immediate: true })

function toggleSigmaInclude() {
  const node = qNode.value
  if (!node) return
  node._sigmaInclude = !node._sigmaInclude
  sessionStore.save()
}

function handleConsolidateFromFooter() {
  if (!isSelected.value) uiStore.toggleCardSelection(props.qNodeId, true)
  uiStore.openFib('consolidation')
}

function handleContinueBelow() {
  const lastCons = consolidationNodes.value[consolidationNodes.value.length - 1]
  const target   = lastCons ?? rNodes.value[rNodes.value.length - 1]
  if (!target) return
  uiStore.continueModel = null
  sessionStore.setBranchCtx(target.id)
  uiStore.openFib('normal')
}

function handleReconsolidate() {
  const s_ = s.value
  if (!s_) return
  const ids = new Set(consolidationNodes.value.map(n => n.id))
  s_.nodes = s_.nodes.filter(n => !ids.has(n.id))
  sessionStore.save()
  umcCollapsed.value = false
  uiStore.toggleCardSelection(props.qNodeId, true)
  uiStore.openFib('consolidation')
}

// ── UMC Peek Carousel ──
// R-node + Manual + Branch CC + Pending を全て carousel アイテムとして扱う
const cardRowRef = ref<HTMLElement | null>(null)
const cardIdx    = ref(0)
const carouselTotal = computed(() =>
  rNodes.value.length +
  manualNodes.value.length +
  branchQNodes.value.length +
  (showPendingPlaceholder.value ? 1 : 0)
)

// カードの実際のレンダリング幅 + gap をステップとして使う。
// CSS の min(360px, 80%) やネスト時の width:100% を JS で再計算せず、
// 常に DOM から読み取ることで任意のブレークポイントに追従する。
function cardStep(el: HTMLElement): number {
  const gap = depth.value > 0 ? 8 : 12
  const firstCard = el.children[0] as HTMLElement | null
  return firstCard ? firstCard.offsetWidth + gap : el.clientWidth + gap
}
function onCardScroll() {
  const el = cardRowRef.value
  if (!el || !el.clientWidth) return
  cardIdx.value = Math.round(el.scrollLeft / cardStep(el))
}
function scrollToCard(i: number) {
  const el = cardRowRef.value
  if (!el) return
  el.scrollTo({ left: i * cardStep(el), behavior: 'smooth' })
}

// このCCの結果を親とするメインスレッドQが既に存在するか
const hasNextQ = computed(() => {
  if (!s.value) return false
  const candidates = new Set<string>([
    ...consolidationNodes.value.map(n => n.id),
    ...(sigmaNode.value ? [sigmaNode.value.id] : []),
    ...rNodes.value.map(n => n.id),
    props.qNodeId,
  ])
  return s.value.nodes.some(n =>
    n.type === 'q' && !n._branch && n.parentId != null && candidates.has(n.parentId)
  )
})
</script>

<template>
  <!--
    composite-card が直接ルート要素。
    Branch CC はカルーセル内に umc-wrap--branch として入れ子になる。
    depth > 0 の CC はマウント時に自動折りたたみ。
  -->
  <div :class="['composite-card', depth > 0 && 'composite-card-nested', isComplete && 'cc-complete']">

    <!-- ヘッダー -->
    <div class="cc-header" @click="collapsed = !collapsed">
      <span class="cc-q-seq">Q{{ qSeq }}</span>
      <span class="cc-toggle">{{ collapsed ? '▶' : '▼' }}</span>
      <span class="cc-q-text">{{ qNode?.content ?? '' }}</span>

      <!-- ブランチQのみ: 親統合への包含チェックボックス -->
      <label
        v-if="isBranch"
        class="cc-sigma-cb"
        :class="{ 'cc-sigma-cb-pending': !isComplete }"
        :title="isComplete ? (qNode?._sigmaInclude ? T[lang].excludeFromSigma : T[lang].includeInSigma) : T[lang].processing"
        @click.stop
      >
        <input
          type="checkbox"
          :checked="!!qNode?._sigmaInclude"
          :disabled="!isComplete"
          @change="toggleSigmaInclude"
        />
        <span class="cc-sigma-cb-label">Σ</span>
      </label>

      <!-- カード選択チェックボックス（右端） -->
      <label class="cc-card-cb" :title="isComplete ? T[lang].selectForConsolidate : T[lang].processing" @click.stop>
        <input
          type="checkbox"
          :checked="isSelected"
          :disabled="!isComplete"
          @change="onCardCheckChange"
        />
      </label>
    </div>

    <!-- コンテンツ（折りたたみ可） -->
    <template v-if="!collapsed">

      <!-- UMCトグルバー: [▼ラベル] [中央:ドット] [右:+] -->
      <div class="cc-umc-toggle">
        <span
          class="cc-umc-toggle-left"
          @click="hasResults ? (umcCollapsed = !umcCollapsed) : null"
        >
          <span class="cc-umc-toggle-icon">{{ umcCollapsed ? '▶' : '▼' }}</span>
          <span class="cc-umc-toggle-label">
            {{ umcCollapsed ? `${T[lang].modelResponses} (${rNodes.length + branchQNodes.length})` : T[lang].modelResponses }}
          </span>
        </span>
        <div class="cc-umc-toggle-center">
          <template v-if="!umcCollapsed && carouselTotal > 1">
            <button
              v-for="(_, i) in carouselTotal"
              :key="i"
              class="cc-card-dot"
              :class="{ 'cc-card-dot-on': cardIdx === i }"
              @click.stop="scrollToCard(i)"
            />
          </template>
        </div>
        <div class="cc-umc-toggle-right" @click.stop>
          <AddCard :q-node-id="qNodeId" />
        </div>
      </div>

      <!-- ── UMC Peek Carousel ── -->
      <div v-if="!umcCollapsed" class="cc-carousel-wrap">
        <!-- オーバーレイアロー -->
        <button
          v-if="cardIdx > 0"
          class="cc-arrow-overlay cc-arrow-overlay--left"
          @click="scrollToCard(cardIdx - 1)"
        ><span class="material-icons">chevron_left</span></button>
        <button
          v-if="cardIdx < carouselTotal - 1"
          class="cc-arrow-overlay cc-arrow-overlay--right"
          @click="scrollToCard(cardIdx + 1)"
        ><span class="material-icons">chevron_right</span></button>

        <div
          class="cc-card-row"
          ref="cardRowRef"
          @scroll.passive="onCardScroll"
        >
          <!-- R-node カード -->
          <UniModelCard
            v-for="r in rNodes"
            :key="r.id"
            :node="r"
            :q-content="qNode?.content"
          />
          <!-- 手動コンテキストカード -->
          <ManualContextCard
            v-for="m in manualNodes"
            :key="m.id"
            :node="m"
          />
          <!-- Branch CC（カルーセル内ネスト、デフォルト折りたたみ） -->
          <div
            v-for="bq in branchQNodes"
            :key="bq.id"
            class="umc-wrap umc-wrap--branch"
          >
            <CompositeCard :q-node-id="bq.id" :depth="depth + 1" />
          </div>
          <!-- 入力待ちプレースホルダー -->
          <div v-if="showPendingPlaceholder" class="umc-wrap">
            <div class="cc-pending-card">{{ T[lang].pendingInput }}</div>
          </div>
        </div>
      </div>

      <!-- 結果エリア（sigma + consolidation） -->
      <div v-if="sigmaNode || consolidationNodes.length" class="cc-results-area">
        <SigmaBlock v-if="sigmaNode" :node="sigmaNode" :q-id="qNodeId" />
        <ConsolidationBlock
          v-for="c in consolidationNodes"
          :key="c.id"
          :node="c"
          :q-seq="qSeq"
        />
        <!-- 統合再実行ボタン -->
        <div
          v-if="consolidationNodes.length && !rNodes.some(r => activeStreamIds.has(r.id))"
          class="cc-reconsolidate-bar"
        >
          <button class="cc-reconsolidate-btn" @click="handleReconsolidate">
            <span class="material-icons" style="font-size:14px;vertical-align:middle">replay</span>
            {{ T[lang].reconsolidate }}
          </button>
        </div>
      </div>

      <!-- A エリア -->
      <div v-if="isComplete && !consolidationNodes.length && !sigmaNode" class="cc-answer-bar">
        <span class="cc-a-badge">A{{ qSeq }}</span>
        <button class="cc-consolidate-btn" @click="handleConsolidateFromFooter">
          ⇒ {{ T[lang].consolidateResponses }}
        </button>
      </div>

    </template>
  </div>

  <!-- 続けて質問ボタン（depth=0・統合済み・続きがまだない場合のみ） -->
  <div
    v-if="depth === 0 && isComplete && consolidationNodes.length && !hasNextQ"
    class="cc-continue-below"
  >
    <button class="cc-continue-btn" @click="handleContinueBelow">
      ➕ {{ T[lang].continueAsking }}
    </button>
  </div>
</template>
