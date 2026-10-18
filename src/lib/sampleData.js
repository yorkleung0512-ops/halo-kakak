export const DEFAULT_ROOM = 'HOME-888'

export function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const SAMPLE_ROUTINES = [
  {
    id: 'r1',
    time: '07:00',
    zh: '準備早餐',
    idText: 'Siapkan sarapan',
    done: false,
  },
  {
    id: 'r2',
    time: '08:00',
    zh: '清潔客廳同抹地',
    idText: 'Bersihkan ruang tamu dan pel lantai',
    done: false,
  },
  {
    id: 'r3',
    time: '10:00',
    zh: '買餸／買菜',
    idText: 'Belanja bahan makanan / sayur',
    done: false,
  },
  {
    id: 'r4',
    time: '12:00',
    zh: '準備午餐同洗碗',
    idText: 'Siapkan makan siang dan cuci piring',
    done: false,
  },
  {
    id: 'r5',
    time: '15:00',
    zh: '洗衫同晾衫',
    idText: 'Cuci baju dan jemur baju',
    done: false,
  },
  {
    id: 'r6',
    time: '17:30',
    zh: '準備晚餐／煲湯',
    idText: 'Siapkan makan malam / masak sup',
    done: false,
  },
  {
    id: 'r7',
    time: '20:00',
    zh: '執屋同倒垃圾',
    idText: 'Rapikan rumah dan buang sampah',
    done: false,
  },
]

export const SAMPLE_TASKS = [
  {
    id: 't1',
    zh: '今日去百佳買鮮奶',
    idText: 'Hari ini pergi ke ParknShop beli susu segar',
    urgent: true,
    done: false,
    doneAt: null,
  },
  {
    id: 't2',
    zh: '洗冷氣機隔塵網',
    idText: 'Cuci filter AC / saringan debu',
    urgent: false,
    done: false,
    doneAt: null,
  },
  {
    id: 't3',
    zh: '換床單同摺被',
    idText: 'Ganti sprei dan rapikan tempat tidur',
    urgent: false,
    done: false,
    doneAt: null,
  },
]
