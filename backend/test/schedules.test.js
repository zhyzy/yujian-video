const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('schedules');

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

test('schedules CRUD operations', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create account first
  const accountRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '测试账号', platform: 'douyin' })
  });
  assert.equal(accountRes.status, 200);
  const accountData = await accountRes.json();
  const accountId = accountData.data.id;

  // Create schedule
  const createRes = await fetch(`${base}/schedules`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-01-15',
      time: '12:00',
      account_id: accountId,
      video_title: '测试视频',
      status: 'pending'
    })
  });
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.equal(createData.code, 200);
  assert.ok(createData.data.id);
  const scheduleId = createData.data.id;

  // Read schedules list
  const listRes = await fetch(`${base}/schedules?page=1&pageSize=10`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.code, 200);
  assert.ok(Array.isArray(listData.data.list));

  // Read single schedule
  const getRes = await fetch(`${base}/schedules`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.status, 200);

  // Update schedule
  const updateRes = await fetch(`${base}/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-01-16',
      time: '18:00',
      account_id: accountId,
      video_title: '更新后的视频',
      status: 'published',
      published_url: 'https://example.com/video'
    })
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.code, 200);

  // Delete schedule
  const deleteRes = await fetch(`${base}/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.code, 200);
});

test('schedules calendar view', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create account
  const accountRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '日历测试账号', platform: 'kuaishou' })
  });
  const accountData = await accountRes.json();
  const accountId = accountData.data.id;

  // Create schedule
  await fetch(`${base}/schedules`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-06-15',
      time: '10:00',
      account_id: accountId,
      video_title: '日历测试视频'
    })
  });

  // Get calendar view
  const calendarRes = await fetch(`${base}/schedules/calendar?year=2024&month=6`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(calendarRes.status, 200);
  const calendarData = await calendarRes.json();
  assert.equal(calendarData.code, 200);
  assert.ok(Array.isArray(calendarData.data));
});

test('schedules filtering', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create account
  const accountRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '过滤测试账号', platform: 'weixin' })
  });
  const accountData = await accountRes.json();
  const accountId = accountData.data.id;

  // Create schedules
  for (let i = 0; i < 2; i++) {
    await fetch(`${base}/schedules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        date: `2024-01-${15 + i}`,
        time: '12:00',
        account_id: accountId,
        video_title: `过滤测试视频${i}`,
        status: i === 0 ? 'pending' : 'published'
      })
    });
  }

  // Filter by status
  const statusFilterRes = await fetch(`${base}/schedules?status=pending`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(statusFilterRes.status, 200);
  const statusFilterData = await statusFilterRes.json();
  assert.ok(statusFilterData.data.list.length >= 1);

  // Filter by account
  const accountFilterRes = await fetch(`${base}/schedules?accountId=${accountId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(accountFilterRes.status, 200);
  const accountFilterData = await accountFilterRes.json();
  assert.ok(accountFilterData.data.list.length >= 2);

  // Filter by date range
  const dateFilterRes = await fetch(`${base}/schedules?dateFrom=2024-01-01&dateTo=2024-01-31`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(dateFilterRes.status, 200);
  const dateFilterData = await dateFilterRes.json();
  assert.ok(dateFilterData.data.list.length >= 2);
});
