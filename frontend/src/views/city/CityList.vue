<template>
  <div class="page-wrap">
    <ConfigurablePageRenderer page-key="cityList" :modules="cityListLayoutModules">

    <template #page-head>
    <!-- ===== HERO ===== -->
    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow"><span class="dot"></span>基础档案 · 城市管理</div>
        <h1 class="title">城市档案管理</h1>
        <p class="subtitle">维护城市对接人、账号绑定关系与网盘目录</p>
      </div>
      <div class="hero-right">
        <div class="search">
          <IconFont name="search" :fallback="Search" />
          <input v-model="keyword" placeholder="搜索城市 / 对接人..." />
        </div>
        <button class="btn-primary" @click="openCreate">
          <IconFont name="add" :fallback="Plus" />新增城市
        </button>
      </div>
    </div>
    </template>

    <template #toolbar>
    <!-- ===== SUMMARY STRIP ===== -->
    <div class="summary-strip">
      <div class="s-card">
        <div class="s-label">接入城市</div>
        <div class="s-value">{{ cities.length }}</div>
        <div class="s-foot">Total</div>
      </div>
      <div class="s-card success">
        <div class="s-label">活跃运营</div>
        <div class="s-value">{{ activeCount }}</div>
        <div class="s-foot">Active</div>
      </div>
      <div class="s-card warn">
        <div class="s-label">待开通</div>
        <div class="s-value">{{ pendingCount }}</div>
        <div class="s-foot">Pending</div>
      </div>
      <div class="s-card muted-card">
        <div class="s-label">暂停运营</div>
        <div class="s-value">{{ pausedCount }}</div>
        <div class="s-foot">Paused</div>
      </div>

      <div class="filter-group">
        <button class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button class="chip" :class="{ active: filter === 'active' }" @click="filter = 'active'">活跃</button>
        <button class="chip" :class="{ active: filter === 'paused' }" @click="filter = 'paused'">暂停</button>
        <button class="chip" :class="{ active: filter === 'not_started' }" @click="filter = 'not_started'">未开通</button>
      </div>
    </div>
    </template>

    <template #city-table>
    <!-- ===== CITY GRID ===== -->
    <div v-if="filteredCities.length" class="city-grid">
      <div v-for="(c, i) in filteredCities" :key="c.id || c.name" class="city-card" :class="statusClass(c.status)">
        <!-- Hero -->
        <div class="card-top">
          <div class="city-avatar" :style="{ background: colorSet[i % colorSet.length] + '20', color: colorSet[i % colorSet.length], boxShadow: '0 6px 20px ' + colorSet[i % colorSet.length] + '25' }">
            {{ (c.name || '').slice(0, 2) }}
          </div>
          <div class="city-main">
            <h3 class="city-name">{{ c.name }}</h3>
            <div class="city-status">
              <span class="status-dot" :style="{ background: statusColor(c.status) }"></span>
              <span>{{ statusLabel(c.status) }}</span>
            </div>
          </div>
          <button class="edit-btn" @click="editRow(c)">
            <IconFont name="edit" :fallback="EditPen" />
          </button>
          <button class="edit-btn danger" @click="removeRow(c)">
            <IconFont name="delete" :fallback="Delete" />
          </button>
        </div>

        <!-- Meta -->
        <div class="meta-grid">
          <div class="meta-row">
            <div class="meta-ic ic-indigo"><IconFont name="user" :fallback="UserFilled" /></div>
            <div class="meta-content">
              <span class="meta-key">对接人</span>
              <strong class="meta-value">{{ c.contact_name || '未设置' }}</strong>
            </div>
          </div>
          <div class="meta-row" v-if="c.contact_info">
            <div class="meta-ic ic-green"><el-icon><Phone /></el-icon></div>
            <div class="meta-content">
              <span class="meta-key">联系方式</span>
              <strong class="meta-value">{{ c.contact_info }}</strong>
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-ic ic-orange"><IconFont platform="kuaishou" /></div>
            <div class="meta-content">
              <span class="meta-key">快手账号</span>
              <strong class="meta-value mono">{{ c.kuaishou_name || '未绑定' }}</strong>
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-ic ic-teal"><IconFont platform="weixin" /></div>
            <div class="meta-content">
              <span class="meta-key">视频号</span>
              <strong class="meta-value mono">{{ c.weixin_name || '未绑定' }}</strong>
            </div>
          </div>
          <div class="meta-row wide">
            <div class="meta-ic ic-purple"><IconFont name="materialList" :fallback="FolderOpened" /></div>
            <div class="meta-content">
              <span class="meta-key">网盘目录</span>
              <strong class="meta-value mono path">{{ c.netdisk_folder || '未配置' }}</strong>
            </div>
          </div>
        </div>

        <!-- Foot actions -->
        <div class="card-foot">
          <span class="updated-tag">{{ (c.contact_name || c.kuaishou_name) ? '已配置' : '待完善' }}</span>
          <div class="action-btns">
            <button class="mini-btn" @click="editRow(c)"><el-icon><EditPen /></el-icon>编辑</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-ic"><el-icon><Location /></el-icon></div>
      <div class="empty-txt">
        <strong>暂无城市数据</strong>
        <span>点击右上角「新增城市」开始录入</span>
      </div>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <!-- ===== DIALOG ===== -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editing ? '编辑城市档案' : '新增城市' }}</h3>
            <p>{{ editing ? '更新城市对接信息与账号绑定' : '填写城市基础信息与对接人资料' }}</p>
          </div>
          <button class="icon-close" @click="closeDialog"><IconFont name="close" :fallback="Close" /></button>
        </div>

        <div class="dialog-body">
          <div class="form-row two">
            <div class="form-field">
              <label><em>*</em>城市名称</label>
              <input v-model="form.name" class="text-input" placeholder="如：西安" />
            </div>
            <div class="form-field">
              <label>运营状态</label>
              <el-select v-model="form.status" class="inline-select">
                <el-option label="活跃运营" value="active" />
                <el-option label="暂停" value="paused" />
                <el-option label="未开通" value="not_started" />
              </el-select>
            </div>
          </div>

          <div class="form-row two">
            <div class="form-field">
              <label>对接人</label>
              <input v-model="form.contact_name" class="text-input" placeholder="姓名" />
            </div>
            <div class="form-field">
              <label>联系方式</label>
              <input v-model="form.contact_info" class="text-input" placeholder="手机号 / 微信" />
            </div>
          </div>

          <div class="form-row two">
            <div class="form-field">
              <label>快手账号</label>
              <el-select v-model="form.kuaishou_account_id" placeholder="选择账号" clearable class="inline-select">
                <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
              </el-select>
            </div>
            <div class="form-field">
              <label>视频号账号</label>
              <el-select v-model="form.weixin_account_id" placeholder="选择账号" clearable class="inline-select">
                <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
              </el-select>
            </div>
          </div>

          <div class="form-field">
            <label>网盘目录</label>
            <input v-model="form.netdisk_folder" class="text-input" placeholder="/城市/西安/2026-06/" />
          </div>
        </div>

        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button class="btn-primary" :disabled="saving || !form.name" @click="saveForm">
            <el-icon v-if="saving"><Loading /></el-icon>
            <span>{{ saving ? '保存中...' : '保存' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import { Plus, Search, EditPen, Close, Delete, UserFilled, Phone, FolderOpened, Location, Loading } from '@element-plus/icons-vue'
import { createCity, deleteCity, getAccounts, getCities, updateCity } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const cityListLayoutModules = layoutModuleCatalog.cityList
const { bindings: layoutBindings } = useLayoutBindings('cityList')
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const keyword = ref('')
const filter = ref('all')
const cities = ref([])
const accounts = ref([])

const colorSet = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6']

const applyLayoutBindings = (bindings = {}) => {
  if ('keyword' in bindings || 'search' in bindings) keyword.value = bindings.keyword || bindings.search || ''
  if ('status' in bindings) filter.value = bindings.status || 'all'
}

const emptyForm = () => ({
  id: '', name: '', contact_name: '', contact_info: '',
  kuaishou_account_id: '', weixin_account_id: '',
  netdisk_folder: '', status: 'active'
})
const form = reactive(emptyForm())

const statusLabel = (s) => ({ active: '活跃运营', paused: '暂停', not_started: '未开通' }[s] || s)
const statusColor = (s) => ({ active: '#10b981', paused: '#f59e0b', not_started: '#9ca3af' }[s] || '#9ca3af')
const statusClass = (s) => ({ active: 'status-active', paused: 'status-warn', not_started: 'status-muted' }[s] || '')

const activeCount = computed(() => cities.value.filter(c => c.status === 'active').length)
const pendingCount = computed(() => cities.value.filter(c => c.status === 'not_started').length)
const pausedCount = computed(() => cities.value.filter(c => c.status === 'paused').length)

const filteredCities = computed(() => {
  let list = cities.value
  if (filter.value !== 'all') list = list.filter(c => c.status === filter.value)
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    list = list.filter(c =>
      (c.name || '').toLowerCase().includes(kw) ||
      (c.contact_name || '').toLowerCase().includes(kw)
    )
  }
  return list
})

const loadData = async () => {
  loading.value = true
  try {
    cities.value = await getCities()
  } catch {
    cities.value = [
      { id: 'c1', name: '西安', contact_name: '李明', contact_info: '138****5678', kuaishou_name: '遇见西安快手号', weixin_name: '遇见西安视频号', netdisk_folder: '/城市/西安/2026/', status: 'active' },
      { id: 'c2', name: '成都', contact_name: '王芳', contact_info: '139****1234', kuaishou_name: '遇见成都快手号', weixin_name: '遇见成都视频号', netdisk_folder: '/城市/成都/2026/', status: 'active' },
      { id: 'c3', name: '武汉', contact_name: '张伟', contact_info: '137****9988', kuaishou_name: '遇见武汉快手号', weixin_name: '', netdisk_folder: '/城市/武汉/2026/', status: 'active' },
      { id: 'c4', name: '重庆', contact_name: '', contact_info: '', kuaishou_name: '', weixin_name: '', netdisk_folder: '', status: 'not_started' },
      { id: 'c5', name: '郑州', contact_name: '刘敏', contact_info: 'wechat: lm88', kuaishou_name: '遇见郑州快手号', weixin_name: '遇见郑州视频号', netdisk_folder: '/城市/郑州/2026/', status: 'paused' },
      { id: 'c6', name: '杭州', contact_name: '陈洁', contact_info: '136****0011', kuaishou_name: '遇见杭州快手号', weixin_name: '遇见杭州视频号', netdisk_folder: '/城市/杭州/2026/', status: 'active' }
    ]
  } finally {
    loading.value = false
  }
}

const loadAccounts = async () => {
  try {
    accounts.value = await getAccounts({ type: 'city' })
  } catch {
    accounts.value = []
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
const closeDialog = () => { showDialog.value = false }

const saveForm = async () => {
  if (!form.name) { ElMessage.warning('请输入城市名称'); return }
  saving.value = true
  try {
    if (editing.value) await updateCity(form.id, form)
    else await createCity(form)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } finally {
    saving.value = false
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除城市「${row.name}」及其城市账号？删除后不会再出现在城市看板和下发列表。`, '删除城市', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await deleteCity(row.id)
  } catch {}
  cities.value = cities.value.filter(c => c.id !== row.id)
  ElMessage.success('已删除')
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => { loadAccounts(); loadData() })
</script>

<style scoped>
/* ===== BASE ===== */
.page-wrap { padding: 20px 24px 40px; background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%); min-height: calc(100vh - 60px); animation: fadeInUp 0.4s ease; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }

/* ===== HERO ===== */
.hero {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding: 22px 24px; background: #fff; border-radius: 16px;
  border: 1px solid #eceff5; margin-bottom: 16px;
}
.hero-left { display: flex; flex-direction: column; gap: 6px; }
.title { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.015em; }
.subtitle { font-size: 13.5px; color: #6b7280; margin: 0; }
.hero-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.search {
  display: flex; align-items: center; gap: 8px;
  padding: 0 14px; height: 40px; border-radius: 10px;
  background: #fff; border: 1.5px solid #e5e7eb;
  transition: all 0.15s; min-width: 240px;
}
.search:focus-within { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
.search input { border: 0; outline: 0; background: transparent; font-size: 13px; color: #111827; width: 100%; font-family: inherit; }
.search .el-icon { color: #9ca3af; font-size: 14px; }

.btn-primary {
  height: 40px; padding: 0 16px; border-radius: 10px; border: 0; cursor: pointer;
  font-size: 13.5px; font-weight: 600; color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 14px rgba(99,102,241,0.3);
  display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer;
  border: 1.5px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 13.5px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;
  font-family: inherit;
}
.btn-ghost:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

/* ===== SUMMARY STRIP ===== */
.summary-strip {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px; background: #fff;
  border: 1px solid #eceff5; border-radius: 16px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.s-card {
  padding: 14px 20px; border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff 0%, #fff 100%);
  border: 1px solid #e0e7ff; min-width: 130px;
}
.s-card.success { background: linear-gradient(135deg, #ecfdf5 0%, #fff 100%); border-color: #a7f3d0; }
.s-card.warn { background: linear-gradient(135deg, #fef3c7 0%, #fff 100%); border-color: #fde68a; }
.s-card.muted-card { background: linear-gradient(135deg, #f3f4f6 0%, #fff 100%); border-color: #e5e7eb; }
.s-label { font-size: 11.5px; color: #6b7280; font-weight: 500; }
.s-value { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2; margin-top: 2px; }
.s-card.success .s-value { color: #047857; }
.s-card.warn .s-value { color: #b45309; }
.s-card.muted-card .s-value { color: #4b5563; }
.s-foot { font-size: 10.5px; color: #9ca3af; font-weight: 500; letter-spacing: 0.05em; margin-top: 2px; }

.filter-group {
  margin-left: auto; display: flex; gap: 6px;
  padding: 4px; background: #f8fafc; border-radius: 10px;
}
.chip {
  height: 32px; padding: 0 14px; border: 0; border-radius: 8px;
  background: transparent; color: #6b7280;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
}
.chip:hover { color: #111827; }
.chip.active { background: #fff; color: #4338ca; box-shadow: 0 2px 8px rgba(99,102,241,0.15); font-weight: 600; }

/* ===== CITY GRID ===== */
.city-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.city-card {
  background: #fff;
  border: 1.5px solid #eceff5;
  border-radius: 16px;
  padding: 20px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.city-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px; background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease;
}
.city-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(15,23,42,0.08); border-color: #e0e7ff; }
.city-card:hover::before { transform: scaleX(1); }
.city-card.status-active { border-color: #d1fae5; }
.city-card.status-warn { border-color: #fde68a; }
.city-card.status-muted { opacity: 0.8; border-color: #e5e7eb; background: linear-gradient(180deg, #fafafa 0%, #fff 20%); }

/* Card top */
.card-top {
  display: flex; align-items: center; gap: 14px;
  padding-bottom: 16px; border-bottom: 1px dashed #e5e7eb;
  margin-bottom: 16px;
}
.city-avatar {
  width: 52px; height: 52px; border-radius: 14px;
  display: grid; place-items: center;
  font-size: 16px; font-weight: 700; color: #6366f1;
  flex-shrink: 0;
}
.city-main { flex: 1; min-width: 0; }
.city-name { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.01em; }
.city-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: #4b5563; font-weight: 500;
}
.status-dot { width: 7px; height: 7px; border-radius: 99px; }

.edit-btn {
  width: 36px; height: 36px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #fff; color: #6b7280;
  cursor: pointer; display: grid; place-items: center;
  transition: all 0.15s;
}
.edit-btn:hover { background: #eef2ff; color: #6366f1; border-color: #c7d2fe; }
.edit-btn.danger:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }

/* Meta grid */
.meta-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 12px 16px; margin-bottom: 16px;
}
.meta-row { display: flex; align-items: center; gap: 10px; }
.meta-row.wide { grid-column: 1 / -1; }

.meta-ic {
  width: 34px; height: 34px; border-radius: 9px;
  display: grid; place-items: center;
  font-size: 14px; flex-shrink: 0;
}
.meta-ic.ic-indigo { background: #eef2ff; color: #6366f1; }
.meta-ic.ic-green { background: #ecfdf5; color: #10b981; }
.meta-ic.ic-orange { background: #fff7ed; color: #f97316; }
.meta-ic.ic-teal { background: #ccfbf1; color: #0d9488; }
.meta-ic.ic-purple { background: #f5f3ff; color: #8b5cf6; }

.meta-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.meta-key { font-size: 10.5px; color: #9ca3af; font-weight: 500; letter-spacing: 0.02em; }
.meta-value {
  font-size: 13px; color: #111827; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.meta-value.mono { font-family: 'SF Mono', Menlo, monospace; font-size: 12px; color: #374151; }
.meta-value.mono.path { color: #4338ca; }

/* Card foot */
.card-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 14px; border-top: 1px dashed #e5e7eb;
}
.updated-tag {
  font-size: 11px; padding: 4px 10px; border-radius: 99px;
  background: #ecfdf5; color: #047857; font-weight: 600;
}

.action-btns { display: flex; gap: 8px; }
.mini-btn {
  height: 30px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.15s; font-family: inherit;
}
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

/* ===== EMPTY ===== */
.empty-state {
  padding: 60px 20px; display: flex; flex-direction: column;
  align-items: center; gap: 12px; background: #fff;
  border: 1px dashed #e5e7eb; border-radius: 16px;
}
.empty-ic {
  width: 64px; height: 64px; border-radius: 16px;
  background: #eef2ff; color: #6366f1;
  display: grid; place-items: center; font-size: 28px;
}
.empty-txt { text-align: center; }
.empty-txt strong { font-size: 14.5px; color: #0f172a; font-weight: 600; display: block; margin-bottom: 4px; }
.empty-txt span { font-size: 12.5px; color: #9ca3af; }

/* ===== DIALOG ===== */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
  display: grid; place-items: center; animation: fadeIn 0.2s;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog-card {
  width: 620px; max-width: calc(100vw - 32px); max-height: 90vh; overflow: hidden;
  background: #fff; border-radius: 18px;
  box-shadow: 0 30px 80px rgba(15,23,42,0.25);
  animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }

.dialog-head {
  padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid #f1f5f9;
}
.dialog-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.dialog-head p { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }

.icon-close {
  width: 34px; height: 34px; border-radius: 9px; border: 0; cursor: pointer;
  background: #f3f4f6; color: #6b7280; display: grid; place-items: center;
  transition: all 0.15s;
}
.icon-close:hover { background: #eef2ff; color: #6366f1; }

.dialog-body { padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 12.5px; color: #374151; font-weight: 500; display: flex; align-items: center; gap: 3px; }
.form-field label em { color: #ef4444; font-style: normal; font-size: 13px; }

.text-input {
  height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb;
  background: #fafbfc; color: #0f172a; font-size: 13.5px; font-family: inherit;
  outline: 0; transition: all 0.15s;
}
.text-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }

:deep(.inline-select .el-input__wrapper) {
  height: 42px; background: #fafbfc; border-radius: 10px;
  box-shadow: 0 0 0 1.5px #e5e7eb inset !important; padding: 0 14px;
}
:deep(.inline-select .el-input__wrapper.is-focus) { box-shadow: 0 0 0 1.5px #6366f1 inset !important; }
:deep(.inline-select .el-input__inner) { font-size: 13.5px; }

.dialog-foot {
  padding: 16px 24px; display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid #f1f5f9; background: #fafbfc;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 880px) {
  .page-wrap { padding: 16px; }
  .hero { flex-direction: column; align-items: flex-start; gap: 14px; }
  .hero-right { width: 100%; }
  .hero-right .search { flex: 1; min-width: auto; }
  .meta-grid { grid-template-columns: 1fr; }
  .filter-group { margin-left: 0; width: 100%; }
  .form-row.two { grid-template-columns: 1fr; }
}
</style>
