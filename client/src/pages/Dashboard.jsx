import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar.jsx'
import { getSession, getAudioFiles, getObservations, claimFile } from '../api/client.js'

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray: 'bg-slate-50 border-slate-200 text-slate-600',
  }
  const textMap = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    yellow: 'text-yellow-900',
    gray: 'text-slate-800',
  }
  return (
    <div className={`border rounded-xl p-4 ${colorMap[color]}`}>
      <div className={`text-3xl font-bold ${textMap[color]}`}>{value}</div>
      <div className="text-sm font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

function StatusBadge({ status, reviewerName }) {
  switch (status) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
          Available
        </span>
      )
    case 'my_draft':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
          My Draft
        </span>
      )
    case 'in_review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full inline-block"></span>
          In Review{reviewerName ? ` · ${reviewerName}` : ''}
        </span>
      )
    case 'reviewed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"></span>
          Reviewed
        </span>
      )
    default:
      return null
  }
}

function MatchedObservation({ file }) {
  if (!file.unique_id_calc) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        No match
      </span>
    )
  }
  return (
    <div>
      <div className="text-xs font-mono text-slate-700 font-semibold">{file.unique_id_calc}</div>
      {file.school_name && (
        <div className="text-xs text-slate-500 mt-0.5">{file.school_name}</div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [audioFiles, setAudioFiles] = useState([])
  const [observations, setObservations] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [claimingId, setClaimingId] = useState(null)

  const username = localStorage.getItem('username') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sessionRes, filesRes, obsRes] = await Promise.all([
        getSession(),
        getAudioFiles(),
        getObservations(),
      ])
      const session = sessionRes.data
      setCurrentUser(session)
      setObservations(obsRes.data || [])

      // Merge session state into each audio file
      const completedSet = new Set(session.completed || [])
      const claimedMap = new Map((session.claimed || []).map(c => [c.unique_id_calc, c]))
      const draftMap = new Map((session.drafts || []).map(d => [d.unique_id_calc, d]))

      const enriched = (filesRes.data || []).map(file => {
        const uid = file.unique_id_calc
        if (!uid) return { ...file, reviewed: false, claimed_by: null }
        if (completedSet.has(uid)) return { ...file, reviewed: true, claimed_by: null }
        const claim = claimedMap.get(uid) || draftMap.get(uid)
        if (claim) return { ...file, reviewed: false, claimed_by: claim.reviewer, claimed_by_username: claim.reviewer }
        return { ...file, reviewed: false, claimed_by: null }
      })
      setAudioFiles(enriched)
    } catch (err) {
      if (err.response?.status !== 401) {
        setError('Failed to load data. Please refresh.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleClaimAndReview(file) {
    setClaimingId(file.audio_file_id)
    try {
      await claimFile(file.unique_id_calc, file.audio_filename, file.audio_file_id)
      navigate(`/review/${file.audio_file_id}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to claim file. It may have been claimed by someone else.'
      setError(msg)
      await loadData()
    } finally {
      setClaimingId(null)
    }
  }

  function handleContinueReview(file) {
    navigate(`/review/${file.audio_file_id}`)
  }

  function handleViewReview(file) {
    navigate(`/review/${file.audio_file_id}`)
  }

  // Determine status of each audio file
  function getFileStatus(file) {
    if (!file.claimed_by) {
      if (file.reviewed) return 'reviewed'
      return 'available'
    }
    const claimedUsername = file.claimed_by_username || file.claimed_by
    if (claimedUsername === username) return 'my_draft'
    return 'in_review'
  }

  // Stats computation
  const total = audioFiles.length
  const reviewed = audioFiles.filter(f => f.reviewed).length
  const inProgress = audioFiles.filter(f => f.claimed_by && !f.reviewed).length
  const available = audioFiles.filter(f => !f.claimed_by && !f.reviewed).length

  // My active reviews: files claimed by current user not yet reviewed
  const myActiveReviews = audioFiles.filter(f => {
    const claimedUsername = f.claimed_by_username || f.claimed_by
    return claimedUsername === username && !f.reviewed
  })

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <NavBar />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Audio review queue for survey compliance
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Files" value={total} color="blue" />
          <StatCard label="Reviewed" value={reviewed} color="green" />
          <StatCard label="In Progress" value={inProgress} color="yellow" />
          <StatCard label="Available" value={available} color="gray" />
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Audio Files table (wider) */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Audio Files
                </h2>
                <span className="text-xs text-slate-400">{audioFiles.length} files</span>
              </div>

              {audioFiles.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-sm">No audio files found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Filename</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Matched Observation</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {audioFiles.map(file => {
                        const status = getFileStatus(file)
                        const reviewerName = file.claimed_by_username || file.claimed_by || ''
                        const isClaiming = claimingId === file.audio_file_id

                        return (
                          <tr key={file.audio_file_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-xs font-medium text-slate-800 max-w-[200px] truncate" title={file.audio_filename}>
                                {file.audio_filename}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <MatchedObservation file={file} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={status} reviewerName={reviewerName} />
                            </td>
                            <td className="px-4 py-3">
                              {status === 'available' && (
                                <button
                                  onClick={() => handleClaimAndReview(file)}
                                  disabled={isClaiming || !file.unique_id_calc}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                                >
                                  {isClaiming ? (
                                    <>
                                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      Claiming...
                                    </>
                                  ) : 'Claim & Review'}
                                </button>
                              )}
                              {status === 'my_draft' && (
                                <button
                                  onClick={() => handleContinueReview(file)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  Continue
                                </button>
                              )}
                              {status === 'reviewed' && (
                                <button
                                  onClick={() => handleViewReview(file)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors border border-slate-200"
                                >
                                  View
                                </button>
                              )}
                              {status === 'in_review' && (
                                <span className="text-xs text-slate-400 italic">Locked</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* My Active Reviews (right sidebar) */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Active Reviews
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Files you have claimed but not submitted</p>
              </div>

              {myActiveReviews.length === 0 ? (
                <div className="py-12 text-center text-slate-400 px-4">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No active drafts</p>
                  <p className="text-xs mt-1">Claim a file to start reviewing</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myActiveReviews.map(file => (
                    <div key={file.audio_file_id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="text-xs font-medium text-slate-800 truncate mb-1" title={file.audio_filename}>
                        {file.audio_filename}
                      </div>
                      {file.unique_id_calc && (
                        <div className="text-xs text-slate-500 font-mono mb-2">{file.unique_id_calc}</div>
                      )}
                      {file.school_name && (
                        <div className="text-xs text-slate-400 mb-2">{file.school_name}</div>
                      )}
                      <button
                        onClick={() => handleContinueReview(file)}
                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors text-center"
                      >
                        Continue Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
