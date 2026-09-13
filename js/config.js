//(Link Firebase & danh sách ngân hàng mặc định)
// Đường dẫn Firebase Database của bạn
const FIREBASE_DB_URL = "https://moyu-family-default-rtdb.asia-southeast1.firebasedatabase.app/";
const CLOUDINARY_CLOUD_NAME = "vqe4nhjr";
const CLOUDINARY_UPLOAD_PRESET = "moyu_docs";

// Danh sách ngân hàng mặc định
const DEFAULT_BANKS = [
  { name: "Techcombank", logo: "https://api.vietqr.io/img/TCB.png" },
  { name: "Vietcombank", logo: "https://api.vietqr.io/img/VCB.png" },
  { name: "Agribank", logo: "https://cdn.vietqr.io/img/VBA.png" },
  { name: "Vietinbank", logo: "https://api.vietqr.io/img/ICB.png" },
  { name: "Wooribank", logo: "https://api.vietqr.io/img/WOO.png" },
  { name: "VIB Bank", logo: "https://api.vietqr.io/img/VIB.png" }
];

const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 150 150%22%3E%3Crect width=%22150%22 height=%22150%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2275%22 cy=%2258%22 r=%2225%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M28 137c4-29 22-43 47-43s43 14 47 43%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';
const DEFAULT_BANK_LOGO = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 50%22%3E%3Crect width=%2250%22 height=%2250%22 rx=%228%22 fill=%22%23e2e8f0%22/%3E%3Cpath d=%22M10 22h30L25 12 10 22zm4 4h4v12h-4V26zm9 0h4v12h-4V26zm9 0h4v12h-4V26zM9 42h32v-4H9v4z%22 fill=%22%2364758b%22/%3E%3C/svg%3E';

// Biến trạng thái toàn cục
let masterPassword = null;
let members = [];
let customBankList = [];
let currentMemberId = null;
let isSelectMode = false;
let selectedIds = new Set();
let isDocSelectMode = false;
let selectedDocIds = new Set();
let sortableInstance = null;
let lastUploadedCipherText = null;
let activeSavePromise = null;
let lastFirebaseEtag = null;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeRichText(html = '') {
  const container = document.createElement('div');
  container.innerHTML = String(html);
  const allowedTags = new Set(['B', 'BR', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'S', 'STRONG', 'U', 'UL']);
  container.querySelectorAll('*').forEach(element => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ''));
      return;
    }
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
  });
  return container.innerHTML;
}
