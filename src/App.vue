<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import Sidebar from '@/components/layout/Sidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import ChatView from '@/components/chat/ChatView.vue'
import FloatingInputBar from '@/components/input/FloatingInputBar.vue'
import SettingsModal from '@/components/dialogs/SettingsModal.vue'
import MergeDialog from '@/components/dialogs/MergeDialog.vue'
import IntroOverlay from '@/components/dialogs/IntroOverlay.vue'
import CtxLogPanel from '@/components/layout/CtxLogPanel.vue'

const uiStore = useUiStore()
const sessionStore = useSessionStore()

watch(() => sessionStore.currentSessId, () => uiStore.clearCtxLog())

const settingsOpen = ref(false)
const mergeOpen = ref(false)

const topBarRef = ref<InstanceType<typeof TopBar> | null>(null)
const floatingInputRef = ref<InstanceType<typeof FloatingInputBar> | null>(null)
const mergeDialogRef = ref<InstanceType<typeof MergeDialog> | null>(null)

function onSettingsSaved() {
  topBarRef.value?.loadModels()
  topBarRef.value?.refreshCloudStatus()
}

function openMergeDialog() {
  mergeDialogRef.value?.resetState()
  mergeOpen.value = true
}
</script>

<template>
  <Sidebar @open-settings="settingsOpen = true" />
  <div id="main">
    <TopBar ref="topBarRef" />
    <ChatView />
    <FloatingInputBar ref="floatingInputRef" @open-merge-dialog="openMergeDialog" />
  </div>
  <CtxLogPanel v-if="uiStore.ctxLogOpen" />
  <SettingsModal v-model:open="settingsOpen" @saved="onSettingsSaved" />
  <MergeDialog ref="mergeDialogRef" v-model:open="mergeOpen" />
  <IntroOverlay @saved="onSettingsSaved" />
  <div id="toast" :class="{ show: uiStore.toastVisible }">{{ uiStore.toastMsg }}</div>
</template>
