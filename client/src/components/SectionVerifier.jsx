import React from 'react'

function VerdictButtons({ verdict, onChange, readOnly = false }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => !readOnly && onChange(verdict === 'correct' ? null : 'correct')}
        disabled={readOnly}
        className={`px-3 py-1 rounded text-xs font-semibold border ${readOnly ? 'cursor-default' : 'transition-colors'} ${
          verdict === 'correct'
            ? 'bg-green-500 border-green-600 text-white'
            : `bg-white border-slate-300 text-slate-600 ${readOnly ? '' : 'hover:bg-green-50 hover:border-green-400'}`
        }`}
      >
        ✓ Correct
      </button>
      <button
        type="button"
        onClick={() => !readOnly && onChange(verdict === 'incorrect' ? null : 'incorrect')}
        disabled={readOnly}
        className={`px-3 py-1 rounded text-xs font-semibold border ${readOnly ? 'cursor-default' : 'transition-colors'} ${
          verdict === 'incorrect'
            ? 'bg-red-500 border-red-600 text-white'
            : `bg-white border-slate-300 text-slate-600 ${readOnly ? '' : 'hover:bg-red-50 hover:border-red-400'}`
        }`}
      >
        ✗ Incorrect
      </button>
      <button
        type="button"
        onClick={() => !readOnly && onChange(verdict === 'unknown' ? null : 'unknown')}
        disabled={readOnly}
        className={`px-3 py-1 rounded text-xs font-semibold border ${readOnly ? 'cursor-default' : 'transition-colors'} ${
          verdict === 'unknown'
            ? 'bg-slate-400 border-slate-500 text-white'
            : `bg-white border-slate-300 text-slate-600 ${readOnly ? '' : 'hover:bg-slate-100 hover:border-slate-400'}`
        }`}
      >
        ? Cannot Determine
      </button>
    </div>
  )
}

function ComplianceBadge({ correct, total }) {
  if (total === 0) return null
  const pct = Math.round((correct / total) * 100)
  let cls = 'bg-green-100 text-green-700'
  if (pct < 85) cls = 'bg-yellow-100 text-yellow-700'
  if (pct < 60) cls = 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {correct}/{total} · {pct}%
    </span>
  )
}

const PROTOCOL_FIELDS = [
  { key: '__protocol_followed', label: 'Followed protocol' },
  { key: '__protocol_prompted', label: 'Interviewer prompted student' },
  { key: '__protocol_gap', label: 'Gap in audio' },
]

export default function SectionVerifier({
  sectionKey,
  sectionConfig,
  observation,
  verdicts,
  onVerdictsChange,
  comment,
  onCommentChange,
  readOnly = false,
}) {
  const { label, verifyFields = [] } = sectionConfig

  const verdicted = verifyFields.filter(f => verdicts[f.key] === 'correct' || verdicts[f.key] === 'incorrect')
  const correct = verifyFields.filter(f => verdicts[f.key] === 'correct')

  function handleVerdictChange(fieldKey, value) {
    onVerdictsChange({ ...verdicts, [fieldKey]: value })
  }

  function handleFieldComment(fieldKey, value) {
    onVerdictsChange({ ...verdicts, [`__comment_${fieldKey}`]: value })
  }

  function handleProtocolCheck(fieldKey, checked) {
    onVerdictsChange({ ...verdicts, [fieldKey]: checked })
  }

  function handleProtocolOther(value) {
    onVerdictsChange({ ...verdicts, __protocol_other: value })
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-4">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 text-sm">{label}</span>
          <ComplianceBadge correct={correct.length} total={verdicted.length} />
        </div>
        <span className="text-xs text-slate-400">{verdicted.length}/{verifyFields.length} checked</span>
      </div>

      {/* Aggregate score rows */}
      <div className="divide-y divide-slate-100">
        {verifyFields.map(field => {
          const rawValue = observation ? observation[field.key] : undefined
          const displayValue = rawValue !== undefined && rawValue !== null && rawValue !== ''
            ? String(rawValue)
            : null
          const verdict = verdicts[field.key] || null
          const fieldComment = verdicts[`__comment_${field.key}`] || ''

          return (
            <div
              key={field.key}
              className={`px-4 py-3 transition-colors ${
                verdict === 'correct' ? 'bg-green-50' :
                verdict === 'incorrect' ? 'bg-red-50' :
                verdict === 'unknown' ? 'bg-slate-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Label + value */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700">{field.label}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{field.key}</div>
                  <div className="mt-1">
                    {displayValue !== null ? (
                      <span className="text-base font-bold text-slate-800">{displayValue}</span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">No data recorded</span>
                    )}
                  </div>
                </div>

                {/* Verdict */}
                <VerdictButtons verdict={verdict} onChange={v => handleVerdictChange(field.key, v)} readOnly={readOnly} />
              </div>

              {/* Optional per-field comment */}
              {verdict === 'incorrect' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={fieldComment}
                    onChange={e => !readOnly && handleFieldComment(field.key, e.target.value)}
                    readOnly={readOnly}
                    placeholder={`What did you hear instead? (optional)`}
                    className={`w-full text-xs border border-red-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-red-50 placeholder-red-300 ${readOnly ? 'cursor-default' : ''}`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Protocol observations */}
      <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
        <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Protocol Observations</div>
        <div className="space-y-2">
          {PROTOCOL_FIELDS.map(({ key, label: pLabel }) => (
            <label key={key} className={`flex items-center gap-2 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={!!verdicts[key]}
                onChange={e => !readOnly && handleProtocolCheck(key, e.target.checked)}
                disabled={readOnly}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              <span className="text-sm text-slate-700">{pLabel}</span>
            </label>
          ))}
          <div className="flex items-start gap-2 pt-0.5">
            <span className="text-sm text-slate-700 whitespace-nowrap pt-1">Other issue:</span>
            <input
              type="text"
              value={verdicts.__protocol_other || ''}
              onChange={e => !readOnly && handleProtocolOther(e.target.value)}
              readOnly={readOnly}
              placeholder="Describe..."
              className={`flex-1 text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white ${readOnly ? 'cursor-default' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Section comment */}
      <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50">
        <label className="text-xs font-medium text-slate-600 block mb-1">
          Section comment (optional)
        </label>
        <textarea
          value={comment || ''}
          onChange={e => !readOnly && onCommentChange(e.target.value)}
          readOnly={readOnly}
          rows={2}
          placeholder={`Notes for ${label}...`}
          className={`w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none ${readOnly ? 'bg-slate-50 cursor-default' : 'bg-white'}`}
        />
      </div>
    </div>
  )
}
