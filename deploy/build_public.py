# -*- coding: utf-8 -*-
r"""Hoa Hoe Step 11.3 - tao thu muc frontend cong khai theo DANH SACH CHO PHEP.

Chay tai D:\HoaHoe:
    python deploy\build_public.py --check
    python deploy\build_public.py --build

--check KHONG thay doi file. --build tao D:\HoaHoe_deploy_public (ngoai repo).
KHONG nap backend, .env, .git, backups vao frontend public.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT.parent / (ROOT.name + '_deploy_public')
REQUIRED = (
    'index.html', 'shop.html', 'product-details.html',
    'cart.html', 'checkout.html', 'order-tracking.html',
    'about.html', 'contact.html', 'policy.html',
)
OPTIONAL = ('order-success.html',)
ASSET_EXT = {
    'css': {'.css'},
    'js': {'.js'},
    'img': {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'},
    'fonts': {'.woff', '.woff2', '.ttf', '.otf', '.eot', '.svg'},
    'webfonts': {'.woff', '.woff2', '.ttf', '.otf', '.eot', '.svg'},
}


def collect():
    missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
    found: list[Path] = []
    for name in (*REQUIRED, *OPTIONAL):
        path = ROOT / name
        if path.is_file() and not path.is_symlink():
            found.append(path)
    skipped = 0
    for directory, suffixes in ASSET_EXT.items():
        folder = ROOT / directory
        if folder.is_symlink():
            raise RuntimeError('Khong chap nhan thu muc lien ket: ' + directory)
        if not folder.is_dir():
            continue
        for file in folder.rglob('*'):
            if not file.is_file():
                continue
            rel = file.relative_to(ROOT)
            if (file.is_symlink() or any(part.startswith('.') for part in rel.parts)
                    or file.suffix.lower() not in suffixes):
                skipped += 1
                continue
            found.append(file)
    return found, missing, skipped


def main():
    ap = argparse.ArgumentParser(description='Dong goi frontend public Hoa Hoe')
    action = ap.add_mutually_exclusive_group(required=True)
    action.add_argument('--check', action='store_true', help='Chi kiem tra, khong sao chep')
    action.add_argument('--build', action='store_true', help='Tao bo frontend cong khai ngoai repo')
    args = ap.parse_args()
    files, missing, skipped = collect()
    print('Hoa Hoe / Step 11.3 - Frontend public')
    print('Nguon:', ROOT)
    print('Dich:', OUTPUT)
    print('File duoc phep:', len(files), '| Bo qua:', skipped)
    if missing:
        print('THIEU TRANG:', ', '.join(missing))
        print('Hay bo sung cac trang truoc khi build de tranh website thieu trang.')
        return 2
    if not (ROOT / 'css').is_dir() or not (ROOT / 'js').is_dir():
        print('THIEU css/ hoac js/ - khong build.')
        return 2
    if args.check:
        print('OK - chi kiem tra; khong file nao bi thay doi.')
        return 0
    # Sao chep vao thu muc tam, chi dua dung danh sach cho phep vao output.
    # Neu da co output cu, khong ghi de/ xoa tu dong: nguoi dung phai tu quyet dinh.
    if OUTPUT.exists():
        print('DA TON TAI:', OUTPUT)
        print('Hay doi ten hoac sao luu thu muc output cu truoc khi build lai.')
        return 3
    temp = OUTPUT.with_name(OUTPUT.name + '_building')
    if temp.exists():
        print('DA TON TAI THU MUC TAM:', temp)
        return 3
    try:
        temp.mkdir(parents=True)
        for source in files:
            dest = temp / source.relative_to(ROOT)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
        temp.rename(OUTPUT)
    except Exception:
        print('Build that bai, thu muc tam can xem xet:', temp)
        raise
    print('DA TAO:', OUTPUT)
    print('KHONG bao gom backend/, .env, .git, sao luu MySQL.')
    print('CHUA deploy len hosting. Can kiem tra links, path va API truoc khi public.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
