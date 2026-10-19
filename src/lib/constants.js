export const POLICY_VERSION = '2026-10-19'

export const STATUS_LABELS = {
  pending: { zh: '待處理', id: 'Menunggu', icon: '○' },
  acknowledged: { zh: '已明白', id: 'Mengerti', icon: '✓' },
  in_progress: { zh: '進行中', id: 'Sedang dikerjakan', icon: '▶' },
  needs_clarification: { zh: '有問題', id: 'Perlu penjelasan', icon: '?' },
  cannot_complete: { zh: '做不到', id: 'Tidak dapat diselesaikan', icon: '✕' },
  delayed: { zh: '會遲完成', id: 'Akan terlambat', icon: '⏱' },
  completed: { zh: '已完成', id: 'Selesai', icon: '✔' },
  cancelled: { zh: '已取消', id: 'Dibatalkan', icon: '—' },
}

export const HELPER_ACTIONS = [
  { status: 'acknowledged', zh: '明白', id: 'Mengerti', needsComment: false },
  { status: 'in_progress', zh: '開始', id: 'Mulai', needsComment: false },
  { status: 'needs_clarification', zh: '有問題', id: 'Perlu penjelasan', needsComment: true },
  { status: 'cannot_complete', zh: '做不到', id: 'Tidak dapat diselesaikan', needsComment: true },
  { status: 'delayed', zh: '會遲完成', id: 'Akan terlambat', needsComment: true },
  { status: 'completed', zh: '完成', id: 'Selesai', needsComment: false },
]

export const OFFLINE_MSG = {
  zh: '尚未同步。資料已保存在此裝置，網絡恢復後會自動傳送。',
  id: 'Belum tersinkron. Data tersimpan di perangkat ini dan akan dikirim saat koneksi kembali.',
}

export const TRANSLATION_PRIVACY_NOTICE = {
  zh: '翻譯會經由受保護嘅伺服器傳送至第三方翻譯服務。請勿輸入密碼、銀行資料或身份證號碼。機器翻譯可能唔準確，重要指示請自行核對。',
  id: 'Terjemahan dikirim melalui server terlindungi ke layanan terjemahan pihak ketiga. Jangan masukkan kata sandi, data bank, atau nomor identitas. Terjemahan mesin mungkin tidak akurat; harap periksa instruksi penting sendiri.',
}

export const HIGH_RISK_WARNING = {
  zh: '⚠️ 呢個指示可能涉及藥物、過敏、幼兒安全、煮食溫度或緊急情況。請僱主同姐姐一齊確認意思，唔好單靠機器翻譯。',
  id: '⚠️ Instruksi ini mungkin terkait obat, alergi, keselamatan anak, suhu memasak, atau keadaan darurat. Majikan dan kakak harap konfirmasi bersama; jangan mengandalkan terjemahan mesin saja.',
}

/** Keywords that trigger high-risk warning (zh + id + en stems) */
export const HIGH_RISK_KEYWORDS = [
  '藥', '藥物', '吃藥', '服藥', '過敏', 'BB', '嬰兒', '寶寶', '小朋友', '細路', '幼兒', '童',
  '溫度', '煮滾', '滾水', '燙', '火燭', '緊急', '急救', '119', '999', '消防',
  'obat', 'alergi', 'bayi', 'anak', 'suhu', 'darurat', 'emergency', 'medication',
  'allergy', 'baby', 'child', 'temperature', 'urgent',
]

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

export const AUTH_ERRORS = {
  'Invalid login credentials': {
    zh: '登入資料無效，請再試。',
    id: 'Kredensial tidak valid. Coba lagi.',
  },
  'Email rate limit exceeded': {
    zh: '發送太頻繁，請稍後再試。',
    id: 'Terlalu sering mengirim email. Coba lagi nanti.',
  },
  'otp_expired': {
    zh: '連結已過期，請重新索取登入電郵。',
    id: 'Tautan kedaluwarsa. Minta email masuk lagi.',
  },
  'Token has expired or is invalid': {
    zh: '登入連結已過期或無效。',
    id: 'Tautan masuk kedaluwarsa atau tidak valid.',
  },
  default: {
    zh: '登入失敗，請稍後再試。',
    id: 'Gagal masuk. Coba lagi nanti.',
  },
}

export function mapAuthError(err, lang = 'zh') {
  const msg = err?.message || String(err || '')
  for (const [key, val] of Object.entries(AUTH_ERRORS)) {
    if (key !== 'default' && msg.toLowerCase().includes(key.toLowerCase())) {
      return val[lang === 'id' ? 'id' : 'zh']
    }
  }
  return AUTH_ERRORS.default[lang === 'id' ? 'id' : 'zh']
}

export function todayHK() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatTimeHK(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('zh-HK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Hong_Kong',
    })
  } catch {
    return ''
  }
}

export function isHighRisk(text) {
  const t = (text || '').toLowerCase()
  return HIGH_RISK_KEYWORDS.some((k) => t.includes(k.toLowerCase()))
}
