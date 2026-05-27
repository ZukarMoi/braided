import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig } from '@/types'

const DEF: AppConfig = {
  ollama:      { url: 'http://localhost:11434', unloadAfter: false, contextLimitChars: 0 },
  lmstudio:    { url: 'http://localhost:1234', contextLimitChars: 0 },
  anythingllm: { url: 'http://localhost:3001', apiKey: '' },
  openai:      { apiKey: '' },
  anthropic:   { apiKey: '' },
  gemini:      { apiKey: '' },
  grok:        { apiKey: '' },
  vault:       { path: '', autoSync: false },
}

export const useSettingsStore = defineStore('settings', () => {
  const cfg = ref<AppConfig>({ ...DEF })

  function save(next: AppConfig) {
    // DEF とマージして欠損フィールドを補完
    cfg.value = {
      ollama:      { ...DEF.ollama,      ...next.ollama,   contextLimitChars: next.ollama?.contextLimitChars ?? 0 },
      lmstudio:    { ...DEF.lmstudio,    ...next.lmstudio, contextLimitChars: next.lmstudio?.contextLimitChars ?? 0 },
      anythingllm: { ...DEF.anythingllm, ...next.anythingllm },
      openai:      { ...DEF.openai,      ...next.openai },
      anthropic:   { ...DEF.anthropic,   ...next.anthropic },
      gemini:      { ...DEF.gemini,      ...next.gemini },
      grok:        { ...DEF.grok,        ...next.grok },
      vault:       { ...DEF.vault,       ...next.vault },
    }
    fetch('/api/vault/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cfg.value.vault.path, autoSync: cfg.value.vault.autoSync }),
    }).catch(() => {})
  }

  const ollamaUrl      = computed(() => cfg.value.ollama.url)
  const lmstudioUrl    = computed(() => cfg.value.lmstudio.url)
  const anythingllmUrl = computed(() => cfg.value.anythingllm.url)
  const vaultPath      = computed(() => cfg.value.vault.path)
  const vaultAutoSync  = computed(() => cfg.value.vault.autoSync)

  return { cfg, save, ollamaUrl, lmstudioUrl, anythingllmUrl, vaultPath, vaultAutoSync }
})
