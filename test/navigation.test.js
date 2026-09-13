'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function seedMember(window, overrides = {}) {
  const member = { id: '1', type: 'adult', name: 'Nguyễn Văn A', banks: [], documents: [], ...overrides };
  window.__state.members = [member];
  return member;
}

function isHidden(window, id) {
  return window.document.getElementById(id).classList.contains('hidden');
}

test('viewDetails() với id hợp lệ hiển thị đúng màn hình chi tiết', () => {
  const { window } = createApp();
  seedMember(window, { id: '42', name: 'Trần Thị B' });

  window.viewDetails('42', true);

  assert.equal(isHidden(window, 'detailView'), false);
  assert.equal(isHidden(window, 'homeView'), true);
  assert.equal(window.document.getElementById('dtName').innerText, 'Trần Thị B');
  assert.equal(window.__state.currentMemberId, '42');
});

test('viewDetails() với id không tồn tại (link cũ/đã xóa) phải quay về trang chủ, không được treo UI', () => {
  const { window } = createApp();
  seedMember(window, { id: '1' });

  window.viewDetails('id-khong-ton-tai', true);

  assert.equal(isHidden(window, 'homeView'), false, 'phải hiện lại trang chủ thay vì màn hình trắng');
  assert.equal(isHidden(window, 'detailView'), true);
  assert.equal(
    window.document.getElementById('btnAddMember').classList.contains('hidden'),
    false,
    'nút "+ Thêm thành viên" không được kẹt ẩn'
  );
  assert.equal(
    window.document.getElementById('btnToggleSelect').classList.contains('hidden'),
    false,
    'nút "Quản lý / Chọn" không được kẹt ẩn'
  );
});

test('openDocsView() với id không tồn tại phải báo lỗi và quay về trang chủ, không kẹt UI', () => {
  const { window } = createApp();
  seedMember(window, { id: '1' });
  let alertMessage = null;
  window.alert = (msg) => { alertMessage = msg; };

  window.openDocsView('id-khong-ton-tai', true);

  assert.match(alertMessage || '', /Không tìm thấy/);
  assert.equal(isHidden(window, 'homeView'), false);
  assert.equal(isHidden(window, 'docsView'), true);
  assert.equal(window.document.getElementById('btnAddMember').classList.contains('hidden'), false);
});

test('navigateApp("member") cập nhật URL và hiện màn hình chi tiết tương ứng', () => {
  const { window } = createApp();
  seedMember(window, { id: '7', name: 'Lê Văn C' });

  window.navigateApp('member', { id: '7' });

  assert.equal(window.location.search, '?member=7');
  assert.equal(isHidden(window, 'detailView'), false);
  assert.equal(window.document.getElementById('dtName').innerText, 'Lê Văn C');
});

test('navigateApp("home") xóa query string và hiện lại trang chủ', () => {
  const { window } = createApp();
  seedMember(window, { id: '7' });
  window.navigateApp('member', { id: '7' });

  window.navigateApp('home');

  assert.equal(window.location.search, '');
  assert.equal(isHidden(window, 'homeView'), false);
});

test('renderGrid() hiện thông báo trống khi chưa có thành viên nào', () => {
  const { window } = createApp();
  window.__state.members = [];

  window.renderGrid();

  assert.match(window.document.getElementById('memberGrid').innerHTML, /Chưa có thành viên nào/);
});

test('goBackInApp() từ form quay lại đúng màn hình chi tiết trước đó (dùng lịch sử trình duyệt)', async () => {
  const { window } = createApp();
  const member = seedMember(window, { id: '9', name: 'Phạm Thị D' });
  window.__state.masterPassword = 'mat-khau-test'; // popstate handler chỉ hoạt động sau khi đã đăng nhập

  window.navigateApp('member', { id: member.id }); // vào trang chi tiết (đẩy lịch sử)
  window.openForm(member); // bấm "Chỉnh sửa" (đẩy thêm 1 mốc lịch sử, không đổi URL)
  assert.equal(isHidden(window, 'formView'), false);

  const popstateFired = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  window.goBackInApp();
  await popstateFired;

  assert.equal(isHidden(window, 'formView'), true, 'phải rời khỏi form sau khi back');
  assert.equal(isHidden(window, 'detailView'), false, 'phải quay lại đúng trang chi tiết vừa xem');
});
