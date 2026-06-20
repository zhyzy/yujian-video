/**
 * 腾讯云 COS 前端直传工具
 * -----------------------------------------------
 * 用法：
 *   1) 后端需提供接口 /cos/sts-credential
 *      返回 { TmpSecretId, TmpSecretKey, SecurityToken, ExpiredTime,
 *              Bucket, Region, Domain (可选自定义域名), CDNDomain (可选) }
 *      或最小化：{ secretId, secretKey, sessionToken, bucket, region, domain }
 *
 *   2) cos.uploadFile(file, { typeName, onProgress })
 *      自动以 /YYYY-MM-DD/视频类型/原文件名_时间戳.ext 命名
 *
 *   3) cos.getDownloadUrl(key)           返回可访问 URL
 *      cos.getPreviewUrl(key)            同上
 *      cos.deleteObject(key)             删除 COS 对象（后端代理）
 *
 * 若后端尚未提供 /cos/sts-credential，可临时通过环境变量 VITE_COS_xxx 配置
 * （仅建议在本地调试时使用；生产必须走 STS）
 */

import COS from 'cos-js-sdk-v5'
import dayjs from 'dayjs'
import { deleteCosObject, getCosCredential } from '@/api'

let cosInstance = null
let credentialCache = null // { credentials, expireAt(ms) }

/** 去除域名中的协议前缀（防双重 https:// 问题） */
const stripProtocol = (url) => {
  if (!url) return url
  return String(url).replace(/^https?:\/\//, '')
}

/**
 * 懒加载 COS 实例：使用 STS 临时密钥或永久密钥
 */
const getCOS = async () => {
  // 缓存到期前 60 秒就重新取一次
  if (cosInstance && credentialCache && credentialCache.expireAt - 60000 > Date.now()) {
    return cosInstance
  }
  let credentials = null
  try {
    const res = await getCosCredential()
    credentials = res && (res.data || res)
  } catch (e) {
    console.warn('[COS] 获取凭证失败，尝试使用环境变量:', e.message)
    // 回退方案：读取 Vite 环境变量（仅用于本地联调）
    if (import.meta.env.VITE_COS_SECRET_ID && import.meta.env.VITE_COS_SECRET_KEY) {
      credentials = {
        TmpSecretId: import.meta.env.VITE_COS_SECRET_ID,
        TmpSecretKey: import.meta.env.VITE_COS_SECRET_KEY,
        SecurityToken: import.meta.env.VITE_COS_TOKEN || undefined,
        Bucket: import.meta.env.VITE_COS_BUCKET,
        Region: import.meta.env.VITE_COS_REGION || 'ap-guangzhou',
        Domain: import.meta.env.VITE_COS_DOMAIN || undefined,
        CDNDomain: import.meta.env.VITE_COS_CDN_DOMAIN || undefined,
        _usePermanent: true
      }
    } else {
      throw new Error('COS 存储未配置或临时凭证获取失败，请先在系统设置中完成存储桶配置')
    }
  }

  const TmpSecretId = credentials.TmpSecretId || credentials.secretId
  const TmpSecretKey = credentials.TmpSecretKey || credentials.secretKey
  const SecurityToken = credentials.SecurityToken || credentials.sessionToken
  const Bucket = credentials.Bucket || credentials.bucket
  const Region = credentials.Region || credentials.region || 'ap-guangzhou'
  const Domain = credentials.Domain || credentials.domain
  const CDNDomain = credentials.CDNDomain || credentials.cdnDomain
  const UploadPrefix = credentials.UploadPrefix || credentials.uploadPrefix || ''

  const ExpiredTime = Number(credentials.ExpiredTime || credentials.expiredTime || 0)
  credentialCache = {
    Bucket, Region,
    Domain: stripProtocol(Domain),
    CDNDomain: stripProtocol(CDNDomain),
    UploadPrefix,
    expireAt: ExpiredTime ? ExpiredTime * 1000 : Date.now() + 60 * 60 * 1000
  }

  // 判断是否使用永久密钥（无 SecurityToken）
  const usePermanentKey = !SecurityToken
  
  if (usePermanentKey) {
    // 永久密钥模式：直接配置 SecretId/SecretKey
    cosInstance = new COS({
      SecretId: TmpSecretId,
      SecretKey: TmpSecretKey
    })
  } else {
    // STS 临时密钥模式：使用 getAuthorization 回调
    cosInstance = new COS({
      getAuthorization: (options, callback) => {
        callback({
          TmpSecretId,
          TmpSecretKey,
          SecurityToken,
          StartTime: Math.floor(Date.now() / 1000),
          ExpiredTime: Math.floor(credentialCache.expireAt / 1000)
        })
      }
    })
  }
  return cosInstance
}

/**
 * 生成 COS 对象键（Key）
 * 规则：/YYYY-MM-DD/视频类型/原文件名_时间戳.ext
 * 例：/2026-06-12/招商类/品牌宣传片_1718123456.mp4
 */
export const buildCosKey = (file, typeName = '未分类') => {
  const date = dayjs().format('YYYY-MM-DD')
  const rawPrefix = String(credentialCache?.UploadPrefix || '').replace(/^\/+/, '')
  const prefix = rawPrefix ? rawPrefix.replace(/\/?$/, '/') : ''
  const safeType = String(typeName || '未分类').replace(/[\\/:*?"<>|\s]+/g, '_').trim() || '未分类'
  const lastDot = file.name.lastIndexOf('.')
  const baseName = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
  const ext = lastDot > 0 ? file.name.slice(lastDot).toLowerCase() : ''
  const safeName = baseName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80) || 'file'
  return `${prefix}${date}/${safeType}/${safeName}_${Date.now()}${ext}`
}

/**
 * 单文件上传到 COS
 * @param {File} file
 * @param {Object} options
 *   - typeName: 视频类型（用于路径分组）
 *   - onProgress(info)  { loaded, total, percent }
 *   - onTaskReady(taskId)  返回任务 id 可用于 abort
 * @returns Promise<{ key, location, url, cdnUrl, etag, size, name, duration? }>
 */
export const uploadFile = (file, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const cos = await getCOS()
      if (!cos) {
        throw new Error('COS 存储未配置，无法上传文件')
      }
      const { Bucket, Region, CDNDomain, Domain } = credentialCache || {}
      const key = buildCosKey(file, options.typeName)

      cos.putObject({
        Bucket, Region, Key: key, Body: file,
        SliceSize: 1024 * 1024 * 8,
        onProgress: (info) => {
          if (typeof options.onProgress === 'function') {
            options.onProgress({
              loaded: info.loaded,
              total: info.total,
              percent: Math.min(100, Math.round((info.loaded / info.total) * 100))
            })
          }
        },
        onTaskReady: (taskId) => {
          if (typeof options.onTaskReady === 'function') options.onTaskReady(taskId)
        }
      }, (err, data) => {
        if (err) return reject(err)
        const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/')
        const cosUrl = Domain
          ? `https://${Domain}/${encodedKey}`
          : `https://${Bucket}.cos.${Region}.myqcloud.com/${encodedKey}`
        const cdnUrl = CDNDomain ? `https://${CDNDomain}/${encodedKey}` : cosUrl

        resolve({
          key,
          location: data && data.Location,
          url: cdnUrl || cosUrl,
          rawUrl: cosUrl,
          etag: data && data.ETag,
          size: file.size,
          name: file.name,
          mime: file.type
        })
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * 删除 COS 对象（走后端代理）
 * 本地未配置 COS 时后端会返回 503，这属于可预期状态：只删除业务记录即可。
 */
export const deleteObject = async (key) => {
  if (!key) return { skipped: true, reason: 'EMPTY_KEY' }
  try {
    return await deleteCosObject(key, { silentError: true })
  } catch (e) {
    const message = e.response?.data?.message || e.message || ''
    if (e.response?.status === 503 || message.includes('COS 未配置')) {
      console.warn('[COS] 未配置，跳过云端删除:', key)
      return { skipped: true, reason: 'COS_NOT_CONFIGURED' }
    }
    throw e
  }
}

/**
 * 根据 COS key 构造可访问 URL
 */
export const getDownloadUrl = (key) => {
  if (!key) return ''
  const { Domain, CDNDomain, Bucket, Region } = credentialCache || {}
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/')
  if (CDNDomain) return `https://${CDNDomain}/${encodedKey}`
  if (Domain) return `https://${Domain}/${encodedKey}`
  if (Bucket && Region) return `https://${Bucket}.cos.${Region}.myqcloud.com/${encodedKey}`
  return key // 兜底
}
export const getPreviewUrl = getDownloadUrl

export default {
  uploadFile,
  deleteObject,
  getDownloadUrl,
  getPreviewUrl,
  buildCosKey,
  getCOS
}
