const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const cleanupTestDb = (dbPath = process.env.DB_PATH) => {
  if (!dbPath) return;
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {}
  }
};

const setupTestEnv = (suiteName) => {
  const safeName = suiteName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  process.env.DB_PATH = path.join(os.tmpdir(), `yj-media-${safeName}-${process.pid}-${randomUUID()}.db`);
  process.env.ADMIN_USERNAME = 'admin_test';
  process.env.ADMIN_PASSWORD = 'StrongTestPassword!123';
  process.env.JWT_SECRET = `test-secret-${safeName}-${randomUUID()}`;
  process.env.VOLCANO_ARK_API_KEY = '';
  process.env.COS_SECRET_ID = 'test-secret-id';
  process.env.COS_SECRET_KEY = 'test-secret-key';
  process.env.COS_BUCKET = 'test-bucket-1250000000';
  process.env.COS_REGION = 'ap-shanghai';
  process.on('exit', () => cleanupTestDb());
};

module.exports = {
  cleanupTestDb,
  setupTestEnv
};
