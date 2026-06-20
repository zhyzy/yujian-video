import { buildDefaultLayouts } from '@/layout-builder/moduleCatalog'
import { getSystemSettings, updateSystemSettings } from '@/api'

export const SYSTEM_SETTINGS_KEY = 'system_settings_v1'

export const defaultSystemSettings = {
  brand: {
    logoUrl: '/logo2.png',
    name: '遇见运营中台',
    subtitle: 'Media Operations'
  },
  profile: {
    displayName: '',
    roleLabel: '',
    avatarUrl: ''
  },
  appearance: {
    dashboardBgUrl: '',
    dashboardBgPreset: 'gradient1',
    cityBoardBgUrl: '',
    cityBoardBgPreset: 'gradient1',
    dataOverviewBgUrl: '',
    dataOverviewBgPreset: 'gradient1',
    dataOverviewHeroBgUrl: '',
    dataOverviewHeroBgPreset: 'gradient1'
  },
  preferences: {
    compactMode: false,
    showGlobalSearch: true,
    enableNotifications: true,
    defaultCity: '',
    defaultPublishTime: '09:00'
  },
  pages: {
    dashboard: {
      label: '工作台',
      fields: [
        { key: 'kpi', label: '核心指标', visible: true },
        { key: 'schedule', label: '今日排期', visible: true },
        { key: 'warning', label: '异常提醒', visible: true },
        { key: 'ai', label: 'AI 建议', visible: true }
      ]
    },
    materialList: {
      label: '素材列表',
      fields: [
        { key: 'thumbnail', label: '缩略图', visible: true },
        { key: 'filename', label: '文件名', visible: true },
        { key: 'size', label: '文件大小', visible: true },
        { key: 'duration', label: '视频时长', visible: true },
        { key: 'type', label: '素材类型', visible: true },
        { key: 'actions', label: '操作按钮', visible: true }
      ]
    },
    publish: {
      label: '发布管理',
      fields: [
        { key: 'date', label: '发布日期', visible: true },
        { key: 'platform', label: '发布平台', visible: true },
        { key: 'account', label: '发布账号', visible: true },
        { key: 'status', label: '发布状态', visible: true },
        { key: 'requirement', label: '发布要求', visible: true }
      ]
    },
    cityBoard: {
      label: '城市看板',
      fields: [
        { key: 'city', label: '城市', visible: true },
        { key: 'account', label: '城市账号', visible: true },
        { key: 'video', label: '视频内容', visible: true },
        { key: 'publishTime', label: '发布时间', visible: true },
        { key: 'status', label: '下发状态', visible: true }
      ]
    },
    cityManage: {
      label: '城市管理',
      fields: [
        { key: 'cityName', label: '城市名称', visible: true },
        { key: 'status', label: '运营状态', visible: true },
        { key: 'accounts', label: '绑定账号', visible: true },
        { key: 'platforms', label: '常用平台', visible: true },
        { key: 'actions', label: '编辑删除', visible: true }
      ]
    },
    accounts: {
      label: '账号页面',
      fields: [
        { key: 'name', label: '账号名称', visible: true },
        { key: 'platform', label: '平台', visible: true },
        { key: 'login', label: '登录账号', visible: true },
        { key: 'type', label: '账号类型', visible: true },
        { key: 'status', label: '账号状态', visible: true }
      ]
    }
  },
  layouts: buildDefaultLayouts(),
  layoutBindings: {},
  layoutHistory: []
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)
const isInlineAsset = (value) => typeof value === 'string' && value.startsWith('data:')
const clonePlain = (value) => JSON.parse(JSON.stringify(value || {}))

const mergeSettings = (base, saved) => {
  if (Array.isArray(base)) {
    if (!Array.isArray(saved)) return base
    const merged = base.map((item) => {
      const match = saved.find((candidate) => candidate.key === item.key)
      return match ? { ...item, ...match } : item
    })
    const extra = saved.filter((candidate) => candidate?.key && !base.some((item) => item.key === candidate.key))
    return [...merged, ...extra]
  }
  if (!isObject(base)) return saved ?? base
  const result = Object.keys(base).reduce((acc, key) => {
    acc[key] = mergeSettings(base[key], saved?.[key])
    return acc
  }, {})
  Object.keys(saved || {}).forEach((key) => {
    if (!(key in result)) result[key] = saved[key]
  })
  return result
}

const stripInlineAssets = (settings) => {
  const clone = clonePlain(settings)
  if (isInlineAsset(clone.brand?.logoUrl)) clone.brand.logoUrl = defaultSystemSettings.brand.logoUrl
  if (isInlineAsset(clone.profile?.avatarUrl)) clone.profile.avatarUrl = ''
  ;[
    'dashboardBgUrl',
    'cityBoardBgUrl',
    'dataOverviewBgUrl',
    'dataOverviewHeroBgUrl'
  ].forEach((key) => {
    if (isInlineAsset(clone.appearance?.[key])) clone.appearance[key] = ''
  })
  return clone
}

const buildCacheSafeSettings = (settings) => {
  const stripped = stripInlineAssets(settings)
  return {
    brand: stripped.brand,
    profile: stripped.profile,
    appearance: stripped.appearance,
    preferences: stripped.preferences,
    pages: stripped.pages,
    layouts: stripped.layouts,
    layoutBindings: stripped.layoutBindings || {},
    layoutHistory: stripped.layoutHistory || []
  }
}

const readPersistedLayoutBindings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SYSTEM_SETTINGS_KEY) || '{}')
    return saved.layoutBindings || {}
  } catch {
    return {}
  }
}

export const loadSystemSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SYSTEM_SETTINGS_KEY) || '{}')
    return mergeSettings(defaultSystemSettings, saved)
  } catch {
    return structuredClone(defaultSystemSettings)
  }
}

export const saveSystemSettings = (settings) => {
  const persistedLayoutBindings = readPersistedLayoutBindings()
  const settingsLayoutBindings = settings?.layoutBindings || {}
  const latestLayoutBindings = Object.keys(settingsLayoutBindings).length
    ? settingsLayoutBindings
    : persistedLayoutBindings
  const nextSettings = {
    ...settings,
    layoutBindings: latestLayoutBindings
  }
  const candidates = [
    nextSettings,
    stripInlineAssets(nextSettings),
    buildCacheSafeSettings(nextSettings)
  ]
  let saved = false
  for (const candidate of candidates) {
    try {
      localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(candidate))
      saved = true
      break
    } catch (error) {
      if (error?.name !== 'QuotaExceededError') throw error
    }
  }
  if (!saved) {
    localStorage.removeItem(SYSTEM_SETTINGS_KEY)
  }
  window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: nextSettings }))
}

export const syncSystemSettingsFromRemote = async () => {
  const remote = await getSystemSettings()
  const merged = mergeSettings(defaultSystemSettings, remote || {})
  saveSystemSettings(merged)
  return merged
}

export const persistSystemSettingsToRemote = async (settings) => {
  const next = await updateSystemSettings(settings)
  const merged = mergeSettings(defaultSystemSettings, next || settings || {})
  saveSystemSettings(merged)
  return merged
}

export const applySystemSettings = (target, settings) => {
  Object.assign(target, mergeSettings(defaultSystemSettings, settings || {}))
}

export const resetSystemSettings = () => {
  localStorage.removeItem(SYSTEM_SETTINGS_KEY)
  const settings = loadSystemSettings()
  window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: settings }))
  return settings
}

const countLayoutModules = (layouts = {}) => Object.values(layouts || {}).reduce((sum, layout) => {
  return sum + (Array.isArray(layout?.modules) ? layout.modules.length : 0)
}, 0)

const countVisibleModules = (layouts = {}) => Object.values(layouts || {}).reduce((sum, layout) => {
  return sum + (Array.isArray(layout?.modules) ? layout.modules.filter(module => module.visible !== false).length : 0)
}, 0)

const countBindingFields = (layoutBindings = {}) => Object.values(layoutBindings || {}).reduce((sum, pageBindings) => {
  return sum + Object.values(pageBindings || {}).filter((value) => {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }).length
}, 0)

export const createLayoutSnapshot = (settings, remark = '') => {
  const layouts = clonePlain(settings.layouts || {})
  const layoutBindings = clonePlain(settings.layoutBindings || {})
  const pageCount = Object.keys(layouts).length
  const moduleCount = countLayoutModules(layouts)
  const visibleModuleCount = countVisibleModules(layouts)
  const bindingCount = countBindingFields(layoutBindings)
  return {
    id: `layout_${Date.now()}`,
    createdAt: new Date().toISOString(),
    remark: remark || '手动保存布局',
    pageCount,
    moduleCount,
    visibleModuleCount,
    bindingCount,
    layouts,
    layoutBindings
  }
}

export const addLayoutSnapshot = (settings, remark = '') => {
  const snapshot = createLayoutSnapshot(settings, remark)
  const history = Array.isArray(settings.layoutHistory) ? settings.layoutHistory : []
  settings.layoutHistory = [snapshot, ...history].slice(0, 10)
  return snapshot
}
