// Lưới an toàn toàn cục: chỉ ghi log, không tự phục hồi được giao diện, nhưng đảm bảo mọi lỗi
// JS không bắt kịp (kể cả trong Promise) ít nhất còn hiện trong console thay vì biến mất im lặng
// và để lại màn hình trắng không rõ nguyên nhân.
window.addEventListener('error', (event) => {
  console.error('[Lỗi JS không được xử lý]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Promise bị từ chối không được xử lý]', event.reason);
});

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

// Hồ sơ chung gia đình: một "thành viên ảo" sống chung trong mảng `members` (để tái dùng
// toàn bộ máy móc quản lý giấy tờ/thư mục sẵn có), nhưng bị loại khỏi lưới thành viên,
// bảng tổng hợp và các thao tác hàng loạt trên trang chủ (xem displayMembers()).
const FAMILY_SHARED_ID = 'family_shared';
// Không dùng emoji để đồng nhất với phần còn lại của giao diện (chỉ dùng bộ icon SVG dùng chung, xem ICONS bên dưới).
const FAMILY_SHARED_NAME = 'Hồ sơ chung gia đình';

// Kho tạm cho các tệp "Lưu tạm" từ modal Tải nhanh khi người dùng chưa chọn chủ sở hữu:
// một "thành viên ảo" khác cùng cơ chế với Hồ sơ chung gia đình ở trên, cũng bị loại khỏi
// lưới thành viên/bảng tổng hợp/Kho tổng — chỉ lộ diện qua "Hồ sơ tạm" cho tới khi được
// "Hoàn tất phân loại" (gán chủ sở hữu thật, xem savePendingComplete()).
const UNASSIGNED_OWNER_ID = 'unassigned_pending';
const UNASSIGNED_OWNER_NAME = 'Chưa gán chủ sở hữu';

// 7 danh mục chuẩn (Single Source of Truth): luôn hiển thị sẵn trên trang Hồ sơ cá nhân của
// MỌI thành viên (kể cả thành viên mới tạo, chưa có tệp nào) lẫn Hồ sơ chung gia đình - xem
// renderDocsFolders() trong members.js. `key` chính là giá trị docType thật lưu trên tài liệu/
// thư mục (không phải mã rút gọn riêng) để tương thích ngược với toàn bộ dữ liệu/chức năng
// hiện có (lọc, di chuyển, Kho tổng...) vốn đã dùng đúng chuỗi tên này làm định danh danh mục.
// colorClass: màu nhận diện riêng cho khối icon-box của từng danh mục (xem biến --cat-* và
// .folder-icon.icon-xxx trong style.css) - thuần trang trí/nhận diện nội dung, không phải
// trạng thái tương tác nên tách khỏi bộ 4 biến ngữ nghĩa Success/Danger/Info/Pending.
const DEFAULT_CATEGORIES = [
  { key: 'Định danh & Tùy thân', icon: 'catIdentity', colorClass: 'icon-identity' },
  { key: 'Hộ tịch & Gia đình', icon: 'catFamily', colorClass: 'icon-family' },
  { key: 'Y tế & Sức khỏe', icon: 'catHealth', colorClass: 'icon-health' },
  { key: 'Học tập & Công việc', icon: 'catEdu', colorClass: 'icon-edu' },
  { key: 'Thuế & Tài chính', icon: 'catFinance', colorClass: 'icon-finance' },
  { key: 'Chi phí & Hóa đơn', icon: 'catBills', colorClass: 'icon-bills' },
  { key: 'Tài sản & Pháp lý', icon: 'catLegal', colorClass: 'icon-legal' }
];

// Chỉ gồm tên (docType) của 7 danh mục chuẩn ở trên - dùng cho những chỗ chỉ cần so khớp/liệt kê
// tên, không cần icon (dropdown chọn danh mục, di trú dữ liệu cũ...).
const STANDARD_CATEGORIES = DEFAULT_CATEGORIES.map(c => c.key);

// Ánh xạ tên danh mục (docType) cũ sang đúng 1 trong 7 nhóm chuẩn ở trên, dùng khi
// di trú dữ liệu cũ (xem migrateCategoryNames() trong auth.js). Chỉ áp dụng cho các
// tài liệu/thư mục đang thực sự tồn tại và đang mang đúng tên cũ này - không tự tạo
// danh mục hay thư mục rỗng nào.
const CATEGORY_MIGRATION_MAP = {
  'CCCD / Định danh cá nhân': 'Định danh & Tùy thân',
  'Giấy tờ tùy thân': 'Định danh & Tùy thân',
  'Passport': 'Định danh & Tùy thân',
  'Giấy phép lái xe': 'Định danh & Tùy thân',

  'Giấy khai sinh': 'Hộ tịch & Gia đình',
  'Giấy đăng ký kết hôn': 'Hộ tịch & Gia đình',
  'Hộ tịch': 'Hộ tịch & Gia đình',

  'Thẻ BHYT': 'Y tế & Sức khỏe',
  'Y tế': 'Y tế & Sức khỏe',
  'Hồ sơ tiêm chủng / Sức khỏe': 'Y tế & Sức khỏe',

  'Bằng cấp': 'Học tập & Công việc',
  'Học tập': 'Học tập & Công việc',
  'Hồ sơ học tập': 'Học tập & Công việc',
  'Sổ BHXH / Hợp đồng': 'Học tập & Công việc',

  'Sổ đỏ / Sổ hồng nhà đất': 'Tài sản & Pháp lý',
  'Giấy tờ nhà đất': 'Tài sản & Pháp lý',

  'Chi phí': 'Chi phí & Hóa đơn'
};

// Biến trạng thái toàn cục
let masterPassword = null;
let members = [];
let customBankList = [];
let currentMemberId = null;
let isDocSelectMode = false;
let selectedDocIds = new Set();
let selectedFolderIds = new Set();
let currentSubfolderId = null;
let globalUploadFiles = []; // [{ file, previewUrl }] - các tệp đang chờ lưu trong modal Xem lại nhanh (FAB Camera/nút "Tải lên tệp giấy tờ")
let currentConsolidatedTagFilter = null; // { kind:'family' } | { kind:'member', id, name } | { kind:'custom', name }
let docsViewMode = (function () {
  try { return localStorage.getItem('docsViewMode') || 'grid'; } catch (e) { return 'grid'; }
})();
let consolidatedSortMode = 'date-desc'; // 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'
let globalUploadContext = null; // { ownerId, docType, folderId, label } khi FAB được bấm ngay trong 1 danh mục/thư mục cụ thể - null nghĩa là lưu vào "Hồ sơ tạm" như hành vi mặc định
let sortableInstance = null;
let lastUploadedCipherText = null;
let activeSavePromise = null;

// Bộ icon SVG dùng chung cho toàn bộ nút bấm trong ứng dụng (đồng bộ màu/kiểu dáng, không dùng emoji)
const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
  folderPlus: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line>',
  barChart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
  clipboard: '<rect x="9" y="2" width="6" height="4" rx="1" ry="1"></rect><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"></path>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
  checkSquare: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
  move: '<polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path>',
  grid: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
  list: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
  qr: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><line x1="14" y1="14" x2="14" y2="21"></line><line x1="21" y1="14" x2="21" y2="21"></line><line x1="17.5" y1="14" x2="17.5" y2="17.5"></line><line x1="14" y1="17.5" x2="17.5" y2="17.5"></line><line x1="17.5" y1="21" x2="21" y2="21"></line>',
  fingerprint: '<path d="M2 12a10 10 0 0 1 18-6"></path><path d="M9 6.8a6 6 0 0 1 9 5.2v2"></path><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"></path><path d="M14 13.12c0 2.38 0 6.38-1 8.88"></path><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"></path><path d="M8.65 22c.21-.66.45-1.32.57-2"></path><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"></path><path d="M21.8 16c.2-2 .131-5.354 0-6"></path><path d="M2 16h.01"></path>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>',
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  notebook: '<path d="M4 3h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"></path><line x1="8" y1="7" x2="15" y2="7"></line><line x1="8" y1="11" x2="15" y2="11"></line><line x1="8" y1="15" x2="12" y2="15"></line><line x1="4" y1="7" x2="4" y2="7.01"></line><line x1="4" y1="17" x2="4" y2="17.01"></line>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
  moreVertical: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"></circle>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  home: '<path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"></path>',
  alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
  search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',

  // Bộ icon riêng cho 7 danh mục chuẩn (Modern Rounded DuoTone/Solid) - xem DEFAULT_CATEGORIES.
  // Tách khỏi các icon dùng chung ở trên (VD: 'notebook' vẫn giữ nguyên dạng cũ vì đang được
  // gu-file-row-icon trong ui.js tái dùng làm icon tệp chung, không liên quan danh mục Học tập)
  // để đổi kiểu dáng ở đây không ảnh hưởng các chỗ khác. Mỗi icon là 1 khối solid (fill đặc)
  // + 1 lớp duotone mềm (fill-opacity thấp) cùng tông currentColor, để màu vẫn do CSS
  // (.folder-icon.icon-xxx / .category-icon-box.icon-xxx) quyết định như trước - không hardcode
  // hex ở đây. Mọi path/rect/circle tự khai báo stroke="none" hoặc fill="none" tường minh vì
  // svgIcon() bọc ngoài bằng fill="none" stroke="currentColor" stroke-width="2" (thuộc tính có
  // thể bị kế thừa xuống các phần tử con nếu không ghi đè).
  catIdentity: '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="currentColor" fill-opacity="0.22" stroke="none"></rect><circle cx="8.3" cy="10.6" r="2.1" fill="currentColor" stroke="none"></circle><path d="M4.6 16.2c.3-1.9 1.8-3 3.7-3s3.4 1.1 3.7 3c.1.5-.3 1-.9 1H5.5c-.6 0-1-.5-.9-1Z" fill="currentColor" stroke="none"></path><rect x="14.2" y="8.6" width="5.3" height="1.5" rx="0.75" fill="currentColor" stroke="none"></rect><rect x="14.2" y="11.4" width="5.3" height="1.5" rx="0.75" fill="currentColor" stroke="none"></rect><rect x="14.2" y="14.2" width="3.6" height="1.5" rx="0.75" fill="currentColor" stroke="none"></rect>',
  catEdu: '<path d="M12 3.2 22 8l-10 4.8L2 8l10-4.8Z" fill="currentColor" stroke="none"></path><path d="M6 10.4v4.1c0 2.1 2.7 3.8 6 3.8s6-1.7 6-3.8v-4.1l-6 2.9-6-2.9Z" fill="currentColor" fill-opacity="0.32" stroke="none"></path><path d="M20 9.3v5.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"></path><circle cx="20" cy="15.6" r="1.15" fill="currentColor" stroke="none"></circle>',
  catFamily: '<path d="M12 3 2 12.2 3.4 13.6 12 5.8 20.6 13.6 22 12.2 12 3Z" fill="currentColor" stroke="none"></path><rect x="5" y="12" width="14" height="8" rx="1" fill="currentColor" fill-opacity="0.3" stroke="none"></rect><rect x="10" y="15" width="4" height="5" rx="0.6" fill="currentColor" stroke="none"></rect>',
  catLegal: '<circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none"></circle><rect x="11.15" y="4.6" width="1.7" height="13" rx="0.85" fill="currentColor" stroke="none"></rect><path d="M12 5.6 4.3 8.2M12 5.6l7.7 2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"></path><path d="M1.6 8.6h5.4a2.7 2.7 0 0 1-5.4 0Z" fill="currentColor" fill-opacity="0.32" stroke="none"></path><path d="M17 8.6h5.4a2.7 2.7 0 0 1-5.4 0Z" fill="currentColor" fill-opacity="0.32" stroke="none"></path><rect x="7" y="19" width="10" height="1.8" rx="0.9" fill="currentColor" stroke="none"></rect>',
  catFinance: '<rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" fill-opacity="0.3" stroke="none"></rect><rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" fill-opacity="0.6" stroke="none"></rect><rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" stroke="none"></rect><path d="M3 15 9 9.5 13 12 20 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="M16.5 4h3.8v3.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>',
  catHealth: '<path d="M12 20.5s-7.7-4.6-10-9.4C.4 7.7 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6a1.8 1.8 0 0 0 3 0C14.4 5.1 16 4 18 4c3.6 0 5.6 3.7 4 7.1-2.3 4.8-10 9.4-10 9.4Z" fill="currentColor" fill-opacity="0.26" stroke="none"></path><path d="M3.2 12.4h3.4l1.6-2.8 2.2 5.2 1.6-3.4h1.5l1.6 2.4 1.4-2.4h4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>',
  catBills: '<path d="M5 2.5h14a.5.5 0 0 1 .5.5v18.3a.4.4 0 0 1-.6.35l-1.9-1.1-1.9 1.1a.4.4 0 0 1-.4 0l-1.9-1.1-1.9 1.1a.4.4 0 0 1-.4 0l-1.9-1.1-1.9 1.1a.4.4 0 0 1-.6-.35V3a.5.5 0 0 1 .5-.5Z" fill="currentColor" fill-opacity="0.26" stroke="none"></path><path d="M7.5 7.5h9M7.5 11h9M7.5 14.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"></path>'
};

function svgIcon(name) {
  const paths = ICONS[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths || ''}</svg>`;
}

function iconSpan(name) {
  return `<span class="btn-icon" aria-hidden="true">${svgIcon(name)}</span>`;
}

// Đặt nội dung (icon + nhãn) cho 1 nút, dùng cho các nút có nhãn thay đổi theo trạng thái (giữ icon ổn định thay vì ghi đè bằng innerText)
function setBtnLabel(btn, iconName, text) {
  if (!btn) return;
  btn.innerHTML = `${iconSpan(iconName)}<span class="btn-text">${escapeHtml(text)}</span>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Danh sách thành viên "hiển thị được" trên trang chủ/bảng tổng hợp/thao tác hàng loạt:
// loại bỏ Hồ sơ chung gia đình (không phải 1 thành viên thật, không có CCCD/ngân hàng...).
function displayMembers() {
  return members.filter(m => m.id !== FAMILY_SHARED_ID && m.id !== UNASSIGNED_OWNER_ID);
}

// Tìm (hoặc tạo mới nếu chưa từng có) "thành viên ảo" Hồ sơ chung gia đình trong mảng members,
// để có thể tái dùng nguyên vẹn toàn bộ máy móc upload/quản lý giấy tờ theo từng member.
// Chỉ tạo trong bộ nhớ khi thực sự cần lưu tài liệu đầu tiên (không tự tạo lúc tải dữ liệu),
// tránh phát sinh 1 lượt ghi Firebase thừa mỗi lần mở khoá ứng dụng.
function ensureFamilySharedMember() {
  let m = members.find(item => String(item.id) === FAMILY_SHARED_ID);
  if (!m) {
    m = { id: FAMILY_SHARED_ID, type: 'family', name: FAMILY_SHARED_NAME, documents: [], folders: [] };
    members.push(m);
  }
  if (!m.documents) m.documents = [];
  if (!m.folders) m.folders = [];
  return m;
}

// Tương tự ensureFamilySharedMember(), nhưng cho kho tạm "Chưa gán chủ sở hữu".
function ensureUnassignedOwnerMember() {
  let m = members.find(item => String(item.id) === UNASSIGNED_OWNER_ID);
  if (!m) {
    m = { id: UNASSIGNED_OWNER_ID, type: 'unassigned', name: UNASSIGNED_OWNER_NAME, documents: [], folders: [] };
    members.push(m);
  }
  if (!m.documents) m.documents = [];
  if (!m.folders) m.folders = [];
  return m;
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

// Kiểm tra tính toàn vẹn dữ liệu sau khi tải/di trú: chỉ BÁO CÁO (không tự sửa, không chặn
// tải app) các tệp mồ côi (folderId trỏ tới thư mục không còn tồn tại), thư mục mồ côi
// (parentId trỏ tới thư mục cha không còn tồn tại), và tài liệu thiếu trường bắt buộc
// (createdAt, fileType) hoặc sai kiểu dữ liệu (tags không phải mảng). Dùng để log cảnh báo
// cho người quản trị, không nhằm mục đích validate form nhập liệu.
function validateDataIntegrity(memberList) {
  const issues = [];
  const list = Array.isArray(memberList) ? memberList : [];

  list.forEach(member => {
    if (!member || typeof member !== 'object') {
      issues.push({ type: 'invalid-member', memberId: null, detail: 'Một phần tử trong members không phải object hợp lệ' });
      return;
    }
    const memberLabel = member.name || member.id || '(không rõ)';
    const folderIds = new Set((member.folders || []).map(f => String(f && f.id)));

    (member.documents || []).forEach(doc => {
      if (!doc || typeof doc !== 'object') {
        issues.push({ type: 'invalid-document', memberId: member.id, docId: null, detail: `Thành viên "${memberLabel}" có 1 tài liệu không phải object hợp lệ` });
        return;
      }
      const docLabel = doc.desc || doc.fileName || doc.id || '(không rõ)';
      if (doc.folderId && !folderIds.has(String(doc.folderId))) {
        issues.push({ type: 'orphaned-document-folder', memberId: member.id, docId: doc.id, detail: `Tệp "${docLabel}" của "${memberLabel}" trỏ tới folderId "${doc.folderId}" không tồn tại` });
      }
      if (!doc.createdAt) {
        issues.push({ type: 'missing-createdAt', memberId: member.id, docId: doc.id, detail: `Tệp "${docLabel}" của "${memberLabel}" thiếu trường createdAt` });
      }
      if (!doc.fileType || typeof doc.fileType !== 'string') {
        issues.push({ type: 'missing-fileType', memberId: member.id, docId: doc.id, detail: `Tệp "${docLabel}" của "${memberLabel}" thiếu hoặc sai định dạng fileType` });
      }
      if (doc.tags !== undefined && !Array.isArray(doc.tags)) {
        issues.push({ type: 'invalid-tags', memberId: member.id, docId: doc.id, detail: `Tệp "${docLabel}" của "${memberLabel}" có trường tags không phải mảng` });
      }
    });

    (member.folders || []).forEach(folder => {
      if (folder && folder.parentId && !folderIds.has(String(folder.parentId))) {
        issues.push({ type: 'orphaned-folder-parent', memberId: member.id, folderId: folder.id, detail: `Thư mục "${folder.name}" của "${memberLabel}" trỏ tới parentId "${folder.parentId}" không tồn tại` });
      }
    });
  });

  return issues;
}
