import { defineStore } from 'pinia'

const TAGS_KEY = 'app_multi_tags'

const normalizeTag = (route) => ({
  path: route.path,
  fullPath: route.fullPath || route.path,
  name: route.name || route.path,
  title: route.meta?.title || route.name || '未命名页面',
  meta: { ...(route.meta || {}) },
  query: route.query || {},
  params: route.params || {}
})

const readStoredTags = () => {
  try {
    const tags = JSON.parse(sessionStorage.getItem(TAGS_KEY) || '[]')
    return Array.isArray(tags) ? tags : []
  } catch {
    return []
  }
}

export const useMultiTagsStore = defineStore('multiTags', {
  state: () => ({
    homeTag: { path: '/dashboard', fullPath: '/dashboard', name: 'Dashboard', title: '工作台', meta: { title: '工作台' }, query: {}, params: {} },
    tags: readStoredTags()
  }),
  getters: {
    visibleTags(state) {
      const hasHome = state.tags.some((tag) => tag.path === state.homeTag.path)
      return hasHome ? state.tags : [state.homeTag, ...state.tags]
    }
  },
  actions: {
    persist() {
      sessionStorage.setItem(TAGS_KEY, JSON.stringify(this.visibleTags.slice(0, 18)))
    },
    setHomeTag(tag) {
      const nextHome = normalizeTag(tag)
      this.homeTag = nextHome
      this.tags = this.visibleTags.filter((item, index, arr) => {
        if (['/dashboard', '/city/workbench'].includes(item.path) && item.path !== nextHome.path) return false
        if (item.path === nextHome.path) return false
        return arr.findIndex((candidate) => candidate.path === item.path) === index
      })
      this.tags.unshift(nextHome)
      this.persist()
    },
    addTag(route) {
      if (route.meta?.public) return
      const tag = normalizeTag(route)
      const existingIndex = this.visibleTags.findIndex((item) => item.path === tag.path)
      if (existingIndex >= 0) {
        this.tags = this.visibleTags.map((item) => item.path === tag.path ? { ...item, fullPath: tag.fullPath, query: tag.query, params: tag.params } : item)
      } else {
        this.tags = [...this.visibleTags, tag].slice(-18)
      }
      this.persist()
    },
    removeTag(path) {
      if (path === this.homeTag.path) return
      this.tags = this.visibleTags.filter((tag) => tag.path !== path)
      this.persist()
    },
    removeOtherTags(path) {
      this.tags = this.visibleTags.filter((tag) => tag.path === this.homeTag.path || tag.path === path)
      this.persist()
    },
    removeLeftTags(path) {
      const tags = this.visibleTags
      const index = tags.findIndex((tag) => tag.path === path)
      if (index < 0) return
      this.tags = tags.filter((tag, tagIndex) => tag.path === this.homeTag.path || tagIndex >= index)
      this.persist()
    },
    removeRightTags(path) {
      const tags = this.visibleTags
      const index = tags.findIndex((tag) => tag.path === path)
      if (index < 0) return
      this.tags = tags.filter((tag, tagIndex) => tag.path === this.homeTag.path || tagIndex <= index)
      this.persist()
    },
    removeAllTags() {
      this.tags = [this.homeTag]
      this.persist()
    }
  }
})
