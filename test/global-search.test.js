'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

test('normalizeSearchText() bỏ dấu tiếng Việt (kể cả đ) và chuyển về chữ thường', () => {
  const { window } = createApp();
  assert.equal(window.normalizeSearchText('Khai Sinh Của Đức'), 'khai sinh cua duc');
  assert.equal(window.normalizeSearchText(''), '');
  assert.equal(window.normalizeSearchText(undefined), '');
});

test('tokenizeSearchQuery() tách từ, bỏ dấu và loại bỏ từ nối thông dụng', () => {
  const { window } = createApp();
  // Array.from(): mảng trả về từ context của jsdom (realm khác) không reference-equal với
  // Array của Node dù cùng nội dung - bọc lại để assert.deepEqual so sánh đúng theo giá trị.
  assert.deepEqual(Array.from(window.tokenizeSearchQuery('khai sinh của Minh')), ['khai', 'sinh', 'minh']);
  assert.deepEqual(Array.from(window.tokenizeSearchQuery('  Hóa   đơn   ở  nhà ')), ['hoa', 'don', 'nha']);
  assert.deepEqual(Array.from(window.tokenizeSearchQuery('')), []);
});

test('searchAllDocuments(): khớp tệp khi từ khóa nằm rải rác ở nhiều trường khác nhau (tên danh mục + người được gắn thẻ)', () => {
  const { window } = createApp();
  window.__state.members = [
    {
      id: '1', name: 'Bố', type: 'adult', folders: [], documents: [
        { id: 'doc-1', desc: 'Bản sao khai sinh', docType: 'Hộ tịch & Gia đình', tags: ['Minh'], fileType: 'image/jpeg' },
        { id: 'doc-2', desc: 'Hóa đơn điện tháng 5', docType: 'Chi phí & Hóa đơn', tags: [], fileType: 'application/pdf' }
      ]
    },
    { id: '2', name: 'Minh', type: 'child', folders: [], documents: [] }
  ];

  // "khai sinh của Minh": 'khai' + 'sinh' khớp desc, 'minh' khớp tags (người được gắn thẻ) -
  // không nằm cùng 1 trường nhưng vẫn phải ra đúng kết quả vì searchTokens.every() chỉ cần có
  // mặt đâu đó trong text hợp nhất, không cần liền kề.
  const results = window.searchAllDocuments('khai sinh của Minh');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'doc-1');
  assert.equal(results[0].ownerId, '1');
  assert.equal(results[0].ownerName, 'Bố');

  // Từ khóa theo tên chủ sở hữu (ownerName) cũng phải khớp được, không chỉ tên tệp/mô tả.
  assert.equal(window.searchAllDocuments('hóa đơn Bố').length, 1);
  // Không có tệp nào khớp đủ mọi từ khóa -> mảng rỗng.
  assert.equal(window.searchAllDocuments('khai sinh của Lan').length, 0);
  // Không gõ gì (chỉ toàn từ nối) -> không trả kết quả nào để tránh liệt kê toàn bộ kho.
  assert.equal(window.searchAllDocuments('của và cho').length, 0);
});

test('onGlobalSearchInput()/renderGlobalSearchResults(): vẽ danh sách kết quả thả xuống dưới ô tìm kiếm header, bấm vào 1 kết quả thì mở đúng hồ sơ chủ sở hữu + xem trước tệp', () => {
  const { window } = createApp();
  window.__state.currentMemberId = null;
  window.__state.members = [
    {
      id: '1', name: 'Bố', type: 'adult', folders: [], documents: [
        { id: 'doc-1', desc: 'Bản sao khai sinh', docType: 'Hộ tịch & Gia đình', tags: ['Minh'], fileType: 'image/jpeg', data: 'data:image/jpeg;base64,abc' }
      ]
    },
    { id: '2', name: 'Minh', type: 'child', folders: [], documents: [] }
  ];

  window.onGlobalSearchInput('khai sinh của Minh');
  const resultsBox = window.document.getElementById('globalSearchResults');
  assert.ok(!resultsBox.classList.contains('hidden'));
  const items = resultsBox.querySelectorAll('.header-search-result-item');
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Bản sao khai sinh/);
  assert.match(items[0].textContent, /Bố/);

  items[0].click();
  assert.equal(window.__state.currentMemberId, '1', 'phải điều hướng đến đúng hồ sơ chủ sở hữu (Bố)');
  assert.ok(!window.document.getElementById('documentPreviewModal').classList.contains('hidden'), 'phải mở modal xem trước tệp');
  assert.ok(resultsBox.classList.contains('hidden'), 'ô tìm kiếm phải đóng lại sau khi chọn kết quả');
  assert.equal(window.document.getElementById('globalSearchInput').value, '', 'phải xóa sạch từ khóa đã gõ sau khi chọn kết quả');
});

test('onGlobalSearchInput(): không có tệp nào khớp thì hiện thông báo trống, xóa hết từ khóa thì ẩn hẳn khu vực kết quả', () => {
  const { window } = createApp();
  window.__state.members = [{ id: '1', name: 'Bố', type: 'adult', folders: [], documents: [] }];

  window.onGlobalSearchInput('không tồn tại');
  const resultsBox = window.document.getElementById('globalSearchResults');
  assert.ok(!resultsBox.classList.contains('hidden'));
  assert.match(resultsBox.textContent, /Không tìm thấy/);

  window.onGlobalSearchInput('');
  assert.ok(resultsBox.classList.contains('hidden'));
  assert.equal(resultsBox.innerHTML, '');
});
