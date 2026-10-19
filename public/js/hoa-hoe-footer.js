/* Hoa Hoè — Footer dùng chung.
   Chỉnh nội dung, số điện thoại, đường dẫn mạng xã hội tại duy nhất file này.
   Mỗi trang HTML chỉ chứa #hoa-hoe-footer-root và tải script ngay tại vị trí Footer.
   Dùng template nội bộ để chạy trên Cloudflare Pages và cả khi mở file HTML local.
*/
(function () {
  'use strict';
  var mount = document.getElementById('hoa-hoe-footer-root');
  if (!mount) return;

  // Nội dung HTML cố định do dự án quản lý, không nối dữ liệu từ người dùng.
  var footerHTML = `
<footer aria-label="Thông tin cửa hàng" class="flower-footer">
<div class="container">
<div class="row">
<div class="col-lg-4 col-md-6">
<h2 class="flower-footer-heading">Hoa Hoè Flower Shop</h2>
<p>Điểm xuất phát giao hoa: đường Võ Thị Sáu, Biên Hòa, Đồng Nai.</p>
<p>Điện thoại: <a href="tel:+84908458744" aria-label="Gọi HoaHoè">0908 458 744</a></p>
<p>Giao hoa tại địa bàn TP.HCM cũ theo khu vực shop hỗ trợ.</p>
</div>
<div class="col-lg-4 col-md-6">
<h2 class="flower-footer-heading">Thông tin</h2>
<ul class="flower-footer-links">
<li><a href="contact.html">Liên hệ</a></li>
<li><a href="policy.html">Chính sách cửa hàng</a></li>
<li><a href="order-tracking.html">Tra cứu đơn hàng</a></li>
</ul>
<p>Giờ hoạt động: <strong>chưa cung cấp</strong>.</p>
</div>
<div class="col-lg-4 col-md-12">
<h2 class="flower-footer-heading">Kết nối với shop</h2>
<p>Kết nối với HoaHoè qua các kênh chính thức:</p>
<div aria-label="Mạng xã hội HoaHoè" class="flower-socials">
<a class="flower-social" data-social="facebook" href="https://www.facebook.com/profile.php?id=61589432000117" target="_blank" rel="noopener noreferrer" aria-label="Facebook HoaHoè"><i aria-hidden="true" class="fab fa-facebook-f"></i>Facebook</a>
<a class="flower-social" data-social="messenger" href="https://www.facebook.com/messages/t/1023836264156301" target="_blank" rel="noopener noreferrer" aria-label="Nhắn tin Messenger HoaHoè"><i aria-hidden="true" class="fab fa-facebook-messenger"></i>Messenger</a>
<a class="flower-social" data-social="instagram" href="https://www.instagram.com/hoahoe_hoahoe/" target="_blank" rel="noopener noreferrer" aria-label="Instagram HoaHoè"><i aria-hidden="true" class="fab fa-instagram"></i>Instagram</a>
<a class="flower-social" data-social="threads" href="https://www.threads.com/@hoahoe_hoahoe" target="_blank" rel="noopener noreferrer" aria-label="Threads HoaHoè"><span class="hoa-threads-icon" aria-hidden="true"></span>Threads</a>
<a class="flower-social" data-social="tiktok" href="https://www.tiktok.com/@hoahoe_hoahoe" target="_blank" rel="noopener noreferrer" aria-label="TikTok HoaHoè"><i aria-hidden="true" class="fas fa-music"></i>TikTok</a>
</div>
</div>
</div>
</div>
</footer>
`;
  mount.outerHTML = footerHTML;
})();
