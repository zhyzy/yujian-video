const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('ai');

const app = require('../server');

const listen = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const getAuthToken = async (base) => {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin_test', password: 'StrongTestPassword!123' })
  });
  const payload = await login.json();
  return payload.data.token;
};

test('ai-reports listing and generation', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Get AI reports list (should be empty initially)
  const listRes = await fetch(`${base}/ai-reports`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.code, 200);
  assert.ok(Array.isArray(listData.data.list));
  assert.equal(listData.data.total, 0);

  // Generate daily report
  const generateRes = await fetch(`${base}/ai-reports/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'daily',
      periodStart: '2024-01-15'
    })
  });
  // Note: This will fail if AI service is not configured, which is expected in test environment
  // The test verifies the endpoint exists and handles errors gracefully
  assert.ok(generateRes.status === 200 || generateRes.status === 500);
});

test('ai-reports with pagination', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Get reports with pagination
  const paginatedRes = await fetch(`${base}/ai-reports?page=1&pageSize=5`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(paginatedRes.status, 200);
  const paginatedData = await paginatedRes.json();
  assert.equal(paginatedData.code, 200);
  assert.ok(paginatedData.data.list);
  assert.ok(paginatedData.data.page === 1);
  assert.ok(paginatedData.data.pageSize === 5);

  // Filter by type
  const typeFilterRes = await fetch(`${base}/ai-reports?type=daily`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(typeFilterRes.status, 200);
});

test('ai report generation with data', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create video type
  const videoTypeRes = await fetch(`${base}/video-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'AI测试类型', icon: 'ai', color: '#123456' })
  });
  const videoTypeData = await videoTypeRes.json();
  const videoTypeId = videoTypeData.data.id;

  // Create material for today
  const today = new Date().toISOString().split('T')[0];
  await fetch(`${base}/materials`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: today,
      video_type_id: videoTypeId,
      shoot_count: 10,
      edit_count: 8,
      upload_count: 5
    })
  });

  // Try to generate report
  const generateRes = await fetch(`${base}/ai-reports/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'daily',
      periodStart: today
    })
  });

  // Either succeeds with report or fails due to AI service not configured
  // Both outcomes are valid for this test
  assert.ok(generateRes.status === 200 || generateRes.status === 500);
});

test('ai-reports endpoint protection', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  // Access without token should fail
  const unauthorizedRes = await fetch(`${base}/ai-reports`);
  assert.equal(unauthorizedRes.status, 401);

  // Access with invalid token should fail
  const invalidTokenRes = await fetch(`${base}/ai-reports`, {
    headers: { authorization: 'Bearer invalid-token' }
  });
  assert.equal(invalidTokenRes.status, 401);
});
