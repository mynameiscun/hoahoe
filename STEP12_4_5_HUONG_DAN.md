# Hoa Hoè — Step 12.4.5: Admin tải ảnh trực tiếp lên GitHub

## Phạm vi

**Chỉ sửa 2 file hiện có** trong `google-apps-script/admin/`: `Admin.gs`, `Admin.html`.
Thêm test giả lập `tests/test_admin_upload_mock.js`. **Không thay đổi** `Code.gs` (Apps Script API bán hàng công khai), Google Sheets schema, Cloudflare Functions, navbar, giỏ hàng hoặc Checkout.

### Luồng sử dụng

1. Mở Web App riêng tư **HoaHoe_Admin** (không phải Web App `HoaHoe_OrderSystem` API công khai), đăng nhập bằng khóa Admin như hiện tại.
2. Sản phẩm → Thêm hoa / Chỉnh sửa → chọn ảnh JPG/PNG/WebP (dưới 12 MB).
3. Admin hiển thị ảnh xem trước; trình duyệt thu nhỏ tối đa 1600px rồi chuyển sang WebP, tải ảnh tối ưu (tối đa 2,5 MB) lên GitHub **chỉ sau khi bấm `Tải ảnh lên GitHub`**.
4. Script riêng tư gọi GitHub REST API, tạo file mới dạng `public/img/product/hh-YYYYMMDD-UUID.webp` trong repository Cloudflare Pages. Giá trị `img/product/...` tự điền vào ô ảnh, **không tự sửa Google Sheets**.
5. Bấm `Lưu sản phẩm` để cập nhật cột `image` trong tab Products. Chờ Cloudflare Pages build & deploy (không tức thời) rồi kiểm tra ảnh trên Shop / Checkout.

**Lưu ý quan trọng:** ảnh tải lên thành công nhưng không bấm `Lưu sản phẩm` sẽ để lại một file chưa được liên kết trên GitHub; người quản trị cần tự dọn ảnh không sử dụng. Bản này không tự xóa ảnh cũ, tránh làm hỏng lịch sử và đường dẫn đã dùng.

## A. Xác định ĐÚNG repository deploy Cloudflare

Source trong Step 12.1 thường được xuất sang `D:\HoaHoe_pages_repo` (Cloudflare deploy với static root `public/`). **GitHub ảnh phải được đẩy vào chính repository kết nối Cloudflare**, không phải repository khác chỉ chứa code phát triển.

```powershell
cd D:\HoaHoe_pages_repo
git remote -v
git branch --show-current
Test-Path .\public\img\product
```

- `GITHUB_OWNER`: phần username/org trong địa chỉ remote GitHub (`https://github.com/OWNER/REPO.git`).
- `GITHUB_REPO`: tên **REPO** không có `.git`, của dự án Cloudflare Pages.
- `GITHUB_BRANCH`: nhánh Cloudflare đang deploy (thường `main`).
- `GITHUB_UPLOAD_PREFIX`: `public/img/product` nếu root deploy là `public/`. Chỉ dùng `img/product` khi repo tự triển khai ngay từ thư mục gốc và **không có `public/`**.

**Chú ý khi build lại site:** ảnh upload thẳng lên repository Cloudflare có thể chưa tồn tại trong thư mục local `D:\HoaHoe\img\product`. Nếu sau này xây lại repo từ source local, hãy kéo/đồng bộ các ảnh đã upload trước để tránh mất ảnh hoặc mất tham chiếu. Không xóa repository Deploy và dựng lại từ thư mục nguồn cũ một cách mù quáng.

## B. Tạo GitHub fine-grained PAT an toàn

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.

- Resource owner: đúng OWNER của repository Cloudflare.
- Repository access: **Only select repositories** → chọn riêng repository Cloudflare.
- Repository permissions: **Contents: Read and write** (metadata mặc định).
- Hạn sử dụng: thời hạn ngắn theo chính sách của shop; hết hạn thì thay token Script Properties.

**Không dán PAT vào file `.gs`, `.html`, GitHub, đoạn PowerShell công khai, hoặc chat.** Không cấp thêm quyền Administration/Workflows trừ khi có yêu cầu độc lập khác. Cần xác thực lại với GitHub khi token hết hạn hoặc chủ repo thay đổi quyền.

## C. Cấu hình Script Properties CHỈ trong HoaHoe_Admin

`script.google.com` → dự án **HoaHoe_Admin riêng tư** → Project settings → Script properties:

| Property | Value |
|---|---|
| `SHEET_ID` | Giữ nguyên như cũ |
| `ADMIN_ACCESS_KEY` | Giữ nguyên như cũ |
| `GITHUB_OWNER` | OWNER của repo Pages |
| `GITHUB_REPO` | REPO của Cloudflare Pages |
| `GITHUB_BRANCH` | `main` hoặc nhánh deploy thực tế |
| `GITHUB_TOKEN` | Fine-grained PAT (chỉ nhập tại trang Script Properties) |
| `GITHUB_UPLOAD_PREFIX` | `public/img/product` (mặc định; tùy chọn) |

**Không** thêm các property này vào dự án API công khai `HoaHoe_OrderSystem`.

## D. Cập nhật Apps Script Admin (BẮT BUỘC, Git push không thay bước này)

1. Mở Apps Script project **HoaHoe_Admin** → editor `Code.gs` hiện có → sao lưu bản trước → thay toàn bộ bằng nội dung `google-apps-script/admin/Admin.gs` của ZIP này. Tên file trong project giữ nguyên `Code.gs`; chỉ nội dung thay đổi.
2. Mở `Admin.html` → sao lưu → thay bằng `google-apps-script/admin/Admin.html` trong ZIP.
3. **Save**. Project có thể yêu cầu cấp quyền mới cho `UrlFetchApp` gọi GitHub. Hãy xác nhận đúng dự án/tài khoản; nếu dùng manifest `oauthScopes` thủ công, thêm `https://www.googleapis.com/auth/script.external_request`.
4. **Deploy → Manage deployments → Edit (cây bút) → Version: New version → Deploy**. Chỉ Save không cập nhật Web App `/exec`.
5. Giữ **Execute as: Me** và **Who has access: Only myself / Only me**; tuyệt đối không dùng `Anyone`.

Có thể giữ đường dẫn ảnh cũ bằng cách nhập thủ công trong ô dưới, nhưng upload là thao tác chính.

## E. PowerShell backup + lưu code lên GitHub source

Đặt ZIP vào Downloads rồi chạy (đổi ổ đĩa nếu khác):

```powershell
cd D:\HoaHoe
$zip = Join-Path $HOME 'Downloads\HoaHoe_Step12_4_5_Upload_Anh_Admin_CHI_FILES.zip'
if (!(Test-Path $zip)) { throw 'Chưa tìm thấy ZIP trong Downloads.' }
if (Test-Path .\google-apps-script\admin\Admin.gs) {
    Copy-Item .\google-apps-script\admin\Admin.gs .\google-apps-script\admin\Admin.gs.before-12.4.5.bak -Force
}
if (Test-Path .\google-apps-script\admin\Admin.html) {
    Copy-Item .\google-apps-script\admin\Admin.html .\google-apps-script\admin\Admin.html.before-12.4.5.bak -Force
}
Expand-Archive -LiteralPath $zip -DestinationPath . -Force
# Chỉ add file code thực sự sửa và test/hướng dẫn, KHÔNG add .bak
node .\tests\test_admin_upload_mock.js
git add -- google-apps-script/admin/Admin.gs google-apps-script/admin/Admin.html tests/test_admin_upload_mock.js STEP12_4_5_HUONG_DAN.md
git diff --cached --check
git diff --cached --name-only
git commit -m 'Step 12.4.5 Admin product image upload via GitHub'
git push origin HEAD
```

**LƯU Ý:** `git push` ở repo source là lưu lịch sử mã, không cập nhật Admin Web App. Cần redeploy Apps Script theo mục D. Khi quản trị bấm upload, chính Apps Script sẽ ghi một **commit ảnh** trên repo Cloudflare Pages.

## F. Kiểm thử an toàn

1. Tạo ảnh hoa thử nghiệm, chỉ chỉnh trong Admin riêng tư; upload một ảnh thử và kiểm tra có commit file đúng thư mục deploy Cloudflare.
2. Kiểm tra path `img/product/hh-...webp` tự điền; **không bấm Lưu sản phẩm** nếu chỉ đang thử tính năng upload (lưu ý file orphan).
3. Thử sửa ảnh của một sản phẩm thử nghiệm, bấm Lưu sản phẩm; mở Google Sheets `Products` cột image để xác nhận chỉ cột dữ liệu dự kiến được cập nhật theo `adminSaveProduct`.
4. Chờ Cloudflare báo deploy thành công; mở `https://hoahoe.pages.dev/img/product/hh-...webp` để xem ảnh, sau đó thử trên Shop / Giỏ / Checkout.
5. Test URL sai, token hết hạn, ảnh quá lớn, tệp không hỗ trợ, và kiểm tra không có GitHub PAT ở website khách hoặc repository.
6. Nếu 401/403: kiểm tra PAT OWNER/REPO/Contents quyền ghi; 404: kiểm tra repo/branch; 422: kiểm tra branch hoặc giới hạn nội dung.

### Kiểm tra ngoại tuyến, không kết nối tài khoản thật

```powershell
node .\tests\test_admin_upload_mock.js
```

Đã kiểm tra cú pháp JS và mock, chưa kết nối GitHub/Google thật hoặc triển khai lên Apps Script. **Không bật nhận đơn công khai** theo bản cập nhật này; các chức năng đơn hàng giữ nguyên.
