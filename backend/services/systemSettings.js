const defaultSystemSettings = {
  brand: {
    logoUrl: '/logo.png',
    name: '遇见运营中台',
    subtitle: 'Media Operations'
  },
  storage: {
    provider: 'cos',
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || 'ap-shanghai',
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: '',
    cdnDomain: process.env.COS_CDN_DOMAIN || '',
    domain: process.env.COS_DOMAIN || '',
    uploadPrefix: 'materials/',
    previewExpires: 600,
    proxyPreview: true,
    hasSecretKey: Boolean(process.env.COS_SECRET_KEY)
  },
  profile: {
    displayName: '',
    roleLabel: '',
    avatarUrl: ''
  },
  preferences: {
    compactMode: false,
    showGlobalSearch: true,
    enableNotifications: true,
    defaultCity: '',
    defaultPublishTime: '09:00'
  },
  copy: {
    materialEntry: {
      pageTitle: '素材录入',
      todayOverview: '今日工作概览',
      shootingStaff: '拍摄人员',
      completionStatus: '完成状态',
      shootingMaterial: '拍摄素材',
      todaySchedule: '今日安排',
      completionSummary: '完成情况'
    },
    materialList: {
      pageTitle: '素材列表',
      searchPlaceholder: '搜索素材文件、账号、城市...',
      previewButton: '预览',
      copyLinkButton: '复制链接'
    },
    cityBoard: {
      pageTitle: '城市发布看板',
      distributeButton: '下发视频',
      recentRecords: '最近下发记录',
      cityAccountStatus: '城市账号分发状态'
    },
    accounts: {
      pageTitle: '账号管理',
      createButton: '新增账号',
      cityUserTitle: '城市登录账号'
    }
  },
  pages: {
    dashboard: { label: '工作台', fields: [] },
    materialEntry: { label: '素材录入', fields: [] },
    materialList: { label: '素材列表', fields: [] },
    publish: { label: '发布管理', fields: [] },
    cityBoard: { label: '城市看板', fields: [] },
    cityManage: { label: '城市管理', fields: [] },
    accounts: { label: '账号页面', fields: [] }
  },
  layouts: {},
  layoutBindings: {},
  layoutHistory: []
};

const mergeDeep = (base, saved) => {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (!base || typeof base !== 'object') return saved ?? base;
  const result = { ...base };
  Object.keys(saved || {}).forEach(key => {
    result[key] = mergeDeep(base[key], saved[key]);
  });
  return result;
};

const createSystemSettingsService = (db) => {
  const getSettingValue = (key, fallback = {}) => {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  };

  const getSystemSettings = () => mergeDeep(defaultSystemSettings, getSettingValue('system', {}));

  const maskSystemSettings = (settings) => ({
    ...settings,
    storage: {
      ...settings.storage,
      secretKey: '',
      hasSecretKey: Boolean(settings.storage.secretKey || settings.storage.hasSecretKey || process.env.COS_SECRET_KEY)
    }
  });

  const saveSystemSettingsValue = (settings, userId) => {
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run('system', JSON.stringify(settings), userId || null);
  };

  return {
    defaultSystemSettings,
    mergeDeep,
    getSystemSettings,
    maskSystemSettings,
    saveSystemSettingsValue
  };
};

module.exports = {
  createSystemSettingsService,
  defaultSystemSettings,
  mergeDeep
};
