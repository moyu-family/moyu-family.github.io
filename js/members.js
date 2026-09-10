// Kéo thả sắp xếp
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

// Chế độ chọn / Bulk Actions
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

// Bảng tổng hợp (Đã bổ sung cột BHXH)
function openSummaryTable() {
  let targetMembers = members;
  if (selectedIds.size > 0) {
    targetMembers = members.filter(m => selectedIds.has(m.id));
  }

  const tbody = document.getElementById('summaryTableBody');
  tbody.innerHTML = '';

  targetMembers.forEach((m, idx) => {
    const bankDetails = (m.banks || []).map(b => `${b.bankName}: ${b.accNum}`).join('<br>');
    const roleText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td><strong>${m.name}</strong></td>
      <td>${roleText}</td>
      <td>${m.dob || '-'}</td>
      <td>${m.pob || '-'}</td>
      <td>${m.cccd || '-'}</td>
      <td>${m.cccdDate || '-'}</td>
      <td>${m.bhyt || '-'}</td>
      <td>${m.bhxh || '-'}</td>
      <td>${m.tax || '-'}</td>
      <td>${m.specialCode || '-'}</td>
      <td>${bankDetails || '-'}</td>
      <td><div class="rich-display">${m.notes || '-'}</div></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('batchActionToolbar').classList.add('hidden');
  document.getElementById('tableView').classList.remove('hidden');
}

function copyTableData() {
  const table = document.getElementById('summaryTableElement');
  let text = '';
  for (let row of table.rows) {
    let rowData = [];
    for (let cell of row.cells) {
      rowData.push(`"${cell.innerText.replace(/"/g, '""').replace(/\n/g, ' - ')}"`);
    }
    text += rowData.join('\t') + '\n';
  }

  navigator.clipboard.writeText(text).then(() => {
    alert('Đã sao chép bảng thành công! Bạn có thể dán trực tiếp vào Excel hoặc Google Sheets.');
  }).catch(() => {
    alert('Không thể tự động sao chép, vui lòng bôi đen bảng để copy thủ công.');
  });
}

// Render danh sách thẻ
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

    card.innerHTML = `
      ${topControls}
      <div class="avatar-wrap">
        <img src="${m.avatar || 'https://via.placeholder.com/150?text=No+Img'}" onerror="this.src='https://via.placeholder.com/150?text=Error'">
      </div>
      <div class="member-name">${m.name}</div>
      <span class="member-role">${m.type === 'child' ? 'Trẻ em' : 'Người lớn'}</span>
    `;
    grid.appendChild(card);
  });

  initSortable();
}

// Hiển thị chi tiết (Đã bổ sung hiển thị BHXH)
function viewDetails(id) {
  const m = members.find(item => item.id === id);
  if (!m) return;
  currentMemberId = id;
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');

  document.getElementById('dtAvatar').src = m.avatar || 'https://via.placeholder.com/150?text=No+Img';
  document.getElementById('dtName').innerText = m.name;
  document.getElementById('dtRole').innerText = m.type === 'child' ? 'Trẻ em' : 'Người lớn';
  document.getElementById('dtDob').innerText = m.dob || '-';
  document.getElementById('dtPob').innerText = m.pob || '-';
  document.getElementById('dtCccd').innerText = m.cccd || '-';
  document.getElementById('dtCccdDate').innerText = m.cccdDate || '-';
  document.getElementById('dtBhyt').innerText = m.bhyt || '-';
  document.getElementById('dtBhxh').innerText = m.bhxh || '-'; // BỔ SUNG
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
      bList.innerHTML += `
        <div class="bank-card">
          <div class="bank-info-left">
            <img class="bank-logo" src="${b.logo || 'https://via.placeholder.com/50?text=Bank'}" onerror="this.src='https://via.placeholder.com/50?text=Bank'">
            <div>
              <div style="font-weight:700; color:var(--navy);">${b.bankName}</div>
              <div style="color:var(--text-muted); font-size:0.88rem;">STK: ${b.accNum}</div>
            </div>
          </div>
          <button class="btn-qr" onclick="showQrModal('${b.bankName}', '${b.accNum}', '${b.qrUrl || ''}', '${m.name}')">📲 Xem mã QR</button>
        </div>
      `;
    });
  } else {
    bList.innerHTML = '<div style="color:var(--text-muted); font-size:0.88rem;">Chưa có tài khoản ngân hàng nào.</div>';
  }
}

function showHome() {
  document.getElementById('homeView').classList.remove('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  if (isSelectMode) document.getElementById('batchActionToolbar').classList.remove('hidden');
  renderGrid();
}

// Mở form (Đã nạp trường BHXH)
function openForm(member = null) {
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.remove('hidden');

  const form = document.getElementById('memberForm');
  form.reset();
  document.getElementById('bankInputs').innerHTML = '';

  if (member) {
    document.getElementById('formHeading').innerText = 'Chỉnh sửa thông tin';
    document.getElementById('fId').value = member.id;
    document.getElementById('fType').value = member.type;
    document.getElementById('fName').value = member.name;
    document.getElementById('fAvatar').value = member.avatar;
    document.getElementById('fDob').value = member.dob || '';
    document.getElementById('fPob').value = member.pob;
    document.getElementById('fCccd').value = member.cccd;
    document.getElementById('fCccdDate').value = member.cccdDate || '';
    document.getElementById('fBhyt').value = member.bhyt;
    document.getElementById('fBhxh').value = member.bhxh || ''; // BỔ SUNG
    document.getElementById('fTax').value = member.tax;
    document.getElementById('fSpecialCode').value = member.specialCode;
    document.getElementById('fNotesEditor').innerHTML = member.notes || '';

    if (member.banks) member.banks.forEach(b => addBankRow(b.bankName, b.accNum, b.logo, b.qrUrl));
  } else {
    document.getElementById('formHeading').innerText = 'Thêm thành viên mới';
    document.getElementById('fId').value = '';
    document.getElementById('fBhxh').value = ''; // BỔ SUNG
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

// Lưu thông tin (Đã bổ sung lưu BHXH)
async function saveMember(e) {
  e.preventDefault();
  const dobVal = document.getElementById('fDob').value.trim();
  const cccdDateVal = document.getElementById('fCccdDate').value.trim();

  if (!isValidDateVN(dobVal)) { alert('Ngày sinh không đúng định dạng dd/mm/yyyy'); return; }
  if (!isValidDateVN(cccdDateVal)) { alert('Ngày cấp CCCD không đúng định dạng dd/mm/yyyy'); return; }

  const id = document.getElementById('fId').value || Date.now().toString();
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
    avatar: document.getElementById('fAvatar').value,
    dob: dobVal,
    pob: document.getElementById('fPob').value,
    cccd: document.getElementById('fCccd').value,
    cccdDate: cccdDateVal,
    bhyt: document.getElementById('fBhyt').value,
    bhxh: document.getElementById('fBhxh').value.trim(), // BỔ SUNG
    tax: document.getElementById('fTax').value,
    specialCode: document.getElementById('fSpecialCode').value,
    notes: notesHtml,
    banks: banks
  };

  const idx = members.findIndex(m => m.id === id);
  if (idx >= 0) members[idx] = memberObj;
  else members.push(memberObj);

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
