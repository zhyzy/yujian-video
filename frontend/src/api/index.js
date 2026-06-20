import request from '@/utils/request'

const normalizePageParams = (params = {}) => ({
  ...params,
  staffId: params.staff_id || params.staffId,
  videoTypeId: params.video_type_id || params.videoTypeId,
  accountId: params.account_id || params.accountId,
  cityId: params.city_id || params.cityId
})

// 工作台
export const login = (data) => request.post('/auth/login', data)
export const getCurrentUser = () => request.get('/auth/me')
export const updateProfile = (data) => request.put('/auth/profile', data)

// 工作台
export const getDashboard = (params) => request.get('/dashboard', { params })
export const getTaskProgress = (params) => request.get('/task-progress', { params })

// 素材
export const getMaterials = (params) => request.get('/materials', { params: normalizePageParams(params) })
export const createMaterial = (data) => request.post('/materials', data)
export const updateMaterial = (id, data) => request.put(`/materials/${id}`, data)
export const deleteMaterial = (id) => request.delete(`/materials/${id}`)
// 上传到 COS 后回写素材文件记录（单文件）
export const createMaterialFile = (data) => request.post('/material-files', data)
export const getMaterialFiles = (params) => request.get('/material-files', { params: normalizePageParams(params) })
export const updateMaterialFile = (id, data) => request.put(`/material-files/${id}`, data)
export const deleteMaterialFile = (id) => request.delete(`/material-files/${id}`)

// COS 前端直传：获取临时密钥 (STS) & 删除对象（走后端代理）
export const getCosCredential = (params) => request.get('/cos/sts-credential', { params })
export const deleteCosObject = (key, config = {}) => request.delete(`/cos/object`, { ...config, params: { key } })
export const createMediaPreviewToken = (fileOrUrl) => {
  const payload = typeof fileOrUrl === 'string'
    ? { url: fileOrUrl }
    : { key: fileOrUrl?.key || fileOrUrl?.cos_key, url: fileOrUrl?.url }
  return request.post('/media/preview-token', payload, { silentError: true })
}

// 视频类型
export const getVideoTypes = () => request.get('/video-types')
export const createVideoType = (data) => request.post('/video-types', data)
export const updateVideoType = (id, data) => request.put(`/video-types/${id}`, data)
export const deleteVideoType = (id) => request.delete(`/video-types/${id}`)

// 拍摄人员
export const getStaffs = () => request.get('/staffs')

// 发布排期
export const getSchedules = (params) => request.get('/schedules', { params: normalizePageParams(params) })
export const getScheduleCalendar = (params) => request.get('/schedules/calendar', { params })
export const createSchedule = (data) => request.post('/schedules', data)
export const updateSchedule = (id, data) => request.put(`/schedules/${id}`, data)
export const deleteSchedule = (id) => request.delete(`/schedules/${id}`)

// 账号
export const getAccounts = (params) => request.get('/accounts', { params })
export const getAccountPublishStats = (params) => request.get('/accounts/publish-stats', { params })
export const createAccount = (data) => request.post('/accounts', data)
export const updateAccount = (id, data) => request.put(`/accounts/${id}`, data)
export const deleteAccount = (id) => request.delete(`/accounts/${id}`)
export const updateAccountPublishStatus = (id, data) => request.put(`/accounts/${id}/publish-status`, data)
export const uploadAvatar = (data) => request.post('/uploads/avatar', data)

// 城市
export const getCities = () => request.get('/cities')
export const getCityBoard = (params) => request.get('/cities/board', { params })
export const getCityById = (id) => request.get(`/cities/${id}`)
export const createCity = (data) => request.post('/cities', data)
export const updateCity = (id, data) => request.put(`/cities/${id}`, data)
export const deleteCity = (id) => request.delete(`/cities/${id}`)

// 城市分发
export const getCityDistributions = (params, config = {}) => request.get('/city-distributions', { ...config, params: normalizePageParams(params) })
export const createCityDistribution = (data) => request.post('/city-distributions', data)
export const updateCityDistribution = (id, data) => request.put(`/city-distributions/${id}`, data)
export const deleteCityDistribution = (id) => request.delete(`/city-distributions/${id}`)

// 数据追踪
export const getDataTracks = (params) => request.get('/data-tracks', { params: normalizePageParams(params) })
export const createDataTrack = (data) => request.post('/data-tracks', data)
export const getDataStats = (params) => request.get('/data-dashboard', { params })

// AI报告
export const getAIReports = (params) => request.get('/ai-reports', { params })
export const generateAIReport = (data) => request.post('/ai-reports/generate', data, {
  timeout: 120000,
  silentError: true
})
export const saveManualAIReport = (data) => request.post('/ai-reports/manual', data)

// 认证
export const refreshToken = () => request.post('/auth/refresh')
export const changePassword = (data) => request.put('/auth/password', data)

// 系统设置
export const getSystemSettings = () => request.get('/system-settings')
export const updateSystemSettings = (data) => request.put('/system-settings', data)
export const testStorageSettings = (data) => request.post('/system-settings/storage/test', data)

// 系统登录账号
export const getSystemUsers = (params) => request.get('/system-users', { params })
export const createSystemUser = (data) => request.post('/system-users', data)
export const updateSystemUser = (id, data) => request.put(`/system-users/${id}`, data)
export const resetSystemUserPassword = (id, data) => request.put(`/system-users/${id}/password`, data)
export const deleteSystemUser = (id) => request.delete(`/system-users/${id}`)

// 搜索与通知
export const globalSearch = (params) => request.get('/search', { params })
export const getNotifications = (params) => request.get('/notifications', { params })
export const markNotificationRead = (id) => request.put(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => request.put('/notifications/read-all')

// 批量操作
export const batchCreateMaterials = (data) => request.post('/materials/batch', data)
export const batchUpdateMaterials = (data) => request.put('/materials/batch', data)
export const batchDeleteMaterials = (ids) => request.delete('/materials/batch', { data: { ids } })
export const batchCreateCityDistributions = (data) => request.post('/city-distributions/batch', data)
export const batchCreateSchedules = (data) => request.post('/schedules/batch', data)

// 月度目标
export const getMonthlyGoals = (params) => request.get('/monthly-goals', { params })
export const createMonthlyGoal = (data) => request.post('/monthly-goals', data)
export const updateMonthlyGoal = (month, data) => request.put(`/monthly-goals/${month}`, data)

// 拍摄人员
export const createStaff = (data) => request.post('/staffs', data)
export const updateStaff = (id, data) => request.put(`/staffs/${id}`, data)
export const deleteStaff = (id) => request.delete(`/staffs/${id}`)
