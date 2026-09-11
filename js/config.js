//(Link Firebase & danh sách ngân hàng mặc định)
// Đường dẫn Firebase Database của bạn
const FIREBASE_DB_URL = "https://moyu-family-default-rtdb.asia-southeast1.firebasedatabase.app/";

// Danh sách ngân hàng mặc định
const DEFAULT_BANKS = [
  { name: "Techcombank", logo: "https://api.vietqr.io/img/TCB.png" },
  { name: "Vietcombank", logo: "https://api.vietqr.io/img/VCB.png" },
  { name: "Agribank", logo: "https://api.vietqr.io/img/AGR.png" },
  { name: "Vietinbank", logo: "https://api.vietqr.io/img/ICB.png" },
  { name: "Wooribank", logo: "https://api.vietqr.io/img/WOO.png" },
  { name: "VIB Bank", logo: "https://api.vietqr.io/img/VIB.png" }
];

// Biến trạng thái toàn cục
let masterPassword = null;
let members = [];
let customBankList = [];
let currentMemberId = null;
let isSelectMode = false;
let selectedIds = new Set();
let sortableInstance = null;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
