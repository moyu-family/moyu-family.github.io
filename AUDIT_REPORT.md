# Báo cáo Deep Audit & Data Cleansing — moyu-family

**Ngày thực hiện:** 2026-09-14
**Phạm vi:** `js/config.js`, `js/auth.js`, `js/members.js`, `js/ui.js`, `js/page.js`, bộ test (`test/*.js`), `testing/app.js`
**Phương pháp:** 2 agent rà soát độc lập (data integrity/error-handling, và dead-code/a11y) đọc toàn bộ mã nguồn, đối chiếu chéo với việc tôi tự đọc trực tiếp từng file để xác minh trước khi sửa (một vài định vị file:line do agent báo cáo bị lệch — ví dụ gán nhầm `saveMember()`/`deleteCurrentMember()` sang `js/page.js` trong khi thực tế nằm ở `js/members.js` — đã được kiểm chứng lại bằng cách đọc trực tiếp trước khi áp dụng bất kỳ thay đổi nào).

**Không có commit git nào được tạo** — toàn bộ thay đổi vẫn ở dạng working tree, sẵn sàng để bạn tự xem lại và commit khi thấy phù hợp.

---

## 1. Vấn đề dữ liệu/logic đã tìm thấy và đã vá

### 1.1. Tag "mồ côi" khi đổi tên hoặc xóa thành viên (bug thật, đã sửa)
- **Vấn đề:** Tag tự do gắn trên tài liệu (ví dụ gắn tên "Mẹ" cho 1 hóa đơn trong Hồ sơ chung gia đình) được lưu dưới dạng chuỗi tên thô trong `doc.tags[]`. Khi đổi tên thành viên (`saveMember()`) hoặc xóa thành viên (`deleteCurrentMember()`), không có chỗ nào cập nhật lại các tag này — tag vẫn trỏ tới cái tên cũ/không còn tồn tại vĩnh viễn, và bộ lọc theo thành viên (`consolidatedFilterPredicate()`) sẽ ngầm mất khớp sau khi đổi tên.
- **Đã sửa:** Thêm hàm `renameMemberNameInTags(oldName, newName)` trong `js/members.js`, gọi từ `saveMember()` khi tên thay đổi (đổi tag sang tên mới) và từ `deleteCurrentMember()` khi xóa (xóa hẳn tag khỏi mọi tài liệu).
- **File/hàm:** `js/members.js` — `saveMember()`, `deleteCurrentMember()`, hàm mới `renameMemberNameInTags()`.

### 1.2. Rollback không đầy đủ trong "Hoàn tất phân loại" Hồ sơ tạm (bug thật, đã sửa)
- **Vấn đề:** `savePendingComplete()` mutate trực tiếp object tài liệu (`doc.ownerId/docType/folderId/desc/status = 'completed'`) *trước khi* gọi `pushToFirebase()`. Nếu lưu lên Firebase thất bại, khối `catch` chỉ khôi phục lại **vị trí** tài liệu (đưa về đúng `documents[]` của chủ sở hữu cũ) nhưng **không khôi phục nội dung** — tài liệu vẫn mang `status: 'completed'` và danh mục/chủ sở hữu mới trong bộ nhớ, dù thao tác chưa hề được lưu thành công. Hậu quả: tài liệu biến mất khỏi "Hồ sơ tạm" một cách âm thầm cho tới khi tải lại trang, và nếu có 1 thao tác khác lưu thành công trước khi người dùng tải lại, trạng thái sai này sẽ bị ghi đè vĩnh viễn lên Firebase.
- **Đã sửa:** Snapshot toàn bộ 5 trường sẽ bị sửa (`previousFields`) trước khi mutate, và `Object.assign(doc, previousFields)` để khôi phục đầy đủ trong khối `catch`.
- **File/hàm:** `js/members.js` — `savePendingComplete()`.
- Đây là phát hiện được xác nhận trực tiếp bởi 1 test mới thất bại trước khi vá (xem mục 3).

### 1.3. Crash tiềm ẩn khi có phần tử hỏng trong `members[]` (đã vá phòng ngừa)
- **Vấn đề:** `members = members.map(member => ({ ...member, id: String(member.id) }))` trong `loadDataWithPassword()` sẽ ném `TypeError` ngay lập tức nếu bất kỳ phần tử nào trong mảng `members` không phải object (`null`, chuỗi rác...) — ví dụ dữ liệu Firebase bị chỉnh tay sai hoặc snapshot cũ bị hỏng một phần. Vì đây là bước chạy ngay sau khi giải mã thành công, lỗi này sẽ chặn đăng nhập hoàn toàn dù mật khẩu đúng, và không có cơ chế phục hồi nào khác (không có `window.onerror`).
- **Đã sửa:** Lọc bỏ phần tử không hợp lệ trước khi `.map()`, kèm `console.warn` báo số lượng bị bỏ qua, giữ lại toàn bộ thành viên hợp lệ khác.
- **File/hàm:** `js/auth.js` — `loadDataWithPassword()`.

### 1.4. 3 điểm đọc localStorage/sessionStorage không có try/catch (đã vá)
- `js/auth.js` — `saveSessionPassword()`: cả `sessionStorage.setItem` và `localStorage.setItem` không được bọc; nếu storage đầy/bị chặn (chế độ ẩn danh của trình duyệt), lỗi sẽ chặn luôn cả việc mở khóa dù mật khẩu đúng.
- `js/auth.js` — `getSessionPassword()`: dòng `sessionStorage.getItem(...)` đầu tiên nằm ngoài khối try/catch bên dưới nó.
- `js/auth.js` — `loadDataWithPassword()`: dòng `const cachedData = localStorage.getItem(...)` chạy trước khi vào khối `try` bao quanh `fetch()`.
- **Đã vá:** cả 3 điểm được bọc try/catch, fail-safe về giá trị rỗng/`null` thay vì ném lỗi ra ngoài.

### 1.5. Hàm kiểm tra tính toàn vẹn dữ liệu mới: `validateDataIntegrity()`
Theo yêu cầu #1, đã thêm hàm thuần (`js/config.js`) phát hiện (chỉ báo cáo, không tự sửa, không chặn tải app):
- **Tệp mồ côi**: `doc.folderId` trỏ tới thư mục không còn tồn tại trong `member.folders`.
- **Thư mục mồ côi**: `folder.parentId` trỏ tới thư mục cha không còn tồn tại.
- **Thiếu trường bắt buộc**: `createdAt` thiếu, `fileType` thiếu/sai kiểu.
- **Sai kiểu dữ liệu**: `tags` không phải mảng.
- **Phần tử hỏng**: `member`/`document` không phải object.

Được gọi tự động sau mỗi lần `loadDataWithPassword()` thành công (chỉ `console.warn`, không chặn đăng nhập) — xem `js/auth.js`.

> **Ghi chú về "tag rác không còn gắn với tài liệu nào":** hệ thống hiện tại **không lưu một danh sách tag riêng** — tag tự do luôn được suy ra động từ `documents[].tags` đang tồn tại (xem `renderConsolidatedTagFilterBar()`), nên về thiết kế sẽ không bao giờ có "tag rác" tồn tại độc lập không gắn với tài liệu nào. Vấn đề thực tế tương đương là mục 1.1 (tag trỏ tới thành viên đã đổi tên/không còn tồn tại) — đã sửa ở trên.

### 1.6. Cơ chế fallback an toàn bổ sung
- Thêm `window.addEventListener('error', ...)` và `window.addEventListener('unhandledrejection', ...)` ở đầu `js/config.js` — **chỉ ghi log**, không tự phục hồi giao diện (không thể "resume" một script đã crash giữa chừng), nhưng đảm bảo lỗi không biến mất im lặng, hỗ trợ debug khi có sự cố thực tế thay vì chỉ thấy "màn hình trắng" không rõ nguyên nhân.
- Đã xác minh (bằng cách đọc toàn bộ mã, không chỉ suy đoán): các hàm render chính (`renderDocsFolders`, `openFolderDetails`, `buildConsolidatedMap`, `openDocsView`, `viewDetails`...) đều đã có sẵn fallback `(member.documents || [])` nhất quán — **không phát hiện điểm crash nào** từ việc thiếu mảng `documents/folders/categories`. Đây là điểm mạnh sẵn có của code, không cần sửa.

### 1.7. Rủi ro tiềm ẩn đã ghi nhận nhưng CHƯA sửa (cần bạn quyết định)
- **`migrateCategoryNames()` (`js/auth.js`) không đồng bộ hóa `docType` giữa tài liệu và thư mục cha của nó** nếu một trong hai không khớp chính xác chuỗi trong `CATEGORY_MIGRATION_MAP` ở cùng 1 lượt migrate. Đây là rủi ro *lý thuyết* dựa trên đọc code, tôi **chưa tìm thấy dữ liệu thực tế nào bị ảnh hưởng** và cũng chưa vá vì cần hiểu rõ hơn tình huống dữ liệu cụ thể trước khi thay đổi logic migrate (rủi ro sửa sai sẽ ảnh hưởng dữ liệu thật). Khuyến nghị: nếu muốn, có thể chạy `validateDataIntegrity()` sau khi mở khóa (đã tự động log ra console) để kiểm tra xem dữ liệu gia đình hiện tại có bị ảnh hưởng không.

---

## 2. Tối ưu JavaScript (dead code, a11y)

### 2.1. Dead code đã xóa
| Vị trí | Nội dung | Lý do xóa |
|---|---|---|
| `js/members.js` | Hàm `readFileAsDataUrl(file)` | 0 lời gọi trong toàn bộ `js/*.js` và `index.html` (xác minh bằng grep toàn repo) |
| `js/config.js` + `js/auth.js` | Biến `lastFirebaseEtag` và toàn bộ logic ghi/đọc nó | Chỉ được ghi, không bao giờ được đọc cho mục đích thực (không dùng làm `If-Match`, không so sánh, không hiển thị) — write-only state. Xóa biến này còn loại bỏ luôn **1 lượt `fetch()` GET thừa** sau mỗi lần lưu thành công (`pushToFirebase()`) mà trước đây chỉ tồn tại để cố gắng lấy giá trị cho chính biến chết này — giảm tải mạng không cần thiết mỗi lần lưu. |

### 2.2. Accessibility — 5 điểm bấm bằng `<div onclick>` không dùng được bàn phím, đã vá
Tất cả các thẻ `<div class="folder-card">`/`<div class="member-card">` gắn `onclick` thuần túy (không có `role`, `tabindex`, `onkeydown`) đã được bổ sung `role="button"`, `tabindex="0"`, `aria-label` mô tả, và `onkeydown` xử lý Enter/Space (theo đúng pattern đã có sẵn ở `connectDocumentField()` trong cùng file):

1. `js/members.js` — thẻ thành viên trong `renderGrid()` (trang chủ).
2. `js/members.js` — ảnh đại diện lồng bên trong thẻ thành viên (mở modal xem ảnh).
3. `js/members.js` — thẻ danh mục trong `renderConsolidatedCategories()` (Hồ sơ tổng hợp).
4. `js/members.js` — thẻ danh mục trong `renderDocsFolders()` (Hồ sơ giấy tờ cá nhân).
5. `js/members.js` — thẻ thư mục con trong `openFolderDetails()`.

Với 3 thẻ có chứa nút con (sửa/xóa danh mục, checkbox chọn nhiều...), đã thêm bảo vệ `if (e.target !== card) return;` trong `onkeydown` để tránh kích hoạt điều hướng khi phím bấm thực chất đến từ 1 phần tử con lồng bên trong (nút Sửa/Xóa, checkbox, ảnh đại diện).

**Đã xác minh không có vấn đề** (không cần sửa): toàn bộ nút icon-only sinh bằng JS (nút đóng modal, kebab menu, nút xóa/sửa/di chuyển tệp...) đều đã có `title` hoặc `aria-label` sẵn; toàn bộ `addEventListener` trong code đều đăng ký 1 lần duy nhất ở top-level hoặc dùng `{ once: true }` — không có rủi ro rò rỉ listener khi render lại nhiều lần (tương tác được xử lý qua gán `.onclick =`, tự thay thế chứ không chồng lấp).

---

## 3. Test mới

**Tổng số test trước khi audit:** 34 (đúng như `npm test` báo cáo tại thời điểm bắt đầu — không phải 29 như ước tính ban đầu).
**Tổng số test sau khi audit:** **50** (tăng thêm **16 test mới**), file mới: `test/pending-docs.test.js`.
**Kết quả cuối cùng:** `npm test` → **50/50 PASS** (100%). `node scripts/build.js` → cú pháp hợp lệ toàn bộ `js/*.js`, tự bump version cache-busting cho 3 file có nội dung thay đổi (`config.js` → v35, `auth.js` → v35, `members.js` → v37).

### Danh sách test mới
**`test/logic.test.js`** (+5, kiểm tra `validateDataIntegrity()`):
- Dữ liệu sạch → không báo lỗi.
- Phát hiện tệp mồ côi (`folderId` trỏ tới thư mục đã xóa).
- Phát hiện thư mục mồ côi (`parentId` trỏ tới thư mục cha đã xóa).
- Phát hiện thiếu `createdAt`/`fileType`, `tags` sai kiểu.
- Không crash với input rỗng/`undefined`/thiếu mảng con.

**`test/auth.test.js`** (+1):
- `loadDataWithPassword()` bỏ qua phần tử `null` hỏng trong `members[]` thay vì crash, giữ lại các thành viên hợp lệ khác.

**`test/navigation.test.js`** (+1):
- `renderGrid()`: thẻ thành viên có `role="button"`/`tabindex="0"`/`aria-label`, và nhấn Enter điều hướng đúng trang chi tiết.

**`test/pending-docs.test.js`** (mới, +9):
- `savePendingComplete()` giữ nguyên chủ sở hữu: chỉ cập nhật danh mục/mô tả/status.
- `savePendingComplete()` đổi chủ sở hữu: chuyển đúng tài liệu sang thành viên mới, xóa khỏi thành viên cũ.
- `savePendingComplete()` rollback đầy đủ khi lưu thất bại (test này đã bắt được bug ở mục 1.2 trước khi vá).
- `getAllPendingDocuments()` chỉ gồm tài liệu `status: 'pending'`, gộp đúng từ mọi thành viên.
- `deleteCategory()` xóa đúng tài liệu + thư mục con của danh mục bị xóa, không đụng danh mục khác.
- `deleteSubfolder()` đưa tệp bên trong ra thư mục cha đúng cách, không để lại tệp mồ côi (xác minh chéo bằng `validateDataIntegrity()`).
- `saveDocument()` lưu đúng nhiều tệp trùng tên với id riêng biệt, không ghi đè nhau.
- `saveMember()` đổi tên cascade đúng sang tag trên tài liệu người khác (mục 1.1).
- `deleteCurrentMember()` xóa cascade đúng tag khi xóa thành viên (mục 1.1).

---

## 4. Việc chưa làm / khuyến nghị tiếp theo

- Rủi ro migrate danh mục (mục 1.7) — cần bạn xác nhận có xảy ra với dữ liệu thật hay không trước khi sửa logic `migrateCategoryNames()`.
- `validateDataIntegrity()` hiện chỉ log ra console (DevTools) — nếu muốn hiển thị cảnh báo ngay trên giao diện (ví dụ banner nhỏ ở trang chủ khi phát hiện vấn đề), đây sẽ là bước mở rộng tiếp theo, chưa làm trong đợt này để tránh thay đổi UI ngoài phạm vi yêu cầu.
- Toàn bộ thay đổi **chưa được commit** theo đúng yêu cầu — hãy tự xem lại `git diff` trước khi commit.
