import { defineStore } from 'pinia'

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'
const DARK_MODE_KEY = 'app_theme_dark'

const systemPrefersDark = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

const readDarkMode = () => {
  const stored = localStorage.getItem(DARK_MODE_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return systemPrefersDark()
}

const applyDarkMode = (dark) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('theme-dark', Boolean(dark))
  document.documentElement.classList.toggle('theme-light', !dark)
}

applyDarkMode(readDarkMode())

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
    isFullscreen: Boolean(document.fullscreenElement),
    isDark: readDarkMode()
  }),
  actions: {
    toggleSidebar(collapsed) {
      this.sidebarCollapsed = typeof collapsed === 'boolean' ? collapsed : !this.sidebarCollapsed
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.sidebarCollapsed))
    },
    setFullscreen(value) {
      this.isFullscreen = Boolean(value)
    },
    async toggleFullscreen() {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
      this.setFullscreen(Boolean(document.fullscreenElement))
    },
    setDarkMode(dark) {
      this.isDark = Boolean(dark)
      localStorage.setItem(DARK_MODE_KEY, String(this.isDark))
      applyDarkMode(this.isDark)
    },
    toggleDarkMode() {
      this.setDarkMode(!this.isDark)
    }
  }
})
