// Biến theo dõi thư mục giấy tờ hiện tại
let currentDocsFolder = null;
let editingDocId = null;
let docsSortMode = 'date-desc'; // 'date-desc' | 'date-asc' | 'desc-asc'
let newFolderDocType = null;

function setMemberManagementButtonVisible(visible) {
  ['btnSummaryTable', 'btnAddMember'].forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) button.classList.toggle('hidden', !visible);
  });
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

// Mở màn hình Hồ sơ cá nhân
function openDocsView(memberId = null, skipHistory = false) {
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
    navigateApp('documents', { id: targetId });
    return;
  }

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.add('hidden');
  document.getElementById('docsView').classList.remove('hidden');

  isDocSelectMode = false;
  selectedDocIds.clear();
  selectedFolderIds.clear();
  document.getElementById('docsBatchToolbar').classList.add('hidden');
  setBtnLabel(document.getElementById('btnToggleDocSelect'), 'checkSquare', 'Chọn nhiều tệp');

  document.getElementById('docsOwnerName').querySelector('.btn-text').innerText =
    m.id === FAMILY_SHARED_ID ? m.name : `Giấy tờ cá nhân: ${m.name}`;
  renderDocsFolders();
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

function openConsolidatedView(skipHistory = false) {
  setMemberManagementButtonVisible(false);
  if (!skipHistory) {
    navigateApp('consolidated');
    return;
  }

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('tableView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('docsView').classList.add('hidden');
  document.getElementById('consolidatedView').classList.remove('hidden');

  currentConsolidatedTagFilter = null;
  renderConsolidatedCategories();
}

// Nút "Quay lại" trong Hồ sơ tổng hợp: nếu đang xem chi tiết 1 danh mục thì quay lại danh sách danh mục,
// nếu đang ở danh sách danh mục thì quay lại trang trước đó (lịch sử trình duyệt).
function goBackFromConsolidatedView() {
  if (currentConsolidatedCategory) renderConsolidatedCategories();
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
  if (currentConsolidatedCategory) openConsolidatedCategoryDetails(currentConsolidatedCategory);
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

  if (types.length === 0) {
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
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Xem chi tiết danh mục ${type}`);
    card.innerHTML = `
      <div class="folder-icon">${svgIcon('folder')}</div>
      <div class="folder-info">
        <div class="folder-name" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        <div class="folder-count">${files.length} tệp · ${ownerCount} thành viên</div>
        <span class="folder-badge">Xem chi tiết${svgIcon('arrowRight')}</span>
      </div>
    `;
    const openCategory = () => openConsolidatedCategoryDetails(type);
    card.onclick = openCategory;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(); }
    };
    grid.appendChild(card);
  });

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

  const map = buildConsolidatedMap(consolidatedFilterPredicate());
  const files = (map[docType] || []).slice().sort((a, b) => {
    const byOwner = (a.ownerName || '').localeCompare(b.ownerName || '', 'vi', { sensitivity: 'base' });
    return byOwner !== 0 ? byOwner : Number(b.id) - Number(a.id);
  });

  if (files.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);">${currentConsolidatedTagFilter ? 'Không có tệp nào trong danh mục này khớp với bộ lọc đang chọn.' : 'Chưa có tệp nào trong danh mục này.'}</div>`;
    return;
  }

  const filesList = document.createElement('div');
  filesList.className = 'files-list';

  files.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const card = document.createElement('article');
    card.className = 'file-card';
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`);
    card.innerHTML = `
      <button type="button" class="file-preview-button" title="Bấm để phóng lớn">${thumb}</button>
      <div class="file-card-info">
        <strong>${escapeHtml(doc.desc || 'Chưa có mô tả')}</strong>
        <div class="folder-badge" style="margin-top:4px;">👤 ${escapeHtml(doc.ownerName || 'Không rõ')}</div>
      </div>
      <div class="file-actions-scroll" aria-label="Thao tác giấy tờ">
        <button type="button" class="btn-outline file-action-button btn-view-file" title="Xem tài liệu" aria-label="Xem tài liệu">${svgIcon('eye')}</button>
        <button type="button" class="btn-outline file-action-button btn-goto-owner" title="Đến hồ sơ thành viên" aria-label="Đến hồ sơ thành viên">${svgIcon('arrowRight')}</button>
      </div>
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
    card.querySelector('.btn-view-file').onclick = () => showDocumentPreview(doc, relatedForPreview);
    card.querySelector('.btn-goto-owner').onclick = () => openDocsView(doc.ownerId);
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

// Thanh chuyển đổi hiển thị dạng lưới / dạng danh sách (kiểu Google Drive)
function renderViewToggleBar() {
  const bar = document.createElement('div');
  bar.className = 'docs-view-toggle';
  bar.innerHTML = `
    <button type="button" class="view-toggle-btn ${docsViewMode === 'grid' ? 'active' : ''}" title="Dạng lưới">${iconSpan('grid')}Lưới</button>
    <button type="button" class="view-toggle-btn ${docsViewMode === 'list' ? 'active' : ''}" title="Dạng danh sách">${iconSpan('list')}Danh sách</button>
  `;
  const [gridBtn, listBtn] = bar.querySelectorAll('.view-toggle-btn');
  gridBtn.onclick = () => setDocsViewMode('grid');
  listBtn.onclick = () => setDocsViewMode('list');
  return bar;
}

function setDocsViewMode(mode) {
  docsViewMode = mode;
  try { localStorage.setItem('docsViewMode', mode); } catch (e) { /* ignore */ }
  if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
  else renderDocsFolders();
}

// 1. Màn hình ngoài: Danh sách các thư mục loại giấy tờ
function renderDocsFolders() {
  currentDocsFolder = null;
  currentSubfolderId = null;
  selectedDocIds.clear();
  selectedFolderIds.clear();
  document.getElementById('docsBatchToolbar').classList.add('hidden');
  updateDocsBackBtnLabel();
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  document.getElementById('docsBreadcrumb').innerHTML = `${svgIcon('folder')}<span>Tất cả danh mục (Chọn loại giấy tờ để xem chi tiết)</span>`;

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const docs = m.documents || [];
  const folders = m.folders || [];
  const categories = m.categories || [];

  const toolsBar = document.createElement('div');
  toolsBar.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:14px;';
  const newCategoryBtn = document.createElement('button');
  newCategoryBtn.type = 'button';
  newCategoryBtn.className = 'btn-outline';
  newCategoryBtn.innerHTML = `${iconSpan('plus')}Danh mục mới`;
  newCategoryBtn.onclick = () => openNewCategoryModal();
  toolsBar.appendChild(newCategoryBtn);
  container.appendChild(toolsBar);

  if (docs.length === 0 && folders.length === 0 && categories.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center; padding: 45px; color: var(--text-muted); background: #fafbfd; border-radius: 12px; border: 1px dashed var(--border-color);';
    empty.innerHTML = `
      <div style="display:flex; justify-content:center; margin-bottom:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px; height:40px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
      Chưa có giấy tờ lưu trữ nào.<br>Bấm <b>"Tải lên tệp giấy tờ"</b> ở trên để tải mặt trước/sau CCCD, sổ hồng, khai sinh..., hoặc <b>"Danh mục mới"</b> để tạo danh mục trống.
    `;
    container.appendChild(empty);
    return;
  }

  // Nhóm file theo loại giấy tờ (docType)
  const folderMap = {};
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

  Object.keys(folderMap).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })).forEach(type => {
    const files = folderMap[type];
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Mở danh mục ${type}`);
    card.innerHTML = `
      <div class="folder-icon">${svgIcon('folder')}</div>
      <div class="folder-info">
        <div class="folder-name" title="${escapeHtml(type)}">${escapeHtml(type)}</div>
        <div class="folder-count">${files.length} tệp đính kèm</div>
        <span class="folder-badge">Xem chi tiết${svgIcon('arrowRight')}</span>
      </div>
      <button type="button" class="btn-outline file-action-button btn-edit-category" title="Đổi tên danh mục" aria-label="Đổi tên danh mục" style="flex:0 0 auto;">${svgIcon('edit')}</button>
      <button type="button" class="btn-danger file-action-button btn-del-category" title="Xóa danh mục" aria-label="Xóa danh mục" style="flex:0 0 auto;">${svgIcon('trash')}</button>
    `;
    card.querySelector('.btn-edit-category').onclick = (e) => { e.stopPropagation(); openEditCategoryModal(type); };
    card.querySelector('.btn-del-category').onclick = (e) => { e.stopPropagation(); deleteCategory(type); };
    const openThisFolder = () => { openFolderDetails(type); };
    card.onclick = openThisFolder;
    card.onkeydown = (e) => {
      if (e.target !== card) return; // không kích hoạt khi phím bấm đến từ nút sửa/xóa lồng bên trong
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThisFolder(); }
    };
    grid.appendChild(card);
  });

  container.appendChild(grid);
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
  setBtnLabel(document.getElementById('btnToggleDocSelect'), isDocSelectMode ? 'close' : 'checkSquare', isDocSelectMode ? 'Thoát chọn' : 'Chọn nhiều tệp');
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
let editingCategoryName = null;

// Toàn bộ tên danh mục (docType) hiện có của 1 thành viên, kể cả danh mục rỗng vừa tạo (m.categories)
function getAllCategoryNames(m) {
  const names = new Set();
  (m.documents || []).forEach(d => names.add(d.docType || 'Giấy tờ khác'));
  (m.folders || []).forEach(f => names.add(f.docType));
  (m.categories || []).forEach(name => names.add(name));
  return [...names];
}

function openNewCategoryModal() {
  editingCategoryName = null;
  document.getElementById('categoryModalTitle').innerText = 'Tạo danh mục mới';
  document.getElementById('btnSaveCategory').innerText = 'Tạo danh mục';
  document.getElementById('categoryNameInput').value = '';
  document.getElementById('categoryModal').classList.remove('hidden');
}

function openEditCategoryModal(docType) {
  editingCategoryName = docType;
  document.getElementById('categoryModalTitle').innerText = 'Đổi tên danh mục';
  document.getElementById('btnSaveCategory').innerText = 'Lưu';
  document.getElementById('categoryNameInput').value = docType;
  document.getElementById('categoryModal').classList.remove('hidden');
}

function closeCategoryModal() {
  editingCategoryName = null;
  document.getElementById('categoryModal').classList.add('hidden');
}

async function saveCategory() {
  const name = document.getElementById('categoryNameInput').value.trim();
  if (!name) {
    alert('Vui lòng nhập tên danh mục!');
    return;
  }
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;
  if (!m.categories) m.categories = [];

  const duplicate = getAllCategoryNames(m).some(n => n.toLowerCase() === name.toLowerCase() && n !== editingCategoryName);
  if (duplicate) {
    alert('Danh mục này đã tồn tại!');
    return;
  }

  const btn = document.getElementById('btnSaveCategory');

  if (editingCategoryName) {
    const oldName = editingCategoryName;
    if (oldName === name) { closeCategoryModal(); return; }
    (m.documents || []).forEach(d => { if ((d.docType || 'Giấy tờ khác') === oldName) d.docType = name; });
    (m.folders || []).forEach(f => { if (f.docType === oldName) f.docType = name; });
    m.categories = (m.categories || []).map(n => n === oldName ? name : n);

    btn.innerText = 'Đang lưu...';
    try {
      await pushToFirebase();
      if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
      closeCategoryModal();
      renderDocsFolders();
    } catch (err) {
      alert('Lỗi đổi tên danh mục: ' + err.message);
    } finally {
      btn.innerText = 'Lưu';
    }
    return;
  }

  m.categories.push(name);
  btn.innerText = 'Đang tạo...';
  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closeCategoryModal();
    renderDocsFolders();
  } catch (err) {
    m.categories = m.categories.filter(n => n !== name);
    alert('Lỗi tạo danh mục: ' + err.message);
  } finally {
    btn.innerText = 'Tạo danh mục';
  }
}

async function deleteCategory(docType) {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  const fileCount = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === docType).length;
  const folderCount = (m.folders || []).filter(f => f.docType === docType).length;
  const detail = (fileCount || folderCount)
    ? ` Toàn bộ ${fileCount} tệp và ${folderCount} thư mục con bên trong sẽ bị xóa vĩnh viễn.`
    : '';
  if (!confirm(`Xóa danh mục "${docType}"?${detail}`)) return;

  (m.documents || []).forEach(d => {
    if ((d.docType || 'Giấy tờ khác') === docType && decryptedDocumentUrlCache.has(d.id)) {
      URL.revokeObjectURL(decryptedDocumentUrlCache.get(d.id));
      decryptedDocumentUrlCache.delete(d.id);
    }
  });
  m.documents = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') !== docType);
  m.folders = (m.folders || []).filter(f => f.docType !== docType);
  m.categories = (m.categories || []).filter(n => n !== docType);

  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    renderDocsFolders();
  } catch (err) {
    alert('Lỗi xóa danh mục: ' + err.message);
  }
}

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
    const btn = menu.parentElement?.querySelector('.file-kebab-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.file-row-menu')) closeAllFileKebabMenus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllFileKebabMenus();
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
  const ancestorChain = getFolderAncestorChain(m, subfolderId);
  const isAtCategoryRoot = !subfolderId;
  const docTypeEscaped = escapeHtml(docType).replace(/'/g, "\\'");
  const crumbLink = (label, onclick) => `<a href="javascript:void(0)" onclick="${onclick}" class="breadcrumb-link">${label}</a>`;
  const breadcrumbParts = [
    crumbLink('Tất cả danh mục', 'renderDocsFolders()'),
    isAtCategoryRoot
      ? `<strong class="breadcrumb-current">${escapeHtml(docType)}</strong>`
      : crumbLink(escapeHtml(docType), `openFolderDetails('${docTypeEscaped}')`)
  ];
  ancestorChain.forEach((f, idx) => {
    const isLast = idx === ancestorChain.length - 1;
    breadcrumbParts.push(isLast
      ? `<strong class="breadcrumb-current">${escapeHtml(f.name)}</strong>`
      : crumbLink(escapeHtml(f.name), `openFolderDetails('${docTypeEscaped}', '${escapeHtml(f.id).replace(/'/g, "\\'")}')`));
  });
  const breadcrumbSep = `<span class="breadcrumb-sep">${svgIcon('arrowRight')}</span>`;
  document.getElementById('docsBreadcrumb').innerHTML = svgIcon('folder') + breadcrumbParts.join(breadcrumbSep);

  const container = document.getElementById('docsExplorerContent');
  container.innerHTML = '';

  const allTypeDocs = (m.documents || []).filter(d => (d.docType || 'Giấy tờ khác') === docType);
  const allTypeFolders = (m.folders || []).filter(f => f.docType === docType);
  const childFolders = allTypeFolders.filter(f => (f.parentId || null) === (subfolderId || null));

  if (!subfolder && allTypeDocs.length === 0 && allTypeFolders.length === 0) {
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
          <div class="folder-count">${count} tệp đính kèm</div>
          <span class="folder-badge">Mở thư mục${svgIcon('arrowRight')}</span>
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
  openEditDocModal(doc.docType || 'Giấy tờ khác', doc.desc);
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

// Lưu tài liệu mới
async function saveDocument() {
  const m = members.find(item => String(item.id) === String(currentMemberId));
  if (!m) return;

  const typeSel = document.getElementById('docTypeSelect').value;
  const docType = typeSel === 'custom' 
    ? (document.getElementById('docCustomName').value.trim() || 'Tài liệu khác')
    : typeSel;
  
  if (!pendingUploadFiles || pendingUploadFiles.length === 0) {
    alert('Vui lòng chọn ít nhất 1 tệp hình ảnh hoặc PDF để tải lên!');
    return;
  }

  const files = pendingUploadFiles.map(entry => entry.file);
  const descList = pendingUploadFiles.map(entry => (entry.desc || '').trim());
  const btn = document.getElementById('btnSaveDoc');
  if (!m.documents) m.documents = [];
  if (!m.folders) m.folders = [];

  const folderSel = document.getElementById('docFolderSelect').value;
  let targetFolderId = null;
  let createdFolder = null;
  if (folderSel === '__new__') {
    const newFolderName = document.getElementById('docNewFolderName').value.trim();
    if (!newFolderName) {
      alert('Vui lòng nhập tên thư mục mới, hoặc chọn "Thư mục gốc của danh mục"!');
      return;
    }
    const existing = m.folders.find(f => f.docType === docType && !f.parentId && f.name.toLowerCase() === newFolderName.toLowerCase());
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
      m.folders.push(createdFolder);
      targetFolderId = createdFolder.id;
    }
  } else if (folderSel) {
    targetFolderId = folderSel;
  }

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      btn.innerText = files.length > 1
        ? `Đang tải tệp ${i + 1}/${files.length}...`
        : 'Đang tải tệp & lưu...';
      const documentId = String(Date.now() + i);
      const storageUrl = await uploadEncryptedFileToStorage(file, `documents/${currentMemberId}/${documentId}-${file.name}`);
      m.documents.push({
        id: documentId,
        docType,
        folderId: targetFolderId,
        fileName: file.name,
        fileType: file.type,
        desc: descList[i] || file.name,
        data: storageUrl,
        encrypted: true,
        createdAt: new Date().toLocaleDateString('vi-VN')
      });
    }
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closeUploadDocModal();
    if (currentDocsFolder && currentDocsFolder === docType) openFolderDetails(docType, targetFolderId);
    else renderDocsFolders();
    alert(files.length > 1 ? `Đã tải lên và lưu ${files.length} tệp thành công!` : 'Đã tải lên và lưu giấy tờ thành công!');
  } catch (err) {
    if (createdFolder) m.folders = m.folders.filter(f => f.id !== createdFolder.id);
    alert('Lỗi khi lưu tài liệu: ' + err.message);
  } finally {
    btn.innerText = 'Tải lên & Lưu';
  }
}

// ============================================================
// MODAL TẢI NHANH (FAB): upload nhiều tệp cùng lúc cho bất kỳ thành viên nào hoặc cho
// Hồ sơ chung gia đình, kèm chọn danh mục/thư mục con và gắn tag đa thành viên.
// Tái dùng chung 1 kho documents[]/folders[] với modal upload cũ (mỗi tệp chỉ
// khác ở chỗ có thêm mảng tags[]).
//
// "Tải lên & Lưu" bắt buộc phải chọn Chủ sở hữu + Danh mục. "Lưu tạm" chỉ cần có tệp:
// nếu chưa chọn chủ sở hữu, tệp được gửi vào kho "Chưa gán chủ sở hữu" (xem
// ensureUnassignedOwnerMember() trong config.js) để hoàn tất phân loại sau trong "Hồ sơ tạm".
// ============================================================
async function saveGlobalDocument(isDraft = false) {
  if (!globalUploadFiles || globalUploadFiles.length === 0) {
    alert('Vui lòng chọn ít nhất 1 ảnh/tệp giấy tờ để tải lên!');
    return;
  }

  const ownerSelect = document.getElementById('guOwnerSelect');
  const categorySelect = document.getElementById('guCategorySelect');
  const ownerId = ownerSelect.value;
  const categorySel = categorySelect.value;

  if (!isDraft) {
    const missingFields = [];
    if (!ownerId) missingFields.push(ownerSelect);
    if (!categorySel) missingFields.push(categorySelect);
    if (missingFields.length > 0) {
      missingFields.forEach(shakeInvalidField);
      alert('Vui lòng chọn đầy đủ "Chủ sở hữu chính" và "Danh mục" trước khi Tải lên & Lưu.\nNếu chưa chắc chắn, hãy dùng nút "Lưu tạm" để phân loại sau.');
      return;
    }
  }

  const docType = categorySel === 'custom'
    ? (document.getElementById('guCustomCategoryName').value.trim() || 'Tài liệu khác')
    : categorySel;

  const isNewFamilyProfile = ownerId === FAMILY_SHARED_ID && !members.some(item => String(item.id) === FAMILY_SHARED_ID);
  const isNewUnassignedProfile = !ownerId && !members.some(item => String(item.id) === UNASSIGNED_OWNER_ID);
  const m = ownerId === FAMILY_SHARED_ID
    ? ensureFamilySharedMember()
    : ownerId
      ? members.find(item => String(item.id) === String(ownerId))
      : ensureUnassignedOwnerMember();
  if (!m) {
    alert('Không tìm thấy hồ sơ chủ sở hữu đã chọn!');
    return;
  }
  if (!m.documents) m.documents = [];
  if (!m.folders) m.folders = [];

  const folderSel = document.getElementById('guFolderSelect').value;
  let targetFolderId = null;
  let createdFolder = null;
  if (folderSel === '__new__') {
    const newFolderName = document.getElementById('guNewFolderName').value.trim();
    if (!newFolderName) {
      alert('Vui lòng nhập tên thư mục con mới, hoặc chọn "Thư mục gốc của danh mục"!');
      return;
    }
    const existing = m.folders.find(f => f.docType === docType && !f.parentId && f.name.toLowerCase() === newFolderName.toLowerCase());
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
      m.folders.push(createdFolder);
      targetFolderId = createdFolder.id;
    }
  } else if (folderSel) {
    targetFolderId = folderSel;
  }

  const desc = document.getElementById('guDesc').value.trim();
  const files = globalUploadFiles.map(entry => entry.file);
  const btnId = isDraft ? 'btnSaveGlobalDocDraft' : 'btnSaveGlobalDoc';
  const btn = document.getElementById(btnId);
  const originalBtnLabel = btn.innerHTML;
  const savedDocs = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
      setBtnLabel(btn, isDraft ? 'clock' : 'upload', (isDraft ? 'Đang lưu tạm' : 'Đang tải tệp & lưu') + progress + '...');
      const documentId = 'doc_' + Date.now() + '_' + i;
      const storageUrl = await uploadEncryptedFileToStorage(file, `documents/${m.id}/${documentId}-${file.name}`);
      const doc = {
        id: documentId,
        ownerId: m.id,
        docType,
        folderId: targetFolderId,
        fileName: file.name,
        fileType: file.type,
        desc: (files.length === 1 ? desc : '') || file.name,
        tags: [...globalSelectedTags],
        data: storageUrl,
        encrypted: true,
        status: isDraft ? 'pending' : 'completed',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        uploadedAt: new Date().toISOString()
      };
      m.documents.push(doc);
      savedDocs.push(doc);
    }
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    if (typeof updatePendingDocsBadge === 'function') updatePendingDocsBadge();
    closeGlobalUploadModal();
    if (isDraft) {
      showToast(files.length > 1
        ? `Đã lưu tạm ${files.length} tệp! Vào "Hồ sơ tạm" để hoàn tất phân loại sau.`
        : 'Đã lưu tạm giấy tờ! Vào "Hồ sơ tạm" trên thanh menu để hoàn tất phân loại sau.');
    } else {
      alert(files.length > 1 ? `Đã tải lên và lưu ${files.length} tệp thành công!` : 'Đã tải lên và lưu giấy tờ thành công!');
    }

    // Làm mới màn hình đang xem nếu có liên quan, để người dùng thấy ngay tệp vừa thêm.
    if (!document.getElementById('consolidatedView').classList.contains('hidden')) {
      rerenderConsolidatedCurrentScreen();
    }
    if (!document.getElementById('docsView').classList.contains('hidden') && String(currentMemberId) === String(m.id)) {
      if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
      else renderDocsFolders();
    }
  } catch (err) {
    m.documents = m.documents.filter(d => !savedDocs.includes(d));
    if (createdFolder) m.folders = m.folders.filter(f => f.id !== createdFolder.id);
    if (isNewFamilyProfile && m.documents.length === 0 && m.folders.length === 0) {
      members = members.filter(item => item !== m);
    }
    if (isNewUnassignedProfile && m.documents.length === 0 && m.folders.length === 0) {
      members = members.filter(item => item !== m);
    }
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

function openPendingDocsModal() {
  renderPendingDocsList();
  document.getElementById('pendingDocsModal').classList.remove('hidden');
}

function closePendingDocsModal() {
  document.getElementById('pendingDocsModal').classList.add('hidden');
}

function renderPendingDocsList() {
  const container = document.getElementById('pendingDocsList');
  if (!container) return;
  const pending = getAllPendingDocuments().sort((a, b) => Number(b.id.toString().replace(/\D/g, '') || 0) - Number(a.id.toString().replace(/\D/g, '') || 0));

  if (pending.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); background:#fafbfd; border-radius:12px; border:1px dashed var(--border-color);">Không có tệp nào đang chờ phân loại.</div>`;
    return;
  }

  container.innerHTML = '';
  pending.forEach(doc => {
    const isPdf = doc.fileType && doc.fileType.includes('pdf');
    const row = document.createElement('div');
    row.className = 'pending-doc-row';
    const thumb = isPdf
      ? '<div class="file-thumb file-thumb-pdf">PDF</div>'
      : (doc.encrypted
        ? '<div class="file-thumb file-thumb-loading">⏳</div>'
        : `<img src="${escapeHtml(doc.data)}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`);
    row.innerHTML = `
      <button type="button" class="file-preview-button pending-doc-thumb" title="Xem trước">${thumb}</button>
      <div class="pending-doc-info">
        <strong>${escapeHtml(doc.desc || doc.fileName || 'Chưa có mô tả')}</strong>
        <span class="file-meta-sub">${escapeHtml(doc.ownerName || 'Chưa gán chủ sở hữu')} · ${escapeHtml(doc.docType || 'Chưa phân loại')} · ${escapeHtml(doc.createdAt || '-')}</span>
      </div>
      <div class="pending-doc-actions">
        <button type="button" class="btn-outline file-action-button btn-complete-pending" title="Hoàn tất phân loại" aria-label="Hoàn tất phân loại">${svgIcon('edit')}</button>
        <button type="button" class="btn-danger file-action-button btn-delete-pending" title="Xóa" aria-label="Xóa">${svgIcon('trash')}</button>
      </div>
    `;
    if (!isPdf && doc.encrypted) {
      const previewButton = row.querySelector('.file-preview-button');
      getDocumentDisplayUrl(doc).then(url => {
        previewButton.innerHTML = `<img src="${url}" class="file-thumb" alt="${escapeHtml(doc.desc || 'Xem trước giấy tờ')}">`;
      }).catch(() => {
        previewButton.innerHTML = '<div class="file-thumb file-thumb-pdf">⚠️</div>';
      });
    }
    row.querySelector('.file-preview-button').onclick = () => showDocumentPreview(doc, [doc]);
    row.querySelector('.btn-complete-pending').onclick = () => openPendingCompleteModal(doc.ownerId, doc.id);
    row.querySelector('.btn-delete-pending').onclick = () => deletePendingDocument(doc.ownerId, doc.id);
    container.appendChild(row);
  });
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
    renderPendingDocsList();
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
  document.getElementById('pdOwnerSelect').value = ownerId;

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

  document.getElementById('pendingCompleteModal').classList.remove('hidden');
}

function closePendingCompleteModal() {
  editingPendingDoc = null;
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
    desc: doc.desc, status: doc.status
  };

  if (ownerChanged) {
    sourceMember.documents = (sourceMember.documents || []).filter(d => String(d.id) !== String(docId));
  }

  doc.ownerId = targetMember.id;
  doc.docType = docType;
  doc.folderId = targetFolderId;
  doc.desc = desc || doc.fileName || docType;
  doc.status = 'completed';

  if (ownerChanged) targetMember.documents.push(doc);

  const btn = document.getElementById('btnSavePendingComplete');
  btn.innerText = 'Đang lưu...';
  try {
    await pushToFirebase();
    if (typeof refreshAllDocTypeSelects === 'function') refreshAllDocTypeSelects();
    closePendingCompleteModal();
    renderPendingDocsList();
    updatePendingDocsBadge();
    if (currentMemberId && !document.getElementById('docsView').classList.contains('hidden')) {
      if (currentDocsFolder) openFolderDetails(currentDocsFolder, currentSubfolderId);
      else renderDocsFolders();
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