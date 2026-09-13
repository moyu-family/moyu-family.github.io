# YÊU CẦU KỸ THUẬT: TÍNH NĂNG GLOBAL UPLOAD & HỒ SƠ CHUNG GIA ĐÌNH KÈM TAGGING

## 1. Bối cảnh & Mục tiêu
Nâng cấp ứng dụng `moyu-family.github.io` để:
- Cho phép upload nhanh tài liệu/giấy tờ/bill từ mọi màn hình thông qua nút bấm nổi (Floating Action Button - FAB), hỗ trợ chụp camera trực tiếp trên mobile hoặc chọn tệp.
- Hỗ trợ chọn linh hoạt Danh mục chính (Category) và Thư mục con (Subcategory) từ danh sách hiện có hoặc tạo mới trực tiếp tại chỗ.
- Bổ sung khái niệm "👨‍👩‍👧‍👦 Hồ sơ chung gia đình" (`family_shared`) cho các giấy tờ dùng chung (kết hôn, hộ khẩu, khai sinh chung, giấy tờ người thân đã mất...).
- Hỗ trợ gắn nhãn (Tagging) đa thành viên: chọn nhanh tên thành viên trong gia đình hoặc tự do nhập tag mới.
- Giữ nguyên toàn bộ cơ chế mã hoá đầu-cuối AES tại client, lưu trữ ảnh/file mã hoá trên Cloudinary và metadata trên Firebase Realtime Database. Không dùng backend riêng.

---

## 2. Chi tiết Giao diện (UI/UX)

### A. Nút bấm nổi (Floating Action Button - FAB)
- **Vị trí**: Ghim cố định ở góc dưới bên phải màn hình (`position: fixed; bottom: 24px; right: 24px; z-index: 99`).
- **Hiển thị**: 
  - Nút tròn nổi bật (icon camera/cộng).
  - Chỉ hiển thị sau khi đã đăng nhập/mở khoá thành công (ẩn ở `authScreen`).
- **Hành động**: Khi bấm, mở modal tải lên tài liệu nhanh (`#globalUploadModal` hoặc mở rộng từ `#uploadDocModal`).

### B. Modal Upload Nhanh
Giao diện form gồm các trường:
1. **Chủ sở hữu chính (Primary Owner)**:
   - Dropdown gồm: Tùy chọn đầu tiên là `👨‍👩‍👧‍👦 Hồ sơ chung gia đình` (`id: 'family_shared'`), tiếp theo là danh sách các thành viên hiện có (`members`).
2. **Thành viên liên quan / Nhãn gắn kèm (Tags - Multi-select + Custom)**:
   - Danh sách các chip (badges) tên tất cả thành viên trong nhà để người dùng click chọn nhanh (toggle on/off).
   - Ô nhập text phụ kèm nút "+" hoặc ấn `Enter` để thêm tag tuỳ chỉnh (ví dụ: "Ông ngoại", "Bà nội"...).
   - Hiển thị danh sách các tag đã chọn với nút "x" để xoá.
3. **Danh mục chính (Category)**:
   - Dropdown lấy danh sách các category đã có trong hệ thống (gợi ý sẵn: "Giấy tờ tùy thân", "Chi phí", "Học tập", "Y tế", "Hộ tịch").
   - Lựa chọn cuối: `+ Tạo danh mục mới...`. Khi chọn, hiển thị ô input text để nhập tên mới.
4. **Thư mục con (Subcategory / Folder)**:
   - Dropdown phụ thuộc theo Danh mục chính đang chọn.
   - Lựa chọn cuối: `+ Tạo thư mục con mới...` kèm ô input text để nhập khi cần.
5. **Chọn file / Chụp ảnh**:
   - Thẻ `<input type="file" id="globalDocFileInput" accept="image/*,application/pdf" capture="environment">`.
   - Cho phép chọn file ảnh/PDF hoặc chụp ảnh camera trực tiếp trên điện thoại.
   - Xem trước thumbnail ảnh vừa chọn.
6. **Mô tả / Ghi chú ngắn**:
   - Ô text input: Tên gợi nhớ hoặc ghi chú (ví dụ: "Học phí kỳ 1", "Bản scan 4 khai sinh").

### C. Nâng cấp Màn hình Tổng hợp (`consolidatedView`)
- Bổ sung bộ lọc nhanh theo **Tag**: Bấm vào tag tên thành viên hoặc tag tự do (như "Ông ngoại") để lọc nhanh toàn bộ giấy tờ thuộc về người đó hoặc có gắn thẻ người đó.
- Bổ sung tab/nhóm hiển thị riêng cho **"Hồ sơ chung gia đình"**.

---

## 3. Quy chuẩn Dữ liệu & Logic Xử lý

### A. Schema Metadata của Tài liệu
Mỗi phần tử trong mảng `documents` được chuẩn hóa:
```javascript
{
  id: "doc_" + Date.now(),
  ownerId: "family_shared",     // ID thành viên hoặc 'family_shared'
  type: "Chi phí",              // Danh mục chính
  folderName: "Học tập",        // Thư mục con
  fileName: "bill_hoc_phi.jpg",
  desc: "Học phí kỳ 1",
  tags: ["Minh Tuệ"],           // Mảng chứa tên hoặc ID thành viên liên quan
  data: "[https://res.cloudinary.com/...enc](https://res.cloudinary.com/...enc)", // URL file đã mã hoá AES
  encrypted: true,
  uploadedAt: new Date().toISOString()
}