// Thao tác thanh công cụ Rich Text
function execFormat(cmd, val = null) {
  document.execCommand(cmd, false, val);
  document.getElementById('fNotesEditor').focus();
}

// Định dạng dd/mm/yyyy tự động
function maskDateInput(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  if (v.length >= 5) input.value = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  else if (v.length >= 3) input.value = `${v.slice(0, 2)}/${v.slice(2)}`;
  else input.value = v;
}

function isValidDateVN(str) {
  if (!str) return true;
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getAppStateFromLocation() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('member')) return { app: 'family', view: 'member', memberId: params.get('member') };
  if (params.has('summary')) return { app: 'family', view: 'summary' };
  if (params.has('documents')) return { app: 'family', view: 'documents', memberId: params.get('documents') };
  if (params.has('edit')) return { app: 'family', view: 'form', memberId: params.get('edit') };
  return { app: 'family', view: 'home' };
}

function initAppHistory() {
  history.replaceState(getAppStateFromLocation(), '', location.href);
}

function pushAppHistory(view, data = {}) {
  history.pushState({ app: 'family', view, ...data }, '', location.href);
}

function replaceAppHistory(view, data = {}) {
  history.replaceState({ app: 'family', view, ...data }, '', location.href);
}

function goBackInApp() {
  if (history.state && history.state.app === 'family' && history.state.view !== 'home') {
    history.back();
  } else {
    showHome(true);
  }
}

function restoreAppView(state) {
  if (!state || state.app !== 'family') return;
  if (state.view === 'member' || state.view === 'detail') viewDetails(state.memberId, true);
  else if (state.view === 'form') openForm(state.memberId ? members.find(m => String(m.id) === String(state.memberId)) : null, true);
  else if (state.view === 'summary' || state.view === 'table') openSummaryTable(true);
  else if (state.view === 'documents' || state.view === 'docs') openDocsView(state.memberId, true);
  else showHome(true);
}

window.addEventListener('popstate', (event) => {
  if (typeof masterPassword === 'string' && event.state && event.state.app === 'family') {
    restoreAppView(event.state);
  } else if (typeof masterPassword === 'string') {
    initializePage();
  }
});

// Modal QR
function getVietQrBankCode(bankName) {
  const name = String(bankName || '').toLowerCase();
  const bankCodes = [
    ['vietcombank', 'VCB'],
    ['techcombank', 'TCB'],
    ['agribank', 'VBA'],
    ['vietinbank', 'ICB'],
    ['wooribank', 'Woori'],
    ['vib', 'VIB'],
    ['acb', 'ACB'],
    ['tpbank', 'TPB'],
    ['ocb', 'OCB'],
    ['mb bank', 'MB'],
    ['mbbank', 'MB'],
    ['bidv', 'BIDV'],
    ['sacombank', 'STB'],
    ['vpbank', 'VPB'],
    ['shb', 'SHB']
  ];
  const match = bankCodes.find(([label]) => name.includes(label));
  return match ? match[1] : String(bankName || '').trim().replace(/\s+/g, '');
}

function showQrModal(bankName, accNum, qrUrl, ownerName) {
  document.getElementById('qrModalTitle').innerText = 'Mã QR chuyển khoản';
  document.getElementById('qrModalSubtitle').innerText = `${ownerName || 'Chủ tài khoản'} - STK: ${accNum}`;
  
  let finalQrSrc = qrUrl;
  if (!finalQrSrc) {
    const bankCode = getVietQrBankCode(bankName);
    finalQrSrc = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accNum)}-compact.png?accountName=${encodeURIComponent(ownerName || '')}`;
  }
  
  const qrImage = document.getElementById('qrModalImg');
  qrImage.alt = `Mã QR ${bankName} ${accNum}`;
  qrImage.onerror = () => {
    qrImage.alt = 'Không thể tải mã QR';
    qrImage.src = '';
  };
  qrImage.src = finalQrSrc;
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

function showImageModal(imageSrc, title = 'Ảnh đại diện') {
  document.getElementById('imageModalImg').src = imageSrc;
  document.getElementById('imageModalTitle').innerText = title;
  document.getElementById('imageModal').classList.remove('hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}

let documentPreviewItems = [];
let documentPreviewIndex = 0;

function showDocumentPreview(doc, relatedDocs = null) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  documentPreviewItems = (relatedDocs || (m?.documents || []).filter(item =>
    item.docType === doc.docType && !(item.fileType || '').includes('pdf')
  )).filter(item => !(item.fileType || '').includes('pdf'));
  if (!documentPreviewItems.some(item => String(item.id) === String(doc.id))) {
    documentPreviewItems.unshift(doc);
  }
  documentPreviewIndex = documentPreviewItems.findIndex(item => String(item.id) === String(doc.id));
  renderDocumentPreview();
  document.getElementById('documentPreviewModal').classList.remove('hidden');
}

function renderDocumentPreview() {
  const doc = documentPreviewItems[documentPreviewIndex];
  if (!doc) return;
  const hasNavigation = documentPreviewItems.length > 1;
  const imageEl = document.getElementById('documentPreviewImage');
  document.getElementById('documentPreviewTitle').innerText = doc.desc || 'Xem giấy tờ';
  imageEl.alt = doc.desc || 'Xem giấy tờ';
  imageEl.src = '';
  const requestedDocId = doc.id;
  getDocumentDisplayUrl(doc).then(url => {
    if (documentPreviewItems[documentPreviewIndex]?.id !== requestedDocId) return;
    imageEl.src = url;
  }).catch(err => {
    if (documentPreviewItems[documentPreviewIndex]?.id !== requestedDocId) return;
    alert(err.message || 'Không thể giải mã tệp giấy tờ.');
  });
  document.getElementById('documentPreviewMeta').innerText = `${doc.fileName || 'Tài liệu'} · Ngày tải lên: ${doc.createdAt || '-'}`;
  document.getElementById('documentPreviewPrevious').classList.toggle('hidden', !hasNavigation);
  document.getElementById('documentPreviewNext').classList.toggle('hidden', !hasNavigation);
  document.getElementById('documentPreviewCounter').innerText = hasNavigation
    ? `${documentPreviewIndex + 1} / ${documentPreviewItems.length}`
    : '';
}

function navigateDocumentPreview(direction) {
  if (documentPreviewItems.length < 2) return;
  documentPreviewIndex = (documentPreviewIndex + direction + documentPreviewItems.length) % documentPreviewItems.length;
  renderDocumentPreview();
}

function closeDocumentPreview() {
  document.getElementById('documentPreviewModal').classList.add('hidden');
  document.getElementById('documentPreviewImage').src = '';
  document.getElementById('documentPreviewMeta').innerText = '';
  documentPreviewItems = [];
  documentPreviewIndex = 0;
}

// Modal thêm Bank
function openNewBankModal() {
  document.getElementById('nbName').value = '';
  document.getElementById('nbLogo').value = '';
  document.getElementById('newBankModal').classList.remove('hidden');
}

function closeNewBankModal() {
  document.getElementById('newBankModal').classList.add('hidden');
}

async function saveNewBankDefinition() {
  const name = document.getElementById('nbName').value.trim();
  const logo = document.getElementById('nbLogo').value.trim();
  if (!name) { alert('Vui lòng nhập tên ngân hàng!'); return; }
  if (!logo) { alert('Vui lòng nhập đường dẫn tới logo!'); return; }

  const exist = customBankList.find(b => b.name.toLowerCase() === name.toLowerCase());
  if (exist) exist.logo = logo;
  else customBankList.push({ name, logo });

  try {
    await pushToFirebase();
    closeNewBankModal();
    refreshBankDropdowns();
    alert(`Đã thêm thành công ngân hàng ${name} vào hệ thống!`);
  } catch(e) {
    alert('Lỗi lưu ngân hàng mới: ' + e.message);
  }
}

function refreshBankDropdowns() {
  document.querySelectorAll('.b-select').forEach(sel => {
    const currentVal = sel.value;
    let opts = `<option value="">-- Chọn ngân hàng --</option>`;
    customBankList.forEach(b => {
      opts += `<option value="${b.name}" data-logo="${b.logo}" ${b.name === currentVal ? 'selected' : ''}>${b.name}</option>`;
    });
    sel.innerHTML = opts;
  });
}

// Quản lý Modal Popup xem Ghi chú
function showNoteModal(name, memberId) {
  const m = members.find(item => String(item.id) === String(memberId));
  document.getElementById('noteModalTitle').innerText = `📝 Ghi chú: ${name}`;
  const contentEl = document.getElementById('noteModalContent');
  
  if (m && m.notes && m.notes.trim() !== '') {
    contentEl.innerHTML = sanitizeRichText(m.notes);
  } else {
    contentEl.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Không có ghi chú nào.</span>';
  }
  document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.add('hidden');
}

// Danh sách loại giấy tờ mặc định (thứ tự hiển thị gốc)
const DEFAULT_DOC_TYPES = [
  'CCCD / Định danh cá nhân',
  'Giấy khai sinh',
  'Giấy đăng ký kết hôn',
  'Sổ đỏ / Sổ hồng nhà đất',
  'Thẻ BHYT',
  'Sổ BHXH / Hợp đồng',
  'Hồ sơ tiêm chủng / Sức khỏe'
];

// Thu thập các loại giấy tờ tùy chỉnh mà người dùng đã thêm (dựa trên toàn bộ dữ liệu hiện có)
function getCustomDocTypes() {
  const found = [];
  (typeof members !== 'undefined' ? members : []).forEach(m => {
    (m.documents || []).forEach(d => {
      const type = d.docType;
      if (type && !DEFAULT_DOC_TYPES.includes(type) && !found.includes(type)) {
        found.push(type);
      }
    });
  });
  return found;
}

// Đồng bộ các option của 1 select loại giấy tờ, giữ nguyên lựa chọn hiện tại nếu có thể
function populateDocTypeSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previousValue = select.value;
  const customTypes = getCustomDocTypes();
  select.innerHTML = '';
  DEFAULT_DOC_TYPES.concat(customTypes).forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '-- Thêm loại giấy tờ mới --';
  select.appendChild(customOpt);

  const knownValues = Array.from(select.options).map(o => o.value);
  if (previousValue && knownValues.includes(previousValue)) {
    select.value = previousValue;
  }
}

// Đồng bộ đồng thời cả 3 select loại giấy tờ (thêm mới, sửa, chuyển thư mục)
function refreshAllDocTypeSelects() {
  ['docTypeSelect', 'editDocTypeSelect', 'moveDocsTypeSelect'].forEach(populateDocTypeSelect);
}

// Quản lý Modal Upload Giấy tờ
function openUploadDocModal() {
  populateDocTypeSelect('docTypeSelect');
  const typeSelect = document.getElementById('docTypeSelect');
  const customNameInput = document.getElementById('docCustomName');
  const folder = typeof currentDocsFolder !== 'undefined' ? currentDocsFolder : null;

  if (folder) {
    const knownTypes = Array.from(typeSelect.options).map(o => o.value);
    if (knownTypes.includes(folder)) {
      typeSelect.value = folder;
      customNameInput.value = "";
    } else {
      typeSelect.value = "custom";
      customNameInput.value = folder;
    }
  } else {
    typeSelect.value = "CCCD / Định danh cá nhân";
    customNameInput.value = "";
  }

  document.getElementById('docFileInput').value = "";
  document.getElementById('docFileDescList').innerHTML = "";
  toggleCustomDocName(typeSelect.value);
  document.getElementById('uploadDocModal').classList.remove('hidden');
}

function closeUploadDocModal() {
  document.getElementById('uploadDocModal').classList.add('hidden');
}

function renderDocFileDescList(input) {
  const container = document.getElementById('docFileDescList');
  container.innerHTML = "";
  const files = Array.from(input.files || []);
  files.forEach((file, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
    row.innerHTML = `
      <span style="flex:0 0 110px; font-size:0.75rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <input type="text" class="doc-file-desc-input" data-index="${i}" placeholder="ví dụ: Mặt trước, Mặt sau, Trang 1..." style="flex:1;">
    `;
    container.appendChild(row);
  });
}

function toggleCustomDocName(val, groupId = 'customDocNameGroup') {
  const customGroup = document.getElementById(groupId);
  const inputIdMap = {
    editCustomDocNameGroup: 'editDocCustomName',
    moveDocsCustomNameGroup: 'moveDocsCustomName'
  };
  const inputId = inputIdMap[groupId] || 'docCustomName';
  if (val === 'custom') {
    customGroup.classList.remove('hidden');
    document.getElementById(inputId).focus();
  } else {
    customGroup.classList.add('hidden');
  }
}

// Quản lý Modal Sửa Giấy tờ
function openEditDocModal(docType, desc) {
  populateDocTypeSelect('editDocTypeSelect');
  const typeSelect = document.getElementById('editDocTypeSelect');
  const knownTypes = Array.from(typeSelect.options).map(o => o.value);
  if (knownTypes.includes(docType)) {
    typeSelect.value = docType;
    document.getElementById('editDocCustomName').value = "";
  } else {
    typeSelect.value = "custom";
    document.getElementById('editDocCustomName').value = docType;
  }
  document.getElementById('editDocDesc').value = desc || "";
  toggleCustomDocName(typeSelect.value, 'editCustomDocNameGroup');
  document.getElementById('editDocModal').classList.remove('hidden');
}

function closeEditDocModal() {
  document.getElementById('editDocModal').classList.add('hidden');
}

// Quản lý Modal Chuyển nhiều tệp sang thư mục khác
function openMoveDocsModal() {
  if (selectedDocIds.size === 0) {
    alert('Vui lòng chọn ít nhất 1 tệp để chuyển thư mục!');
    return;
  }
  populateDocTypeSelect('moveDocsTypeSelect');
  const typeSelect = document.getElementById('moveDocsTypeSelect');
  const customNameInput = document.getElementById('moveDocsCustomName');
  typeSelect.value = 'CCCD / Định danh cá nhân';
  customNameInput.value = '';
  toggleCustomDocName(typeSelect.value, 'moveDocsCustomNameGroup');
  document.getElementById('moveDocsSummary').innerText = `Đã chọn ${selectedDocIds.size} tệp.`;
  document.getElementById('moveDocsModal').classList.remove('hidden');
}

function closeMoveDocsModal() {
  document.getElementById('moveDocsModal').classList.add('hidden');
}