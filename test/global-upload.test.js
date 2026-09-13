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
  window.__state.globalUploadFile = { file: file || { name: 'bill.jpg', type: 'image/jpeg' }, previewUrl: null };
}

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
