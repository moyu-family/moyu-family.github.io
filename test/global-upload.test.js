'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../testing/app');

test('renderGlobalFilePreview(): hiện thông báo trống khi chưa có ảnh nào', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [];

  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.match(preview.textContent, /Chưa có ảnh nào/);
  assert.equal(window.document.getElementById('guFileCount').textContent, '');
});

test('renderGlobalFilePreview(): đúng 1 ảnh -> Single Preview (1 thumbnail lớn)', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg', size: 512_000 }, previewUrl: 'blob:mat-truoc' }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.equal(preview.querySelectorAll('.gu-single-preview').length, 1);
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 0, 'không được vẽ dạng Compact List khi chỉ có 1 ảnh');
  assert.equal(preview.querySelector('.gu-single-preview-img').src, 'blob:mat-truoc');
  assert.match(preview.querySelector('.gu-single-preview-size').textContent, /KB/);
  assert.equal(window.document.getElementById('guFileCount').textContent, 'Đã chọn 1 tệp');
});

test('renderGlobalFilePreview(): đúng 1 tệp nhưng là PDF -> vẫn Compact List, không phải Single Preview', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'to-khai.pdf', type: 'application/pdf', size: 900_000 }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.equal(preview.querySelectorAll('.gu-single-preview').length, 0, 'PDF thì dù chỉ 1 tệp cũng không dùng Single Preview');
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 1);
});

test('renderGlobalFilePreview(): từ 2 tệp trở lên (kể cả toàn ảnh) -> Compact List, không còn dạng lưới thumbnail cũ', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'mat-sau.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.equal(preview.querySelectorAll('.gu-single-preview').length, 0);
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 2);
  assert.equal(window.document.getElementById('guFileCount').textContent, 'Đã chọn 2 tệp');
});

test('renderGlobalFilePreview(): có lẫn nhiều thể loại (ảnh + PDF) thì thống nhất vẽ toàn bộ dạng Compact List', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'mat-truoc.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'to-khai.pdf', type: 'application/pdf', size: 2_400_000 }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.equal(preview.querySelectorAll('.gu-single-preview').length, 0);
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 2, 'kể cả ảnh cũng phải vẽ dạng hàng danh sách');
  assert.equal(preview.querySelectorAll('.gu-file-row-thumb').length, 1, 'hàng của ảnh dùng thumbnail ảnh thay vì icon tài liệu');
  assert.equal(preview.querySelectorAll('.gu-file-row-icon').length, 1, 'hàng của PDF dùng icon tài liệu màu đỏ');
  assert.match(preview.querySelector('.gu-file-row-size').textContent, /MB/);
});

test('renderGlobalFilePreview(): tên tệp trong hàng danh sách không bị JS cắt cứng theo số ký tự - luôn giữ trọn văn bản (để CSS ellipsis tự cắt khi thật sự tràn hàng), đuôi mở rộng tách riêng khỏi phần có thể bị ellipsis, kèm tooltip đầy đủ tên gốc', () => {
  const { window } = createApp();
  const longName = 'day-la-mot-ten-tep-rat-la-dai-can-duoc-rut-gon-hop-ly.pdf';
  window.__state.globalUploadFiles = [
    { file: { name: longName, type: 'application/pdf' }, previewUrl: null },
    { file: { name: 'ngan.pdf', type: 'application/pdf' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  const names = preview.querySelectorAll('.gu-file-row-name');

  const longNameEl = Array.from(names).find(el => el.title === longName);
  assert.ok(longNameEl, 'phải có tooltip title đầy đủ tên gốc');
  const longBase = longNameEl.querySelector('.gu-file-row-name-base');
  const longExt = longNameEl.querySelector('.gu-file-row-name-ext');
  assert.equal(longExt.textContent, '.pdf', 'đuôi mở rộng phải tách riêng, không nằm trong phần có thể bị ellipsis');
  assert.equal(longBase.textContent + longExt.textContent, longName, 'không được JS cắt bớt ký tự nào của tên gốc');

  const shortNameEl = Array.from(names).find(el => el.title === 'ngan.pdf');
  assert.ok(shortNameEl, 'tên ngắn cũng render đầy đủ với title tương ứng');
  assert.equal(
    shortNameEl.querySelector('.gu-file-row-name-base').textContent + shortNameEl.querySelector('.gu-file-row-name-ext').textContent,
    'ngan.pdf'
  );
});

test('removeGlobalFile(): gỡ đúng 1 ảnh khỏi danh sách đang chờ lưu (lỡ chọn nhầm/ảnh mờ), tự chuyển từ Compact List sang Single Preview khi chỉ còn lại 1 ảnh', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'b.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const preview = window.document.getElementById('guFilePreview');
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 2, '2 ảnh trở lên phải hiện Compact List');

  window.removeGlobalFile(0);

  assert.deepEqual(Array.from(window.__state.globalUploadFiles).map(e => e.file.name), ['b.jpg']);
  assert.equal(preview.querySelectorAll('.gu-single-preview').length, 1, 'chỉ còn 1 ảnh phải tự chuyển sang Single Preview');
  assert.equal(preview.querySelectorAll('.gu-file-row-item').length, 0);
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

test('modal Xem lại nhanh: có khung Dropzone kéo-thả/bấm để chọn tệp, dùng input riêng #guAddFileInput (không có "capture" để không ép mở camera)', () => {
  const { window } = createApp();

  const dropzone = window.document.getElementById('guDropzone');
  assert.ok(dropzone, 'phải có khung Dropzone trong modal');
  assert.equal(dropzone.getAttribute('onclick'), "document.getElementById('guAddFileInput').click()");
  assert.match(dropzone.textContent, /Kéo thả tệp hoặc bấm vào đây/);
  assert.match(dropzone.textContent, /10MB/);

  const addInput = window.document.getElementById('guAddFileInput');
  assert.ok(addInput, 'phải có input file riêng cho khung Dropzone/nút "+ Thêm tệp"');
  assert.equal(addInput.hasAttribute('capture'), false, 'không được ép mở camera khi bấm chọn tệp qua modal');
  assert.equal(addInput.multiple, true, 'phải cho chọn nhiều tệp cùng lúc');
});

test('modal Xem lại nhanh: nút "+ Thêm tệp" chỉ hiện khi danh sách đã có tệp, ẩn đi khi danh sách rỗng', () => {
  const { window } = createApp();

  const addMoreBtn = window.document.getElementById('guAddMoreBtn');
  assert.ok(addMoreBtn, 'phải có nút "+ Thêm tệp" trong modal');
  assert.match(addMoreBtn.textContent, /Thêm tệp/);
  assert.equal(addMoreBtn.getAttribute('onclick'), "document.getElementById('guAddFileInput').click()");

  window.__state.globalUploadFiles = [];
  window.renderGlobalFilePreview();
  assert.equal(addMoreBtn.classList.contains('hidden'), true, 'danh sách rỗng thì ẩn nút, chỉ dùng khung Dropzone');

  window.__state.globalUploadFiles = [{ file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null }];
  window.renderGlobalFilePreview();
  assert.equal(addMoreBtn.classList.contains('hidden'), false, 'còn tệp thì phải hiện nút để thêm tệp khác');
});

test('onGlobalDropzoneDrop(): kéo-thả tệp vào khung Dropzone cũng nạp được tệp như chọn qua input', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [];

  const dropzone = window.document.getElementById('guDropzone');
  let prevented = false;
  window.onGlobalDropzoneDrop({
    preventDefault: () => { prevented = true; },
    currentTarget: dropzone,
    dataTransfer: { files: [{ name: 'scan.pdf', type: 'application/pdf', size: 1000 }] }
  });

  assert.ok(prevented, 'phải chặn hành vi mặc định của trình duyệt khi thả tệp');
  assert.equal(dropzone.classList.contains('gu-dropzone--dragover'), false, 'phải gỡ class highlight sau khi thả xong');
  assert.equal(window.__state.globalUploadFiles.length, 1);
  assert.equal(window.__state.globalUploadFiles[0].file.name, 'scan.pdf');
});

test('addGlobalFiles(): bỏ qua tệp vượt quá 10MB, vẫn nạp các tệp hợp lệ còn lại', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [];
  let alertMessage = null;
  window.alert = (msg) => { alertMessage = msg; };

  // Dùng PDF cho tệp hợp lệ để tránh phải giả lập URL.createObjectURL() (jsdom không hỗ trợ
  // sẵn) - xem ghi chú tương tự ở test onGlobalFileSelected() phía trên.
  window.onGlobalFileSelected({
    files: [
      { name: 'qua-lon.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 },
      { name: 'binh-thuong.pdf', type: 'application/pdf', size: 1024 }
    ],
    value: 'C:\\fakepath\\x'
  });

  assert.deepEqual(Array.from(window.__state.globalUploadFiles, e => e.file.name), ['binh-thuong.pdf']);
  assert.match(alertMessage || '', /qua-lon\.jpg/);
  assert.match(alertMessage || '', /10MB/);
});

test('onGlobalFileSelected(): cộng dồn tệp mới chọn thêm vào danh sách đang có sẵn, bỏ qua tệp trùng tên + dung lượng đã có trong danh sách', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'a.pdf', type: 'application/pdf', size: 100 }, previewUrl: null }
  ];

  window.onGlobalFileSelected({
    files: [
      { name: 'a.pdf', type: 'application/pdf', size: 100 }, // trùng hệt tệp đã có -> phải bị bỏ qua
      { name: 'b.pdf', type: 'application/pdf', size: 200 }
    ],
    value: 'C:\\fakepath\\x'
  });

  const names = Array.from(window.__state.globalUploadFiles, e => e.file.name).sort();
  assert.deepEqual(names, ['a.pdf', 'b.pdf'], 'phải giữ tệp cũ, thêm tệp mới, không nhân đôi tệp trùng');
});

test('renderGlobalFilePreview()/removeGlobalFile(): vô hiệu hoá nút "Lưu vào..." khi danh sách rỗng, bật lại ngay khi còn ít nhất 1 tệp', () => {
  const { window } = createApp();
  window.__state.globalUploadFiles = [
    { file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  const saveBtn = window.document.getElementById('btnSaveGlobalDoc');
  assert.equal(saveBtn.disabled, false, 'còn tệp thì nút Lưu phải bấm được');

  window.removeGlobalFile(0);

  assert.equal(window.__state.globalUploadFiles.length, 0);
  assert.equal(saveBtn.disabled, true, 'xóa hết tệp thì phải khoá nút Lưu lại');
});

test('renderGlobalFilePreview(): khu vực danh sách tệp (Compact List) có class khống chế chiều cao + cuộn riêng, không áp dụng cho Single Preview', () => {
  const { window } = createApp();
  const preview = window.document.getElementById('guFilePreview');

  window.__state.globalUploadFiles = [
    { file: { name: 'a.jpg', type: 'image/jpeg' }, previewUrl: null },
    { file: { name: 'b.jpg', type: 'image/jpeg' }, previewUrl: null }
  ];
  window.renderGlobalFilePreview();
  assert.ok(preview.classList.contains('gu-file-preview--list'), 'Compact List phải có class khống chế chiều cao/cuộn');

  window.__state.globalUploadFiles = [
    { file: { name: 'a.jpg', type: 'image/jpeg', size: 1000 }, previewUrl: 'blob:a' }
  ];
  window.renderGlobalFilePreview();
  assert.equal(preview.classList.contains('gu-file-preview--list'), false, 'Single Preview không cần cuộn riêng');
});
