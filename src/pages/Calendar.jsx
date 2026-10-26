import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useHousehold } from '../lib/household'
import { supabase } from '../lib/supabase'
import { todayHK, STATUS_LABELS } from '../lib/constants'
import {
  addMonths,
  buildMonthGrid,
  countsByDate,
  monthBounds,
  monthTitle,
  weekdayLabels,
} from '../lib/calendarMonth'
import LoadingBlock from '../components/LoadingBlock'

export default function Calendar() {
  const { household, effectiveIsHelper } = useHousehold()
  const today = todayHK()
  const [selectedDate, setSelectedDate] = useState(today)
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const p = today.slice(0, 7) + '-01'
    return p
  })
  const [monthTasks, setMonthTasks] = useState([])
  const [dayTasks, setDayTasks] = useState([])
  const [monthLoading, setMonthLoading] = useState(true)
  const [dayLoading, setDayLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')
  const [templateInfo, setTemplateInfo] = useState(null)

  const lang = effectiveIsHelper ? 'id' : 'zh'
  const grid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor])
  const counts = useMemo(() => countsByDate(monthTasks), [monthTasks])
  const weekdays = useMemo(() => weekdayLabels(lang), [lang])
  const { start: monthStart, end: monthEnd } = useMemo(
    () => monthBounds(monthAnchor),
    [monthAnchor],
  )

  useEffect(() => {
    if (!household?.id) return
    let cancelled = false
    setMonthLoading(true)
    supabase
      .from('task_occurrences')
      .select('id, task_date, template_id, status')
      .eq('household_id', household.id)
      .gte('task_date', monthStart)
      .lte('task_date', monthEnd)
      .is('deleted_at', null)
      .then(({ data }) => {
        if (cancelled) return
        setMonthTasks(data || [])
        setMonthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [household?.id, monthStart, monthEnd])

  useEffect(() => {
    if (!household?.id) return
    let cancelled = false
    setDayLoading(true)
    supabase
      .from('task_occurrences')
      .select('id, title_zh, title_id, status, due_at, template_id')
      .eq('household_id', household.id)
      .eq('task_date', selectedDate)
      .is('deleted_at', null)
      .then(({ data }) => {
        if (cancelled) return
        setDayTasks(data || [])
        setDayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [household?.id, selectedDate])

  useEffect(() => {
    if (!templateId) {
      setTemplateInfo(null)
      return
    }
    supabase
      .from('task_templates')
      .select('id, title_zh, title_id, recurrence_rule, is_active')
      .eq('id', templateId)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data }) => setTemplateInfo(data || null))
  }, [templateId])

  function goMonth(delta) {
    setMonthAnchor((prev) => addMonths(prev, delta))
  }

  function selectDay(ymd) {
    setSelectedDate(ymd)
    // If user picks a day outside current month cells that are adjacent, snap month.
    if (ymd < monthStart || ymd > monthEnd) {
      setMonthAnchor(ymd.slice(0, 7) + '-01')
    }
  }

  const selectedLabel = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number)
      if (lang === 'id') {
        return new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(y, m - 1, d))
      }
      return `${y}年${m}月${d}日`
    } catch {
      return selectedDate
    }
  }, [selectedDate, lang])

  return (
    <div
      className="space-y-4"
      aria-busy={monthLoading || dayLoading}
    >
      <h1
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-lg font-bold text-slate-900"
      >
        {effectiveIsHelper ? 'Kalender' : '月曆'}
      </h1>
      <p
        lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
        className="text-sm text-slate-500"
      >
        {effectiveIsHelper
          ? 'Ketuk tanggal untuk melihat tugas hari itu.'
          : '撳日期睇嗰日任務。'}
      </p>

      {templateId && (
        <div
          role="status"
          lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            templateInfo
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          {templateInfo ? (
            <>
              <p className="font-bold">
                {effectiveIsHelper ? 'Jadwal' : '排程'}：
                {effectiveIsHelper
                  ? templateInfo.title_id || templateInfo.title_zh
                  : templateInfo.title_zh}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {templateInfo.recurrence_rule}
                {templateInfo.is_active
                  ? ''
                  : effectiveIsHelper
                    ? ' (nonaktif)'
                    : '（已暫停）'}
              </p>
            </>
          ) : (
            <p>
              {effectiveIsHelper
                ? 'Jadwal tidak ditemukan'
                : '搵唔到呢個排程'}
            </p>
          )}
        </div>
      )}

      <section
        aria-label={effectiveIsHelper ? 'Kalender bulanan' : '月曆'}
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label={
              effectiveIsHelper ? 'Bulan sebelumnya' : '上個月'
            }
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h2
            lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
            className="text-base font-bold text-slate-900"
          >
            {monthTitle(monthAnchor, lang)}
          </h2>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label={effectiveIsHelper ? 'Bulan berikutnya' : '下個月'}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div
          className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-500"
          aria-hidden
        >
          {weekdays.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {monthLoading ? (
          <LoadingBlock
            compact
            label="載入月曆"
            labelId="Memuat kalender"
          />
        ) : (
          <div
            role="grid"
            aria-label={monthTitle(monthAnchor, lang)}
            className="grid grid-cols-7 gap-0.5"
          >
            {grid.map((cell) => {
              const count = counts[cell.ymd] || 0
              const isSelected = cell.ymd === selectedDate
              const isToday = cell.ymd === today
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={
                    count
                      ? `${cell.ymd}, ${count} ${
                          effectiveIsHelper ? 'tugas' : '項任務'
                        }`
                      : cell.ymd
                  }
                  onClick={() => selectDay(cell.ymd)}
                  className={`relative flex min-h-11 flex-col items-center justify-center rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                    isSelected
                      ? 'bg-teal-700 font-bold text-white'
                      : isToday
                        ? 'bg-teal-50 font-semibold text-teal-900'
                        : cell.inMonth
                          ? 'text-slate-800 hover:bg-slate-50'
                          : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{cell.day}</span>
                  {count > 0 && (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-teal-600'
                      }`}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setMonthAnchor(today.slice(0, 7) + '-01')
              setSelectedDate(today)
            }}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {effectiveIsHelper ? 'Hari ini' : '今日'}
          </button>
        </div>
      </section>

      <section aria-labelledby="day-tasks-heading" className="space-y-2">
        <h2
          id="day-tasks-heading"
          lang={effectiveIsHelper ? 'id' : 'zh-Hant'}
          className="text-base font-bold text-slate-900"
        >
          {selectedLabel}
        </h2>
        {dayLoading ? (
          <LoadingBlock
            compact
            label="載入日程"
            labelId="Memuat jadwal"
          />
        ) : (
          <ul className="space-y-2">
            {dayTasks.map((t) => {
              const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pending
              const hi = templateId && t.template_id === templateId
              return (
                <li
                  key={t.id}
                  id={`task-${t.id}`}
                  className={`rounded-xl border bg-white px-4 py-3 ${
                    hi
                      ? 'border-teal-400 ring-2 ring-teal-100'
                      : 'border-slate-200'
                  }`}
                >
                  <p lang="zh-Hant" className="font-medium">
                    {t.title_zh}
                  </p>
                  {t.title_id && (
                    <p lang="id" className="text-sm text-slate-600">
                      {t.title_id}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    <span aria-hidden>{meta.icon}</span>{' '}
                    {effectiveIsHelper ? meta.id : meta.zh}
                  </p>
                </li>
              )
            })}
            {dayTasks.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-slate-500">
                {effectiveIsHelper ? 'Tidak ada tugas' : '呢日冇任務'}
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
