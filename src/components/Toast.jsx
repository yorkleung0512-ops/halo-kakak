export default function Toast({ message, offline }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
        offline
          ? 'bg-amber-800 text-amber-50'
          : 'bg-slate-900 text-white'
      }`}
    >
      {message}
    </div>
  )
}
