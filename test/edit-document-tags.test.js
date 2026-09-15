'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

test('editDocumentDescription()/renderEditDocTagsChips(): hiện chip cho từng thành viên thật, đánh dấu is-active đúng theo doc.tags đã lưu', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Bố', folders: [], documents: [{ id: 'd1', docType: 'Y tế & Sức khỏe', desc: 'Sổ khám bệnh', tags: ['Minh'], fileType: 'image/jpeg' }] },
    { id: '2', type: 'child', name: 'Minh', folders: [], documents: [] },
    { id: '3', type: 'child', name: 'Lan', folders: [], documents: [] }
  ];

  window.editDocumentDescription('d1');

  assert.ok(!window.document.getElementById('editDocModal').classList.contains('hidden'));
  const chips = Array.from(window.document.querySelectorAll('#editDocTagsChips .tag-chip'));
  assert.deepEqual(chips.map(c => c.textContent), ['Bố', 'Minh', 'Lan']);
  const activeChips = chips.filter(c => c.classList.contains('is-active'));
  assert.deepEqual(activeChips.map(c => c.textContent), ['Minh']);
});

test('saveDocumentEdit(): bấm chip để thêm/bớt thành viên rồi lưu phải cập nhật đúng doc.tags và đồng bộ ngay với khối "Tài liệu được gắn với thành viên này" của người được gắn thẻ', async () => {
  const { window } = createApp();
  window.__state.masterPassword = 'pass123';
  window.__state.currentMemberId = '1';
  window.__state.members = [
    { id: '1', type: 'adult', name: 'Bố', folders: [], documents: [{ id: 'd1', docType: 'Y tế & Sức khỏe', desc: 'Sổ khám bệnh', tags: ['Minh'], fileType: 'image/jpeg' }] },
    { id: '2', type: 'child', name: 'Minh', folders: [], documents: [] },
    { id: '3', type: 'child', name: 'Lan', folders: [], documents: [] }
  ];
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.alert = () => {};

  window.editDocumentDescription('d1');
  const chips = Array.from(window.document.querySelectorAll('#editDocTagsChips .tag-chip'));
  chips.find(c => c.textContent === 'Minh').click(); // bỏ tag "Minh" đang có sẵn
  chips.find(c => c.textContent === 'Lan').click(); // thêm tag "Lan"

  await window.saveDocumentEdit();

  const doc = window.__state.members[0].documents[0];
  assert.deepEqual(Array.from(doc.tags || []), ['Lan'], 'phải bỏ đúng tag cũ và thêm đúng tag mới, không đụng tới các trường khác');

  // "Tài liệu được gắn với thành viên này" của Minh (renderTaggedDocumentsSection) đọc thẳng
  // doc.tags tại thời điểm vẽ - không có cache riêng - nên phải tự đồng bộ ngay lập tức.
  assert.equal(window.getDocumentsTaggedForMember('2').length, 0, 'Minh không còn được gắn thẻ nên không còn thấy tệp này nữa');
  assert.equal(window.getDocumentsTaggedForMember('3').length, 1, 'Lan vừa được gắn thẻ nên phải thấy tệp này');
});
