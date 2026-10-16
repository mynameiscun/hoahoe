#!/usr/bin/env python3
"""Build an isolated GitHub repo folder for Cloudflare Pages + Apps Script.

Run in D:\\HoaHoe with Python 3: python deploy\\build_sheets_site.py
Output: D:\\HoaHoe_pages_repo (source: git repo root, static root: public/)
Never copies backend, credentials, .env, user data, or hidden files.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.with_name(ROOT.name + '_pages_repo')
HTML = (
    'index.html', 'shop.html', 'product-details.html', 'cart.html',
    'checkout.html', 'order-tracking.html', 'about.html', 'contact.html', 'policy.html',
)
ASSETS = ('css', 'js', 'img', 'fonts', 'webfonts')
EXCLUDED = {'.git', '.env', '.venv', 'venv', '__pycache__', 'node_modules',
            'backend', 'private', 'secrets', '.idea', '.vscode'}
COPY_EXTENSIONS = {
    'css': {'.css'}, 'js': {'.js'},
    'img': {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.ico'},
    'fonts': {'.woff', '.woff2', '.ttf', '.otf', '.eot'},
    'webfonts': {'.woff', '.woff2', '.ttf', '.otf', '.eot'},
}

def safe_copy_file(source: Path, target: Path) -> None:
    if source.is_symlink() or not source.is_file():
        raise ValueError(f'Không chép symbolic link hoặc đường dẫn thiếu: {source}')
    if source.stat().st_size > 30_000_000:
        raise ValueError(f'File quá lớn (>30 MB): {source}')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

def include_script(html: str, target_script: str, before_script: str) -> str:
    if f'src="{target_script}"' in html:
        return html
    needle = f'<script src="{before_script}"></script>'
    if needle not in html:
        raise ValueError(f'HTML thiếu thẻ script bắt buộc: {before_script}')
    return html.replace(needle, f'<script src="{target_script}"></script>\n{needle}', 1)

def main() -> None:
    if not (ROOT / 'index.html').exists():
        raise SystemExit('Hãy chép gói Step 12 vào D:\\HoaHoe trước.')
    # Abort before touching output if fundamental patch files are missing.
    required = [ROOT / 'js' / 'hoa-hoe-turnstile.js',
                ROOT / 'functions' / 'api' / '[[path]].js']
    for f in required:
        if not f.is_file():
            raise SystemExit(f'Thiếu file: {f}')
    if OUTPUT.exists():
        raise SystemExit(f'Thư mục {OUTPUT} đã tồn tại. Hãy đổi tên hoặc sao lưu rồi chạy lại. Không tự xóa dữ liệu.')
    public = OUTPUT / 'public'
    public.mkdir(parents=True)
    for name in HTML:
        original = ROOT / name
        if not original.is_file():
            raise SystemExit(f'Thiếu trang HTML: {name}. Chưa thể tạo bản triển khai đầy đủ.')
        html = original.read_text(encoding='utf-8-sig')
        # Sync price from Sheets on every page with the catalog component.
        if name != 'shop.html' and 'js/hoa-hoe-catalog-sync.js' in html:
            html = include_script(html, 'js/hoa-hoe-product-api-sync.js', 'js/hoa-hoe-catalog-sync.js')
        if name == 'checkout.html':
            if 'hoa-order-success-modal' not in html:
                raise SystemExit('Checkout hiện thiếu modal của Step 09.7. Hãy dùng checkout.html bản đã có modal xác nhận 5 giây.')
            html = include_script(html, 'js/hoa-hoe-turnstile.js', 'js/hoa-hoe-checkout-v3.js')
            html = html.replace('Đang kiểm tra kết nối Django...', 'Đang kiểm tra kết nối cửa hàng...')
        elif name == 'order-tracking.html':
            html = include_script(html, 'js/hoa-hoe-turnstile.js', 'js/hoa-hoe-tracking-live.js')
        (public / name).write_text(html, encoding='utf-8')
    for dirname in ASSETS:
        folder = ROOT / dirname
        if not folder.exists():
            if dirname in {'css', 'js', 'img'}:
                raise SystemExit(f'Thiếu thư mục bắt buộc {dirname}/')
            continue
        for file in folder.rglob('*'):
            if file.is_symlink() or not file.is_file():
                continue
            if any(part.startswith('.') or part.lower() in EXCLUDED for part in file.relative_to(folder).parts):
                continue
            if file.suffix.lower() not in COPY_EXTENSIONS[dirname]:
                continue
            safe_copy_file(file, public / dirname / file.relative_to(folder))
    function = ROOT / 'functions' / 'api' / '[[path]].js'
    safe_copy_file(function, OUTPUT / 'functions' / 'api' / '[[path]].js')
    (public / '_routes.json').write_text(json.dumps({
        'version': 1, 'include': ['/api/*'], 'exclude': []
    }, indent=2), encoding='utf-8')
    (public / '_headers').write_text(
        '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'
        '  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n',
        encoding='utf-8')
    (OUTPUT / '.gitignore').write_text(
        '*.env\n.env*\nbackend/\nprivate/\n*.sqlite3\n*.sql\n*.rar\n*.zip\n'
        'google-apps-script/\n', encoding='utf-8')
    print(f'Đã tạo: {OUTPUT}')
    print(f'HTML: {len(list(public.glob("*.html")))} trang; Functions: 1 API router.')
    print('Chỉ đưa thư mục OUTPUT lên GitHub. Trong Cloudflare Pages đặt Build output directory: public.')
    print('KHÔNG đăng Google Sheet, file .env, SECRET_KEY, GAS_API_KEY hoặc mã Apps Script bí mật.')

if __name__ == '__main__':
    main()
