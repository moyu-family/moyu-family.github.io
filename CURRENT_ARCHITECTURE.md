# Kiến trúc hiện tại — moyu-family.github.io

Tài liệu này mô tả trạng thái hiện tại của mã nguồn (snapshot tại 2026-09-13, nhánh `main`, commit `4816b04`) để phục vụ phân tích kiến trúc/nâng cấp.

## 1. Cây thư mục / danh sách file

Ứng dụng là **trang tĩnh** (static site), không có bước build bắt buộc, deploy thẳng lên GitHub Pages.

```
moyu-family.github.io/
├── index.html                  # Toàn bộ UI: 1 file HTML duy nhất, nhiều "view" ẩn/hiện bằng class .hidden
├── style.css                   # CSS thuần (~404 dòng), không dùng framework
├── data.json                   # (Không dùng runtime) — chuỗi AES ciphertext, có vẻ là bản sao lưu/log cũ
├── js/
│   ├── config.js                # Hằng số cấu hình (Firebase URL, Cloudinary, danh sách ngân hàng mặc định, icon SVG, helper chung)
│   ├── auth.js                  # Đăng nhập bằng mật khẩu, mã hoá/giải mã AES, Passkey (WebAuthn + PRF) cho Face ID/vân tay, load/lưu dữ liệu Firebase
│   ├── ui.js                    # Render UI: card thành viên, modal, toolbar, v.v. (~558 dòng)
│   ├── members.js                # CRUD thành viên, quản lý giấy tờ (upload/sửa/xoá/di chuyển file), bảng tổng hợp (~1925 dòng — file lớn nhất)
│   └── page.js                   # Điều hướng SPA giả lập qua query string + history.pushState (~75 dòng)
├── scripts/
│   ├── build.js                  # Node script: kiểm tra cú pháp js/*.js, tự tăng số ?v= cache-busting trong index.html
│   └── asset-versions.json       # Lưu hash nội dung từng file JS để build.js biết file nào thay đổi
├── test/
│   ├── auth.test.js               # Test luồng đăng nhập/mã hoá bằng jsdom + fetch giả lập Firebase
│   ├── logic.test.js              # Test các hàm thuần (format ngày, escapeHtml...)
│   ├── navigation.test.js         # Test điều hướng giữa các "trang"
│   └── save-member.test.js        # Test luồng lưu thành viên
├── testing/app.js                 # (phụ trợ cho test, không phải phần app chạy thật)
├── package.json / package-lock.json
├── favicon*, apple-touch-icon.png, android-chrome-*.png
├── README.md
└── .gitignore
```

Không có thư mục `src/`, không có bundler (Webpack/Vite/...), không có framework JS (React/Vue/...). `package.json` chỉ khai báo `devDependencies: crypto-js, jsdom` dùng cho test (`node --test`), không phải dependency runtime — runtime nạp `crypto-js` qua CDN trong `index.html`.

## 2. Phân tích Frontend

- **HTML**: 1 file `index.html` (627 dòng) chứa toàn bộ các "màn hình" dưới dạng các `<div id="...View">` ẩn/hiện bằng class `.hidden` — không có nhiều trang HTML riêng biệt, không SSR/SPA framework. Các view chính: `authScreen`, `homeView` (grid thẻ thành viên), `tableView` (bảng tổng hợp), `detailView` (chi tiết 1 thành viên), `docsView` (file explorer giấy tờ của 1 người), `consolidatedView` (giấy tờ toàn gia đình), `formView` (thêm/sửa thành viên).
- **CSS**: `style.css` thuần, dùng CSS variables (`--navy`, `--text-muted`, `--border-color`...), không dùng Tailwind/Bootstrap. Font ngoài: Google Fonts (Inter).
- **JavaScript**: Vanilla JS (không React/Vue/Angular). Toàn bộ hàm là global function gắn trực tiếp vào `onclick=""`/`onchange=""` trong HTML — không có module bundler, các file JS nạp tuần tự bằng `<script defer src="js/xxx.js?v=N">` với query `?v=` để cache-busting thủ công (được tự động hoá qua `scripts/build.js`).
- **Điều hướng (`js/page.js`)**: SPA giả lập bằng `URLSearchParams` + `history.pushState`, không dùng router library. Trạng thái các "trang" (member, summary, documents, consolidated, edit) được mã hoá vào query string để hỗ trợ back/forward và refresh.
- **Thư viện ngoài** (nạp qua CDN, không phải npm bundle):
  - `crypto-js@4.2.0` — mã hoá/giải mã AES.
  - `SortableJS@1.15.0` — kéo-thả (drag & drop) trong danh sách giấy tờ/thư mục.
  - Google Fonts (Inter).
  - Cloudinary (dịch vụ lưu trữ file ảnh/tài liệu qua REST API, không phải thư viện JS nhúng).

## 3. Cơ chế lưu trữ và hiển thị dữ liệu thành viên

**Không hardcode trong HTML, không dùng localStorage làm nguồn dữ liệu chính.** Cụ thể:

- **Nguồn sự thật (source of truth)**: Firebase Realtime Database (`FIREBASE_DB_URL` trong `js/config.js`), object gốc là `data.json` trên Firebase (khác với file `data.json` trong repo — file trong repo có vẻ chỉ là bản export/backup cũ, không được code runtime đọc).
- **Mã hoá đầu-cuối**: Toàn bộ dữ liệu thành viên (`members` + `customBankList`) được `JSON.stringify` rồi mã hoá AES (bằng `CryptoJS.AES.encrypt`, key = mật khẩu người dùng nhập) **trước khi** `PUT` lên Firebase (`pushToFirebase()` trong `js/auth.js`). Khi tải về, app `fetch` chuỗi ciphertext rồi giải mã bằng mật khẩu (`loadDataWithPassword()`). Do đó nếu không có mật khẩu đúng, dữ liệu trên Firebase là vô nghĩa.
- **Cache cục bộ**: `localStorage` chỉ dùng để cache tạm ciphertext (`moyu-family-data-cache-v1`) cho trường hợp mất mạng, và lưu phiên đăng nhập (`moyu-family-session-password`, TTL 1 giờ) + thông tin Passkey sinh trắc học (`moyu-family-biometric-v1`). Không lưu dữ liệu thành viên dạng plaintext.
- **Ảnh đại diện & file giấy tờ**: Upload thẳng lên **Cloudinary** (`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_UPLOAD_PRESET` trong `config.js`) qua `uploadFileToStorage()`. Ảnh đại diện tải lên dạng thường (không mã hoá). Riêng **file giấy tờ (documents)** được mã hoá AES trước khi upload (`uploadEncryptedFileToStorage()` — đọc file thành buffer, mã hoá, upload dưới dạng `.enc` raw blob lên Cloudinary), và khi xem thì tải về + giải mã tại client (`getDocumentDisplayUrl()`), cache kết quả giải mã bằng `Blob URL` trong bộ nhớ (`decryptedDocumentUrlCache`).

### Các trường dữ liệu (fields) hiện có của 1 thành viên (`memberObj` trong `js/members.js:saveMember`)

| Field | Ý nghĩa |
|---|---|
| `id` | ID (timestamp string) |
| `type` | `adult` \| `child` |
| `name` | Họ và tên |
| `email` | Email |
| `phone` | Số điện thoại |
| `schoolClass`, `teacherPhone`, `teacherName` | Chỉ dùng khi `type=child`: trường/lớp, tên & SĐT giáo viên chủ nhiệm |
| `avatar` | URL ảnh đại diện (Cloudinary hoặc URL ngoài) |
| `dob`, `pob` | Ngày sinh, nơi sinh |
| `cccd`, `cccdDate` | Số CCCD/định danh, ngày cấp |
| `bhyt` | Mã bảo hiểm y tế |
| `bhxh` | Mã số BHXH |
| `tax` | Mã số thuế cũ |
| `specialCode` | Mã nhân viên (người lớn) hoặc mã học sinh (trẻ em) |
| `notes` | Ghi chú dạng rich-text (HTML đã sanitize, whitelist tag) |
| `banks[]` | Danh sách tài khoản ngân hàng: `{ bankName, accNum, logo }` |
| `documents[]` | Danh sách giấy tờ: `{ id, type (tên danh mục/thư mục), folderId, desc, fileName, fileType, data (URL, đã mã hoá nếu `encrypted=true`), encrypted }` — xem mục 5 |

Payload lưu lên Firebase: `{ members: [...], customBankList: [...] }` (mã hoá thành 1 chuỗi ciphertext).

## 4. Backend / server hiện có

- **Không có backend tự viết** (không Node/Express/Python server nào chạy trong repo này ngoài script CLI hỗ trợ dev).
- Toàn bộ "backend" thực chất là 2 dịch vụ bên thứ ba, gọi thẳng bằng `fetch()` từ trình duyệt:
  1. **Firebase Realtime Database** — lưu trữ dữ liệu thành viên (dạng ciphertext).
  2. **Cloudinary** — lưu trữ file media (ảnh đại diện, file giấy tờ đã mã hoá).
- `scripts/build.js` chỉ là công cụ dev cục bộ (Node), dùng để: kiểm tra cú pháp `js/*.js`, cảnh báo file JS thừa/thiếu tham chiếu trong `index.html`, tự tăng số `?v=` cache-busting. Không phải server chạy khi người dùng truy cập trang.
- Test chạy bằng `node --test` + `jsdom` (giả lập DOM + `fetch` để test logic mà không cần trình duyệt thật hay server thật) — xem `test/*.test.js`.
- Không có `Live Server`/dev server cấu hình sẵn trong repo; mở trực tiếp `index.html` hoặc bất kỳ static server nào là chạy được.

## 5. Đánh giá: tính năng "upload giấy tờ" — đã tồn tại sẵn, không phải xây mới

Lưu ý quan trọng cho Kiến trúc sư: ứng dụng **đã có sẵn** toàn bộ luồng upload/quản lý giấy tờ (file explorer dạng thư mục), không phải tính năng cần thêm mới từ đầu. Vị trí trong code:

- **UI trigger**: nút "Hồ sơ cá nhân" trong `detailView` (`index.html:140`) → gọi `openDocsView(currentMemberId)` (định nghĩa tại `js/members.js:688`) → mở `docsView`.
- **Nút upload chính**: trong `docsView`, nút "Tải lên tệp giấy tờ" (`index.html:207`) → `openUploadDocModal()` → mở modal `#uploadDocModal` (`index.html:463-514`).
- **Modal upload** (`index.html:463`): chọn loại giấy tờ/thư mục (`#docTypeSelect`, hỗ trợ tạo danh mục mới), thư mục con tuỳ chọn (`#docFolderSelect`), chọn nhiều file ảnh/PDF (`#docFileInput`, tối đa gợi ý 10MB/file), đặt nhãn riêng từng file (`#docFileDescList`).
- **Logic lưu**: `saveDocument()` tại `js/members.js:1756` — đọc file thành `data:` URL, gắn vào `documents[]` của member hiện tại; khi `saveMember()`/lưu tổng thể chạy, các doc có `data` dạng `data:` sẽ được `uploadEncryptedFileToStorage()` mã hoá AES rồi upload lên Cloudinary (xem `js/members.js:626-641`).
- Còn có sẵn: sửa mô tả file (`saveDocumentEdit`, `editDocModal`), tạo thư mục con (`newFolderModal`), tạo danh mục gốc (`categoryModal`), chọn nhiều & di chuyển/xoá hàng loạt (`docsBatchToolbar`, `moveDocsModal`), xem trước ảnh/PDF (`documentPreviewModal`), và **view tổng hợp giấy tờ toàn gia đình** (`consolidatedView`).

**Nếu mục tiêu là cải tiến/mở rộng** (ví dụ: đổi nơi lưu trữ file, thêm loại giấy tờ, thêm workflow duyệt...), điểm neo (anchor) phù hợp nhất trong code hiện tại là:
- Thay đổi **nơi lưu trữ file**: sửa `uploadFileToStorage()` / `uploadEncryptedFileToStorage()` trong `js/auth.js:42-92` (điểm tập trung duy nhất gọi Cloudinary).
- Thay đổi **schema doc** hoặc **UI modal upload**: `index.html:463-514` (modal) + `js/members.js:1756` (`saveDocument`) + `js/members.js:688` (`openDocsView`, render danh sách/thư mục).
- Thêm **nút/hành động mới** trong danh sách giấy tờ: khu vực `docsExplorerContent` (`index.html:237`), được render động bởi các hàm trong `js/members.js` xung quanh `openDocsView`.

## 6. Ghi chú khác cho Kiến trúc sư

- Bảo mật dữ liệu dựa hoàn toàn vào 1 mật khẩu chung (không có multi-user/role), mã hoá đối xứng AES với key = mật khẩu — nghĩa là đổi mật khẩu = phải giải mã bằng key cũ rồi mã hoá lại bằng key mới (không thấy code xử lý "đổi mật khẩu" trong các file đã đọc).
- Đăng nhập sinh trắc học (Face ID/vân tay) dùng WebAuthn PRF extension để lấy secret, dùng SHA-256 làm key mã hoá mật khẩu thật (lưu trong `localStorage`), không gửi sinh trắc học đi đâu — chỉ chạy được trên secure context (HTTPS/localhost).
- Không có test coverage cho `js/ui.js` riêng biệt trong danh sách `test/*.test.js` đã thấy (chỉ có auth, logic, navigation, save-member).
- File `data.json` ở root repo là ciphertext tĩnh, khả năng cao là **rác/backup cũ không được runtime dùng tới** — nên xác nhận với chủ dự án trước khi xoá hoặc dùng làm tài liệu tham chiếu.
