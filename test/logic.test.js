'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

test('escapeHtml() thoát ký tự HTML nguy hiểm', () => {
  const { window } = createApp();
  assert.equal(
    window.escapeHtml(`<script>alert("x")</script> & 'quote'`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#039;quote&#039;'
  );
  assert.equal(window.escapeHtml(), '');
});

test('sanitizeRichText() chỉ giữ lại thẻ được cho phép và bỏ mọi thuộc tính', () => {
  const { window } = createApp();
  const dirty = '<p onclick="alert(1)">An toàn</p><script>alert(2)</script><img src=x>';
  const clean = window.sanitizeRichText(dirty);
  assert.match(clean, /^<p>An toàn<\/p>alert\(2\)/);
  assert.doesNotMatch(clean, /onclick|<script|<img/);
});

test('isValidDateVN() nhận ngày hợp lệ, chuỗi rỗng và từ chối ngày sai', () => {
  const { window } = createApp();
  assert.equal(window.isValidDateVN(''), true, 'chuỗi rỗng coi là hợp lệ (trường tùy chọn)');
  assert.equal(window.isValidDateVN('29/02/2024'), true, '2024 là năm nhuận');
  assert.equal(window.isValidDateVN('29/02/2023'), false, '2023 không phải năm nhuận');
  assert.equal(window.isValidDateVN('31/04/2024'), false, 'Tháng 4 không có ngày 31');
  assert.equal(window.isValidDateVN('13/13/2024'), false, 'Tháng 13 không tồn tại');
  assert.equal(window.isValidDateVN('01-01-2024'), false, 'Sai định dạng (phải dùng dấu /)');
});

test('maskDateInput() tự chèn dấu / khi gõ số', () => {
  const { window } = createApp();
  const input = window.document.createElement('input');

  input.value = '01012024';
  window.maskDateInput(input);
  assert.equal(input.value, '01/01/2024');

  input.value = 'ab01cd012024ef99';
  window.maskDateInput(input);
  assert.equal(input.value, '01/01/2024', 'phải loại bỏ ký tự không phải số và cắt ở 8 chữ số');
});

test('getVietQrBankCode() nhận diện ngân hàng quen thuộc, fallback cho tên lạ', () => {
  const { window } = createApp();
  assert.equal(window.getVietQrBankCode('Vietcombank'), 'VCB');
  assert.equal(window.getVietQrBankCode('MB Bank'), 'MB');
  assert.equal(window.getVietQrBankCode('Ngân hàng ABC'), 'NgânhàngABC', 'tên lạ: bỏ khoảng trắng, giữ nguyên chữ');
});

test('bytesToBase64Url()/base64UrlToBytes() là hai chiều nghịch đảo của nhau', () => {
  const { window } = createApp();
  const original = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 16, 32]);
  const encoded = window.bytesToBase64Url(original);
  assert.equal(/[+/=]/.test(encoded), false, 'không được chứa ký tự +, / hoặc = (phải là base64url)');
  const decoded = window.base64UrlToBytes(encoded);
  assert.deepEqual(Array.from(decoded), Array.from(original));
});

test('validateDataIntegrity(): dữ liệu sạch (đủ trường, không tệp/thư mục mồ côi) không báo lỗi nào', () => {
  const { window } = createApp();
  const members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [{ id: 'f1', name: 'Thư mục A', parentId: null }],
    documents: [{ id: 'd1', desc: 'CCCD', folderId: 'f1', fileType: 'image/jpeg', createdAt: '01/01/2024', tags: ['Bố'] }]
  }];
  assert.deepEqual(Array.from(window.validateDataIntegrity(members)), []);
});

test('validateDataIntegrity(): phát hiện tệp mồ côi khi folderId trỏ tới thư mục đã bị xóa', () => {
  const { window } = createApp();
  const members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [],
    documents: [{ id: 'd1', desc: 'CCCD', folderId: 'f-da-xoa', fileType: 'image/jpeg', createdAt: '01/01/2024' }]
  }];
  const issues = window.validateDataIntegrity(members);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'orphaned-document-folder');
  assert.equal(issues[0].docId, 'd1');
});

test('validateDataIntegrity(): phát hiện thư mục mồ côi khi parentId trỏ tới thư mục cha đã bị xóa', () => {
  const { window } = createApp();
  const members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [{ id: 'f1', name: 'Thư mục con', parentId: 'f-cha-da-xoa' }],
    documents: []
  }];
  const issues = window.validateDataIntegrity(members);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'orphaned-folder-parent');
  assert.equal(issues[0].folderId, 'f1');
});

test('validateDataIntegrity(): phát hiện tài liệu thiếu createdAt, thiếu/sai fileType và tags không phải mảng', () => {
  const { window } = createApp();
  const members = [{
    id: '1', name: 'Bố', type: 'adult',
    folders: [],
    documents: [{ id: 'd1', desc: 'Cũ', fileType: '', tags: 'Bố' }]
  }];
  const issues = window.validateDataIntegrity(members);
  const types = Array.from(issues, i => i.type).sort();
  assert.deepEqual(types, ['invalid-tags', 'missing-createdAt', 'missing-fileType']);
});

test('validateDataIntegrity(): không crash và vẫn báo cáo được khi input rỗng/thiếu mảng documents-folders', () => {
  const { window } = createApp();
  assert.deepEqual(Array.from(window.validateDataIntegrity([])), []);
  assert.deepEqual(Array.from(window.validateDataIntegrity(undefined)), []);
  const members = [{ id: '1', name: 'Thành viên cũ chưa từng có documents/folders' }];
  assert.deepEqual(Array.from(window.validateDataIntegrity(members)), []);
});
