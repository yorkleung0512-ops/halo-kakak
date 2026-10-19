const BATCH_ERROR_ZH = {
  NOT_AUTHORIZED: '冇權限建立任務',
  INVALID_ASSIGNEE: '指派對象無效（只可以指派本家庭活躍姐姐）',
  INVALID_PRESET: '範本無效或已封存',
  INVALID_RECURRENCE: '重複安排設定無效',
  DUPLICATE_REQUEST: '重複提交：請稍候或重新開啟預覽',
  PAYLOAD_MISMATCH: '重複提交但內容唔同，請重新確認',
  BATCH_LIMIT_EXCEEDED: '一次最多建立 20 項任務',
  BATCH_FAILED: '建立任務失敗，請稍後再試',
}

export function mapBatchError(error) {
  if (!error) return BATCH_ERROR_ZH.BATCH_FAILED
  const raw = (error.message || '').trim()
  const code = raw.split(/[:\s]/)[0] || raw
  if (BATCH_ERROR_ZH[code]) return BATCH_ERROR_ZH[code]
  if (error.details && BATCH_ERROR_ZH[error.details]) return BATCH_ERROR_ZH[error.details]
  return raw || BATCH_ERROR_ZH.BATCH_FAILED
}
