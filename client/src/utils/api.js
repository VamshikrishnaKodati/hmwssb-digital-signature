import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === true && 'data' in response.data) {
      response.data = response.data.data
    }
    return response
  },
  (error) => {
    if (error.response?.data?.success === false) {
      const d = error.response.data
      const err = d.error
      delete d.success
      d.error = (err && err.message) || err || 'Request failed'
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
