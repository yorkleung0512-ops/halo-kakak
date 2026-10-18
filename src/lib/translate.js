/** Common HK household Cantonese → Bahasa Indonesia hints */
export const HK_DICT = {
  買餸: 'Belanja bahan makanan',
  煲湯: 'Masak sup',
  抹地: 'Pel lantai',
  掃地: 'Sapu lantai',
  拖地: 'Pel lantai',
  執房: 'Rapikan kamar',
  執屋: 'Rapikan rumah',
  洗衫: 'Cuci baju',
  晾衫: 'Jemur baju',
  熨衫: 'Setrika baju',
  洗碗: 'Cuci piring',
  煮晚飯: 'Masak makan malam',
  煮早餐: 'Masak sarapan',
  準備早餐: 'Siapkan sarapan',
  準備晚餐: 'Siapkan makan malam',
  湊小朋友: 'Jaga anak',
  接送小朋友: 'Antar jemput anak',
  百佳: 'ParknShop',
  惠康: 'Wellcome',
  隔塵網: 'Filter AC / saringan debu',
  洗冷氣: 'Cuci AC',
  洗廁所: 'Bersihkan toilet',
  抹窗: 'Bersihkan jendela',
  倒垃圾: 'Buang sampah',
  摺被: 'Rapikan tempat tidur',
  換床單: 'Ganti sprei',
  餵狗: 'Beri makan anjing',
  餵貓: 'Beri makan kucing',
  曬被: 'Jemur selimut',
  買鮮奶: 'Beli susu segar',
  買菜: 'Belanja sayur',
  清潔客廳: 'Bersihkan ruang tamu',
  清潔廚房: 'Bersihkan dapur',
  清潔浴室: 'Bersihkan kamar mandi',
}

function applyDictHints(text) {
  let out = text
  const hints = []
  for (const [zh, id] of Object.entries(HK_DICT)) {
    if (out.includes(zh)) {
      hints.push({ zh, id })
    }
  }
  return { text: out, hints }
}

/**
 * Translate Cantonese / Traditional Chinese to Bahasa Indonesia.
 * Uses MyMemory free API + HK household dictionary overlay.
 */
export async function translateToIndonesian(zhText) {
  const trimmed = (zhText || '').trim()
  if (!trimmed) return ''

  const { hints } = applyDictHints(trimmed)

  // Exact dictionary hit
  if (HK_DICT[trimmed]) return HK_DICT[trimmed]

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=zh-TW|id`
    const res = await fetch(url)
    const data = await res.json()
    let translated = data?.responseData?.translatedText || ''

    // Overlay known HK terms if translation looks weak
    for (const { zh, id } of hints) {
      if (translated && !translated.toLowerCase().includes(id.split(' ')[0].toLowerCase())) {
        // Append hint clarification when API misses colloquialism
        translated = translated.replace(new RegExp(zh, 'g'), id)
      }
    }

    // If still empty or same as source, build from hints
    if (!translated || translated === trimmed) {
      if (hints.length) {
        return hints.map((h) => h.id).join('; ')
      }
      return trimmed
    }

    return translated
  } catch {
    if (hints.length) return hints.map((h) => h.id).join('; ')
    return trimmed
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
