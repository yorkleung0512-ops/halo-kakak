import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  clearDeepLinkParams,
  fetchTaskOccurrenceById,
  resolveDeepLinkTask,
} from '../lib/taskDetailAccess'
import { supabase } from '../lib/supabase'

/**
 * Shared open-by-id controller for Today / Calendar / History / deep links.
 */
export function useTaskOccurrenceDetail({ householdId } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [detailTask, setDetailTask] = useState(null)
  const [detailTemplate, setDetailTemplate] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const genRef = useRef(0)

  const clearTaskParams = useCallback(() => {
    const next = clearDeepLinkParams(searchParams)
    const cur = searchParams.toString()
    const nxt = next.toString()
    if (cur !== nxt) setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const closeDetail = useCallback(() => {
    setDetailTask(null)
    setDetailTemplate(null)
    setDetailError(null)
    setDetailLoading(false)
    clearTaskParams()
  }, [clearTaskParams])

  const loadTemplate = useCallback(async (templateId, gen) => {
    if (!templateId) {
      if (gen === genRef.current) setDetailTemplate(null)
      return
    }
    const { data } = await supabase
      .from('task_templates')
      .select(
        'id, recurrence_rule, recurrence_weekdays, recurrence_interval, default_time, start_date, end_date, paused_at, is_active, title_zh, title_id',
      )
      .eq('id', templateId)
      .maybeSingle()
    if (gen !== genRef.current) return
    setDetailTemplate(data || null)
  }, [])

  const openTaskById = useCallback(
    async (id, { fromList = null } = {}) => {
      const gen = ++genRef.current
      setDetailError(null)
      setDetailLoading(true)

      let row = fromList && fromList.id === id ? fromList : null
      if (!row) {
        const { task, error } = await fetchTaskOccurrenceById(id)
        if (gen !== genRef.current) return { ok: false, reason: 'stale' }
        if (error || !task) {
          setDetailTask(null)
          setDetailTemplate(null)
          setDetailError('unavailable')
          setDetailLoading(false)
          return { ok: false, reason: 'unavailable' }
        }
        row = task
      }

      const resolved = resolveDeepLinkTask(row, householdId)
      if (!resolved.ok) {
        if (gen !== genRef.current) return { ok: false, reason: 'stale' }
        setDetailTask(null)
        setDetailTemplate(null)
        setDetailError('unavailable')
        setDetailLoading(false)
        return { ok: false, reason: resolved.reason }
      }

      if (gen !== genRef.current) return { ok: false, reason: 'stale' }
      setDetailTask(resolved.task)
      setDetailLoading(false)
      loadTemplate(resolved.task.template_id, gen)
      return { ok: true, task: resolved.task }
    },
    [householdId, loadTemplate],
  )

  const openTaskRow = useCallback(
    (row) => {
      if (!row?.id) return openTaskById(null)
      return openTaskById(row.id, { fromList: row })
    },
    [openTaskById],
  )

  return {
    detailTask,
    setDetailTask,
    detailTemplate,
    detailError,
    detailLoading,
    openTaskById,
    openTaskRow,
    closeDetail,
    clearTaskParams,
  }
}
