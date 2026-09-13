'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const CryptoJS = require('crypto-js');

const ROOT = path.join(__dirname, '..');
const APP_SCRIPTS = ['js/config.js', 'js/auth.js', 'js/ui.js', 'js/members.js', 'js/page.js'];

// Ngăn không cho jsdom cố tải các <script src> (CDN hoặc js/*.js) qua mạng.
// Ta tự eval mã nguồn thật của từng file bên dưới để có state y hệt trình duyệt thật.
class NoopResourceLoader extends (require('jsdom').ResourceLoader) {
  fetch() {
    return null;
  }
}

function createApp({ url = 'https://moyu-family.github.io/index.html' } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    resources: new NoopResourceLoader()
  });
  const { window } = dom;

  // Thư viện thật (crypto-js) để test đúng luồng mã hoá/giải mã, và một bản giả lập
  // tối thiểu cho SortableJS (chỉ dùng để kéo-thả sắp xếp, không cần trong test).
  window.CryptoJS = CryptoJS;
  window.Sortable = class {
    constructor() {}
    destroy() {}
  };

  // fetch mặc định: không gọi mạng thật. Mỗi test override lại khi cần.
  window.fetch = async () => {
    throw new Error('fetch() chưa được giả lập (mock) trong test này.');
  };
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;

  // Trong trình duyệt thật, nhiều thẻ <script> riêng biệt cùng chia sẻ một scope
  // toàn cục (biến `let`/`const` khai báo ở file này dùng được ở file sau). Nhưng
  // nhiều lệnh gọi window.eval() riêng lẻ trong jsdom KHÔNG chia sẻ scope đó, nên
  // ta phải nối toàn bộ mã nguồn thành một khối rồi eval một lần duy nhất, giống
  // hệt thứ tự nạp file thật trong index.html.
  const combinedCode = APP_SCRIPTS
    .map(relPath => fs.readFileSync(path.join(ROOT, relPath), 'utf8'))
    .join('\n;\n');

  // Cầu nối nhỏ để test đọc/ghi được các biến trạng thái (members, masterPassword...)
  // vốn khai báo bằng `let` nên không tự thành thuộc tính của `window`. Không làm
  // thay đổi hành vi thật của app, chỉ phục vụ việc kiểm tra từ bên ngoài.
  const bridge = `
    window.__state = {
      get members() { return members; }, set members(v) { members = v; },
      get masterPassword() { return masterPassword; }, set masterPassword(v) { masterPassword = v; },
      get customBankList() { return customBankList; }, set customBankList(v) { customBankList = v; },
      get selectedIds() { return selectedIds; },
      get isSelectMode() { return isSelectMode; },
      get currentMemberId() { return currentMemberId; }, set currentMemberId(v) { currentMemberId = v; },
      get lastUploadedCipherText() { return lastUploadedCipherText; }
    };
  `;

  window.eval(`${combinedCode}\n;\n${bridge}`);

  return dom;
}

module.exports = { createApp, APP_SCRIPTS };
