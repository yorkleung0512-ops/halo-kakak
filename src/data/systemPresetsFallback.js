/** Offline fallback cache for public system presets only (not household). */
export const FALLBACK_CATEGORIES = [
  {
    "key": "cooking",
    "name_zh": "煮食及用餐",
    "name_id": "Memasak dan Makan",
    "icon": "Utensils",
    "sort_order": 1
  },
  {
    "key": "cleaning",
    "name_zh": "清潔",
    "name_id": "Kebersihan",
    "icon": "Sparkles",
    "sort_order": 2
  },
  {
    "key": "laundry",
    "name_zh": "洗衣及衣物",
    "name_id": "Cucian dan Pakaian",
    "icon": "Shirt",
    "sort_order": 3
  },
  {
    "key": "shopping",
    "name_zh": "買餸及採購",
    "name_id": "Belanja",
    "icon": "ShoppingCart",
    "sort_order": 4
  },
  {
    "key": "baby",
    "name_zh": "嬰兒照顧",
    "name_id": "Perawatan Bayi",
    "icon": "Baby",
    "sort_order": 5
  },
  {
    "key": "childcare",
    "name_zh": "小朋友照顧",
    "name_id": "Perawatan Anak",
    "icon": "Users",
    "sort_order": 6
  },
  {
    "key": "transport",
    "name_zh": "接送及外出",
    "name_id": "Antar Jemput dan Keluar Rumah",
    "icon": "Car",
    "sort_order": 7
  },
  {
    "key": "elderly",
    "name_zh": "長者照顧",
    "name_id": "Perawatan Lansia",
    "icon": "HeartHandshake",
    "sort_order": 8
  },
  {
    "key": "pets",
    "name_zh": "寵物照顧",
    "name_id": "Perawatan Hewan Peliharaan",
    "icon": "PawPrint",
    "sort_order": 9
  },
  {
    "key": "maintenance",
    "name_zh": "家居保養",
    "name_id": "Perawatan Rumah",
    "icon": "Wrench",
    "sort_order": 10
  },
  {
    "key": "special",
    "name_zh": "特別及臨時工作",
    "name_id": "Tugas Khusus",
    "icon": "Star",
    "sort_order": 11
  },
  {
    "key": "mine",
    "name_zh": "我的範本",
    "name_id": "Template Saya",
    "icon": "Bookmark",
    "sort_order": 12
  }
]

export const FALLBACK_SYSTEM_PRESETS = [
  {
    "system_key": "cooking_breakfast",
    "category_key": "cooking",
    "title_zh": "準備早餐",
    "title_id": "Siapkan sarapan",
    "instructions_zh": "按照平日習慣準備早餐，注意小朋友過敏。",
    "instructions_id": "Siapkan sarapan sesuai kebiasaan harian; perhatikan alergi anak.",
    "suggested_task_type": "scheduled",
    "suggested_time": "07:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "早餐",
      "sarapan"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "cooking_lunch",
    "category_key": "cooking",
    "title_zh": "準備午餐",
    "title_id": "Siapkan makan siang",
    "instructions_zh": "準備簡單午餐，剩菜請妥善存放雪櫃。",
    "instructions_id": "Siapkan makan siang sederhana; simpan sisa di kulkas.",
    "suggested_task_type": "scheduled",
    "suggested_time": "12:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "午餐",
      "makan siang"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "cooking_dinner",
    "category_key": "cooking",
    "title_zh": "準備晚餐",
    "title_id": "Siapkan makan malam",
    "instructions_zh": "按僱主指示準備晚餐，注意火同油溫。",
    "instructions_id": "Siapkan makan malam sesuai instruksi majikan; hati-hati api dan minyak panas.",
    "suggested_task_type": "scheduled",
    "suggested_time": "18:30",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "晚餐",
      "makan malam"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "cooking_soup",
    "category_key": "cooking",
    "title_zh": "煲湯",
    "title_id": "Masak sup",
    "instructions_zh": "按食譜煲湯，完成後關火並蓋好。",
    "instructions_id": "Masak sup sesuai resep; matikan api dan tutup setelah selesai.",
    "suggested_task_type": "scheduled",
    "suggested_time": "16:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "煲湯",
      "sup"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "cooking_dishes",
    "category_key": "cooking",
    "title_zh": "洗碗同執枱",
    "title_id": "Cuci piring dan rapikan meja",
    "instructions_zh": "洗碗、抹枱、收拾廚房垃圾。",
    "instructions_id": "Cuci piring, lap meja, buang sampah dapur.",
    "suggested_task_type": "scheduled",
    "suggested_time": "19:30",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "洗碗",
      "piring"
    ],
    "sort_order": 50,
    "source": "system"
  },
  {
    "system_key": "cleaning_living",
    "category_key": "cleaning",
    "title_zh": "清潔客廳",
    "title_id": "Bersihkan ruang tamu",
    "instructions_zh": "掃地、拖地、抹枱同整理沙發墊。",
    "instructions_id": "Sapu, pel, lap meja, dan rapikan bantal sofa.",
    "suggested_task_type": "scheduled",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "客廳",
      "ruang tamu"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "cleaning_kitchen",
    "category_key": "cleaning",
    "title_zh": "清潔廚房",
    "title_id": "Bersihkan dapur",
    "instructions_zh": "清潔爐頭、枱面同洗碗盆，倒垃圾。",
    "instructions_id": "Bersihkan kompor, meja, wastafel; buang sampah.",
    "suggested_task_type": "scheduled",
    "suggested_time": "11:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "廚房",
      "dapur"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "cleaning_bathroom",
    "category_key": "cleaning",
    "title_zh": "清潔浴室",
    "title_id": "Bersihkan kamar mandi",
    "instructions_zh": "清潔廁所、洗手盆同淋浴間，補充紙巾。",
    "instructions_id": "Bersihkan toilet, wastafel, dan shower; isi tisu.",
    "suggested_task_type": "scheduled",
    "suggested_time": "14:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "浴室",
      "kamar mandi"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "cleaning_floor",
    "category_key": "cleaning",
    "title_zh": "掃地拖地",
    "title_id": "Sapu dan pel lantai",
    "instructions_zh": "全屋掃地後拖地，注意濕滑。",
    "instructions_id": "Sapu seluruh rumah lalu pel; hati-hati lantai basah.",
    "suggested_task_type": "scheduled",
    "suggested_time": "09:30",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "拖地",
      "pel"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "cleaning_windows",
    "category_key": "cleaning",
    "title_zh": "抹窗",
    "title_id": "Bersihkan jendela",
    "instructions_zh": "抹內窗同窗台，唔好站出窗外。",
    "instructions_id": "Bersihkan jendela dalam dan ambang; jangan berdiri di luar jendela.",
    "suggested_task_type": "adhoc",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "抹窗",
      "jendela"
    ],
    "sort_order": 50,
    "source": "system"
  },
  {
    "system_key": "cleaning_trash",
    "category_key": "cleaning",
    "title_zh": "倒垃圾",
    "title_id": "Buang sampah",
    "instructions_zh": "將垃圾桶袋紮好拎落樓下垃圾房。",
    "instructions_id": "Ikat kantong sampah dan buang ke tempat sampah gedung.",
    "suggested_task_type": "scheduled",
    "suggested_time": "20:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "垃圾",
      "sampah"
    ],
    "sort_order": 60,
    "source": "system"
  },
  {
    "system_key": "laundry_wash",
    "category_key": "laundry",
    "title_zh": "洗衫",
    "title_id": "Cuci baju",
    "instructions_zh": "分開顏色同白衫，按標籤溫度清洗。",
    "instructions_id": "Pisahkan warna dan putih; cuci sesuai label suhu.",
    "suggested_task_type": "scheduled",
    "suggested_time": "09:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "洗衫",
      "cuci"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "laundry_dry",
    "category_key": "laundry",
    "title_zh": "晾衫／乾衣",
    "title_id": "Jemur / keringkan baju",
    "instructions_zh": "晾衫或放入乾衣機，完成後執好。",
    "instructions_id": "Jemur atau masukkan dryer; rapikan setelah selesai.",
    "suggested_task_type": "scheduled",
    "suggested_time": "11:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "晾衫",
      "jemur"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "laundry_iron",
    "category_key": "laundry",
    "title_zh": "熨衫",
    "title_id": "Setrika baju",
    "instructions_zh": "熨恤衫同校服，注意溫度設定。",
    "instructions_id": "Setrika kemeja dan seragam; perhatikan suhu setrika.",
    "suggested_task_type": "scheduled",
    "suggested_time": "15:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "熨衫",
      "setrika"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "laundry_bed",
    "category_key": "laundry",
    "title_zh": "換床單",
    "title_id": "Ganti sprei",
    "instructions_zh": "更換床單同枕頭套，舊嘅放入洗衣籃。",
    "instructions_id": "Ganti sprei dan sarung bantal; masukkan yang kotor ke keranjang.",
    "suggested_task_type": "scheduled",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "床單",
      "sprei"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "laundry_fold",
    "category_key": "laundry",
    "title_zh": "摺衫同收納",
    "title_id": "Lipat dan simpan baju",
    "instructions_zh": "乾衣後摺好放入衣櫃。",
    "instructions_id": "Setelah kering, lipat dan simpan ke lemari.",
    "suggested_task_type": "scheduled",
    "suggested_time": "16:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "摺衫",
      "lipat"
    ],
    "sort_order": 50,
    "source": "system"
  },
  {
    "system_key": "shopping_groceries",
    "category_key": "shopping",
    "title_zh": "買餸",
    "title_id": "Belanja bahan makanan",
    "instructions_zh": "按購物清單去超市買餸，保留單據。",
    "instructions_id": "Belanja sesuai daftar belanja; simpan struk.",
    "suggested_task_type": "scheduled",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "買餸",
      "belanja"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "shopping_milk",
    "category_key": "shopping",
    "title_zh": "買鮮奶同麵包",
    "title_id": "Beli susu segar dan roti",
    "instructions_zh": "買指定牌子鮮奶同麵包，注意到期日。",
    "instructions_id": "Beli susu dan roti merek yang diminta; cek tanggal kedaluwarsa.",
    "suggested_task_type": "scheduled",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "鮮奶",
      "susu"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "shopping_household",
    "category_key": "shopping",
    "title_zh": "買日用品",
    "title_id": "Beli kebutuhan rumah",
    "instructions_zh": "補充清潔劑、廁紙等同日用品。",
    "instructions_id": "Isi ulang pembersih, tisu toilet, dan kebutuhan rumah.",
    "suggested_task_type": "adhoc",
    "suggested_time": "11:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "日用品",
      "kebutuhan"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "shopping_market",
    "category_key": "shopping",
    "title_zh": "去街市買菜",
    "title_id": "Belanja di pasar tradisional",
    "instructions_zh": "買新鮮蔬菜同肉類，注意衛生。",
    "instructions_id": "Beli sayur dan daging segar; jaga kebersihan.",
    "suggested_task_type": "scheduled",
    "suggested_time": "09:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "街市",
      "pasar"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "baby_feed",
    "category_key": "baby",
    "title_zh": "餵嬰兒奶",
    "title_id": "Beri susu bayi",
    "instructions_zh": "按指示沖奶同餵奶，確認溫度後先餵。必須僱主確認。",
    "instructions_id": "Siapkan dan beri susu sesuai instruksi; pastikan suhu aman. Harus dikonfirmasi majikan.",
    "suggested_task_type": "scheduled",
    "suggested_time": "06:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "嬰兒",
      "bayi",
      "奶"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "baby_diaper",
    "category_key": "baby",
    "title_zh": "換尿片",
    "title_id": "Ganti popok",
    "instructions_zh": "按需要換尿片，洗手同清潔雙手。",
    "instructions_id": "Ganti popok sesuai kebutuhan; cuci tangan dengan bersih.",
    "suggested_task_type": "scheduled",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "尿片",
      "popok"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "baby_bath",
    "category_key": "baby",
    "title_zh": "替嬰兒沖涼",
    "title_id": "Mandikan bayi",
    "instructions_zh": "用合適水溫替嬰兒沖涼，全程托穩。必須僱主在場或確認。",
    "instructions_id": "Mandikan bayi dengan suhu air yang tepat; selalu dukung bayi. Harus dengan majikan atau dikonfirmasi.",
    "suggested_task_type": "scheduled",
    "suggested_time": "19:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "沖涼",
      "mandi",
      "bayi"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "baby_sterilise",
    "category_key": "baby",
    "title_zh": "消毒奶樽",
    "title_id": "Sterilkan botol susu",
    "instructions_zh": "清洗同消毒奶樽同奶咀。",
    "instructions_id": "Cuci dan sterilkan botol serta dot.",
    "suggested_task_type": "scheduled",
    "suggested_time": "21:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "奶樽",
      "botol"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "child_school_prep",
    "category_key": "childcare",
    "title_zh": "準備返學用品",
    "title_id": "Siapkan perlengkapan sekolah",
    "instructions_zh": "整書包、水壺同小食，確認功課放入。",
    "instructions_id": "Siapkan tas, botol minum, dan bekal; pastikan PR masuk tas.",
    "suggested_task_type": "scheduled",
    "suggested_time": "07:30",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "返學",
      "sekolah"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "child_homework",
    "category_key": "childcare",
    "title_zh": "陪做功課",
    "title_id": "Dampingi mengerjakan PR",
    "instructions_zh": "陪伴小朋友做功課，唔好代做答案。",
    "instructions_id": "Dampingi anak mengerjakan PR; jangan mengerjakan jawaban untuknya.",
    "suggested_task_type": "scheduled",
    "suggested_time": "17:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "功課",
      "PR"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "child_bath",
    "category_key": "childcare",
    "title_zh": "幫小朋友沖涼",
    "title_id": "Bantu anak mandi",
    "instructions_zh": "協助沖涼同換睡衣，注意防滑。",
    "instructions_id": "Bantu mandi dan ganti piyama; hati-hati lantai licin.",
    "suggested_task_type": "scheduled",
    "suggested_time": "19:30",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "沖涼",
      "mandi"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "child_play",
    "category_key": "childcare",
    "title_zh": "陪玩同看管",
    "title_id": "Temani bermain dan mengawasi",
    "instructions_zh": "喺安全範圍內陪玩，唔好讓小朋友單獨近窗或廚房。",
    "instructions_id": "Temani bermain di area aman; jangan biarkan anak sendiri dekat jendela atau dapur.",
    "suggested_task_type": "adhoc",
    "suggested_time": "15:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "看管",
      "awasi"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "child_snack",
    "category_key": "childcare",
    "title_zh": "準備小食",
    "title_id": "Siapkan camilan",
    "instructions_zh": "按指示準備健康小食，注意過敏。",
    "instructions_id": "Siapkan camilan sehat sesuai instruksi; perhatikan alergi.",
    "suggested_task_type": "scheduled",
    "suggested_time": "16:00",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "小食",
      "camilan",
      "過敏"
    ],
    "sort_order": 50,
    "source": "system"
  },
  {
    "system_key": "transport_school",
    "category_key": "transport",
    "title_zh": "接送返學放學",
    "title_id": "Antar jemput sekolah",
    "instructions_zh": "按時間接送小朋友返學放學，確認安全過馬路。",
    "instructions_id": "Antar jemput anak ke sekolah tepat waktu; pastikan aman saat menyeberang.",
    "suggested_task_type": "scheduled",
    "suggested_time": "07:45",
    "suggested_recurrence": {
      "rule": "weekdays"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "接送",
      "antar jemput"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "transport_activity",
    "category_key": "transport",
    "title_zh": "接送興趣班",
    "title_id": "Antar jemput les / kegiatan",
    "instructions_zh": "按時間地點接送，到達後通知僱主。",
    "instructions_id": "Antar jemput sesuai jadwal dan lokasi; beri tahu majikan saat tiba.",
    "suggested_task_type": "scheduled",
    "suggested_time": "16:30",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "興趣班",
      "les"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "transport_errand",
    "category_key": "transport",
    "title_zh": "外出辦事",
    "title_id": "Keluar untuk urusan",
    "instructions_zh": "按指示外出辦事，保管好鎖匙同收據。",
    "instructions_id": "Keluar sesuai instruksi; jaga kunci dan struk dengan baik.",
    "suggested_task_type": "adhoc",
    "suggested_time": "14:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "外出",
      "keluar"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "elderly_meal",
    "category_key": "elderly",
    "title_zh": "協助長者用餐",
    "title_id": "Bantu lansia makan",
    "instructions_zh": "協助長者用餐，注意吞嚥安全。必須僱主確認特別指示。",
    "instructions_id": "Bantu lansia makan; perhatikan keamanan menelan. Konfirmasi instruksi khusus dengan majikan.",
    "suggested_task_type": "scheduled",
    "suggested_time": "12:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "high",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "長者",
      "lansia"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "elderly_med_remind",
    "category_key": "elderly",
    "title_zh": "提醒服藥時間",
    "title_id": "Ingatkan waktu minum obat",
    "instructions_zh": "只提醒時間，唔好自行決定藥量。藥物相關必須僱主確認。",
    "instructions_id": "Hanya mengingatkan waktu; jangan menentukan dosis sendiri. Obat harus dikonfirmasi majikan.",
    "suggested_task_type": "scheduled",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "urgent",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "藥",
      "obat"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "elderly_walk",
    "category_key": "elderly",
    "title_zh": "陪長者散步",
    "title_id": "Temani lansia jalan-jalan",
    "instructions_zh": "短距離慢行，注意路面同休息。",
    "instructions_id": "Jalan pelan jarak pendek; perhatikan jalan dan istirahat.",
    "suggested_task_type": "scheduled",
    "suggested_time": "17:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": true,
    "translation_approved": true,
    "keywords": [
      "散步",
      "jalan"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "pets_feed_dog",
    "category_key": "pets",
    "title_zh": "餵狗",
    "title_id": "Beri makan anjing",
    "instructions_zh": "按份量餵狗同換清水。",
    "instructions_id": "Beri makan anjing sesuai porsi dan ganti air bersih.",
    "suggested_task_type": "scheduled",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "狗",
      "anjing"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "pets_feed_cat",
    "category_key": "pets",
    "title_zh": "餵貓",
    "title_id": "Beri makan kucing",
    "instructions_zh": "按份量餵貓、換水同清理貓砂。",
    "instructions_id": "Beri makan kucing, ganti air, dan bersihkan pasir kucing.",
    "suggested_task_type": "scheduled",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "貓",
      "kucing"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "pets_walk",
    "category_key": "pets",
    "title_zh": "遛狗",
    "title_id": "Jalan-jalan dengan anjing",
    "instructions_zh": "用牽繩帶狗落街，清理排泄物。",
    "instructions_id": "Gunakan tali; bersihkan kotoran anjing.",
    "suggested_task_type": "scheduled",
    "suggested_time": "07:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "遛狗",
      "jalan anjing"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "maint_ac_filter",
    "category_key": "maintenance",
    "title_zh": "清潔冷氣隔塵網",
    "title_id": "Bersihkan filter AC",
    "instructions_zh": "關閉冷氣後拆洗隔塵網，乾透先裝返。",
    "instructions_id": "Matikan AC, cuci filter, keringkan sebelum dipasang kembali.",
    "suggested_task_type": "scheduled",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "monthly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "冷氣",
      "AC"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "maint_plants",
    "category_key": "maintenance",
    "title_zh": "澆花",
    "title_id": "Siram tanaman",
    "instructions_zh": "按需要為室內植物澆水，唔好過多。",
    "instructions_id": "Siram tanaman dalam ruangan sesuai kebutuhan; jangan berlebihan.",
    "suggested_task_type": "scheduled",
    "suggested_time": "09:00",
    "suggested_recurrence": {
      "rule": "daily"
    },
    "suggested_priority": "low",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "花",
      "tanaman"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "maint_organise",
    "category_key": "maintenance",
    "title_zh": "執屋整理",
    "title_id": "Rapikan rumah",
    "instructions_zh": "整理雜物、收納玩具同雜誌。",
    "instructions_id": "Rapikan barang, mainan, dan majalah.",
    "suggested_task_type": "scheduled",
    "suggested_time": "15:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "執屋",
      "rapikan"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "maint_check_supplies",
    "category_key": "maintenance",
    "title_zh": "檢查耗材存量",
    "title_id": "Cek stok kebutuhan",
    "instructions_zh": "檢查廁紙、清潔劑等同耗材，列出要補充項目。",
    "instructions_id": "Cek tisu, pembersih, dll.; catat yang perlu dibeli.",
    "suggested_task_type": "scheduled",
    "suggested_time": "11:00",
    "suggested_recurrence": {
      "rule": "weekly"
    },
    "suggested_priority": "low",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "耗材",
      "stok"
    ],
    "sort_order": 40,
    "source": "system"
  },
  {
    "system_key": "special_guest",
    "category_key": "special",
    "title_zh": "準備客人到訪",
    "title_id": "Persiapan kedatangan tamu",
    "instructions_zh": "清潔客廳、準備茶水同小食。",
    "instructions_id": "Bersihkan ruang tamu; siapkan minuman dan camilan.",
    "suggested_task_type": "adhoc",
    "suggested_time": "14:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "high",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "客人",
      "tamu"
    ],
    "sort_order": 10,
    "source": "system"
  },
  {
    "system_key": "special_festival",
    "category_key": "special",
    "title_zh": "節日清潔同佈置",
    "title_id": "Bersih-bersih dan dekorasi hari raya",
    "instructions_zh": "大掃除同簡單佈置，跟僱主指示。",
    "instructions_id": "Bersih-bersih besar dan dekorasi sederhana sesuai instruksi.",
    "suggested_task_type": "adhoc",
    "suggested_time": "10:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "節日",
      "hari raya"
    ],
    "sort_order": 20,
    "source": "system"
  },
  {
    "system_key": "special_deep_clean",
    "category_key": "special",
    "title_zh": "大掃除",
    "title_id": "Pembersihan menyeluruh",
    "instructions_zh": "重點清潔廚房、浴室同儲物櫃。",
    "instructions_id": "Fokus bersihkan dapur, kamar mandi, dan lemari penyimpanan.",
    "suggested_task_type": "adhoc",
    "suggested_time": "09:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "大掃除",
      "menyeluruh"
    ],
    "sort_order": 30,
    "source": "system"
  },
  {
    "system_key": "special_pack",
    "category_key": "special",
    "title_zh": "執行李／準備出門",
    "title_id": "Siapkan koper / persiapan bepergian",
    "instructions_zh": "按清單執好行李或出門用品。",
    "instructions_id": "Siapkan koper atau barang bepergian sesuai daftar.",
    "suggested_task_type": "adhoc",
    "suggested_time": "08:00",
    "suggested_recurrence": {
      "rule": "none"
    },
    "suggested_priority": "normal",
    "safety_warning": false,
    "translation_approved": true,
    "keywords": [
      "行李",
      "koper"
    ],
    "sort_order": 40,
    "source": "system"
  }
]
