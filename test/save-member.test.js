'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function fillMinimalMemberForm(window, { id, name = 'Người dùng test' }) {
  const byId = (elId) => window.document.getElementById(elId);
  byId('fId').value = id;
  byId('fType').value = 'adult';
  byId('fName').value = name;
  byId('fDob').value = '';
  byId('fCccdDate').value = '';
  byId('fAvatarUrl').value = '';
}

function submitSaveMember(window) {
  return window.saveMember({ preventDefault() {} });
}

test('saveMember(): khi tải lại avatar cũ (base64) lên storage thất bại, nút Lưu phải được mở khoá lại', async () => {
  const { window } = createApp();
  const memberId = '100';
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{
    id: memberId,
    type: 'adult',
    name: 'Thành viên cũ',
    avatar: 'data:image/png;base64,AAAA',
    banks: [],
    documents: []
  }];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.uploadFileToStorage = async () => { throw new Error('Mất kết nối mạng khi tải ảnh.'); };

  fillMinimalMemberForm(window, { id: memberId });

  let alertMessage = null;
  window.alert = (msg) => { alertMessage = msg; };

  await submitSaveMember(window);

  assert.match(alertMessage || '', /Mất kết nối mạng/);
  const saveButtons = window.document.querySelectorAll('#memberForm button[type="submit"], button[form="memberForm"]');
  assert.ok(saveButtons.length > 0, 'phải tìm thấy ít nhất 1 nút Lưu trong DOM');
  for (const button of saveButtons) {
    assert.equal(button.disabled, false, 'nút Lưu không được kẹt ở trạng thái khoá sau khi upload thất bại');
  }
});

test('saveMember(): lưu thành công một thành viên mới và gọi pushToFirebase với đúng dữ liệu', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];

  let putBody = null;
  window.fetch = async (url, options) => {
    putBody = options.body;
    return { ok: true, headers: { get: () => 'W/"etag-1"' } }; // ETag có sẵn -> khỏi cần fetch GET lần 2
  };

  fillMinimalMemberForm(window, { id: '', name: 'Thành viên mới' });
  window.alert = () => {};

  await submitSaveMember(window);

  assert.equal(window.__state.members.length, 1);
  assert.equal(window.__state.members[0].name, 'Thành viên mới');
  assert.ok(putBody, 'phải gọi pushToFirebase (PUT) sau khi lưu thành công');

  const decrypted = JSON.parse(
    window.CryptoJS.AES.decrypt(JSON.parse(putBody), 'pass123').toString(window.CryptoJS.enc.Utf8)
  );
  assert.equal(decrypted.members[0].name, 'Thành viên mới');
});

test('saveMember(): từ chối ngày sinh sai định dạng và không thay đổi danh sách thành viên', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.fetch = async () => { throw new Error('Không được gọi mạng khi form không hợp lệ'); };

  fillMinimalMemberForm(window, { id: '', name: 'X' });
  window.document.getElementById('fDob').value = '31/02/2024'; // 31/02 không tồn tại

  let alertMessage = null;
  window.alert = (msg) => { alertMessage = msg; };

  await submitSaveMember(window);

  assert.match(alertMessage || '', /Ngày sinh không đúng định dạng/);
  assert.equal(window.__state.members.length, 0);
});
