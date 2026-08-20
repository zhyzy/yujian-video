import { deleteUpyunObject, getUpyunFormToken } from '@/api'

const parseUploadResponse = (text) => {
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { raw: text } }
}

export const uploadFile = (file, options = {}) => new Promise(async (resolve, reject) => {
  try {
    const token = await getUpyunFormToken({
      filename: file.name,
      size: file.size,
      contentType: file.type || '',
      folderPath: options.folderPath || '/'
    })
    const formData = new FormData()
    formData.append('policy', token.policy)
    formData.append('authorization', token.authorization)
    if (token.date) formData.append('date', token.date)
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', token.uploadUrl, true)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof options.onProgress !== 'function') return
      options.onProgress({
        loaded: event.loaded,
        total: event.total || file.size || 0,
        percent: event.total ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : 0
      })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = parseUploadResponse(xhr.responseText)
        resolve({
          provider: 'upyun',
          storage_provider: 'upyun',
          key: token.key || token.path,
          object_key: token.key || token.path,
          url: data.url || token.url || '',
          raw: data,
          size: file.size,
          name: file.name,
          mime: file.type
        })
        return
      }
      reject(new Error(parseUploadResponse(xhr.responseText).message || `又拍云上传失败：${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('又拍云上传失败，请检查网络或跨域配置'))
    xhr.send(formData)
  } catch (e) {
    reject(e)
  }
})

export const deleteObject = async (key) => deleteUpyunObject(key, { silentError: true })

export default {
  uploadFile,
  deleteObject
}
