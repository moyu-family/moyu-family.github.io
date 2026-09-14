# moyu-family

Ứng dụng quản lý thành viên trong gia đình Moyu — trang tĩnh HTML/CSS/JS thuần
(không bundler, không framework). `index.html` load thẳng `style.css` và các
file trong `js/`. Xem README.md để biết cách chạy test/build.

## Design System & Interaction Guidelines

Toàn bộ màu sắc và trạng thái tương tác (hover/active/focus) dùng chung một bộ
biến CSS khai báo tại `:root` trong `style.css`. **Không hardcode mã hex mới
cho các thành phần tương tác** — luôn dùng biến bên dưới để đảm bảo đồng bộ
toàn app.

### Bảng mã màu chuẩn

**Primary / Accent (tím thương hiệu)** — dùng cho mọi hành động chính, link,
badge, focus ring:

| Biến | Giá trị | Vai trò |
|---|---|---|
| `--accent` | `#6d5bd0` | Primary — viền/chữ nút phụ, hover mạnh |
| `--accent-2` | `#4338ca` | Primary Active — chữ trên nền nhạt, nền khi `:active` |
| `--accent-soft` | `#ede9fe` | Accent / Light Purple — nền mặc định của khối tím nhạt |
| `--accent-soft-hover` | `#e0d9fc` | Nền tím nhạt khi hover |
| `--accent-border` | `#ddd6fe` | Border/Ring mặc định cho khối tím nhạt |
| `--accent-border-hover` | `#c4b5fd` | Border khi hover mạnh hơn (card, outline btn) |
| `--gradient-primary` | `linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)` | Nền nút Solid Button |
| `--gradient-primary-hover` | `linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)` | Nền nút Solid Button khi hover |
| `--ring-accent` | `0 0 0 3px var(--accent-soft)` | Focus ring dùng chung |

**Trạng thái ngữ nghĩa** — mỗi trạng thái có đúng một bộ 4 biến
(màu chữ / nền nhạt / nền nhạt hover / viền), không trộn 2 tông đỏ hay 2 tông
xanh khác nhau cho cùng một ý nghĩa:

| Nhóm | Biến |
|---|---|
| Success (xác nhận, sinh trắc học, QR ngân hàng) | `--success`, `--success-soft`, `--success-soft-hover`, `--success-border` |
| Danger (xoá, cảnh báo) | `--danger`, `--danger-soft`, `--danger-soft-hover`, `--danger-border` |
| Info (điều hướng xem trước tài liệu — nút prev/next trong modal xem giấy tờ) | `--info`, `--info-soft`, `--info-soft-2`, `--info-soft-hover`, `--info-border`, `--info-border-hover` |
| Pending (cam ấm — "Hồ sơ tạm"/chờ phân loại: chip lọc + thẻ danh mục trong Hồ sơ tổng hợp) | `--pending`, `--pending-soft`, `--pending-soft-hover`, `--pending-border` |

Nút "← Quay lại" (`.btn-back`, mọi màn hình) dùng tông **Accent/tím** (Outline/Ghost
Button, xem bên dưới) — **không** dùng Info; Info chỉ dành riêng cho nút điều
hướng prev/next trong modal xem trước tài liệu.

Nền trung tính, chữ, border mặc định vẫn dùng `--bg`, `--card-bg`, `--navy`,
`--text-main`, `--text-muted`, `--border-color` như trước.

### Quy chuẩn tương tác

Mọi phần tử bấm được phải có transition mượt (`transition: all 0.2s ease`,
khai báo ngay trên rule gốc — **không** để riêng lẻ từng thuộc tính rồi quên
thêm `transform` khi thêm hiệu ứng dịch chuyển, đây là lỗi đã gặp và gây giật
hình). Quy tắc theo từng loại component:

- **Solid Button** (`.btn-primary`, `.fab-upload`, `.tag-chip.is-active`, …):
  nền `--gradient-primary`; hover → `--gradient-primary-hover` (+ dịch nhẹ
  `translateY(-1px)` hoặc scale nếu hợp lý); active/click → nền đặc
  `--accent-2` + `transform: scale(0.98)`.
- **Outline / Ghost Button** (`.btn-outline`, `.btn-tool`, `.btn-docs-link`,
  `.btn-back`, `.tag-chip`, …): chữ/viền tím `--accent`/`--accent-2`/`--accent-border`;
  hover → nền `--accent-soft-hover` (hoặc `#f5f3ff` cho nút trắng-viền) +
  viền `--accent-border-hover`/`--accent`; active/click → nền
  `--accent-border` + `transform: scale(0.97–0.98)`.
- **Danger / Success / Info / Pending Button**: dùng đúng bộ 4 biến của nhóm
  ngữ nghĩa tương ứng, không mượn hex rời; active/click → nền `*-border` +
  scale nhẹ.
- **Card** (`.member-card`, `.folder-card`, `.file-card`, …): hover → nâng
  nhẹ (`translateY`) + `box-shadow: var(--shadow-hover)` + viền
  `--accent-border`; active/click → hạ bớt độ nâng + `scale(0.98)`; focus
  bàn phím (`:focus-visible`) → `box-shadow: var(--ring-accent)` kèm viền
  `--accent-border-hover` (card không có sẵn hiệu ứng `:active` của thẻ
  `<button>` vì thường là `<div>` có `tabindex`, nên phải khai báo tường
  minh).
- **Input / Select**: viền mặc định `--border-color`; focus → viền
  `--accent` + `box-shadow: var(--ring-accent)`.
- **Dropdown / Menu / Modal** (`.file-kebab-menu`, `.modal-card`, …): viền
  `--border-color` hoặc `--accent-border`, item hover → nền tím nhạt
  (`#f5f3ff`/`--accent-soft`), item active/click → `--accent-border`; item
  gắn nhãn `.danger` dùng bộ biến `--danger-*`.

### Ràng buộc

Mọi component mới hoặc chỉnh sửa sau này bắt buộc:
1. Tái sử dụng đúng biến CSS ở trên thay vì viết mã hex mới.
2. Có đủ 3 trạng thái tương tác khi phần tử có thể bấm: `:hover`, `:active`
   (khai báo *sau* `:hover` trong CSS để không bị `:hover` đè specificity khi
   người dùng nhấn giữ chuột trên phần tử đang hover), và `:focus-visible`
   cho phần tử điều hướng được bằng bàn phím.
3. Dùng `transition: all 0.2s ease` (hoặc tương đương) trên rule gốc của
   phần tử tương tác, không thêm transition chỉ cho một vài thuộc tính rồi
   quên các thuộc tính khác mà hover/active có thay đổi (nguyên nhân gây
   giật màu/giật vị trí).
