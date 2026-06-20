const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('materials');

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

test('materials CRUD operations', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  // Create a video type first
  const videoTypeRes = await fetch(`${base}/video-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '测试类型', icon: 'test', color: '#fff', sort_order: 1 })
  });
  assert.equal(videoTypeRes.status, 200);
  const videoTypeData = await videoTypeRes.json();
  assert.ok(videoTypeData.data.id);
  const videoTypeId = videoTypeData.data.id;

  // Create material
  const createRes = await fetch(`${base}/materials`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-01-15',
      staff_id: 'manual',
      staff_name: '测试人员',
      video_type_id: videoTypeId,
      shoot_count: 5,
      edit_count: 3,
      upload_count: 2,
      remark: '测试备注'
    })
  });
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.equal(createData.code, 200);
  assert.ok(createData.data.id);
  const materialId = createData.data.id;

  // Read materials list
  const listRes = await fetch(`${base}/materials?page=1&pageSize=10`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.code, 200);
  assert.ok(Array.isArray(listData.data.list));
  assert.ok(listData.data.total >= 1);

  // Read single material
  const getRes = await fetch(`${base}/materials`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.status, 200);

  // Update material
  const updateRes = await fetch(`${base}/materials/${materialId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      date: '2024-01-16',
      staff_id: 'manual',
      video_type_id: videoTypeId,
      shoot_count: 10,
      edit_count: 8,
      upload_count: 5,
      remark: '更新后的备注'
    })
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.code, 200);

  // Delete material
  const deleteRes = await fetch(`${base}/materials/${materialId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.code, 200);
});

test('materials filtering and pagination', async (t) => {
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
    body: JSON.stringify({ name: '过滤测试', icon: 'filter', color: '#000' })
  });
  const videoTypeData = await videoTypeRes.json();
  const videoTypeId = videoTypeData.data.id;

  // Create materials with different dates
  for (let i = 1; i <= 3; i++) {
    await fetch(`${base}/materials`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        date: `2024-01-${10 + i}`,
        video_type_id: videoTypeId,
        shoot_count: i * 2,
        edit_count: i,
        upload_count: 0
      })
    });
  }

  // Filter by date range
  const filterRes = await fetch(`${base}/materials?dateFrom=2024-01-11&dateTo=2024-01-13`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(filterRes.status, 200);
  const filterData = await filterRes.json();
  assert.ok(filterData.data.list.length >= 3);

  // Filter by video type
  const typeFilterRes = await fetch(`${base}/materials?videoTypeId=${videoTypeId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(typeFilterRes.status, 200);
  const typeFilterData = await typeFilterRes.json();
  assert.ok(typeFilterData.data.list.length >= 3);
});

test('media preview token can be created from COS key', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  const previewRes = await fetch(`${base}/media/preview-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ key: '2026-06-13/测试/第五条擦边_123.mp4' })
  });
  assert.equal(previewRes.status, 200);
  const previewData = await previewRes.json();
  assert.equal(previewData.code, 200);
  assert.match(previewData.data.previewUrl, /^\/api\/media\/proxy\?token=/);
  assert.equal(previewData.data.expiresIn, 600);
});
