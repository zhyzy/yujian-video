/**
 * 平台与视频类型的 iconfont 图标映射
 * iconfont 项目: //at.alicdn.com/t/c/font_5195241_tyi80svfqy.css
 */

// 平台 → iconfont class
export const platformIcons = {
  douyin: 'icon-douyinzhanghao',
  kuaishou: 'icon-ks',
  weixin: 'icon-shipinhao',
  xiaohongshu: 'icon-xiaohongshu'
}

// 平台中文名
export const platformNames = {
  douyin: '抖音',
  kuaishou: '快手',
  weixin: '视频号',
  xiaohongshu: '小红书'
}

// 平台主题色
export const platformColors = {
  douyin: '#111111',
  kuaishou: '#f97316',
  weixin: '#10b981',
  xiaohongshu: '#ef4444'
}

// 平台浅色背景
export const platformBgColors = {
  douyin: '#f2f2f2',
  kuaishou: '#fff7ed',
  weixin: '#ecfdf5',
  xiaohongshu: '#fef2f2'
}

// 视频类型关键词 → iconfont class（按优先级排列，越具体的越靠前）
const videoTypeKeywordMap = [
  // 跳舞类（必须在"美女"之前，否则"美女跳舞"会先匹配到美女图标）
  { keywords: ['跳舞', '舞蹈'], icon: 'icon-tiaowu' },
  // 招商类
  { keywords: ['招商', '加盟'], icon: 'icon-zhaoshangjiameng' },
  // 技师/美女类
  { keywords: ['技师', '美女', '帐号', '账号'], icon: 'icon-meinv' },
  // 剧情类
  { keywords: ['剧情', '演绎', '故事', '段子'], icon: 'icon-juqing' },
  // 服务展示 / 养生
  { keywords: ['服务展示', '养生', '理疗', 'SPA', '按摩'], icon: 'icon-yangsheng' },
  // 品牌 / 官方 / 认证
  { keywords: ['品牌', '宣传', '官方', '蓝V', '认证'], icon: 'icon-guanfangrenzheng' }
]

/**
 * 根据平台 key 获取平台图标 class
 */
export function getPlatformIcon(platform) {
  return platformIcons[platform] || ''
}

/**
 * 根据平台 key 获取平台名称
 */
export function getPlatformName(platform) {
  return platformNames[platform] || platform || '未知'
}

/**
 * 根据视频类型名获取图标 class（支持模糊关键词匹配）
 * 匹配规则：遍历关键词列表，类型名包含任一关键词即命中
 */
export function getVideoTypeIcon(typeName) {
  if (!typeName) return ''
  for (const entry of videoTypeKeywordMap) {
    if (entry.keywords.some(kw => typeName.includes(kw))) {
      return entry.icon
    }
  }
  return ''
}
