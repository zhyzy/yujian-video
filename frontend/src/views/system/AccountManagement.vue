<template>
  <div class="page">
    <ConfigurablePageRenderer page-key="accountManagement" :modules="accountManagementLayoutModules">
    <template #page-head>
    <header class="page-head">
      <div>
        <div class="eyebrow"><IconFont name="account" :fallback="User" /> 系统账号 · 权限</div>
        <h1>账号管理</h1>
        <p>创建总部、城市和只读登录账号，支持资料维护与密码重置</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <IconFont name="add" :fallback="Plus" />
        新增登录账号
      </el-button>
    </header>
    </template>

    <template #toolbar>
    <section class="panel">
      <div class="toolbar">
        <el-segmented v-model="filters.role" :options="roleFilters" @change="loadData" />
        <el-select v-model="filters.cityId" clearable filterable placeholder="全部城市" style="width: 180px" @change="loadData">
          <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
        </el-select>
      </div>
    </section>
    </template>

    <template #user-table>
    <section class="panel">
      <el-table :data="users" v-loading="loading">
        <el-table-column label="账号" min-width="210">
          <template #default="{ row }">
            <div class="user-cell">
              <img v-if="row.avatar_url" :src="row.avatar_url" alt="" class="avatar">
              <div v-else class="avatar text">{{ (row.name || row.username || '?').slice(0, 1) }}</div>
              <div>
                <strong>{{ row.name || row.username }}</strong>
                <span>{{ row.username }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }"><el-tag :type="roleType(row.role)">{{ roleLabel(row.role) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="绑定城市" min-width="140">
          <template #default="{ row }">{{ row.city_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="联系方式" min-width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最近登录" min-width="160" />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="editRow(row)">编辑</el-button>
            <el-button link type="warning" @click="openPassword(row)">重置密码</el-button>
            <el-button link type="danger" @click="disableRow(row)">停用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
    </template>
    </ConfigurablePageRenderer>

    <el-dialog v-model="showDialog" :title="editing ? '编辑登录账号' : '新增登录账号'" width="620px">
      <el-form :model="form" label-width="96px">
        <el-form-item label="登录账号"><el-input v-model.trim="form.username" :disabled="editing" placeholder="如 city_xian" /></el-form-item>
        <el-form-item v-if="!editing" label="初始密码"><el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" /></el-form-item>
        <el-form-item label="显示名称"><el-input v-model.trim="form.name" placeholder="如 西安运营" /></el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="form.role">
            <el-radio-button label="admin">管理员</el-radio-button>
            <el-radio-button label="operator">总部运营</el-radio-button>
            <el-radio-button label="city">城市账号</el-radio-button>
            <el-radio-button label="viewer">只读账号</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.role === 'city'" label="绑定城市">
          <el-select v-model="form.city_id" filterable placeholder="选择城市" style="width: 100%">
            <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="头像地址"><el-input v-model="form.avatar_url" placeholder="https://..." clearable /></el-form-item>
        <el-form-item label="联系方式"><el-input v-model="form.phone" placeholder="手机号或微信" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPasswordDialog" title="重置密码" width="420px">
      <el-form label-width="88px">
        <el-form-item label="账号">{{ passwordTarget?.username }}</el-form-item>
        <el-form-item label="新密码"><el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少 6 位" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, User } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { createSystemUser, deleteSystemUser, getCities, getSystemUsers, resetSystemUserPassword, updateSystemUser } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const accountManagementLayoutModules = layoutModuleCatalog.accountManagement
const { bindings: layoutBindings } = useLayoutBindings('accountManagement')
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const showPasswordDialog = ref(false)
const editing = ref(false)
const users = ref([])
const cities = ref([])
const passwordTarget = ref(null)
const filters = reactive({ role: '', cityId: '' })
const roleFilters = [
  { label: '全部', value: '' },
  { label: '管理员', value: 'admin' },
  { label: '总部运营', value: 'operator' },
  { label: '城市账号', value: 'city' },
  { label: '只读账号', value: 'viewer' }
]

const applyLayoutBindings = (bindings = {}) => {
  let shouldReload = false
  if ('role' in bindings && (bindings.role || '') !== filters.role) {
    filters.role = bindings.role || ''
    shouldReload = true
  }
  if ('cityId' in bindings && (bindings.cityId || '') !== filters.cityId) {
    filters.cityId = bindings.cityId || ''
    shouldReload = true
  }
  if (shouldReload) loadData()
}

const emptyForm = () => ({ id: '', username: '', password: '', name: '', role: 'city', city_id: '', avatar_url: '', phone: '', status: 'active', remark: '' })
const form = reactive(emptyForm())
const passwordForm = reactive({ newPassword: '' })

const roleLabel = (role) => ({ admin: '管理员', operator: '总部运营', city: '城市账号', viewer: '只读账号' }[role] || role)
const roleType = (role) => ({ admin: 'danger', operator: 'primary', city: 'success', viewer: 'info' }[role] || 'info')

const loadData = async () => {
  loading.value = true
  try {
    const data = await getSystemUsers({ role: filters.role, cityId: filters.cityId })
    users.value = data.list || []
  } finally {
    loading.value = false
  }
}

const loadCities = async () => {
  cities.value = await getCities()
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

const saveUser = async () => {
  if (!form.username || !form.name) return ElMessage.warning('请填写账号和显示名称')
  if (!editing.value && (!form.password || form.password.length < 6)) return ElMessage.warning('初始密码至少 6 位')
  if (form.role === 'city' && !form.city_id) return ElMessage.warning('城市账号必须绑定城市')
  saving.value = true
  try {
    if (editing.value) await updateSystemUser(form.id, form)
    else await createSystemUser(form)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } finally {
    saving.value = false
  }
}

const openPassword = (row) => {
  passwordTarget.value = row
  passwordForm.newPassword = ''
  showPasswordDialog.value = true
}

const savePassword = async () => {
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) return ElMessage.warning('新密码至少 6 位')
  saving.value = true
  try {
    await resetSystemUserPassword(passwordTarget.value.id, { newPassword: passwordForm.newPassword })
    ElMessage.success('密码已重置')
    showPasswordDialog.value = false
  } finally {
    saving.value = false
  }
}

const disableRow = async (row) => {
  await ElMessageBox.confirm(`确认停用「${row.name || row.username}」？`, '停用账号', { type: 'warning' })
  await deleteSystemUser(row.id)
  ElMessage.success('账号已停用')
  loadData()
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => {
  loadCities()
  loadData()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px;
}
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #6366f1; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.page-head h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.page-head p { margin: 0; color: #7b8497; font-size: 13px; }
.panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 18px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-cell strong { display: block; font-size: 13.5px; color: #0f172a; }
.user-cell span { display: block; font-size: 12px; color: #8a91a4; margin-top: 2px; }
.avatar {
  width: 34px; height: 34px; border-radius: 999px; object-fit: cover; flex-shrink: 0;
  background: #eef2ff;
}
.avatar.text {
  display: grid; place-items: center; color: #fff; font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #14b8a6);
}
@media (max-width: 800px) {
  .page-head, .toolbar { flex-direction: column; align-items: stretch; }
}
</style>
