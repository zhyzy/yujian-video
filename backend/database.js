const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('./env');

const configuredDbPath = process.env.DB_PATH;
const dbPath = configuredDbPath
  ? (path.isAbsolute(configuredDbPath) ? configuredDbPath : path.resolve(__dirname, configuredDbPath))
  : path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tableInfo = (tableName) => db.prepare(`PRAGMA table_info(${tableName})`).all();
const hasColumn = (tableName, columnName) => tableInfo(tableName).some(col => col.name === columnName);
const addColumnIfMissing = (tableName, definition) => {
  const columnName = definition.trim().split(/\s+/)[0];
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
};

// 初始化数据库表
const initTables = () => {
  // 账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_account TEXT,
      type TEXT NOT NULL,
      city_id TEXT,
      status TEXT DEFAULT 'active',
      browser_profile TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 账号扩展字段（安全添加，已存在则跳过）
  const alterAccounts = (col, def) => {
    try { db.exec(`ALTER TABLE accounts ADD COLUMN ${col} TEXT ${def}`); } catch {}
  };
  alterAccounts('account_type', "DEFAULT ''");
  alterAccounts('platform_label', "DEFAULT ''");
  alterAccounts('cert', "DEFAULT ''");
  alterAccounts('frequency', "DEFAULT ''");
  alterAccounts('priority', "DEFAULT 'medium'");
  alterAccounts('owner', "DEFAULT ''");
  alterAccounts('editor', "DEFAULT ''");
  alterAccounts('purpose', "DEFAULT ''");
  alterAccounts('remark', "DEFAULT ''");
  alterAccounts('avatar', "DEFAULT ''");
  alterAccounts('owner_avatar', "DEFAULT ''");

  // 城市表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_info TEXT,
      kuaishou_account_id TEXT,
      weixin_account_id TEXT,
      netdisk_folder TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 视频类型表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 素材记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      video_type_id TEXT NOT NULL,
      shoot_count INTEGER DEFAULT 0,
      edit_count INTEGER DEFAULT 0,
      upload_count INTEGER DEFAULT 0,
      netdisk_path TEXT,
      status TEXT DEFAULT 'not_uploaded',
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 发布排期表
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      account_id TEXT NOT NULL,
      video_title TEXT NOT NULL,
      video_url TEXT,
      cover_url TEXT,
      tags TEXT,
      video_type_id TEXT,
      material_id TEXT,
      status TEXT DEFAULT 'pending',
      published_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 城市分发记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_distributions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      city_id TEXT NOT NULL,
      account_id TEXT,
      video_title TEXT NOT NULL,
      video_url TEXT,
      publish_requirement TEXT,
      status TEXT DEFAULT 'distributed',
      publish_screenshot TEXT,
      confirmed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 数据追踪表
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_tracks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      account_id TEXT NOT NULL,
      schedule_id TEXT,
      city_distribution_id TEXT,
      play_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      deal_count INTEGER DEFAULT 0,
      deal_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 拍摄人员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS staffs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'both',
      contact TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 月度目标表
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_goals (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      shoot_target INTEGER DEFAULT 0,
      edit_target INTEGER DEFAULT 0,
      publish_target INTEGER DEFAULT 0,
      play_target INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 素材文件表 (COS 上传后记录)
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      cos_key TEXT NOT NULL,
      url TEXT,
      type_name TEXT,
      video_type_id TEXT,
      date TEXT,
      staff_id TEXT,
      duration TEXT,
      mime TEXT,
      uploaded_by TEXT,
      thumbnail_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      content TEXT,
      raw_data TEXT,
      prompt_template TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表初始化完成');
};

const initMigrationTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const applyMigration = (version, name, migrate) => {
  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
  if (applied) return;
  const trx = db.transaction(() => {
    migrate();
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, name);
  });
  trx();
  console.log(`数据库迁移完成：${version} ${name}`);
};

const ensureCurrentSchema = () => {
  [
    'publish_time TEXT',
    'material_url TEXT',
    'publish_platform TEXT',
    'publish_account_name TEXT',
    'publish_url TEXT',
    'actual_publish_time TEXT',
    'play_count INTEGER DEFAULT 0',
    'like_count INTEGER DEFAULT 0',
    'comment_count INTEGER DEFAULT 0',
    'deal_count INTEGER DEFAULT 0',
    'deal_amount REAL DEFAULT 0',
    'favorite_count INTEGER DEFAULT 0',
    'share_count INTEGER DEFAULT 0',
    'city_remark TEXT',
    'submitted_by TEXT',
    'submitted_at TEXT',
    'review_status TEXT DEFAULT "pending"'
  ].forEach(definition => addColumnIfMissing('city_distributions', definition));

  [
    'deal_count INTEGER DEFAULT 0',
    'deal_amount REAL DEFAULT 0'
  ].forEach(definition => addColumnIfMissing('data_tracks', definition));
};

const runMigrations = () => {
  initMigrationTables();

  applyMigration('20260612_business_model_v1', '业务模型关系补齐', () => {
    [
      'account_type TEXT',
      'platform_label TEXT',
      'cert TEXT',
      'frequency TEXT',
      "priority TEXT DEFAULT 'medium'",
      'owner TEXT',
      'editor TEXT',
      'purpose TEXT',
      'remark TEXT'
    ].forEach(definition => addColumnIfMissing('accounts', definition));

    [
      'city_id TEXT',
      'city_distribution_id TEXT',
      'material_file_id TEXT',
      'published_url TEXT',
      'fail_reason TEXT',
      'status_updated_at TEXT'
    ].forEach(definition => addColumnIfMissing('schedules', definition));

    [
      'schedule_id TEXT',
      'material_file_id TEXT',
      'published_at TEXT',
      'failed_reason TEXT'
    ].forEach(definition => addColumnIfMissing('city_distributions', definition));

    [
      'material_id TEXT',
      'schedule_id TEXT',
      'city_distribution_id TEXT',
      'account_id TEXT',
      "source TEXT DEFAULT 'cos'",
      "storage_provider TEXT DEFAULT 'cos'",
      'deleted_at TEXT'
    ].forEach(definition => addColumnIfMissing('material_files', definition));

    [
      'material_file_id TEXT',
      'captured_at TEXT'
    ].forEach(definition => addColumnIfMissing('data_tracks', definition));

    db.exec(`
      CREATE TABLE IF NOT EXISTS account_publish_status (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'none',
        schedule_id TEXT,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, date)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_accounts_city_id ON accounts(city_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_type_status ON accounts(type, status);
      CREATE INDEX IF NOT EXISTS idx_account_publish_status_account_date ON account_publish_status(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_schedules_account_date ON schedules(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_schedules_material_file_id ON schedules(material_file_id);
      CREATE INDEX IF NOT EXISTS idx_city_distributions_city_date ON city_distributions(city_id, date);
      CREATE INDEX IF NOT EXISTS idx_material_files_date_type ON material_files(date, video_type_id);
      CREATE INDEX IF NOT EXISTS idx_material_files_material_id ON material_files(material_id);
      CREATE INDEX IF NOT EXISTS idx_data_tracks_account_date ON data_tracks(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_data_tracks_material_file_id ON data_tracks(material_file_id);
    `);
  });

  applyMigration('20260612_production_v1', '生产能力基础表', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'operator',
        status TEXT DEFAULT 'active',
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        action TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        resource TEXT,
        resource_id TEXT,
        status_code INTEGER,
        request_body TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_user_created ON operation_logs(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_path_created ON operation_logs(path, created_at);
    `);
  });

  // staff_name: 当 staff_id 为 'manual' 时，用于存储手动输入的人员姓名（非规范化字段）
  // work_plan: 工作计划
  // work_done: 工作完成情况
  // completion_status: 完成状态
  applyMigration('20260612_material_work_overview_v1', '素材录入每日工作概览', () => {
    [
      'staff_name TEXT',
      'work_plan TEXT',
      'work_done TEXT',
      "completion_status TEXT DEFAULT 'planned'"
    ].forEach(definition => addColumnIfMissing('materials', definition));
  });

  applyMigration('20260612_token_version_v1', '用户token版本控制', () => {
    addColumnIfMissing('users', "token_version INTEGER DEFAULT 0");
  });

  applyMigration('20260612_notifications_v1', '用户通知表', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        level TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        related_type TEXT,
        related_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`);
  });

  applyMigration('20260613_system_settings_v1', '系统设置与城市端基础字段', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    [
      'city_id TEXT',
      'avatar_url TEXT',
      'phone TEXT',
      'remark TEXT'
    ].forEach(definition => addColumnIfMissing('users', definition));

    [
      'publish_time TEXT',
      'material_url TEXT',
      'publish_platform TEXT',
      'publish_account_name TEXT',
      'publish_url TEXT',
      'actual_publish_time TEXT',
      'play_count INTEGER DEFAULT 0',
      'like_count INTEGER DEFAULT 0',
      'comment_count INTEGER DEFAULT 0',
      'deal_count INTEGER DEFAULT 0',
      'deal_amount REAL DEFAULT 0',
      'favorite_count INTEGER DEFAULT 0',
      'share_count INTEGER DEFAULT 0',
      'city_remark TEXT',
      'submitted_by TEXT',
      'submitted_at TEXT',
      'review_status TEXT DEFAULT "pending"'
    ].forEach(definition => addColumnIfMissing('city_distributions', definition));

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_city_role ON users(city_id, role);
      CREATE INDEX IF NOT EXISTS idx_city_distributions_account_status ON city_distributions(account_id, status);
    `);
  });
};

// 插入初始数据
const initSeedData = () => {
  const staffCount = db.prepare('SELECT COUNT(*) as count FROM staffs').get();
  if (staffCount.count === 0) {
    const insertStaff = db.prepare('INSERT INTO staffs (id, name, role) VALUES (?, ?, ?)');
    insertStaff.run('staff_1', '李明', 'both');
    insertStaff.run('staff_2', '王晶', 'shooter');
    insertStaff.run('staff_3', '张伟', 'editor');
    console.log('初始人员数据插入完成');
  }

  const typeCount = db.prepare('SELECT COUNT(*) as count FROM video_types').get();
  if (typeCount.count === 0) {
    const insertType = db.prepare('INSERT INTO video_types (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)');
    insertType.run('type_1', '招商类', '🏪', '#FF9F43', 1);
    insertType.run('type_2', '技师类', '👩', '#9B59B6', 2);
    insertType.run('type_3', '剧情类', '🎬', '#34C759', 3);
    insertType.run('type_4', '品牌宣传', '📢', '#FF6B6B', 4);
    insertType.run('type_5', '服务展示', '💆', '#5E5CE6', 5);
    console.log('初始视频类型数据插入完成');
  }

  const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
  if (accountCount.count === 0) {
    const insertAccount = db.prepare('INSERT INTO accounts (id, name, platform, type) VALUES (?, ?, ?, ?)');
    insertAccount.run('acc_1', '遇见招商号', 'douyin', 'self');
    insertAccount.run('acc_2', '遇见技师号', 'douyin', 'self');
    insertAccount.run('acc_3', '遇见官方号', 'kuaishou', 'self');
    insertAccount.run('acc_4', '遇见视频号', 'weixin', 'self');
    insertAccount.run('acc_5', '遇见小红书', 'xiaohongshu', 'self');
    console.log('初始账号数据插入完成');
  }

  const hqAccountCount = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE type = ? AND status = ?").get('hq', 'active');
  if (hqAccountCount.count === 0) {
    const insertHqAccount = db.prepare(`
      INSERT INTO accounts (
        id, name, platform, platform_account, type, status,
        account_type, platform_label, cert, frequency, priority, owner, editor, purpose, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ['hq_1', '美好的一天', 'douyin', '', '招商', '', '每日1条', 'high', '张林', '宝玉、桑乾', '招商加盟', '刘总监自己账号发布'],
      ['hq_2', '遇见优选', 'douyin', '', '美女', '陕西遇见文化传媒有限公司', '每日1条', 'high', '张林', '宝玉、桑乾', '打流量做成交', '进行中'],
      ['hq_3', '遇见约到家', 'douyin', '', '官方', '陕西遇见约到家网络科技有限公司', '每周2条', 'low', '张林', '宝玉、桑乾', '品宣', '进行中'],
      ['hq_4', '遇见你', 'douyin', '', '养生', '', '2天1条', 'medium', '张林', '宝玉、桑乾', '打流量做成交', '进行中'],
      ['hq_5', '遇见（向阳而生）', 'douyin', '', '剧情号', '', '每日1条', 'medium', '张林', '宝玉、桑乾', '做账号流量', '进行中'],
      ['hq_6', '来财（遇见）', 'douyin', '', '美女号', '', '每日1条', 'high', '李强', '宝玉、桑乾', '打流量做成交', '进行中'],
      ['hq_7', '遇见约到家', 'weixin', '', '剧情官方', '陕西遇见约到家网络科技有限公司', '每日1条', 'high', '张林', '宝玉、桑乾', '打流量做成交', '进行中'],
      ['hq_8', '遇见约到家', 'kuaishou', '', '剧情号', '', '每日1条', 'high', '张林', '宝玉、桑乾', '做账号流量', '进行中'],
      ['hq_9', '遇见（向阳而生）', 'xiaohongshu', '', '剧情号', '', '每日1条', 'high', '张林', '宝玉、桑乾', '做账号流量', '进行中'],
      ['hq_10', '遇见小程', 'weixin', '', '美女号', '', '每日1条', 'high', '张林', '宝玉、桑乾', '打流量做成交', '进行中'],
      ['hq_11', '遇见官方账号', 'douyin', '', '跳舞', '', '每日一条', 'medium', '李强', '宝玉、桑乾', '做流量', '进行中']
    ].forEach(account => {
      insertHqAccount.run(
        account[0],
        account[1],
        account[2],
        '',
        'hq',
        'active',
        account[4],
        account[2],
        account[5],
        account[6],
        account[7],
        account[8],
        account[9],
        account[10],
        account[11]
      );
    });
    console.log('总部账号基础数据插入完成');
  }

  const cityCount = db.prepare('SELECT COUNT(*) as count FROM cities').get();
  if (cityCount.count === 0) {
    const cities = ['西安', '成都', '武汉', '重庆', '郑州', '长沙', '昆明', '贵阳', '南宁', '广州'];
    const insertCity = db.prepare('INSERT INTO cities (id, name, status) VALUES (?, ?, ?)');
    cities.forEach((city, index) => {
      insertCity.run(`city_${index + 1}`, city, 'active');
    });
    console.log('初始城市数据插入完成');
  }

  const goalCount = db.prepare('SELECT COUNT(*) as count FROM monthly_goals').get();
  if (goalCount.count === 0) {
    const insertGoal = db.prepare('INSERT INTO monthly_goals (id, month, shoot_target, edit_target, publish_target, play_target) VALUES (?, ?, ?, ?, ?, ?)');
    insertGoal.run('goal_1', '2026-06', 100, 100, 100, 1000000);
    console.log('初始月度目标数据插入完成');
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0 && process.env.ADMIN_PASSWORD) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
      .run('user_admin', username, passwordHash, '系统管理员', 'admin');
    console.log(`初始管理员已创建：${username}`);
  }
};

initTables();
runMigrations();
ensureCurrentSchema();
initSeedData();

module.exports = db;
