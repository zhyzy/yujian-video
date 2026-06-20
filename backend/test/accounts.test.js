const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('accounts');

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

test('accounts CRUD operations', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create account
  const createRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: '测试账号',
      platform: 'douyin',
      platform_account: 'test_douyin',
      type: 'self',
      priority: 'high',
      owner: '测试运营'
    })
  });
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.equal(createData.code, 200);
  assert.ok(createData.data.id);
  const accountId = createData.data.id;

  // Read accounts list
  const listRes = await fetch(`${base}/accounts`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.code, 200);
  assert.ok(Array.isArray(listData.data));
  assert.ok(listData.data.length >= 1);

  // Filter by platform
  const platformFilterRes = await fetch(`${base}/accounts?platform=douyin`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(platformFilterRes.status, 200);
  const platformFilterData = await platformFilterRes.json();
  assert.ok(platformFilterData.data.every(a => a.platform === 'douyin'));

  // Filter by type
  const typeFilterRes = await fetch(`${base}/accounts?type=self`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(typeFilterRes.status, 200);

  // Update account
  const updateRes = await fetch(`${base}/accounts/${accountId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: '更新后的账号',
      platform: 'kuaishou',
      platform_account: 'test_kuaishou',
      type: 'city',
      priority: 'medium',
      owner: '新运营'
    })
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.code, 200);

  // Update publish status
  const publishStatusRes = await fetch(`${base}/accounts/${accountId}/publish-status`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-01-15',
      status: 'published'
    })
  });
  assert.equal(publishStatusRes.status, 200);

  // Delete account (archive)
  const deleteRes = await fetch(`${base}/accounts/${accountId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.code, 200);
});

test('accounts different types', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create city account
  const cityRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '城市账号', platform: 'douyin', type: 'city', city_id: 'city-1' })
  });
  assert.equal(cityRes.status, 200);
  const cityData = await cityRes.json();
  assert.ok(cityData.data.id);

  // Create hq account
  const hqRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '总部账号', platform: 'weixin', type: 'hq' })
  });
  assert.equal(hqRes.status, 200);

  // Create other account
  const otherRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '其他账号', platform: 'other', type: 'other' })
  });
  assert.equal(otherRes.status, 200);

  // Verify all accounts are created
  const listRes = await fetch(`${base}/accounts`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  assert.ok(listData.data.length >= 3);
});

test('accounts validation', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create without name should fail (name is required)
  const noNameRes = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ platform: 'douyin' })
  });
  assert.equal(noNameRes.status, 400);
});
