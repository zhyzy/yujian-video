import { computed, reactive } from 'vue'
import { SYSTEM_SETTINGS_KEY } from '@/utils/systemSettings'

const LEGACY_STORAGE_KEY = 'layout_binding_values_v1'

const readSystemSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SYSTEM_SETTINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

const readStore = () => {
  try {
    const settingsBindings = readSystemSettings().layoutBindings || {}
    const legacyBindings = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}')
    return {
      ...legacyBindings,
      ...settingsBindings
    }
  } catch {
    return {}
  }
}

const writeStore = (value) => {
  const settings = readSystemSettings()
  settings.layoutBindings = JSON.parse(JSON.stringify(value || {}))
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(settings))
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(value || {}))
}

const emitBindingChange = (detail) => {
  window.dispatchEvent(new CustomEvent('layout-binding-change', { detail }))
  window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: readSystemSettings() }))
}

const state = reactive(readStore())

export const layoutBindingState = state

const replaceState = (next = {}) => {
  Object.keys(state).forEach((key) => {
    delete state[key]
  })
  Object.entries(next || {}).forEach(([key, value]) => {
    state[key] = value
  })
}

export const replaceLayoutBindingState = (next = {}) => {
  replaceState(next)
  writeStore(state)
  emitBindingChange({ bindings: state })
}

if (typeof window !== 'undefined') {
  window.addEventListener('system-settings-updated', (event) => {
    if (event?.detail?.layoutBindings) replaceState(event.detail.layoutBindings)
  })
}

export const getLayoutBindingKey = (module) => module?.config?.fieldName || module?.key || ''

export const getLayoutBindingValue = (pageKey, fieldName, fallback = '') => {
  if (!pageKey || !fieldName) return fallback
  return state?.[pageKey]?.[fieldName] ?? fallback
}

export const setLayoutBindingValue = (pageKey, fieldName, value) => {
  if (!pageKey || !fieldName) return
  if (!state[pageKey]) state[pageKey] = {}
  state[pageKey][fieldName] = value
  writeStore(state)
  emitBindingChange({ pageKey, fieldName, value, bindings: state[pageKey] })
}

export const clearLayoutBindingValue = (pageKey, fieldName) => {
  if (!pageKey || !fieldName || !state[pageKey]) return
  delete state[pageKey][fieldName]
  writeStore(state)
  emitBindingChange({ pageKey, fieldName, value: undefined, bindings: state[pageKey] || {} })
}

export const clearPageLayoutBindings = (pageKey) => {
  if (!pageKey) return
  state[pageKey] = {}
  writeStore(state)
  emitBindingChange({ pageKey, bindings: state[pageKey] })
}

export const useLayoutBindings = (pageKey) => {
  const bindings = computed(() => state[pageKey] || {})
  const get = (fieldName, fallback = '') => getLayoutBindingValue(pageKey, fieldName, fallback)
  const set = (fieldName, value) => setLayoutBindingValue(pageKey, fieldName, value)
  return { bindings, get, set }
}
