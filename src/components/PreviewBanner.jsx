export default function PreviewBanner({ onExit, lang }) {
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
    >
      <span lang="zh-Hant">
        {lang === 'id'
          ? 'Mode pratinjau helper (hanya baca) — peran asli tidak berubah. '
          : '預覽姐姐介面（唯讀）— 唔會改變你嘅真實角色。'}
      </span>
      <button
        type="button"
        onClick={onExit}
        className="ml-2 min-h-11 min-w-11 rounded-lg bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        {lang === 'id' ? 'Keluar pratinjau' : '退出預覽'}
      </button>
    </div>
  )
}
