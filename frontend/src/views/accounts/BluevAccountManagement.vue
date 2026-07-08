<template>
  <div class="bluev-page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="dot"></span>账号管理 · 城市蓝V</div>
        <h1>城市蓝V账号注册</h1>
        <p>管理各城市蓝V账号的注册信息，支持自定义字段配置。</p>
      </div>
      <div class="head-actions">
        <button class="btn-secondary" @click="openFieldModal"><el-icon><Tools /></el-icon>字段配置</button>
        <button class="btn-primary" @click="openEditModal"><el-icon><Plus /></el-icon>新增注册</button>
      </div>
    </div>

    <section class="filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">城市</span>
          <el-select v-model="filters.cityId" placeholder="全部城市" class="filter-select" @change="loadList">
            <el-option label="全部城市" value="" />
            <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">搜索</span>
          <el-input
            v-model="filters.keyword"
            placeholder="搜索账号信息"
            class="filter-input"
            @keyup.enter="loadList"
            @clear="loadList"
          />
        </div>
        <div class="filter-actions">
          <button class="btn-outline" @click="resetFilters">重置</button>
          <button class="btn-primary" @click="loadList">搜索</button>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="card-header">
        <span class="card-title">账号注册列表</span>
        <span class="card-count">共 {{ pagination.total }} 条</span>
      </div>
      <el-table :data="list" v-loading="loading" border class="data-table">
        <el-table-column label="城市" prop="city_name" min-width="100">
          <template #default="{ row }">
            <span class="city-tag">{{ row.city_name }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="field in activeFields"
          :key="field.field_key"
          :label="field.field_label"
          :min-width="140"
        >
          <template #default="{ row }">
            <span v-if="field.field_key === 'is_certified'" class="status-tag" :class="row.data[field.field_key] === '是' ? 'success' : 'default'">
              {{ row.data[field.field_key] || '-' }}
            </span>
            <span v-else class="cell-text">{{ row.data[field.field_key] || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="created_at" min-width="160" />
        <el-table-column label="操作" min-width="120" fixed="right">
          <template #default="{ row }">
            <div class="action-group">
              <button class="action-btn edit" @click="openEditModal(row)" title="编辑">
                <el-icon><EditPen /></el-icon>
              </button>
              <button class="action-btn delete" @click="deleteAccount(row)" title="删除">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </section>

    <el-dialog v-model="editModalVisible" :title="editingId ? '编辑注册' : '新增注册'" width="650px" class="edit-dialog">
      <el-form :model="editForm" label-width="120px" class="edit-form">
        <el-form-item label="城市" required>
          <el-select v-model="editForm.city_id" placeholder="请选择城市" class="form-select" @change="onCityChange">
            <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="editForm.created_at"
            type="datetime"
            placeholder="请选择创建时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            class="form-select"
            clearable
          />
        </el-form-item>
        <template v-for="field in activeFields" :key="field.field_key">
          <el-form-item :label="field.field_label" :required="field.is_required">
            <el-select
              v-if="field.field_type === 'select'"
              v-model="editForm.data[field.field_key]"
              :placeholder="`请选择${field.field_label}`"
              class="form-select"
            >
              <el-option
                v-for="opt in getFieldOptions(field)"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
            <el-input
              v-else
              v-model="editForm.data[field.field_key]"
              :placeholder="`请输入${field.field_label}`"
              class="form-input"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <button class="btn-outline" @click="editModalVisible = false">取消</button>
        <button class="btn-primary" @click="saveAccount">保存</button>
      </template>
    </el-dialog>

    <el-dialog v-model="fieldModalVisible" title="字段配置" width="900px" class="field-dialog">
      <div class="field-config-wrap">
        <div class="field-config-header">
          <span class="config-title">当前字段列表</span>
          <button class="btn-secondary" @click="addFieldRow"><el-icon><Plus /></el-icon>添加字段</button>
        </div>
        <div class="field-config-table">
          <div class="field-table-header">
            <span class="col-index">序号</span>
            <span class="col-label">字段名称</span>
            <span class="col-key">字段标识</span>
            <span class="col-type">字段类型</span>
            <span class="col-options">选项配置</span>
            <span class="col-required">必填</span>
            <span class="col-status">状态</span>
            <span class="col-action">操作</span>
          </div>
          <div
            v-for="(field, index) in fieldConfigs"
            :key="field.id || `temp_${index}`"
            class="field-table-row"
          >
            <span class="col-index">
              <span class="index-badge">{{ index + 1 }}</span>
            </span>
            <span class="col-label">
              <el-input v-model="field.field_label" placeholder="字段名称" class="input-sm" />
            </span>
            <span class="col-key">
              <el-input v-model="field.field_key" placeholder="field_key" class="input-sm" />
            </span>
            <span class="col-type">
              <el-select v-model="field.field_type" class="select-sm">
                <el-option label="文本输入" value="text" />
                <el-option label="下拉选择" value="select" />
              </el-select>
            </span>
            <span class="col-options">
              <el-input v-model="field.field_options" placeholder="选项（逗号分隔）" class="input-sm" />
            </span>
            <span class="col-required">
              <el-switch v-model="field.is_required" active-text="是" inactive-text="否" />
            </span>
            <span class="col-status">
              <button
                v-if="field.id"
                class="status-btn"
                :class="{ 'is-active': field.is_active, 'is-inactive': !field.is_active }"
                @click="toggleField(field)"
              >
                {{ field.is_active ? '启用' : '禁用' }}
              </button>
              <span v-else class="status-tag draft">新增</span>
            </span>
            <span class="col-action">
              <button
                v-if="!field.id || field.id.startsWith('temp_')"
                class="action-btn delete-sm"
                @click="removeFieldRow(index)"
              >
                <el-icon><Close /></el-icon>
              </button>
            </span>
          </div>
        </div>
        <div class="field-config-tips">
          <span class="tips-icon">💡</span>
          <span>字段标识只能包含小写字母和下划线，且不能重复。</span>
        </div>
      </div>
      <template #footer>
        <button class="btn-outline" @click="fieldModalVisible = false">取消</button>
        <button class="btn-primary" @click="saveFields">保存配置</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Tools, EditPen, Delete, Close } from '@element-plus/icons-vue';
import { getBluevFields, createBluevField, updateBluevField, deleteBluevField, getBluevAccounts, createBluevAccount, updateBluevAccount, deleteBluevAccount, getCities } from '@/api';
import { usePageSearch } from '@/composables/usePageSearch';
const loading = ref(false);
const filters = reactive({ cityId: '', keyword: '' });
const { pageSearchKeyword } = usePageSearch();
const pagination = reactive({ page: 1, pageSize: 20, total: 0 });
const list = ref([]);
const fields = ref([]);
const cities = ref([]);
const editModalVisible = ref(false);
const fieldModalVisible = ref(false);
const editingId = ref(null);
const editForm = reactive({
 city_id: '',
 city_name: '',
 created_at: '',
 data: {}
});
const fieldConfigs = ref([]);
const activeFields = computed(() => fields.value.filter(f => f.is_active));
const getFieldOptions = (field) => {
 if (!field.field_options)
 return [];
 return field.field_options.split(',').map(s => s.trim()).filter(Boolean);
};
const loadList = async () => {
 loading.value = true;
 try {
 const res = await getBluevAccounts({
 page: pagination.page,
 pageSize: pagination.pageSize,
 cityId: filters.cityId,
 keyword: filters.keyword
 });
 list.value = res.list || [];
 pagination.total = res.total || 0;
 }
 catch (e) {
 console.error('加载列表失败', e);
 }
 loading.value = false;
};
watch(pageSearchKeyword, value => {
 filters.keyword = value;
 pagination.page = 1;
 loadList();
});
const loadFields = async () => {
 try {
 const res = await getBluevFields();
 fields.value = res || [];
 }
 catch (e) {
 console.error('加载字段失败', e);
 }
};
const loadCities = async () => {
 try {
 const res = await getCities();
 cities.value = res || [];
 }
 catch (e) {
 console.error('加载城市失败', e);
 }
};
const resetFilters = () => {
 filters.cityId = '';
 filters.keyword = '';
 loadList();
};
const onCityChange = () => {
 const city = cities.value.find(c => c.id === editForm.city_id);
 editForm.city_name = city?.name || '';
};
const openEditModal = (row = null) => {
 editingId.value = row?.id || null;
 editForm.city_id = row?.city_id || '';
 editForm.city_name = row?.city_name || '';
 editForm.created_at = row?.created_at || '';
 editForm.data = row?.data ? { ...row.data } : {};
 fields.value.forEach(f => {
 if (!(f.field_key in editForm.data)) {
 editForm.data[f.field_key] = '';
 }
 });
 onCityChange();
 editModalVisible.value = true;
};
const saveAccount = async () => {
 if (!editForm.city_id) {
 return ElMessage.warning('请选择城市');
 }
 const requiredFields = fields.value.filter(f => f.is_active && f.is_required);
 for (const field of requiredFields) {
 if (!editForm.data[field.field_key]) {
 return ElMessage.warning(`${field.field_label}不能为空`);
 }
 }
 try {
 const payload = {
 city_id: editForm.city_id,
 city_name: editForm.city_name,
 data: editForm.data,
 created_at: editForm.created_at
 };
 if (editingId.value) {
 await updateBluevAccount(editingId.value, payload);
 ElMessage.success('更新成功');
 }
 else {
 await createBluevAccount(payload);
 ElMessage.success('创建成功');
 }
 editModalVisible.value = false;
 loadList();
 }
 catch (e) {
 ElMessage.error('保存失败');
 }
};
const deleteAccount = async (row) => {
 try {
 await ElMessageBox.confirm(`确定删除「${row.city_name}」的这条注册信息？`, '确认删除', {
 type: 'warning'
 });
 await deleteBluevAccount(row.id);
 ElMessage.success('删除成功');
 loadList();
 }
 catch (e) {
 if (e !== 'cancel') {
 ElMessage.error('删除失败');
 }
 }
};
const openFieldModal = () => {
 fieldConfigs.value = fields.value.map(f => ({ ...f }));
 fieldModalVisible.value = true;
};
const addFieldRow = () => {
 fieldConfigs.value.push({
 id: `temp_${Date.now()}`,
 field_key: '',
 field_label: '',
 field_type: 'text',
 field_options: '',
 is_required: false,
 is_active: true
 });
};
const removeFieldRow = (index) => {
 fieldConfigs.value.splice(index, 1);
};
const toggleField = (field) => {
 field.is_active = !field.is_active;
};
const saveFields = async () => {
 const errors = [];
 fieldConfigs.value.forEach((field, index) => {
 if (!field.field_label) {
 errors.push(`第${index + 1}行字段名称不能为空`);
 }
 if (!field.field_key) {
 errors.push(`第${index + 1}行字段标识不能为空`);
 }
 else if (!/^[a-z_]+$/.test(field.field_key)) {
 errors.push(`第${index + 1}行字段标识只能包含小写字母和下划线`);
 }
 });
 if (errors.length) {
 return ElMessage.error(errors.join('\n'));
 }
 try {
 for (const field of fieldConfigs.value) {
 if (field.id && !field.id.startsWith('temp_')) {
 await updateBluevField(field.id, {
 field_label: field.field_label,
 field_type: field.field_type,
 field_options: field.field_options,
 is_required: field.is_required,
 is_active: field.is_active,
 sort_order: fieldConfigs.value.indexOf(field) + 1
 });
 }
 else if (!field.id.startsWith('temp_')) {
 await updateBluevField(field.id, {
 field_label: field.field_label,
 field_type: field.field_type,
 field_options: field.field_options,
 is_required: field.is_required,
 is_active: field.is_active,
 sort_order: fieldConfigs.value.indexOf(field) + 1
 });
 }
 else {
 await createBluevField({
 field_key: field.field_key,
 field_label: field.field_label,
 field_type: field.field_type,
 field_options: field.field_options,
 is_required: field.is_required,
 sort_order: fieldConfigs.value.indexOf(field) + 1
 });
 }
 }
 ElMessage.success('字段配置保存成功');
 fieldModalVisible.value = false;
 loadFields();
 }
 catch (e) {
 ElMessage.error('保存失败');
 }
};
onMounted(() => {
 loadFields();
 loadCities();
 loadList();
});
</script>

<style scoped>
.bluev-page { padding: 24px; background: #f1f5f9; min-height: calc(100vh - 100px); }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.page-head h1 { margin: 8px 0 4px; font-size: 28px; font-weight: 700; color: #0f172a; }
.page-head p { color: #64748b; font-size: 14px; }
.eyebrow { font-size: 12px; color: #6366f1; display: flex; align-items: center; gap: 6px; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; }
.head-actions { display: flex; gap: 12px; }

.filter-card, .table-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 600; color: #1e293b; }
.card-count { font-size: 13px; color: #94a3b8; }

.filter-row { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.filter-item { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #64748b; font-weight: 500; white-space: nowrap; }
.filter-select { width: 160px; }
.filter-input { width: 220px; }
.filter-actions { display: flex; gap: 10px; margin-left: auto; }

.data-table {
  border-radius: 12px;
  overflow: hidden;
}
:deep(.data-table .el-table__header-wrapper) { background: #f8fafc; }
:deep(.data-table .el-table__header th) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-weight: 600 !important;
  font-size: 13px !important;
  border-bottom: 2px solid #e2e8f0 !important;
}
:deep(.data-table .el-table__body tr:hover > td) { background: #faf5ff !important; }
:deep(.data-table .el-table__body tr) { transition: all 0.15s; }
:deep(.data-table .el-table__body td) {
  padding: 14px 12px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

.city-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4f46e5;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.status-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.status-tag.default { background: #f1f5f9; color: #64748b; }
.status-tag.success { background: #dcfce7; color: #16a34a; }
.status-tag.draft { background: #fef3c7; color: #d97706; }
.cell-text { font-size: 13px; color: #334155; }

.action-group { display: flex; gap: 6px; }
.action-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.action-btn.edit:hover { border-color: #6366f1; color: #6366f1; background: #faf5ff; }
.action-btn.delete:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
.action-btn.delete-sm { width: 28px; height: 28px; }

.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; }

.edit-dialog, .field-dialog {
  :deep(.el-dialog__header) { padding: 20px 24px 16px; border-bottom: 1px solid #f1f5f9; }
  :deep(.el-dialog__title) { font-size: 18px; font-weight: 600; color: #1e293b; }
  :deep(.el-dialog__body) { padding: 24px; }
  :deep(.el-dialog__footer) { padding: 16px 24px 20px; border-top: 1px solid #f1f5f9; justify-content: flex-end; }
}
.edit-form { max-height: 500px; overflow-y: auto; padding-right: 8px; }
.form-select, .form-input { width: 100%; }
:deep(.form-select .el-input__wrapper) { width: 100%; }
:deep(.el-date-editor.form-select) { width: 100%; }
:deep(.edit-form .el-form-item__label) { font-size: 13px; color: #475569; font-weight: 500; }

.field-config-wrap { max-height: 500px; overflow-y: auto; }
.field-config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.config-title { font-size: 15px; font-weight: 600; color: #1e293b; }

.field-config-table { margin-bottom: 16px; }
.field-table-header {
  display: grid;
  grid-template-columns: 50px 1fr 130px 100px 160px 60px 70px 50px;
  gap: 10px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.field-table-row {
  display: grid;
  grid-template-columns: 50px 1fr 130px 100px 160px 60px 70px 50px;
  gap: 10px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 8px;
  align-items: center;
}
.col-index, .col-label, .col-key, .col-type, .col-options, .col-required, .col-status, .col-action { display: flex; align-items: center; }
.index-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #6366f1;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.input-sm { width: 100%; }
.select-sm { width: 100%; }

.status-btn {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
}
.status-btn.is-active { background: #dcfce7; border-color: #86efac; color: #16a34a; }
.status-btn.is-inactive { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

.field-config-tips {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fefce8;
  border-radius: 8px;
  font-size: 12px;
  color: #854d0e;
}
.tips-icon { font-size: 14px; }

.btn-primary {
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
.btn-primary:active { transform: translateY(0); }

.btn-secondary {
  height: 40px;
  padding: 0 24px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-secondary:hover { border-color: #a5b4fc; color: #4f46e5; background: #faf5ff; }

.btn-outline {
  height: 40px;
  padding: 0 24px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.btn-outline:hover { border-color: #94a3b8; color: #334155; }
</style>
