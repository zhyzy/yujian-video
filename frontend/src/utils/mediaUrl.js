export const resolveMediaUrl = (url = '') => {
  if (!url) return ''
  const value = String(url)
  if (/^(data:|blob:|https?:\/\/|\/\/)/i.test(value)) return value
  if (value.startsWith('/api/uploads/')) return value
  if (value.startsWith('/uploads/')) return `/api${value}`
  return value
}
