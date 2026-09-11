// Đăng nhập và giải mã dữ liệu
async function handleAuth(e) {
  e.preventDefault();
  const pwd = document.getElementById('authPwd').value.trim();
  const btn = document.getElementById('btnUnlock');
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';

  btn.innerText = 'Đang kiểm tra...';
  try {
    const res = await fetch(`${FIREBASE_DB_URL}data.json`);
    if (!res.ok) throw new Error(`Firebase trả về mã lỗi ${res.status}.`);
    const cloudData = await res.json();

    if (!cloudData) {
      masterPassword = pwd;
      members = [];
      customBankList = [...DEFAULT_BANKS];
      await pushToFirebase();
      unlockApp();
    } else {
      try {
        if (typeof CryptoJS === 'undefined') {
          throw new Error('Không tải được thư viện mã hóa CryptoJS. Hãy kiểm tra kết nối mạng rồi tải lại trang.');
        }

        const encryptedData = typeof cloudData === 'string' ? cloudData : cloudData.data;
        if (!encryptedData || typeof encryptedData !== 'string') {
          throw new Error('Dữ liệu Firebase không đúng định dạng mã hóa.');
        }

        const bytes = CryptoJS.AES.decrypt(encryptedData, pwd);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedStr) throw new Error();
        
        const parsed = JSON.parse(decryptedStr);
        if (Array.isArray(parsed)) {
          members = parsed;
          customBankList = [...DEFAULT_BANKS];
        } else {
          members = parsed.members || [];
          customBankList = parsed.customBankList || [...DEFAULT_BANKS];
        }

        masterPassword = pwd;
        unlockApp();
      } catch (err) {
        const isPasswordError = !err.message
          || err.message.includes('Malformed UTF-8')
          || err.message.includes('Unexpected end of JSON input');
        errEl.innerText = isPasswordError
          ? 'Mật khẩu không chính xác hoặc dữ liệu không thể giải mã.'
          : err.message;
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    errEl.innerText = 'Lỗi kết nối Firebase: ' + err.message;
    errEl.style.display = 'block';
  } finally {
    btn.innerText = 'Mở khóa';
  }
}

// Lưu lên Firebase
async function pushToFirebase() {
  const payload = {
    members: members,
    customBankList: customBankList
  };
  const cipherText = CryptoJS.AES.encrypt(JSON.stringify(payload), masterPassword).toString();
  const res = await fetch(`${FIREBASE_DB_URL}data.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cipherText)
  });
  if (!res.ok) throw new Error('Không thể lưu dữ liệu lên đám mây!');
}

function unlockApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  renderGrid();
}

function lockApp() {
  masterPassword = null;
  members = [];
  selectedIds.clear();
  isSelectMode = false;
  document.getElementById('authPwd').value = '';
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}
