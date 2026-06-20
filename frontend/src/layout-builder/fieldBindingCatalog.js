const commonStatusOptions = '全部\n待发布\n已发布\n发布失败'
const platformOptions = '全部\ndouyin\nkuaishou\nweixin\nxiaohongshu'

export const fieldBindingCatalog = {
  materialList: [
    { field: 'date', label: '上传日期', type: 'date', effect: '筛选指定日期上传的素材' },
    { field: 'filterDate', label: '上传日期（别名）', type: 'date', effect: '同 date，兼容素材列表日期控件' },
    { field: 'type', label: '素材类型', type: 'select', options: '全部\n剧情演绎\n官方蓝V\n养生展示\n招商加盟', effect: '筛选素材类型' },
    { field: 'filterType', label: '素材类型（别名）', type: 'select', options: '全部\n剧情演绎\n官方蓝V\n养生展示\n招商加盟', effect: '同 type，兼容素材列表类型控件' }
  ],
  materialEntry: [
    { field: 'date', label: '录入日期', type: 'date', effect: '预填素材录入日期' },
    { field: 'staffName', label: '拍摄人员', type: 'input', effect: '预填素材录入的人员名称' },
    { field: 'status', label: '素材状态', type: 'select', options: 'draft\nuploaded\nreviewing\napproved', effect: '预填素材当前状态' },
    { field: 'shootCount', label: '拍摄数量', type: 'number', effect: '预填拍摄数量' },
    { field: 'editCount', label: '剪辑数量', type: 'number', effect: '预填剪辑数量' },
    { field: 'netdiskPath', label: '网盘路径', type: 'input', effect: '预填素材网盘地址' },
    { field: 'remark', label: '备注', type: 'textarea', effect: '预填素材备注说明' },
    { field: 'typeId', label: '素材类型', type: 'select', options: '全部', effect: '预填素材分类' }
  ],
  publishList: [
    { field: 'startDate', label: '计划起始日期', type: 'date', effect: '控制发布计划表格的起始日期' },
    { field: 'platform', label: '平台', type: 'select', options: platformOptions, effect: '筛选抖音、快手、视频号等平台账号' },
    { field: 'scope', label: '账号归属', type: 'select', options: '全部\nhq\ncity', effect: '筛选总部或城市账号' },
    { field: 'cityId', label: '城市', type: 'select', options: '全部', effect: '筛选指定城市账号' },
    { field: 'owner', label: '负责人', type: 'input', effect: '筛选指定负责人账号' }
  ],
  publishLedger: [
    { field: 'date', label: '台账日期', type: 'date', effect: '切换发布台账日期并重新加载记录' },
    { field: 'selectedDate', label: '台账日期（别名）', type: 'date', effect: '同 date，兼容台账日期控件' },
    { field: 'status', label: '发布状态', type: 'select', options: commonStatusOptions, effect: '筛选台账发布状态' },
    { field: 'scope', label: '账号归属', type: 'select', options: '全部\nhq\ncity', effect: '筛选总部或城市来源记录' },
    { field: 'source', label: '数据来源（别名）', type: 'select', options: '全部\nhq\ncity', effect: '同 scope，兼容台账来源字段' },
    { field: 'cityId', label: '城市', type: 'select', options: '全部', effect: '筛选指定城市台账' }
  ],
  cityList: [
    { field: 'keyword', label: '搜索关键词', type: 'input', effect: '搜索城市名称或对接人' },
    { field: 'search', label: '搜索关键词（别名）', type: 'input', effect: '同 keyword，兼容通用搜索控件' },
    { field: 'status', label: '运营状态', type: 'select', options: 'all\nactive\npaused\nnot_started', effect: '筛选活跃、暂停、未开通城市' }
  ],
  cityBoard: [
    { field: 'date', label: '看板日期', type: 'date', effect: '切换城市看板日期' },
    { field: 'cityStatus', label: '城市状态', type: 'select', options: 'all\npublished\npending\nnot_started', effect: '筛选城市发布状态' }
  ],
  accountManagement: [
    { field: 'role', label: '账号角色', type: 'select', options: '全部\nadmin\noperator\ncity\nviewer', effect: '筛选系统登录账号角色' },
    { field: 'cityId', label: '绑定城市', type: 'select', options: '全部', effect: '筛选绑定到指定城市的登录账号' }
  ],
  hqAccounts: [
    { field: 'platform', label: '平台', type: 'select', options: platformOptions, effect: '筛选总部账号平台' },
    { field: 'keyword', label: '搜索关键词', type: 'input', effect: '按总部账号名称搜索' }
  ],
  cityAccounts: [
    { field: 'status', label: '账号状态', type: 'select', options: '全部\nactive\ninactive', effect: '筛选城市账号启用状态' },
    { field: 'cityId', label: '城市', type: 'select', options: '全部', effect: '筛选指定城市账号' },
    { field: 'platform', label: '平台', type: 'select', options: platformOptions, effect: '筛选城市账号平台' }
  ],
  otherAccounts: [
    { field: 'type', label: '账号类型', type: 'select', options: '全部\nstaff\npartner\nsupplier', effect: '筛选其他账号类型' },
    { field: 'status', label: '账号状态', type: 'select', options: '全部\nactive\ninactive', effect: '筛选其他账号启用状态' },
    { field: 'keyword', label: '搜索关键词', type: 'input', effect: '按账号名称或备注搜索' }
  ],
  dataOverview: [
    { field: 'range', label: '统计周期', type: 'select', options: '7d\n30d\n90d\nyear', effect: '切换数据总览统计周期' },
    { field: 'platform', label: '明细平台', type: 'select', options: platformOptions, effect: '筛选数据明细平台' },
    { field: 'date', label: '录入日期', type: 'date', effect: '预填录入数据弹窗日期' },
    { field: 'accountId', label: '发布账号', type: 'select', options: '全部', effect: '预填录入数据弹窗账号' },
    { field: 'videoTitle', label: '视频标题', type: 'input', effect: '预填录入数据弹窗视频标题' },
    { field: 'views', label: '播放量', type: 'number', effect: '预填录入数据弹窗播放量' },
    { field: 'likes', label: '点赞数', type: 'number', effect: '预填录入数据弹窗点赞数' },
    { field: 'comments', label: '评论数', type: 'number', effect: '预填录入数据弹窗评论数' },
    { field: 'deals', label: '成交单数', type: 'number', effect: '预填录入数据弹窗成交单数' },
    { field: 'revenue', label: '成交金额', type: 'number', effect: '预填录入数据弹窗成交金额' }
  ],
  dashboard: [
    { field: 'date', label: '工作台日期', type: 'date', effect: '切换工作台统计日期、排期日期和素材统计日期' },
    { field: 'range', label: '统计范围', type: 'select', options: 'today\nweek\nmonth', effect: '切换工作台顶部今日、本周、本月状态' },
    { field: 'platform', label: '排期平台', type: 'select', options: platformOptions, effect: '筛选工作台今日发布排期平台' }
  ],
  publishCalendar: [
    { field: 'month', label: '日历月份', type: 'date', effect: '切换发布日历所在月份，并选中该日期' },
    { field: 'date', label: '日历日期', type: 'date', effect: '切换发布日历所在月份，并选中该日期' },
    { field: 'selectedDate', label: '选中日期', type: 'date', effect: '切换右侧日期详情面板' },
    { field: 'platform', label: '平台', type: 'select', options: platformOptions, effect: '筛选日历中显示的平台排期' }
  ],
  cityWorkbench: [
    { field: 'status', label: '任务状态', type: 'select', options: commonStatusOptions, effect: '筛选城市工作台任务和排期状态' },
    { field: 'date', label: '任务日期', type: 'date', effect: '筛选城市工作台任务和排期日期' }
  ],
  aiReports: [
    { field: 'type', label: '日报类型', type: 'select', options: 'daily\nweekly\nmonthly', effect: '切换生成日报类型' },
    { field: 'dateFrom', label: '开始日期', type: 'date', effect: '预填日报统计开始日期' },
    { field: 'dateTo', label: '结束日期', type: 'date', effect: '预填日报统计结束日期' }
  ],
  cityTasks: [
    { field: 'status', label: '任务状态', type: 'select', options: '全部\ndistributed\npublished\ntoday', effect: '筛选全部、待发布、已填报或今日任务' },
    { field: 'dateFrom', label: '开始日期', type: 'date', effect: '筛选城市任务开始日期' },
    { field: 'dateTo', label: '结束日期', type: 'date', effect: '筛选城市任务结束日期' }
  ],
  cityPublishSubmit: [
    { field: 'date', label: '填报日期', type: 'date', effect: '切换发布填报页面日期' },
    { field: 'currentDate', label: '当前日期（别名）', type: 'date', effect: '同 date，兼容日期组件命名' }
  ],
  cityDataEntry: [
    { field: 'platform', label: '发布平台', type: 'select', options: platformOptions, effect: '筛选数据录入记录平台，并预填表单平台' },
    { field: 'accountId', label: '发布账号', type: 'select', options: '全部', effect: '筛选数据录入账号，并预填表单账号' },
    { field: 'dateFrom', label: '开始日期', type: 'date', effect: '筛选数据开始日期' },
    { field: 'dateTo', label: '结束日期', type: 'date', effect: '筛选数据结束日期' },
    { field: 'showHistory', label: '显示历史', type: 'switch', effect: '控制是否显示全部历史数据' }
  ],
  videoTypes: [
    { field: 'status', label: '类型状态', type: 'select', options: '全部\nactive\ninactive', effect: '筛选启用或停用的视频类型' },
    { field: 'keyword', label: '类型搜索', type: 'input', effect: '搜索视频类型名称或上级分类' }
  ],
  cityNotifications: [
    { field: 'readStatus', label: '阅读状态', type: 'select', options: '全部\nunread\nread', effect: '筛选未读或已读通知' }
  ]
}

export const getPageBindingFields = (pageKey) => fieldBindingCatalog[pageKey] || []

export const getBindingField = (pageKey, fieldName) => {
  if (!fieldName) return null
  return getPageBindingFields(pageKey).find((item) => item.field === fieldName) || null
}

export const applyBindingPresetToModule = (module, field) => {
  if (!module?.config || !field) return
  module.config.fieldName = field.field
  module.config.label = module.config.label || field.label
  module.config.helpText = field.effect || module.config.helpText
  if (field.options && !module.config.options) module.config.options = field.options
  if (field.type === 'number') {
    module.config.min = module.config.min ?? 0
    module.config.max = module.config.max ?? 999999
  }
}
