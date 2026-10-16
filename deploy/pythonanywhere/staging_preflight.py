#!/usr/bin/env python3
"""Hoa Hoe Step 11.4 managed-hosting preflight (READ-ONLY).
Run from D:/HoaHoe: python deploy/pythonanywhere/staging_preflight.py
Prints no credential values and never connects to a database.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'


def report(kind, message):
    print(f'[{kind}] {message}')


def main():
    report('INFO', 'Step 11.4 staging preflight (khong thay doi file / MySQL)')
    for name in ('index.html', 'shop.html', 'contact.html'):
        report('OK' if (ROOT / name).is_file() else 'WARN', f'Trang frontend: {name}')
    for name in ('config/urls.py', 'config/managed_frontend.py', 'config/settings.py', 'manage.py'):
        report('OK' if (BACKEND / name).is_file() else 'WARN', f'Backend: {name}')
    for name in ('css', 'js', 'img'):
        report('OK' if (ROOT / name).is_dir() else 'WARN', f'Thu muc: {name}/')
    builder = ROOT / 'deploy' / 'build_public.py'
    report('OK' if builder.exists() else 'WARN', 'Step 11.3 build_public.py')
    try:
        urls = (BACKEND/'config/urls.py').read_text(encoding='utf-8')
        v = (BACKEND/'config/managed_frontend.py').read_text(encoding='utf-8')
        good = ('HOA_MANAGED_FRONTEND_ENABLED' in urls and 'PUBLIC_PAGES' in v)
        report('OK' if good else 'WARN', 'Gioi han frontend public theo danh sach HTML')
    except OSError:
        report('WARN', 'Chua cai du backend/config/ cua Step 11.4')
    js_root = ROOT / 'js'
    locks = []
    if js_root.is_dir():
        for path in js_root.glob('*.js'):
            if path.stat().st_size >= 400000:
                continue
            src = path.read_text(encoding='utf-8', errors='ignore')
            if (re.search(r'location\.port\s*[!=]==?\s*[\'"]8000[\'"]', src)
                    or re.search(r'(?:127\.0\.0\.1|localhost):8000', src)):
                locks.append(path.name)
    if locks:
        report('ACTION', 'JS gioi han localhost/8000: ' + ', '.join(sorted(set(locks))))
    else:
        report('OK', 'Khong phat hien hard-code port 8000 trong JS')
    report('PENDING', 'Step 11.2 can xac nhan Ran 9 tests / OK neu chua co log')
    report('PENDING', 'Can username/host MySQL/hosting va bat password protection tren Web tab')
    report('PENDING', 'Can test HTTPS thuc te va static/media mappings')
    report('BLOCKED', 'KHONG mo API nhan don/tra cuu cong khai trong staging')
    report('INFO', 'Audit nay KHONG thay cho django check --deploy hoac test tren hosting.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
