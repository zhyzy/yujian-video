<template>
  <div class="page-wrap">
    <ConfigurablePageRenderer page-key="hqAccounts" :modules="hqAccountsLayoutModules">
    <template #page-head>
    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow"><span class="dot"></span>账号矩阵 · 总部主号</div>
        <h1 class="title">总部账号</h1>
        <p class="subtitle">总部自运营账号清单，聚焦账号基础信息、负责人和任务优先级。</p>
      </div>
      <div class="hero-right">
        <div class="chip-group">
          <button class="chip" :class="{ active: filter.platform === '' }" @click="filter.platform = ''">全平台</button>
          <button
            v-for="p in platforms"
            :key="p.key"
            class="chip"
            :class="{ active: filter.platform === p.key }"
            @click="filter.platform = p.key"
          >
            <i class="chip-dot" :style="{ background: p.color }"></i>{{ p.label }}
          </button>
        </div>
        <button class="btn-primary" @click="openCreate"><el-icon><Plus /></el-icon>新增账号</button>
      </div>
    </div>
    </template>

    <template #toolbar>
    <div class="summary-row">
      <div class="sum-card">
        <div class="sum-ic ic-indigo"><el-icon><OfficeBuilding /></el-icon></div>
        <div class="sum-main">
          <span class="sum-label">账号总数</span>
          <strong class="sum-value">{{ filteredList.length }}</strong>
        </div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-green"><el-icon><CircleCheckFilled /></el-icon></div>
        <div class="sum-main">
          <span class="sum-label">今日已发布</span>
          <strong class="sum-value">{{ todayPublished }}</strong>
        </div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-amber"><el-icon><Clock /></el-icon></div>
        <div class="sum-main">
          <span class="sum-label">待发布</span>
          <strong class="sum-value">{{ todayPending }}</strong>
        </div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-pink"><el-icon><Warning /></el-icon></div>
        <div class="sum-main">
          <span class="sum-label">高优任务</span>
          <strong class="sum-value">{{ highPriority }}</strong>
        </div>
      </div>
    </div>
    </template>

    <template #account-table>
    <div class="table-panel">
      <div class="table-scroll">
        <table class="hq-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>账号类型</th>
              <th>账号名称</th>
              <th>主页链接</th>
              <th>更新频率</th>
              <th>任务指数</th>
              <th>负责发布人</th>
              <th>视频产出目的</th>
              <th>备注</th>
              <th>拍摄剪辑</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredList" :key="row.id" class="data-row">
              <td>
                <span class="platform-chip" :class="'p-' + row.platform">
                  <IconFont :platform="row.platform" :color="platformColor(row.platform)" /> {{ platformLabel(row.platform) }}
                </span>
              </td>
              <td><span class="type-chip">{{ row.account_type || '未分类' }}</span></td>
              <td>
                <div class="name-cell">
                  <div class="avatar" :style="{ backgroundImage: avatarBg(row.platform) }">
                    <img v-if="avatarSrc(row.avatar)" :src="avatarSrc(row.avatar)" alt="" @error="handleImageError" />
                    <span>{{ firstChar(row.name) }}</span>
                  </div>
                  <div class="name-main">
                    <strong>{{ row.name }}</strong>
                    <span v-if="row.cert" class="name-sub">{{ row.cert }}</span>
                  </div>
                </div>
              </td>
              <td>
                <a v-if="row.url" :href="row.url" target="_blank" rel="noopener" class="url-link">{{ row.url }}</a>
                <span v-else class="url-link placeholder">-</span>
              </td>
              <td><span class="freq-chip">{{ row.frequency || '-' }}</span></td>
              <td>
                <span class="priority-chip" :class="'pri-' + (row.priority || 'medium')">
                  <i class="pri-dot"></i>{{ priorityLabel(row.priority) }}
                </span>
              </td>
              <td>
                <div class="owner-cell">
                  <div class="owner-avatar">
                    <img v-if="avatarSrc(row.owner_avatar)" :src="avatarSrc(row.owner_avatar)" alt="" @error="handleImageError" />
                    <span>{{ firstChar(row.owner) }}</span>
                  </div>
                  <span>{{ row.owner || '-' }}</span>
                </div>
              </td>
              <td><span class="purpose-chip">{{ row.purpose || '-' }}</span></td>
              <td><span class="remark-cell">{{ row.remark || '-' }}</span></td>
              <td><span class="editor-chip">{{ row.editor || '-' }}</span></td>
              <td class="action-cell">
                <button class="mini-btn" @click="editRow(row)"><el-icon><EditPen /></el-icon>编辑</button>
                <button class="mini-btn danger" @click="removeRow(row)"><el-icon><Delete /></el-icon>删除</button>
              </td>
            </tr>
            <tr v-if="!filteredList.length" class="empty-row">
              <td colspan="11">
                <div class="empty-inline">
                  <el-icon><FolderOpened /></el-icon>
                  <span>暂无账号数据</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editing ? '编辑总部账号' : '新增总部账号' }}</h3>
            <p>填写账号基础信息与运营配置。</p>
          </div>
          <button class="icon-close" @click="closeDialog"><el-icon><Close /></el-icon></button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <label class="form-field">
              <span>平台<em>*</em></span>
              <select v-model="form.platform" class="select-input">
                <option v-for="p in platforms" :key="p.key" :value="p.key">{{ p.label }}</option>
              </select>
            </label>
            <label class="form-field">
              <span>账号类型<em>*</em></span>
              <select v-model="form.account_type" class="select-input">
                <option value="" disabled>请选择类型</option>
                <option v-for="type in activeVideoTypes" :key="type.id" :value="type.name">
                  {{ type.icon || '' }} {{ type.name }}
                </option>
              </select>
            </label>
            <label class="form-field col-2">
              <span>账号名称<em>*</em></span>
              <input v-model="form.name" class="text-input" placeholder="请输入账号名称" />
            </label>
            <label class="form-field col-2">
              <span>主页链接（可选）</span>
              <input v-model="form.url" class="text-input" placeholder="https://..." />
            </label>
            <label class="form-field col-2">
              <span>认证信息</span>
              <input v-model="form.cert" class="text-input" placeholder="请输入认证信息" />
            </label>
            <label class="form-field col-2">
              <span>账号头像</span>
              <div class="avatar-edit-row">
                <div class="avatar-preview">
                  <img v-if="avatarSrc(form.avatar)" :src="avatarSrc(form.avatar)" alt="" @error="handleImageError" />
                  <span class="avatar-preview-text">{{ firstChar(form.name) }}</span>
                </div>
                <div class="avatar-inputs">
                  <input v-model="form.avatar" class="text-input flex-1" placeholder="本地头像地址，上传后自动生成" />
                  <label class="upload-btn" :class="{ uploading: uploadingAvatar }">
                    <el-icon v-if="!uploadingAvatar"><Upload /></el-icon>
                    <el-icon v-else class="spin"><Loading /></el-icon>
                    <input type="file" accept="image/*" hidden @change="handleAvatarUpload" />
                  </label>
                </div>
              </div>
            </label>
            <label class="form-field">
              <span>更新频率</span>
              <input v-model="form.frequency" class="text-input" placeholder="如：每日1条 / 每周2条" />
            </label>
            <label class="form-field">
              <span>任务指数</span>
              <select v-model="form.priority" class="select-input">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label class="form-field">
              <span>负责发布人</span>
              <input v-model="form.owner" class="text-input" placeholder="如：张林" />
            </label>
            <label class="form-field">
              <span>负责人头像</span>
              <div class="avatar-edit-row owner-row">
                <div class="avatar-preview owner-preview">
                  <img v-if="avatarSrc(form.owner_avatar)" :src="avatarSrc(form.owner_avatar)" alt="" @error="handleImageError" />
                  <span class="avatar-preview-text">{{ firstChar(form.owner) }}</span>
                </div>
                <div class="avatar-inputs">
                  <input v-model="form.owner_avatar" class="text-input flex-1" placeholder="本地头像地址，上传后自动生成" />
                  <label class="upload-btn" :class="{ uploading: uploadingOwnerAvatar }">
                    <el-icon v-if="!uploadingOwnerAvatar"><Upload /></el-icon>
                    <el-icon v-else class="spin"><Loading /></el-icon>
                    <input type="file" accept="image/*" hidden @change="handleOwnerAvatarUpload" />
                  </label>
                </div>
              </div>
            </label>
            <label class="form-field">
              <span>拍摄剪辑</span>
              <input v-model="form.editor" class="text-input" placeholder="如：宝玉、姜乾" />
            </label>
            <label class="form-field col-2">
              <span>视频产出目的</span>
              <input v-model="form.purpose" class="text-input" placeholder="如：招商加盟 / 做账号流量" />
            </label>
            <label class="form-field col-2">
              <span>备注</span>
              <input v-model="form.remark" class="text-input" placeholder="如：进行中" />
            </label>
          </div>
        </div>

        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button class="btn-primary" :disabled="saving || !form.name" @click="saveForm">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, EditPen, Close, Delete, OfficeBuilding, CircleCheckFilled, Clock, Warning, FolderOpened, Upload, Loading } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { createAccount, getAccounts, getAccountPublishStats, updateAccount, deleteAccount, uploadAvatar, getVideoTypes } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const hqAccountsLayoutModules = layoutModuleCatalog.hqAccounts
const { bindings: layoutBindings } = useLayoutBindings('hqAccounts')
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const list = ref([])
const filter = reactive({ platform: '' })
const publishStats = ref({ published: 0, pending: 0 })
const uploadingAvatar = ref(false)
const uploadingOwnerAvatar = ref(false)
const videoTypes = ref([])

const platforms = [
  { key: 'douyin', label: '抖音', color: '#ec4899' },
  { key: 'kuaishou', label: '快手', color: '#f97316' },
  { key: 'weixin', label: '视频号', color: '#10b981' },
  { key: 'xiaohongshu', label: '小红书', color: '#ef4444' }
]

const emptyForm = () => ({
  id: '',
  platform: 'douyin',
  account_type: '',
  name: '',
  url: '',
  cert: '',
  avatar: '',
  frequency: '每日1条',
  priority: 'medium',
  owner: '',
  owner_avatar: '',
  editor: '',
  purpose: '',
  remark: '',
  publish_status: {}
})

const form = reactive(emptyForm())

const filteredList = computed(() => {
  return filter.platform ? list.value.filter(row => row.platform === filter.platform) : list.value
})
const activeVideoTypes = computed(() => videoTypes.value.filter(item => item.status !== 'inactive' && item.status !== 'archived'))

const todayKey = computed(() => dayjs().format('YYYY-MM-DD'))
const todayPublished = computed(() => publishStats.value.published)
const todayPending = computed(() => publishStats.value.pending)
const highPriority = computed(() => filteredList.value.filter(row => row.priority === 'high').length)

const platformColor = (key) => platforms.find(item => item.key === key)?.color || '#6366f1'
const platformLabel = (key) => platforms.find(item => item.key === key)?.label || key || '-'
const priorityLabel = (key) => ({ high: '高', medium: '中', low: '低' }[key] || '中')
const firstChar = (value) => (value || '?').slice(0, 1)
const applyLayoutBindings = (bindings = {}) => {
  if ('platform' in bindings) filter.platform = bindings.platform === '全部' ? '' : (bindings.platform || '')
}
const avatarSrc = (value) => {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}
const handleImageError = (event) => {
  event.target.style.display = 'none'
}
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(file)
})
const avatarBg = (key) => {
  const map = {
    douyin: 'linear-gradient(135deg,#ec4899,#f472b6)',
    kuaishou: 'linear-gradient(135deg,#f97316,#fb923c)',
    weixin: 'linear-gradient(135deg,#10b981,#34d399)',
    xiaohongshu: 'linear-gradient(135deg,#ef4444,#f87171)'
  }
  return map[key] || 'linear-gradient(135deg,#6366f1,#8b5cf6)'
}

const loadData = async () => {
  loading.value = true
  try {
    const [accounts, types] = await Promise.all([
      getAccounts({ type: 'hq' }),
      getVideoTypes()
    ])
    list.value = accounts || []
    videoTypes.value = Array.isArray(types) ? types : []
  } catch {
    list.value = []
    videoTypes.value = []
    ElMessage.error('账号数据加载失败，请检查后端服务')
  } finally {
    loading.value = false
  }
  // 获取今日发布统计
  try {
    const stats = await getAccountPublishStats({ date: todayKey.value, type: 'hq' })
    publishStats.value = stats?.data || stats || { published: 0, pending: 0 }
  } catch {
    publishStats.value = { published: 0, pending: 0 }
  }
}

const openCreate = () => {
  editing.value = false
  Object.assign(form, emptyForm())
  showDialog.value = true
}

const editRow = (row) => {
  editing.value = true
  Object.assign(form, emptyForm(), row)
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
}

const saveForm = async () => {
  if (!form.name) return ElMessage.warning('请输入账号名称')
  if (!form.account_type) return ElMessage.warning('请选择账号类型')
  if (!activeVideoTypes.value.some(type => type.name === form.account_type)) {
    return ElMessage.warning('账号类型必须来自类型管理')
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateAccount(form.id, form)
    } else {
      await createAccount({ ...form, type: 'hq' })
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    await loadData()
  } finally {
    saving.value = false
  }
}

const handleAvatarUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  uploadingAvatar.value = true
  try {
    const data = await fileToDataUrl(file)
    const result = await uploadAvatar({ filename: file.name, mime: file.type, data })
    form.avatar = result.url
    ElMessage.success('头像上传成功')
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.message || '未知错误'))
  } finally {
    uploadingAvatar.value = false
  }
  // 清除 file input 以便重新选择同一文件
  e.target.value = ''
}

const handleOwnerAvatarUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  uploadingOwnerAvatar.value = true
  try {
    const data = await fileToDataUrl(file)
    const result = await uploadAvatar({ filename: file.name, mime: file.type, data })
    form.owner_avatar = result.url
    ElMessage.success('头像上传成功')
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.message || '未知错误'))
  } finally {
    uploadingOwnerAvatar.value = false
  }
  e.target.value = ''
}

const removeRow = (row) => {
  ElMessageBox.confirm(`确认删除账号“${row.name}”吗？`, '提示', { type: 'warning' })
    .then(async () => {
      await deleteAccount(row.id)
      list.value = list.value.filter(item => item.id !== row.id)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.page-wrap {
  min-height: calc(100vh - 60px);
  padding: 20px 24px 40px;
  background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%);
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding: 22px 24px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
  margin-bottom: 16px;
}
.hero-left { display: flex; flex-direction: column; gap: 6px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; }
.dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
.title { margin: 0; font-size: 26px; font-weight: 700; color: #0f172a; }
.subtitle { margin: 0; font-size: 13px; color: #6b7280; }
.hero-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.chip-group { display: flex; gap: 6px; padding: 4px; background: #f8fafc; border-radius: 10px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}
.chip.active { background: #fff; color: #4338ca; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
.chip-dot, .pc-dot, .pri-dot { width: 7px; height: 7px; border-radius: 999px; }
.btn-primary, .btn-ghost, .mini-btn, .icon-close {
  border: 0;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-primary {
  height: 40px;
  gap: 6px;
  padding: 0 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(99,102,241,0.3);
}
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-ghost {
  height: 40px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 13.5px;
  font-weight: 500;
}
.summary-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 14px;
  margin-bottom: 16px;
}
.sum-card { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px; border-radius: 10px; background: linear-gradient(135deg, #f5f3ff, #fff); border: 1px solid #ede9fe; }
.sum-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #fff; }
.ic-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.ic-green { background: linear-gradient(135deg, #10b981, #34d399); }
.ic-amber { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.ic-pink { background: linear-gradient(135deg, #ef4444, #f87171); }
.sum-main { display: flex; flex-direction: column; gap: 2px; }
.sum-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.sum-value { font-size: 20px; font-weight: 700; color: #0f172a; }
.table-panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.hq-table { width: 100%; min-width: 1380px; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.hq-table th {
  text-align: left;
  padding: 14px;
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.05em;
  background: linear-gradient(180deg, #fafbff, #f5f6fa);
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.hq-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
.data-row:hover { background: #fafbff; }
.platform-chip, .type-chip, .freq-chip, .priority-chip, .editor-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.platform-chip { background: transparent; color: #334155; display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; }
.p-douyin { background: transparent; color: #be185d; }
.p-kuaishou { background: transparent; color: #c2410c; }
.p-weixin { background: transparent; color: #047857; }
.p-xiaohongshu { background: #fef2f2; color: #b91c1c; }
.type-chip { background: #eef2ff; color: #4338ca; }
.freq-chip { background: #f1f5f9; color: #475569; }
.editor-chip { background: #faf5ff; color: #7c3aed; }
.priority-chip.pri-high { background: #fef2f2; color: #b91c1c; }
.priority-chip.pri-high .pri-dot { background: #ef4444; }
.priority-chip.pri-medium { background: #fef3c7; color: #b45309; }
.priority-chip.pri-medium .pri-dot { background: #f59e0b; }
.priority-chip.pri-low { background: #ecfdf5; color: #047857; }
.priority-chip.pri-low .pri-dot { background: #10b981; }
.name-cell { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.avatar { width: 34px; height: 34px; border-radius: 10px; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; overflow: hidden; position: relative; background-size: cover; background-position: center; }
.avatar img, .owner-avatar img, .avatar-preview img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; z-index: 1; }
.avatar span, .owner-avatar span, .avatar-preview span { position: relative; z-index: 0; }
.name-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.name-main strong { font-size: 13.5px; font-weight: 600; color: #0f172a; }
.name-sub { font-size: 11px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.owner-cell { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.owner-avatar { width: 26px; height: 26px; border-radius: 999px; background-image: linear-gradient(135deg, #6366f1, #8b5cf6); background-size: cover; background-position: center; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; overflow: hidden; flex-shrink: 0; position: relative; }
.url-link { font-size: 12px; color: #6366f1; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; max-width: 200px; }
.url-link:hover { text-decoration: underline; }
.url-link.placeholder { color: #94a3b8; }
.purpose-chip, .remark-cell { color: #64748b; white-space: nowrap; }
.action-cell { white-space: nowrap; }
.mini-btn {
  height: 28px;
  gap: 4px;
  margin-right: 4px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
.empty-row td { padding: 40px !important; }
.empty-inline { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #94a3b8; font-size: 13px; }
.dialog-overlay { position: fixed; inset: 0; display: grid; place-items: center; z-index: 2000; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); }
.dialog-card { width: 720px; max-width: calc(100vw - 40px); max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 18px; box-shadow: 0 30px 80px rgba(15,23,42,0.25); }
.dialog-head { padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; }
.dialog-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.dialog-head p { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }
.icon-close { width: 34px; height: 34px; border-radius: 9px; background: #f3f4f6; color: #6b7280; }
.dialog-body { padding: 22px 24px; overflow-y: auto; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field.col-2 { grid-column: span 2; }
.form-field span { font-size: 12.5px; color: #334155; font-weight: 500; }
.form-field em { color: #ef4444; font-style: normal; }
.text-input, .select-input { height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: #fafbfc; color: #0f172a; font-size: 13.5px; outline: 0; font-family: inherit; }
.text-input:focus, .select-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
.dialog-foot { padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f5f9; background: #fafbfc; }

/* Avatar editing */
.avatar-edit-row { display: flex; gap: 12px; align-items: flex-start; }
.avatar-inputs { display: flex; gap: 8px; flex: 1; align-items: center; }
.avatar-preview { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1.5px solid #e5e7eb; background: #f1f5f9; background-size: cover; background-position: center; position: relative; }
.owner-preview { border-radius: 999px; }
.avatar-preview-text { font-size: 14px; font-weight: 700; color: #94a3b8; }
.flex-1 { flex: 1; }
.upload-btn {
  width: 42px; height: 42px; border-radius: 10px;
  border: 1.5px dashed #cbd5e1; background: #fafbfc;
  display: grid; place-items: center; cursor: pointer;
  color: #6366f1; font-size: 16px; transition: all 0.15s;
  flex-shrink: 0;
}
.upload-btn:hover { border-color: #6366f1; background: #eef2ff; }
.upload-btn.uploading { border-color: #cbd5e1; background: #f1f5f9; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .hero { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
  .form-field.col-2 { grid-column: span 1; }
}
</style>
