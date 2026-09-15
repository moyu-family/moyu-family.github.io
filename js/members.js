// Biến theo dõi thư mục giấy tờ hiện tại
let currentDocsFolder = null;
let editingDocId = null;
let docsSortMode = 'date-desc'; // 'date-desc' | 'date-asc' | 'desc-asc'
let newFolderDocType = null;
let editDocEditingTags = []; // Bản nháp mảng tags (tên thành viên liên quan) đang chỉnh trong modal Sửa thông tin giấy tờ

// ============================================================
// Ô TÌM KIẾM TOÀN CỤC trên header (#globalSearchInput, xem index.html) - gõ kết hợp nhiều từ
// khóa (VD "khai sinh của Minh") vẫn ra đúng tệp dù các từ nằm rải rác ở nhiều trường khác nhau
// (tên tệp thuộc danh mục "Khai sinh" nhưng lại được gắn thẻ cho thành viên "Minh"). Cách làm:
// bỏ dấu tiếng Việt + chữ thường cả từ khóa lẫn dữ liệu tệp, bỏ qua các từ nối vô nghĩa với tìm
// kiếm, rồi yêu cầu MỌI từ khóa còn lại phải xuất hiện đâu đó trong chuỗi text hợp nhất của tệp
// (không quan tâm thứ tự/vị trí).
// ============================================================
const SEARCH_STOPWORDS = ['cua', 'va', 'cho', 'o', 'tai', 'trong'];

// Bỏ dấu tiếng Việt (kể cả "đ") rồi chuyển về chữ thường, dùng chung cho cả từ khóa gõ vào lẫn
// dữ liệu tệp để so khớp không phân biệt dấu/hoa-thường.
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Tách chuỗi tìm kiếm đã gõ thành mảng từ khóa (searchTokens), loại bỏ từ nối thông dụng và
// khoảng trắng thừa. VD: "khai sinh của Minh" -> ['khai', 'sinh', 'minh'].
function tokenizeSearchQuery(query) {
  return normalizeSearchText(query)
    .split(/[^a-z0-9]+/)
    .filter(token => token && !SEARCH_STOPWORDS.includes(token));
}

// Chuỗi tìm kiếm hợp nhất của 1 tệp: tên tệp + mô tả/ghi chú + tên danh mục + tên chủ sở hữu +
// tên những người được gắn thẻ (tags) - đã bỏ dấu + chữ thường.
function buildDocumentSearchText(doc, ownerName) {
  return normalizeSearchText(
    [doc.fileName, doc.desc, doc.docType, ownerName, ...(doc.tags || [])].filter(Boolean).join(' ')
  );
}

// Tìm trong tài liệu của TẤT CẢ thành viên (kể cả Hồ sơ chung gia đình): 1 tệp khớp nếu mọi từ
// trong searchTokens đều có mặt trong normalizedText của tệp đó. Trả về tệp kèm ownerId/ownerName
// (giống buildConsolidatedMap()/getDocumentsTaggedForMember()) để có thể điều hướng đến đúng hồ
// sơ chủ sở hữu khi bấm vào kết quả.
function searchAllDocuments(query) {
  const searchTokens = tokenizeSearchQuery(query);
  if (searchTokens.length === 0) return [];

  const results = [];
  members.forEach(owner => {
    (owner.documents || []).forEach(doc => {
      const normalizedText = buildDocumentSearchText(doc, owner.name);
      if (searchTokens.every(token => normalizedText.includes(token))) {
        results.push({ ...doc, ownerId: owner.id, ownerName: owner.name });
      }
    });
  });
  return results;
}

// Gõ vào ô tìm kiếm header -> lọc và vẽ lại danh sách kết quả thả xuống ngay bên dưới.
function onGlobalSearchInput(rawValue) {
  const clearBtn = document.getElementById('globalSearchClearBtn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !rawValue);

  const results = document.getElementById('globalSearchResults');
  if (!results) return;
  if (!rawValue.trim()) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }
  renderGlobalSearchResults(searchAllDocuments(rawValue));
}

// Vẽ danh sách kết quả (tối đa 20 tệp để tránh thả xuống quá dài) - mỗi dòng dùng icon màu theo
// đúng danh mục (đồng bộ với lưới 7 danh mục chính), kèm "Từ: <chủ sở hữu>" để biết tệp thuộc hồ
// sơ ai trước khi bấm vào.
function renderGlobalSearchResults(matches) {
  const results = document.getElementById('globalSearchResults');
  if (!results) return;
  results.innerHTML = '';

  if (matches.length === 0) {
    results.innerHTML = '<div class="header-search-empty">Không tìm thấy tệp nào phù hợp.</div>';
  } else {
    matches.slice(0, 20).forEach(doc => {
      const label = doc.desc || doc.fileName || 'Chưa có mô tả';
      const defaultCat = DEFAULT_CATEGORIES.find(c => c.key === doc.docType);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'header-search-result-item';
      item.innerHTML = `
        <span class="category-icon-box${defaultCat ? ' ' + defaultCat.colorClass : ''}">${svgIcon(defaultCat ? defaultCat.icon : 'folder')}</span>
        <span class="header-search-result-info">
          <strong>${escapeHtml(label)}</strong>
          <span class="header-search-result-meta">${escapeHtml(doc.docType || 'Giấy tờ khác')} · Từ: ${escapeHtml(doc.ownerName || 'Không rõ')}</span>
        </span>
      `;
      item.onclick = () => openGlobalSearchResult(doc);
      results.appendChild(item);
    });
  }
  results.classList.remove('hidden');
}

// Bấm vào 1 kết quả: đóng ô tìm kiếm, mở đúng màn hình danh mục của chủ sở hữu rồi mở luôn modal
// xem trước tệp đó (giống hành vi nút "Đến hồ sơ chủ sở hữu" ở thẻ tài liệu được gắn thẻ).
function openGlobalSearchResult(doc) {
  clearGlobalSearch();
  openDocsView(doc.ownerId, false, doc.docType, doc.folderId || null);
  showDocumentPreview(doc, [doc]);
}

function clearGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('globalSearchClearBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  const results = document.getElementById('globalSearchResults');
  if (results) {
    results.classList.add('hidden');
    results.innerHTML = '';
  }
}

function setMemberManagementButtonVisible(visible) {
  ['btnSummaryTable', 'btnAddMember'].forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) button.classList.toggle('hidden', !visible);
  });
}

// Ẩn hoàn toàn thao tác tải lên (nút Header + FAB nổi) khi đang ở màn hình gốc "Tất cả danh
// mục" của 1 chủ sở hữu (renderDocsFolders()) - vì chưa xác định được danh mục đích nên không
// cho phép upload ở đây. Hiện lại ngay khi vào chi tiết 1 danh mục (openFolderDetails()) hoặc
// bất kỳ màn hình nào khác ngoài Hồ sơ giấy tờ (trang chủ, Hồ sơ tổng hợp, ...).
function setDocsUploadControlsVisible(visible) {
  const headerBtn = document.getElementById('docsUploadHeaderBtn');
  const fab = document.getElementById('globalUploadFab');
  if (headerBtn) headerBtn.classList.toggle('hidden', !visible);
  if (fab) fab.classList.toggle('hidden', !visible);
}

// Kéo thả đổi thứ tự thẻ thành viên: nhấp-giữ-kéo trên máy tính, nhấn giữ ~300ms
// rồi kéo trên cảm ứng (delayOnTouchOnly để không cản việc cuộn trang bằng ngón tay).
function initSortable() {
  const grid = document.getElementById('memberGrid');
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  if (typeof Sortable !== 'undefined') {
    sortableInstance = new Sortable(grid, {
      animation: 200,
      delay: 300,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      ghostClass: 'sortable-ghost',
      chosenClass: 'member-card-chosen',
      dragClass: 'member-card-dragging',
      onChoose: function () {
        if (navigator.vibrate) navigator.vibrate(15);
      },
      onEnd: async function () {
        const cardElements = grid.querySelectorAll('.member-card');
        const newOrderedIds = Array.from(cardElements).map(el => el.getAttribute('data-id'));
        members.sort((a, b) => newOrderedIds.indexOf(a.id) - newOrderedIds.indexOf(b.id));
        try {
          await pushToFirebase();
        } catch (e) {
          alert('Không thể lưu thứ tự mới: ' + e.message);
        }
      }
    });
  }
}

// Bảng tổng hợp[cite: 3]
function openSummaryTable(skipHistory = false) {
  setMemberManagementButtonVisible(false);
  if (!skipHistory) {
    navigateApp('summary');
    return;
  }
  const targetMembers = displayMembers();

  const tbody = document.getElementById('summaryTableBody');
  tbody.innerHTML = '';

  targetMembers.forEach((m, idx) => {
    const bankDetails = (m.banks && m.banks.length > 0)
      ? m.banks.map(b => `<strong>${escapeHtml(b.bankName || 'Ngân hàng')}:</strong> ${escapeHtml(b.accNum || '')}`).join('<br>')
      : '-';

    const roleText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
    const hasNote = m.notes && m.notes.trim() !== '' && m.notes !== '<br>' && m.notes !== '<div><br></div>';

    const noteBtnHtml = hasNote
      ? `<button type="button" class="btn-eye" title="Bấm để xem ghi chú" data-name="${escapeHtml(m.name || '')}" data-id="${m.id}">${svgIcon('eye')}</button>`
      : `<span style="color:var(--text-muted); opacity: 0.5;">-</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td><strong>${escapeHtml(m.name || '-')}</strong></td>
      <td>${m.phone ? `<a class="phone-link" href="tel:${escapeHtml(m.phone)}">${escapeHtml(m.phone)}</a>` : '-'}</td>
      <td>${escapeHtml(roleText)}</td>
      <td>${escapeHtml(m.dob || '-')}</td>
      <td>${escapeHtml(m.pob || '-')}</td>
      <td>${escapeHtml(m.cccd || '-')}</td>
      <td>${escapeHtml(m.cccdDate || '-')}</td>
      <td>${escapeHtml(m.bhyt || '-')}</td>
      <td>${escapeHtml(m.bhxh || '-')}</td>
      <td>${escapeHtml(m.tax || '-')}</td>
      <td>${escapeHtml(m.specialCode || '-')}</td>
      <td>${bankDetails}</td>
      <td style="text-align:center; vertical-align: middle;">${noteBtnHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-eye').forEach(btn => {
    btn.onclick = () => {
      showNoteModal(btn.getAttribute('data-name'), btn.getAttribute('data-id'));
    };
  });

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  document.getElementById('tableView').classList.remove('hidden');
  setDocsUploadControlsVisible(true);
}

// Sao chép bảng cho Excel[cite: 3]
function copyTableData() {
  const targetMembers = displayMembers();

  const headers = ["STT", "Họ và Tên", "Số điện thoại", "Đối tượng", "Ngày sinh", "Nơi sinh", "Số CCCD", "Ngày cấp", "BHYT", "Mã số BHXH", "Mã số thuế", "Mã HS / NV", "Tài khoản ngân hàng", "Ghi chú"];
  let text = headers.join('\t') + '\n';

  targetMembers.forEach((m, idx) => {
    const bankDetails = (m.banks || []).map(b => `${b.bankName}: ${b.accNum}`).join(' - ');
    const roleText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = m.notes || '';
    const plainNotes = tempDiv.innerText.replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');

    const row = [
      idx + 1,
      `"${m.name || ''}"`,
      `="${m.phone || ''}"`,
      roleText,
      m.dob || '',
      `"${m.pob || ''}"`,
      `="${m.cccd || ''}"`,
      m.cccdDate || '',
      `="${m.bhyt || ''}"`,
      `="${m.bhxh || ''}"`,
      `="${m.tax || ''}"`,
      `"${m.specialCode || ''}"`,
      `"${bankDetails}"`,
      `"${plainNotes}"`
    ];
    text += row.join('\t') + '\n';
  });

  navigator.clipboard.writeText(text).then(() => {
    alert('Đã sao chép bảng thành công! Bạn có thể dán trực tiếp vào Excel hoặc Google Sheets.');
  }).catch(() => {
    alert('Không thể tự động sao chép, vui lòng thử lại.');
  });
}

// Render danh sách thẻ[cite: 3]
function renderGrid() {
  const grid = document.getElementById('memberGrid');
  grid.innerHTML = '';
  const gridMembers = displayMembers();
  const sectionTitle = document.getElementById('memberSectionTitle');
  if (sectionTitle) sectionTitle.textContent = `Thành viên gia đình (${gridMembers.length})`;
  if (gridMembers.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">Chưa có thành viên nào. Bấm "+ Thêm thành viên" để bắt đầu!</div>';
    return;
  }

  gridMembers.forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.setAttribute('data-id', m.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Xem hồ sơ ${m.name || 'thành viên'}`);

    const openMember = () => navigateApp('member', { id: m.id });
    card.onclick = openMember;
    card.onkeydown = (e) => {
      if (e.target !== card) return; // không kích hoạt khi phím bấm đến từ ảnh đại diện lồng bên trong
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMember(); }
    };

    const avatarSrc = m.avatar || DEFAULT_AVATAR;

    card.innerHTML = `
      <div class="avatar-wrap">
        <img src="${escapeHtml(avatarSrc)}" onerror="this.src=DEFAULT_AVATAR" tabindex="0" role="button" aria-label="Xem ảnh đại diện ${escapeHtml(m.name || '')}">
      </div>
      <div class="member-name">${escapeHtml(m.name || '-')}</div>
    `;
    const avatarImg = card.querySelector('.avatar-wrap img');
    const openAvatar = (e) => {
      e.stopPropagation();
      showImageModal(avatarImg.src, m.name || 'Ảnh đại diện');
    };
    avatarImg.onclick = openAvatar;
    avatarImg.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAvatar(e); }
    };
    grid.appendChild(card);
  });

  initSortable();
}

function connectDocumentField(fieldId, member, documentTypes, tooltip) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const documentItem = (member.documents || []).find(document =>
    documentTypes.some(type => String(document.docType || '').toLowerCase().includes(type))
  );
  field.classList.toggle('has-document', Boolean(documentItem));
  field.title = documentItem ? tooltip : '';
  field.setAttribute('aria-label', documentItem ? tooltip : '');
  field.onclick = () => {
    if (!documentItem) return;
    showDocumentPreview(documentItem);
  };
  field.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') field.click();
  };
}

function renderPhoneField(elementId, phone, contactName) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const value = String(phone || '').trim();
  const field = element.closest('.phone-info-item');
  if (field) {
    const tooltip = value ? `Gọi cho ${contactName || 'liên hệ này'}` : '';
    field.classList.toggle('has-phone', Boolean(value));
    field.title = tooltip;
    field.setAttribute('aria-label', tooltip);
  }
  element.innerHTML = value
    ? `<a class="phone-link" href="tel:${escapeHtml(value)}">${escapeHtml(value)}</a>`
    : '-';
}

// Hiển thị chi tiết
function viewDetails(id, skipHistory = false) {
  const targetId = id || currentMemberId;
  const m = members.find(item => String(item.id) === String(targetId));
  if (!m) {
    showHome(true);
    return;
  }
  setMemberManagementButtonVisible(false);
  currentMemberId = m.id;
  if (!skipHistory) pushAppHistory('member', { memberId: m.id });

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
  setDocsUploadControlsVisible(true);

  document.getElementById('dtAvatar').src = m.avatar || DEFAULT_AVATAR;
  document.getElementById('dtName').innerText = m.name;
  document.getElementById('dtEmail').innerText = m.email || '-';
  renderPhoneField('dtPhone', m.phone, m.name);
  document.getElementById('dtSchoolClass').innerText = m.schoolClass || '-';
  document.getElementById('dtChildCode').innerText = m.specialCode || '-';
  renderPhoneField('dtTeacherPhone', m.teacherPhone, m.teacherName || 'cô chủ nhiệm');
  document.getElementById('dtTeacherName').innerText = m.teacherName || '-';
  document.querySelectorAll('.child-detail-field').forEach(field => field.classList.toggle('hidden', m.type !== 'child'));
  document.querySelectorAll('.adult-detail-field').forEach(field => field.classList.toggle('hidden', m.type !== 'adult'));
  document.getElementById('dtDob').innerText = m.dob || '-';
  document.getElementById('dtPob').innerText = m.pob || '-';
  document.getElementById('dtCccd').innerText = m.cccd || '-';
  document.getElementById('dtCccdDate').innerText = m.cccdDate || '-';
  document.getElementById('dtBhyt').innerText = m.bhyt || '-';
  document.getElementById('dtBhxh').innerText = m.bhxh || '-';
  connectDocumentField('dtCccdField', m, ['cccd', 'định danh'], 'Xem hình ảnh CCCD');
  connectDocumentField('dtCccdDateField', m, ['cccd', 'định danh'], 'Xem hình ảnh CCCD');
  connectDocumentField('dtBhytField', m, ['bhyt', 'bảo hiểm y tế'], 'Xem hình ảnh BHYT');
  connectDocumentField('dtBhxhField', m, ['bhxh', 'bảo hiểm xã hội'], 'Xem hình ảnh BHXH');
  document.getElementById('dtTax').innerText = m.tax || '-';

  const notesEl = document.getElementById('dtNotes');
  if (m.notes && m.notes.trim() !== '') notesEl.innerHTML = sanitizeRichText(m.notes);
  else notesEl.innerText = 'Chưa có ghi chú nào.';

  document.getElementById('specialLabel').innerText = m.type === 'child' ? 'Mã học sinh' : 'Mã nhân viên';
  document.getElementById('specialVal').innerText = m.specialCode || '-';

  const bList = document.getElementById('dtBanks');
  bList.innerHTML = '';
  if (m.banks && m.banks.length > 0) {
    const container = document.createElement('div');
    container.className = 'bank-list-container';
    m.banks.forEach(b => {
      const bankRow = document.createElement('div');
      bankRow.className = 'bank-row';
      const bankLogo = b.bankName?.toLowerCase() === 'agribank' || b.logo?.includes('/AGR.png')
        ? 'https://cdn.vietqr.io/img/VBA.png'
        : (b.logo || DEFAULT_BANK_LOGO);
      bankRow.innerHTML = `
        <img class="bank-logo-sm" src="${escapeHtml(bankLogo)}" title="${escapeHtml(b.bankName || 'Ngân hàng')}" alt="Logo ${escapeHtml(b.bankName || 'ngân hàng')}" onerror="this.src=DEFAULT_BANK_LOGO">
        <div class="bank-row-info">
          <div class="bank-row-name">${escapeHtml(b.bankName || 'Ngân hàng')}</div>
          <div class="bank-row-acc">STK: ${escapeHtml(b.accNum || '')}</div>
        </div>
        <div class="bank-row-actions">
          <button type="button" class="btn-qr-pastel">${iconSpan('qr')}Xem mã QR</button>
          <button type="button" class="btn-copy-acc" title="Sao chép số tài khoản" aria-label="Sao chép số tài khoản">${svgIcon('copy')}</button>
        </div>
      `;
      bankRow.querySelector('.btn-qr-pastel').onclick = () => {
        showQrModal(b.bankName || '', b.accNum || '', b.qrUrl || '', m.name || '');
      };
      bankRow.querySelector('.btn-copy-acc').onclick = () => {
        const accNum = b.accNum || '';
        if (!accNum) return;
        navigator.clipboard.writeText(accNum).then(() => {
          showToast('Đã sao chép số tài khoản!');
        }).catch(() => {
          showToast('Không thể sao chép, vui lòng thử lại.');
        });
      };
      container.appendChild(bankRow);
    });
    bList.appendChild(container);
  } else {
    bList.innerHTML = '<div style="color:var(--text-muted); font-size:0.88rem;">Chưa có tài khoản ngân hàng nào.</div>';
  }
}

function previewAvatar(input) {
  const file = input.files && input.files[0];
  const preview = document.getElementById('fAvatarPreview');
  if (!file || !preview) return;
  preview.src = URL.createObjectURL(file);
}

function previewAvatarUrl(input) {
  const preview = document.getElementById('fAvatarPreview');
  const fileInput = document.getElementById('fAvatar');
  if (!preview || (fileInput.files && fileInput.files.length > 0)) return;
  preview.src = input.value.trim() || DEFAULT_AVATAR;
}

function showHome(skipHistory = false) {
  setMemberManagementButtonVisible(true);
  if (!skipHistory) replaceAppHistory('home');
  document.getElementById('homeView').classList.remove('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  setDocsUploadControlsVisible(true);
  renderGrid();
}

function openForm(member = null, skipHistory = false) {
  setMemberManagementButtonVisible(false);
  if (!skipHistory) pushAppHistory('form', member ? { memberId: member.id } : {});
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  document.getElementById('formView').classList.remove('hidden');
  setDocsUploadControlsVisible(true);

  const notesGroup = document.querySelector('.form-notes-group');
  const bankGroup = document.querySelector('.form-bank-group');
  if (notesGroup && bankGroup) notesGroup.parentNode.insertBefore(bankGroup, notesGroup);

  const form = document.getElementById('memberForm');
  form.reset();
  document.getElementById('bankInputs').innerHTML = '';
  document.getElementById('fAvatarPreview').src = DEFAULT_AVATAR;

  if (member) {
    document.getElementById('formHeading').innerText = 'Chỉnh sửa thông tin';
    document.getElementById('fId').value = member.id;
    document.getElementById('fType').value = member.type;
    document.getElementById('fName').value = member.name;
    document.getElementById('fEmail').value = member.email || '';
    document.getElementById('fPhone').value = member.phone || '';
    document.getElementById('fSchoolClass').value = member.schoolClass || '';
    document.getElementById('fSpecialCodeChild').value = member.specialCode || '';
    document.getElementById('fTeacherPhone').value = member.teacherPhone || '';
    document.getElementById('fTeacherName').value = member.teacherName || '';
    document.getElementById('fAvatarUrl').value = member.avatar && !member.avatar.startsWith('data:') ? member.avatar : '';
    document.getElementById('fAvatarPreview').src = member.avatar || DEFAULT_AVATAR;
    document.getElementById('fDob').value = member.dob || '';
    document.getElementById('fPob').value = member.pob;
    document.getElementById('fCccd').value = member.cccd;
    document.getElementById('fCccdDate').value = member.cccdDate || '';
    document.getElementById('fBhyt').value = member.bhyt;
    document.getElementById('fBhxh').value = member.bhxh || '';
    document.getElementById('fTax').value = member.tax;
    document.getElementById('fSpecialCode').value = member.specialCode;
    document.getElementById('fNotesEditor').innerHTML = sanitizeRichText(member.notes || '');

    if (member.banks) member.banks.forEach(b => addBankRow(b.bankName, b.accNum, b.logo));
  } else {
    document.getElementById('formHeading').innerText = 'Thêm thành viên mới';
    document.getElementById('fId').value = '';
    document.getElementById('fEmail').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fSchoolClass').value = '';
    document.getElementById('fSpecialCodeChild').value = '';
    document.getElementById('fTeacherPhone').value = '';
    document.getElementById('fTeacherName').value = '';
    document.getElementById('fBhxh').value = '';
    document.getElementById('fNotesEditor').innerHTML = '';
  }
  toggleSpecialInput();
}

function toggleSpecialInput() {
  const type = document.getElementById('fType').value;
  document.getElementById('fSpecialLabel').innerText = type === 'child' ? 'Mã học sinh' : 'Mã nhân viên';
  document.querySelectorAll('.child-only-field').forEach(field => field.classList.toggle('hidden', type !== 'child'));
  document.querySelectorAll('.adult-only-field').forEach(field => field.classList.toggle('hidden', type !== 'adult'));
}

function addBankRow(name = '', acc = '', logo = '') {
  const wrap = document.getElementById('bankInputs');
  const div = document.createElement('div');
  div.className = 'bank-edit-row';

  let optionsHtml = `<option value="">-- Chọn ngân hàng --</option>`;
  customBankList.forEach(b => {
    const isSel = b.name.toLowerCase() === name.toLowerCase();
    optionsHtml += `<option value="${b.name}" data-logo="${b.logo}" ${isSel ? 'selected' : ''}>${b.name}</option>`;
  });

  if (name && !customBankList.some(b => b.name.toLowerCase() === name.toLowerCase())) {
    optionsHtml += `<option value="${name}" data-logo="${logo}" selected>${name}</option>`;
  }

  const currentLogo = logo || (customBankList.find(b => b.name.toLowerCase() === name.toLowerCase()) || {}).logo || DEFAULT_BANK_LOGO;

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div class="bank-edit-preview">
        <img class="bank-edit-logo-preview" src="${currentLogo}" onerror="this.src=DEFAULT_BANK_LOGO">
      </div>
      <button type="button" class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="removeBankRow(this)">${iconSpan('trash')}Xóa tài khoản này</button>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
      <div>
        <label style="font-size:0.75rem;">Ngân hàng</label>
        <select class="b-select" onchange="onBankSelectChange(this)">
          ${optionsHtml}
        </select>
      </div>
      <div>
        <label style="font-size:0.75rem;">Số tài khoản</label>
        <input type="text" placeholder="Nhập STK..." value="${acc}" class="b-acc">
      </div>
    </div>

    <input type="hidden" class="b-logo" value="${currentLogo}">
  `;
  wrap.appendChild(div);
}

function onBankSelectChange(selectEl) {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const logoUrl = selectedOption.getAttribute('data-logo') || DEFAULT_BANK_LOGO;
  const row = selectEl.closest('.bank-edit-row');
  row.querySelector('.b-logo').value = logoUrl;
  row.querySelector('.bank-edit-logo-preview').src = logoUrl;
}

function removeBankRow(btn) {
  if (confirm('Bạn có chắc chắn muốn xóa tài khoản ngân hàng này khỏi hồ sơ?')) {
    btn.closest('.bank-edit-row').remove();
  }
}

// Lưu thông tin
async function saveMember(e) {
  e.preventDefault();
  const dobVal = document.getElementById('fDob').value.trim();
  const cccdDateVal = document.getElementById('fCccdDate').value.trim();

  if (!isValidDateVN(dobVal)) { alert('Ngày sinh không đúng định dạng dd/mm/yyyy'); return; }
  if (!isValidDateVN(cccdDateVal)) { alert('Ngày cấp CCCD không đúng định dạng dd/mm/yyyy'); return; }

  const id = document.getElementById('fId').value || Date.now().toString();
  const avatarInput = document.getElementById('fAvatar');
  const avatarFile = avatarInput.files && avatarInput.files[0];
  const avatarUrl = document.getElementById('fAvatarUrl').value.trim();
  if (avatarFile && avatarFile.size > 10 * 1024 * 1024) {
    alert('Ảnh đại diện không được vượt quá 10MB.');
    return;
  }
  const saveButtons = document.querySelectorAll('#memberForm button[type="submit"], button[form="memberForm"]');
  if (Array.from(saveButtons).some(button => button.disabled)) return;
  saveButtons.forEach(button => { button.disabled = true; });

  let avatarData = '';
  if (avatarFile) {
    try {
      avatarData = await uploadFileToStorage(avatarFile, `avatars/${id}`);
    } catch (err) {
      alert(err.message);
      saveButtons.forEach(button => { button.disabled = false; });
      return;
    }
  } else if (avatarUrl) {
    avatarData = avatarUrl;
  } else {
    const existingMember = members.find(m => String(m.id) === String(id));
    avatarData = existingMember ? existingMember.avatar || '' : '';
    if (avatarData.startsWith('data:')) {
      try {
        avatarData = await uploadFileToStorage(dataUrlToBlob(avatarData), `avatars/${id}`);
      } catch (err) {
        alert(err.message);
        saveButtons.forEach(button => { button.disabled = false; });
        return;
      }
    }
  }

  const bankRows = document.querySelectorAll('.bank-edit-row');
  const banks = [];

  bankRows.forEach(row => {
    const bankName = row.querySelector('.b-select').value.trim();
    const accNum = row.querySelector('.b-acc').value.trim();
    const logo = row.querySelector('.b-logo').value.trim();
    if (bankName && accNum) {
      banks.push({ bankName, accNum, logo });
    }
  });

  const notesHtml = sanitizeRichText(document.getElementById('fNotesEditor').innerHTML.trim());

  const memberObj = {
    id: id,
    type: document.getElementById('fType').value,
    name: document.getElementById('fName').value,
    email: document.getElementById('fEmail').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    schoolClass: document.getElementById('fSchoolClass').value.trim(),
    teacherPhone: document.getElementById('fTeacherPhone').value.trim(),
    teacherName: document.getElementById('fTeacherName').value.trim(),
    avatar: avatarData,
    dob: dobVal,
    pob: document.getElementById('fPob').value,
    cccd: document.getElementById('fCccd').value,
    cccdDate: cccdDateVal,
    bhyt: document.getElementById('fBhyt').value,
    bhxh: document.getElementById('fBhxh').value.trim(),
    tax: document.getElementById('fTax').value,
    specialCode: document.getElementById('fType').value === 'child'
      ? document.getElementById('fSpecialCodeChild').value.trim()
      : document.getElementById('fSpecialCode').value.trim(),
    notes: notesHtml,
    banks: banks
  };

  const idx = members.findIndex(m => String(m.id) === String(id));
  const previousName = idx >= 0 ? members[idx].name : null;
  if (idx >= 0) {
    memberObj.documents = members[idx].documents || [];
    for (const doc of memberObj.documents) {
      if (!doc.data || !doc.data.startsWith('data:')) continue;
      try {
        doc.data = await uploadEncryptedFileToStorage(
          dataUrlToBlob(doc.data),
          `documents/${id}/${doc.id}-${doc.fileName || 'document'}`
        );
        doc.encrypted = true;
      } catch (err) {
        alert(err.message);
        saveButtons.forEach(button => { button.disabled = false; });
        return;
      }
    }
    members[idx] = memberObj;
  } else {
    memberObj.documents = [];
    members.push(memberObj);
  }

  // Đổi tên thành viên: các tag tự do gắn trên tài liệu (của bất kỳ ai) tham chiếu tên cũ
  // phải đổi theo tên mới, nếu không sẽ thành tag "mồ côi" trỏ tới cái tên không còn tồn tại.
  if (previousName && previousName !== memberObj.name) {
    renameMemberNameInTags(previousName, memberObj.name);
  }

  const btn = document.getElementById('btnSaveMember');
  btn.innerText = avatarFile ? 'Đang tải ảnh & lưu hồ sơ...' : 'Đang lưu hồ sơ...';
  try {
    await pushToFirebase();
    alert('Đã lưu hồ sơ thành công!');
    viewDetails(id, true);
  } catch (err) {
    alert('Lỗi lưu dữ liệu: ' + err.message);
  } finally {
    btn.innerText = 'Lưu hồ sơ';
    saveButtons.forEach(button => { button.disabled = false; });
  }
}

function cancelForm() {
  goBackInApp();
}

function editCurrentMember() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (m) openForm(m);
}

// Đổi tên (hoặc xóa hẳn, khi newName rỗng) 1 tag tự do khỏi tags[] của mọi tài liệu, trên
// mọi thành viên - dùng khi đổi tên/xóa thành viên để tag không bị "mồ côi" trỏ tới tên cũ.
function renameMemberNameInTags(oldName, newName = null) {
  if (!oldName) return;
  members.forEach(m => {
    (m.documents || []).forEach(d => {
      if (!Array.isArray(d.tags) || !d.tags.includes(oldName)) return;
      d.tags = newName
        ? d.tags.map(tag => tag === oldName ? newName : tag)
        : d.tags.filter(tag => tag !== oldName);
    });
  });
}

async function deleteCurrentMember() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  const name = (m && m.name) ? m.name : 'này';
  if (confirm(`Bạn có chắc chắn muốn xóa thành viên "${name}" và toàn bộ hồ sơ liên quan?`)) {
    members = members.filter(item => String(item.id) !== String(currentMemberId));
    // Xóa luôn tag mang tên thành viên này khỏi tài liệu của người khác, tránh để lại tag mồ côi.
    if (m && m.name) renameMemberNameInTags(m.name, null);
    try {
      await pushToFirebase();
      navigateApp('home');
    } catch (err) {
      alert('Lỗi xóa dữ liệu: ' + err.message);
    }
  }
}

// ============================================================
// LOGIC FILE EXPLORER: QUẢN LÝ THƯ MỤC & FILE CHI TIẾT
// ============================================================

// Mở màn hình Hồ sơ cá nhân. docType/folderId (tùy chọn): mở thẳng đúng danh mục/thư mục con
// chứa 1 tệp cụ thể (dùng khi bấm mũi tên "Đến hồ sơ thành viên" từ Hồ sơ tổng hợp) thay vì
// luôn về màn hình gốc "Tất cả danh mục".
function openDocsView(memberId = null, skipHistory = false, docType = null, folderId = null) {
  const targetId = memberId || currentMemberId;
  const m = members.find(item => String(item.id) === String(targetId));
  if (!m) {
    alert('Không tìm thấy thông tin thành viên!');
    showHome(true);
    return;
  }
  setMemberManagementButtonVisible(false);
  currentMemberId = targetId;
  if (!skipHistory) {
    navigateApp('documents', { id: targetId, docType, folder: folderId });
    return;
  }

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  document.getElementById('docsView').classList.remove('hidden');
  // Không set trạng thái nút tải lên/nút "Chọn nhiều tệp" ở đây - renderDocsFolders()/
  // openFolderDetails() (được gọi ngay bên dưới) sẽ tự quyết định ẩn/hiện đúng theo màn hình
  // gốc hay chi tiết danh mục.

  isDocSelectMode = false;
  selectedDocIds.clear();
  selectedFolderIds.clear();
  document.getElementById('docsBatchToolbar').classList.add('hidden');

  document.getElementById('docsOwnerName').querySelector('.btn-text').innerText =
    m.id === FAMILY_SHARED_ID ? m.name : `Giấy tờ cá nhân: ${m.name}`;
  if (docType) openFolderDetails(docType, folderId || null);
  else renderDocsFolders();
}

// Banner "Hồ sơ chung gia đình" trên trang chủ: mở thẳng Hồ sơ giấy tờ của Hồ sơ chung
// gia đình (member ảo dùng chung), tạo mới trong bộ nhớ nếu đây là lần đầu truy cập.
function openFamilySharedDocs() {
  ensureFamilySharedMember();
  navigateApp('documents', { id: FAMILY_SHARED_ID });
}

// ============================================================
// LOGIC HỒ SƠ TỔNG HỢP: tổng hợp toàn bộ giấy tờ của mọi thành viên theo danh mục
// ============================================================

let currentConsolidatedCategory = null;

// opts: booleano cũ `skipHistory` (tương thích ngược) hoặc object { skipHistory, filter }.
// filter: 'pending' để mở thẳng danh sách "Hồ sơ tạm" đã lọc sẵn (VD: từ nút #btnPendingDocs
// trên Header, hoặc URL ?consolidated=1&filter=pending).
function openConsolidatedView(opts = false) {
  const { skipHistory = false, filter = null } = typeof opts === 'object' && opts !== null ? opts : { skipHistory: opts };
  setMemberManagementButtonVisible(false);
  if (!skipHistory) {
    navigateApp('consolidated', filter ? { filter } : {});
    return;
  }

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.remove('hidden');
  setDocsUploadControlsVisible(true);

  if (filter === 'pending') {
    currentConsolidatedTagFilter = { kind: 'pending' };
    renderConsolidatedPendingList();
  } else {
    currentConsolidatedTagFilter = null;
    renderConsolidatedCategories();
  }
}

// Nút "Quay lại" trong Hồ sơ tổng hợp: nếu đang xem "Hồ sơ tạm" hoặc chi tiết 1 danh mục thì
// quay lại danh sách danh mục, nếu đang ở danh sách danh mục thì quay lại trang trước đó
// (lịch sử trình duyệt).
function goBackFromConsolidatedView() {
  if (currentConsolidatedTagFilter?.kind === 'pending') {
    currentConsolidatedTagFilter = null;
    renderConsolidatedCategories();
  } else if (currentConsolidatedCategory) renderConsolidatedCategories();
  else goBackInApp();
}

// Gom toàn bộ tệp giấy tờ của tất cả thành viên thành 1 map: docType -> [ {...doc, ownerId, ownerName} ]
// filterFn (tùy chọn): nhận vào 1 tệp đã gắn ownerId/ownerName, trả về false để loại khỏi map
// (dùng cho bộ lọc theo tag/thành viên/Hồ sơ chung gia đình trong màn hình tổng hợp).
function buildConsolidatedMap(filterFn = null) {
  const map = {};
  members.filter(m => m.id !== UNASSIGNED_OWNER_ID).forEach(m => {
    (m.documents || []).forEach(d => {
      const entry = { ...d, ownerId: m.id, ownerName: m.name };
      if (filterFn && !filterFn(entry)) return;
      const type = d.docType || 'Giấy tờ khác';
      if (!map[type]) map[type] = [];
      map[type].push(entry);
    });
    // Chỉ chèn danh mục/thư mục rỗng khi KHÔNG có bộ lọc đang bật, để không hiện danh mục
    // "trống" chỉ vì nó tồn tại thư mục con, trong khi không có tệp nào khớp bộ lọc.
    if (!filterFn) {
      (m.folders || []).forEach(f => { if (!map[f.docType]) map[f.docType] = []; });
      (m.categories || []).forEach(name => { if (!map[name]) map[name] = []; });
    }
  });
  return map;
}

// Trả về hàm lọc tương ứng với bộ lọc tag/thành viên/Hồ sơ chung gia đình đang chọn
// trong màn hình tổng hợp (null nếu không có bộ lọc nào đang bật).
function consolidatedFilterPredicate() {
  const f = currentConsolidatedTagFilter;
  if (!f) return null;
  if (f.kind === 'family') return d => d.ownerId === FAMILY_SHARED_ID;
  if (f.kind === 'member') return d => d.ownerId === f.id || (d.tags || []).includes(f.name);
  return d => (d.tags || []).includes(f.name);
}

// Vẽ thanh chip lọc nhanh theo tag: "Hồ sơ chung gia đình", tên từng thành viên, và các tag tự do
// (ví dụ "Ông ngoại") đã từng được gắn cho ít nhất 1 tệp. Bấm lại 1 chip đang chọn để bỏ lọc.
function renderConsolidatedTagFilterBar() {
  const bar = document.getElementById('consolidatedTagFilterBar');
  if (!bar) return;
  bar.innerHTML = '';

  const addChip = (label, active, onClick, extraClass = '') => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `tag-chip${active ? ' is-active' : ''}${extraClass ? ' ' + extraClass : ''}`;
    chip.textContent = label;
    chip.onclick = onClick;
    bar.appendChild(chip);
  };

  // Chip "Hồ sơ tạm": chỉ hiện khi có ít nhất 1 tệp đang chờ phân loại (status: 'pending'),
  // gộp từ mọi thành viên kể cả "Chưa gán chủ sở hữu" (vốn bị ẩn khỏi lưới danh mục thường).
  const pendingCount = getAllPendingDocuments().length;
  if (pendingCount > 0) {
    const isPendingActive = currentConsolidatedTagFilter?.kind === 'pending';
    addChip(`Hồ sơ tạm (${pendingCount})`, isPendingActive, () => {
      currentConsolidatedTagFilter = isPendingActive ? null : { kind: 'pending' };
      rerenderConsolidatedCurrentScreen();
    }, 'tag-chip-pending');
  }

  const isFamilyActive = currentConsolidatedTagFilter?.kind === 'family';
  addChip(FAMILY_SHARED_NAME, isFamilyActive, () => {
    currentConsolidatedTagFilter = isFamilyActive ? null : { kind: 'family' };
    rerenderConsolidatedCurrentScreen();
  }, 'tag-chip-family');

  displayMembers().forEach(m => {
    const active = currentConsolidatedTagFilter?.kind === 'member' && currentConsolidatedTagFilter.id === m.id;
    addChip(m.name, active, () => {
      currentConsolidatedTagFilter = active ? null : { kind: 'member', id: m.id, name: m.name };
      rerenderConsolidatedCurrentScreen();
    });
  });

  const memberNames = new Set(displayMembers().map(m => m.name));
  const customTags = new Set();
  members.forEach(m => (m.documents || []).forEach(d => (d.tags || []).forEach(tag => {
    if (tag && !memberNames.has(tag)) customTags.add(tag);
  })));
  Array.from(customTags).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })).forEach(tag => {
    const active = currentConsolidatedTagFilter?.kind === 'custom' && currentConsolidatedTagFilter.name === tag;
    addChip(tag, active, () => {
      currentConsolidatedTagFilter = active ? null : { kind: 'custom', name: tag };
      rerenderConsolidatedCurrentScreen();
    });
  });

  if (currentConsolidatedTagFilter) {
    addChip('✕ Xóa lọc', false, () => {
      currentConsolidatedTagFilter = null;
      rerenderConsolidatedCurrentScreen();
    }, 'tag-chip-clear');
  }
}

function rerenderConsolidatedCurrentScreen() {
  if (currentConsolidatedTagFilter?.kind === 'pending') renderConsolidatedPendingList();
  else if (currentConsolidatedCategory) openConsolidatedCategoryDetails(currentConsolidatedCategory);
  else renderConsolidatedCategories();
}

// 1. Màn hình ngoài: danh sách danh mục giấy tờ, gộp từ mọi thành viên
function renderConsolidatedCategories() {
  currentConsolidatedCategory = null;
  setBtnLabel(document.getElementById('consolidatedBackBtn'), 'arrowLeft', 'Quay lại trang chủ');
  document.getElementById('consolidatedBreadcrumb').innerHTML = `${svgIcon('folder')}<span>Toàn bộ danh mục giấy tờ (tổng hợp từ mọi thành viên)</span>`;
  renderConsolidatedTagFilterBar();

  const container = document.getElementById('consolidatedExplorerContent');
  container.innerHTML = '';

  const map = buildConsolidatedMap(consolidatedFilterPredicate());
  const types = Object.keys(map);
  const pendingCount = getAllPendingDocuments().length;

  if (types.length === 0 && pendingCount === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:45px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);">
        <div style="display:flex; justify-content:center; margin-bottom:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px; height:40px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
        ${currentConsolidatedTagFilter ? 'Không có giấy tờ nào khớp với bộ lọc đang chọn.' : 'Chưa có giấy tờ nào được lưu trữ trong hệ thống.'}
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'folder-grid';

  types.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })).forEach(type => {
    const files = map[type];
    const ownerCount = new Set(files.map(f => f.ownerId)).size;
    const defaultCat = DEFAULT_CATEGORIES.find(c => c.key === type);
    const card = document.createElement('div');
    card.className = 'folder-card' + (files.length > 0 ? ' folder-card-has-files' : '') + (defaultCat ? ' folder-card-standard' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Xem chi tiết danh mục ${type}`);
    card.innerHTML = `
      <div class="folder-icon ${defaultCat ? defaultCat.colorClass : ''}">${svgIcon(defaultCat ? defaultCat.icon : 'folder')}</div>
      <div class="folder-info">
        <div class="folder-name" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        <div class="folder-count">${files.length} tệp · ${ownerCount} thành viên</div>
      </div>
    `;
    const openCategory = () => openConsolidatedCategoryDetails(type);
    card.onclick = openCategory;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(); }
    };
    grid.appendChild(card);
  });

  // Thẻ thứ 6 (đặc biệt): "Hồ sơ tạm" - tệp status 'pending' của mọi thành viên, kể cả
  // "Chưa gán chủ sở hữu" (vốn không lộ diện trong các thẻ danh mục phía trên). Chỉ hiện khi
  // có ít nhất 1 tệp đang chờ; bấm vào mở thẳng danh sách để xem trước/hoàn tất phân loại.
  if (pendingCount > 0) {
    const pendingCard = document.createElement('div');
    pendingCard.className = 'folder-card folder-card-pending';
    pendingCard.setAttribute('role', 'button');
    pendingCard.setAttribute('tabindex', '0');
    pendingCard.setAttribute('aria-label', `Xem và phân loại ${pendingCount} tệp Hồ sơ tạm`);
    pendingCard.innerHTML = `
      <div class="folder-icon">${svgIcon('clock')}</div>
      <div class="folder-info">
        <div class="folder-name">Hồ sơ tạm</div>
        <div class="folder-count">${pendingCount} tệp · Chờ phân loại</div>
        <span class="folder-badge">Xem &amp; phân loại${svgIcon('arrowRight')}</span>
      </div>
    `;
    const openPending = () => {
      currentConsolidatedTagFilter = { kind: 'pending' };
      renderConsolidatedPendingList();
    };
    pendingCard.onclick = openPending;
    pendingCard.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPending(); }
    };
    grid.appendChild(pendingCard);
  }

  container.appendChild(grid);
}

// 2. Màn hình trong: toàn bộ tệp của 1 danh mục, gộp từ mọi thành viên, có gắn tên chủ sở hữu
function openConsolidatedCategoryDetails(docType) {
  currentConsolidatedCategory = docType;
  setBtnLabel(document.getElementById('consolidatedBackBtn'), 'arrowLeft', 'Quay lại danh mục');
  document.getElementById('consolidatedBreadcrumb').innerHTML =
    `${svgIcon('folder')}<a href="javascript:void(0)" onclick="renderConsolidatedCategories()" class="breadcrumb-link">Toàn bộ danh mục</a><span class="breadcrumb-sep">${svgIcon('arrowRight')}</span><strong class="breadcrumb-current">${escapeHtml(docType)}</strong>`;
  renderConsolidatedTagFilterBar();

  const container = document.getElementById('consolidatedExplorerContent');
  container.innerHTML = '';
  container.appendChild(renderConsolidatedToolbar(() => openConsolidatedCategoryDetails(docType)));

  const map = buildConsolidatedMap(consolidatedFilterPredicate());
  const files = sortConsolidatedList(map[docType] || [], consolidatedSortMode);

  if (files.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center; padding:30px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);';
    empty.innerText = currentConsolidatedTagFilter ? 'Không có tệp nào trong danh mục này khớp với bộ lọc đang chọn.' : 'Chưa có tệp nào trong danh mục này.';
    container.appendChild(empty);
    return;
  }

  const isListMode = docsViewMode === 'list';
  const filesList = document.createElement('div');
  filesList.className = 'files-list' + (isListMode ? ' view-list' : '');

  files.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const effectiveDocType = doc.docType || 'Giấy tờ khác';
    const card = document.createElement('article');
    card.className = 'file-card';
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`);
    const ownerRowHtml = `
      <div class="file-owner-row">
        <span class="file-owner-chip" title="${escapeHtml(doc.ownerName || 'Không rõ')}">👤 ${escapeHtml(doc.ownerName || 'Không rõ')}</span>
        <button type="button" class="file-goto-owner-btn btn-goto-owner" title="Đến hồ sơ thành viên" aria-label="Đến hồ sơ thành viên">${svgIcon('arrowRight')}</button>
      </div>
    `;
    card.innerHTML = isListMode ? `
      <button type="button" class="file-preview-button" title="Bấm để xem">${thumb}</button>
      <button type="button" class="file-name-button" title="Xem tài liệu">
        <strong>${escapeHtml(doc.desc || 'Chưa có mô tả')}</strong>
      </button>
      ${ownerRowHtml}
    ` : `
      <button type="button" class="file-preview-button" title="Bấm để phóng lớn">${thumb}</button>
      <div class="file-card-info">
        <strong>${escapeHtml(doc.desc || 'Chưa có mô tả')}</strong>
      </div>
      ${ownerRowHtml}
    `;
    if (!isPdf && doc.encrypted) {
      const previewButton = card.querySelector('.file-preview-button');
      getDocumentDisplayUrl(doc).then(url => {
        previewButton.innerHTML = `<img src="${url}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`;
      }).catch(() => {
        previewButton.innerHTML = '<div class="file-thumb file-thumb-pdf">⚠️</div>';
      });
    }
    const relatedForPreview = files.filter(f => f.ownerId === doc.ownerId);
    card.querySelector('.file-preview-button').onclick = () => showDocumentPreview(doc, relatedForPreview);
    if (isListMode) card.querySelector('.file-name-button').onclick = () => showDocumentPreview(doc, relatedForPreview);
    card.querySelector('.btn-goto-owner').onclick = () => openDocsView(doc.ownerId, false, effectiveDocType, doc.folderId || null);
    filesList.appendChild(card);
  });

  container.appendChild(filesList);
}

// 3. Màn hình "Hồ sơ tạm" trong Hồ sơ tổng hợp: liệt kê MỌI tệp status 'pending' của mọi
// thành viên (kể cả "Chưa gán chủ sở hữu" - vốn bị lọc khỏi buildConsolidatedMap()/lưới danh
// mục thông thường), cho xem trước hoặc "Hoàn tất phân loại" ngay (dùng lại đúng modal của
// openPendingCompleteModal(), không tạo luồng phân loại thứ 2 song song).
function renderConsolidatedPendingList() {
  currentConsolidatedCategory = null;
  setBtnLabel(document.getElementById('consolidatedBackBtn'), 'arrowLeft', 'Quay lại danh mục');
  document.getElementById('consolidatedBreadcrumb').innerHTML =
    `${svgIcon('folder')}<a href="javascript:void(0)" onclick="renderConsolidatedCategories()" class="breadcrumb-link">Toàn bộ danh mục</a><span class="breadcrumb-sep">${svgIcon('arrowRight')}</span><strong class="breadcrumb-current">Hồ sơ tạm</strong>`;
  renderConsolidatedTagFilterBar();

  const container = document.getElementById('consolidatedExplorerContent');
  container.innerHTML = '';
  container.appendChild(renderConsolidatedToolbar(renderConsolidatedPendingList));

  const pending = sortConsolidatedList(getAllPendingDocuments(), consolidatedSortMode);

  if (pending.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center; padding:30px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);';
    empty.innerText = 'Không có tệp nào đang chờ phân loại.';
    container.appendChild(empty);
    return;
  }

  const isListMode = docsViewMode === 'list';
  const filesList = document.createElement('div');
  filesList.className = 'files-list' + (isListMode ? ' view-list' : '');

  pending.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const label = doc.desc || doc.fileName || 'Chưa có mô tả';
    const card = document.createElement('article');
    card.className = 'file-card';
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(label)}">`);
    // Chân thẻ rút gọn còn đúng 1 hàng: chip cảnh báo "Chưa gán chủ sở hữu" (tông Pending/cam
    // nhạt) bên trái - bấm chip hoặc nút sửa đều mở form gán chủ sở hữu/danh mục - và cụm 2 nút
    // Sửa/Xóa bên phải. Không còn icon con mắt rời: bấm thẳng thumbnail hoặc tên tệp để xem trước.
    const footerHtml = `
      <div class="pending-footer-row">
        <button type="button" class="pending-unassigned-chip" title="Gán chủ sở hữu & danh mục" aria-label="Chưa gán chủ sở hữu - bấm để gán">
          ${svgIcon('alertTriangle')}<span>Chưa gán chủ sở hữu</span>
        </button>
        <div class="pending-footer-actions">
          <button type="button" class="btn-outline file-action-button btn-complete-pending" title="Sửa/Phân loại" aria-label="Sửa/Phân loại">${svgIcon('edit')}</button>
          <button type="button" class="btn-danger file-action-button btn-delete-pending" title="Xóa" aria-label="Xóa">${svgIcon('trash')}</button>
        </div>
      </div>
    `;
    card.innerHTML = isListMode ? `
      <button type="button" class="file-preview-button" title="Bấm để xem">${thumb}</button>
      <button type="button" class="file-name-button" title="Xem tài liệu"><strong>${escapeHtml(label)}</strong></button>
      ${footerHtml}
    ` : `
      <button type="button" class="file-preview-button" title="Bấm để phóng lớn">${thumb}</button>
      <button type="button" class="file-name-plain-button" title="Xem tài liệu"><strong>${escapeHtml(label)}</strong></button>
      ${footerHtml}
    `;
    if (!isPdf && doc.encrypted) {
      const previewButton = card.querySelector('.file-preview-button');
      getDocumentDisplayUrl(doc).then(url => {
        previewButton.innerHTML = `<img src="${url}" class="file-thumb" alt="${escapeHtml(label)}">`;
      }).catch(() => {
        previewButton.innerHTML = '<div class="file-thumb file-thumb-pdf">⚠️</div>';
      });
    }
    const relatedForPreview = pending.filter(f => f.ownerId === doc.ownerId);
    card.querySelector('.file-preview-button').onclick = () => showDocumentPreview(doc, relatedForPreview);
    card.querySelector(isListMode ? '.file-name-button' : '.file-name-plain-button').onclick = () => showDocumentPreview(doc, relatedForPreview);
    card.querySelector('.pending-unassigned-chip').onclick = () => openPendingCompleteModal(doc.ownerId, doc.id);
    card.querySelector('.btn-complete-pending').onclick = () => openPendingCompleteModal(doc.ownerId, doc.id);
    card.querySelector('.btn-delete-pending').onclick = () => deletePendingDocument(doc.ownerId, doc.id);
    filesList.appendChild(card);
  });

  container.appendChild(filesList);
}

// Nút "Quay lại" trong Hồ sơ cá nhân: nếu đang trong 1 danh mục thì quay lại danh sách danh mục,
// nếu đang ở danh sách danh mục thì quay lại trang cá nhân của thành viên.
// Dùng goBackInApp() (lịch sử trình duyệt) thay vì pushState mới để không làm lệch ngăn xếp lịch sử,
// nếu không nút "Quay lại" ở trang cá nhân sau đó sẽ không còn trỏ đúng về trang chủ.
function goBackFromDocsView() {
  if (currentSubfolderId) openFolderDetails(currentDocsFolder);
  else if (currentDocsFolder) renderDocsFolders();
  else goBackInApp();
}

function updateDocsBackBtnLabel() {
  const btn = document.getElementById('docsBackBtn');
  if (!btn) return;
  const label = currentSubfolderId ? currentDocsFolder
    : currentDocsFolder ? 'Tất cả danh mục'
    : 'Quay lại';
  setBtnLabel(btn, 'arrowLeft', label);
}

function getDocumentsTaggedForMember(memberId) {
  const member = members.find(item => String(item.id) === String(memberId));
  if (!member || !member.name) return [];

  const taggedDocuments = [];
  members.forEach(owner => {
    (owner.documents || []).forEach(doc => {
      if (String(owner.id) === String(memberId) || !(doc.tags || []).includes(member.name)) return;
      taggedDocuments.push({ ...doc, ownerId: owner.id, ownerName: owner.name });
    });
  });
  return taggedDocuments;
}

function renderTaggedDocumentsSection(container, memberId) {
  const taggedDocuments = sortDocsList(getDocumentsTaggedForMember(memberId), docsSortMode);
  if (taggedDocuments.length === 0) return;

  const section = document.createElement('section');
  section.className = 'tagged-documents-section';
  section.innerHTML = `
    <div class="docs-section-heading">
      <div>
        <h2>Tài liệu được gắn với thành viên này</h2>
        <p>${taggedDocuments.length} tệp từ hồ sơ thành viên khác</p>
      </div>
    </div>
  `;

  const filesList = document.createElement('div');
  filesList.className = 'files-list' + (docsViewMode === 'list' ? ' view-list' : '');
  taggedDocuments.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const label = doc.desc || doc.fileName || 'Chưa có mô tả';
    const card = document.createElement('article');
    card.className = 'file-card tagged-document-card';
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(label)}">`);
    card.innerHTML = `
      <button type="button" class="file-preview-button" title="Bấm để xem">${thumb}</button>
      <div class="file-card-info">
        <strong>${escapeHtml(label)}</strong>
        <span class="file-meta-sub">${escapeHtml(doc.docType || 'Giấy tờ khác')}</span>
      </div>
      <div class="file-owner-row">
        <span class="file-owner-chip" title="Từ: ${escapeHtml(doc.ownerName || 'Không rõ')}">Từ: ${escapeHtml(doc.ownerName || 'Không rõ')}</span>
        <button type="button" class="file-goto-owner-btn btn-goto-owner" title="Đến hồ sơ chủ sở hữu" aria-label="Đến hồ sơ chủ sở hữu">${svgIcon('arrowRight')}</button>
      </div>
    `;
    if (!isPdf && doc.encrypted) {
      const previewButton = card.querySelector('.file-preview-button');
      getDocumentDisplayUrl(doc).then(url => {
        previewButton.innerHTML = `<img src="${url}" class="file-thumb" alt="${escapeHtml(label)}">`;
      }).catch(() => {
        previewButton.innerHTML = '<div class="file-thumb file-thumb-pdf">⚠️</div>';
      });
    }
    const relatedForPreview = taggedDocuments.filter(item => item.ownerId === doc.ownerId);
    card.querySelector('.file-preview-button').onclick = () => showDocumentPreview(doc, relatedForPreview);
    card.querySelector('.btn-goto-owner').onclick = () => openDocsView(doc.ownerId, false, doc.docType, doc.folderId || null);
    filesList.appendChild(card);
  });

  section.appendChild(filesList);
  container.appendChild(section);
}

// Thanh chuyển đổi hiển thị dạng lưới / dạng danh sách (kiểu Google Drive). docsViewMode dùng
// chung cho mọi màn hình duyệt tệp (Hồ sơ cá nhân lẫn Hồ sơ tổng hợp) nên trạng thái luôn đồng
// bộ dù đổi ở màn nào. onRerender (tùy chọn): hàm vẽ lại đúng màn hình đang mở sau khi đổi chế
// độ - mặc định vẽ lại Hồ sơ cá nhân (dùng khi gọi từ renderDocsFolders()/openFolderDetails()).
function renderViewToggleBar(onRerender) {
  const bar = document.createElement('div');
  bar.className = 'docs-view-toggle';
  bar.innerHTML = `
    <button type="button" class="view-toggle-btn ${docsViewMode === 'grid' ? 'active' : ''}" title="Dạng lưới">${iconSpan('grid')}Lưới</button>
    <button type="button" class="view-toggle-btn ${docsViewMode === 'list' ? 'active' : ''}" title="Dạng danh sách">${iconSpan('list')}Danh sách</button>
  `;
  const [gridBtn, listBtn] = bar.querySelectorAll('.view-toggle-btn');
  const applyMode = (mode) => {
    docsViewMode = mode;
    try { localStorage.setItem('docsViewMode', mode); } catch (e) { /* ignore */ }
    if (onRerender) onRerender();
    else if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
    else renderDocsFolders();
  };
  gridBtn.onclick = () => applyMode('grid');
  listBtn.onclick = () => applyMode('list');
  return bar;
}

// 1. Màn hình ngoài: Danh sách các thư mục loại giấy tờ
function renderDocsFolders() {
  currentDocsFolder = null;
  currentSubfolderId = null;
  selectedDocIds.clear();
  selectedFolderIds.clear();
  // Màn hình gốc "Tất cả danh mục" chỉ hiện thẻ danh mục, không có tệp nào để chọn hàng loạt -
  // luôn thoát hẳn chế độ chọn (không chỉ ẩn thanh công cụ) và ẩn luôn nút "Chọn nhiều tệp" (chỉ
  // có ý nghĩa khi đã ở trong 1 danh mục cụ thể), tránh kẹt UI nếu người dùng rời khỏi 1 danh mục
  // trong lúc đang chọn dở.
  isDocSelectMode = false;
  document.getElementById('docsBatchToolbar').classList.add('hidden');
  document.getElementById('btnToggleDocSelect').classList.add('hidden');
  updateDocsBackBtnLabel();
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  document.getElementById('docsBreadcrumb').innerHTML = `${svgIcon('folder')}<span>Tất cả danh mục (Chọn loại giấy tờ để xem chi tiết)</span>`;

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const docs = m.documents || [];
  const folders = m.folders || [];
  const categories = m.categories || [];

  // 7 danh mục chuẩn là cố định (không tạo mới được nữa ở màn hình này), nên không còn nút
  // "+ Danh mục mới" ở đây - tránh phát sinh danh mục rác làm vỡ bộ lọc. Tải lên tệp cũng
  // không cho phép ở màn hình gốc này (chưa xác định danh mục đích) - ẩn cả nút Header lẫn FAB.
  setDocsUploadControlsVisible(false);

  // Nhóm file theo loại giấy tờ (docType). 7 danh mục chuẩn (DEFAULT_CATEGORIES) luôn được
  // gieo sẵn với mảng rỗng để luôn hiển thị đủ 7 thẻ (kể cả thành viên mới tạo, 0 tệp), thay vì
  // chỉ hiện những danh mục đã thực sự có tệp/thư mục như trước.
  const folderMap = {};
  DEFAULT_CATEGORIES.forEach(cat => { folderMap[cat.key] = []; });
  docs.forEach(d => {
    const type = d.docType || 'Giấy tờ khác';
    if (!folderMap[type]) folderMap[type] = [];
    folderMap[type].push(d);
  });
  // Danh mục có thư mục con hoặc được tạo trống (chưa có tệp trực tiếp nào) vẫn hiển thị
  folders.forEach(f => {
    if (!folderMap[f.docType]) folderMap[f.docType] = [];
  });
  categories.forEach(name => {
    if (!folderMap[name]) folderMap[name] = [];
  });

  container.appendChild(renderViewToggleBar());

  const grid = document.createElement('div');
  grid.className = 'folder-grid' + (docsViewMode === 'list' ? ' view-list' : '');

  const isListMode = docsViewMode === 'list';
  Object.keys(folderMap).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })).forEach(type => {
    const files = folderMap[type];
    const defaultCat = DEFAULT_CATEGORIES.find(c => c.key === type);
    const card = document.createElement('div');
    card.className = 'folder-card' + (files.length > 0 ? ' folder-card-has-files' : '') + (defaultCat ? ' folder-card-standard' : '') + (isListMode ? ' category-item' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Mở danh mục ${type}`);
    // Toàn bộ danh mục ở màn hình gốc (kể cả danh mục custom còn sót lại từ trước) đều chỉ để
    // xem/mở, không còn đổi tên/xóa được nữa - tính năng quản lý danh mục custom đã bị gỡ bỏ.
    const iconHtml = `<div class="folder-icon${isListMode ? ' category-icon-box' : ''}${defaultCat ? ' ' + defaultCat.colorClass : ''}">${svgIcon(defaultCat ? defaultCat.icon : 'folder')}</div>`;
    // Chế độ Danh sách: bố cục 2 bên (trái: icon+tên/phụ đề trong .category-left, phải: badge số
    // tệp gọn) - xem .category-* trong style.css. Chế độ Lưới giữ nguyên cấu trúc
    // .folder-info/.folder-count dọc như trước.
    card.innerHTML = isListMode ? `
      <div class="category-left">
        ${iconHtml}
        <div class="category-info">
          <div class="category-title" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        </div>
      </div>
      <div class="category-right">
        <div class="category-badge${files.length > 0 ? ' has-docs' : ''}">${files.length > 0 ? files.length + ' tệp' : '—'}</div>
      </div>
    ` : `
      ${iconHtml}
      <div class="folder-info">
        <div class="folder-name" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        <div class="folder-count">${files.length} tệp</div>
      </div>
    `;
    const openThisFolder = () => { openFolderDetails(type); };
    card.onclick = openThisFolder;
    card.onkeydown = (e) => {
      if (e.target !== card) return; // không kích hoạt khi phím bấm đến từ phần tử lồng bên trong
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThisFolder(); }
    };
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Tài liệu do thành viên khác gắn thẻ luôn nằm dưới lưới 7 danh mục chính chủ, ngăn cách bằng
  // đường viền nhẹ (.tagged-documents-section) - đây là khu vực phụ/tham khảo, không phải hồ sơ
  // gốc của thành viên này nên không được lẫn lên trên cùng thứ tự với danh mục chính chủ.
  renderTaggedDocumentsSection(container, m.id);
}

// Sắp xếp danh sách tệp trong Hồ sơ tổng hợp: theo ngày tải lên hoặc theo tên tệp (A-Z/Z-A).
// Lấy phần số trong id (thay vì Number(id) trực tiếp) vì tệp "Hồ sơ tạm" có id dạng
// "doc_<timestamp>_<i>" chứ không phải chuỗi số thuần như tệp đã phân loại.
function sortConsolidatedList(files, mode) {
  const arr = [...files];
  const idNum = doc => Number((doc.id || '').toString().replace(/\D/g, '') || 0);
  const fileLabel = doc => doc.fileName || doc.desc || '';
  if (mode === 'name-asc') arr.sort((a, b) => fileLabel(a).localeCompare(fileLabel(b), 'vi', { sensitivity: 'base' }));
  else if (mode === 'name-desc') arr.sort((a, b) => fileLabel(b).localeCompare(fileLabel(a), 'vi', { sensitivity: 'base' }));
  else if (mode === 'date-asc') arr.sort((a, b) => idNum(a) - idNum(b));
  else arr.sort((a, b) => idNum(b) - idNum(a));
  return arr;
}

// Thanh toolbar chuyển đổi Lưới/Danh sách + sắp xếp cho màn hình Hồ sơ tổng hợp, đặt ngay dưới
// hàng chip lọc thành viên. onRerender: vẽ lại đúng màn hình con đang mở (chi tiết 1 danh mục).
function renderConsolidatedToolbar(onRerender) {
  const toolsBar = document.createElement('div');
  toolsBar.className = 'docs-toolbar-row';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'docs-toolbar-left';
  leftGroup.appendChild(renderViewToggleBar(onRerender));

  const sortWrap = document.createElement('div');
  sortWrap.className = 'docs-sort-wrap';
  sortWrap.innerHTML = `
    <label for="consolidatedSortSelect" style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap; margin:0;">Sắp xếp:</label>
    <select id="consolidatedSortSelect" style="max-width:220px;">
      <option value="date-desc">Ngày tải lên (mới nhất trước)</option>
      <option value="date-asc">Ngày tải lên (cũ nhất trước)</option>
      <option value="name-asc">Tên tệp (A → Z)</option>
      <option value="name-desc">Tên tệp (Z → A)</option>
    </select>
  `;
  const select = sortWrap.querySelector('#consolidatedSortSelect');
  select.value = consolidatedSortMode;
  select.onchange = (e) => {
    consolidatedSortMode = e.target.value;
    onRerender();
  };
  leftGroup.appendChild(sortWrap);
  toolsBar.appendChild(leftGroup);
  return toolsBar;
}

// Sắp xếp danh sách tệp theo ngày tải lên hoặc theo mô tả (A-Z)
function sortDocsList(files, mode) {
  const arr = [...files];
  if (mode === 'desc-asc') {
    arr.sort((a, b) => (a.desc || '').localeCompare(b.desc || '', 'vi', { sensitivity: 'base' }));
  } else if (mode === 'date-asc') {
    arr.sort((a, b) => Number(a.id) - Number(b.id));
  } else {
    arr.sort((a, b) => Number(b.id) - Number(a.id));
  }
  return arr;
}

// Chế độ chọn nhiều tệp giấy tờ / Bulk Actions cho hồ sơ cá nhân
function toggleDocSelectMode() {
  isDocSelectMode = !isDocSelectMode;
  selectedDocIds.clear();
  selectedFolderIds.clear();
  const selectAllCb = document.getElementById('docSelectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = false;
  document.getElementById('docsBatchToolbar').classList.toggle('hidden', !isDocSelectMode);
  // Nút "Chọn nhiều tệp" chỉ để BẬT chế độ chọn - khi đã bật, ẩn hẳn nó đi (thay vì đổi nhãn
  // thành "Thoát chọn" ngay tại chỗ) vì nút "Thoát chọn" giờ nằm chung hàng trong
  // #docsBatchToolbar (dạng ghost/link nhẹ, xem .btn-exit-select) để không bị rời rạc/thô.
  document.getElementById('btnToggleDocSelect').classList.toggle('hidden', isDocSelectMode);
  if (currentDocsFolder) openFolderDetails(currentDocsFolder);
  else updateDocSelectedCount();
}

function getCurrentFolderFiles() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !currentDocsFolder) return [];
  return (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === currentDocsFolder && (d.folderId || null) === (currentSubfolderId || null));
}

// Thư mục con trực tiếp bên trong danh mục/thư mục đang mở, để có thể chọn cả thư mục khi di chuyển/xóa hàng loạt
function getCurrentFolderChildFolders() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !currentDocsFolder) return [];
  return (m.folders || []).filter(f => f.docType === currentDocsFolder && (f.parentId || null) === (currentSubfolderId || null));
}

function updateDocSelectedCount() {
  const countEl = document.getElementById('docSelectedCountText');
  const totalItems = getCurrentFolderFiles().length + getCurrentFolderChildFolders().length;
  const selectedCount = selectedDocIds.size + selectedFolderIds.size;
  if (countEl) countEl.innerText = `(Đã chọn: ${selectedCount}/${totalItems})`;
}

function toggleDocSelection(id) {
  if (selectedDocIds.has(id)) selectedDocIds.delete(id);
  else selectedDocIds.add(id);

  const card = document.querySelector(`.file-card[data-doc-id="${id}"]`);
  if (card) {
    const isSelected = selectedDocIds.has(id);
    card.classList.toggle('is-selected', isSelected);
    const cb = card.querySelector('.file-card-checkbox');
    if (cb) cb.checked = isSelected;
  }

  updateSelectAllCheckboxState();
  updateDocSelectedCount();
}

// Chọn/bỏ chọn 1 thư mục con (để có thể di chuyển hoặc xóa cả thư mục cùng lúc với các tệp khác)
function toggleFolderSelection(id) {
  if (selectedFolderIds.has(id)) selectedFolderIds.delete(id);
  else selectedFolderIds.add(id);

  const card = document.querySelector(`.folder-card[data-folder-id="${id}"]`);
  if (card) {
    const isSelected = selectedFolderIds.has(id);
    card.classList.toggle('is-selected', isSelected);
    const cb = card.querySelector('.folder-card-checkbox');
    if (cb) cb.checked = isSelected;
  }

  updateSelectAllCheckboxState();
  updateDocSelectedCount();
}

function updateSelectAllCheckboxState() {
  const totalInFolder = getCurrentFolderFiles().length + getCurrentFolderChildFolders().length;
  const selectedCount = selectedDocIds.size + selectedFolderIds.size;
  const selectAllCb = document.getElementById('docSelectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = (selectedCount === totalInFolder && totalInFolder > 0);
}

function toggleDocSelectAll(checked) {
  selectedDocIds.clear();
  selectedFolderIds.clear();
  if (checked) {
    getCurrentFolderFiles().forEach(d => selectedDocIds.add(d.id));
    getCurrentFolderChildFolders().forEach(f => selectedFolderIds.add(f.id));
  }
  document.querySelectorAll('.file-card').forEach(card => {
    card.classList.toggle('is-selected', checked);
    const cb = card.querySelector('.file-card-checkbox');
    if (cb) cb.checked = checked;
  });
  document.querySelectorAll('.folder-card[data-folder-id]').forEach(card => {
    card.classList.toggle('is-selected', checked);
    const cb = card.querySelector('.folder-card-checkbox');
    if (cb) cb.checked = checked;
  });
  updateDocSelectedCount();
}

async function deleteSelectedDocuments() {
  const docCount = selectedDocIds.size;
  const folderCount = selectedFolderIds.size;
  if (docCount === 0 && folderCount === 0) {
    alert('Vui lòng chọn ít nhất 1 tệp hoặc thư mục để xóa!');
    return;
  }
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  const parts = [];
  if (docCount > 0) parts.push(`${docCount} tệp`);
  if (folderCount > 0) parts.push(`${folderCount} thư mục (các tệp bên trong sẽ được chuyển ra thư mục cha)`);
  if (!confirm(`Bạn có chắc chắn muốn xóa ${parts.join(' và ')} đã chọn?`)) return;

  // Chỉ xử lý các thư mục "cấp cao nhất" trong tập đã chọn, để tránh xử lý trùng lặp
  // khi cả thư mục cha lẫn thư mục con của nó đều nằm trong lựa chọn.
  const selectedFolderArray = [...selectedFolderIds];
  const topLevelFolders = selectedFolderArray.filter(fid =>
    !selectedFolderArray.some(otherId => otherId !== fid && collectFolderSubtreeIds(m, otherId).has(String(fid)))
  );
  topLevelFolders.forEach(fid => {
    const folder = (m.folders || []).find(f => String(f.id) === String(fid));
    if (!folder) return;
    const subtreeIds = collectFolderSubtreeIds(m, fid);
    const parentId = folder.parentId || null;
    (m.documents || []).forEach(d => {
      if (subtreeIds.has(String(d.folderId))) d.folderId = parentId;
    });
    m.folders = (m.folders || []).filter(f => !subtreeIds.has(String(f.id)));
  });

  if (m.documents) {
    m.documents = m.documents.filter(d => {
      const shouldDelete = selectedDocIds.has(d.id);
      if (shouldDelete && decryptedDocumentUrlCache.has(d.id)) {
        URL.revokeObjectURL(decryptedDocumentUrlCache.get(d.id));
        decryptedDocumentUrlCache.delete(d.id);
      }
      return !shouldDelete;
    });
  }

  selectedDocIds.clear();
  selectedFolderIds.clear();
  try {
    await pushToFirebase();
    if (typeof updatePendingDocsBadge === 'function') updatePendingDocsBadge();
    if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
    else renderDocsFolders();
  } catch (err) {
    alert('Lỗi xóa dữ liệu: ' + err.message);
  }
}

// Di chuyển 1 thư mục con (và toàn bộ nội dung bên trong) sang danh mục/thư mục cha khác.
// Trả về { ok: false, reason: 'cycle' } nếu đích nằm bên trong chính thư mục đang di chuyển (hoặc con cháu của nó).
function moveFolderToTarget(m, folderId, targetDocType, targetFolderId) {
  const folder = (m.folders || []).find(f => String(f.id) === String(folderId));
  if (!folder) return { ok: false, reason: 'not-found' };

  const subtreeIds = collectFolderSubtreeIds(m, folderId);
  if (targetFolderId && subtreeIds.has(String(targetFolderId))) {
    return { ok: false, reason: 'cycle' };
  }

  const oldDocType = folder.docType;
  folder.docType = targetDocType;
  folder.parentId = targetFolderId || null;

  if (oldDocType !== targetDocType) {
    (m.folders || []).forEach(f => {
      if (String(f.id) !== String(folderId) && subtreeIds.has(String(f.id))) f.docType = targetDocType;
    });
    (m.documents || []).forEach(d => {
      if (subtreeIds.has(String(d.folderId))) d.docType = targetDocType;
    });
  }
  return { ok: true };
}

async function moveSelectedDocuments() {
  if (selectedDocIds.size === 0 && selectedFolderIds.size === 0) {
    alert('Vui lòng chọn ít nhất 1 tệp hoặc thư mục để chuyển!');
    return;
  }
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !m.documents) return;

  const typeSel = document.getElementById('moveDocsTypeSelect').value;
  const docType = typeSel === 'custom'
    ? (document.getElementById('moveDocsCustomName').value.trim() || 'Tài liệu khác')
    : typeSel;
  const folderSelect = document.getElementById('moveDocsFolderSelect');
  const targetFolderId = (typeSel !== 'custom' && folderSelect && folderSelect.value) ? folderSelect.value : null;

  // Chỉ xử lý các thư mục "cấp cao nhất" trong tập đã chọn (thư mục con của thư mục khác trong cùng
  // lựa chọn sẽ tự di chuyển theo thư mục cha của nó, không cần xử lý riêng).
  const selectedFolderArray = [...selectedFolderIds];
  const topLevelFolders = selectedFolderArray.filter(fid =>
    !selectedFolderArray.some(otherId => otherId !== fid && collectFolderSubtreeIds(m, otherId).has(String(fid)))
  );

  let cycleSkipped = 0;
  topLevelFolders.forEach(fid => {
    const result = moveFolderToTarget(m, fid, docType, targetFolderId);
    if (!result.ok) cycleSkipped++;
  });

  m.documents.forEach(d => {
    if (selectedDocIds.has(d.id)) { d.docType = docType; d.folderId = targetFolderId; }
  });

  const btn = document.getElementById('btnMoveDocs');
  btn.innerText = 'Đang chuyển...';
  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closeMoveDocsModal();
    selectedDocIds.clear();
    selectedFolderIds.clear();
    openFolderDetails(docType, targetFolderId);
    if (cycleSkipped > 0) {
      alert('Đã bỏ qua ' + cycleSkipped + ' thư mục vì không thể chuyển 1 thư mục vào chính nó hoặc thư mục con của nó.');
    }
  } catch (err) {
    alert('Lỗi chuyển thư mục: ' + err.message);
  } finally {
    btn.innerText = 'Di chuyển';
  }
}

// Quản lý thư mục con bên trong 1 danh mục giấy tờ (có thể lồng nhiều cấp)
let newFolderParentId = null;
let editingFolderId = null;

// Trả về toàn bộ id của 1 thư mục và mọi thư mục con/cháu bên trong nó (đệ quy)
function collectFolderSubtreeIds(m, folderId) {
  const ids = new Set([String(folderId)]);
  let changed = true;
  while (changed) {
    changed = false;
    (m.folders || []).forEach(f => {
      if (f.parentId && ids.has(String(f.parentId)) && !ids.has(String(f.id))) {
        ids.add(String(f.id));
        changed = true;
      }
    });
  }
  return ids;
}

// Đếm tổng số tệp bên trong 1 thư mục, bao gồm cả các thư mục con lồng bên trong
function countFilesRecursive(m, docType, folderId) {
  const directCount = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === docType && (d.folderId || null) === (folderId || null)).length;
  const childFolders = (m.folders || []).filter(f => f.docType === docType && (f.parentId || null) === (folderId || null));
  return childFolders.reduce((sum, f) => sum + countFilesRecursive(m, docType, f.id), directCount);
}

// Đường dẫn các thư mục cha (từ gốc danh mục tới thư mục hiện tại) để hiển thị breadcrumb
function getFolderAncestorChain(m, folderId) {
  const chain = [];
  let current = folderId ? (m.folders || []).find(f => String(f.id) === String(folderId)) : null;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? (m.folders || []).find(f => String(f.id) === String(current.parentId)) : null;
  }
  return chain;
}

function openNewFolderModal(docType, parentId = null) {
  editingFolderId = null;
  newFolderDocType = docType;
  newFolderParentId = parentId;
  document.getElementById('newFolderModalTitle').innerText = 'Tạo thư mục mới';
  document.getElementById('btnSaveNewFolder').innerText = 'Tạo thư mục';
  document.getElementById('newFolderName').value = '';
  document.getElementById('newFolderModal').classList.remove('hidden');
}

function openEditFolderModal(folderId) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !m.folders) return;
  const folder = m.folders.find(f => String(f.id) === String(folderId));
  if (!folder) return;

  editingFolderId = folder.id;
  newFolderDocType = folder.docType;
  newFolderParentId = folder.parentId || null;
  document.getElementById('newFolderModalTitle').innerText = 'Đổi tên thư mục';
  document.getElementById('btnSaveNewFolder').innerText = 'Lưu';
  document.getElementById('newFolderName').value = folder.name;
  document.getElementById('newFolderModal').classList.remove('hidden');
}

function closeNewFolderModal() {
  editingFolderId = null;
  document.getElementById('newFolderModal').classList.add('hidden');
}

async function saveNewFolder() {
  const name = document.getElementById('newFolderName').value.trim();
  if (!name) {
    alert('Vui lòng nhập tên thư mục!');
    return;
  }
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !newFolderDocType) return;
  if (!m.folders) m.folders = [];

  const duplicate = m.folders.some(f => f.docType === newFolderDocType
    && (f.parentId || null) === (newFolderParentId || null)
    && f.name.toLowerCase() === name.toLowerCase()
    && String(f.id) !== String(editingFolderId));
  if (duplicate) {
    alert('Thư mục này đã tồn tại!');
    return;
  }

  const btn = document.getElementById('btnSaveNewFolder');

  if (editingFolderId) {
    const folder = m.folders.find(f => String(f.id) === String(editingFolderId));
    if (!folder) return;
    const previousName = folder.name;
    folder.name = name;
    btn.innerText = 'Đang lưu...';
    try {
      await pushToFirebase();
      closeNewFolderModal();
      openFolderDetails(newFolderDocType, newFolderParentId);
    } catch (err) {
      folder.name = previousName;
      alert('Lỗi đổi tên thư mục: ' + err.message);
    } finally {
      btn.innerText = 'Lưu';
    }
    return;
  }

  const folder = {
    id: String(Date.now()),
    docType: newFolderDocType,
    parentId: newFolderParentId || null,
    name,
    createdAt: new Date().toLocaleDateString('vi-VN')
  };
  m.folders.push(folder);

  btn.innerText = 'Đang tạo...';
  try {
    await pushToFirebase();
    closeNewFolderModal();
    openFolderDetails(newFolderDocType, newFolderParentId);
  } catch (err) {
    m.folders = m.folders.filter(f => f.id !== folder.id);
    alert('Lỗi tạo thư mục: ' + err.message);
  } finally {
    btn.innerText = 'Tạo thư mục';
  }
}

async function deleteSubfolder(folderId) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !m.folders) return;
  const folder = m.folders.find(f => String(f.id) === String(folderId));
  if (!folder) return;

  if (!confirm(`Xóa thư mục "${folder.name}"? Các tệp bên trong (kể cả trong thư mục con) sẽ được chuyển ra thư mục cha.`)) return;

  const subtreeIds = collectFolderSubtreeIds(m, folderId);
  const parentId = folder.parentId || null;
  (m.documents || []).forEach(d => {
    if (subtreeIds.has(String(d.folderId))) d.folderId = parentId;
  });
  m.folders = m.folders.filter(f => !subtreeIds.has(String(f.id)));

  try {
    await pushToFirebase();
    openFolderDetails(folder.docType, parentId);
  } catch (err) {
    alert('Lỗi xóa thư mục: ' + err.message);
  }
}

// Di chuyển nhanh 1 tệp duy nhất (nút "📤" trên từng thẻ tệp, không cần bật chế độ chọn nhiều)
function moveSingleDocument(docId) {
  selectedDocIds.clear();
  selectedFolderIds.clear();
  selectedDocIds.add(docId);
  openMoveDocsModal(currentDocsFolder, currentSubfolderId);
}

// Bỏ phần mở rộng (VD: ".pdf") khỏi tên hiển thị trong List View, vì định dạng đã hiện riêng ở dòng phụ
function stripFileExtension(name) {
  return (name || '').replace(/\.[A-Za-z0-9]{1,5}$/, '');
}

// Nhãn định dạng tệp ngắn gọn để hiển thị ở dòng phụ trong List View (VD: "PDF", "JPG")
function getDocFormatLabel(doc) {
  const extMatch = (doc.fileName || '').match(/\.([^.]+)$/);
  if (extMatch) return extMatch[1].toUpperCase();
  if (doc.fileType) {
    const parts = doc.fileType.split('/');
    return (parts[1] || parts[0] || '').toUpperCase();
  }
  return 'FILE';
}

// Menu 3 chấm (⋮) trên mỗi dòng tệp ở List View: đóng mọi menu đang mở, dùng khi mở menu khác hoặc bấm ra ngoài
function closeAllFileKebabMenus() {
  document.querySelectorAll('.file-kebab-menu:not(.hidden)').forEach(menu => {
    menu.classList.add('hidden');
    menu.classList.remove('open-up');
    const btn = menu.parentElement?.querySelector('.file-kebab-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    menu.closest('.file-card')?.classList.remove('menu-open');
  });
}

// Bật menu mở lên trên (thay vì xuống dưới) nếu dòng tệp nằm sát đáy màn hình, tránh bị viewport che khuất
function positionFileKebabMenu(menu) {
  const rect = menu.getBoundingClientRect();
  const overflowsBottom = rect.bottom > window.innerHeight;
  menu.classList.toggle('open-up', overflowsBottom);
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.file-row-menu')) closeAllFileKebabMenus();
  if (!e.target.closest('.header-search-row')) document.getElementById('globalSearchResults')?.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllFileKebabMenus();
    clearGlobalSearch();
  }
});

// 2. Màn hình trong: Chi tiết danh sách các ảnh/tệp của loại giấy tờ đó (File Explorer Detail View)
// subfolderId: nếu có, hiển thị nội dung của 1 thư mục con nằm bên trong danh mục docType
function openFolderDetails(docType, subfolderId = null) {
  currentDocsFolder = docType;
  currentSubfolderId = subfolderId;
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  const subfolder = subfolderId ? (m.folders || []).find(f => String(f.id) === String(subfolderId)) : null;
  if (subfolderId && !subfolder) {
    // Thư mục con đã bị xóa/không còn tồn tại: quay lại danh mục cha
    openFolderDetails(docType);
    return;
  }

  updateDocsBackBtnLabel();
  // Vào chi tiết 1 danh mục (dù ở gốc danh mục hay đã vào thư mục con): cho phép tải lên trở
  // lại, vì đích đến (ownerId/docType/folderId) đã rõ ràng. Nút "Chọn nhiều tệp" cũng chỉ có
  // ý nghĩa ở đây (renderDocsFolders() luôn ẩn nó vì màn hình gốc không có tệp nào để chọn) -
  // đồng bộ lại theo đúng trạng thái isDocSelectMode hiện tại (ẩn nếu đang ở giữa chế độ chọn).
  setDocsUploadControlsVisible(true);
  document.getElementById('btnToggleDocSelect').classList.toggle('hidden', isDocSelectMode);

  const defaultCat = DEFAULT_CATEGORIES.find(c => c.key === docType);
  const isDefaultCategory = Boolean(defaultCat);
  const ancestorChain = getFolderAncestorChain(m, subfolderId);
  const isAtCategoryRoot = !subfolderId;
  const docTypeEscaped = escapeHtml(docType).replace(/'/g, "\\'");
  const crumbLink = (label, onclick) => `<a href="javascript:void(0)" onclick="${onclick}" class="breadcrumb-link">${label}</a>`;
  // Breadcrumb: [Tên thành viên / Hồ sơ chung] > [Icon + Tên danh mục] > [Tên thư mục con...]
  const ownerLabel = escapeHtml(m.name || '');
  const categoryLabel = `<span class="breadcrumb-cat">${svgIcon(defaultCat ? defaultCat.icon : 'folder')}${escapeHtml(docType)}</span>`;
  const breadcrumbParts = [
    crumbLink(ownerLabel, 'renderDocsFolders()'),
    isAtCategoryRoot
      ? `<strong class="breadcrumb-current">${categoryLabel}</strong>`
      : crumbLink(categoryLabel, `openFolderDetails('${docTypeEscaped}')`)
  ];
  ancestorChain.forEach((f, idx) => {
    const isLast = idx === ancestorChain.length - 1;
    breadcrumbParts.push(isLast
      ? `<strong class="breadcrumb-current">${escapeHtml(f.name)}</strong>`
      : crumbLink(escapeHtml(f.name), `openFolderDetails('${docTypeEscaped}', '${escapeHtml(f.id).replace(/'/g, "\\'")}')`));
  });
  const breadcrumbSep = `<span class="breadcrumb-sep">${svgIcon('arrowRight')}</span>`;
  document.getElementById('docsBreadcrumb').innerHTML = breadcrumbParts.join(breadcrumbSep);

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const allTypeDocs = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === docType);
  const allTypeFolders = (m.folders || []).filter(f => f.docType === docType);
  const childFolders = allTypeFolders.filter(f => (f.parentId || null) === (subfolderId || null));

  // Chỉ bật lại "Tất cả danh mục" khi danh mục này thực sự không còn tồn tại (VD: vừa bị xóa ở
  // tab khác). 7 danh mục chuẩn luôn hợp lệ để mở vào, kể cả đang trống 0 tệp - nếu không, bấm
  // vào 1 danh mục chuẩn còn trống sẽ bị bật ngược lại màn hình gốc, mất luôn currentDocsFolder
  // mà nút FAB cần để nhận diện ngữ cảnh lưu thẳng.
  if (!subfolder && !isDefaultCategory && allTypeDocs.length === 0 && allTypeFolders.length === 0) {
    renderDocsFolders();
    return;
  }

  const files = allTypeDocs.filter(d => (d.folderId || null) === (subfolderId || null));

  const toolsBar = document.createElement('div');
  toolsBar.className = 'docs-toolbar-row';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'docs-toolbar-left';
  leftGroup.appendChild(renderViewToggleBar());

  const sortWrap = document.createElement('div');
  sortWrap.className = 'docs-sort-wrap';
  sortWrap.innerHTML = `
    <label for="docsSortSelect" style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap; margin:0;">Sắp xếp:</label>
    <select id="docsSortSelect" style="max-width:220px;">
      <option value="date-desc">Ngày tải lên (mới nhất trước)</option>
      <option value="date-asc">Ngày tải lên (cũ nhất trước)</option>
      <option value="desc-asc">Mô tả (A-Z)</option>
    </select>
  `;
  sortWrap.querySelector('#docsSortSelect').value = docsSortMode;
  sortWrap.querySelector('#docsSortSelect').onchange = (e) => {
    docsSortMode = e.target.value;
    openFolderDetails(docType, subfolderId);
  };
  leftGroup.appendChild(sortWrap);
  toolsBar.appendChild(leftGroup);

  const newFolderBtn = document.createElement('button');
  newFolderBtn.type = 'button';
  newFolderBtn.className = 'btn-outline';
  newFolderBtn.innerHTML = `${iconSpan('folderPlus')}Thư mục con mới`;
  newFolderBtn.onclick = () => openNewFolderModal(docType, subfolderId);
  toolsBar.appendChild(newFolderBtn);
  container.appendChild(toolsBar);

  // Danh sách thư mục con trực tiếp của thư mục/danh mục đang mở (có thể lồng nhiều cấp)
  if (childFolders.length > 0) {
    const subGrid = document.createElement('div');
    subGrid.className = 'folder-grid' + (docsViewMode === 'list' ? ' view-list' : '');
    subGrid.style.marginBottom = '18px';
    [...childFolders].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })).forEach(f => {
      const count = countFilesRecursive(m, docType, f.id);
      const isFolderSelected = selectedFolderIds.has(f.id);
      const card = document.createElement('div');
      card.className = 'folder-card' + (isFolderSelected ? ' is-selected' : '');
      card.setAttribute('data-folder-id', f.id);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Mở thư mục ${f.name}`);
      const folderCheckboxHtml = isDocSelectMode
        ? `<input type="checkbox" class="folder-card-checkbox" ${isFolderSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleFolderSelection('${f.id}')">`
        : '';
      card.innerHTML = `
        ${folderCheckboxHtml}
        <div class="folder-icon">${svgIcon('folder')}</div>
        <div class="folder-info">
          <div class="folder-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="folder-count">${count} tệp</div>
        </div>
        <button type="button" class="btn-outline file-action-button btn-edit-subfolder" title="Đổi tên thư mục" aria-label="Đổi tên thư mục" style="flex:0 0 auto;">${svgIcon('edit')}</button>
        <button type="button" class="btn-danger file-action-button btn-del-subfolder" title="Xóa thư mục" aria-label="Xóa thư mục" style="flex:0 0 auto;">${svgIcon('trash')}</button>
      `;
      card.querySelector('.btn-edit-subfolder').onclick = (e) => { e.stopPropagation(); openEditFolderModal(f.id); };
      card.querySelector('.btn-del-subfolder').onclick = (e) => { e.stopPropagation(); deleteSubfolder(f.id); };
      const activateFolderCard = () => {
        if (isDocSelectMode) { toggleFolderSelection(f.id); return; }
        openFolderDetails(docType, f.id);
      };
      card.onclick = activateFolderCard;
      card.onkeydown = (e) => {
        if (e.target !== card) return; // không kích hoạt khi phím bấm đến từ checkbox/nút sửa/xóa lồng bên trong
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateFolderCard(); }
      };
      subGrid.appendChild(card);
    });
    container.appendChild(subGrid);
  }

  if (files.length === 0) {
    const emptyText = subfolder
      ? 'Chưa có tệp nào trong thư mục này.'
      : (childFolders.length > 0 ? '' : 'Chưa có tệp đính kèm trực tiếp trong danh mục này.');
    if (emptyText) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center; padding:30px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);';
      empty.innerText = emptyText;
      container.appendChild(empty);
    }
    document.getElementById('docsBatchToolbar').classList.toggle('hidden', !isDocSelectMode);
    const selectAllCbEmpty = document.getElementById('docSelectAllCheckbox');
    if (selectAllCbEmpty) selectAllCbEmpty.checked = false;
    updateDocSelectedCount();
    return;
  }

  const sortedFiles = sortDocsList(files, docsSortMode);

  const filesList = document.createElement('div');
  filesList.className = 'files-list' + (docsViewMode === 'list' ? ' view-list' : '');

  const isListMode = docsViewMode === 'list';

  sortedFiles.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const isSelected = selectedDocIds.has(doc.id);
    const card = document.createElement('article');
    card.className = 'file-card' + (isSelected ? ' is-selected' : '');
    card.setAttribute('data-doc-id', doc.id);
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`);
    const checkboxHtml = isDocSelectMode
      ? `<input type="checkbox" class="file-card-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleDocSelection('${doc.id}')">`
      : '';

    if (isListMode) {
      const metaSub = `${escapeHtml(doc.createdAt || '—')} • ${escapeHtml(getDocFormatLabel(doc))}`;
      card.innerHTML = `
        ${checkboxHtml}
        <button type="button" class="file-preview-button" title="Bấm để xem">${thumb}</button>
        <button type="button" class="file-name-button" title="Xem tài liệu">
          <strong>${escapeHtml(stripFileExtension(doc.desc) || 'Chưa có mô tả')}</strong>
          <span class="file-meta-sub">${metaSub}</span>
        </button>
        <div class="file-row-menu">
          <button type="button" class="file-kebab-btn" title="Thao tác khác" aria-label="Thao tác khác" aria-haspopup="true" aria-expanded="false">${svgIcon('moreVertical')}</button>
          <div class="file-kebab-menu hidden">
            <button type="button" class="file-kebab-item btn-edit-file">${iconSpan('edit')}Sửa mô tả</button>
            <button type="button" class="file-kebab-item btn-move-file">${iconSpan('move')}Di chuyển</button>
            <button type="button" class="file-kebab-item danger btn-del-file">${iconSpan('trash')}Xóa</button>
          </div>
        </div>
      `;
    } else {
      card.innerHTML = `
        ${checkboxHtml}
        <button type="button" class="file-preview-button" title="Bấm để phóng lớn">${thumb}</button>
        <div class="file-card-info">
          <strong>${escapeHtml(doc.desc || 'Chưa có mô tả')}</strong>
        </div>
        <div class="file-actions-scroll" aria-label="Thao tác giấy tờ">
          <button type="button" class="btn-outline file-action-button btn-view-file" title="Xem tài liệu" aria-label="Xem tài liệu">${svgIcon('eye')}</button>
          <button type="button" class="btn-outline file-action-button btn-edit-file" title="Sửa mô tả" aria-label="Sửa mô tả">${svgIcon('edit')}</button>
          <button type="button" class="btn-outline file-action-button btn-move-file" title="Di chuyển sang thư mục khác" aria-label="Di chuyển sang thư mục khác">${svgIcon('move')}</button>
          <button type="button" class="btn-danger file-action-button btn-del-file" title="Xóa tài liệu" aria-label="Xóa tài liệu">${svgIcon('trash')}</button>
        </div>
      `;
    }

    if (!isPdf && doc.encrypted) {
      const previewButton = card.querySelector('.file-preview-button');
      getDocumentDisplayUrl(doc).then(url => {
        previewButton.innerHTML = `<img src="${url}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`;
      }).catch(() => {
        previewButton.innerHTML = '<div class="file-thumb file-thumb-pdf">⚠️</div>';
      });
    }
    card.querySelector('.file-preview-button').onclick = () => showDocumentPreview(doc, sortedFiles);
    if (isListMode) {
      card.querySelector('.file-name-button').onclick = () => showDocumentPreview(doc, sortedFiles);
      const kebabBtn = card.querySelector('.file-kebab-btn');
      const kebabMenu = card.querySelector('.file-kebab-menu');
      kebabBtn.onclick = (e) => {
        e.stopPropagation();
        const willOpen = kebabMenu.classList.contains('hidden');
        closeAllFileKebabMenus();
        if (willOpen) {
          kebabMenu.classList.remove('hidden');
          kebabBtn.setAttribute('aria-expanded', 'true');
          card.classList.add('menu-open');
          positionFileKebabMenu(kebabMenu);
        }
      };
      card.querySelector('.btn-edit-file').onclick = () => { closeAllFileKebabMenus(); editDocumentDescription(doc.id); };
      card.querySelector('.btn-move-file').onclick = () => { closeAllFileKebabMenus(); moveSingleDocument(doc.id); };
      card.querySelector('.btn-del-file').onclick = () => { closeAllFileKebabMenus(); deleteDocument(doc.id); };
    } else {
      card.querySelector('.btn-view-file').onclick = () => showDocumentPreview(doc, sortedFiles);
      card.querySelector('.btn-edit-file').onclick = () => editDocumentDescription(doc.id);
      card.querySelector('.btn-move-file').onclick = () => moveSingleDocument(doc.id);
      card.querySelector('.btn-del-file').onclick = () => deleteDocument(doc.id);
    }
    filesList.appendChild(card);
  });

  container.appendChild(filesList);

  document.getElementById('docsBatchToolbar').classList.toggle('hidden', !isDocSelectMode);
  const selectAllCb = document.getElementById('docSelectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = (selectedDocIds.size === sortedFiles.length && sortedFiles.length > 0);
  updateDocSelectedCount();
}

function editDocumentDescription(docId) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  const doc = m?.documents?.find(item => String(item.id) === String(docId));
  if (!doc) return;

  editingDocId = docId;
  editDocEditingTags = Array.isArray(doc.tags) ? [...doc.tags] : [];
  openEditDocModal(doc.docType || 'Giấy tờ khác', doc.desc);
  renderEditDocTagsChips();
}

// Chip chọn nhiều "Thành viên liên quan (Gắn thẻ)" trong modal Sửa thông tin giấy tờ - bấm để
// thêm/bớt tên khỏi mảng nháp editDocEditingTags (chỉ gồm thành viên thật, giống hệt
// renderPendingTagsChips() của modal Hoàn tất phân loại). Lưu ý: đây chính là mảng doc.tags mà
// getDocumentsTaggedForMember() đọc để dựng khối "Tài liệu được gắn với thành viên này", nên sửa
// ở đây cũng tự đồng bộ với khu vực đó ngay khi màn hình gốc renderDocsFolders() được vẽ lại.
function renderEditDocTagsChips() {
  const wrap = document.getElementById('editDocTagsChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  displayMembers().forEach(mem => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const active = editDocEditingTags.includes(mem.name);
    chip.className = `tag-chip${active ? ' is-active' : ''}`;
    chip.textContent = mem.name;
    chip.onclick = () => {
      editDocEditingTags = active
        ? editDocEditingTags.filter(t => t !== mem.name)
        : [...editDocEditingTags, mem.name];
      renderEditDocTagsChips();
    };
    wrap.appendChild(chip);
  });
}

async function saveDocumentEdit() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  const doc = m?.documents?.find(item => String(item.id) === String(editingDocId));
  if (!doc) return;

  const typeSel = document.getElementById('editDocTypeSelect').value;
  const docType = typeSel === 'custom'
    ? (document.getElementById('editDocCustomName').value.trim() || 'Tài liệu khác')
    : typeSel;
  const desc = document.getElementById('editDocDesc').value.trim();

  const previousFolder = currentDocsFolder;
  const previousSubfolder = currentSubfolderId;
  if (doc.docType !== docType) doc.folderId = null;
  doc.docType = docType;
  doc.desc = desc || doc.fileName || docType;
  doc.tags = editDocEditingTags.slice();

  const btn = document.getElementById('btnSaveDocEdit');
  btn.innerText = 'Đang lưu...';
  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closeEditDocModal();
    if (previousFolder && previousFolder !== docType) {
      openFolderDetails(docType);
    } else if (currentDocsFolder) {
      openFolderDetails(currentDocsFolder, previousSubfolder);
    } else {
      renderDocsFolders();
    }
  } catch (err) {
    alert('Lỗi lưu thông tin giấy tờ: ' + err.message);
  } finally {
    btn.innerText = 'Lưu thay đổi';
  }
}

// ============================================================
// QUICK PREVIEW & SAVE (FAB Camera): mặc định lưu thẳng vào "Hồ sơ tạm" (status: 'pending'),
// KHÔNG hỏi chủ sở hữu/danh mục/ghi chú/gắn thẻ. Nhưng nếu FAB được bấm ngay trong lúc đang
// đứng ở 1 danh mục/thư mục con cụ thể của Hồ sơ cá nhân hoặc Hồ sơ chung gia đình (Context-
// Aware Upload, xem detectGlobalUploadContext()), lưu thẳng vào đúng vị trí đó với trạng thái
// chính thức thay vì bắt người dùng hoàn tất phân loại lại sau. "Hồ sơ tổng hợp" (Kho tổng) và
// trang chủ luôn về "Hồ sơ tạm" vì gộp nhiều chủ sở hữu, không có 1 đích lưu duy nhất rõ ràng.
// ============================================================

// Xác định ngữ cảnh hiện tại khi bấm FAB: chỉ nhận diện được đích lưu rõ ràng khi đang đứng
// trong màn hình Hồ sơ cá nhân/Hồ sơ chung gia đình (docsView) VÀ đã chọn 1 danh mục cụ thể
// (currentDocsFolder khác rỗng) - còn ở trang chủ, Kho tổng, hoặc mới vào "Tất cả danh mục"
// (chưa bấm vào danh mục nào) đều trả về null để rơi về hành vi mặc định (Hồ sơ tạm).
function detectGlobalUploadContext() {
  if (document.getElementById('docsView').classList.contains('hidden')) return null;
  if (!currentDocsFolder) return null;
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return null;
  const folder = currentSubfolderId ? (m.folders || []).find(f => String(f.id) === String(currentSubfolderId)) : null;
  if (currentSubfolderId && !folder) return null; // thư mục đã bị xóa - phòng hờ, an toàn hơn là về Hồ sơ tạm
  return {
    ownerId: m.id,
    docType: currentDocsFolder,
    folderId: currentSubfolderId || null,
    label: folder ? folder.name : currentDocsFolder
  };
}

async function saveGlobalDocument() {
  if (!globalUploadFiles || globalUploadFiles.length === 0) {
    alert('Vui lòng chụp/chọn ít nhất 1 ảnh hoặc tệp PDF để lưu!');
    return;
  }

  if (globalUploadContext) {
    await saveGlobalDocumentToContext(globalUploadContext);
    return;
  }

  const isNewUnassignedProfile = !members.some(item => String(item.id) === UNASSIGNED_OWNER_ID);
  const m = ensureUnassignedOwnerMember();
  if (!m.documents) m.documents = [];
  if (!m.folders) m.folders = [];

  const files = globalUploadFiles.map(entry => entry.file);
  const btn = document.getElementById('btnSaveGlobalDoc');
  const originalBtnLabel = btn.innerHTML;
  const savedDocs = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
      setBtnLabel(btn, 'clock', 'Đang lưu tạm' + progress + '...');
      const documentId = 'doc_' + Date.now() + '_' + i;
      const storageUrl = await uploadEncryptedFileToStorage(file, `documents/${m.id}/${documentId}-${file.name}`);
      const doc = {
        id: documentId,
        ownerId: m.id,
        fileName: file.name,
        fileType: file.type,
        desc: file.name,
        data: storageUrl,
        encrypted: true,
        status: 'pending',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        uploadedAt: new Date().toISOString()
      };
      m.documents.push(doc);
      savedDocs.push(doc);
    }
    await pushToFirebase();
    if (typeof updatePendingDocsBadge === 'function') updatePendingDocsBadge();
    closeGlobalUploadModal();
    showToast(files.length > 1
      ? `Đã lưu tạm ${files.length} tệp! Vào "Hồ sơ tạm" để hoàn tất phân loại sau.`
      : 'Đã lưu tạm giấy tờ! Vào "Hồ sơ tạm" trên thanh menu để hoàn tất phân loại sau.');

    // Làm mới màn hình đang xem nếu có liên quan, để người dùng thấy ngay tệp vừa thêm.
    if (!document.getElementById('consolidatedView').classList.contains('hidden')) {
      rerenderConsolidatedCurrentScreen();
    }
  } catch (err) {
    m.documents = m.documents.filter(d => !savedDocs.includes(d));
    if (isNewUnassignedProfile && m.documents.length === 0 && m.folders.length === 0) {
      members = members.filter(item => item !== m);
    }
    alert('Lỗi khi lưu tài liệu: ' + err.message);
  } finally {
    btn.innerHTML = originalBtnLabel;
  }
}

// Lưu thẳng vào đúng danh mục/thư mục hiện hành (Context-Aware Upload) với trạng thái chính
// thức, thay vì đẩy vào "Hồ sơ tạm" chờ phân loại - dùng khi FAB được bấm ngay trong lúc đang
// đứng ở 1 danh mục cụ thể của Hồ sơ cá nhân/Hồ sơ chung gia đình (xem detectGlobalUploadContext()).
async function saveGlobalDocumentToContext(context) {
  const m = members.find(item => String(item.id) === String(context.ownerId));
  if (!m) {
    alert('Không tìm thấy hồ sơ thành viên tương ứng!');
    return;
  }
  if (!m.documents) m.documents = [];

  const files = globalUploadFiles.map(entry => entry.file);
  const btn = document.getElementById('btnSaveGlobalDoc');
  const originalBtnLabel = btn.innerHTML;
  const savedDocs = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
      setBtnLabel(btn, 'clock', 'Đang lưu' + progress + '...');
      const documentId = String(Date.now() + i);
      const storageUrl = await uploadEncryptedFileToStorage(file, `documents/${m.id}/${documentId}-${file.name}`);
      const doc = {
        id: documentId,
        docType: context.docType,
        folderId: context.folderId,
        fileName: file.name,
        fileType: file.type,
        desc: file.name,
        data: storageUrl,
        encrypted: true,
        status: 'completed',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        uploadedAt: new Date().toISOString()
      };
      m.documents.push(doc);
      savedDocs.push(doc);
    }
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closeGlobalUploadModal();
    showToast(`Đã lưu ${files.length} tệp vào ${context.label}.`);

    // Vẽ lại ngay danh sách tệp tại đúng thư mục hiện hành để thấy file mới tức thì (chỉ khi
    // người dùng vẫn còn đứng ở đúng màn hình đó, phòng trường hợp đã điều hướng đi nơi khác
    // trong lúc chờ tải lên).
    if (!document.getElementById('docsView').classList.contains('hidden')
      && String(currentMemberId) === String(context.ownerId) && currentDocsFolder === context.docType) {
      openFolderDetails(context.docType, context.folderId || null);
    }
  } catch (err) {
    m.documents = m.documents.filter(d => !savedDocs.includes(d));
    alert('Lỗi khi lưu tài liệu: ' + err.message);
  } finally {
    btn.innerHTML = originalBtnLabel;
  }
}

// Xóa tài liệu
async function deleteDocument(docId) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m || !m.documents) return;

  if (confirm('Bạn có chắc chắn muốn xóa tệp giấy tờ này?')) {
    m.documents = m.documents.filter(d => String(d.id) !== String(docId));
    selectedDocIds.delete(docId);
    if (decryptedDocumentUrlCache.has(docId)) {
      URL.revokeObjectURL(decryptedDocumentUrlCache.get(docId));
      decryptedDocumentUrlCache.delete(docId);
    }
    try {
      await pushToFirebase();
      if (typeof updatePendingDocsBadge === 'function') updatePendingDocsBadge();
      if (currentDocsFolder) {
        openFolderDetails(currentDocsFolder);
      } else {
        renderDocsFolders();
      }
    } catch (err) {
      alert('Lỗi xóa tài liệu: ' + err.message);
    }
  }
}

// ============================================================
// HỒ SƠ TẠM: các tệp đã lưu nhanh (status: 'pending'), chưa hoàn tất gán chủ sở hữu/danh
// mục. Gom từ mọi thành viên (kể cả Hồ sơ chung gia đình), cho xem lại/xóa hoặc "hoàn tất
// phân loại" (chuyển status -> 'completed', có thể đổi cả chủ sở hữu/danh mục/thư mục con).
// ============================================================
let editingPendingDoc = null; // { ownerId, docId }
let pendingEditingTags = []; // Bản nháp mảng tags (tên thành viên liên quan) đang chỉnh trong modal Hoàn tất phân loại

// Tài liệu cũ không có trường status luôn được coi là 'completed' (xem yêu cầu di trú dữ liệu).
function getAllPendingDocuments() {
  const result = [];
  members.forEach(m => {
    (m.documents || []).forEach(d => {
      if (d.status === 'pending') result.push({ ...d, ownerId: m.id, ownerName: m.name });
    });
  });
  return result;
}

function updatePendingDocsBadge() {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  const count = getAllPendingDocuments().length;
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

async function deletePendingDocument(ownerId, docId) {
  const m = members.find(item => String(item.id) === String(ownerId));
  if (!m || !m.documents) return;
  if (!confirm('Bạn có chắc chắn muốn xóa tệp giấy tờ tạm này?')) return;

  m.documents = m.documents.filter(d => String(d.id) !== String(docId));
  if (decryptedDocumentUrlCache.has(docId)) {
    URL.revokeObjectURL(decryptedDocumentUrlCache.get(docId));
    decryptedDocumentUrlCache.delete(docId);
  }
  try {
    await pushToFirebase();
    updatePendingDocsBadge();
    renderConsolidatedPendingList();
  } catch (err) {
    alert('Lỗi xóa tài liệu: ' + err.message);
  }
}

function populatePendingOwnerSelect() {
  const select = document.getElementById('pdOwnerSelect');
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

function populatePendingFolderSelect(ownerId, docType) {
  const select = document.getElementById('pdFolderSelect');
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
}

function onPendingOwnerChange() {
  const categoryVal = document.getElementById('pdCategorySelect').value;
  populatePendingFolderSelect(document.getElementById('pdOwnerSelect').value, categoryVal === 'custom' ? null : categoryVal);
}

function onPendingCategoryChange(val) {
  toggleCustomDocName(val, 'pdCustomCategoryGroup');
  populatePendingFolderSelect(document.getElementById('pdOwnerSelect').value, val === 'custom' ? null : val);
}

function onPendingFolderChange(val) {
  document.getElementById('pdNewFolderNameGroup').classList.toggle('hidden', val !== '__new__');
  if (val === '__new__') document.getElementById('pdNewFolderName').focus();
}

function openPendingCompleteModal(ownerId, docId) {
  const m = members.find(item => String(item.id) === String(ownerId));
  const doc = m?.documents?.find(d => String(d.id) === String(docId));
  if (!doc) return;
  editingPendingDoc = { ownerId, docId };

  populatePendingOwnerSelect();
  const ownerSelect = document.getElementById('pdOwnerSelect');
  // Tệp lưu nhanh qua FAB luôn nằm ở "Chưa gán chủ sở hữu" (ownerId không có mặt trong danh
  // sách lựa chọn) - trường hợp đó mặc định chọn "Hồ sơ chung gia đình" thay vì để trống lựa chọn.
  const ownerExists = Array.from(ownerSelect.options).some(o => o.value === String(ownerId));
  ownerSelect.value = ownerExists ? ownerId : FAMILY_SHARED_ID;

  populateDocTypeSelect('pdCategorySelect');
  const categorySelect = document.getElementById('pdCategorySelect');
  const knownCategories = Array.from(categorySelect.options).map(o => o.value);
  const currentDocType = doc.docType && knownCategories.includes(doc.docType) ? doc.docType : 'custom';
  categorySelect.value = currentDocType;
  document.getElementById('pdCustomCategoryName').value = currentDocType === 'custom' ? (doc.docType || '') : '';
  toggleCustomDocName(categorySelect.value, 'pdCustomCategoryGroup');

  populatePendingFolderSelect(ownerId, currentDocType === 'custom' ? null : currentDocType);
  const folderSelect = document.getElementById('pdFolderSelect');
  if (folderSelect && doc.folderId) folderSelect.value = doc.folderId;
  document.getElementById('pdNewFolderName').value = '';
  document.getElementById('pdNewFolderNameGroup').classList.add('hidden');

  document.getElementById('pdDesc').value = doc.desc || '';

  pendingEditingTags = Array.isArray(doc.tags) ? [...doc.tags] : [];
  renderPendingTagsChips();

  document.getElementById('pendingCompleteModal').classList.remove('hidden');
}

// Chip chọn nhiều "Thành viên liên quan" trong modal Hoàn tất phân loại: bấm để thêm/bớt tên
// thành viên khỏi mảng pendingEditingTags (chỉ gồm thành viên thật, không tính Hồ sơ chung/Chưa
// gán chủ sở hữu - dùng lại displayMembers() như bộ lọc tag của Hồ sơ tổng hợp).
function renderPendingTagsChips() {
  const wrap = document.getElementById('pdTagsChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  displayMembers().forEach(mem => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const active = pendingEditingTags.includes(mem.name);
    chip.className = `tag-chip${active ? ' is-active' : ''}`;
    chip.textContent = mem.name;
    chip.onclick = () => {
      pendingEditingTags = active
        ? pendingEditingTags.filter(t => t !== mem.name)
        : [...pendingEditingTags, mem.name];
      renderPendingTagsChips();
    };
    wrap.appendChild(chip);
  });
}

function closePendingCompleteModal() {
  editingPendingDoc = null;
  pendingEditingTags = [];
  document.getElementById('pendingCompleteModal').classList.add('hidden');
}

async function savePendingComplete() {
  if (!editingPendingDoc) return;
  const { ownerId, docId } = editingPendingDoc;
  const sourceMember = members.find(item => String(item.id) === String(ownerId));
  const doc = sourceMember?.documents?.find(d => String(d.id) === String(docId));
  if (!doc) { closePendingCompleteModal(); return; }

  const newOwnerId = document.getElementById('pdOwnerSelect').value;
  const isNewFamilyProfile = newOwnerId === FAMILY_SHARED_ID && !members.some(item => String(item.id) === FAMILY_SHARED_ID);
  const targetMember = newOwnerId === FAMILY_SHARED_ID
    ? ensureFamilySharedMember()
    : members.find(item => String(item.id) === String(newOwnerId));
  if (!targetMember) {
    alert('Không tìm thấy hồ sơ chủ sở hữu đã chọn!');
    return;
  }
  if (!targetMember.folders) targetMember.folders = [];
  if (!targetMember.documents) targetMember.documents = [];

  const categorySel = document.getElementById('pdCategorySelect').value;
  const docType = categorySel === 'custom'
    ? (document.getElementById('pdCustomCategoryName').value.trim() || 'Tài liệu khác')
    : categorySel;

  const folderSel = document.getElementById('pdFolderSelect').value;
  let targetFolderId = null;
  let createdFolder = null;
  if (folderSel === '__new__') {
    const newFolderName = document.getElementById('pdNewFolderName').value.trim();
    if (!newFolderName) {
      alert('Vui lòng nhập tên thư mục con mới, hoặc chọn "Thư mục gốc của danh mục"!');
      return;
    }
    const existing = targetMember.folders.find(f => f.docType === docType && !f.parentId && f.name.toLowerCase() === newFolderName.toLowerCase());
    if (existing) {
      targetFolderId = existing.id;
    } else {
      createdFolder = {
        id: String(Date.now()),
        docType,
        parentId: null,
        name: newFolderName,
        createdAt: new Date().toLocaleDateString('vi-VN')
      };
      targetMember.folders.push(createdFolder);
      targetFolderId = createdFolder.id;
    }
  } else if (folderSel) {
    targetFolderId = folderSel;
  }

  const desc = document.getElementById('pdDesc').value.trim();
  const ownerChanged = String(sourceMember.id) !== String(targetMember.id);

  // Lưu lại toàn bộ trường sẽ bị sửa, để có thể khôi phục đúng nguyên trạng
  // (không chỉ vị trí trong members[], mà cả nội dung doc) nếu lưu thất bại.
  const previousFields = {
    ownerId: doc.ownerId, docType: doc.docType, folderId: doc.folderId,
    desc: doc.desc, status: doc.status, tags: doc.tags
  };

  if (ownerChanged) {
    sourceMember.documents = (sourceMember.documents || []).filter(d => String(d.id) !== String(docId));
  }

  doc.ownerId = targetMember.id;
  doc.docType = docType;
  doc.folderId = targetFolderId;
  doc.desc = desc || doc.fileName || docType;
  doc.status = 'completed';
  doc.tags = pendingEditingTags.slice();

  if (ownerChanged) targetMember.documents.push(doc);

  const btn = document.getElementById('btnSavePendingComplete');
  btn.innerText = 'Đang lưu...';
  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closePendingCompleteModal();
    updatePendingDocsBadge();
    if (currentMemberId && !document.getElementById('docsView').classList.contains('hidden')) {
      if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
      else renderDocsFolders();
    }
    if (!document.getElementById('consolidatedView').classList.contains('hidden')) {
      rerenderConsolidatedCurrentScreen();
    }
  } catch (err) {
    Object.assign(doc, previousFields);
    if (ownerChanged) {
      targetMember.documents = targetMember.documents.filter(d => String(d.id) !== String(docId));
      sourceMember.documents.push(doc);
    }
    if (createdFolder) targetMember.folders = targetMember.folders.filter(f => f.id !== createdFolder.id);
    if (isNewFamilyProfile && targetMember.documents.length === 0 && targetMember.folders.length === 0) {
      members = members.filter(item => item !== targetMember);
    }
    alert('Lỗi lưu thông tin giấy tờ: ' + err.message);
  } finally {
    btn.innerText = 'Hoàn tất phân loại';
  }
}