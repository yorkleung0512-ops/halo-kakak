import { useEffect, useRef } from 'react'

function getFocusable(panel) {
  if (!panel) return []
  return Array.from(
    panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

/**
 * Modal with focus trap that re-queries focusables on each Tab
 * (supports dynamic multi-step content).
 */
export default function Modal({ open, onClose, title, children, labelledBy }) {
  const panelRef = useRef(null)
  const prevFocus = useRef(null)

  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    const panel = panelRef.current
    // Prefer step heading / title, else first focusable
    const heading =
      panel?.querySelector('[data-step-heading], h2, h3') || null
    const focusables = getFocusable(panel)
    if (heading && typeof heading.focus === 'function') {
      heading.setAttribute('tabindex', '-1')
      heading.focus()
    } else {
      focusables[0]?.focus()
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const list = getFocusable(panelRef.current)
      if (!list.length) return
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
        aria-label="關閉 / Tutup"
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
          <h2
            id={labelledBy}
            data-step-heading
            tabIndex={-1}
            className="mb-3 text-lg font-bold text-slate-900 outline-none"
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
