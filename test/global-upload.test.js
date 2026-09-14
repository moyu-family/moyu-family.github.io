'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function setupModalDom(window, { owner = 'family_shared', category = 'Chi phí', folder = '', desc = 'Học phí kỳ 1', file } = {}) {
  const byId = (id) => window.document.getElementById(id);
  window.populateGlobalOwnerSelect();
  byId('guOwnerSelect').value = owner;
  byId('guCategorySelect').innerHTML = `<option value="${category}">${category}</option><option value="custom">custom</option>`;
  byId('guCategorySelect').value = category;
  byId('guFolderSelect').innerHTML = `<option value="">root</option><option value="__new__">new</option>`;
  byId('guFolderSelect').value = folder;
  byId('guDesc').value = desc;
  window.__state.globalUploadFiles = [{ file: file || { name: 'bill.jpg', type: 'image/jpeg' }, previewUrl: null }];
}

test('renderGlobalTagPicker()/addGlobalMemberTag()/removeGlobalTag(): dropdown chỉ gợi ý thành viên chưa gắn tag, chọn xong tự thêm và ẩn khỏi danh sách, bỏ tag thì hiện lại', () => {
  const { window } = createApp();
  window.__state.members = [
    { id: '1', name: 'Bố', documents: [], folders: [] },
    { id: '2', name: 'Mẹ', documents: [], folders: [] }
  ];
  window.__state.globalSelectedTags = [];

  window.renderGlobalTagPicker();
  const optionValues = () => Array.from(window.document.getElementById('guTagMemberSelect').options).map(o => o.value);
  assert.deepEqual(optionValues(), ['', 'Bố', 'Mẹ']);

  window.addGlobalMemberTag('Bố');
  assert.deepEqual(Array.from(window.__state.globalSelectedTags), ['Bố']);
  assert.deepEqual(optionValues(), ['', 'Mẹ'], 'Bố đã được gắn tag thì không còn xuất hiện trong dropdown nữa');

  window.removeGlobalTag('Bố');
  assert.deepEqual(Array.from(window.__state.globalSelectedTags), []);
  assert.deepEqual(optionValues(), ['', 'Bố', 'Mẹ'], 'bỏ tag thì thành viên đó phải hiện lại trong dropdown');
});

test('saveGlobalDocument(): tạo mới Hồ sơ chung gia đình khi lần đầu upload cho family_shared, kèm tag đã chọn', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{ id: '1', type: 'adult', name: 'Bố', documents: [], folders: [] }];
  window.uploadEncryptedFileToStorage = async () => 'https://res.cloudinary.com/fake.enc';
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  setupModalDom(window, { owner: 'family_shared', category: 'Chi phí' });
  window.__state.globalSelectedTags = ['Bố', 'Ông ngoại'];

  await window.saveGlobalDocument();

  const family = window.__state.members.find(m => m.id === 'family_shared');
  assert.ok(family, 'phải tự tạo hồ sơ family_shared khi chưa tồn tại');
  assert.equal(family.documents.length, 1);
  const doc = family.documents[0];
  assert.equal(doc.docType, 'Chi phí');
  assert.deepEqual(Array.from(doc.tags), ['Bố', 'Ông ngoại']);
  assert.equal(doc.encrypted, true);
  assert.equal(doc.ownerId, 'family_shared');
});

test('saveGlobalDocument(): upload cho 1 thành viên thường thì lưu vào đúng documents[] của thành viên đó, không đụng tới family_shared', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{ id: '1', type: 'adult', name: 'Bố', documents: [], folders: [] }];
  window.uploadEncryptedFileToStorage = async () => 'https://res.cloudinary.com/fake.enc';
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  setupModalDom(window, { owner: '1', category: 'Y tế' });

  await window.saveGlobalDocument();

  assert.equal(window.__state.members.length, 1, 'không được tự tạo family_shared khi chủ sở hữu là thành viên thường');
  assert.equal(window.__state.members[0].documents.length, 1);
  assert.equal(window.__state.members[0].documents[0].docType, 'Y tế');
});

test('saveGlobalDocument(): nếu upload thất bại và family_shared vừa được tạo mới, phải rollback (không để lại hồ sơ rỗng)', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.uploadEncryptedFileToStorage = async () => { throw new Error('Mất mạng'); };
  window.alert = () => {};

  setupModalDom(window, { owner: 'family_shared' });

  await window.saveGlobalDocument();

  assert.equal(window.__state.members.length, 0, 'hồ sơ family_shared rỗng phải được rollback khi lưu thất bại');
});

test('displayMembers()/renderGrid(): loại Hồ sơ chung gia đình khỏi lưới thành viên trang chủ', () => {
  const { window } = createApp();
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Bố', documents: [], folders: [] },
    { id: 'family_shared', type: 'family', name: 'Hồ sơ chung gia đình', documents: [{ id: 'd1' }], folders: [] }
  ];

  window.renderGrid();

  assert.equal(window.displayMembers().length, 1);
  const grid = window.document.getElementById('memberGrid');
  assert.doesNotMatch(grid.innerHTML, /Hồ sơ chung gia đình/);
  assert.match(grid.innerHTML, /Bố/);
});

test('buildConsolidatedMap() với bộ lọc theo thành viên: khớp cả tài liệu sở hữu lẫn tài liệu được gắn tag tên người đó', () => {
  const { window } = createApp();
  window.__state.members = [
    {
      id: '1', type: 'adult', name: 'Mẹ', folders: [],
      documents: [{ id: 'd1', docType: 'Chi phí', tags: [] }]
    },
    {
      id: 'family_shared', type: 'family', name: 'Hồ sơ chung gia đình', folders: [],
      documents: [{ id: 'd2', docType: 'Chi phí', tags: ['Mẹ'] }, { id: 'd3', docType: 'Chi phí', tags: [] }]
    }
  ];

  const filterFn = d => d.ownerId === '1' || (d.tags || []).includes('Mẹ');
  const map = window.buildConsolidatedMap(filterFn);

  // Dùng Array.from() để tạo mảng ở realm hiện tại (mảng gốc thuộc realm của jsdom window,
  // .map() trên nó sẽ tạo ra mảng cùng realm đó -> so sánh trực tiếp với mảng literal có thể
  // sai lệch do khác prototype giữa 2 realm, dù nội dung giống hệt nhau).
  const ids = Array.from(map['Chi phí'] || [], d => d.id).sort();
  assert.deepEqual(ids, ['d1', 'd2'], 'phải gồm tài liệu do Mẹ sở hữu (d1) và tài liệu gắn tag Mẹ (d2), loại d3');
});

test('openGlobalUploadModal(): mở từ FAB ở Trang chủ (không gắn với thành viên nào) phải để trống cả chủ sở hữu lẫn danh mục', () => {
  const { window } = createApp();
  window.__state.members = [{ id: '1', type: 'adult', name: 'Bố', documents: [], folders: [] }];

  window.openGlobalUploadModal();

  assert.equal(window.document.getElementById('guOwnerSelect').value, '', 'không được tự chọn Hồ sơ chung gia đình hay bất kỳ ai');
  assert.equal(window.document.getElementById('guCategorySelect').value, '', 'không được tự chọn danh mục đầu tiên');
});

test('openGlobalUploadModal(): mở từ trang Hồ sơ giấy tờ của 1 thành viên cụ thể phải tự chọn sẵn thành viên đó', () => {
  const { window } = createApp();
  window.__state.members = [{ id: '7', type: 'adult', name: 'Bố', documents: [], folders: [] }];
  window.openDocsView('7', true);

  window.openGlobalUploadModal();

  assert.equal(window.document.getElementById('guOwnerSelect').value, '7');
  assert.equal(window.document.getElementById('guCategorySelect').value, '', 'danh mục vẫn phải để trống, chỉ chủ sở hữu được tự chọn sẵn');
});

test('saveGlobalDocument(false): thiếu chủ sở hữu hoặc danh mục thì từ chối lưu và rung nhắc nhở, không đụng tới members', async () => {
  const { window } = createApp();
  window.__state.members = [];
  window.alert = () => {};
  setupModalDom(window, { owner: '', category: '' });
  window.document.getElementById('guCategorySelect').value = '';

  await window.saveGlobalDocument(false);

  assert.equal(window.__state.members.length, 0, 'không được tạo hồ sơ hay lưu tài liệu nào khi thiếu trường bắt buộc');
  assert.ok(window.document.getElementById('guOwnerSelect').classList.contains('shake-error'));
  assert.ok(window.document.getElementById('guCategorySelect').classList.contains('shake-error'));
});

test('saveGlobalDocument(true) - "Lưu tạm": không cần chủ sở hữu/danh mục, tệp được gửi vào kho "Chưa gán chủ sở hữu" với status pending', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [];
  window.uploadEncryptedFileToStorage = async () => 'https://res.cloudinary.com/fake.enc';
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  setupModalDom(window, { owner: '', category: '' });
  window.document.getElementById('guCategorySelect').value = '';

  await window.saveGlobalDocument(true);

  const bucket = window.__state.members.find(m => m.id === 'unassigned_pending');
  assert.ok(bucket, 'phải tự tạo kho "Chưa gán chủ sở hữu" khi Lưu tạm không chọn chủ sở hữu');
  assert.equal(bucket.documents.length, 1);
  assert.equal(bucket.documents[0].status, 'pending');
  assert.equal(window.getAllPendingDocuments().length, 1, 'phải xuất hiện trong Hồ sơ tạm để hoàn tất phân loại sau');
  assert.equal(window.displayMembers().length, 0, 'kho "Chưa gán chủ sở hữu" không được lộ diện như 1 thành viên bình thường');
});

test('saveGlobalDocument(): chọn nhiều tệp cùng lúc thì lưu đủ từng tệp một, cộng dồn vào đúng documents[] của chủ sở hữu', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{ id: '1', type: 'adult', name: 'Bố', documents: [], folders: [] }];
  window.uploadEncryptedFileToStorage = async (file) => `https://res.cloudinary.com/${file.name}.enc`;
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  setupModalDom(window, { owner: '1', category: 'Y tế' });
  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'mat-sau.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];

  await window.saveGlobalDocument(false);

  const docs = window.__state.members[0].documents;
  assert.equal(docs.length, 2, 'phải lưu đủ 2 tệp đã chọn');
  assert.deepEqual(docs.map(d => d.fileName).sort(), ['mat-sau.jpg', 'mat-truoc.jpg']);
});
