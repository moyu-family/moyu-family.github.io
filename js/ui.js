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
  if (params.has('consolidated')) return { app: 'family', view: 'consolidated' };
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
  else if (state.view === 'consolidated') openConsolidatedView(true);
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

// Toast thông báo ngắn (dùng cho các thao tác nhanh như sao chép STK)
let toastHideTimer = null;
function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let documentPreviewItems = [];
let documentPreviewIndex = 0;
let documentPreviewRenderToken = 0;

function showDocumentPreview(doc, relatedDocs = null) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  documentPreviewItems = relatedDocs || (m?.documents || []).filter(item => item.docType === doc.docType);
  if (!documentPreviewItems.some(item => String(item.id) === String(doc.id))) {
    documentPreviewItems.unshift(doc);
  }
  documentPreviewIndex = documentPreviewItems.findIndex(item => String(item.id) === String(doc.id));
  renderDocumentPreview();
  document.getElementById('documentPreviewModal').classList.remove('hidden');
}

async function renderDocumentPreview() {
  const doc = documentPreviewItems[documentPreviewIndex];
  if (!doc) return;
  const hasNavigation = documentPreviewItems.length > 1;
  const isPdf = (doc.fileType || '').includes('pdf');
  const imageEl = document.getElementById('documentPreviewImage');
  const pdfEl = document.getElementById('documentPreviewPdf');
  const downloadEl = document.getElementById('documentPreviewDownload');
  const renderToken = ++documentPreviewRenderToken;
  const isStillCurrent = () => documentPreviewItems[documentPreviewIndex]?.id === doc.id && renderToken === documentPreviewRenderToken;

  document.getElementById('documentPreviewTitle').innerText = doc.desc || 'Xem giấy tờ';
  imageEl.alt = doc.desc || 'Xem giấy tờ';
  imageEl.src = '';
  imageEl.classList.toggle('hidden', isPdf);
  pdfEl.classList.toggle('hidden', !isPdf);
  pdfEl.innerHTML = '';
  downloadEl.href = '';
  downloadEl.setAttribute('download', doc.fileName || '');

  try {
    const url = await getDocumentDisplayUrl(doc);
    if (!isStillCurrent()) return;
    downloadEl.href = url;
    if (isPdf) await renderPdfIntoContainer(url, pdfEl, isStillCurrent);
    else imageEl.src = url;
  } catch (err) {
    if (!isStillCurrent()) return;
    alert(err.message || 'Không thể giải mã tệp giấy tờ.');
  }

  document.getElementById('documentPreviewMeta').innerText = `${doc.fileName || 'Tài liệu'} · Ngày tải lên: ${doc.createdAt || '-'}`;
  document.getElementById('documentPreviewPrevious').classList.toggle('hidden', !hasNavigation);
  document.getElementById('documentPreviewNext').classList.toggle('hidden', !hasNavigation);
  document.getElementById('documentPreviewCounter').innerText = hasNavigation
    ? `${documentPreviewIndex + 1} / ${documentPreviewItems.length}`
    : '';
}

// Render từng trang PDF ra <canvas> bằng PDF.js: trình xem PDF gốc của Chrome trên Android
// không chạy được trong iframe, và Samsung Internet không có trình xem PDF gắn trong trình
// duyệt nên mọi điều hướng tới PDF đều bị tải thẳng về máy thay vì hiển thị. Render bằng
// canvas cho kết quả nhất quán trên mọi trình duyệt.
async function renderPdfIntoContainer(url, container, isStillRelevant) {
  container.classList.add('loading');
  container.innerText = 'Đang tải PDF...';
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    if (!isStillRelevant()) return;
    container.classList.remove('loading');
    container.innerHTML = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      if (!isStillRelevant()) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const containerWidth = container.clientWidth || 320;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (containerWidth / baseViewport.width) * pixelRatio });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;
      container.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  } catch (err) {
    if (!isStillRelevant()) return;
    container.classList.remove('loading');
    container.innerText = 'Không thể hiển thị PDF. Hãy dùng nút "Tải xuống tệp gốc" bên dưới.';
  }
}

function navigateDocumentPreview(direction) {
  if (documentPreviewItems.length < 2) return;
  documentPreviewIndex = (documentPreviewIndex + direction + documentPreviewItems.length) % documentPreviewItems.length;
  renderDocumentPreview();
}

function closeDocumentPreview() {
  document.getElementById('documentPreviewModal').classList.add('hidden');
  document.getElementById('documentPreviewImage').src = '';
  document.getElementById('documentPreviewPdf').innerHTML = '';
  document.getElementById('documentPreviewMeta').innerText = '';
  documentPreviewItems = [];
  documentPreviewIndex = 0;
  documentPreviewRenderToken++;
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

// Danh sách loại giấy tờ mặc định hiển thị làm gợi ý trong dropdown chọn danh mục
// (7 nhóm chuẩn - xem STANDARD_CATEGORIES trong config.js).
const DEFAULT_DOC_TYPES = STANDARD_CATEGORIES;

// Thu thập các loại giấy tờ tùy chỉnh mà người dùng đã thêm (dựa trên toàn bộ dữ liệu hiện có)
// Xét cả tài liệu lẫn thư mục con, vì 1 danh mục có thể chỉ còn tồn tại qua các thư mục con của nó
// (ví dụ: đã xóa hết tài liệu gắn trực tiếp docType đó, nhưng thư mục con bên trong vẫn còn).
function getCustomDocTypes() {
  const found = [];
  (typeof members !== 'undefined' ? members : []).forEach(m => {
    (m.documents || []).forEach(d => {
      const type = d.docType;
      if (type && !DEFAULT_DOC_TYPES.includes(type) && !found.includes(type)) {
        found.push(type);
      }
    });
    (m.folders || []).forEach(f => {
      const type = f.docType;
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
  DEFAULT_DOC_TYPES.concat(customTypes).sort((a, b) => a.localeCompare(b, 'vi')).forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '+ Tạo danh mục mới...';
  select.appendChild(customOpt);

  const knownValues = Array.from(select.options).map(o => o.value);
  if (previousValue && knownValues.includes(previousValue)) {
    select.value = previousValue;
  }
}

// Đồng bộ đồng thời cả 4 select loại giấy tờ (thêm mới, sửa, chuyển thư mục, tải nhanh FAB)
function refreshAllDocTypeSelects() {
  ['docTypeSelect', 'editDocTypeSelect', 'moveDocsTypeSelect', 'guCategorySelect'].forEach(populateDocTypeSelect);
}

// Quản lý Modal Upload Giấy tờ
function openUploadDocModal() {
  populateDocTypeSelect('docTypeSelect');
  const typeSelect = document.getElementById('docTypeSelect');
  const customNameInput = document.getElementById('docCustomName');
  const folder = typeof currentDocsFolder !== 'undefined' ? currentDocsFolder : null;
  const subfolderId = typeof currentSubfolderId !== 'undefined' ? currentSubfolderId : null;

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
    typeSelect.value = "Định danh & Tùy thân";
    customNameInput.value = "";
  }

  document.getElementById('docFileInput').value = "";
  pendingUploadFiles = [];
  document.getElementById('docFileDescList').innerHTML = "";
  toggleCustomDocName(typeSelect.value);

  // Luôn dựng cây thư mục theo đúng danh mục đang mở (folder), kể cả khi danh mục này
  // tạm thời rơi vào ô "custom" (vì chưa có tài liệu trực tiếp nào mang đúng docType đó).
  // Nếu không, người dùng đang ở trong 1 thư mục con sẽ bị mất lựa chọn thư mục hiện hành.
  const folderTreeDocType = folder || (typeSelect.value !== 'custom' ? typeSelect.value : null);
  populateUploadFolderSelect(folderTreeDocType);
  const folderSelect = document.getElementById('docFolderSelect');
  const preselectFolderId = (folder && subfolderId) ? subfolderId : '';
  if (folderSelect) folderSelect.value = preselectFolderId;
  document.getElementById('docNewFolderName').value = "";
  document.getElementById('docNewFolderNameGroup').classList.add('hidden');

  updateUploadDestinationLabel();
  document.getElementById('uploadDocModal').classList.remove('hidden');
}

function closeUploadDocModal() {
  document.getElementById('uploadDocModal').classList.add('hidden');
  pendingUploadFiles = [];
}

// Khi đổi danh mục (thư mục) đích lúc tải lên: đồng bộ ô "loại giấy tờ mới" và danh sách thư mục con tương ứng
function onUploadDocTypeChange(val) {
  toggleCustomDocName(val);
  populateUploadFolderSelect(val === 'custom' ? null : val);
  updateUploadDestinationLabel();
}

// Khi chọn thư mục con lúc tải lên: hiện ô nhập tên nếu người dùng chọn "Tạo thư mục mới..."
function onUploadDocFolderChange(val) {
  document.getElementById('docNewFolderNameGroup').classList.toggle('hidden', val !== '__new__');
  if (val === '__new__') document.getElementById('docNewFolderName').focus();
  updateUploadDestinationLabel();
}

// Hiển thị rõ đường dẫn thư mục đích để người dùng luôn biết tệp sắp tải lên sẽ nằm ở đâu
function updateUploadDestinationLabel() {
  const label = document.getElementById('docUploadDestination');
  if (!label) return;

  const typeSelect = document.getElementById('docTypeSelect');
  const customNameInput = document.getElementById('docCustomName');
  const folderSelect = document.getElementById('docFolderSelect');
  const docType = typeSelect.value === 'custom'
    ? (customNameInput.value.trim() || 'Danh mục mới')
    : typeSelect.value;

  let path = escapeHtml(docType);
  if (folderSelect && folderSelect.value === '__new__') {
    const newName = document.getElementById('docNewFolderName').value.trim();
    path += ` ➔ ${escapeHtml(newName || '(thư mục mới)')}`;
  } else if (folderSelect && folderSelect.value) {
    const m = members.find(item => String(item.id) === String(currentMemberId));
    const chain = m ? getFolderAncestorChain(m, folderSelect.value) : [];
    chain.forEach(f => { path += ` ➔ ${escapeHtml(f.name)}`; });
  }
  label.innerHTML = `📤 Sẽ tải lên vào: <strong>${path}</strong>`;
}

// Dựng danh sách thư mục con (theo cây, thụt lề dần) của 1 danh mục để chọn nơi lưu các tệp sắp tải lên
function populateUploadFolderSelect(docType) {
  const select = document.getElementById('docFolderSelect');
  if (!select) return;

  const m = members.find(item => String(item.id) === String(currentMemberId));
  select.innerHTML = '';
  const rootOpt = document.createElement('option');
  rootOpt.value = '';
  rootOpt.textContent = '(Thư mục gốc của danh mục)';
  select.appendChild(rootOpt);

  if (m && docType) {
    appendFolderTreeOptions(select, m.folders, docType);
  }

  const newFolderOpt = document.createElement('option');
  newFolderOpt.value = '__new__';
  newFolderOpt.textContent = '+ Tạo thư mục con mới...';
  select.appendChild(newFolderOpt);

  document.getElementById('docNewFolderNameGroup').classList.add('hidden');
}

// Khi người dùng chọn tệp từ input: nạp vào danh sách chờ tải lên (có thể bỏ bớt từng tệp sau đó)
function renderDocFileDescList(input) {
  const newFiles = Array.from(input.files || []).map(file => ({ file, desc: '' }));
  pendingUploadFiles = pendingUploadFiles.concat(newFiles);
  // Reset input để lần chọn tiếp theo (onchange) vẫn kích hoạt được, đồng thời tránh nạp lại đúng các tệp vừa thêm
  input.value = '';
  renderPendingUploadFilesList();
}

// Vẽ lại danh sách tệp đang chờ tải lên (dựa trên pendingUploadFiles, không đọc trực tiếp từ input nữa
// vì FileList gốc của input là read-only, không thể bỏ bớt từng tệp)
function renderPendingUploadFilesList() {
  const container = document.getElementById('docFileDescList');
  container.innerHTML = "";
  pendingUploadFiles.forEach((entry, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
    row.innerHTML = `
      <span style="flex:0 0 110px; font-size:0.75rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span>
      <input type="text" class="doc-file-desc-input" data-index="${i}" placeholder="ví dụ: Mặt trước, Mặt sau, Trang 1..." style="flex:1;" value="${escapeHtml(entry.desc)}">
      <button type="button" class="btn-remove-pending-file" title="Bỏ chọn tệp này" aria-label="Bỏ chọn tệp này">${svgIcon('close')}</button>
    `;
    row.querySelector('.doc-file-desc-input').oninput = (e) => { entry.desc = e.target.value; };
    row.querySelector('.btn-remove-pending-file').onclick = () => removePendingUploadFile(i);
    container.appendChild(row);
  });
}

// Bỏ bớt 1 tệp khỏi danh sách đang chờ tải lên (trước khi bấm "Tải lên & Lưu")
function removePendingUploadFile(index) {
  pendingUploadFiles.splice(index, 1);
  renderPendingUploadFilesList();
}

function toggleCustomDocName(val, groupId = 'customDocNameGroup') {
  const customGroup = document.getElementById(groupId);
  const inputIdMap = {
    editCustomDocNameGroup: 'editDocCustomName',
    moveDocsCustomNameGroup: 'moveDocsCustomName',
    guCustomCategoryGroup: 'guCustomCategoryName'
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
function openMoveDocsModal(preselectDocType = null, preselectFolderId = null) {
  if (selectedDocIds.size === 0 && selectedFolderIds.size === 0) {
    alert('Vui lòng chọn ít nhất 1 tệp hoặc thư mục để chuyển!');
    return;
  }
  populateDocTypeSelect('moveDocsTypeSelect');
  const typeSelect = document.getElementById('moveDocsTypeSelect');
  const customNameInput = document.getElementById('moveDocsCustomName');
  const knownTypes = Array.from(typeSelect.options).map(o => o.value);
  const defaultType = (preselectDocType && knownTypes.includes(preselectDocType)) ? preselectDocType : 'Định danh & Tùy thân';
  typeSelect.value = defaultType;
  customNameInput.value = '';
  toggleCustomDocName(typeSelect.value, 'moveDocsCustomNameGroup');
  populateMoveFolderSelect(defaultType);
  const folderSelect = document.getElementById('moveDocsFolderSelect');
  if (folderSelect && preselectFolderId) folderSelect.value = preselectFolderId;
  const summaryParts = [];
  if (selectedDocIds.size > 0) summaryParts.push(`${selectedDocIds.size} tệp`);
  if (selectedFolderIds.size > 0) summaryParts.push(`${selectedFolderIds.size} thư mục`);
  document.getElementById('moveDocsSummary').innerText = `Đã chọn ${summaryParts.join(' và ')}.`;
  document.getElementById('moveDocsModal').classList.remove('hidden');
}

function closeMoveDocsModal() {
  document.getElementById('moveDocsModal').classList.add('hidden');
}

// Thêm các <option> thư mục con (thụt lề theo cấp lồng nhau) của 1 danh mục vào 1 thẻ <select>
function appendFolderTreeOptions(select, folders, docType) {
  const addChildren = (parentId, depth) => {
    (folders || [])
      .filter(f => f.docType === docType && (f.parentId || null) === (parentId || null))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
      .forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${'—'.repeat(depth + 1)} 📂 ${f.name}`;
        select.appendChild(opt);
        addChildren(f.id, depth + 1);
      });
  };
  addChildren(null, 0);
}

// Khi đổi danh mục đích: đồng bộ ô "loại giấy tờ mới" và danh sách thư mục con tương ứng
function onMoveDocsTypeChange(val) {
  toggleCustomDocName(val, 'moveDocsCustomNameGroup');
  populateMoveFolderSelect(val === 'custom' ? null : val);
}

// Dựng danh sách thư mục con (theo cây, thụt lề dần) của 1 danh mục để chọn làm đích chuyển tệp
function populateMoveFolderSelect(docType) {
  const select = document.getElementById('moveDocsFolderSelect');
  const group = document.getElementById('moveDocsFolderGroup');
  if (!select || !group) return;

  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !docType) {
    group.classList.add('hidden');
    select.innerHTML = '';
    return;
  }

  group.classList.remove('hidden');
  select.innerHTML = '';
  const rootOpt = document.createElement('option');
  rootOpt.value = '';
  rootOpt.textContent = '(Thư mục gốc của danh mục)';
  select.appendChild(rootOpt);
  appendFolderTreeOptions(select, m.folders, docType);
}

// ============================================================
// MODAL TẢI NHANH (FAB): chụp/chọn ảnh giấy tờ từ bất kỳ màn hình nào, chọn nhanh
// chủ sở hữu (kể cả "Hồ sơ chung gia đình"), gắn tag đa thành viên, chọn/tạo mới
// danh mục + thư mục con ngay tại chỗ.
// ============================================================

function openGlobalUploadModal() {
  populateGlobalOwnerSelect();
  document.getElementById('guOwnerSelect').value = FAMILY_SHARED_ID;

  globalSelectedTags = [];
  document.getElementById('guCustomTagInput').value = '';
  renderGlobalTagPicker();

  globalUploadFile = null;
  document.getElementById('guFileInput').value = '';
  document.getElementById('guFilePreview').innerHTML = '';
  document.getElementById('guDesc').value = '';

  populateDocTypeSelect('guCategorySelect');
  const categorySelect = document.getElementById('guCategorySelect');
  const knownCategories = Array.from(categorySelect.options).map(o => o.value);
  if (knownCategories.includes('Định danh & Tùy thân')) categorySelect.value = 'Định danh & Tùy thân';
  toggleCustomDocName(categorySelect.value, 'guCustomCategoryGroup');
  document.getElementById('guCustomCategoryName').value = '';
  populateGlobalFolderSelect(document.getElementById('guOwnerSelect').value, categorySelect.value === 'custom' ? null : categorySelect.value);
  document.getElementById('guNewFolderName').value = '';
  document.getElementById('guNewFolderNameGroup').classList.add('hidden');

  document.getElementById('globalUploadModal').classList.remove('hidden');
}

function closeGlobalUploadModal() {
  document.getElementById('globalUploadModal').classList.add('hidden');
  if (globalUploadFile && globalUploadFile.previewUrl) URL.revokeObjectURL(globalUploadFile.previewUrl);
  globalUploadFile = null;
}

// Chủ sở hữu chính: Hồ sơ chung gia đình luôn đứng đầu, sau đó tới từng thành viên hiện có.
function populateGlobalOwnerSelect() {
  const select = document.getElementById('guOwnerSelect');
  if (!select) return;
  select.innerHTML = '';
  const familyOpt = document.createElement('option');
  familyOpt.value = FAMILY_SHARED_ID;
  familyOpt.textContent = FAMILY_SHARED_NAME;
  select.appendChild(familyOpt);
  displayMembers().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
}

function onGlobalOwnerChange() {
  const categorySel = document.getElementById('guCategorySelect').value;
  populateGlobalFolderSelect(document.getElementById('guOwnerSelect').value, categorySel === 'custom' ? null : categorySel);
}

function onGlobalCategoryChange(val) {
  toggleCustomDocName(val, 'guCustomCategoryGroup');
  populateGlobalFolderSelect(document.getElementById('guOwnerSelect').value, val === 'custom' ? null : val);
}

// Dựng danh sách thư mục con (tùy theo chủ sở hữu + danh mục đang chọn) cho modal Tải nhanh.
function populateGlobalFolderSelect(ownerId, docType) {
  const select = document.getElementById('guFolderSelect');
  if (!select) return;
  select.innerHTML = '';
  const rootOpt = document.createElement('option');
  rootOpt.value = '';
  rootOpt.textContent = '(Thư mục gốc của danh mục)';
  select.appendChild(rootOpt);

  const m = members.find(item => String(item.id) === String(ownerId));
  if (m && docType) appendFolderTreeOptions(select, m.folders, docType);

  const newFolderOpt = document.createElement('option');
  newFolderOpt.value = '__new__';
  newFolderOpt.textContent = '+ Tạo thư mục con mới...';
  select.appendChild(newFolderOpt);

  document.getElementById('guNewFolderNameGroup').classList.add('hidden');
}

function onGlobalFolderChange(val) {
  document.getElementById('guNewFolderNameGroup').classList.toggle('hidden', val !== '__new__');
  if (val === '__new__') document.getElementById('guNewFolderName').focus();
}

// Dropdown chọn nhanh tên thành viên để gắn tag (gọn hơn dãy chip khi nhà đông thành
// viên): chỉ liệt kê thành viên chưa được gắn tag, chọn xong tự thêm ngay và trở về gợi ý.
function renderGlobalTagPicker() {
  const select = document.getElementById('guTagMemberSelect');
  if (select) {
    select.innerHTML = '';
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = '-- Chọn thành viên để gắn thẻ --';
    select.appendChild(placeholderOpt);
    displayMembers()
      .filter(m => !globalSelectedTags.includes(m.name))
      .forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        select.appendChild(opt);
      });
  }
  renderGlobalSelectedTags();
}

function addGlobalMemberTag(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  if (!globalSelectedTags.includes(trimmed)) globalSelectedTags.push(trimmed);
  renderGlobalTagPicker();
}

function addGlobalCustomTag() {
  const input = document.getElementById('guCustomTagInput');
  const value = input.value.trim();
  if (!value) return;
  if (!globalSelectedTags.includes(value)) globalSelectedTags.push(value);
  input.value = '';
  renderGlobalTagPicker();
  input.focus();
}

function handleGlobalTagInputKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addGlobalCustomTag();
  }
}

function removeGlobalTag(name) {
  globalSelectedTags = globalSelectedTags.filter(t => t !== name);
  renderGlobalTagPicker();
}

// Danh sách các tag đã chọn, mỗi tag kèm nút "x" để xoá.
function renderGlobalSelectedTags() {
  const wrap = document.getElementById('guSelectedTags');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (globalSelectedTags.length === 0) {
    wrap.innerHTML = '<span style="color:var(--text-muted); font-size:0.78rem;">Chưa gắn thẻ nào.</span>';
    return;
  }
  globalSelectedTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.innerHTML = `${escapeHtml(tag)} <button type="button" aria-label="Xóa thẻ ${escapeHtml(tag)}">${svgIcon('close')}</button>`;
    pill.querySelector('button').onclick = () => removeGlobalTag(tag);
    wrap.appendChild(pill);
  });
}

// Xem trước tệp vừa chọn/chụp (ảnh hiện thumbnail, PDF hiện huy hiệu)
function onGlobalFileSelected(input) {
  const file = input.files && input.files[0];
  const preview = document.getElementById('guFilePreview');
  if (globalUploadFile && globalUploadFile.previewUrl) URL.revokeObjectURL(globalUploadFile.previewUrl);
  preview.innerHTML = '';
  if (!file) {
    globalUploadFile = null;
    return;
  }
  const isPdf = (file.type || '').includes('pdf');
  if (isPdf) {
    globalUploadFile = { file, previewUrl: null };
    preview.innerHTML = '<div class="file-thumb file-thumb-pdf gu-file-thumb">PDF</div>';
  } else {
    const url = URL.createObjectURL(file);
    globalUploadFile = { file, previewUrl: url };
    preview.innerHTML = `<img src="${url}" alt="Xem trước ảnh vừa chọn" class="file-thumb gu-file-thumb">`;
  }
}