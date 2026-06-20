import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use(
  config => {
    const token = localStorage.getItem('auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  error => Promise.reject(error)
)

const getErrorMessage = (error) => {
  if (error.response?.data?.message) return error.response.data.message
  if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试'
  if (error.message === 'Network Error') return '网络连接失败，请检查后端服务是否启动'
  return error.message || '请求失败'
}

request.interceptors.response.use(
  response => {
    const { code, message, data } = response.data
    if (code === 200) return data
    const errMsg = message || '请求失败'
    ElMessage.error(errMsg)
    return Promise.reject(new Error(errMsg))
  },
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      if (window.location.pathname !== '/login') {
        ElMessage.error('登录已过期，请重新登录')
        window.location.href = '/login'
      }
    } else if (!error.config?.silentError) {
      ElMessage.error(getErrorMessage(error))
    }
    return Promise.reject(error)
  }
)

export default request
