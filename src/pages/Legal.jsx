import { Link } from 'react-router-dom'

const COPY = {
  privacy: {
    titleZh: '私隱政策',
    titleId: 'Kebijakan Privasi',
    bodyZh: [
      '屋企家務通（Halo Kakak）收集你嘅電郵、家庭成員關係、家務任務內容同狀態，用嚟提供雙語家務管理服務。',
      '翻譯請求會經我哋受保護嘅伺服器傳送至第三方翻譯服務；我哋唔會刻意將用戶或家庭識別碼傳送畀翻譯供應商。',
      '請勿喺任務入面輸入密碼、銀行資料或身份證號碼。',
      '你可以匯出可存取資料、要求刪除帳戶，或喺合適情況下離開家庭。',
      '資料存放於 Supabase（雲端資料庫），傳輸使用 HTTPS。',
    ],
    bodyId: [
      'Halo Kakak mengumpulkan email, hubungan anggota rumah tangga, serta isi dan status tugas untuk layanan manajemen rumah tangga dwibahasa.',
      'Permintaan terjemahan dikirim melalui server terlindungi ke layanan pihak ketiga; kami tidak sengaja mengirim ID pengguna atau rumah tangga ke penyedia terjemahan.',
      'Jangan masukkan kata sandi, data bank, atau nomor identitas dalam tugas.',
      'Anda dapat mengekspor data yang dapat diakses, meminta penghapusan akun, atau meninggalkan rumah tangga bila sesuai.',
      'Data disimpan di Supabase dan ditransmisikan melalui HTTPS.',
    ],
  },
  pics: {
    titleZh: '個人資料收集聲明（PICS）',
    titleId: 'Pernyataan Pengumpulan Data Pribadi (PICS)',
    bodyZh: [
      '目的：營運雙語家務任務系統、身份驗證、家庭邀請同成員管理。',
      '類別：電郵、顯示名稱、電話（如有）、任務文字、狀態變更、同意紀錄。',
      '自願提供：拒絕提供電郵將無法登入。',
      '查閱同更正：可於應用「設定」匯出資料或更新顯示名稱；進一步要求請聯絡營運者。',
    ],
    bodyId: [
      'Tujuan: mengoperasikan sistem tugas dwibahasa, autentikasi, undangan, dan manajemen anggota.',
      'Kategori: email, nama tampilan, telepon (jika ada), teks tugas, perubahan status, catatan persetujuan.',
      'Sifat sukarela: tanpa email Anda tidak dapat masuk.',
      'Akses dan koreksi: ekspor data atau perbarui nama di Pengaturan; permintaan lanjutan hubungi operator.',
    ],
  },
  terms: {
    titleZh: '服務條款',
    titleId: 'Syarat Layanan',
    bodyZh: [
      '本應用係家庭內部協作工具，唔構成僱傭法律意見。',
      '機器翻譯可能有錯；重要或高風險指示（藥物、幼兒安全等）必須由人核對。',
      '用戶有責任確保分享內容合法，同尊重家庭傭工私隱。',
      '我們可不時更新服務；重大變更會盡量喺應用內通知。',
    ],
    bodyId: [
      'Aplikasi ini adalah alat kolaborasi rumah tangga dan bukan nasihat hukum ketenagakerjaan.',
      'Terjemahan mesin dapat salah; instruksi penting atau berisiko tinggi harus diverifikasi manusia.',
      'Pengguna bertanggung jawab atas legalitas konten dan menghormati privasi pekerja rumah tangga.',
      'Kami dapat memperbarui layanan; perubahan penting akan diinformasikan di aplikasi sejauh mungkin.',
    ],
  },
}

export default function Legal({ kind }) {
  const c = COPY[kind]
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Link to="/" className="text-sm text-teal-800 underline">
        ← Back
      </Link>
      <h1 lang="zh-Hant" className="text-2xl font-bold">
        {c.titleZh}
      </h1>
      <p lang="id" className="text-slate-500">
        {c.titleId}
      </p>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed">
        {c.bodyZh.map((p, i) => (
          <div key={i}>
            <p lang="zh-Hant">{p}</p>
            <p lang="id" className="mt-1 text-slate-600">
              {c.bodyId[i]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
