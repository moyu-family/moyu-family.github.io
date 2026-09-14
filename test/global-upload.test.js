'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

test('renderGlobalFilePreview(): hiện thông báo trống khi chưa có ảnh nào, vẽ đủ số thumbnail khi có tệp', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [];

  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.match(preview.textContent, /Chưa có ảnh nào/);

  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'to-khai.pdf', type: 'application/pdf' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  assert.equal(preview.querySelectorAll('.gu-file-thumb-item').length, 2);
});

test('removeGlobalFile(): gỡ đúng 1 ảnh khỏi danh sách đang chờ lưu (lỡ chọn nhầm/ảnh mờ)', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'b.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();

  window.removeGlobalFile(0);

  assert.deepEqual(Array.from(window.__state.globalUploadFiles).map(e => e.file.name), ['b.jpg']);
  assert.equal(window.document.getElementById('guFilePreview').querySelectorAll('.gu-file-thumb-item').length, 1);
});

test('onGlobalFileSelected(): nạp tệp vừa chụp/chọn rồi tự mở modal Xem lại nhanh', () => {
  const { window } = createApp();
  // Dùng tệp PDF để tránh phải giả lập URL.createObjectURL() (jsdom không hỗ trợ sẵn) -
  // nhánh PDF trong onGlobalFileSelected() không gọi tới hàm này.
  const fakeInput = { files: [{ name: 'giay-to.pdf', type: 'application/pdf' }], value: 'C:\\fakepath\\giay-to.pdf' };

  window.onGlobalFileSelected(fakeInput);

  assert.equal(window.__state.globalUploadFiles.length, 1);
  assert.equal(window.__state.globalUploadFiles[0].file.name, 'giay-to.pdf');
  assert.equal(window.document.getElementById('globalUploadModal').classList.contains('hidden'), false);
});

test('closeGlobalUploadModal(): bấm Hủy thì đóng modal, xóa sạch danh sách tệp đang chờ, không ghi dữ liệu gì cả', () => {
  const { window } = createApp();
  window.__state.members = [];
  window.__state.globalUploadFiles = [{ file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null }];
  window.document.getElementById('globalUploadModal').classList.remove('hidden');

  window.closeGlobalUploadModal();

  assert.equal(window.document.getElementById('globalUploadModal').classList.contains('hidden'), true);
  assert.equal(window.__state.globalUploadFiles.length, 0);
  assert.equal(window.__state.members.length, 0, 'Hủy không được ghi hồ sơ hay tài liệu nào');
});

test('saveGlobalDocument(): không có tệp nào thì từ chối lưu, không đụng tới members', async () => {
  const { window } = createApp();
  window.__state.members = [];
  window.__state.globalUploadFiles = [];
  window.alert = () => {};

  await window.saveGlobalDocument();

  assert.equal(window.__state.members.length, 0);
});

test('saveGlobalDocument(): lưu thẳng vào kho "Chưa gán chủ sở hữu" với status pending, không hỏi chủ sở hữu/danh mục/ghi chú/gắn thẻ', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.uploadEncryptedFileToStorage = async () => 'https://res.cloudinary.com/fake.enc';
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.__state.globalUploadFiles = [{ file: { name: 'bill.jpg', type: 'image/jpeg' }, previewUrl: null }];

  await window.saveGlobalDocument();

  const bucket = window.__state.members.find(m => m.id === 'unassigned_pending');
  assert.ok(bucket, 'phải tự tạo kho "Chưa gán chủ sở hữu"');
  assert.equal(bucket.documents.length, 1);
  const doc = bucket.documents[0];
  assert.equal(doc.status, 'pending');
  assert.equal(doc.tags, undefined, 'không được gắn thẻ nào');
  assert.equal(window.getAllPendingDocuments().length, 1, 'phải xuất hiện trong Hồ sơ tạm để hoàn tất phân loại sau');
  assert.equal(window.displayMembers().length, 0, 'kho "Chưa gán chủ sở hữu" không được lộ diện như 1 thành viên bình thường');
  assert.equal(window.document.getElementById('globalUploadModal').classList.contains('hidden'), true, 'phải tự đóng modal sau khi lưu xong');
});

test('saveGlobalDocument(): chọn nhiều ảnh cùng lúc thì lưu đủ từng tệp một vào cùng kho "Chưa gán chủ sở hữu"', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.uploadEncryptedFileToStorage = async (file) => `https://res.cloudinary.com/${file.name}.enc`;
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'mat-sau.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];

  await window.saveGlobalDocument();

  const bucket = window.__state.members.find(m => m.id === 'unassigned_pending');
  assert.equal(bucket.documents.length, 2, 'phải lưu đủ 2 tệp đã chọn');
  // Array.from() để tạo mảng ở realm hiện tại (mảng gốc thuộc realm của jsdom window).
  assert.deepEqual(Array.from(bucket.documents, d => d.fileName).sort(), ['mat-sau.jpg', 'mat-truoc.jpg']);
  assert.ok(bucket.documents.every(d => d.status === 'pending'));
});

test('saveGlobalDocument(): nếu upload thất bại và kho "Chưa gán chủ sở hữu" vừa được tạo mới, phải rollback (không để lại hồ sơ rỗng)', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.uploadEncryptedFileToStorage = async () => { throw new Error('Mất mạng'); };
  window.alert = () => {};

  window.__state.globalUploadFiles = [{ file: { name: 'bill.jpg', type: 'image/jpeg' }, previewUrl: null }];

  await window.saveGlobalDocument();

  assert.equal(window.__state.members.length, 0, 'kho rỗng phải được rollback khi lưu thất bại');
});
