import React from 'react'

function VerdictButtons({ verdict, onChange }) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange(verdict === 'correct' ? null : 'correct')}
        className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
          verdict === 'correct'
            ? 'bg-green-500 border-green-600 text-white'
            : 'bg-white border-slate-300 text-slate-600 hover:bg-green-50 hover:border-green-400'
        }`}
      >
        ✓ Correct
      </button>
      <button
        type="button"
        onClick={() => onChange(verdict === 'incorrect' ? null : 'incorrect')}
        className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
          verdict === 'incorrect'
            ? 'bg-red-500 border-red-600 text-white'
            : 'bg-white border-slate-300 text-slate-600 hover:bg-red-50 hover:border-red-400'
        }`}
      >
        ✗ Incorrect
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

export default function SectionVerifier({
  sectionKey,
  sectionConfig,
  observation,
  verdicts,
  onVerdictsChange,
  comment,
  onCommentChange,
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
                verdict === 'incorrect' ? 'bg-red-50' : ''
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
                <VerdictButtons verdict={verdict} onChange={v => handleVerdictChange(field.key, v)} />
              </div>

              {/* Optional per-field comment */}
              {verdict === 'incorrect' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={fieldComment}
                    onChange={e => handleFieldComment(field.key, e.target.value)}
                    placeholder={`What did you hear instead? (optional)`}
                    className="w-full text-xs border border-red-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-red-50 placeholder-red-300"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Section comment */}
      <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50">
        <label className="text-xs font-medium text-slate-600 block mb-1">
          Section comment (optional)
        </label>
        <textarea
          value={comment || ''}
          onChange={e => onCommentChange(e.target.value)}
          rows={2}
          placeholder={`Notes for ${label}...`}
          className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none bg-white"
        />
      </div>
    </div>
  )
}
