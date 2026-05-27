<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import type { BraidedNode } from '@/types'
import { T } from '@/i18n'

const props = defineProps<{ node: BraidedNode }>()

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const lang = computed(() => uiStore.lang)

const isExcluded = computed(() => !!props.node.excluded)
const checkboxValue = computed(() => !isExcluded.value)

function onCheckboxChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const s = sessionStore.curSess
  if (!s) return
  const live = sessionStore.getNode(s, props.node.id)
  if (!live) return
  live.excluded = !checked
  sessionStore.save()
}

// 編集
const editing = ref(false)
const editText = ref('')

function startEdit() {
  editText.value = props.node.content
  editing.value = true
}

function saveEdit() {
  const s = sessionStore.curSess
  if (!s) return
  const live = sessionStore.getNode(s, props.node.id)
  if (live) { live.content = editText.value.trim(); sessionStore.save() }
  editing.value = false
}

// コピー
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.node.content ?? '')
    uiStore.toast(T[lang.value].copySuccess)
  } catch { uiStore.toast(T[lang.value].copyFail) }
}

// ダウンロード
function handleDownload() {
  const blob = new Blob([props.node.content ?? ''], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'context.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

// 削除
function handleDelete() {
  const s = sessionStore.curSess
  if (!s) return
  const idx = s.nodes.findIndex(n => n.id === props.node.id)
  if (idx >= 0) s.nodes.splice(idx, 1)
  sessionStore.save()
}
</script>

<template>
  <div class="umc-wrap">
    <div :class="['uni-model-card', isExcluded && 'umc-excluded']">

      <!-- ヘッダー -->
      <div class="umc-head">
        <span class="material-icons" style="font-size:14px;color:#0ea5e9;margin-right:3px">article</span>
        <span class="umc-model-name">{{ T[lang].manualContextTitle }}</span>
        <span class="umc-prov-badge" style="background:#0ea5e9">manual</span>
        <div class="umc-head-spacer"></div>
        <input
          type="checkbox"
          class="umc-cb"
          :checked="checkboxValue"
          :title="T[lang].includeInCtx"
          @change="onCheckboxChange"
        />
      </div>

      <!-- ボディ（通常表示 / 編集中） -->
      <div v-if="!editing" class="umc-body" style="white-space:pre-wrap;word-break:break-word">{{ node.content }}</div>
      <div v-else class="umc-manual-edit">
        <textarea
          v-model="editText"
          class="umc-manual-textarea"
          rows="5"
          @keydown.ctrl.enter.prevent="saveEdit"
          @keydown.meta.enter.prevent="saveEdit"
        ></textarea>
        <div class="umc-manual-edit-actions">
          <button class="umc-manual-save" @click="saveEdit">{{ T[lang].saveBtn }}</button>
          <button class="umc-manual-cancel" @click="editing = false">{{ T[lang].cancelBtn }}</button>
        </div>
      </div>

      <!-- フッター -->
      <div class="umc-foot">
        <template v-if="!editing && node.content">
          <button class="umc-icon-btn" :title="T[lang].copy" @click="handleCopy">
            <span class="material-icons">content_copy</span>
          </button>
          <button class="umc-icon-btn" :title="T[lang].edit" @click="startEdit">
            <span class="material-icons">edit</span>
          </button>
          <button class="umc-icon-btn" :title="T[lang].download" @click="handleDownload">
            <span class="material-icons">download</span>
          </button>
          <button class="umc-icon-btn umc-del-btn" :title="T[lang].deleteBtn" @click="handleDelete">
            <span class="material-icons">delete</span>
          </button>
        </template>
        <template v-else-if="editing">
          <!-- 編集中はフッター非表示 -->
        </template>
      </div>
    </div>
  </div>
</template>
