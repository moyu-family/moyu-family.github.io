'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function fakeFetchReturning(jsonBody) {
  return async () => ({
    ok: true,
    json: async () => jsonBody,
    headers: { get: () => null }
  });
}

test('loadDataWithPassword() giải mã đúng dữ liệu khi mật khẩu chính xác', async () => {
  const { window } = createApp();
  const payload = { members: [{ id: '1', name: 'A' }], customBankList: [] };
  const cipherText = window.CryptoJS.AES.encrypt(JSON.stringify(payload), 'dung-mat-khau').toString();
  window.fetch = fakeFetchReturning(cipherText);

  await window.loadDataWithPassword('dung-mat-khau');

  assert.equal(window.__state.members.length, 1);
  assert.equal(window.__state.members[0].name, 'A');
  assert.equal(window.__state.masterPassword, 'dung-mat-khau');
});

test('loadDataWithPassword() báo lỗi thân thiện (không lộ lỗi kỹ thuật) khi giải mã ra dữ liệu không phải JSON', async () => {
  // Mô phỏng đúng tình huống đã sửa: bản mã hợp lệ nhưng nội dung giải mã ra
  // không phải JSON (trước đây sẽ ném lỗi "Unexpected token..." từ JSON.parse
  // thay vì thông báo sai mật khẩu).
  const { window } = createApp();
  const cipherText = window.CryptoJS.AES.encrypt('đây không phải JSON', 'mat-khau-bat-ky').toString();
  window.fetch = fakeFetchReturning(cipherText);

  await assert.rejects(
    () => window.loadDataWithPassword('mat-khau-bat-ky'),
    (err) => {
      assert.equal(err.message, '', 'phải là lỗi rỗng để tầng trên hiển thị "Mật khẩu không chính xác"');
      return true;
    }
  );
});

test('loadDataWithPassword() báo lỗi rỗng khi sai mật khẩu (AES giải mã ra rác không phải UTF-8 hợp lệ)', async () => {
  const { window } = createApp();
  const cipherText = window.CryptoJS.AES.encrypt(JSON.stringify({ members: [] }), 'mat-khau-dung').toString();
  window.fetch = fakeFetchReturning(cipherText);

  await assert.rejects(
    () => window.loadDataWithPassword('mat-khau-sai'),
    (err) => {
      assert.equal(err.message, '');
      return true;
    }
  );
});

test('pushToFirebase() mã hoá state hiện tại bằng masterPassword và PUT lên Firebase', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{ id: '1', name: 'A' }];

  const calls = [];
  window.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, headers: { get: () => 'W/"etag-1"' } };
  };

  await window.pushToFirebase();
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /data\.json$/);
  assert.equal(calls[0].options.method, 'PUT');
  const body = JSON.parse(calls[0].options.body);
  const decrypted = JSON.parse(
    window.CryptoJS.AES.decrypt(body, 'pass123').toString(window.CryptoJS.enc.Utf8)
  );
  assert.equal(decrypted.members[0].name, 'A');
});

test('pushToFirebase() gọi chồng chéo phải chờ chung request đang chạy, không bắn song song', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{ id: '1', name: 'A' }];

  const pendingResolvers = [];
  let fetchCallCount = 0;
  window.fetch = async () => {
    fetchCallCount += 1;
    return new Promise(resolve => {
      pendingResolvers.push(() => resolve({ ok: true, headers: { get: () => null } }));
    });
  };

  const first = window.pushToFirebase();
  const second = window.pushToFirebase(); // gọi chồng lên khi lần đầu chưa xong

  // Trong lúc request đầu vẫn đang "bay", request thứ hai phải chờ chung
  // (activeSavePromise) chứ không tự bắn thêm fetch song song ngay lập tức.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetchCallCount, 1, 'không được gửi request song song khi lần trước chưa xong');

  // Lần lượt giải phóng mọi request đang treo (kể cả request phát sinh thêm sau
  // khi request đầu xong) cho tới khi cả hai lời gọi hoàn tất hẳn.
  let settled = false;
  Promise.all([first, second]).then(() => { settled = true; });
  for (let i = 0; i < 10 && !settled; i++) {
    while (pendingResolvers.length) pendingResolvers.shift()();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(settled, 'cả hai lệnh gọi pushToFirebase() phải hoàn tất, không bị treo/deadlock');
});
