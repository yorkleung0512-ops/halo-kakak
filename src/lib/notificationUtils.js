export function formatUnreadBadge(count) {
  const n = Number(count) || 0
  if (n <= 0) return null
  if (n > 99) return '99+'
  return String(n)
}

export function notificationCopy(n, isHelper) {
  if (!n) return { title: '', body: '' }
  if (isHelper) {
    return {
      title: n.title_id || n.title_zh || '',
      body: n.body_id || n.body_zh || '',
    }
  }
  return {
    title: n.title_zh || n.title_id || '',
    body: n.body_zh || n.body_id || '',
  }
}

export function deepLinkForNotification(n) {
  if (!n) return '/'
  if (n.task_occurrence_id) {
    return `/?task=${encodeURIComponent(n.task_occurrence_id)}&n=${encodeURIComponent(n.id)}`
  }
  if (n.task_template_id) {
    return `/calendar?template=${encodeURIComponent(n.task_template_id)}&n=${encodeURIComponent(n.id)}`
  }
  return `/?n=${encodeURIComponent(n.id)}`
}

export const NOTIF_LABELS = {
  zh: {
    bell: '通知',
    centre: '通知中心',
    all: '全部',
    unread: '未讀',
    markAll: '全部標為已讀',
    markRead: '標為已讀',
    markUnread: '標為未讀',
    open: '查看',
    empty: '暫無通知',
    emptyUnread: '沒有未讀通知',
    syncOffline: '通知同步暫停（離線）',
    syncError: '無法載入通知',
    gone: '任務已不存在或已刪除',
    dismiss: '關閉',
    view: '查看',
    newTask: '新通知',
  },
  id: {
    bell: 'Notifikasi',
    centre: 'Pusat notifikasi',
    all: 'Semua',
    unread: 'Belum dibaca',
    markAll: 'Tandai semua dibaca',
    markRead: 'Tandai dibaca',
    markUnread: 'Tandai belum dibaca',
    open: 'Buka',
    empty: 'Belum ada notifikasi',
    emptyUnread: 'Tidak ada yang belum dibaca',
    syncOffline: 'Sinkron notifikasi ditunda (offline)',
    syncError: 'Gagal memuat notifikasi',
    gone: 'Tugas tidak ada atau sudah dihapus',
    dismiss: 'Tutup',
    view: 'Lihat',
    newTask: 'Notifikasi baru',
  },
}
