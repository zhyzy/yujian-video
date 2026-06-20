<template>
  <div class="material-entry">
    <ConfigurablePageRenderer page-key="materialEntry" :modules="materialEntryLayoutModules">

    <template #page-head>
    <!-- ============ PAGE HEAD ============ -->
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>
          {{ copy.pageTitle }} · {{ todayLabel }}
        </div>
        <h1 class="head-title">
          录入今日素材
          <span class="head-sub">记录拍摄、剪辑与上传信息，便于后续统一管理与发布。</span>
        </h1>
      </div>
      <div class="head-right">
        <div class="head-date">
          <el-icon><Calendar /></el-icon>
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="head-date-picker"
            :popper-class="'material-entry-popper'"
          />
        </div>
        <button class="ghost-btn" @click="resetForm">
          <el-icon><Refresh /></el-icon>
          重置表单
        </button>
        <button class="primary-btn" @click="submitForm" :disabled="submitLoading">
          <el-icon><Check /></el-icon>
          {{ submitLoading ? '保存中…' : '保存记录' }}
        </button>
      </div>
    </div>
    </template>

    <template #entry-form>
      <!-- ===== LEFT: FORM ===== -->
      <div class="form-side">

        <!-- Section 1: 今日工作概览 -->
        <section class="panel">
          <div class="panel-head-row">
            <h2 class="panel-title">
              <span class="title-idx">01</span>
              {{ copy.todayOverview }}
            </h2>
            <span class="panel-subtitle">手动记录今日安排、完成情况和产出数量</span>
          </div>
          <div class="form-row two">
            <div class="field">
              <label class="field-label">
                <span class="label-text">{{ copy.shootingStaff }}</span>
                <span class="optional">(选填)</span>
              </label>
              <div class="field-input">
                <el-icon class="field-icon"><UserFilled /></el-icon>
                <input v-model="form.staff_name" class="inline-input" placeholder="例如：张伟、李明" />
              </div>
            </div>
            <div class="field">
              <label class="field-label">
                <span class="label-text">{{ copy.completionStatus }}</span>
              </label>
              <div class="field-input plain-select">
                <select v-model="form.completion_status" class="native-select">
                  <option value="planned">计划中</option>
                  <option value="doing">进行中</option>
                  <option value="done">已完成</option>
                  <option value="blocked">有阻塞</option>
                </select>
              </div>
            </div>
          </div>

          <div class="work-count-grid">
            <label class="work-count">
              <span>{{ copy.shootingMaterial }}</span>
              <input type="number" v-model.number="form.shoot_count" min="0" />
            </label>
            <label class="work-count">
              <span>剪辑成品</span>
              <input type="number" v-model.number="form.edit_count" min="0" />
            </label>
            <label class="work-count">
              <span>已上传成品</span>
              <input type="number" :value="fileList.length" disabled />
            </label>
          </div>

          <div class="field column" style="margin-top: 18px">
            <label class="field-label">
              <span class="label-text">{{ copy.todaySchedule }}</span>
              <span class="optional">(选填)</span>
            </label>
            <textarea
              v-model="form.work_plan"
              class="inline-textarea"
              rows="3"
              maxlength="300"
              placeholder="例如：上午拍摄招商类素材，下午剪辑并上传成片"
            />
            <div class="char-count"><span>{{ (form.work_plan || '').length }}</span>/300</div>
          </div>

          <div class="field column" style="margin-top: 18px">
            <label class="field-label">
              <span class="label-text">{{ copy.completionSummary }}</span>
              <span class="optional">(选填)</span>
            </label>
            <textarea
              v-model="form.work_done"
              class="inline-textarea"
              rows="3"
              maxlength="300"
              placeholder="例如：完成 4 条剪辑，2 条已上传，剩余素材待确认"
            />
            <div class="char-count"><span>{{ (form.work_done || '').length }}</span>/300</div>
          </div>
        </section>

        <!-- Section 2: 存储与备注 -->
        <section class="panel">
          <div class="panel-head-row">
            <h2 class="panel-title">
              <span class="title-idx">02</span>
              存储与备注
            </h2>
            <span class="panel-subtitle">上传路径会根据右侧分类自动建议</span>
          </div>

          <div class="storage-summary">
            <div class="storage-summary-item">
              <span>当前上传分类</span>
              <strong>{{ currentTypeName }}</strong>
            </div>
            <div class="storage-summary-item">
              <span>今日成品</span>
              <strong>{{ fileList.length }} 个</strong>
            </div>
          </div>

          <div class="field column" style="margin-top: 18px">
            <label class="field-label">
              <span class="label-text">网盘目录</span>
              <span class="optional">(自动建议，可修改)</span>
            </label>
            <div class="field-input">
              <el-icon class="field-icon"><FolderOpened /></el-icon>
              <input
                v-model="form.netdisk_path"
                class="inline-input"
                placeholder="如：/2026-06/招商类/0610/"
              />
            </div>
            <div class="field-suggest">
              <span class="suggest-label">建议路径</span>
              <button
                v-for="p in suggestedPaths"
                :key="p"
                class="suggest-chip"
                @click="form.netdisk_path = p"
              >{{ p }}</button>
            </div>
          </div>

          <div class="field column" style="margin-top: 18px">
            <label class="field-label">
              <span class="label-text">备注</span>
              <span class="optional">(选填)</span>
            </label>
            <textarea
              v-model="form.remark"
              class="inline-textarea"
              rows="3"
              maxlength="200"
              placeholder="补充说明，如：设备、场景、素材风格等"
            />
            <div class="char-count"><span>{{ (form.remark || '').length }}</span>/200</div>
          </div>
        </section>

      </div>
    </template>

    <template #entry-side>
      <!-- ===== RIGHT: SIDE PANEL (Today Overview + Upload Zone + File List) ===== -->
      <aside class="side-panel">

        <!-- --- Today Overview (top half) --- -->
        <section class="panel summary-panel">
          <div class="panel-head-row">
            <h2 class="panel-title">
              <span class="title-idx ghost">●</span>
              今日概览
            </h2>
            <span class="panel-subtitle">{{ dayLabelNow }}</span>
          </div>

          <div class="stat-grid">
            <div class="stat-big">
              <div class="stat-ring">
                <svg viewBox="0 0 64 64" width="80" height="80">
                  <circle cx="32" cy="32" r="26" stroke="#eef2ff" stroke-width="6" fill="none" />
                  <circle
                    cx="32" cy="32" r="26"
                    stroke="url(#gradUp)"
                    stroke-width="6"
                    fill="none"
                    stroke-linecap="round"
                    :stroke-dasharray="totalCircleLen"
                    :stroke-dashoffset="totalCircleLen - (uploadRatio * totalCircleLen)"
                    transform="rotate(-90 32 32)"
                    style="transition: stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)"
                  />
                  <defs>
                    <linearGradient id="gradUp" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#6366f1" />
                      <stop offset="100%" stop-color="#f97316" />
                    </linearGradient>
                  </defs>
                </svg>
                <div class="stat-ring-num">
                  <strong>{{ fileList.length }}</strong>
                  <span>已上传</span>
                </div>
              </div>
              <div class="stat-meta">
                <span class="label">总文件数</span>
                <strong class="num">{{ fileList.length }}</strong>
                <span class="sub">大小合计 {{ totalSizeHuman }}</span>
              </div>
            </div>

            <div class="stat-row">
              <div class="stat-mini">
                <span class="mini-ic upload"><el-icon><Upload /></el-icon></span>
                <span class="mini-num">{{ fileList.length }}</span>
                <span class="mini-lbl">成品</span>
              </div>
              <div class="stat-mini">
                <span class="mini-ic shoot"><el-icon><Document /></el-icon></span>
                <span class="mini-num">{{ uploadedTypeCount }}</span>
                <span class="mini-lbl">类型</span>
              </div>
              <div class="stat-mini">
                <span class="mini-ic edit"><el-icon><FolderOpened /></el-icon></span>
                <span class="mini-num">{{ totalSizeBrief }}</span>
                <span class="mini-lbl">大小</span>
              </div>
              <div class="stat-mini">
                <span class="mini-ic publish"><el-icon><Promotion /></el-icon></span>
                <span class="mini-num">{{ todayStats.publish }}</span>
                <span class="mini-lbl">发布</span>
              </div>
            </div>
          </div>

          <div class="side-tip">
            <el-icon class="tip-icon"><InfoFilled /></el-icon>
            <p>上传成功后，<strong>今日成品数</strong> 会自动更新。可在下方列表预览、重命名或删除文件。</p>
          </div>
        </section>

        <!-- --- Upload Zone (bottom half) --- -->
        <section class="panel upload-panel">
          <div class="upload-head">
            <h2 class="panel-title">
              <span class="title-idx upload-ic"><el-icon><Upload /></el-icon></span>
              上传到腾讯云 COS
            </h2>
            <div class="upload-filter">
              <el-select v-model="form.video_type_id" class="mini-select" placeholder="选择上传分类">
                <el-option v-for="t in videoTypeLabels" :key="t.id" :label="t.name" :value="t.id">
                  <span class="el-option-with-icon"><IconFont :typeName="t.name" /> {{ t.name }}</span>
                </el-option>
              </el-select>
              <button class="mini-create-type" @click="showTypeDialog = true"><el-icon><Plus /></el-icon></button>
            </div>
          </div>

          <!-- Dropzone -->
          <div
            class="dropzone"
            :class="{ dragging: isDragging, uploading: uploadingQueue.length }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              multiple
              class="hidden-input"
              @change="handleFilePick"
            />
            <div class="dropzone-hero">
              <div class="dropzone-ic">
                <el-icon><FolderAdd /></el-icon>
              </div>
              <div class="dropzone-text">
                <strong>拖拽文件到这里，或</strong>
                <button class="link-pick" @click="pickFile">点击选择文件</button>
              </div>
              <p class="dropzone-sub">
                自动按 <code>{{ currentPathPreview }}</code> 分组存储
              </p>
            </div>

            <!-- uploading -->
            <transition-group v-if="uploadingQueue.length" name="slide" tag="div" class="queue">
              <div v-for="u in uploadingQueue" :key="u.tempId" class="queue-item">
                <div class="queue-head">
                  <div class="queue-file">
                    <span class="queue-ic"><el-icon><Document /></el-icon></span>
                    <strong>{{ u.name }}</strong>
                    <em>{{ u.size_human }}</em>
                  </div>
                  <span class="queue-percent">{{ u.percent }}%</span>
                </div>
                <div class="queue-bar">
                  <i :style="{ width: u.percent + '%' }"></i>
                </div>
                <div class="queue-msg">{{ u.msg }}</div>
              </div>
            </transition-group>
          </div>

          <!-- File list -->
          <div v-if="fileList.length" class="file-list">
            <div class="file-list-head">
              <h3 class="file-list-title">已上传 · {{ filteredFileList.length }} 个</h3>
              <span class="file-list-hint">上传时间倒序</span>
            </div>

            <div class="file-grid">
              <div v-for="file in filteredFileList" :key="file.id" class="file-card" :class="{ video: isVideo(file) }">
                <div class="file-thumb" @click="openPreview(file)">
                  <template v-if="file.thumbnail_url">
                    <img :src="file.thumbnail_url" :alt="file.name" loading="lazy" />
                  </template>
                  <template v-else-if="isVideo(file)">
                    <div class="thumb-placeholder">
                      <el-icon><VideoCamera /></el-icon>
                      <span>视频</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="thumb-placeholder doc">
                      <el-icon><Document /></el-icon>
                      <span>文件</span>
                    </div>
                  </template>
                  <div class="file-mask">
                    <el-icon><View /></el-icon>
                    <span>预览</span>
                  </div>
                </div>
                <div class="file-body">
                  <div class="file-meta">
                    <strong class="file-name" :title="file.name">{{ file.name }}</strong>
                    <span class="file-type" v-if="file.type_name"><IconFont :typeName="file.type_name" /> {{ file.type_name }}</span>
                  </div>
                  <div class="file-info">
                    <span>{{ file.size_human }}</span>
                    <span>·</span>
                    <span v-if="file.duration">{{ file.duration }}</span>
                    <span v-if="file.duration">·</span>
                    <span>{{ formatTime(file.uploaded_at) }}</span>
                  </div>
                  <div class="file-actions">
                    <button class="op-btn" @click="openPreview(file)" title="预览">
                      <el-icon><View /></el-icon>
                      预览
                    </button>
                    <button class="op-btn" @click="copyLink(file)" title="复制链接">
                      <el-icon><Link /></el-icon>
                      链接
                    </button>
                    <button class="op-btn" @click="copyPath(file)" title="复制路径">
                      <el-icon><FolderOpened /></el-icon>
                      路径
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
          <div v-else class="empty-list">
            <div class="empty-ic"><el-icon><FolderOpened /></el-icon></div>
            <div>
              <strong>还没有上传记录</strong>
              <p>把剪辑好的成片拖到上方区域，即可完成上传 ✨</p>
            </div>
          </div>
        </section>

      </aside>
    </template>
    </ConfigurablePageRenderer>

    <!-- ============ TYPE CREATION DIALOG ============ -->
    <div class="dialog-overlay" v-if="showTypeDialog" @click.self="closeTypeDialog">
      <div class="dialog-card" @click.stop>
        <div class="dialog-head">
          <h3>新建视频类型</h3>
          <button class="icon-close" @click="closeTypeDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="field column">
            <label class="field-label"><span class="label-text">类型名称</span></label>
            <input v-model="typeForm.name" class="inline-input" placeholder="例如：探店类" />
          </div>
          <div class="field column" style="margin-top: 16px">
            <label class="field-label"><span class="label-text">图标 Emoji</span></label>
            <input v-model="typeForm.icon" class="inline-input" placeholder="例如：🏪" maxlength="2" />
            <div class="emoji-picker">
              <button
                v-for="e in emojiQuick"
                :key="e"
                class="emoji-btn"
                @click="typeForm.icon = e"
                :class="{ active: typeForm.icon === e }"
              >{{ e }}</button>
            </div>
          </div>
          <div class="field column" style="margin-top: 16px">
            <label class="field-label"><span class="label-text">主题色</span></label>
            <div class="color-picker">
              <button
                v-for="c in palette"
                :key="c"
                class="color-dot"
                :style="{ background: c }"
                :class="{ active: typeForm.color === c }"
                @click="typeForm.color = c"
              ></button>
              <input v-model="typeForm.color" class="color-hex" placeholder="#7C3AED" />
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeTypeDialog">取消</button>
          <button class="primary-btn" @click="createType" :disabled="!typeForm.name || !typeForm.icon">创建类型</button>
        </div>
      </div>
    </div>

    <!-- ============ VIDEO PREVIEW DIALOG ============ -->
    <div class="dialog-overlay" v-if="previewVisible" @click.self="closePreview">
      <div class="dialog-card preview-card" @click.stop>
        <div class="dialog-head">
          <div>
            <h3>{{ previewFile?.name || '视频预览' }}</h3>
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
            autoplay
            muted
            playsinline
            class="preview-video"
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

    <!-- ============ RENAME DIALOG ============ -->
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

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  Calendar, Check, Close, Delete, Document, EditPen, FolderAdd, FolderOpened, InfoFilled,
  Link, Plus, Promotion, Refresh, Upload, UserFilled, VideoCamera, View
} from '@element-plus/icons-vue'
import { createMediaPreviewToken, getVideoTypes, getStaffs, createMaterial, createVideoType, createMaterialFile, updateMaterialFile, deleteMaterialFile, getMaterialFiles } from '@/api'
import IconFont from '@/components/IconFont.vue'
import { getVideoTypeIcon } from '@/utils/iconMapping'
import cos from '@/utils/cos'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

// ==================== PAGE STATE ====================
const materialEntryLayoutModules = layoutModuleCatalog.materialEntry
const { bindings: layoutBindings } = useLayoutBindings('materialEntry')
const showTypeDialog = ref(false)
const submitLoading = ref(false)

const form = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  staff_id: '',
  staff_name: '',
  video_type_id: '',
  shoot_count: 0,
  edit_count: 0,
  netdisk_path: '',
  remark: '',
  work_plan: '',
  work_done: '',
  completion_status: 'planned'
})

const typeForm = reactive({ name: '', icon: '', color: '#7C3AED', sort_order: 0 })
const videoTypes = ref([])
const staffList = ref([])

const todayStats = reactive({ publish: 0 })
const settingsVersion = ref(0)
const materialEntryCopyDefaults = {
  pageTitle: '素材录入',
  todayOverview: '今日工作概览',
  shootingStaff: '拍摄人员',
  completionStatus: '完成状态',
  shootingMaterial: '拍摄素材',
  todaySchedule: '今日安排',
  completionSummary: '完成情况'
}
const readMaterialEntryCopy = () => {
  settingsVersion.value
  try {
    const settings = JSON.parse(localStorage.getItem('system_settings_v1') || '{}')
    return { ...materialEntryCopyDefaults, ...(settings.copy?.materialEntry || {}) }
  } catch {
    return materialEntryCopyDefaults
  }
}
const copy = computed(readMaterialEntryCopy)

const todayLabel = computed(() => {
  const d = dayjs()
  const weekMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
  return `${d.format('YYYY年M月D日')} · ${weekMap[d.day()]}`
})
const dayLabelNow = computed(() => dayjs().format('YYYY-MM-DD'))

const suggestedPaths = computed(() => {
  const base = dayjs().format('YYYY-MM')
  const day = dayjs().format('MMDD')
  const typeName = currentTypeName.value || '素材'
  return [
    `/${base}/${typeName}/${day}/`,
    `/${form.date}/${typeName}/`,
    `/${base}/成品素材/${day}/`
  ]
})

const videoTypeLabels = computed(() => videoTypes.value.map(t => ({ id: t.id, name: t.name, icon: t.icon })))
const currentTypeName = computed(() => videoTypes.value.find(t => t.id === form.video_type_id)?.name || '未分类')
const currentPathPreview = computed(() => {
  return `/${form.date}/${currentTypeName.value}/<文件名>_<时间戳>`
})

const emojiQuick = ['🏪', '👩', '🎬', '📢', '💆', '✨', '🎥', '🌟', '🏖', '🍜', '🎯', '💼']
const palette = ['#FF9F43', '#9B59B6', '#34C759', '#FF6B6B', '#5E5CE6', '#00B4D8', '#F59E0B', '#8B5CF6']

const resetForm = () => {
  form.date = dayjs().format('YYYY-MM-DD')
  form.staff_id = ''
  form.staff_name = ''
  form.video_type_id = videoTypes.value[0]?.id || ''
  form.shoot_count = 0
  form.edit_count = 0
  form.netdisk_path = ''
  form.remark = ''
  form.work_plan = ''
  form.work_done = ''
  form.completion_status = 'planned'
  ElMessage.info('表单已重置')
}

const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}

const applyLayoutBindings = (bindings = {}) => {
  const nextDate = normalizeBoundDate(bindings.date)
  if (nextDate) form.date = nextDate
  if ('staffName' in bindings) form.staff_name = bindings.staffName || ''
  if ('status' in bindings) form.completion_status = bindings.status || form.completion_status
  if ('shootCount' in bindings) form.shoot_count = Number(bindings.shootCount || 0)
  if ('editCount' in bindings) form.edit_count = Number(bindings.editCount || 0)
  if ('netdiskPath' in bindings) form.netdisk_path = bindings.netdiskPath || ''
  if ('remark' in bindings) form.remark = bindings.remark || ''
  if ('typeId' in bindings) form.video_type_id = bindings.typeId || form.video_type_id
}

const validate = () => {
  if (!form.date) return '请选择日期'
  if (!form.video_type_id) return '请选择视频类型'
  if (!form.netdisk_path) return '请输入网盘目录'
  return ''
}

const submitForm = async () => {
  const err = validate()
  if (err) {
    ElMessage.warning(err)
    return
  }
  submitLoading.value = true
  try {
    const uploadedCount = fileList.value.length
    await createMaterial({
      ...form,
      staff_id: form.staff_id || 'manual',
      shoot_count: Number(form.shoot_count) || 0,
      edit_count: Number(form.edit_count) || uploadedCount,
      upload_count: uploadedCount
    })
    ElMessage.success('保存成功')
    resetForm()
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    submitLoading.value = false
  }
}

// ==================== TYPE DIALOG ====================
const closeTypeDialog = () => { showTypeDialog.value = false }
const createType = async () => {
  if (!typeForm.name || !typeForm.icon) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    const data = await createVideoType(typeForm)
    videoTypes.value.push({ id: data.id, ...typeForm })
    ElMessage.success('创建成功')
    closeTypeDialog()
    typeForm.name = ''
    typeForm.icon = ''
  } catch (e) {
    ElMessage.error('创建失败：' + e.message)
  }
}

// ==================== UPLOAD & FILES ====================
const fileInputRef = ref(null)
const isDragging = ref(false)
const fileList = ref([])          // 已成功上传的文件记录（从后端获取 / 刚上传的）
const uploadingQueue = reactive([]) // 上传中的文件（带进度）
const mediaPreviewUrls = ref({})

// for overview ring
const totalCircleLen = 2 * Math.PI * 26
const uploadRatio = computed(() => {
  const base = fileList.value.length
  if (!base) return 0
  return 1
})

const totalSizeHuman = computed(() => formatBytes(fileList.value.reduce((n, f) => n + (f.size || 0), 0)))
const totalSizeBrief = computed(() => {
  const text = totalSizeHuman.value
  return text === '0 B' ? '0' : text.replace(' ', '')
})
const uploadedTypeCount = computed(() => new Set(fileList.value.map(f => f.type_name).filter(Boolean)).size)

const filteredFileList = computed(() => {
  return fileList.value
})

const pickFile = () => {
  if (fileInputRef.value) fileInputRef.value.click()
}

const handleFilePick = (e) => {
  const files = e.target.files ? Array.from(e.target.files) : []
  if (files.length) uploadFiles(files)
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragging.value = false
  const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
  if (files.length) uploadFiles(files)
}

const uploadFiles = async (files) => {
  if (!form.video_type_id) {
    ElMessage.warning('请先在上传卡片右上角选择视频类型')
    return
  }
  const typeName = videoTypes.value.find(t => t.id === form.video_type_id)?.name || '未分类'
  const filesArr = Array.isArray(files) ? files : [files]

  // 上传每个文件到 COS，同时在 uploadingQueue 显示进度
  const tasks = filesArr.map(async (file) => {
    const queueItem = reactive({
      tempId: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: file.name,
      size_human: formatBytes(file.size),
      percent: 0,
      msg: '准备上传到 COS…'
    })
    uploadingQueue.push(queueItem)

    try {
      const uploadRes = await cos.uploadFile(file, {
        typeName,
        onProgress: (p) => {
          queueItem.percent = Math.max(1, p.percent)
          queueItem.msg = p.percent < 100 ? `上传中… ${p.percent}%` : '上传完成，正在回写记录…'
        }
      })

      // 回写后端 -> material-file
      let payload = {
        name: file.name,
        size: file.size,
        key: uploadRes.key,
        url: uploadRes.url,
        type_name: typeName,
        video_type_id: form.video_type_id,
        date: form.date,
        staff_id: form.staff_id || undefined,
        duration: null,
        mime: file.type || '',
        uploaded_by: form.staff_name || '当前用户'
      }
      try {
        const resp = await createMaterialFile(payload)
        payload.id = resp?.id || 'local_' + Date.now()
        queueItem.msg = '✓ 已记录到素材列表'
      } catch (e) {
        queueItem.msg = '✓ 已上传 COS，写入记录失败：' + (e.message || '后端错误')
      }

      // 本地列表注入
      fileList.value.unshift({
        id: payload.id || uploadRes.key,
        name: file.name,
        size: file.size,
        size_human: formatBytes(file.size),
        type_name: typeName,
        video_type_id: form.video_type_id,
        url: uploadRes.url,
        key: uploadRes.key,
        uploaded_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        duration: payload.duration || null,
        mime: payload.mime
      })

    } catch (e) {
      queueItem.msg = '✗ 上传失败：' + (e.message || '未知错误')
      ElMessage.error('「' + file.name + '」上传失败：' + (e.message || '未知错误'))
    } finally {
      // 延迟 1.2s 从 queue 移除，让用户看到完成状态
      setTimeout(() => {
        const idx = uploadingQueue.findIndex(q => q.tempId === queueItem.tempId)
        if (idx >= 0) uploadingQueue.splice(idx, 1)
      }, 1200)
    }
  })

  await Promise.all(tasks)
}

// ==================== FILE OPERATIONS ====================
const isVideo = (file) => {
  if (!file) return false
  const m = (file.mime || '').toLowerCase()
  if (m.startsWith('video/')) return true
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return ['mp4', 'mov', 'm4v', 'webm', 'flv', 'mkv'].includes(ext)
}
const isImage = (file) => {
  if (!file) return false
  const m = (file.mime || '').toLowerCase()
  if (m.startsWith('image/')) return true
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
}

const previewVisible = ref(false)
const previewFile = ref(null)
const previewError = ref(false)

const getPreviewKey = (file) => file?.id || file?.key || file?.url || ''
const getMediaPreviewUrl = (file) => {
  if (!file?.url && !file?.key) return ''
  return mediaPreviewUrls.value[getPreviewKey(file)] || file.url
}
const ensureMediaPreviewUrl = async (file) => {
  if (!isVideo(file) || (!file?.url && !file?.key)) return ''
  const key = getPreviewKey(file)
  if (mediaPreviewUrls.value[key]) return mediaPreviewUrls.value[key]
  const { previewUrl } = await createMediaPreviewToken(file)
  mediaPreviewUrls.value = { ...mediaPreviewUrls.value, [key]: previewUrl }
  return previewUrl
}

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
  previewFile.value = file
  previewError.value = hasPreviewError
  previewVisible.value = true
}
const closePreview = () => {
  previewVisible.value = false
  previewError.value = false
  setTimeout(() => { previewFile.value = null }, 300)
}
const onPreviewError = () => {
  previewError.value = true
}

const renameVisible = ref(false)
const renameTarget = ref(null)
const renameForm = reactive({ name: '' })
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
    // 本地兜底：即便后端更新失败，也让前端可见变更
    t.name = renameForm.name
    ElMessage.success('已本地更新（后端写入失败：' + (e.message || '—') + '）')
    closeRename()
  }
}

const copyLink = async (file) => {
  if (!file?.url) return ElMessage.warning('该文件暂无可复制的链接')
  try {
    await navigator.clipboard.writeText(file.url)
    ElMessage.success('链接已复制到剪贴板')
  } catch {
    ElMessage.success('链接：' + file.url)
  }
}

const copyPath = async (file) => {
  const text = file?.key || file?.url || ''
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
    await ElMessageBox.confirm(`将同时删除云端文件「${file.name}」及其记录，确认吗？`, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }

  // 1) 删除 COS 对象
  try {
    await cos.deleteObject(file.key)
  } catch (e) {
    ElMessage.warning('云端删除失败，但将继续移除列表记录：' + (e.message || '—'))
  }
  // 2) 删除后端 material-file 记录
  try {
    await deleteMaterialFile(file.id)
  } catch (_) { /* 允许失败 */ }

  // 3) 本地列表移除
  const idx = fileList.value.findIndex(f => f.id === file.id)
  if (idx >= 0) fileList.value.splice(idx, 1)
  ElMessage.success('已删除')
}

// ==================== MISC / UTILS ====================
const formatBytes = (bytes) => {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
const formatTime = (s) => s ? dayjs(s).format('MM-DD HH:mm') : '—'

// ==================== DATA LOAD ====================
const loadData = async () => {
  try {
    const [types, staffs] = await Promise.all([getVideoTypes(), getStaffs()])
    videoTypes.value = types
    staffList.value = staffs
    if (types.length) form.video_type_id = types[0].id
  } catch (e) {
    videoTypes.value = [
      { id: 'type_1', name: '招商类', icon: '🏪', color: '#FF9F43', sort_order: 1 },
      { id: 'type_2', name: '技师类', icon: '👩', color: '#9B59B6', sort_order: 2 },
      { id: 'type_3', name: '剧情类', icon: '🎬', color: '#34C759', sort_order: 3 },
      { id: 'type_4', name: '品牌宣传', icon: '📢', color: '#FF6B6B', sort_order: 4 },
      { id: 'type_5', name: '服务展示', icon: '💆', color: '#5E5CE6', sort_order: 5 }
    ]
    staffList.value = [
      { id: 'staff_1', name: '李明', role: 'both' },
      { id: 'staff_2', name: '王晶', role: 'shooter' },
      { id: 'staff_3', name: '张伟', role: 'editor' }
    ]
    form.video_type_id = videoTypes.value[0].id
  }

  // 预填「网盘目录」，避免用户忘记填
  if (!form.netdisk_path) {
    const typeName = videoTypes.value.find(t => t.id === form.video_type_id)?.name || '素材'
    form.netdisk_path = `/${dayjs().format('YYYY-MM')}/${typeName}/${dayjs().format('MMDD')}/`
  }
  
  // 加载今日已上传的文件
  loadFilesForDate(form.date)
}

// 加载指定日期的文件列表
const loadFilesForDate = async (date) => {
  if (!date) return
  try {
    const res = await getMaterialFiles({ date, pageSize: 100 })
    const serverFiles = (res.list || []).map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      size_human: formatBytes(f.size),
      type_name: f.type_name,
      video_type_id: f.video_type_id,
      url: f.url,
      key: f.cos_key || f.key,
      uploaded_at: f.uploaded_at || f.created_at,
      duration: f.duration || null,
      mime: f.mime || ''
    }))
    // 合并：如果本地有但后端没有则保留（新增的），后端有的直接用
    serverFiles.forEach(sf => {
      const exists = fileList.value.find(f => f.id === sf.id)
      if (!exists) {
        fileList.value.push(sf)
      }
    })
  } catch (e) {
    console.warn('[MaterialEntry] 加载文件列表失败:', e.message)
  }
}

// 监听日期变化，加载对应日期的文件
watch(() => form.date, (newDate) => {
  if (newDate) {
    // 清空当前列表，重新加载
    fileList.value = []
    loadFilesForDate(newDate)
  }
})
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => {
  window.addEventListener('system-settings-updated', () => { settingsVersion.value++ })
  loadData()
})
</script>

<style scoped>
.material-entry { animation: fadeInUp 0.4s ease; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ---------- Page head ---------- */
.page-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; margin-bottom: 22px;
}
.head-left { display: flex; flex-direction: column; gap: 8px; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em;
}
.eyebrow .dot {
  width: 6px; height: 6px; border-radius: 999px; background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15); animation: pulse 2s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
.head-title {
  font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.015em;
  line-height: 1.2; display: flex; flex-direction: column; gap: 6px;
}
.head-sub { font-size: 13.5px; color: #6b7280; font-weight: 400; }
.head-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.head-date {
  height: 40px;
  min-width: 184px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
}
:deep(.head-date-picker) { width: 130px; }
:deep(.head-date-picker .el-input__wrapper) {
  padding: 0;
  box-shadow: none;
  background: transparent;
}
:deep(.head-date-picker .el-input__inner) {
  font-size: 13px;
  color: #111827;
}

.ghost-btn {
  height: 40px; padding: 0 16px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #ffffff; color: #374151;
  font-size: 13.5px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.18s ease; font-family: inherit;
}
.ghost-btn:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }

.primary-btn {
  height: 40px; padding: 0 18px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff; font-size: 13.5px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
  transition: all 0.18s ease; font-family: inherit;
}
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35); }
.primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }

/* ---------- Main Grid ---------- */
.entry-grid {
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px; align-items: flex-start;
}

/* ---------- Panel ---------- */
.panel {
  background: #ffffff; border: 1px solid #ececf1;
  border-radius: 16px; padding: 22px 24px; margin-bottom: 16px;
}
.panel:last-child { margin-bottom: 0; }

.panel-head-row {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px dashed #eef0f5;
}
.panel-title {
  font-size: 15.5px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.005em; display: inline-flex; align-items: center; gap: 10px;
}
.title-idx {
  display: inline-grid; place-items: center;
  width: 26px; height: 26px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 12px; font-weight: 700;
  font-family: 'SF Mono', monospace; letter-spacing: 0.02em;
}
.title-idx.ghost { background: #eef2ff; color: #6366f1; }
.title-idx.upload-ic { background: linear-gradient(135deg, #f97316, #ec4899); }
.panel-subtitle { font-size: 12.5px; color: #9ca3af; }
.panel-subtitle .req { color: #ef4444; font-style: normal; margin-right: 2px; }

/* ---------- Form rows ---------- */
.form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field { display: flex; flex-direction: column; }
.field.column { display: flex; flex-direction: column; }
.field-label {
  display: inline-flex; align-items: center; gap: 4px;
  margin-bottom: 8px; font-size: 13px; color: #374151; font-weight: 600;
}
.label-text { color: #111827; }
.field-label .req { color: #ef4444; font-style: normal; font-size: 13px; margin-left: 2px; }
.field-label .optional { color: #9ca3af; font-size: 12px; font-weight: 400; margin-left: 4px; }

.field-input {
  position: relative; display: flex; align-items: center;
  height: 42px; border-radius: 10px;
  background: #f9fafb; border: 1.5px solid transparent;
  transition: all 0.18s ease; overflow: hidden;
}
.field-input:hover { background: #f3f4f6; }
.field-input:focus-within {
  background: #ffffff; border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
}
.field-input.plain-select { padding: 0 12px; }
.native-select {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #111827;
  font-size: 13.5px;
  font-family: inherit;
}
.field-icon {
  position: absolute; left: 12px; color: #9ca3af; font-size: 15px;
  pointer-events: none;
}
.inline-input, .inline-textarea {
  flex: 1; border: 0; outline: 0; background: transparent;
  font-size: 13.5px; color: #111827;
  padding: 0 14px 0 38px; width: 100%; height: 100%; font-family: inherit;
}
.inline-textarea {
  height: auto; padding: 12px 14px; border-radius: 10px;
  background: #f9fafb; resize: vertical; min-height: 88px;
  line-height: 1.6; transition: all 0.18s ease; border: 1.5px solid transparent;
}
.inline-textarea:focus {
  background: #fff; border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99,102,241,0.12);
}
.char-count { text-align: right; font-size: 11.5px; color: #9ca3af; margin-top: 6px; }
.char-count span { color: #6366f1; font-weight: 600; font-variant-numeric: tabular-nums; }

:deep(.inline-picker), :deep(.inline-select) { flex: 1; height: 100%; }
:deep(.inline-picker .el-input__wrapper),
:deep(.inline-select .el-input__wrapper) {
  box-shadow: none; background: transparent; padding: 0 14px 0 38px;
  height: 100%; border-radius: 0;
}
:deep(.inline-picker .el-input__inner),
:deep(.inline-select .el-input__inner) { font-size: 13.5px; color: #111827; }
:deep(.el-select-dropdown__item) { display: flex; align-items: center; gap: 10px; }
.option-ava {
  width: 26px; height: 26px; border-radius: 8px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4338ca; display: grid; place-items: center;
  font-size: 12px; font-weight: 700;
}
.option-role { margin-left: auto; font-size: 11.5px; color: #9ca3af; font-weight: 400; }

.field-suggest {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px; align-items: center;
}
.suggest-label { font-size: 11.5px; color: #9ca3af; margin-right: 2px; }
.suggest-chip {
  border: 0; padding: 5px 10px; border-radius: 6px;
  background: #eef2ff; color: #4338ca; font-size: 11.5px;
  font-family: 'SF Mono', monospace; cursor: pointer; transition: all 0.18s ease;
}
.suggest-chip:hover { background: #e0e7ff; transform: translateY(-1px); }

.work-count-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}
.work-count {
  min-height: 76px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #ececf1;
  border-radius: 12px;
  background: #fafbff;
}
.work-count span {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
.work-count input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
  font-family: inherit;
}
.work-count input:disabled {
  color: #6366f1;
  opacity: 1;
}
.storage-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.storage-summary-item {
  padding: 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #eef0f5;
}
.storage-summary-item span {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
}
.storage-summary-item strong {
  color: #0f172a;
  font-size: 16px;
}

/* ---------- Type Grid ---------- */
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.type-card {
  position: relative; display: flex; align-items: center; gap: 12px;
  padding: 14px; border: 1.5px solid #ececf1;
  border-radius: 12px; background: #fff;
  cursor: pointer; transition: all 0.2s ease; text-align: left;
}
.type-card:hover {
  border-color: #d1d5db; transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.05);
}
.type-card.active {
  border-color: #6366f1; background: linear-gradient(135deg, #ffffff, #fafaff);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.14);
}
.type-avatar {
  width: 40px; height: 40px; border-radius: 10px;
  display: grid; place-items: center; font-size: 18px; flex-shrink: 0;
}
.type-avatar.add { background: #f3f4f6; color: #6b7280; font-size: 16px; }

.type-meta { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.type-meta strong { font-size: 13.5px; color: #111827; font-weight: 600; }
.type-meta .type-desc { font-size: 11.5px; color: #9ca3af; }

.type-check {
  width: 22px; height: 22px; border-radius: 999px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; display: grid; place-items: center; font-size: 12px; flex-shrink: 0;
}
.type-card.add { border-style: dashed; border-color: #d1d5db; color: #6b7280; background: #fafafa; }
.type-card.add:hover { border-color: #6366f1; color: #6366f1; background: #fff; }
.type-card.add .type-meta strong { color: inherit; font-weight: 600; }

/* =================== SIDE PANEL =================== */
.side-panel { min-width: 0; position: sticky; top: 12px; }

/* ---- Summary panel ---- */
.summary-panel {
  background:
    linear-gradient(135deg, #ffffff 0%, #fafbff 55%, #f0f4ff 100%);
  border: 1px solid #e6e8f3;
}
.stat-grid { display: flex; flex-direction: column; gap: 18px; }

.stat-big { display: flex; align-items: center; gap: 18px; }
.stat-ring { position: relative; width: 80px; height: 80px; }
.stat-ring svg { display: block; }
.stat-ring-num {
  position: absolute; inset: 0; display: flex;
  flex-direction: column; align-items: center; justify-content: center;
}
.stat-ring-num strong { font-size: 20px; color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat-ring-num span { font-size: 10.5px; color: #9ca3af; margin-top: 2px; }

.stat-meta { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.stat-meta .label { font-size: 11.5px; color: #9ca3af; font-weight: 500; }
.stat-meta .num { font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.015em; }
.stat-meta .sub { font-size: 11.5px; color: #6b7280; }

.stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  padding: 12px; background: #fff; border-radius: 12px; border: 1px solid #eef0f7;
}
.stat-mini { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; transition: background .15s; }
.stat-mini:hover { background: #f8fafc; }
.mini-ic {
  width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
  font-size: 14px; color: #fff;
}
.mini-ic.shoot { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.mini-ic.edit { background: linear-gradient(135deg, #10b981, #34d399); }
.mini-ic.upload { background: linear-gradient(135deg, #f97316, #fb923c); }
.mini-ic.publish { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
.mini-num { font-size: 16px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
.mini-lbl { font-size: 11px; color: #9ca3af; }

.side-tip {
  display: flex; gap: 10px; padding: 12px; margin-top: 16px;
  background: linear-gradient(135deg, #fff7ed, #eef2ff);
  border-radius: 10px; border: 1px solid #e5e7eb;
}
.tip-icon { color: #8b5cf6; font-size: 16px; flex-shrink: 0; margin-top: 2px; }
.side-tip p { font-size: 12.5px; line-height: 1.6; color: #4b5563; margin: 0; }
.side-tip strong { color: #6366f1; }

/* ---- Upload panel ---- */
.upload-panel {
  background: linear-gradient(180deg, #ffffff 0%, #fafbff 60%, #f5f3ff 100%);
  border: 1px solid #e6e8f3;
}
.upload-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.upload-filter { display: flex; align-items: center; gap: 6px; }
.mini-select {
  height: 30px; padding: 0 10px; border-radius: 8px;
  background: #fff; border: 1px solid #e5e7eb; color: #374151;
  font-size: 12px; cursor: pointer; font-family: inherit;
}
.mini-select:hover { border-color: #6366f1; color: #4338ca; }
.mini-create-type {
  width: 34px;
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  color: #6366f1;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-create-type:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}

/* Dropzone */
.dropzone {
  position: relative;
  border-radius: 14px;
  padding: 26px;
  border: 2px dashed #c7d2fe;
  background: linear-gradient(135deg, #eef2ff 0%, #fdf4ff 100%);
  text-align: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  overflow: hidden;
}
.dropzone::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(1200px 300px at 50% -20%, rgba(99, 102, 241, 0.15), transparent 60%);
  pointer-events: none;
}
.dropzone:hover {
  border-color: #6366f1;
  background: linear-gradient(135deg, #e0e7ff 0%, #fae8ff 100%);
  transform: translateY(-1px);
}
.dropzone.dragging {
  border-color: #f97316;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
}
.dropzone.uploading { border-color: #10b981; }
.hidden-input { display: none; }

.dropzone-hero { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.dropzone-ic {
  width: 56px; height: 56px; border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #ec4899);
  color: #fff; display: grid; place-items: center;
  font-size: 24px; margin-bottom: 4px;
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.25);
  animation: float 3s ease-in-out infinite;
}
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.dropzone-text { display: flex; align-items: center; gap: 6px; font-size: 14.5px; color: #374151; }
.dropzone-text strong { font-weight: 700; color: #0f172a; }
.link-pick {
  display: inline-block; border: 0; background: transparent;
  color: #6366f1; font-weight: 700; cursor: pointer; font-family: inherit;
  padding: 0 4px; text-decoration: underline dotted;
}
.link-pick:hover { color: #4338ca; }
.dropzone-sub {
  margin: 4px 0 0; font-size: 11.5px; color: #6b7280;
}
.dropzone-sub code {
  background: rgba(255,255,255,0.65); padding: 2px 6px;
  border-radius: 5px; color: #4338ca;
  font-size: 11px; font-family: 'SF Mono', monospace;
}

/* Queue */
.queue { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
.queue-item {
  background: #fff; border: 1px solid #e6e8f3; border-radius: 10px;
  padding: 10px 12px; text-align: left;
}
.queue-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px;
}
.queue-file { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #374151; min-width: 0; flex: 1; }
.queue-file strong { color: #0f172a; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.queue-file em { color: #9ca3af; font-style: normal; font-size: 11.5px; margin-left: 4px; flex-shrink: 0; }
.queue-ic { color: #6366f1; display: inline-flex; align-items: center; }
.queue-percent { font-size: 12px; color: #10b981; font-weight: 700; font-variant-numeric: tabular-nums; }
.queue-bar {
  height: 5px; background: #eef2ff; border-radius: 99px; overflow: hidden; margin-top: 4px;
}
.queue-bar i {
  display: block; height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, #6366f1, #10b981);
  transition: width 0.25s ease;
}
.queue-msg { font-size: 11.5px; color: #6b7280; margin-top: 4px; }

/* File list */
.file-list { margin-top: 18px; }
.file-list-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px dashed #e5e7eb;
}
.file-list-title { font-size: 13px; color: #0f172a; font-weight: 700; }
.file-list-hint { font-size: 11.5px; color: #9ca3af; }

.file-grid { display: flex; flex-direction: column; gap: 10px; }
.file-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: #fff; border-radius: 12px;
  border: 1px solid #ececf1;
  transition: all 0.2s ease;
}
.file-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
}
.file-thumb {
  position: relative;
  width: 52px; height: 52px; border-radius: 10px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #6366f1;
  display: grid; place-items: center; font-size: 18px;
  overflow: hidden; flex-shrink: 0;
  cursor: pointer;
}
.file-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.file-thumb .thumb-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.file-thumb .thumb-placeholder span {
  font-size: 10.5px; font-weight: 600; color: #6366f1;
}
.file-thumb.doc {
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb); color: #6b7280;
}
.file-mask {
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  color: #fff; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  opacity: 0; transition: opacity 0.15s ease;
  font-size: 10.5px; font-weight: 600;
}
.file-thumb:hover .file-mask { opacity: 1; }
.file-thumb .file-mask i { font-size: 16px; }

.file-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.file-meta {
  display: flex; align-items: center; gap: 8px; justify-content: space-between;
}
.file-name { font-size: 13px; color: #0f172a; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-type {
  font-size: 12px; padding: 0; border-radius: 0;
  background: transparent; color: #6b7280; font-weight: 500; flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 4px;
}
.file-type .iconfont { font-size: 15px; }
.file-info {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: #6b7280; flex-wrap: wrap;
}
.file-actions { display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.op-btn {
  height: 28px; padding: 0 8px; border-radius: 7px;
  border: 1px solid #e5e7eb; background: #fff;
  color: #374151; font-size: 11.5px; font-weight: 500;
  cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.15s ease; font-family: inherit;
}
.op-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.op-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* Empty list */
.empty-list {
  padding: 18px 12px; text-align: center;
}
.empty-ic {
  width: 48px; height: 48px; border-radius: 12px;
  background: #eef2ff; color: #6366f1;
  display: grid; place-items: center;
  margin: 0 auto 8px; font-size: 22px;
}
.empty-list strong { font-size: 13px; color: #0f172a; font-weight: 600; display: block; }
.empty-list p { font-size: 11.5px; color: #6b7280; margin: 4px 0 0; }

/* Preview dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.52);
}
.dialog-card {
  width: min(100%, 560px);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
}
.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid #f0f0f5;
}
.dialog-head h3 {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}
.dialog-body {
  padding: 20px 22px;
}
.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid #f0f0f5;
}
.icon-close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: #f3f4f6;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.16s ease;
}
.icon-close:hover {
  background: #fee2e2;
  color: #ef4444;
}
.preview-card { max-width: 820px; }
.preview-sub { font-size: 12px; color: #6b7280; }
.preview-body {
  padding: 0; background: #0f172a;
  display: flex; justify-content: center; align-items: center;
  max-height: 520px; overflow: hidden;
}
.preview-video {
  width: 100%; max-height: 520px; display: block; background: #0f172a;
}
.preview-img { max-width: 100%; max-height: 520px; display: block; }
.preview-other {
  padding: 40px 20px; color: #e5e7eb; text-decoration: none;
  display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 13.5px;
}
.preview-other i { font-size: 28px; }

/* Rename dialog */
.dialog-card.small { max-width: 480px; }

/* Responsive */
@media (max-width: 1100px) {
  .entry-grid { grid-template-columns: 1fr; }
  .form-row.two { grid-template-columns: 1fr; }
  .work-count-grid,
  .storage-summary { grid-template-columns: 1fr; }
}
.el-option-with-icon { display: inline-flex; align-items: center; gap: 6px; }
</style>
