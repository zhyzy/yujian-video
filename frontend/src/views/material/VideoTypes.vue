<template>
  <div class="video-types">
    <ConfigurablePageRenderer page-key="videoTypes" :modules="videoTypesLayoutModules">

    <template #page-head>
    <!-- Page head -->
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>
          分类管理
        </div>
        <h1 class="head-title">
          视频类型
          <span class="head-sub">管理所有视频分类及其视觉标识</span>
        </h1>
      </div>
      <div class="head-right">
        <button class="primary-btn" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增类型
        </button>
      </div>
    </div>
    </template>

    <template #type-form>
    <!-- Summary strip -->
    <div class="summary-strip">
      <div class="summary-item">
        <span class="summary-label">类型总数</span>
        <strong>{{ list.length }}</strong>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-label">启用中</span>
        <strong class="ok">{{ activeCount }}</strong>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-label">素材总量</span>
        <strong class="accent">{{ totalCount }}</strong>
      </div>
      <div class="summary-spacer"></div>
      <div class="legend-hint">
        <span>提示：</span>每个类型都有专属 emoji 与主题色，方便在排期、看板中快速识别。
      </div>
    </div>
    </template>

    <template #type-list>
    <!-- Type cards -->
    <div class="type-grid" v-loading="loading" element-loading-background="rgba(255,255,255,0.8)">
      <div
        v-for="item in filteredList"
        :key="item.id"
        class="type-card"
        :class="{ inactive: item.status !== 'active', child: item.parent_id }"
      >
        <div class="type-card-header">
          <div class="type-left">
            <div class="type-avatar" :style="{ background: item.color + '15' }">
              <IconFont v-if="getVideoTypeIcon(item.name)" :typeName="item.name" :color="item.color" />
              <span v-else class="type-emoji">{{ item.icon }}</span>
            </div>
            <div class="type-info">
              <div class="type-name-row">
                <strong>{{ item.name }}</strong>
                <span v-if="item.parent_name" class="parent-tag">· 子分类</span>
              </div>
              <div class="type-meta">
                <span class="sort-label">{{ item.sort_order }} 号排序</span>
                <span v-if="item.parent_name" class="parent-label">归属：{{ item.parent_name }}</span>
              </div>
            </div>
          </div>
          <div class="status-pill" :class="item.status === 'active' ? 'active' : 'paused'">
            {{ item.status === 'active' ? '启用' : '停用' }}
          </div>
        </div>

        <div class="type-card-body">
          <div class="type-stat">
            <span class="stat-value">{{ item.count }}</span>
            <span class="stat-label">素材</span>
          </div>
          <div class="color-preview" :style="{ background: item.color }">
            <span>{{ item.color }}</span>
          </div>
        </div>

        <div class="type-card-actions">
          <button class="action-btn edit" @click="editRow(item)">
            <el-icon><EditPen /></el-icon>
            <span>编辑</span>
          </button>
          <button class="action-btn toggle" @click="toggleStatus(item)">
            <el-icon><component :is="item.status === 'active' ? 'CircleClose' : 'CircleCheck'" /></el-icon>
            <span>{{ item.status === 'active' ? '停用' : '启用' }}</span>
          </button>
          <button class="action-btn delete" @click="deleteRow(item)">
            <el-icon><Delete /></el-icon>
            <span>删除</span>
          </button>
        </div>
      </div>

      <button class="type-card add" @click="openCreate">
        <div class="type-avatar add">
          <el-icon><Plus /></el-icon>
        </div>
        <div class="type-info">
          <strong>新增类型</strong>
          <span class="muted">点击创建一个新的分类</span>
        </div>
      </button>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <!-- Dialog -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card" @click.stop>
        <div class="dialog-head">
          <h3>{{ isEdit ? '编辑类型' : '新增类型' }}</h3>
          <button class="icon-close" @click="closeDialog"><el-icon><Close /></el-icon></button>
        </div>

        <div class="dialog-body">
          <div class="field column">
            <label class="field-label">类型名称</label>
            <input v-model="form.name" class="inline-input" placeholder="例如：招商类" />
          </div>

          <div class="field column" style="margin-top:14px">
            <label class="field-label">图标 Emoji</label>
            <input v-model="form.icon" class="inline-input" placeholder="例如：🏪" maxlength="4" />
            <div class="emoji-grid">
              <button
                v-for="e in emojiQuick"
                :key="e"
                class="emoji-btn"
                :class="{ active: form.icon === e }"
                @click="form.icon = e"
              >{{ e }}</button>
            </div>
          </div>

          <div class="field column" style="margin-top:14px">
            <label class="field-label">主题色</label>
            <div class="color-row">
              <button
                v-for="c in palette"
                :key="c"
                class="color-dot"
                :style="{ background: c }"
                :class="{ active: form.color === c }"
                @click="form.color = c"
              ></button>
              <input v-model="form.color" class="color-hex" placeholder="#7C3AED" />
            </div>
          </div>

          <div class="row-2">
            <div class="field column">
              <label class="field-label">上级分类</label>
              <el-select v-model="form.parent_id" placeholder="无" clearable class="inline-select">
                <el-option
                  v-for="type in list.filter(t => t.id !== form.id)"
                  :key="type.id"
                  :label="type.name"
                  :value="type.id"
                />
              </el-select>
            </div>

            <div class="field column">
              <label class="field-label">排序数字</label>
              <input type="number" v-model.number="form.sort_order" class="inline-input" placeholder="数字越小越靠前" />
            </div>
          </div>
        </div>

        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeDialog">取消</button>
          <button class="primary-btn" @click="submitForm" :disabled="!form.name || !form.icon" :loading="submitLoading">
            保存
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, EditPen, Delete, CircleCheck, CircleClose, Close } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getVideoTypeIcon } from '@/utils/iconMapping'
import { getVideoTypes, createVideoType, updateVideoType, deleteVideoType } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const videoTypesLayoutModules = layoutModuleCatalog.videoTypes
const { bindings: layoutBindings } = useLayoutBindings('videoTypes')
const loading = ref(false)
const showDialog = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)

const emptyForm = () => ({ id: '', name: '', icon: '', color: '#7C3AED', parent_id: '', sort_order: 0, status: 'active' })
const form = reactive(emptyForm())

const list = ref([])
const filter = reactive({ status: '', keyword: '' })

const emojiQuick = ['🏪', '👩', '🎬', '📢', '💆', '✨', '🏖', '💼', '🌟', '🎥', '🍜', '🎯']
const palette = ['#FF9F43', '#9B59B6', '#34C759', '#FF6B6B', '#5E5CE6', '#00B4D8', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444', '#6366F1', '#84CC16']

const activeCount = computed(() => list.value.filter(t => t.status === 'active').length)
const totalCount = computed(() => list.value.reduce((n, t) => n + (Number(t.count) || 0), 0))
const filteredList = computed(() => list.value.filter((item) => {
  const statusMatched = filter.status ? item.status === filter.status : true
  const keyword = filter.keyword.trim()
  const keywordMatched = keyword ? `${item.name || ''}${item.parent_name || ''}`.includes(keyword) : true
  return statusMatched && keywordMatched
}))

const applyLayoutBindings = (bindings = {}) => {
  if ('status' in bindings) filter.status = bindings.status === '全部' ? '' : (bindings.status || '')
  if ('keyword' in bindings) filter.keyword = bindings.keyword || ''
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await getVideoTypes()
    const rows = Array.isArray(data) ? data : (data?.list || [])
    list.value = rows.map(item => ({ ...item, count: item.count ?? 0 }))
  } catch (e) {
    list.value = [
      { id: 'type_1', name: '招商类', icon: '🏪', color: '#FF9F43', sort_order: 1, parent_id: '', parent_name: '', status: 'active', count: 128 },
      { id: 'type_2', name: '城市招商', icon: '🏙', color: '#9B59B6', sort_order: 2, parent_id: 'type_1', parent_name: '招商类', status: 'active', count: 68 },
      { id: 'type_3', name: '加盟招商', icon: '🤝', color: '#5E5CE6', sort_order: 3, parent_id: 'type_1', parent_name: '招商类', status: 'active', count: 60 },
      { id: 'type_4', name: '技师类', icon: '👩', color: '#10B981', sort_order: 4, parent_id: '', parent_name: '', status: 'active', count: 96 },
      { id: 'type_5', name: '服务展示', icon: '💆', color: '#34C759', sort_order: 5, parent_id: 'type_4', parent_name: '技师类', status: 'active', count: 38 },
      { id: 'type_6', name: '剧情类', icon: '🎬', color: '#FF6B6B', sort_order: 6, parent_id: '', parent_name: '', status: 'active', count: 72 },
      { id: 'type_7', name: '品牌宣传', icon: '📢', color: '#7C3AED', sort_order: 7, parent_id: '', parent_name: '', status: 'active', count: 45 },
      { id: 'type_8', name: '探店', icon: '🍜', color: '#F59E0B', sort_order: 8, parent_id: '', parent_name: '', status: 'inactive', count: 12 }
    ]
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  isEdit.value = false
  Object.assign(form, emptyForm())
  showDialog.value = true
}
const editRow = (row) => {
  isEdit.value = true
  Object.assign(form, emptyForm(), row)
  showDialog.value = true
}
const closeDialog = () => { showDialog.value = false }

const toggleStatus = async (row) => {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  ElMessageBox.confirm(`确认要${newStatus === 'active' ? '启用' : '停用'}这个类型吗？`, '提示', {
    confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning'
  }).then(async () => {
    try {
      await updateVideoType(row.id, { ...row, status: newStatus })
      ElMessage.success('操作成功')
      loadData()
    } catch (e) {
      ElMessage.error('操作失败')
    }
  })
}

const deleteRow = (row) => {
  ElMessageBox.confirm('确认要删除这个类型吗？关联素材不会被删除，只是分类变为未分类。', '提示', {
    confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning'
  }).then(async () => {
    try {
      await deleteVideoType(row.id)
      ElMessage.success('删除成功')
      loadData()
    } catch (e) {
      ElMessage.error('删除失败')
    }
  })
}

const submitForm = async () => {
  if (!form.name || !form.icon) return
  submitLoading.value = true
  try {
    if (isEdit.value) await updateVideoType(form.id, form)
    else await createVideoType(form)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    submitLoading.value = false
  }
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
/* ---- base ---- */
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em;
}
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.head-left { display: flex; flex-direction: column; gap: 8px; }
.head-title { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.015em; line-height: 1.2; display: flex; flex-direction: column; gap: 6px; }
.head-sub { font-size: 13.5px; color: #6b7280; font-weight: 400; }

.primary-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
  font-size: 13.5px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.28); transition: all 0.18s ease;
}
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.35); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ghost-btn {
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
  transition: all 0.15s ease;
}
.ghost-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.ghost-btn.small { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 7px; }
.ghost-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* ---- summary ---- */
.summary-strip {
  display: flex; align-items: center; gap: 24px;
  padding: 20px 24px; background: #fff; border: 1px solid #e5e7eb;
  border-radius: 16px;
}
.summary-item { display: flex; flex-direction: column; gap: 4px; }
.summary-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
.summary-item strong { font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
.summary-item strong.ok { color: #10b981; }
.summary-item strong.accent { color: #6366f1; }
.summary-divider { width: 1px; height: 40px; background: #e5e7eb; }
.summary-spacer { flex: 1; }
.legend-hint { font-size: 13px; color: #9ca3af; display: flex; align-items: center; gap: 8px; }
.legend-hint span { color: #6b7280; font-weight: 500; }

/* ---- type grid ---- */
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.type-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
  padding: 20px; display: flex; flex-direction: column; gap: 16px;
  transition: all 0.2s ease; position: relative; overflow: hidden;
}
.type-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: transparent; transition: background 0.2s;
}
.type-card:hover::before { background: #6366f1; }
.type-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(15,23,42,0.08); border-color: #e0e7ff; }
.type-card.inactive { opacity: 0.7; background: #fafafa; }
.type-card.inactive::before { background: #9ca3af; }
.type-card.inactive:hover { border-color: #d1d5db; }
.type-card.child { border-left: 3px solid #e0e7ff; }
.type-card.child::before { background: #6366f1; }

.type-card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.type-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }

.type-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.type-avatar .iconfont { font-size: 20px; }
.type-emoji { font-size: 22px; line-height: 1; }
.type-avatar.add { background: #f3f4f6; color: #6b7280; font-size: 18px; }

.type-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.type-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.type-info strong { font-size: 15px; color: #0f172a; font-weight: 700; letter-spacing: -0.01em; }
.type-info .muted { font-size: 12px; color: #9ca3af; }

.parent-tag {
  font-size: 11px; padding: 1px 8px; border-radius: 999px;
  background: #eef2ff; color: #6366f1; font-weight: 500;
}

.type-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sort-label { font-size: 11.5px; color: #9ca3af; }
.parent-label { font-size: 11.5px; color: #6366f1; font-weight: 500; }

.status-pill {
  padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
  flex-shrink: 0;
}
.status-pill.active { background: #ecfdf5; color: #059669; }
.status-pill.paused { background: #f3f4f6; color: #6b7280; }

.type-card-body {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px; background: #fafbfc; border-radius: 12px;
}

.type-stat { display: flex; align-items: baseline; gap: 4px; }
.stat-value { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
.stat-label { font-size: 12px; color: #9ca3af; font-weight: 500; }

.color-preview {
  height: 28px; padding: 0 12px; border-radius: 8px;
  display: flex; align-items: center;
  color: #fff; font-size: 11px; font-weight: 600; font-family: 'SF Mono', monospace;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

.type-card-actions {
  display: flex; gap: 8px; padding-top: 4px;
}

.action-btn {
  flex: 1; height: 36px; padding: 0 10px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #fff;
  font-size: 12px; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  transition: all 0.15s ease;
}
.action-btn:hover { border-color: #d1d5db; background: #f9fafb; }
.action-btn.edit:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.action-btn.toggle:hover { border-color: #10b981; color: #10b981; background: #f0fdf4; }
.action-btn.delete:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

.type-card.add {
  border-style: dashed; border-color: #d1d5db; background: #fafafa;
  cursor: pointer; min-height: 180px; align-items: center; justify-content: center;
}
.type-card.add:hover { border-color: #6366f1; background: #fafaff; }
.type-card.add .type-info { text-align: center; align-items: center; }

/* ---- dialog ---- */
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
  z-index: 2000; display: grid; place-items: center; animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog-card {
  width: 520px; max-width: calc(100vw - 32px); background: #fff; border-radius: 16px;
  box-shadow: 0 20px 50px rgba(15,23,42,0.2); overflow: hidden;
  animation: slideUp 0.25s ease;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }

.dialog-head {
  padding: 18px 22px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #f3f4f6;
}
.dialog-head h3 { font-size: 16px; font-weight: 700; color: #0f172a; }
.icon-close {
  width: 32px; height: 32px; border-radius: 8px; border: 0; background: #f9fafb;
  color: #6b7280; cursor: pointer; display: grid; place-items: center; transition: all 0.15s;
}
.icon-close:hover { background: #f3f4f6; color: #111827; }

.dialog-body { padding: 22px; }
.field.column { display: flex; flex-direction: column; }
.field-label { font-size: 12.5px; color: #374151; font-weight: 600; margin-bottom: 8px; }
.inline-input {
  height: 40px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb;
  background: #fafbff; color: #0f172a; font-size: 13.5px; font-family: inherit;
  outline: 0; transition: all 0.15s ease;
}
.inline-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }

.inline-select { width: 100%; }
:deep(.inline-select .el-input__wrapper) {
  height: 40px; background: #fafbff; border-radius: 10px;
  box-shadow: 0 0 0 1.5px #e5e7eb inset; padding: 0 14px;
}
:deep(.inline-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1.5px #6366f1 inset;
}

.emoji-grid {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
}
.emoji-btn {
  width: 36px; height: 36px; border-radius: 9px; border: 1.5px solid transparent;
  background: #f9fafb; font-size: 16px; cursor: pointer; transition: all 0.15s;
}
.emoji-btn:hover { background: #eef2ff; transform: scale(1.08); }
.emoji-btn.active { background: #eef2ff; border-color: #6366f1; }

.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }

.color-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
.color-dot {
  width: 28px; height: 28px; border-radius: 8px; border: 2px solid transparent; cursor: pointer;
  transition: all 0.15s;
}
.color-dot:hover { transform: scale(1.1); }
.color-dot.active { border-color: #fff; box-shadow: 0 0 0 2px #6366f1, 0 4px 10px rgba(99,102,241,0.25); }
.color-hex {
  margin-left: 4px; width: 120px; height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1.5px solid #e5e7eb; background: #fff; font-size: 12px; font-family: 'SF Mono', monospace;
  color: #374151; outline: 0; transition: all 0.15s;
}
.color-hex:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

.dialog-foot {
  padding: 16px 22px; display: flex; justify-content: flex-end; gap: 8px;
  border-top: 1px solid #f3f4f6; background: #fafbfc;
}
</style>
