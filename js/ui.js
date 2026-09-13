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
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
  return !(month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100);
}

function initAppHistory() {
  history.replaceState({ app: 'family', view: 'home' }, '', location.href);
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
  if (state.view === 'detail') viewDetails(state.memberId, true);
  else if (state.view === 'form') openForm(state.memberId ? members.find(m => m.id === state.memberId) : null, true);
  else if (state.view === 'table') openSummaryTable(true);
  else if (state.view === 'docs') openDocsView(state.memberId, true);
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

function showDocumentPreview(doc) {
  document.getElementById('documentPreviewTitle').innerText = doc.desc || 'Xem giấy tờ';
  document.getElementById('documentPreviewImage').src = doc.data;
  document.getElementById('documentPreviewModal').classList.remove('hidden');
}

function closeDocumentPreview() {
  document.getElementById('documentPreviewModal').classList.add('hidden');
  document.getElementById('documentPreviewImage').src = '';
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
  const m = members.find(item => item.id === memberId);
  document.getElementById('noteModalTitle').innerText = `📝 Ghi chú: ${name}`;
  const contentEl = document.getElementById('noteModalContent');
  
  if (m && m.notes && m.notes.trim() !== '') {
    contentEl.innerHTML = m.notes;
  } else {
    contentEl.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Không có ghi chú nào.</span>';
  }
  document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.add('hidden');
}

// Quản lý Modal Upload Giấy tờ
function openUploadDocModal() {
  document.getElementById('docTypeSelect').value = "CCCD / Định danh";
  document.getElementById('docCustomName').value = "";
  document.getElementById('docDesc').value = "";
  document.getElementById('docFileInput').value = "";
  document.getElementById('customDocNameGroup').classList.add('hidden');
  document.getElementById('uploadDocModal').classList.remove('hidden');
}

function closeUploadDocModal() {
  document.getElementById('uploadDocModal').classList.add('hidden');
}

function toggleCustomDocName(val) {
  const customGroup = document.getElementById('customDocNameGroup');
  if (val === 'custom') {
    customGroup.classList.remove('hidden');
    document.getElementById('docCustomName').focus();
  } else {
    customGroup.classList.add('hidden');
  }
}