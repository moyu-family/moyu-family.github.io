'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function seedMemberWithFolder(window) {
  window.__state.members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [{ id: 'f1', docType: 'Bằng cấp', parentId: null, name: 'Bằng tốt nghiệp' }],
    documents: [{ id: 'd0', docType: 'Bằng cấp', folderId: 'f1', desc: 'CV cũ', fileType: 'image/jpeg', createdAt: '01/01/2024' }]
  }];
}

test('detectGlobalUploadContext(): trả về null (rơi về Hồ sơ tạm) ở trang chủ và khi mới vào "Tất cả danh mục" (chưa bấm vào danh mục nào)', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);

  window.showHome(true);
  assert.equal(window.detectGlobalUploadContext(), null, 'trang chủ không có ngữ cảnh lưu rõ ràng');

  window.openDocsView('1', true);
  assert.equal(window.detectGlobalUploadContext(), null, 'còn ở "Tất cả danh mục" thì chưa xác định được danh mục đích');
});

test('detectGlobalUploadContext(): luôn trả về null ở Kho tổng/Hồ sơ tổng hợp, kể cả khi đã mở 1 danh mục cụ thể (gộp nhiều chủ sở hữu, không có 1 đích rõ ràng)', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);

  window.openConsolidatedView({ skipHistory: true });
  window.openConsolidatedCategoryDetails('Bằng cấp');

  assert.equal(window.detectGlobalUploadContext(), null);
});

test('detectGlobalUploadContext(): xác định đúng ownerId/docType khi đang đứng ngay trong 1 danh mục (thư mục gốc, chưa vào thư mục con)', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp');

  const ctx = window.detectGlobalUploadContext();
  assert.ok(ctx);
  assert.equal(ctx.ownerId, '1');
  assert.equal(ctx.docType, 'Bằng cấp');
  assert.equal(ctx.folderId, null);
  assert.equal(ctx.label, 'Bằng cấp');
});

test('detectGlobalUploadContext(): xác định đúng cả folderId + lấy tên thư mục con làm nhãn khi đang đứng trong thư mục con', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp', 'f1');

  const ctx = window.detectGlobalUploadContext();
  assert.ok(ctx);
  assert.equal(ctx.ownerId, '1');
  assert.equal(ctx.docType, 'Bằng cấp');
  assert.equal(ctx.folderId, 'f1');
  assert.equal(ctx.label, 'Bằng tốt nghiệp');
});

test('onGlobalFileSelected(): đổi nhãn nút Lưu theo đúng ngữ cảnh - "Lưu vào Hồ sơ tạm" mặc định, "Lưu vào [tên thư mục]" khi đang đứng trong 1 danh mục', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);
  const fakeInput = () => ({ files: [{ name: 'giay-to.pdf', type: 'application/pdf' }], value: 'C:\\fakepath\\giay-to.pdf' });

  window.showHome(true);
  window.onGlobalFileSelected(fakeInput());
  assert.equal(window.document.getElementById('btnSaveGlobalDoc').textContent, 'Lưu vào Hồ sơ tạm');
  window.closeGlobalUploadModal();

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp', 'f1');
  window.onGlobalFileSelected(fakeInput());
  assert.equal(window.document.getElementById('btnSaveGlobalDoc').textContent, 'Lưu vào Bằng tốt nghiệp');
});

test('saveGlobalDocument(): có ngữ cảnh -> lưu thẳng vào đúng ownerId/docType/folderId với status completed, không phải Hồ sơ tạm', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  seedMemberWithFolder(window);
  window.uploadEncryptedFileToStorage = async (file) => `https://res.cloudinary.com/${file.name}.enc`;
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};
  let toastMessage = null;
  window.showToast = (msg) => { toastMessage = msg; };

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp', 'f1');
  window.__state.globalUploadFiles = [{ file: { name: 'bang.jpg', type: 'image/jpeg' }, previewUrl: null }];
  window.onGlobalFileSelected({ files: [], value: '' }); // chỉ để tính lại ngữ cảnh cho đúng, không nạp thêm tệp

  await window.saveGlobalDocument();

  const m = window.__state.members.find(item => item.id === '1');
  assert.equal(m.documents.length, 2, 'phải thêm tài liệu mới, không đụng tài liệu cũ');
  const newDoc = m.documents.find(d => d.fileName === 'bang.jpg');
  assert.ok(newDoc, 'phải lưu vào đúng hồ sơ thành viên hiện tại, không phải kho Chưa gán chủ sở hữu');
  assert.equal(newDoc.docType, 'Bằng cấp');
  assert.equal(newDoc.folderId, 'f1');
  assert.equal(newDoc.status, 'completed');
  assert.equal(window.__state.members.some(item => item.id === 'unassigned_pending'), false, 'không được tạo kho Chưa gán chủ sở hữu trong trường hợp này');
  assert.match(toastMessage || '', /Đã lưu 1 tệp vào Bằng tốt nghiệp/);
  assert.equal(window.document.getElementById('globalUploadModal').classList.contains('hidden'), true);
  assert.equal(window.document.querySelectorAll('#docsExplorerContent .file-card').length, 2, 'phải vẽ lại ngay danh sách tệp tại thư mục hiện hành');
});

test('saveGlobalDocument(): có ngữ cảnh, chọn nhiều tệp trùng tên vẫn lưu đủ từng tệp với id riêng biệt, không ghi đè lẫn nhau', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  seedMemberWithFolder(window);
  window.uploadEncryptedFileToStorage = async (file, path) => `https://res.cloudinary.com/${path}.enc`;
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp', 'f1');
  window.__state.globalUploadFiles = [
    { file: { name: 'scan.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'scan.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.onGlobalFileSelected({ files: [], value: '' });

  await window.saveGlobalDocument();

  const m = window.__state.members.find(item => item.id === '1');
  const newDocs = Array.from(m.documents).filter(d => d.fileName === 'scan.jpg');
  assert.equal(newDocs.length, 2, 'cả 2 tệp trùng tên phải được lưu, không được ghi đè nhau');
  assert.notEqual(newDocs[0].id, newDocs[1].id, 'mỗi tệp phải có id riêng biệt dù trùng tên');
  assert.ok(newDocs.every(d => d.docType === 'Bằng cấp' && d.folderId === 'f1' && d.status === 'completed'));
});

test('header "Tải lên tệp giấy tờ" dùng chung logic với FAB: onclick gọi thẳng triggerGlobalUploadFab(), không còn mở form/modal upload cũ', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);
  window.openDocsView('1', true);

  const headerButtons = Array.from(window.document.querySelectorAll('#docsView button'));
  const uploadBtn = headerButtons.find(b => b.textContent.includes('Tải lên tệp giấy tờ'));
  assert.ok(uploadBtn, 'phải còn nút "Tải lên tệp giấy tờ" trên đầu trang Hồ sơ cá nhân');
  assert.equal(uploadBtn.getAttribute('onclick'), 'triggerGlobalUploadFab()');

  assert.equal(window.document.getElementById('uploadDocModal'), null, 'modal form upload cũ (dropdown danh mục/thư mục) phải được xóa hoàn toàn khỏi DOM');
  assert.equal(typeof window.openUploadDocModal, 'undefined', 'hàm render form cũ không còn tồn tại');
  assert.equal(typeof window.saveDocument, 'undefined', 'hàm lưu của form cũ không còn tồn tại');
});

test('saveGlobalDocument(): bấm Hủy vẫn hoạt động bình thường khi đang có ngữ cảnh - đóng modal, không lưu gì, xóa sạch ngữ cảnh', () => {
  const { window } = createApp();
  seedMemberWithFolder(window);

  window.openDocsView('1', true);
  window.openFolderDetails('Bằng cấp', 'f1');
  window.__state.globalUploadFiles = [{ file: { name: 'bang.jpg', type: 'image/jpeg' }, previewUrl: null }];
  window.onGlobalFileSelected({ files: [], value: '' });
  assert.equal(window.document.getElementById('btnSaveGlobalDoc').textContent, 'Lưu vào Bằng tốt nghiệp');

  window.closeGlobalUploadModal();

  assert.equal(window.document.getElementById('globalUploadModal').classList.contains('hidden'), true);
  assert.equal(window.__state.globalUploadFiles.length, 0);
  const m = window.__state.members.find(item => item.id === '1');
  assert.equal(m.documents.length, 1, 'Hủy không được lưu tệp nào');
});
