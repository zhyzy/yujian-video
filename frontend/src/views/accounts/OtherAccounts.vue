<template>
  <div class="page-wrap">
    <ConfigurablePageRenderer page-key="otherAccounts" :modules="otherAccountsLayoutModules">

    <template #page-head>
    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow"><span class="dot"></span>其他账号 · 备用/测试/个人号</div>
        <h1 class="title">其他账号</h1>
        <p class="subtitle">灵活管理其他用途的账号，分类存放</p>
      </div>
      <div class="hero-right">
        <div class="chip-group">
          <button class="chip" :class="{active: filter.type === ''}" @click="filter.type = ''">全部</button>
          <button v-for="t in typeList" :key="t" class="chip" :class="{active: filter.type === t}" @click="filter.type = t">{{ t }}</button>
        </div>
        <button class="btn-primary" @click="openDialog"><el-icon><Plus /></el-icon>新增账号</button>
      </div>
    </div>
    </template>

    <template #toolbar>
    <div class="summary-row">
      <div class="sum-card"><div class="sum-ic ic-indigo"><el-icon><Collection /></el-icon></div><div class="sum-main"><span class="sum-label">账号总数</span><strong class="sum-value">{{ accounts.length }}</strong></div></div>
      <div class="sum-card"><div class="sum-ic ic-green"><el-icon><CircleCheckFilled /></el-icon></div><div class="sum-main"><span class="sum-label">活跃</span><strong class="sum-value">{{ activeCount }}</strong></div></div>
      <div class="sum-card"><div class="sum-ic ic-amber"><el-icon><Clock /></el-icon></div><div class="sum-main"><span class="sum-label">待处理</span><strong class="sum-value">{{ pendingCount }}</strong></div></div>
      <div class="sum-card"><div class="sum-ic ic-pink"><el-icon><Warning /></el-icon></div><div class="sum-main"><span class="sum-label">暂停</span><strong class="sum-value">{{ pausedCount }}</strong></div></div>
    </div>
    </template>

    <template #account-table>
    <div class="grid">
      <div v-for="a in filteredAccounts" :key="a.id" class="card">
        <div class="card-top">
          <div class="avatar" :style="{background: colorFromName(a.name)}">{{ (a.name || '?').charAt(0) }}</div>
          <div class="title-wrap">
            <strong class="name">{{ a.name }}</strong>
            <span class="type">{{ a.type }}</span>
          </div>
          <span class="st" :class="'st-'+a.status">{{ statusLabel(a.status) }}</span>
        </div>
        <div class="meta">
          <div class="meta-item"><el-icon><Collection /></el-icon><span>{{ a.platform_label || a.platform }}</span></div>
          <div class="meta-item" v-if="a.owner"><el-icon><UserFilled /></el-icon><span>{{ a.owner }}</span></div>
          <div class="meta-item" v-if="a.url"><el-icon><Link /></el-icon><a :href="a.url" target="_blank" rel="noopener" class="ellipsis">{{ a.url }}</a></div>
        </div>
        <p v-if="a.remark" class="remark">{{ a.remark }}</p>
        <div class="foot">
          <button class="mini-btn" @click="editRow(a)"><el-icon><EditPen /></el-icon>编辑</button>
          <button class="mini-btn danger" @click="removeRow(a)"><el-icon><Delete /></el-icon>删除</button>
        </div>
      </div>
      <div class="card empty" v-if="!filteredAccounts.length">
        <el-icon><FolderOpened /></el-icon>
        <span>暂无账号，点击右上角新增</span>
      </div>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card wide">
        <div class="dialog-head">
          <div><h3>{{ editing ? '编辑账号' : '新增其他账号' }}</h3><p>自定义用途/灵活管理</p></div>
          <button class="icon-close" @click="closeDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="form-row two">
            <div class="form-field">
              <label>账号名称<em>*</em></label>
              <input v-model="form.name" class="text-input" placeholder="如：测试号01" />
            </div>
            <div class="form-field">
              <label>分类</label>
              <input v-model="form.type" class="text-input" list="typeList" placeholder="如：测试 / 备用 / 个人" />
              <datalist id="typeList"><option v-for="t in typeList" :key="t" :value="t"></option></datalist>
            </div>
          </div>
          <div class="form-row two">
            <div class="form-field">
              <label>平台</label>
              <input v-model="form.platform_label" class="text-input" placeholder="如：抖音 / 快手" />
            </div>
            <div class="form-field">
              <label>负责人</label>
              <input v-model="form.owner" class="text-input" placeholder="可选" />
            </div>
          </div>
          <div class="form-field">
            <label>账号链接</label>
            <input v-model="form.url" class="text-input" placeholder="https://..." />
          </div>
          <div class="form-row two">
            <div class="form-field">
              <label>状态</label>
              <select v-model="form.status" class="select-input">
                <option value="active">活跃</option>
                <option value="pending">待处理</option>
                <option value="paused">暂停</option>
              </select>
            </div>
            <div class="form-field">
              <label>备注</label>
              <input v-model="form.remark" class="text-input" placeholder="可选说明" />
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button class="btn-primary" :disabled="!form.name" @click="saveForm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, EditPen, Close, Delete, CircleCheckFilled, Clock, Warning, FolderOpened, UserFilled, Link } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getPlatformIcon } from '@/utils/iconMapping'
import { createAccount, getAccounts, updateAccount, deleteAccount } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const otherAccountsLayoutModules = layoutModuleCatalog.otherAccounts
const { bindings: layoutBindings } = useLayoutBindings('otherAccounts')
const accounts = ref([])
const filter = reactive({ type: '', status: '' })
const typeList = ['测试', '备用', '个人', '官方']
const statusLabel = (s) => ({ active: '活跃', pending: '待处理', paused: '暂停' }[s] || s)

const palette = ['#6366f1','#8b5cf6','#ec4899','#f97316','#10b981','#0ea5e9','#f59e0b','#ef4444','#14b8a6','#84cc16']
const colorFromName = (name) => {
  const n = (name || '').charCodeAt(0) || 1
  return palette[n % palette.length]
}

const showDialog = ref(false)
const editing = ref(null)
const emptyForm = () => ({ id: '', name: '', type: '测试', platform: 'other', platform_label: '', owner: '', url: '', status: 'active', remark: '' })
const form = reactive(emptyForm())

// Map free text platform labels to iconfont class
const labelToPlatformKey = {
  '抖音': 'douyin',
  '快手': 'kuaishou',
  '视频号': 'weixin',
  '小红书': 'xiaohongshu'
}
const getOtherPlatformIcon = (account) => {
  const key = labelToPlatformKey[account.platform_label] || labelToPlatformKey[account.platform]
  return key ? getPlatformIcon(key) : ''
}

const activeCount = computed(() => accounts.value.filter(a => a.status === 'active').length)
const pendingCount = computed(() => accounts.value.filter(a => a.status === 'pending').length)
const pausedCount = computed(() => accounts.value.filter(a => a.status === 'paused').length)
const filteredAccounts = computed(() => accounts.value.filter((account) => {
  const typeMatched = filter.type ? account.type === filter.type : true
  const statusMatched = filter.status ? account.status === filter.status : true
  return typeMatched && statusMatched
}))

const normalizeStatus = (value) => ({ inactive: 'paused', all: '' }[value] || value || '')
const applyLayoutBindings = (bindings = {}) => {
  if ('type' in bindings) filter.type = bindings.type === '全部' ? '' : (bindings.type || '')
  if ('status' in bindings) filter.status = normalizeStatus(bindings.status)
}

const loadData = async () => {
  try {
    const list = await getAccounts({ type: 'other' })
    if (Array.isArray(list) && list.length) { accounts.value = list; return }
  } catch {}
  accounts.value = [
    { id: 'o_1', name: '遇见官方测试号', type: '测试', platform: 'other', platform_label: '抖音', owner: '张林', status: 'active', url: 'https://www.douyin.com/', remark: '仅用于发布前的视频预览测试，不对外引流' },
    { id: 'o_2', name: '遇见小助理', type: '备用', platform: 'other', platform_label: '视频号', owner: '陈静', status: 'pending', url: '', remark: '备用账号，计划 Q3 启用，用于粉丝互动' },
    { id: 'o_3', name: '素材测试01', type: '测试', platform: 'other', platform_label: '快手', owner: '', status: 'active', url: '', remark: '用于测试素材导出质量' }
  ]
}

const openDialog = () => {
  editing.value = null
  Object.assign(form, emptyForm())
  showDialog.value = true
}
const editRow = (row) => {
  editing.value = row
  Object.assign(form, emptyForm(), row)
  showDialog.value = true
}
const closeDialog = () => { showDialog.value = false }

const saveForm = async () => {
  if (!form.name) return ElMessage.warning('请填写账号名称')
  try {
    if (editing.value) {
      await updateAccount(editing.value.id, form)
      Object.assign(editing.value, form)
      ElMessage.success('已更新')
    } else {
      const payload = { ...form }
      try {
        const res = await createAccount(payload)
        payload.id = res?.id || 'o_' + Date.now()
      } catch {
        payload.id = 'o_' + Date.now()
      }
      accounts.value.push(payload)
      ElMessage.success('已添加')
    }
    closeDialog()
  } catch {
    // fallback
    if (editing.value) {
      Object.assign(editing.value, form)
      ElMessage.success('已更新')
    } else {
      accounts.value.push({ ...form, id: 'o_' + Date.now() })
      ElMessage.success('已添加')
    }
    closeDialog()
  }
}

const removeRow = (row) => {
  ElMessageBox.confirm(`确认删除「${row.name}」？`, '提示', { type: 'warning' })
    .then(async () => {
      try { await deleteAccount(row.id) } catch {}
      accounts.value = accounts.value.filter(i => i.id !== row.id)
      ElMessage.success('已删除')
    }).catch(() => {})
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.page-wrap { padding: 20px 24px 40px; background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%); min-height: calc(100vh - 60px); animation: fadeInUp 0.4s ease; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }

.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border-radius: 16px; border: 1px solid #eceff5; margin-bottom: 16px; }
.hero-left { display: flex; flex-direction: column; gap: 6px; }
.title { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; }
.subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.hero-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.chip-group { display: flex; gap: 6px; padding: 4px; background: #f8fafc; border-radius: 10px; }
.chip { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 8px; border: 0; background: transparent; color: #475569; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.18s; font-family: inherit; }
.chip:hover { color: #4338ca; }
.chip.active { background: #fff; color: #4338ca; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }

.btn-primary { height: 40px; padding: 0 16px; border-radius: 10px; border: 0; cursor: pointer; font-size: 13.5px; font-weight: 600; color: #fff; display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.18s; font-family: inherit; }
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
.btn-ghost { height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; font-family: inherit; }
.btn-ghost:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

.summary-row { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #fff; border: 1px solid #eceff5; border-radius: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.sum-card { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px; border-radius: 10px; background: linear-gradient(135deg, #f5f3ff, #fff); border: 1px solid #ede9fe; }
.sum-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #fff; }
.sum-ic .el-icon { font-size: 16px; }
.ic-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.ic-green { background: linear-gradient(135deg, #10b981, #34d399); }
.ic-amber { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.ic-pink { background: linear-gradient(135deg, #ef4444, #f87171); }
.sum-main { display: flex; flex-direction: column; gap: 2px; }
.sum-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.sum-value { font-size: 20px; font-weight: 700; color: #0f172a; }

/* grid cards */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.card { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 20px; transition: all 0.2s; display: flex; flex-direction: column; }
.card:hover { border-color: #c7d2fe; box-shadow: 0 12px 28px rgba(99,102,241,0.08); transform: translateY(-2px); }

.card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.avatar { width: 44px; height: 44px; border-radius: 12px; color: #fff; font-weight: 700; font-size: 16px; display: grid; place-items: center; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
.title-wrap { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.name { font-size: 15px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type { font-size: 11px; color: #6366f1; background: #eef2ff; padding: 2px 8px; border-radius: 6px; align-self: flex-start; font-weight: 500; }
.st { font-size: 11px; padding: 4px 10px; border-radius: 99px; font-weight: 600; }
.st-active { background: #ecfdf5; color: #047857; }
.st-pending { background: #fef3c7; color: #b45309; }
.st-paused { background: #e2e8f0; color: #475569; }

.meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.meta-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #475569; }
.meta-item .el-icon { color: #94a3b8; font-size: 13px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.remark { font-size: 12px; color: #6b7280; background: #f8fafc; padding: 10px 12px; border-radius: 10px; margin: 0 0 14px; line-height: 1.55; }

.foot { display: flex; gap: 8px; margin-top: auto; padding-top: 10px; }
.mini-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 12.5px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; font-family: inherit; flex: 1; justify-content: center; }
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

.card.empty { align-items: center; justify-content: center; flex-direction: column; min-height: 220px; gap: 8px; color: #94a3b8; font-size: 13px; }
.card.empty .el-icon { font-size: 32px; color: #cbd5e1; }

/* dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 2000; animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.dialog-card { background: #fff; border-radius: 18px; width: 560px; max-width: calc(100vw - 40px); max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(15,23,42,0.25); animation: slideUp 0.25s; }
.dialog-card.wide { width: 640px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.dialog-head { padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; }
.dialog-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.dialog-head p { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }
.icon-close { width: 34px; height: 34px; border-radius: 9px; border: 0; cursor: pointer; background: #f3f4f6; color: #6b7280; display: grid; place-items: center; transition: all 0.15s; }
.icon-close:hover { background: #eef2ff; color: #6366f1; }

.dialog-body { padding: 22px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 12.5px; color: #334155; font-weight: 600; display: flex; align-items: center; gap: 3px; }
.form-field label em { color: #ef4444; font-style: normal; font-size: 13px; }
.form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.text-input, .select-input { height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: #fafbfc; color: #0f172a; font-size: 13.5px; outline: 0; transition: all 0.15s; font-family: inherit; }
.select-input { cursor: pointer; }
.text-input:focus, .select-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }

.dialog-foot { padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f5f9; background: #fafbfc; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

@media (max-width: 900px) {
  .hero { flex-direction: column; align-items: flex-start; gap: 14px; }
  .form-row.two { grid-template-columns: 1fr; }
  .grid { grid-template-columns: 1fr; }
}
</style>
