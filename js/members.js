// Biến theo dõi thư mục giấy tờ hiện tại
let currentDocsFolder = null;

// Kéo thả sắp xếp[cite: 3]
function initSortable() {
  const grid = document.getElementById('memberGrid');
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  
  if (isSelectMode) return;

  if (typeof Sortable !== 'undefined') {
    sortableInstance = new Sortable(grid, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
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

// Chế độ chọn / Bulk Actions[cite: 3]
function toggleSelectMode() {
  isSelectMode = !isSelectMode;
  selectedIds.clear();
  document.getElementById('selectAllCheckbox').checked = false;
  document.getElementById('batchActionToolbar').classList.toggle('hidden', !isSelectMode);
  document.getElementById('btnToggleSelect').innerText = isSelectMode ? '✕ Thoát chọn' : '☑️ Quản lý / Chọn';
  renderGrid();
  updateSelectedCount();
}

function updateSelectedCount() {
  document.getElementById('selectedCountText').innerText = `(Đã chọn: ${selectedIds.size}/${members.length})`;
}

function toggleMemberSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  
  const card = document.querySelector(`.member-card[data-id="${id}"]`);
  if (card) {
    const isSelected = selectedIds.has(id);
    card.classList.toggle('is-selected', isSelected);
    const cb = card.querySelector('.card-checkbox');
    if (cb) cb.checked = isSelected;
  }

  document.getElementById('selectAllCheckbox').checked = (selectedIds.size === members.length && members.length > 0);
  updateSelectedCount();
}

function toggleSelectAll(checked) {
  selectedIds.clear();
  if (checked) {
    members.forEach(m => selectedIds.add(m.id));
  }
  document.querySelectorAll('.member-card').forEach(card => {
    card.classList.toggle('is-selected', checked);
    const cb = card.querySelector('.card-checkbox');
    if (cb) cb.checked = checked;
  });
  updateSelectedCount();
}

async function deleteSelectedMembers() {
  if (selectedIds.size === 0) {
    alert('Vui lòng chọn ít nhất 1 thành viên để xóa!');
    return;
  }
  if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} thành viên đã chọn?`)) {
    members = members.filter(m => !selectedIds.has(m.id));
    selectedIds.clear();
    try {
      await pushToFirebase();
      renderGrid();
      updateSelectedCount();
      document.getElementById('selectAllCheckbox').checked = false;
    } catch (e) {
      alert('Lỗi xóa dữ liệu: ' + e.message);
    }
  }
}

// Bảng tổng hợp[cite: 3]
function openSummaryTable() {
  let targetMembers = members;
  if (selectedIds.size > 0) {
    targetMembers = members.filter(m => selectedIds.has(m.id));
  }

  const tbody = document.getElementById('summaryTableBody');
  tbody.innerHTML = '';

  targetMembers.forEach((m, idx) => {
    const bankDetails = (m.banks && m.banks.length > 0)
      ? m.banks.map(b => `<strong>${escapeHtml(b.bankName || 'Ngân hàng')}:</strong> ${escapeHtml(b.accNum || '')}`).join('<br>')
      : '-';

    const roleText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
    const hasNote = m.notes && m.notes.trim() !== '' && m.notes !== '<br>' && m.notes !== '<div><br></div>';

    const noteBtnHtml = hasNote
      ? `<button type="button" class="btn-eye" title="Bấm để xem ghi chú" data-name="${escapeHtml(m.name || '')}" data-id="${m.id}">👁️</button>`
      : `<span style="color:var(--text-muted); opacity: 0.5;">-</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td><strong>${escapeHtml(m.name || '-')}</strong></td>
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
  document.getElementById('batchActionToolbar').classList.add('hidden');
  document.getElementById('tableView').classList.remove('hidden');
}

// Sao chép bảng cho Excel[cite: 3]
function copyTableData() {
  let targetMembers = members;
  if (selectedIds.size > 0) {
    targetMembers = members.filter(m => selectedIds.has(m.id));
  }

  const headers = ["STT", "Họ và Tên", "Đối tượng", "Ngày sinh", "Nơi sinh", "Số CCCD", "Ngày cấp", "BHYT", "Mã số BHXH", "Mã số thuế", "Mã HS / NV", "Tài khoản ngân hàng", "Ghi chú"];
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
  if (members.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">Chưa có thành viên nào. Bấm "+ Thêm thành viên" để bắt đầu!</div>';
    return;
  }
  
  members.forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.setAttribute('data-id', m.id);
    
    const isSelected = selectedIds.has(m.id);
    if (isSelected) card.classList.add('is-selected');

    let topControls = '';
    if (isSelectMode) {
      topControls = `<input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleMemberSelection('${m.id}')">`;
    } else {
      topControls = `<div class="drag-handle" title="Giữ để kéo thả sắp xếp">⠿</div>`;
    }

    card.onclick = (e) => {
      if (isSelectMode) {
        toggleMemberSelection(m.id);
      } else {
        if (!e.target.classList.contains('drag-handle')) {
          viewDetails(m.id);
        }
      }
    };

    const avatarSrc = m.avatar || 'https://via.placeholder.com/150?text=No+Img';
    const memberRole = m.type === 'child' ? 'Trẻ em' : 'Người lớn';

    card.innerHTML = `
      ${topControls}
      <div class="avatar-wrap">
        <img src="${escapeHtml(avatarSrc)}" onerror="this.src='https://via.placeholder.com/150?text=Error'">
      </div>
      <div class="member-name">${escapeHtml(m.name || '-')}</div>
      <span class="member-role">${escapeHtml(memberRole)}</span>
    `;
    card.querySelector('.avatar-wrap img').onclick = (e) => {
      e.stopPropagation();
      showImageModal(e.currentTarget.src, m.name || 'Ảnh đại diện');
    };
    grid.appendChild(card);
  });

  initSortable();
}

// Hiển thị chi tiết
function viewDetails(id) {
  const targetId = id || currentMemberId;
  const m = members.find(item => item.id === targetId);
  if (!m) return;
  currentMemberId = targetId;

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');

  document.getElementById('dtAvatar').src = m.avatar || 'https://via.placeholder.com/150?text=No+Img';
  document.getElementById('dtName').innerText = m.name;
  document.getElementById('dtRole').innerText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
  document.getElementById('dtDob').innerText = m.dob || '-';
  document.getElementById('dtPob').innerText = m.pob || '-';
  document.getElementById('dtCccd').innerText = m.cccd || '-';
  document.getElementById('dtCccdDate').innerText = m.cccdDate || '-';
  document.getElementById('dtBhyt').innerText = m.bhyt || '-';
  document.getElementById('dtBhxh').innerText = m.bhxh || '-';
  document.getElementById('dtTax').innerText = m.tax || '-';

  const notesEl = document.getElementById('dtNotes');
  if (m.notes && m.notes.trim() !== '') notesEl.innerHTML = m.notes;
  else notesEl.innerText = 'Chưa có ghi chú nào.';

  document.getElementById('specialLabel').innerText = m.type === 'child' ? 'Mã học sinh' : 'Mã nhân viên';
  document.getElementById('specialVal').innerText = m.specialCode || '-';

  const bList = document.getElementById('dtBanks');
  bList.innerHTML = '';
  if (m.banks && m.banks.length > 0) {
    m.banks.forEach(b => {
      const bankCard = document.createElement('div');
      bankCard.className = 'bank-card';
      bankCard.innerHTML = `
        <div class="bank-info-left">
          <img class="bank-logo" src="${escapeHtml(b.logo || 'https://via.placeholder.com/50?text=Bank')}" onerror="this.src='https://via.placeholder.com/50?text=Bank'">
          <div>
            <div style="font-weight:700; color:var(--navy);">${escapeHtml(b.bankName || 'Ngân hàng')}</div>
            <div style="color:var(--text-muted); font-size:0.88rem;">STK: ${escapeHtml(b.accNum || '')}</div>
          </div>
        </div>
        <button type="button" class="btn-qr">📲 Xem mã QR</button>
      `;
      bankCard.querySelector('.btn-qr').onclick = () => {
        showQrModal(b.bankName || '', b.accNum || '', b.qrUrl || '', m.name || '');
      };
      bList.appendChild(bankCard);
    });
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
  preview.src = input.value.trim() || 'https://via.placeholder.com/150?text=No+Img';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

function showHome() {
  document.getElementById('homeView').classList.remove('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  if (isSelectMode) document.getElementById('batchActionToolbar').classList.remove('hidden');
  renderGrid();
}

function openForm(member = null) {
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('formView').classList.remove('hidden');

  const form = document.getElementById('memberForm');
  form.reset();
  document.getElementById('bankInputs').innerHTML = '';
  document.getElementById('fAvatarPreview').src = 'https://via.placeholder.com/150?text=No+Img';

  if (member) {
    document.getElementById('formHeading').innerText = 'Chỉnh sửa thông tin';
    document.getElementById('fId').value = member.id;
    document.getElementById('fType').value = member.type;
    document.getElementById('fName').value = member.name;
    document.getElementById('fAvatarUrl').value = member.avatar && !member.avatar.startsWith('data:') ? member.avatar : '';
    document.getElementById('fAvatarPreview').src = member.avatar || 'https://via.placeholder.com/150?text=No+Img';
    document.getElementById('fDob').value = member.dob || '';
    document.getElementById('fPob').value = member.pob;
    document.getElementById('fCccd').value = member.cccd;
    document.getElementById('fCccdDate').value = member.cccdDate || '';
    document.getElementById('fBhyt').value = member.bhyt;
    document.getElementById('fBhxh').value = member.bhxh || '';
    document.getElementById('fTax').value = member.tax;
    document.getElementById('fSpecialCode').value = member.specialCode;
    document.getElementById('fNotesEditor').innerHTML = member.notes || '';

    if (member.banks) member.banks.forEach(b => addBankRow(b.bankName, b.accNum, b.logo, b.qrUrl));
  } else {
    document.getElementById('formHeading').innerText = 'Thêm thành viên mới';
    document.getElementById('fId').value = '';
    document.getElementById('fBhxh').value = '';
    document.getElementById('fNotesEditor').innerHTML = '';
  }
  toggleSpecialInput();
}

function toggleSpecialInput() {
  const type = document.getElementById('fType').value;
  document.getElementById('fSpecialLabel').innerText = type === 'child' ? 'Mã học sinh' : 'Mã nhân viên';
}

function addBankRow(name = '', acc = '', logo = '', qr = '') {
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

  const currentLogo = logo || (customBankList.find(b => b.name.toLowerCase() === name.toLowerCase()) || {}).logo || 'https://via.placeholder.com/50?text=Bank';

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div class="bank-edit-preview">
        <img class="bank-edit-logo-preview" src="${currentLogo}" onerror="this.src='https://via.placeholder.com/50?text=Bank'">
        <span style="font-size:0.85rem; font-weight:700; color:var(--navy);">Thông tin tài khoản</span>
      </div>
      <button type="button" class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="removeBankRow(this)">🗑️ Xóa tài khoản này</button>
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

    <div>
      <label style="font-size:0.75rem;">Link ảnh mã QR riêng (tùy chọn, để trống sẽ tự tạo QR chuẩn)</label>
      <input type="text" placeholder="https://..." value="${qr || ''}" class="b-qr">
    </div>
  `;
  wrap.appendChild(div);
}

function onBankSelectChange(selectEl) {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const logoUrl = selectedOption.getAttribute('data-logo') || 'https://via.placeholder.com/50?text=Bank';
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
  if (avatarFile && avatarFile.size > 3 * 1024 * 1024) {
    alert('Ảnh đại diện không được vượt quá 3MB.');
    return;
  }

  let avatarData = '';
  if (avatarFile) {
    try {
      avatarData = await readFileAsDataUrl(avatarFile);
    } catch (err) {
      alert(err.message);
      return;
    }
  } else if (avatarUrl) {
    avatarData = avatarUrl;
  } else {
    const existingMember = members.find(m => m.id === id);
    avatarData = existingMember ? existingMember.avatar || '' : '';
  }

  const bankRows = document.querySelectorAll('.bank-edit-row');
  const banks = [];

  bankRows.forEach(row => {
    const bankName = row.querySelector('.b-select').value.trim();
    const accNum = row.querySelector('.b-acc').value.trim();
    const logo = row.querySelector('.b-logo').value.trim();
    const qrUrl = row.querySelector('.b-qr').value.trim();

    if (bankName && accNum) {
      banks.push({ bankName, accNum, logo, qrUrl });
    }
  });

  const notesHtml = document.getElementById('fNotesEditor').innerHTML.trim();

  const memberObj = {
    id: id,
    type: document.getElementById('fType').value,
    name: document.getElementById('fName').value,
    avatar: avatarData,
    dob: dobVal,
    pob: document.getElementById('fPob').value,
    cccd: document.getElementById('fCccd').value,
    cccdDate: cccdDateVal,
    bhyt: document.getElementById('fBhyt').value,
    bhxh: document.getElementById('fBhxh').value.trim(),
    tax: document.getElementById('fTax').value,
    specialCode: document.getElementById('fSpecialCode').value,
    notes: notesHtml,
    banks: banks
  };

  const idx = members.findIndex(m => m.id === id);
  if (idx >= 0) {
    memberObj.documents = members[idx].documents || [];
    members[idx] = memberObj;
  } else {
    memberObj.documents = [];
    members.push(memberObj);
  }

  const btn = document.getElementById('btnSaveMember');
  btn.innerText = 'Đang lưu lên Firebase...';
  try {
    await pushToFirebase();
    viewDetails(id);
  } catch (err) {
    alert('Lỗi lưu dữ liệu: ' + err.message);
  } finally {
    btn.innerText = 'Lưu hồ sơ';
  }
}

function cancelForm() {
  if (currentMemberId) viewDetails(currentMemberId);
  else showHome();
}

function editCurrentMember() {
  const m = members.find(item => item.id === currentMemberId);
  if (m) openForm(m);
}

async function deleteCurrentMember() {
  if (confirm('Bạn có chắc muốn xoá hồ sơ này?')) {
    members = members.filter(m => m.id !== currentMemberId);
    try {
      await pushToFirebase();
      showHome();
    } catch (err) {
      alert('Lỗi xóa dữ liệu: ' + err.message);
    }
  }
}

// ============================================================
// LOGIC FILE EXPLORER: QUẢN LÝ THƯ MỤC & FILE CHI TIẾT
// ============================================================

// Mở màn hình Hồ sơ cá nhân
function openDocsView(memberId = null) {
  const targetId = memberId || currentMemberId;
  const m = members.find(item => item.id === targetId);
  if (!m) {
    alert('Không tìm thấy thông tin thành viên!');
    return;
  }
  currentMemberId = targetId;

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.remove('hidden');

  document.getElementById('docsOwnerName').innerText = `📁 Hồ sơ cá nhân: ${m.name}`;
  renderDocsFolders();
}

// 1. Màn hình ngoài: Danh sách các thư mục loại giấy tờ
function renderDocsFolders() {
  currentDocsFolder = null;
  const m = members.find(item => item.id === currentMemberId);
  if (!m) return;

  document.getElementById('docsBreadcrumb').innerText = '📂 Thư mục gốc (Chọn loại giấy tờ để xem chi tiết)';
  document.getElementById('folderBackBtn').classList.add('hidden');

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const docs = m.documents || [];
  if (docs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 45px; color: var(--text-muted); background: #fafbfd; border-radius: 12px; border: 1px dashed var(--border-color);">
        <div style="font-size:2.5rem; margin-bottom:8px;">📂</div>
        Chưa có giấy tờ lưu trữ nào.<br>Bấm <b>"＋ Tải lên tệp giấy tờ"</b> ở trên để tải mặt trước/sau CCCD, sổ hồng, khai sinh...
      </div>
    `;
    return;
  }

  // Nhóm file theo loại giấy tờ (docType)
  const folderMap = {};
  docs.forEach(d => {
    const type = d.docType || 'Giấy tờ khác';
    if (!folderMap[type]) folderMap[type] = [];
    folderMap[type].push(d);
  });

  const grid = document.createElement('div');
  grid.className = 'folder-grid';

  Object.keys(folderMap).forEach(type => {
    const files = folderMap[type];
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.innerHTML = `
      <div class="folder-icon">📁</div>
      <div class="folder-info">
        <div class="folder-name" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        <div class="folder-count">${files.length} tệp đính kèm</div>
        <span class="folder-badge">Xem chi tiết ➔</span>
      </div>
    `;
    card.onclick = () => {
      openFolderDetails(type);
    };
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// 2. Màn hình trong: Chi tiết danh sách các ảnh/tệp của loại giấy tờ đó (File Explorer Detail View)
function openFolderDetails(docType) {
  currentDocsFolder = docType;
  const m = members.find(item => item.id === currentMemberId);
  if (!m) return;

  document.getElementById('docsBreadcrumb').innerHTML = `📂 Thư mục gốc ➔ <strong style="color:var(--navy);">${escapeHtml(docType)}</strong>`;
  document.getElementById('folderBackBtn').classList.remove('hidden');

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const files = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === docType);

  if (files.length === 0) {
    renderDocsFolders();
    return;
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'files-table-wrap';

  let rowsHtml = '';
  files.forEach((doc, idx) => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const thumbHtml = isPdf
      ? `<div class="file-thumb-pdf">PDF</div>`
      : `<img src="${doc.data}" class="file-thumb" alt="Thumbnail">`;

    const labelName = doc.desc ? `<strong>${escapeHtml(doc.desc)}</strong> (${escapeHtml(doc.fileName)})` : `<strong>${escapeHtml(doc.fileName)}</strong>`;

    rowsHtml += `
      <tr>
        <td style="width: 40px; text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td style="width: 50px; text-align: center;">${thumbHtml}</td>
        <td>
          <div style="font-size:0.92rem; color:var(--navy);">${labelName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Loại: ${isPdf ? 'Tài liệu PDF' : 'Hình ảnh'}</div>
        </td>
        <td style="color: var(--text-muted); font-size: 0.82rem; width: 110px;">${escapeHtml(doc.createdAt || '-')}</td>
        <td style="text-align: right; width: 140px; white-space: nowrap;">
          <a class="btn-view-link btn-view-file" data-id="${doc.id}">👁️ View</a>
          <button type="button" class="btn-danger btn-del-file" data-id="${doc.id}" style="padding: 4px 8px; font-size: 0.75rem; margin-left: 10px;">🗑️ Xóa</button>
        </td>
      </tr>
    `;
  });

  tableWrap.innerHTML = `
    <table class="files-table">
      <thead>
        <tr>
          <th style="text-align:center;">#</th>
          <th style="text-align:center;">Xem trước</th>
          <th>Tên tệp / Trang mô tả</th>
          <th>Ngày tải lên</th>
          <th style="text-align:right;">Thao tác</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  // Gán sự kiện cho từng dòng
  tableWrap.querySelectorAll('.btn-view-file').forEach(btn => {
    btn.onclick = () => openDocumentInNewTab(btn.getAttribute('data-id'));
  });

  tableWrap.querySelectorAll('.btn-del-file').forEach(btn => {
    btn.onclick = () => deleteDocument(btn.getAttribute('data-id'));
  });

  container.appendChild(tableWrap);
}

// Lưu tài liệu mới
async function saveDocument() {
  const m = members.find(item => item.id === currentMemberId);
  if (!m) return;

  const typeSel = document.getElementById('docTypeSelect').value;
  const docType = typeSel === 'custom' 
    ? (document.getElementById('docCustomName').value.trim() || 'Tài liệu khác')
    : typeSel;
  
  const desc = document.getElementById('docDesc').value.trim();
  const fileInput = document.getElementById('docFileInput');

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Vui lòng chọn 1 tệp hình ảnh hoặc PDF để tải lên!');
    return;
  }

  const file = fileInput.files[0];
  const btn = document.getElementById('btnSaveDoc');
  btn.innerText = 'Đang mã hóa & lưu...';

  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64Data = e.target.result;
    
    if (!m.documents) m.documents = [];
    
    const newDoc = {
      id: String(Date.now()),
      docType: docType,
      fileName: file.name,
      fileType: file.type,
      desc: desc,
      data: base64Data,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    m.documents.push(newDoc);

    try {
      await pushToFirebase();
      closeUploadDocModal();
      
      // Nếu đang đứng trong thư mục đó thì refresh tại chỗ, ngược lại về danh mục ngoài
      if (currentDocsFolder && currentDocsFolder === docType) {
        openFolderDetails(docType);
      } else {
        renderDocsFolders();
      }
      alert('Đã tải lên và lưu giấy tờ thành công!');
    } catch (err) {
      alert('Lỗi khi lưu tài liệu: ' + err.message);
    } finally {
      btn.innerText = 'Tải lên & Lưu';
    }
  };

  reader.readAsDataURL(file);
}

// Mở tài liệu ở tab mới
function openDocumentInNewTab(docId) {
  const m = members.find(item => item.id === currentMemberId);
  if (!m || !m.documents) return;

  const doc = m.documents.find(d => String(d.id) === String(docId));
  if (!doc) {
    alert('Không tìm thấy tài liệu này!');
    return;
  }

  const newTab = window.open('about:blank', '_blank');
  if (!newTab) {
    alert('Trình duyệt đã chặn popup. Vui lòng cho phép popup để mở xem tài liệu!');
    return;
  }

  if (doc.fileType && doc.fileType.includes('pdf')) {
    newTab.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>${escapeHtml(doc.fileName)}</title></head>
      <body style="margin:0; padding:0; height:100vh; overflow:hidden;">
        <iframe src="${doc.data}" frameborder="0" style="width:100%; height:100%; border:none;"></iframe>
      </body>
      </html>
    `);
  } else {
    newTab.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(doc.fileName)}</title>
        <style>
          body { margin:0; background:#0f172a; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .top-info { position:fixed; top:12px; background:rgba(0,0,0,0.75); padding:8px 18px; border-radius:30px; color:#ffffff; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.3); }
          img { max-width:95vw; max-height:88vh; border-radius:8px; box-shadow:0 15px 35px rgba(0,0,0,0.5); object-fit:contain; }
        </style>
      </head>
      <body>
        <div class="top-info">${escapeHtml(doc.docType)}: <b>${escapeHtml(doc.desc || doc.fileName)}</b></div>
        <img src="${doc.data}" alt="Preview">
      </body>
      </html>
    `);
  }
  newTab.document.close();
}

// Xóa tài liệu
async function deleteDocument(docId) {
  const m = members.find(item => item.id === currentMemberId);
  if (!m || !m.documents) return;

  if (confirm('Bạn có chắc chắn muốn xóa tệp giấy tờ này?')) {
    m.documents = m.documents.filter(d => String(d.id) !== String(docId));
    try {
      await pushToFirebase();
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