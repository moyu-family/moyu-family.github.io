const BIOMETRIC_STORAGE_KEY = 'moyu-family-biometric-v1';
const SESSION_PASSWORD_KEY = 'moyu-family-session-password';

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function createRandomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function biometricKey(prfBytes) {
  return CryptoJS.SHA256(CryptoJS.lib.WordArray.create(prfBytes)).toString();
}

function setBiometricStatus(message = '', isError = false) {
  const status = document.getElementById('biometricStatus');
  status.innerText = message;
  status.style.color = isError ? '#e11d48' : 'var(--text-muted)';
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getStoredBiometric() {
  try {
    return JSON.parse(localStorage.getItem(BIOMETRIC_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSessionPassword(password) {
  sessionStorage.setItem(SESSION_PASSWORD_KEY, password);
}

function updateBiometricButton() {
  const button = document.getElementById('btnBiometricUnlock');
  const registerButton = document.getElementById('btnRegisterBiometric');
  const registeredActions = document.getElementById('biometricRegisteredActions');
  const hasBiometric = Boolean(getStoredBiometric());
  if (button) button.classList.toggle('hidden', !hasBiometric);
  if (registerButton) registerButton.classList.toggle('hidden', hasBiometric);
  if (registeredActions) registeredActions.classList.toggle('hidden', !hasBiometric);
}

function removeBiometric() {
  if (!getStoredBiometric()) return;
  if (!confirm('Bạn có chắc muốn xóa Face ID / vân tay khỏi website trên thiết bị này không?')) return;
  localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
  updateBiometricButton();
  setBiometricStatus('Đã xóa liên kết Face ID / vân tay khỏi website.');
}

async function loadDataWithPassword(pwd) {
  const res = await fetch(`${FIREBASE_DB_URL}data.json`);
  if (!res.ok) throw new Error(`Firebase trả về mã lỗi ${res.status}.`);
  const cloudData = await res.json();

  if (!cloudData) {
    masterPassword = pwd;
    saveSessionPassword(pwd);
    members = [];
    customBankList = [...DEFAULT_BANKS];
    await pushToFirebase();
    return;
  }

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
  saveSessionPassword(pwd);
}

function showAuthError(err) {
  const errEl = document.getElementById('authError');
  const isPasswordError = !err.message
    || err.message.includes('Malformed UTF-8')
    || err.message.includes('Unexpected end of JSON input');
  errEl.innerText = isPasswordError
    ? 'Mật khẩu không chính xác hoặc dữ liệu không thể giải mã.'
    : err.message;
  errEl.style.display = 'block';
}

async function handleAuth(e) {
  e.preventDefault();
  const pwd = document.getElementById('authPwd').value.trim();
  const btn = document.getElementById('btnUnlock');
  document.getElementById('authError').style.display = 'none';
  btn.innerText = 'Đang kiểm tra...';
  try {
    await loadDataWithPassword(pwd);
    unlockApp();
  } catch (err) {
    showAuthError(err);
  } finally {
    btn.innerText = 'Mở khóa';
  }
}

async function registerBiometric() {
  const pwd = document.getElementById('authPwd').value.trim();
  if (!pwd) {
    setBiometricStatus('Nhập mật khẩu trước, sau đó bấm đăng ký Face ID / vân tay.', true);
    return;
  }
  if (!window.PublicKeyCredential || !navigator.credentials) {
    setBiometricStatus('Trình duyệt hoặc thiết bị này chưa hỗ trợ Passkey.', true);
    return;
  }
  if (!window.isSecureContext) {
    setBiometricStatus('Face ID / vân tay cần website chạy bằng HTTPS hoặc localhost.', true);
    return;
  }

  const button = document.getElementById('btnRegisterBiometric');
  button.disabled = true;
  setBiometricStatus('Đang tải và xác minh dữ liệu...');
  try {
    await withTimeout(
      loadDataWithPassword(pwd),
      20000,
      'Tải dữ liệu quá lâu. Kiểm tra kết nối mạng rồi thử lại.'
    );
    setBiometricStatus('Đang mở xác nhận Face ID / vân tay...');
    const salt = createRandomBytes();
    const credential = await withTimeout(
      navigator.credentials.create({
        publicKey: {
          challenge: createRandomBytes(),
          rp: { name: 'Hồ sơ gia đình' },
          user: { id: createRandomBytes(), name: 'family-owner', displayName: 'Chủ hồ sơ gia đình' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none',
          extensions: { prf: { eval: { first: salt } } }
        }
      }),
      70000,
      'Không nhận được xác nhận sinh trắc học. Hãy thử lại và hoàn tất Face ID / vân tay trên thiết bị.'
    );
    const prf = credential.getClientExtensionResults().prf;
    const first = prf && prf.results && prf.results.first;
    if (!first) throw new Error('Thiết bị chưa hỗ trợ PRF cho Passkey. Bạn vẫn có thể dùng mật khẩu.');

    const record = {
      credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
      salt: bytesToBase64Url(salt),
      encryptedPassword: CryptoJS.AES.encrypt(pwd, biometricKey(new Uint8Array(first))).toString()
    };
    localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record));
    updateBiometricButton();
    setBiometricStatus('Đăng ký thành công. Lần sau có thể dùng Face ID / vân tay để mở khóa.');
    unlockApp();
  } catch (err) {
    setBiometricStatus(err.message || 'Không thể đăng ký Face ID / vân tay.', true);
  } finally {
    button.disabled = false;
  }
}

async function unlockWithBiometric() {
  const record = getStoredBiometric();
  if (!record) return;
  if (!window.isSecureContext) {
    setBiometricStatus('Face ID / vân tay cần website chạy bằng HTTPS hoặc localhost.', true);
    return;
  }
  const button = document.getElementById('btnBiometricUnlock');
  button.disabled = true;
  setBiometricStatus('Đang chờ xác thực Face ID / vân tay...');
  try {
    const publicKey = {
      challenge: createRandomBytes(),
      allowCredentials: [{ type: 'public-key', id: base64UrlToBytes(record.credentialId) }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { evalByCredential: { [record.credentialId]: { first: base64UrlToBytes(record.salt) } } } }
    };
    let assertion;
    try {
      assertion = await navigator.credentials.get({ publicKey });
    } catch (err) {
      if (err.name !== 'NotAllowedError') throw err;
      assertion = await navigator.credentials.get({
        publicKey: {
          challenge: createRandomBytes(),
          userVerification: 'required',
          timeout: 60000,
          extensions: { prf: { eval: { first: base64UrlToBytes(record.salt) } } }
        }
      });
    }
    const prf = assertion.getClientExtensionResults().prf;
    const first = prf && prf.results && prf.results.first;
    if (!first) throw new Error('Không nhận được khóa từ Passkey. Hãy dùng mật khẩu để mở khóa.');
    const pwd = CryptoJS.AES.decrypt(record.encryptedPassword, biometricKey(new Uint8Array(first))).toString(CryptoJS.enc.Utf8);
    if (!pwd) throw new Error('Không thể giải mã khóa mở hồ sơ.');
    await loadDataWithPassword(pwd);
    unlockApp();
  } catch (err) {
    const message = err.name === 'NotAllowedError'
      ? 'Không tìm thấy Passkey cho moyu-family.github.io. Hãy đăng nhập bằng mật khẩu rồi đăng ký lại Face ID / vân tay trên đúng website này.'
      : (err.message || 'Xác thực thất bại.');
    setBiometricStatus(message, true);
  } finally {
    button.disabled = false;
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
  initAppHistory();
  if (typeof initializePage === 'function') initializePage();
  else renderGrid();
}

function lockApp() {
  masterPassword = null;
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  members = [];
  selectedIds.clear();
  isSelectMode = false;
  document.getElementById('authPwd').value = '';
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

async function restoreSession() {
  const savedPassword = sessionStorage.getItem(SESSION_PASSWORD_KEY);
  if (!savedPassword || !document.getElementById('authScreen')) return;
  try {
    await loadDataWithPassword(savedPassword);
    unlockApp();
  } catch {
    sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  }
}

updateBiometricButton();
restoreSession();
