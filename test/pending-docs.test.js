'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function setupPendingCompleteDom(window, { owner = '1', category = 'Y tế', folder = '', desc = 'Đã phân loại' } = {}) {
  const byId = (id) => window.document.getElementById(id);
  window.populatePendingOwnerSelect();
  byId('pdOwnerSelect').value = owner;
  byId('pdCategorySelect').innerHTML = `<option value="${category}">${category}</option><option value="custom">custom</option>`;
  byId('pdCategorySelect').value = category;
  byId('pdFolderSelect').innerHTML = `<option value="">root</option><option value="__new__">new</option>`;
  byId('pdFolderSelect').value = folder;
  byId('pdDesc').value = desc;
}

test('savePendingComplete(): hoàn tất phân loại giữ nguyên chủ sở hữu chỉ cập nhật danh mục/mô tả/status', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [{
    id: '1', type: 'adult', name: 'Bố', folders: [],
    documents: [{ id: 'd1', ownerId: 'unassigned_pending', docType: 'Chưa phân loại', desc: '', status: 'pending', fileType: 'image/jpeg', createdAt: '01/01/2024' }]
  }];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.openPendingCompleteModal('1', 'd1');
  setupPendingCompleteDom(window, { owner: '1', category: 'Y tế', desc: 'CCCD mặt trước' });

  await window.savePendingComplete();

  const member = window.__state.members[0];
  assert.equal(member.documents.length, 1, 'không được nhân đôi tài liệu khi chủ sở hữu không đổi');
  const doc = member.documents[0];
  assert.equal(doc.status, 'completed');
  assert.equal(doc.docType, 'Y tế');
  assert.equal(doc.desc, 'CCCD mặt trước');
});

test('savePendingComplete(): đổi chủ sở hữu thì chuyển tài liệu sang đúng thành viên mới, xóa khỏi thành viên cũ', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [
    { id: 'unassigned_pending', type: 'unassigned', name: 'Chưa gán chủ sở hữu', folders: [], documents: [{ id: 'd1', ownerId: 'unassigned_pending', docType: 'Chưa phân loại', desc: '', status: 'pending', fileType: 'image/jpeg', createdAt: '01/01/2024' }] },
    { id: '2', type: 'adult', name: 'Mẹ', folders: [], documents: [] }
  ];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.openPendingCompleteModal('unassigned_pending', 'd1');
  setupPendingCompleteDom(window, { owner: '2', category: 'Y tế' });

  await window.savePendingComplete();

  const oldOwner = window.__state.members.find(m => m.id === 'unassigned_pending');
  const newOwner = window.__state.members.find(m => m.id === '2');
  assert.equal(oldOwner.documents.length, 0, 'phải xóa tài liệu khỏi kho Chưa gán chủ sở hữu sau khi chuyển đi');
  assert.equal(newOwner.documents.length, 1, 'phải xuất hiện đúng 1 lần trong documents[] của chủ sở hữu mới');
  assert.equal(newOwner.documents[0].status, 'completed');
  assert.equal(newOwner.documents[0].ownerId, '2');
});

test('savePendingComplete(): nếu pushToFirebase() thất bại sau khi đổi chủ sở hữu, phải rollback về đúng thành viên cũ', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [
    { id: 'unassigned_pending', type: 'unassigned', name: 'Chưa gán chủ sở hữu', folders: [], documents: [{ id: 'd1', ownerId: 'unassigned_pending', docType: 'Chưa phân loại', desc: '', status: 'pending', fileType: 'image/jpeg', createdAt: '01/01/2024' }] },
    { id: '2', type: 'adult', name: 'Mẹ', folders: [], documents: [] }
  ];
  window.fetch = async () => { throw new Error('Mất mạng'); };
  window.alert = () => {};

  window.openPendingCompleteModal('unassigned_pending', 'd1');
  setupPendingCompleteDom(window, { owner: '2', category: 'Y tế' });

  await window.savePendingComplete();

  const oldOwner = window.__state.members.find(m => m.id === 'unassigned_pending');
  const newOwner = window.__state.members.find(m => m.id === '2');
  assert.equal(oldOwner.documents.length, 1, 'phải khôi phục lại tài liệu ở chủ sở hữu cũ khi lưu thất bại');
  assert.equal(newOwner.documents.length, 0, 'không được để sót tài liệu ở chủ sở hữu mới khi rollback');
  assert.equal(oldOwner.documents[0].status, 'pending', 'status phải được giữ nguyên là pending vì thao tác chưa thực sự hoàn tất');
});

test('openPendingCompleteModal(): tệp thuộc "Chưa gán chủ sở hữu" (ownerId không có trong danh sách lựa chọn) mặc định chọn "Hồ sơ chung gia đình"', () => {
  const { window } = createApp();
  window.__state.members = [{
    id: window.UNASSIGNED_OWNER_ID, type: 'unassigned', name: window.UNASSIGNED_OWNER_NAME, folders: [],
    documents: [{ id: 'd1', ownerId: window.UNASSIGNED_OWNER_ID, docType: 'Chưa phân loại', desc: '', status: 'pending', fileType: 'image/jpeg', createdAt: '01/01/2024' }]
  }];

  window.openPendingCompleteModal(window.UNASSIGNED_OWNER_ID, 'd1');

  assert.equal(window.document.getElementById('pdOwnerSelect').value, window.FAMILY_SHARED_ID);
});

test('openPendingCompleteModal()/renderPendingTagsChips(): hiện chip cho từng thành viên thật, đánh dấu is-active đúng theo tags đã lưu', () => {
  const { window } = createApp();
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Bố', folders: [], documents: [{ id: 'd1', ownerId: '1', docType: 'Chi phí', desc: '', status: 'pending', tags: ['Mẹ'], fileType: 'image/jpeg', createdAt: '01/01/2024' }] },
    { id: '2', type: 'adult', name: 'Mẹ', folders: [], documents: [] }
  ];

  window.openPendingCompleteModal('1', 'd1');

  const chips = Array.from(window.document.querySelectorAll('#pdTagsChips .tag-chip'));
  assert.deepEqual(chips.map(c => c.textContent), ['Bố', 'Mẹ']);
  const activeChip = chips.find(c => c.classList.contains('is-active'));
  assert.equal(activeChip.textContent, 'Mẹ');
});

test('savePendingComplete(): chọn nhiều chip "Thành viên liên quan" phải lưu đúng vào tags[] của tài liệu', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Bố', folders: [], documents: [{ id: 'd1', ownerId: '1', docType: 'Chưa phân loại', desc: '', status: 'pending', fileType: 'image/jpeg', createdAt: '01/01/2024' }] },
    { id: '2', type: 'adult', name: 'Mẹ', folders: [], documents: [] }
  ];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.openPendingCompleteModal('1', 'd1');
  setupPendingCompleteDom(window, { owner: '1', category: 'Y tế', desc: 'Sổ khám bệnh' });
  window.document.querySelectorAll('#pdTagsChips .tag-chip').forEach(chip => {
    if (chip.textContent === 'Mẹ') chip.click();
  });

  await window.savePendingComplete();

  const doc = window.__state.members[0].documents[0];
  assert.deepEqual(Array.from(doc.tags || []), ['Mẹ']);
});

test('getAllPendingDocuments(): chỉ gồm tài liệu status=pending, gộp từ mọi thành viên kể cả Hồ sơ chung gia đình', () => {
  const { window } = createApp();
  window.__state.members = [
    { id: '1', name: 'Bố', folders: [], documents: [{ id: 'd1', status: 'completed' }, { id: 'd2', status: 'pending' }] },
    { id: 'family_shared', name: 'Hồ sơ chung gia đình', folders: [], documents: [{ id: 'd3', status: 'pending' }] }
  ];
  const pending = window.getAllPendingDocuments();
  assert.deepEqual(Array.from(pending, d => d.id).sort(), ['d2', 'd3']);
});

test('deleteSubfolder(): xóa thư mục con phải đưa các tệp bên trong ra thư mục cha, không để tệp mồ côi', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.currentMemberId = '1';
  window.__state.members = [{
    id: '1', name: 'Bố', type: 'adult',
    documents: [{ id: 'd1', docType: 'Y tế', folderId: 'f1', fileType: 'image/jpeg', createdAt: '01/01/2024' }],
    folders: [{ id: 'f1', docType: 'Y tế', name: 'Thư mục con', parentId: null }]
  }];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.confirm = () => true;

  await window.deleteSubfolder('f1');

  const member = window.__state.members[0];
  assert.equal(member.folders.length, 0);
  assert.equal(member.documents[0].folderId, null, 'tệp phải được chuyển ra thư mục gốc (folderId=null), không được trỏ tới thư mục đã xóa');

  const issues = window.validateDataIntegrity(window.__state.members);
  assert.deepEqual(Array.from(issues), [], 'sau khi xóa thư mục, validateDataIntegrity() không được báo tệp mồ côi nào');
});


function fillMinimalMemberFormForRename(window, { id, name }) {
  const byId = (elId) => window.document.getElementById(elId);
  byId('fId').value = id;
  byId('fType').value = 'adult';
  byId('fName').value = name;
  byId('fDob').value = '';
  byId('fCccdDate').value = '';
  byId('fAvatarUrl').value = '';
}

test('saveMember(): đổi tên thành viên phải cập nhật lại tag mang tên cũ trên tài liệu của người khác, tránh tag mồ côi', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Mẹ', banks: [], documents: [] },
    { id: 'family_shared', type: 'family', name: 'Hồ sơ chung gia đình', banks: [], documents: [{ id: 'd1', docType: 'Chi phí', tags: ['Mẹ', 'Ông ngoại'], fileType: 'image/jpeg', createdAt: '01/01/2024' }] }
  ];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  fillMinimalMemberFormForRename(window, { id: '1', name: 'Mẹ Hoa' });
  await window.saveMember({ preventDefault() {} });

  const familyDoc = window.__state.members.find(m => m.id === 'family_shared').documents[0];
  assert.deepEqual(Array.from(familyDoc.tags), ['Mẹ Hoa', 'Ông ngoại'], 'tag "Mẹ" phải đổi thành "Mẹ Hoa", giữ nguyên tag tự do khác');
});

test('deleteCurrentMember(): xóa thành viên phải xóa luôn tag mang tên người đó khỏi tài liệu của người khác', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.currentMemberId = '1';
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Mẹ', banks: [], documents: [] },
    { id: 'family_shared', type: 'family', name: 'Hồ sơ chung gia đình', banks: [], documents: [{ id: 'd1', docType: 'Chi phí', tags: ['Mẹ', 'Ông ngoại'], fileType: 'image/jpeg', createdAt: '01/01/2024' }] }
  ];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.confirm = () => true;

  await window.deleteCurrentMember();

  const familyDoc = window.__state.members.find(m => m.id === 'family_shared').documents[0];
  assert.deepEqual(Array.from(familyDoc.tags), ['Ông ngoại'], 'tag "Mẹ" phải bị xóa khỏi tài liệu vì thành viên đó không còn tồn tại');
});
