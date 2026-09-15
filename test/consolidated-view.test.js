'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

function seedOneDoc(window, overrides = {}) {
  window.__state.members = [{
    id: '1', name: 'Châu Thành Đức', type: 'adult', folders: [],
    documents: [{
      id: '1700000000000', ownerId: '1', docType: 'CCCD', desc: 'CCCD mặt trước',
      fileName: 'cccd-truoc.jpg', fileType: 'image/jpeg',
      data: 'data:image/jpeg;base64,x', createdAt: '01/01/2024', ...overrides
    }]
  }];
}

test('sortConsolidatedList(): sắp xếp theo ngày tải lên (mới/cũ nhất trước) và theo tên tệp (A-Z/Z-A)', () => {
  const { window } = createApp();
  const files = [
    { id: '1700000000001', fileName: 'b.jpg' },
    { id: '1700000000003', fileName: 'a.jpg' },
    { id: '1700000000002', fileName: 'c.jpg' }
  ];

  assert.deepEqual(Array.from(window.sortConsolidatedList(files, 'date-desc')).map(f => f.id), ['1700000000003', '1700000000002', '1700000000001']);
  assert.deepEqual(Array.from(window.sortConsolidatedList(files, 'date-asc')).map(f => f.id), ['1700000000001', '1700000000002', '1700000000003']);
  assert.deepEqual(Array.from(window.sortConsolidatedList(files, 'name-asc')).map(f => f.fileName), ['a.jpg', 'b.jpg', 'c.jpg']);
  assert.deepEqual(Array.from(window.sortConsolidatedList(files, 'name-desc')).map(f => f.fileName), ['c.jpg', 'b.jpg', 'a.jpg']);
});

test('openConsolidatedCategoryDetails(): có toolbar Lưới/Danh sách + dropdown sắp xếp đúng 4 lựa chọn, mặc định "mới nhất trước"', () => {
  const { window } = createApp();
  seedOneDoc(window);

  window.openConsolidatedView({ skipHistory: true });
  window.openConsolidatedCategoryDetails('CCCD');

  const toggleButtons = window.document.querySelectorAll('#consolidatedExplorerContent .view-toggle-btn');
  assert.equal(toggleButtons.length, 2, 'phải có đủ 2 nút chuyển đổi Lưới/Danh sách');

  const select = window.document.getElementById('consolidatedSortSelect');
  assert.ok(select, 'phải có dropdown sắp xếp');
  assert.equal(select.value, 'date-desc');
  assert.deepEqual(
    Array.from(select.querySelectorAll('option')).map(o => o.value),
    ['date-desc', 'date-asc', 'name-asc', 'name-desc']
  );
});

test('openConsolidatedCategoryDetails(): chân thẻ tệp (grid) hiện chip tên chủ sở hữu + nút mũi tên, không còn hàng icon mắt/mũi tên rời rạc cũ', () => {
  const { window } = createApp();
  seedOneDoc(window);

  window.openConsolidatedView({ skipHistory: true });
  window.openConsolidatedCategoryDetails('CCCD');

  const card = window.document.querySelector('#consolidatedExplorerContent .file-card');
  assert.ok(card, 'phải vẽ được thẻ tệp');
  assert.match(card.querySelector('.file-owner-chip').textContent, /Châu Thành Đức/);
  assert.ok(card.querySelector('.file-goto-owner-btn'), 'phải có nút mũi tên điều hướng đến hồ sơ thành viên');
  assert.equal(card.querySelectorAll('.file-actions-scroll').length, 0, 'không được còn hàng icon mắt/mũi tên rời rạc cũ ở đáy thẻ');
});

test('openConsolidatedCategoryDetails(): chuyển sang chế độ Danh sách vẫn bấm được thumbnail/tên tệp để xem trước, có nhãn chủ sở hữu + mũi tên', () => {
  const { window } = createApp();
  seedOneDoc(window);

  window.openConsolidatedView({ skipHistory: true });
  window.openConsolidatedCategoryDetails('CCCD');
  window.document.querySelectorAll('.view-toggle-btn')[1].click(); // nút "Danh sách"

  assert.ok(window.document.querySelector('#consolidatedExplorerContent .files-list.view-list'), 'phải chuyển sang dạng Danh sách');
  const card = window.document.querySelector('#consolidatedExplorerContent .file-card');
  assert.ok(card.querySelector('.file-preview-button'), 'thumbnail vẫn bấm được để xem trước');
  assert.ok(card.querySelector('.file-name-button'), 'tên tệp phải là nút bấm được để mở xem trước');
  assert.ok(card.querySelector('.file-owner-chip'));
  assert.ok(card.querySelector('.file-goto-owner-btn'));
});

function seedOnePendingDoc(window, overrides = {}) {
  window.__state.members = [{
    id: '1', name: 'Châu Thành Đức', type: 'adult', folders: [],
    documents: [{
      id: '1700000000000', ownerId: '1', docType: 'Chưa phân loại', desc: 'Ảnh CCCD chụp nhanh',
      fileName: 'cccd.jpg', fileType: 'image/jpeg', status: 'pending',
      data: 'data:image/jpeg;base64,x', createdAt: '01/01/2024', ...overrides
    }]
  }];
}

test('renderConsolidatedPendingList(): có toolbar Lưới/Danh sách + dropdown sắp xếp giống màn chi tiết danh mục', () => {
  const { window } = createApp();
  seedOnePendingDoc(window);

  window.openConsolidatedView({ skipHistory: true, filter: 'pending' });

  const toggleButtons = window.document.querySelectorAll('#consolidatedExplorerContent .view-toggle-btn');
  assert.equal(toggleButtons.length, 2, 'phải có đủ 2 nút chuyển đổi Lưới/Danh sách');
  const select = window.document.getElementById('consolidatedSortSelect');
  assert.ok(select, 'phải có dropdown sắp xếp');
  assert.equal(select.value, 'date-desc');
});

test('renderConsolidatedPendingList(): chân thẻ (grid) rút gọn còn 1 hàng - chip cảnh báo "Chưa gán chủ sở hữu" + cụm nút Sửa/Xóa, không còn icon mắt/nút Xem tài liệu rời rạc cũ', () => {
  const { window } = createApp();
  seedOnePendingDoc(window);

  window.openConsolidatedView({ skipHistory: true, filter: 'pending' });

  const card = window.document.querySelector('#consolidatedExplorerContent .file-card');
  assert.ok(card, 'phải vẽ được thẻ tệp');
  assert.equal(card.querySelectorAll('.file-actions-scroll').length, 0, 'không được còn hàng icon rời rạc cũ');
  assert.equal(card.querySelectorAll('.btn-view-file').length, 0, 'không được còn nút "Xem tài liệu" (icon mắt) riêng');
  assert.match(card.querySelector('.pending-unassigned-chip').textContent, /Chưa gán chủ sở hữu/);
  assert.ok(card.querySelector('.btn-complete-pending'), 'phải có nút Sửa/Phân loại');
  assert.ok(card.querySelector('.btn-delete-pending'), 'phải có nút Xóa');
  assert.ok(card.querySelector('.file-name-plain-button'), 'tên tệp phải bấm được để xem trước, không phải khối tĩnh');
});

test('renderConsolidatedPendingList(): bấm thumbnail hoặc tên tệp đều mở xem trước, bấm chip cảnh báo mở đúng form gán chủ sở hữu/danh mục', () => {
  const { window } = createApp();
  seedOnePendingDoc(window);
  window.openConsolidatedView({ skipHistory: true, filter: 'pending' });

  const card = window.document.querySelector('#consolidatedExplorerContent .file-card');
  card.querySelector('.pending-unassigned-chip').click();

  assert.equal(window.document.getElementById('pendingCompleteModal').classList.contains('hidden'), false, 'chip phải mở modal Hoàn tất phân loại');
});

test('renderConsolidatedPendingList(): chuyển sang Danh sách vẫn hiện thumbnail nhỏ/tên tệp/chip cảnh báo + nút sửa/xóa cuối hàng', () => {
  const { window } = createApp();
  seedOnePendingDoc(window);
  window.openConsolidatedView({ skipHistory: true, filter: 'pending' });
  window.document.querySelectorAll('.view-toggle-btn')[1].click(); // nút "Danh sách"

  assert.ok(window.document.querySelector('#consolidatedExplorerContent .files-list.view-list'), 'phải chuyển sang dạng Danh sách');
  const card = window.document.querySelector('#consolidatedExplorerContent .file-card');
  assert.ok(card.querySelector('.file-preview-button'), 'thumbnail vẫn bấm được để xem trước');
  assert.ok(card.querySelector('.file-name-button'), 'tên tệp phải là nút bấm được để mở xem trước');
  assert.ok(card.querySelector('.pending-unassigned-chip'));
  assert.ok(card.querySelector('.btn-complete-pending'));
  assert.ok(card.querySelector('.btn-delete-pending'));
});

test('renderConsolidatedCategories(): thẻ danh mục có tệp được làm nổi bật (.folder-card-has-files), danh mục rỗng (chỉ có thư mục/tên tự đặt) thì không', () => {
  const { window } = createApp();
  window.__state.members = [{
    id: '1', name: 'Châu Thành Đức', type: 'adult',
    folders: [{ id: 'f1', docType: 'Học tập & Công việc', name: 'Bằng cấp' }], // danh mục có thư mục nhưng chưa có tệp nào
    documents: [{
      id: '1700000000000', ownerId: '1', docType: 'CCCD', desc: 'CCCD mặt trước',
      fileName: 'cccd.jpg', fileType: 'image/jpeg', data: 'data:image/jpeg;base64,x', createdAt: '01/01/2024'
    }]
  }];

  window.openConsolidatedView({ skipHistory: true });

  const cards = Array.from(window.document.querySelectorAll('#consolidatedExplorerContent .folder-card'));
  const cccdCard = cards.find(c => c.querySelector('.folder-name')?.textContent === 'CCCD');
  const emptyCard = cards.find(c => c.querySelector('.folder-name')?.textContent === 'Học tập & Công việc');
  assert.ok(cccdCard.classList.contains('folder-card-has-files'), 'danh mục có tệp phải được làm nổi bật');
  assert.ok(!emptyCard.classList.contains('folder-card-has-files'), 'danh mục chưa có tệp nào (dù có thư mục con) không được làm nổi bật');
});

test('nút "Đến hồ sơ thành viên": điều hướng đúng tới ?documents={ownerId}&docType={category}&folder={folderId} của tệp', () => {
  const { window } = createApp();
  window.__state.members = [{
    id: '1', name: 'Châu Thành Đức', type: 'adult',
    folders: [{ id: 'f1', docType: 'CCCD', name: 'Passport' }],
    documents: [{
      id: '1700000000000', ownerId: '1', docType: 'CCCD', folderId: 'f1', desc: 'CCCD mặt trước',
      fileName: 'cccd-truoc.jpg', fileType: 'image/jpeg', data: 'data:image/jpeg;base64,x', createdAt: '01/01/2024'
    }]
  }];

  window.openConsolidatedView({ skipHistory: true });
  window.openConsolidatedCategoryDetails('CCCD');
  window.document.querySelector('.btn-goto-owner').click();

  assert.match(window.location.search, /documents=1/);
  assert.match(window.location.search, /docType=CCCD/);
  assert.match(window.location.search, /folder=f1/);
  assert.equal(window.document.getElementById('docsView').classList.contains('hidden'), false, 'phải chuyển sang màn hình Hồ sơ cá nhân');
  assert.match(window.document.getElementById('docsBreadcrumb').textContent, /Passport/);
});
