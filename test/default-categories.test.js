'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

// Chế độ Lưới dùng .folder-name, chế độ Danh sách dùng .category-title (xem renderDocsFolders())
// - thử cả 2 để không phụ thuộc chế độ hiển thị hiện tại khi test tra cứu thẻ theo tên.
function getCategoryCard(window, name) {
  return Array.from(window.document.querySelectorAll('#docsExplorerContent .folder-card'))
    .find(card => (card.querySelector('.folder-name, .category-title')?.textContent) === name);
}

test('DEFAULT_CATEGORIES: đúng 7 danh mục chuẩn, mỗi danh mục có key + icon hợp lệ', () => {
  const { window } = createApp();
  assert.equal(window.DEFAULT_CATEGORIES.length, 7);
  window.DEFAULT_CATEGORIES.forEach(cat => {
    assert.equal(typeof cat.key, 'string');
    assert.ok(cat.key.length > 0);
    assert.equal(typeof cat.icon, 'string');
    assert.doesNotThrow(() => window.svgIcon(cat.icon));
  });
  assert.deepEqual(Array.from(window.STANDARD_CATEGORIES), Array.from(window.DEFAULT_CATEGORIES.map(c => c.key)));
});

test('renderDocsFolders(): thành viên mới tạo (chưa có tệp/thư mục/danh mục nào) vẫn hiện đủ 7 danh mục chuẩn với "0 tệp đính kèm"', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];

  window.renderDocsFolders();

  const cards = window.document.querySelectorAll('#docsExplorerContent .folder-card');
  assert.equal(cards.length, 7, 'phải hiện đủ 7 danh mục chuẩn dù chưa có gì cả');
  window.DEFAULT_CATEGORIES.forEach(cat => {
    const card = getCategoryCard(window, cat.key);
    assert.ok(card, `phải có thẻ danh mục "${cat.key}"`);
    assert.match(card.querySelector('.folder-count').textContent, /^0 tệp/);
  });
});

test('renderDocsFolders(): Hồ sơ chung gia đình cũng hiện đủ 7 danh mục chuẩn', () => {
  const { window } = createApp();
  window.ensureFamilySharedMember();
  window.__state.currentMemberId = window.FAMILY_SHARED_ID;

  window.renderDocsFolders();

  assert.equal(window.document.querySelectorAll('#docsExplorerContent .folder-card').length, 7);
});

test('renderDocsFolders(): đếm đúng số tệp thật sự có trong 1 danh mục chuẩn, kể cả tệp nằm trong thư mục con', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [{ id: 'f1', docType: 'Y tế & Sức khỏe', parentId: null, name: 'Sổ khám bệnh' }],
    documents: [
      { id: 'd1', docType: 'Y tế & Sức khỏe', folderId: null, desc: 'BHYT', fileType: 'image/jpeg', createdAt: '01/01/2024' },
      { id: 'd2', docType: 'Y tế & Sức khỏe', folderId: 'f1', desc: 'Đơn thuốc', fileType: 'image/jpeg', createdAt: '01/01/2024' }
    ]
  }];

  window.renderDocsFolders();

  const card = getCategoryCard(window, 'Y tế & Sức khỏe');
  assert.match(card.querySelector('.folder-count').textContent, /^2 tệp/);
});

test('renderDocsFolders(): không danh mục nào (kể cả danh mục custom còn sót lại) có nút đổi tên/xóa - tính năng quản lý danh mục custom đã bị gỡ bỏ', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [], categories: ['Đồ chơi con'] }];

  window.renderDocsFolders();

  const defaultCard = getCategoryCard(window, 'Y tế & Sức khỏe');
  assert.equal(defaultCard.querySelectorAll('.btn-edit-category, .btn-del-category').length, 0, 'danh mục chuẩn không được có nút đổi tên/xóa');

  const customCard = getCategoryCard(window, 'Đồ chơi con');
  assert.equal(customCard.querySelectorAll('.btn-edit-category, .btn-del-category').length, 0, 'danh mục custom cũng không còn nút đổi tên/xóa');
  assert.equal(typeof window.openEditCategoryModal, 'undefined', 'chức năng đổi tên danh mục phải được gỡ bỏ hoàn toàn');
  assert.equal(typeof window.deleteCategory, 'undefined', 'chức năng xóa danh mục phải được gỡ bỏ hoàn toàn');
});

test('renderDocsFolders(): ẩn nút "Chọn nhiều tệp" ở màn hình gốc "Tất cả danh mục" (chỉ có thẻ danh mục, không có tệp nào để chọn)', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];

  window.renderDocsFolders();

  assert.ok(window.document.getElementById('btnToggleDocSelect').classList.contains('hidden'), 'nút "Chọn nhiều tệp" phải bị ẩn ở màn hình gốc');
});

test('openFolderDetails(): hiện lại nút "Chọn nhiều tệp" ngay khi vào chi tiết 1 danh mục cụ thể', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];
  window.renderDocsFolders();
  assert.ok(window.document.getElementById('btnToggleDocSelect').classList.contains('hidden'));

  window.openFolderDetails('Học tập & Công việc');

  assert.ok(!window.document.getElementById('btnToggleDocSelect').classList.contains('hidden'), 'nút "Chọn nhiều tệp" phải hiện lại trong chi tiết danh mục');
});

test('renderDocsFolders(): thẻ danh mục có tệp (count > 0) được làm nổi bật (.folder-card-has-files), danh mục rỗng thì không, đồng bộ ở cả 2 chế độ Lưới/Danh sách', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{
    id: '1', name: 'Bố', type: 'adult', folders: [],
    documents: [{ id: 'd1', docType: 'Y tế & Sức khỏe', desc: 'BHYT', fileType: 'image/jpeg', createdAt: '01/01/2024' }]
  }];

  window.renderDocsFolders();
  const populatedCardGrid = getCategoryCard(window, 'Y tế & Sức khỏe');
  const emptyCardGrid = getCategoryCard(window, 'Học tập & Công việc');
  assert.ok(populatedCardGrid.classList.contains('folder-card-has-files'), 'danh mục có tệp phải được làm nổi bật ở chế độ Lưới');
  assert.ok(!emptyCardGrid.classList.contains('folder-card-has-files'), 'danh mục rỗng không được làm nổi bật');

  window.document.querySelectorAll('#docsExplorerContent .view-toggle-btn')[1].click(); // "Danh sách"
  const populatedCardList = getCategoryCard(window, 'Y tế & Sức khỏe');
  const emptyCardList = getCategoryCard(window, 'Học tập & Công việc');
  assert.ok(populatedCardList.classList.contains('folder-card-has-files'), 'phải giữ nguyên khi chuyển sang Danh sách');
  assert.ok(!emptyCardList.classList.contains('folder-card-has-files'));
});

test('openFolderDetails(): mở 1 danh mục chuẩn đang trống (0 tệp) phải ở lại đúng màn hình đó (không bật ngược về "Tất cả danh mục"), để FAB nhận đúng ngữ cảnh', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];
  window.openDocsView('1', true);

  window.openFolderDetails('Học tập & Công việc');

  assert.match(window.document.getElementById('docsBreadcrumb').textContent, /Học tập & Công việc/);
  assert.equal(
    window.document.querySelectorAll('#docsExplorerContent .folder-card').length, 0,
    'không được bật ngược về lưới danh mục ("Tất cả danh mục") - phải ở lại đúng màn hình chi tiết danh mục'
  );

  const ctx = window.detectGlobalUploadContext();
  assert.ok(ctx, 'FAB phải nhận diện được ngữ cảnh ngay cả khi danh mục đang trống');
  assert.equal(ctx.ownerId, '1');
  assert.equal(ctx.docType, 'Học tập & Công việc');
  assert.equal(ctx.folderId, null);
  assert.equal(ctx.label, 'Học tập & Công việc');
});

test('renderDocsFolders(): không còn nút "+ Danh mục mới" ở màn hình gốc (7 danh mục chuẩn khóa cứng, không tạo thêm được)', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];

  window.renderDocsFolders();

  const buttons = Array.from(window.document.querySelectorAll('#docsExplorerContent button'));
  assert.ok(!buttons.some(b => b.textContent.includes('Danh mục mới')), 'không được còn nút tạo danh mục mới ở màn hình gốc');
  assert.equal(typeof window.openNewCategoryModal, 'undefined', 'chức năng tạo danh mục mới phải được gỡ bỏ hoàn toàn');
});

test('renderDocsFolders(): ẩn hoàn toàn thao tác tải lên (nút Header + FAB) ở màn hình gốc "Tất cả danh mục"', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];

  window.renderDocsFolders();

  assert.ok(window.document.getElementById('docsUploadHeaderBtn').classList.contains('hidden'), 'nút Tải lên trên Header phải bị ẩn ở màn hình gốc');
  assert.ok(window.document.getElementById('globalUploadFab').classList.contains('hidden'), 'FAB nổi phải bị ẩn ở màn hình gốc');
});

test('openFolderDetails(): hiện lại thao tác tải lên (Header + FAB) ngay khi vào chi tiết 1 danh mục cụ thể', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', documents: [], folders: [] }];
  window.openDocsView('1', true);
  assert.ok(window.document.getElementById('globalUploadFab').classList.contains('hidden'), 'vẫn phải ẩn khi mới vào "Tất cả danh mục"');

  window.openFolderDetails('Học tập & Công việc');

  assert.ok(!window.document.getElementById('docsUploadHeaderBtn').classList.contains('hidden'), 'nút Tải lên trên Header phải hiện lại trong chi tiết danh mục');
  assert.ok(!window.document.getElementById('globalUploadFab').classList.contains('hidden'), 'FAB nổi phải hiện lại trong chi tiết danh mục');
});

test('openFolderDetails(): breadcrumb đúng cấu trúc [Tên thành viên/Hồ sơ chung] > [Icon+Tên danh mục] > [Tên thư mục con]', () => {
  const { window } = createApp();
  window.__state.currentMemberId = '1';
  window.__state.members = [{
    id: '1', name: 'Bố', type: 'adult', documents: [],
    folders: [{ id: 'f1', docType: 'Y tế & Sức khỏe', parentId: null, name: 'Sổ khám bệnh' }]
  }];

  window.openFolderDetails('Y tế & Sức khỏe', 'f1');

  const crumb = window.document.getElementById('docsBreadcrumb');
  assert.match(crumb.textContent, /Bố/, 'crumb đầu tiên phải là tên thành viên (không còn "Tất cả danh mục")');
  assert.ok(!crumb.textContent.includes('Tất cả danh mục'), 'không còn nhãn "Tất cả danh mục" cứng trong breadcrumb chi tiết');
  assert.match(crumb.textContent, /Y tế & Sức khỏe/);
  assert.match(crumb.textContent, /Sổ khám bệnh/);
  const catCrumb = crumb.querySelector('.breadcrumb-cat');
  assert.ok(catCrumb, 'crumb danh mục phải có icon kèm tên (class breadcrumb-cat)');
  assert.ok(catCrumb.querySelector('svg'), 'crumb danh mục phải chứa icon');

  const memberCrumbLink = crumb.querySelector('.breadcrumb-link');
  assert.ok(memberCrumbLink && memberCrumbLink.textContent === 'Bố', 'crumb tên thành viên phải bấm được để quay lại "Tất cả danh mục"');
});

test('openFolderDetails(): breadcrumb hiện đúng "Hồ sơ chung gia đình" khi mở Hồ sơ chung', () => {
  const { window } = createApp();
  window.ensureFamilySharedMember();
  window.__state.currentMemberId = window.FAMILY_SHARED_ID;

  window.openFolderDetails('Y tế & Sức khỏe');

  const crumb = window.document.getElementById('docsBreadcrumb');
  const familyMember = window.__state.members.find(m => m.id === window.FAMILY_SHARED_ID);
  assert.match(crumb.textContent, new RegExp(familyMember.name));
});
