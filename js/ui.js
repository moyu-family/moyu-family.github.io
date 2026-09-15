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
  if (params.has('consolidated')) return { app: 'family', view: 'consolidated', filter: params.get('filter') || null };
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
  else if (state.view === 'documents' || state.view === 'docs') openDocsView(state.memberId, true, state.docType || null, state.folder || null);
  else if (state.view === 'consolidated') openConsolidatedView({ skipHistory: true, filter: state.filter || null });
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

// Đồng bộ các option của 1 select loại giấy tờ, giữ nguyên lựa chọn hiện tại nếu có thể.
// Nếu select có data-placeholder, luôn chèn lại tùy chọn trống ở đầu danh sách sau mỗi lần
// dựng lại, để không bị tự động rơi về mục đầu tiên.
function populateDocTypeSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previousValue = select.value;
  const placeholderLabel = select.dataset.placeholder || '';
  const customTypes = getCustomDocTypes();
  select.innerHTML = '';
  if (placeholderLabel) {
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = placeholderLabel;
    select.appendChild(placeholderOpt);
  }
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
  } else if (placeholderLabel) {
    select.value = '';
  }
}

// Đồng bộ đồng thời cả 2 select loại giấy tờ còn dùng dropdown (sửa mô tả, chuyển thư mục) -
// luồng tải lên mới (Quick Preview) không còn dropdown chọn danh mục nữa nên bỏ 'docTypeSelect'.
function refreshAllDocTypeSelects() {
  ['editDocTypeSelect', 'moveDocsTypeSelect'].forEach(populateDocTypeSelect);
}

// Hiện/ẩn ô nhập tên danh mục tự đặt (groupId) khi select tương ứng chọn "custom" - dùng chung
// cho các modal còn dropdown chọn danh mục: Sửa mô tả tệp, Chuyển tệp sang thư mục khác, Hoàn
// tất phân loại Hồ sơ tạm.
function toggleCustomDocName(val, groupId) {
  const customGroup = document.getElementById(groupId);
  if (!customGroup) return;
  const inputIdMap = {
    editCustomDocNameGroup: 'editDocCustomName',
    moveDocsCustomNameGroup: 'moveDocsCustomName',
    pdCustomCategoryGroup: 'pdCustomCategoryName'
  };
  if (val === 'custom') {
    customGroup.classList.remove('hidden');
    document.getElementById(inputIdMap[groupId])?.focus();
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
// QUICK PREVIEW & SAVE (FAB Camera): bấm FAB mở thẳng camera/trình chọn tệp; chọn/chụp
// xong mới hiện modal Xem lại nhanh để gỡ ảnh mờ/chọn nhầm, không hỏi chủ sở hữu/danh
// mục/ghi chú/gắn thẻ. Bấm "Lưu vào Hồ sơ tạm" mới chính thức ghi dữ liệu (status:
// 'pending'); bấm "Hủy" thì không ghi gì cả - xem hoàn tất phân loại sau trong "Hồ sơ tạm".
// ============================================================

// Bấm FAB: dọn sẵn danh sách tệp cũ (nếu có) rồi mở thẳng camera/trình chọn tệp của hệ
// điều hành. Modal Xem lại nhanh chỉ hiện ra sau khi onGlobalFileSelected() nhận được tệp.
function triggerGlobalUploadFab() {
  globalUploadFiles.forEach(entry => { if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); });
  globalUploadFiles = [];
  document.getElementById('guFileInput').click();
}

// Nạp tệp vừa chọn/chụp vào danh sách chờ lưu, rồi mở modal Xem lại nhanh (Quick Preview).
// Nhận diện ngay ngữ cảnh hiện tại (đang đứng trong danh mục nào, nếu có) để đổi nhãn nút Lưu
// cho đúng: "Lưu vào [Tên danh mục/thư mục]" thay vì "Lưu vào Hồ sơ tạm" mặc định.
function onGlobalFileSelected(input) {
  const newFiles = Array.from(input.files || []).map(file => {
    const isPdf = (file.type || '').includes('pdf');
    return { file, previewUrl: isPdf ? null : URL.createObjectURL(file) };
  });
  globalUploadFiles = globalUploadFiles.concat(newFiles);
  input.value = '';
  globalUploadContext = detectGlobalUploadContext();
  const saveBtn = document.getElementById('btnSaveGlobalDoc');
  if (saveBtn) saveBtn.textContent = globalUploadContext ? `Lưu vào ${globalUploadContext.label}` : 'Lưu vào Hồ sơ tạm';
  renderGlobalFilePreview();
  document.getElementById('globalUploadModal').classList.remove('hidden');
}

function closeGlobalUploadModal() {
  document.getElementById('globalUploadModal').classList.add('hidden');
  globalUploadFiles.forEach(entry => { if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl); });
  globalUploadFiles = [];
  globalUploadContext = null;
}

// Định dạng dung lượng tệp ngắn gọn (KB/MB) để hiện kèm tên trong hàng danh sách.
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Tách tên/đuôi mở rộng mà KHÔNG cắt bớt ký tự nào - dùng cho hàng danh sách, nơi CSS
// (text-overflow: ellipsis trên phần "base") tự quyết định cắt hay không tùy bề rộng
// thực tế của hàng, thay vì cắt cứng theo số ký tự cố định.
function splitFileNameExt(name) {
  const dotIndex = name.lastIndexOf('.');
  const hasExt = dotIndex > 0 && name.length - dotIndex <= 8;
  return hasExt ? { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) } : { base: name, ext: '' };
}

// Vẽ lại danh sách tệp đang chờ lưu theo cơ chế thích ứng số lượng (Adaptive Layout):
// - Đúng 1 ảnh: Single Preview - 1 thumbnail lớn, dễ nhìn rõ ảnh vừa chụp.
// - Còn lại (từ 2 tệp trở lên, HOẶC 1 tệp nhưng là PDF/tài liệu): Compact List - mỗi
//   tệp 1 hàng gọn (thân modal đã có overflow-y: auto nên cuộn được khi danh sách dài).
// Dòng phụ dưới tiêu đề báo số tệp đã chọn.
function renderGlobalFilePreview() {
  const preview = document.getElementById('guFilePreview');
  const countLabel = document.getElementById('guFileCount');
  if (!preview) return;
  preview.innerHTML = '';
  if (countLabel) {
    countLabel.textContent = globalUploadFiles.length > 0 ? `Đã chọn ${globalUploadFiles.length} tệp` : '';
  }
  if (globalUploadFiles.length === 0) {
    preview.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem; width:100%;">Chưa có ảnh nào.</div>';
    return;
  }
  const isImageEntry = entry => (entry.file.type || '').startsWith('image/');

  if (globalUploadFiles.length === 1 && isImageEntry(globalUploadFiles[0])) {
    const entry = globalUploadFiles[0];
    const size = formatFileSize(entry.file.size);
    const item = document.createElement('div');
    item.className = 'gu-single-preview';
    item.innerHTML = `
      <img src="${entry.previewUrl}" alt="Xem trước ${escapeHtml(entry.file.name)}" class="gu-single-preview-img">
      <button type="button" class="gu-single-preview-remove" aria-label="Bỏ chọn tệp ${escapeHtml(entry.file.name)}">${svgIcon('close')}</button>
      <div class="gu-single-preview-meta">
        <span class="gu-single-preview-name">${escapeHtml(entry.file.name)}</span>
        ${size ? `<span class="gu-single-preview-size">${size}</span>` : ''}
      </div>
    `;
    item.querySelector('.gu-single-preview-remove').onclick = () => removeGlobalFile(0);
    preview.appendChild(item);
    return;
  }

  globalUploadFiles.forEach((entry, i) => {
    const isImage = isImageEntry(entry);
    const { base, ext } = splitFileNameExt(entry.file.name);
    const size = formatFileSize(entry.file.size);
    const iconHtml = isImage
      ? `<img src="${entry.previewUrl}" alt="" class="gu-file-row-thumb">`
      : `<span class="gu-file-row-icon" aria-hidden="true">${svgIcon('notebook')}</span>`;
    const item = document.createElement('div');
    item.className = 'gu-file-row-item';
    item.innerHTML = `
      ${iconHtml}
      <span class="gu-file-row-info">
        <span class="gu-file-row-name" title="${escapeHtml(entry.file.name)}"><span class="gu-file-row-name-base">${escapeHtml(base)}</span><span class="gu-file-row-name-ext">${escapeHtml(ext)}</span></span>
        ${size ? `<span class="gu-file-row-size">${size}</span>` : ''}
      </span>
      <button type="button" class="gu-file-row-remove" aria-label="Bỏ chọn tệp ${escapeHtml(entry.file.name)}">${svgIcon('close')}</button>
    `;
    item.querySelector('.gu-file-row-remove').onclick = () => removeGlobalFile(i);
    preview.appendChild(item);
  });
}

// Gỡ bỏ 1 tệp khỏi danh sách đang chờ tải lên (lỡ chọn nhầm)
function removeGlobalFile(index) {
  const entry = globalUploadFiles[index];
  if (entry && entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  globalUploadFiles.splice(index, 1);
  renderGlobalFilePreview();
}
