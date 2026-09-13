# moyu-family
Ứng dụng quản lý thành viên trong gia đình Moyu

Đây là trang tĩnh (HTML/CSS/JS thuần, không bundler) nên có thể mở thẳng
`index.html` hoặc deploy lên GitHub Pages mà không cần build gì cả. Bộ script
Node dưới đây chỉ hỗ trợ phát triển: viết test và tự động đồng bộ số phiên bản
cache-busting (`?v=`) trong `index.html`.

## Cài đặt

```
npm install
```

## Chạy test

```
npm test
```

Bộ test dùng `node --test` (Node ≥ 18) và `jsdom` để nạp thẳng `index.html` +
các file trong `js/` như trình duyệt thật, rồi kiểm tra logic thuần (định dạng
ngày, escape HTML...), luồng điều hướng giữa các "trang" (trang chủ, chi tiết,
form, hồ sơ giấy tờ), và luồng đăng nhập/lưu dữ liệu (mã hoá AES, gọi Firebase
qua `fetch` được giả lập).

## Build (kiểm tra + đồng bộ version cache-busting)

```
npm run build
```

Script này kiểm tra cú pháp mọi file `js/*.js` được `index.html` tham chiếu,
cảnh báo file không được tham chiếu hoặc tham chiếu tới file không tồn tại, và
tự tăng số `?v=N` của riêng những file thực sự thay đổi nội dung so với lần
build trước (so khớp qua `scripts/asset-versions.json`) — để không phải nhớ
tăng version thủ công mỗi khi sửa code.
1.4
