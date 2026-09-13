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

test('loadDataWithPassword() di trú docType cũ sang 1 trong 7 nhóm chuẩn cho tài liệu/thư mục đang có, giữ nguyên danh mục tự đặt không nằm trong bảng ánh xạ, và đồng bộ lại Firebase', async () => {
  const { window } = createApp();
  const payload = {
    members: [
      {
        id: '1',
        name: 'Bố',
        documents: [
          { id: 'd1', docType: 'CCCD / Định danh cá nhân', desc: 'Mặt trước' },
          { id: 'd2', docType: 'Chi phí', desc: 'Hóa đơn điện' },
          { id: 'd3', docType: 'Ông ngoại đặt tên', desc: 'Giấy tờ tự đặt' }
        ],
        folders: [
          { id: 'f1', docType: 'Giấy khai sinh', name: 'Bản gốc' }
        ]
      }
    ],
    customBankList: []
  };
  const cipherText = window.CryptoJS.AES.encrypt(JSON.stringify(payload), 'pass123').toString();

  const putCalls = [];
  window.fetch = async (url, options) => {
    if (options && options.method === 'PUT') {
      putCalls.push(JSON.parse(options.body));
      return { ok: true, headers: { get: () => null } };
    }
    return { ok: true, json: async () => cipherText, headers: { get: () => null } };
  };

  await window.loadDataWithPassword('pass123');

  const member = window.__state.members[0];
  assert.equal(member.documents.find(d => d.id === 'd1').docType, 'Định danh & Tùy thân');
  assert.equal(member.documents.find(d => d.id === 'd2').docType, 'Chi phí & Hóa đơn');
  assert.equal(member.documents.find(d => d.id === 'd3').docType, 'Ông ngoại đặt tên', 'danh mục tự đặt không khớp bảng ánh xạ phải được giữ nguyên');
  assert.equal(member.folders.find(f => f.id === 'f1').docType, 'Hộ tịch & Gia đình');

  assert.equal(putCalls.length, 1, 'phải gọi pushToFirebase() đúng 1 lần vì có tài liệu được di trú');
  const decrypted = JSON.parse(
    window.CryptoJS.AES.decrypt(putCalls[0], 'pass123').toString(window.CryptoJS.enc.Utf8)
  );
  assert.equal(decrypted.members[0].documents.find(d => d.id === 'd1').docType, 'Định danh & Tùy thân');
});

test('loadDataWithPassword() không gọi pushToFirebase() nếu không có docType/mô tả nào cần di trú', async () => {
  const { window } = createApp();
  const payload = {
    members: [
      {
        id: '1',
        name: 'Bố',
        documents: [{ id: 'd1', docType: 'Chi phí & Hóa đơn', desc: 'Hóa đơn điện' }],
        folders: []
      }
    ],
    customBankList: []
  };
  const cipherText = window.CryptoJS.AES.encrypt(JSON.stringify(payload), 'pass123').toString();

  const putCalls = [];
  window.fetch = async (url, options) => {
    if (options && options.method === 'PUT') {
      putCalls.push(options);
      return { ok: true, headers: { get: () => null } };
    }
    return { ok: true, json: async () => cipherText, headers: { get: () => null } };
  };

  await window.loadDataWithPassword('pass123');

  assert.equal(putCalls.length, 0, 'dữ liệu đã chuẩn hoá từ trước thì không cần ghi lại Firebase');
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
