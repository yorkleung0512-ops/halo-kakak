import { useEffect, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import {
  HIGH_RISK_WARNING,
  POLICY_VERSION,
  TRANSLATION_PRIVACY_NOTICE,
  isHighRisk,
  todayHK,
} from '../../lib/constants'
import { translateViaEdge } from '../../lib/translateClient'
import { supabase } from '../../lib/supabase'
import { fetchActiveHelpers } from '../../lib/assignees'
import { createCustomTask, mapBatchError } from '../../lib/presets'
import AssigneePicker from './AssigneePicker'

/**
 * Custom task form for AddTaskFlow — state lives here so Today.jsx stays leaner.
 * Behaviour matches the former inline form in Today.jsx.
 */
export default function CustomTaskForm({
  householdId,
  userId,
  glossary,
  ensureToday,
  previewHelper,
  onCreated,
  onCancel,
  onToast,
}) {
  const [formZh, setFormZh] = useState('')
  const [formId, setFormId] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formRecurrence, setFormRecurrence] = useState('none')
  const [formUrgent, setFormUrgent] = useState(false)
  const [formAddZh, setFormAddZh] = useState('')
  const [formAddId, setFormAddId] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState(null)
  const [helpers, setHelpers] = useState([])
  const [approveTranslation, setApproveTranslation] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [privacyOk, setPrivacyOk] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!householdId) return
    fetchActiveHelpers(householdId).then((list) => {
      setHelpers(list)
      setFormAssignedTo((prev) =>
        prev || (list.length === 1 ? list[0].user_id : null),
      )
    })
  }, [householdId])

  async function doTranslate() {
    if (!formZh.trim()) return
    setTranslating(true)
    try {
      await supabase.from('privacy_consents').upsert(
        {
          user_id: userId,
          policy_version: POLICY_VERSION,
          consent_type: 'translation',
        },
        { onConflict: 'user_id,policy_version,consent_type' },
      )
      const { translated } = await translateViaEdge(formZh, glossary)
      setFormId(translated)
      setApproveTranslation(false)
    } catch {
      onToast?.('翻譯失敗，請稍後再試')
    } finally {
      setTranslating(false)
    }
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      onToast?.('呢個瀏覽器唔支援語音輸入')
      return
    }
    const rec = new SR()
    rec.lang = 'zh-HK'
    rec.interimResults = false
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript
      setFormZh((prev) => (prev ? `${prev} ${text}` : text))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }

  async function onAddSubmit(e) {
    e.preventDefault()
    if (!formZh.trim() || !householdId || previewHelper) return
    const { error } = await createCustomTask({
      householdId,
      draft: {
        title_zh: formZh.trim(),
        title_id: formId.trim(),
        additional_instructions_zh: formAddZh,
        additional_instructions_id: formAddId,
        time: formTime || null,
        date: todayHK(),
        recurrence_rule: formRecurrence,
        priority: formUrgent ? 'urgent' : 'normal',
        assigned_to: formAssignedTo || null,
        translation_approved: approveTranslation,
      },
    })
    if (error) {
      onToast?.(mapBatchError(error))
      return
    }
    if (formRecurrence !== 'none') {
      await ensureToday?.()
    }
    setFormZh('')
    setFormId('')
    setFormAddZh('')
    setFormAddId('')
    setFormAssignedTo(null)
    setApproveTranslation(false)
    onToast?.('已新增')
    onCreated?.()
  }

  const riskForm = isHighRisk(formZh)

  return (
    <form onSubmit={onAddSubmit} className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p lang="zh-Hant">{TRANSLATION_PRIVACY_NOTICE.zh}</p>
        <p lang="id" className="mt-1">
          {TRANSLATION_PRIVACY_NOTICE.id}
        </p>
        <label className="mt-2 flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={privacyOk}
            onChange={(e) => setPrivacyOk(e.target.checked)}
          />
          <span>我明白 / Saya mengerti</span>
        </label>
      </div>

      <label className="block text-sm font-medium" htmlFor="task-zh">
        中文指示
      </label>
      <div className="flex gap-2">
        <textarea
          id="task-zh"
          value={formZh}
          onChange={(e) => setFormZh(e.target.value)}
          rows={2}
          required
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <button
          type="button"
          onClick={startVoice}
          aria-label={listening ? '停止語音輸入' : '廣東話語音輸入'}
          className={`min-h-11 min-w-11 shrink-0 rounded-xl border ${listening ? 'bg-rose-100 border-rose-300' : 'bg-white border-slate-200'}`}
        >
          {listening ? (
            <MicOff className="mx-auto h-5 w-5" />
          ) : (
            <Mic className="mx-auto h-5 w-5" />
          )}
        </button>
      </div>

      {riskForm && (
        <div role="alert" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-950">
          <p lang="zh-Hant">{HIGH_RISK_WARNING.zh}</p>
          <p lang="id">{HIGH_RISK_WARNING.id}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={doTranslate}
          disabled={translating || !privacyOk}
          className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 disabled:opacity-50"
        >
          {translating ? '…' : '翻譯成印尼文'}
        </button>
      </div>

      <label className="block text-sm font-medium" htmlFor="task-id">
        印尼文（可改）
      </label>
      <textarea
        id="task-id"
        lang="id"
        value={formId}
        onChange={(e) => {
          setFormId(e.target.value)
          setApproveTranslation(false)
        }}
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={approveTranslation}
          onChange={(e) => setApproveTranslation(e.target.checked)}
        />
        我已核對印尼文（標記為已核准）
      </label>
      <p className="text-xs text-slate-500">
        機器翻譯唔保證正確 / Terjemahan mesin tidak dijamin akurat.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm" htmlFor="task-time">
            時間
          </label>
          <input
            id="task-time"
            type="time"
            value={formTime}
            onChange={(e) => setFormTime(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
          />
        </div>
        <div>
          <label className="text-sm" htmlFor="task-rec">
            重複
          </label>
          <select
            id="task-rec"
            value={formRecurrence}
            onChange={(e) => setFormRecurrence(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3"
          >
            <option value="none">單次</option>
            <option value="daily">每日</option>
            <option value="weekdays">平日</option>
            <option value="weekly">每週</option>
            <option value="monthly">每月</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm" htmlFor="task-add-zh" lang="zh-Hant">
          補充指示
        </label>
        <textarea
          id="task-add-zh"
          lang="zh-Hant"
          rows={2}
          value={formAddZh}
          onChange={(e) => setFormAddZh(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <label className="mt-2 block text-sm" htmlFor="task-add-id" lang="id">
          Instruksi tambahan
        </label>
        <textarea
          id="task-add-id"
          lang="id"
          rows={2}
          value={formAddId}
          onChange={(e) => setFormAddId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <AssigneePicker
        id="task-assignee"
        helpers={helpers}
        value={formAssignedTo || ''}
        onChange={setFormAssignedTo}
      />

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={formUrgent}
          onChange={(e) => setFormUrgent(e.target.checked)}
        />
        緊急
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-xl border border-slate-200"
        >
          取消
        </button>
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-xl bg-teal-700 font-bold text-white"
        >
          送出
        </button>
      </div>
    </form>
  )
}
