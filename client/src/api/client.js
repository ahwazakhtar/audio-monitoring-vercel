import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: BASE_URL,
})

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 by clearing auth and redirecting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export function login(username, password) {
  return api.post('/api/auth/login', { username, password })
}

export function getSession() {
  return api.get('/api/session')
}

export function getObservations() {
  return api.get('/api/observations')
}

export function getObservation(id) {
  return api.get(`/api/observations/${id}`)
}

export function getAudioFiles() {
  return api.get('/api/audio/files')
}

export function claimFile(unique_id_calc, audio_filename, audio_file_id) {
  return api.post('/api/claim', { unique_id_calc, audio_filename, audio_file_id })
}

export function releaseClaim(unique_id_calc) {
  return api.delete(`/api/claim/${encodeURIComponent(unique_id_calc)}`)
}

export function saveReview(reviewData) {
  return api.post('/api/reviews', reviewData)
}

export function getMyReviews() {
  return api.get('/api/reviews/mine')
}

export function getAnalytics() {
  return api.get('/api/analytics')
}

export function audioStreamUrl(fileId) {
  const token = localStorage.getItem('token')
  return `${BASE_URL}/api/audio/stream/${fileId}?token=${token}`
}

export default api
