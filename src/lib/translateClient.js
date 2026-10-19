import { supabase } from './supabase'
import { HK_DICT } from './constants'

/**
 * Call authenticated Edge Function only — never MyMemory from the browser.
 * glossary: [{ chinese_term, indonesian_term }]
 */
export async function translateViaEdge(text, glossary = []) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { translated: '', machineGenerated: false }

  // Exact local dictionary hit (still mark as machine until employer approves)
  if (HK_DICT[trimmed] && !glossary.some((g) => g.chinese_term === trimmed)) {
    return { translated: HK_DICT[trimmed], machineGenerated: true, source: 'dict' }
  }

  const { data, error } = await supabase.functions.invoke('translate', {
    body: {
      text: trimmed,
      glossary: glossary.map((g) => ({
        zh: g.chinese_term,
        id: g.indonesian_term,
      })),
    },
  })

  if (error) {
    throw new Error(error.message || 'translation_failed')
  }

  return {
    translated: data?.translated || '',
    machineGenerated: true,
    source: data?.source || 'edge',
    warning: data?.warning || null,
  }
}

export function speakIndonesian(text) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'id-ID'
  u.rate = 0.95
  const voices = window.speechSynthesis.getVoices()
  const idVoice = voices.find((v) => v.lang?.startsWith('id'))
  if (idVoice) u.voice = idVoice
  window.speechSynthesis.speak(u)
}

export function applyGlossaryHints(text, glossary = []) {
  let out = text
  const entries = [
    ...Object.entries(HK_DICT).map(([zh, id]) => ({ zh, id })),
    ...glossary.map((g) => ({ zh: g.chinese_term, id: g.indonesian_term })),
  ].sort((a, b) => b.zh.length - a.zh.length)

  for (const { zh, id } of entries) {
    if (zh && out.includes(zh)) {
      out = out.split(zh).join(id)
    }
  }
  return out
}
