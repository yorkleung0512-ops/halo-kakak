import { useEffect, useRef } from 'react'

export default function Modal({ open, onClose, title, children, labelledBy }) {
  const panelRef = useRef(null)
  const prevFocus = useRef(null)

  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusables?.[0]?.focus()

    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && focusables?.length) {
        const list = Array.from(focusables)
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="關閉"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
      >
        {title && (
          <h2 id={labelledBy} className="mb-3 text-lg font-bold text-slate-900">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
