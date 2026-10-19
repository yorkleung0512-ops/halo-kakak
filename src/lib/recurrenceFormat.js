/**
 * Human-readable recurrence summaries (zh-Hant / Indonesian).
 * Single place — do not rebuild recurrence text in components.
 */
import { WEEKDAY_LABELS, recurrenceLabel } from './presetUtils.js'

function padTime(t) {
  if (!t) return ''
  const s = String(t).slice(0, 5)
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  return s
}

function formatTimeForLang(time, lang) {
  const t = padTime(time)
  if (!t) return ''
  if (lang === 'id') {
    // Indonesian often uses 07.00
    return t.replace(':', '.')
  }
  return t
}

function formatDateLong(isoDate, lang) {
  if (!isoDate) return ''
  try {
    const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00+08:00`)
    if (lang === 'id') {
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Hong_Kong',
      })
    }
    const y = d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      timeZone: 'Asia/Hong_Kong',
    })
    const m = d.toLocaleDateString('zh-HK', {
      month: 'numeric',
      timeZone: 'Asia/Hong_Kong',
    })
    const day = d.toLocaleDateString('zh-HK', {
      day: 'numeric',
      timeZone: 'Asia/Hong_Kong',
    })
    return `${y}年${m}月${day}日`.replace(/\s/g, '')
  } catch {
    return String(isoDate).slice(0, 10)
  }
}

/**
 * @param {object|string|null} templateOrRec - task_templates row, or { recurrence_rule, recurrence_weekdays, recurrence_interval, default_time, end_date, paused_at, is_active }, or rule string
 * @param {'zh'|'id'} lang
 * @param {{ time?: string }} [opts]
 */
export function formatRecurrence(templateOrRec, lang = 'zh', opts = {}) {
  if (!templateOrRec) return ''

  const rec =
    typeof templateOrRec === 'string'
      ? { recurrence_rule: templateOrRec }
      : templateOrRec

  if (rec.paused_at || rec.is_active === false) {
    return lang === 'id' ? 'Jadwal dijeda' : '排程已暫停'
  }

  const rule = rec.recurrence_rule || rec.rule || (typeof templateOrRec === 'string' ? templateOrRec : null)
  if (!rule || rule === 'none') {
    return lang === 'id' ? 'Sekali' : '單次'
  }

  const weekdays = rec.recurrence_weekdays || rec.weekdays || null
  const interval = Number(rec.recurrence_interval || rec.interval || 1) || 1
  const time = formatTimeForLang(opts.time || rec.default_time || rec.time, lang)
  const labels = WEEKDAY_LABELS[lang === 'id' ? 'id' : 'zh']

  let core = ''

  if (rule === 'daily') {
    if (interval > 1) {
      core = lang === 'id' ? `Setiap ${interval} hari` : `每 ${interval} 日`
    } else {
      core = lang === 'id' ? 'Setiap hari' : '每日'
    }
  } else if (rule === 'weekdays') {
    core = lang === 'id' ? 'Hari kerja' : '平日'
  } else if (rule === 'weekly' || rule === 'biweekly') {
    const days = Array.isArray(weekdays) && weekdays.length
      ? weekdays.map((d) => labels[d] || d)
      : null
    if (rule === 'biweekly' || interval >= 2) {
      if (days?.length === 1) {
        core =
          lang === 'id'
            ? `Setiap dua minggu pada hari ${days[0]}`
            : `每兩星期${days[0]}`
      } else if (days?.length) {
        const joined =
          lang === 'id' ? days.join(', ') : days.join('、')
        core =
          lang === 'id'
            ? `Setiap dua minggu (${joined})`
            : `每兩週（${joined}）`
      } else {
        core = lang === 'id' ? 'Setiap dua minggu' : '每兩週'
      }
    } else if (days?.length) {
      if (lang === 'id') {
        if (days.length === 1) {
          core = `Setiap ${days[0]}`
        } else if (days.length === 2) {
          core = `Setiap ${days[0]} dan ${days[1]}`
        } else {
          const head = days.slice(0, -1).join(', ')
          core = `Setiap ${head}, dan ${days[days.length - 1]}`
        }
      } else {
        core = `逢星期${days.join('、')}`
      }
    } else {
      core = lang === 'id' ? 'Mingguan' : '每週'
    }
  } else if (rule === 'monthly') {
    const dayNum = rec.month_day || rec.day_of_month
    if (dayNum) {
      core =
        lang === 'id' ? `Setiap tanggal ${dayNum}` : `每月${dayNum}日`
    } else {
      core = lang === 'id' ? 'Bulanan' : '每月'
    }
  } else if (rule === 'custom') {
    core =
      interval > 1
        ? lang === 'id'
          ? `Setiap ${interval} hari`
          : `每 ${interval} 日`
        : lang === 'id'
          ? 'Interval kustom'
          : '自訂間隔'
  } else {
    core = recurrenceLabel(
      { rule, weekdays, interval, recurrence_rule: rule, recurrence_weekdays: weekdays, recurrence_interval: interval },
      lang,
    )
  }

  if (time) {
    if (lang === 'id') {
      core = `${core} pukul ${time}`
    } else {
      core = `${core} ${time}`
    }
  }

  const parts = [core]
  if (rec.end_date) {
    const until = formatDateLong(rec.end_date, lang)
    parts.push(
      lang === 'id' ? `Dijadwalkan hingga ${until}` : `排程至${until}`,
    )
  }

  return parts.filter(Boolean).join(lang === 'id' ? ' · ' : ' · ')
}

/** Re-export simple label for callers that only need short text */
export { recurrenceLabel }
