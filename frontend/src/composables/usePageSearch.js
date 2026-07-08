import { computed } from 'vue'
import { useRoute } from 'vue-router'

export const normalizeSearchText = (value) => String(value ?? '').trim().toLowerCase()

export const usePageSearch = () => {
  const route = useRoute()
  const pageSearchKeyword = computed(() => normalizeSearchText(route.query.keyword))
  const matchesPageSearch = (...values) => {
    const keyword = pageSearchKeyword.value
    if (!keyword) return true
    return values.some(value => normalizeSearchText(value).includes(keyword))
  }
  return { pageSearchKeyword, matchesPageSearch }
}
