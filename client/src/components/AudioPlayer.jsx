import React, { useState, useRef } from 'react'

export default function AudioPlayer({ src }) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const audioRef = useRef(null)

  function handleError() {
    setError(true)
    setLoaded(false)
  }

  function handleCanPlay() {
    setError(false)
    setLoaded(true)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 9.75v4.5m-4.5-4.5a5 5 0 000 7.072M12 18.75a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
        <span className="text-sm font-semibold text-slate-700">Audio Recording</span>
        {loaded && (
          <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            Ready
          </span>
        )}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium mb-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Audio failed to load
          </div>
          <p className="text-red-600 text-xs">
            The audio file could not be streamed. Check your connection or try refreshing.
          </p>
          <button
            className="mt-2 text-xs text-indigo-600 underline"
            onClick={() => {
              setError(false)
              if (audioRef.current) {
                audioRef.current.load()
              }
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <audio
          ref={audioRef}
          controls
          src={src}
          onError={handleError}
          onCanPlay={handleCanPlay}
          className="w-full"
          style={{ height: '40px' }}
          preload="metadata"
        />
      )}

      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Audio streams directly from Google Drive
      </p>
    </div>
  )
}
