<template>
  <div class="material-list-page">
    <ConfigurablePageRenderer page-key="materialList" :modules="materialListLayoutModules">
    <template #page-head>
    <!-- 页面头部 -->
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>
          素材管理
        </div>
        <h1 class="head-title">
          素材列表
          <span class="head-sub">管理所有已上传的素材文件，支持预览、复制链接和删除</span>
        </h1>
      </div>
      <div class="head-right">
        <button class="ghost-btn" @click="refreshList">
          <el-icon><Refresh /></el-icon>
          刷新
        </button>
        <button class="primary-btn" @click="$router.push('/material/entry')">
          <el-icon><Plus /></el-icon>
          上传素材
        </button>
      </div>
    </div>
    </template>

    <template #filter-panel>
    <!-- 筛选区 -->
    <section class="panel filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">日期筛选</label>
          <div class="date-picker-wrap">
            <el-icon class="date-icon"><Calendar /></el-icon>
            <el-date-picker
              v-model="filterDate"
              type="date"
              placeholder="选择日期查看该日上传"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              class="inline-date-picker"
              :popper-class="'material-list-popper'"
              @change="handleDateFilter"
            />
          </div>
          <button v-if="filterDate" class="clear-btn" @click="clearDateFilter">
            <el-icon><Close /></el-icon>
            清除
          </button>
        </div>

        <div class="filter-group">
          <label class="filter-label">素材类型</label>
          <div class="type-chips">
            <button
              class="type-chip"
              :class="{ active: !filterType }"
              @click="filterType = ''"
            >全部</button>
            <button
              v-for="t in videoTypes"
              :key="t.id"
              class="type-chip"
              :class="{ active: filterType === t.name }"
              :style="filterType === t.name ? { borderColor: t.color, color: t.color } : {}"
              @click="filterType = t.name"
            >
              <IconFont :typeName="t.name" :color="filterType === t.name ? t.color : ''" /> {{ t.name }}
            </button>
          </div>
        </div>
      </div>

      <div class="filter-meta">
        <span class="meta-text">
          共 <strong>{{ filteredGroups.length }}</strong> 个日期分组，
          <strong>{{ filteredFileList.length }}</strong> 个文件
        </span>
        <div class="bulk-actions" v-if="selectedFiles.length">
          <span class="selected-count">{{ selectedFiles.length }} 个已选</span>
          <button class="mini-btn success" @click="copySelectedLinks">
            <el-icon><Link /></el-icon>批量复制链接
          </button>
          <button class="mini-btn danger" @click="deleteSelected">
            <el-icon><Delete /></el-icon>批量删除
          </button>
        </div>
      </div>
    </section>
    </template>

    <template #file-groups>
    <!-- 文件列表（按日期分组） -->
    <div class="file-groups" v-if="filteredGroups.length">
      <div v-for="group in filteredGroups" :key="group.date" class="day-group">
        <div class="group-head">
          <div class="group-date">
            <span class="date-badge">{{ formatDateLabel(group.date) }}</span>
            <span class="weekday">{{ formatWeekday(group.date) }}</span>
          </div>
          <div class="group-count">
            <span class="count-pill">{{ group.files.length }} 个文件</span>
            <span class="size-sum">{{ formatSize(group.totalSize) }}</span>
          </div>
        </div>

        <div class="file-grid">
          <div
            v-for="file in group.files"
            :key="file.id"
            class="file-card"
            :class="{ selected: selectedFiles.includes(file.id), video: isVideo(file) }"
          >
            <div class="card-check" @click.stop="toggleSelect(file.id)">
              <div class="check-box" :class="{ checked: selectedFiles.includes(file.id) }">
                <el-icon v-if="selectedFiles.includes(file.id)"><Check /></el-icon>
              </div>
            </div>

            <div class="card-thumb" @click="openPreview(file)">
              <template v-if="isVideo(file) && (file.url || file.key)">
                <video
                  class="thumb-video-element"
                  :src="getMediaPreviewUrl(file)"
                  :muted="true"
                  preload="metadata"
                  playsinline
                  :poster="file.thumbnail_url || ''"
                  @loadedmetadata="seekVideoFrame($event, file)"
                  @loadeddata="onVideoLoaded($event, file)"
                  @error="onVideoError($event, file)"
                ></video>
                <div class="thumb-video-overlay">
                  <div class="video-play-circle">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                  <span>{{ file.duration || '视频' }}</span>
                </div>
              </template>
              <img v-else-if="file.thumbnail_url" :src="file.thumbnail_url" :alt="file.name" loading="lazy" />
              <template v-else-if="isVideo(file)">
                <div class="thumb-video">
                  <el-icon><VideoCamera /></el-icon>
                  <span>{{ file.duration || '视频' }}</span>
                </div>
              </template>
              <template v-else>
                <div class="thumb-file">
                  <el-icon><Document /></el-icon>
                </div>
              </template>
              <div class="thumb-overlay">
                <el-icon><View /></el-icon>
                <span>预览</span>
              </div>
              <div class="play-icon" v-if="isVideo(file)">
                <el-icon><VideoPlay /></el-icon>
              </div>
            </div>

            <div class="card-body">
              <div class="card-name" :title="file.name">{{ file.name }}</div>
              <div class="card-meta">
                <span class="meta-size">{{ file.size_human }}</span>
                <span class="meta-time">{{ formatTime(file.uploaded_at) }}</span>
              </div>
              <div class="card-type" v-if="file.type_name">
                <span class="type-tag"><IconFont :typeName="file.type_name" /> {{ file.type_name }}</span>
              </div>
            </div>

            <div class="card-actions">
              <button class="op-btn" @click="openPreview(file)" title="预览">
                <el-icon><View /></el-icon>
              </button>
              <button class="op-btn" @click="copyLink(file)" title="复制链接">
                <el-icon><Link /></el-icon>
              </button>
              <button class="op-btn" @click="copyPath(file)" title="复制路径">
                <el-icon><FolderOpened /></el-icon>
              </button>
              <button class="op-btn" @click="openRename(file)" title="重命名">
                <el-icon><EditPen /></el-icon>
              </button>
              <button class="op-btn danger" @click="removeFile(file)" title="删除">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-icon">
        <el-icon><FolderOpened /></el-icon>
      </div>
      <div class="empty-text">
        <strong>暂无素材文件</strong>
        <p>在素材录入页面上传文件后，会在这里展示</p>
      </div>
      <button class="primary-btn" @click="$router.push('/material/entry')">
        <el-icon><Upload /></el-icon>
        去上传素材
      </button>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <!-- 加载状态 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>

  <!-- 预览弹窗 -->
  <div class="dialog-overlay" v-if="previewVisible" @click.self="closePreview">
    <div class="dialog-card preview-card" @click.stop>
      <div class="dialog-head">
        <div>
          <h3>{{ previewFile?.name || '文件预览' }}</h3>
          <p class="preview-sub">{{ previewFile?.size_human }} · {{ previewFile?.duration || '—' }} · {{ formatTime(previewFile?.uploaded_at) }}</p>
        </div>
        <button class="icon-close" @click="closePreview"><el-icon><Close /></el-icon></button>
      </div>
      <div class="preview-body">
        <video
          v-if="isVideo(previewFile) && !previewError"
          :key="previewFile.url"
          :src="getMediaPreviewUrl(previewFile)"
          controls
          :autoplay="true"
          :muted="true"
          preload="auto"
          playsinline
          class="preview-video"
          @loadedmetadata="seekVideoFrame($event, previewFile)"
          @error="onPreviewError"
        ></video>
        <a v-else-if="previewError && isVideo(previewFile)" class="preview-other" :href="previewFile?.url" target="_blank" rel="noopener">
          <el-icon><Link /></el-icon>
          页面内播放失败，点击在新窗口打开
        </a>
        <img v-else-if="isImage(previewFile)" :src="previewFile.url" class="preview-img" alt="" />
        <a v-else class="preview-other" :href="previewFile?.url" target="_blank" rel="noopener">
          <el-icon><Link /></el-icon>
          在新窗口打开 · {{ previewFile?.url }}
        </a>
      </div>
      <div class="dialog-foot">
        <button class="ghost-btn" @click="copyLink(previewFile)">
          <el-icon><Link /></el-icon>
          复制链接
        </button>
        <button class="primary-btn" @click="closePreview">关闭</button>
      </div>
    </div>
  </div>

  <!-- 重命名弹窗 -->
  <div class="dialog-overlay" v-if="renameVisible" @click.self="closeRename">
    <div class="dialog-card small" @click.stop>
      <div class="dialog-head">
        <h3>重命名文件</h3>
        <button class="icon-close" @click="closeRename"><el-icon><Close /></el-icon></button>
      </div>
      <div class="dialog-body">
        <label class="field-label"><span class="label-text">新的文件名称（含扩展名）</span></label>
        <input v-model="renameForm.name" class="inline-input" style="margin-top:8px" />
      </div>
      <div class="dialog-foot">
        <button class="ghost-btn" @click="closeRename">取消</button>
        <button class="primary-btn" :disabled="!renameForm.name" @click="confirmRename">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  Calendar, Check, Close, Delete, Document, EditPen, FolderOpened, Link, Plus,
  Refresh, Upload, UserFilled, VideoCamera, VideoPlay, View
} from '@element-plus/icons-vue'
import { createMediaPreviewToken, getMaterialFiles, updateMaterialFile, deleteMaterialFile, getVideoTypes } from '@/api'
import IconFont from '@/components/IconFont.vue'
import cos from '@/utils/cos'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

// ==================== STATE ====================
const materialListLayoutModules = layoutModuleCatalog.materialList
const { bindings: layoutBindings } = useLayoutBindings('materialList')
const loading = ref(false)
const fileList = ref([])
const videoTypes = ref([])
const filterDate = ref('')
const filterType = ref('')
const selectedFiles = ref([])
const mediaPreviewUrls = ref({})

const previewVisible = ref(false)
const previewFile = ref(null)
const previewError = ref(false)
const renameVisible = ref(false)
const renameTarget = ref(null)
const renameForm = reactive({ name: '' })

const normalizeBoundDate = (value) => {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const applyLayoutBindings = (bindings = {}) => {
  let shouldReload = false
  if ('date' in bindings || 'filterDate' in bindings) {
    const nextDate = normalizeBoundDate(bindings.date ?? bindings.filterDate)
    if (nextDate !== filterDate.value) {
      filterDate.value = nextDate
      shouldReload = true
    }
  }
  if ('type' in bindings || 'filterType' in bindings) {
    filterType.value = bindings.type || bindings.filterType || ''
  }
  if (shouldReload) loadData()
}

// ==================== COMPUTED ====================
const filteredFileList = computed(() => {
  let list = fileList.value
  if (filterType.value) {
    list = list.filter(f => f.type_name === filterType.value)
  }
  return list
})

const filteredGroups = computed(() => {
  const groups = {}
  filteredFileList.value.forEach(file => {
    const date = file.uploaded_at?.split(' ')[0] || file.date || '未知'
    if (!groups[date]) {
      groups[date] = { date, files: [], totalSize: 0 }
    }
    groups[date].files.push(file)
    groups[date].totalSize += file.size || 0
  })
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
})

// ==================== HELPERS ====================
const isVideo = (file) => {
  if (!file) return false
  const m = (file.mime || '').toLowerCase()
  if (m.startsWith('video/')) return true
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return ['mp4', 'mov', 'm4v', 'webm', 'flv', 'mkv', 'avi'].includes(ext)
}

const isImage = (file) => {
  if (!file) return false
  const m = (file.mime || '').toLowerCase()
  if (m.startsWith('image/')) return true
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
}

const getPreviewKey = (file) => file?.id || file?.key || file?.url || ''

const getMediaPreviewUrl = (file) => {
  if (!file?.url && !file?.key) return ''
  return mediaPreviewUrls.value[getPreviewKey(file)] || file.url || ''
}

const ensureMediaPreviewUrl = async (file) => {
  if (!isVideo(file) || (!file?.url && !file?.key)) return ''
  const key = getPreviewKey(file)
  if (mediaPreviewUrls.value[key]) return mediaPreviewUrls.value[key]
  const { previewUrl } = await createMediaPreviewToken(file)
  mediaPreviewUrls.value = { ...mediaPreviewUrls.value, [key]: previewUrl }
  return previewUrl
}

const prepareMediaPreviewUrls = async (files = []) => {
  await Promise.allSettled(
    files
      .filter(file => isVideo(file) && (file.url || file.key))
      .map(file => ensureMediaPreviewUrl(file))
  )
}

const generateThumbnail = (event, file) => {
  const video = event.target
  if (!video || !file) return
  
  video.currentTime = 1
  video.addEventListener('seeked', () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 200
      canvas.height = video.videoHeight || 130
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      file.thumbnail_url = dataUrl
    } catch (e) {
      console.warn('生成缩略图失败（可能是CORS限制）:', e.message)
    }
  }, { once: true })
}

const seekVideoFrame = (event, file) => {
  const video = event.target
  if (!video || !file) return
  if (!file.duration && video.duration && Number.isFinite(video.duration)) {
    const minutes = Math.floor(video.duration / 60)
    const seconds = Math.floor(video.duration % 60)
    file.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  try {
    if (video.duration && video.currentTime < 0.1) {
      video.currentTime = Math.min(0.2, Math.max(0, video.duration - 0.1))
    }
  } catch (e) {
    // 某些浏览器/编码格式不允许立即 seek，保持默认首帧即可。
  }
}

const onVideoLoaded = (event, file) => {
  const video = event.target
  if (!video || !file) return
  video.addEventListener('seeked', () => {
    // 尝试通过canvas提取缩略图（CORS可能会阻止，但视频元素本身会显示第一帧）
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 200
      canvas.height = video.videoHeight || 130
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      file.thumbnail_url = dataUrl
    } catch (e) {
      // CORS导致canvas无法导出，但视频元素本身会显示第一帧，所以这里不报错
    }
    // 更新时长信息
    if (!file.duration && video.duration) {
      const minutes = Math.floor(video.duration / 60)
      const seconds = Math.floor(video.duration % 60)
      file.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }, { once: true })
}

const onVideoError = (event, file) => {
  const video = event.target
  console.warn('[MaterialList] 视频加载失败:', file?.url, video?.error)
}

const onPreviewError = (event) => {
  previewError.value = true
  console.warn('[MaterialList] 预览播放失败:', previewFile.value?.url, event.target?.error)
}

const formatBytes = (bytes) => {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

const formatSize = formatBytes

const formatTime = (s) => s ? dayjs(s).format('HH:mm') : '—'

const formatDateLabel = (date) => {
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  if (date === today) return '今天'
  if (date === yesterday) return '昨天'
  return dayjs(date).format('M月D日')
}

const formatWeekday = (date) => {
  const weekMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
  return weekMap[dayjs(date).day()]
}

// ==================== DATA LOAD ====================
const loadData = async () => {
  loading.value = true
  try {
    // 加载视频类型
    try {
      const types = await getVideoTypes()
      videoTypes.value = types
    } catch (e) {
      videoTypes.value = []
    }

    // 加载文件列表
    const params = { pageSize: 500 }
    if (filterDate.value) {
      params.date = filterDate.value
    }
    const res = await getMaterialFiles(params)
    fileList.value = (res.list || []).map(f => ({
      id: f.id,
      name: f.name,
      size: f.size || 0,
      size_human: formatBytes(f.size),
      type_name: f.type_name,
      video_type_id: f.video_type_id,
      url: f.url,
      key: f.cos_key || f.key,
      uploaded_at: f.uploaded_at || f.created_at,
      duration: f.duration || null,
      mime: f.mime || '',
      thumbnail_url: f.thumbnail_url
    }))
    await prepareMediaPreviewUrls(fileList.value)
  } catch (e) {
    ElMessage.error('加载文件列表失败：' + e.message)
  } finally {
    loading.value = false
  }
}

const refreshList = () => {
  selectedFiles.value = []
  loadData()
}

const handleDateFilter = (val) => {
  selectedFiles.value = []
  loadData()
}

const clearDateFilter = () => {
  filterDate.value = ''
  loadData()
}

// ==================== SELECTION ====================
const toggleSelect = (id) => {
  const idx = selectedFiles.value.indexOf(id)
  if (idx >= 0) {
    selectedFiles.value.splice(idx, 1)
  } else {
    selectedFiles.value.push(id)
  }
}

const copySelectedLinks = async () => {
  const links = fileList.value
    .filter(f => selectedFiles.value.includes(f.id))
    .map(f => f.url)
    .filter(Boolean)
    .join('\n')
  if (!links) {
    ElMessage.warning('所选文件没有可访问的链接')
    return
  }
  try {
    await navigator.clipboard.writeText(links)
    ElMessage.success(`已复制 ${selectedFiles.value.length} 个链接`)
  } catch {
    ElMessage.success('链接：\n' + links)
  }
}

const deleteSelected = async () => {
  const count = selectedFiles.value.length
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${count} 个文件吗？删除后将无法恢复。`, '批量删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }

  for (const id of selectedFiles.value) {
    const file = fileList.value.find(f => f.id === id)
    if (file?.key) {
      try { await cos.deleteObject(file.key) } catch {}
    }
    try { await deleteMaterialFile(id) } catch {}
  }
  ElMessage.success(`已删除 ${count} 个文件`)
  selectedFiles.value = []
  loadData()
}

// ==================== FILE OPERATIONS ====================
const openPreview = async (file) => {
  if (!file?.url && !file?.key) return ElMessage.warning('该文件暂无可播放的链接')
  let hasPreviewError = false
  if (isVideo(file)) {
    try {
      await ensureMediaPreviewUrl(file)
    } catch (e) {
      hasPreviewError = !file.url
      if (hasPreviewError) ElMessage.warning('页面内预览准备失败，可在新窗口打开原链接')
    }
  }
  previewFile.value = { ...file }
  previewError.value = hasPreviewError
  previewVisible.value = true
}

const closePreview = () => {
  previewVisible.value = false
  previewError.value = false
  setTimeout(() => { previewFile.value = null }, 300)
}

const openRename = (file) => {
  renameTarget.value = file
  renameForm.name = file.name
  renameVisible.value = true
}

const closeRename = () => {
  renameVisible.value = false
  renameTarget.value = null
}

const confirmRename = async () => {
  const t = renameTarget.value
  if (!t || !renameForm.name) return
  try {
    await updateMaterialFile(t.id, { name: renameForm.name })
    t.name = renameForm.name
    ElMessage.success('已重命名')
    closeRename()
  } catch (e) {
    t.name = renameForm.name
    ElMessage.success('已本地更新')
    closeRename()
  }
}

const copyLink = async (file) => {
  if (!file?.url) return ElMessage.warning('该文件暂无可复制的链接')
  try {
    await navigator.clipboard.writeText(file.url)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.success('链接：' + file.url)
  }
}

const copyPath = async (file) => {
  const text = file?.key || ''
  if (!text) return ElMessage.warning('路径为空')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('路径已复制')
  } catch {
    ElMessage.success('路径：' + text)
  }
}

const removeFile = async (file) => {
  try {
    await ElMessageBox.confirm(`确定删除「${file.name}」吗？删除后将无法恢复。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }

  try {
    if (file.key) await cos.deleteObject(file.key)
  } catch (e) {
    ElMessage.warning('云端删除失败，但将移除记录')
  }
  try {
    await deleteMaterialFile(file.id)
  } catch {}
  const idx = fileList.value.findIndex(f => f.id === file.id)
  if (idx >= 0) fileList.value.splice(idx, 1)
  ElMessage.success('已删除')
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => loadData())
</script>

<style scoped>
.material-list-page {
  position: relative;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

/* Page head */
.page-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; margin-bottom: 22px;
}
.head-left { display: flex; flex-direction: column; gap: 8px; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; color: #6b7280; font-weight: 500;
}
.eyebrow .dot {
  width: 6px; height: 6px; border-radius: 999px; background: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
}
.head-title {
  font-size: 26px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.015em; line-height: 1.2;
  display: flex; flex-direction: column; gap: 6px;
}
.head-sub { font-size: 13.5px; color: #6b7280; font-weight: 400; }
.head-right { display: flex; gap: 8px; align-items: center; }

/* Buttons */
.ghost-btn {
  height: 40px; padding: 0 16px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #ffffff; color: #374151;
  font-size: 13.5px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.18s ease; font-family: inherit;
}
.ghost-btn:hover { background: #f9fafb; border-color: #d1d5db; }

.primary-btn {
  height: 40px; padding: 0 18px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff; font-size: 13.5px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
  transition: all 0.18s ease; font-family: inherit;
}
.primary-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35); }

.mini-btn {
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #ffffff; color: #374151;
  font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.15s ease; font-family: inherit;
}
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.success { border-color: #10b981; color: #10b981; background: #f0fdf4; }
.mini-btn.danger { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
.mini-btn.danger:hover { background: #fef2f2; }

/* Panel */
.panel {
  background: #ffffff; border: 1px solid #ececf1;
  border-radius: 16px; padding: 20px 24px; margin-bottom: 20px;
}

/* Filter */
.filter-panel {}
.filter-row {
  display: flex; flex-direction: column; gap: 16px;
}
.filter-group {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.filter-label {
  font-size: 13px; color: #6b7280; font-weight: 500;
  min-width: 70px;
}

.date-picker-wrap {
  position: relative; display: flex; align-items: center;
}
.date-icon {
  position: absolute; left: 12px; color: #9ca3af; font-size: 15px;
  pointer-events: none; z-index: 1;
}
.inline-date-picker { width: 180px; }
:deep(.inline-date-picker .el-input__wrapper) {
  box-shadow: none; background: #f9fafb; padding-left: 36px;
  border-radius: 10px; height: 38px;
}

.clear-btn {
  height: 30px; padding: 0 10px; border-radius: 8px;
  border: 0; background: #f3f4f6; color: #6b7280;
  font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.15s ease;
}
.clear-btn:hover { background: #e5e7eb; color: #374151; }

.type-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.type-chip {
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #ffffff; color: #374151;
  font-size: 12.5px; cursor: pointer; transition: all 0.15s ease;
  display: inline-flex; align-items: center; gap: 4px;
}
.type-chip .iconfont { font-size: 16px; }
.type-chip:hover { border-color: #6366f1; color: #6366f1; }
.type-chip.active { font-weight: 600; }

.filter-meta {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 16px; padding-top: 14px; border-top: 1px dashed #e5e7eb;
}
.meta-text { font-size: 13px; color: #6b7280; }
.meta-text strong { color: #0f172a; font-weight: 600; }
.bulk-actions { display: flex; gap: 8px; align-items: center; }
.selected-count { font-size: 12.5px; color: #6366f1; font-weight: 500; }

/* File groups */
.file-groups { display: flex; flex-direction: column; gap: 24px; }

.day-group {}
.group-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.group-date { display: flex; align-items: center; gap: 10px; }
.date-badge {
  font-size: 15px; font-weight: 700; color: #0f172a;
}
.weekday { font-size: 12.5px; color: #9ca3af; }
.group-count { display: flex; align-items: center; gap: 10px; }
.count-pill {
  font-size: 11.5px; padding: 4px 10px; border-radius: 99px;
  background: #f3f4f6; color: #6b7280; font-weight: 500;
}
.size-sum { font-size: 12px; color: #9ca3af; }

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.file-card {
  position: relative;
  background: #ffffff; border: 1.5px solid #ececf1;
  border-radius: 14px; overflow: hidden;
  transition: all 0.2s ease;
}
.file-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}
.file-card.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.card-check {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  cursor: pointer;
}
.check-box {
  width: 20px; height: 20px; border-radius: 6px;
  border: 2px solid rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.5);
  display: grid; place-items: center;
  transition: all 0.15s ease;
}
.check-box.checked {
  background: #6366f1; border-color: #6366f1; color: #fff;
}

.card-thumb {
  position: relative; height: 130px;
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  display: grid; place-items: center;
  overflow: hidden; cursor: pointer;
}
.card-thumb img { width: 100%; height: 100%; object-fit: cover; }

.thumb-video-element {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  background: #000;
}
.thumb-video-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
  transition: background 0.2s ease;
}
.card-thumb:hover .thumb-video-overlay {
  background: rgba(0, 0, 0, 0.55);
}
.video-play-circle {
  width: 44px; height: 44px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  display: grid; place-items: center;
  color: #6366f1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.video-play-circle .el-icon { font-size: 20px; }
.thumb-video-overlay span {
  font-size: 11px; font-weight: 600;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 8px;
  border-radius: 999px;
}

.thumb-video {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: #6366f1;
}
.thumb-video .el-icon { font-size: 28px; }
.thumb-video span { font-size: 11px; font-weight: 600; color: #6366f1; }

.thumb-file {
  color: #9ca3af; font-size: 32px;
}

.thumb-overlay {
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  color: #fff; font-size: 12px; font-weight: 600;
  opacity: 0; transition: opacity 0.15s ease;
}
.thumb-overlay .el-icon { font-size: 24px; }
.card-thumb:hover .thumb-overlay { opacity: 1; }

.play-icon {
  position: absolute; bottom: 8px; right: 8px;
  width: 32px; height: 32px; border-radius: 999px;
  background: rgba(255,255,255,0.9);
  color: #0f172a; display: grid; place-items: center;
  font-size: 16px;
}
.file-card.video .play-icon { display: grid; }
.file-card:not(.video) .play-icon { display: none; }

.card-body {
  padding: 12px;
}
.card-name {
  font-size: 13px; font-weight: 600; color: #0f172a;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-bottom: 6px;
}
.card-meta {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: #9ca3af; margin-bottom: 6px;
}
.type-tag {
  font-size: 12px; padding: 0; border-radius: 0;
  background: transparent; color: #6b7280; font-weight: 500;
  display: inline-flex; align-items: center; gap: 4px;
}
.type-tag .iconfont { font-size: 15px; }

.card-actions {
  display: flex; gap: 4px; padding: 0 12px 12px;
  justify-content: center;
}
.op-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff;
  color: #6b7280; cursor: pointer;
  display: grid; place-items: center;
  transition: all 0.15s ease;
}
.op-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.op-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* Empty state */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 20px;
  text-align: center;
}
.empty-icon {
  width: 80px; height: 80px; border-radius: 20px;
  background: linear-gradient(135deg, #eef2ff, #f5f3ff);
  color: #6366f1; font-size: 36px;
  display: grid; place-items: center;
  margin-bottom: 20px;
}
.empty-text strong { font-size: 16px; color: #0f172a; display: block; margin-bottom: 6px; }
.empty-text p { font-size: 13.5px; color: #9ca3af; margin-bottom: 24px; }

/* Loading */
.loading-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(255,255,255,0.85);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
  font-size: 14px; color: #6366f1;
}
.loading-spinner {
  width: 36px; height: 36px; border-radius: 999px;
  border: 3px solid #e0e7ff;
  border-top-color: #6366f1;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.dialog-card {
  background: #fff; border-radius: 16px;
  width: 100%; max-width: 900px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  overflow: hidden;
}
.dialog-card.small { max-width: 480px; }
.dialog-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 20px 24px; border-bottom: 1px solid #f0f0f5;
}
.dialog-head h3 { font-size: 16px; font-weight: 700; color: #0f172a; }
.dialog-head .preview-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.icon-close {
  width: 32px; height: 32px; border-radius: 8px;
  border: 0; background: #f3f4f6; color: #6b7280;
  cursor: pointer; display: grid; place-items: center;
  transition: all 0.15s ease;
}
.icon-close:hover { background: #fee2e2; color: #ef4444; }

.dialog-body { padding: 20px 24px; }
.dialog-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 24px; border-top: 1px solid #f0f0f5;
}

.preview-card {}
.preview-body {
  background: #0f172a; max-height: 520px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.preview-video { width: 100%; max-height: 520px; display: block; }
.preview-img { max-width: 100%; max-height: 520px; display: block; }
.preview-other {
  padding: 40px 20px; color: #e5e7eb; text-decoration: none;
  display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 13.5px;
}
.preview-other .el-icon { font-size: 28px; }

.field-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: #374151; font-weight: 600;
}
.inline-input {
  width: 100%; height: 42px; border-radius: 10px;
  border: 1.5px solid #e5e7eb; background: #f9fafb;
  padding: 0 14px; font-size: 13.5px; color: #111827;
  outline: none; transition: all 0.18s ease;
}
.inline-input:focus {
  border-color: #6366f1; background: #fff;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .file-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .type-chips { gap: 4px; }
  .type-chip { height: 28px; padding: 0 8px; font-size: 11.5px; }
}
</style>
