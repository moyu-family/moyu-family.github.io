#!/usr/bin/env node
'use strict';
/**
 * "Build" cho trang tĩnh này chỉ gồm 2 việc (không cần bundler vì index.html
 * nạp thẳng các file js/*.js qua thẻ <script>):
 *   1. Kiểm tra cú pháp mọi file JS cục bộ được index.html tham chiếu.
 *   2. Tự động tăng số hậu tố "?v=" của file nào thực sự thay đổi nội dung kể
 *      từ lần build trước, để trình duyệt tải lại đúng bản mới thay vì dùng
 *      cache cũ (đúng chỗ trước đây phải sửa index.html bằng tay mỗi lần đổi
 *      code, xem các commit "Refresh authentication script cache").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const MANIFEST_PATH = path.join(__dirname, 'asset-versions.json');

function sha1(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function checkSyntax(relPath) {
  execFileSync(process.execPath, ['--check', path.join(ROOT, relPath)], { stdio: 'inherit' });
}

function main() {
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  const manifest = loadManifest();
  let manifestChanged = false;
  let htmlChanged = false;
  const referenced = new Set();

  // Ghép cả file JS cục bộ (js/*.js?v=N) và stylesheet (style.css?v=N) vào một
  // luật thay thế duy nhất, tìm mọi thẻ có href/src trỏ tới các file đó.
  const assetRe = /((?:href|src)=")((?:js\/[^"?]+|style\.css))(?:\?v=\d+)?(")/g;

  html = html.replace(assetRe, (full, prefix, relPath, suffix) => {
    referenced.add(relPath);
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.warn(`⚠ index.html tham chiếu "${relPath}" nhưng file này không tồn tại.`);
      return full;
    }

    const hash = sha1(absPath);
    const entry = manifest[relPath];
    let version = entry ? entry.version : 0;
    if (!entry || entry.hash !== hash) {
      version += 1;
      manifest[relPath] = { version, hash };
      manifestChanged = true;
      console.log(`↑ ${relPath}: nội dung đổi -> bump lên v${version}`);
    }

    const next = `${prefix}${relPath}?v=${version}${suffix}`;
    if (next !== full) htmlChanged = true;
    return next;
  });

  // 1) Kiểm tra cú pháp mọi file .js cục bộ được tham chiếu
  for (const relPath of referenced) {
    if (!relPath.endsWith('.js')) continue;
    checkSyntax(relPath);
    console.log(`✓ Cú pháp hợp lệ: ${relPath}`);
  }

  // 2) Cảnh báo file .js tồn tại trên đĩa nhưng index.html không nạp
  const jsDir = path.join(ROOT, 'js');
  for (const file of fs.readdirSync(jsDir)) {
    const rel = `js/${file}`;
    if (file.endsWith('.js') && !referenced.has(rel)) {
      console.warn(`⚠ ${rel} tồn tại nhưng không được index.html tham chiếu (file mồ côi?).`);
    }
  }

  if (htmlChanged) {
    fs.writeFileSync(INDEX_HTML, html);
    console.log('✓ Đã cập nhật index.html với số phiên bản cache-busting mới.');
  } else {
    console.log('✓ Không có file nào đổi nội dung, giữ nguyên số phiên bản hiện tại.');
  }

  if (manifestChanged) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  }

  console.log('✓ Build hoàn tất.');
}

main();
