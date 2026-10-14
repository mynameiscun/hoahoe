/* Flower Shop: slider trang chủ chạy độc lập khi chưa có JS gốc Fiama.
   Chỉ xử lý #flowerHeroCarousel. Không can thiệp giỏ hàng / checkout. */
(function () {
  'use strict';
  function init() {
    var root = document.getElementById('flowerHeroCarousel');
    if (!root) return;
    // Nếu Bootstrap JS gốc đã được tải thì tránh khởi tạo hai carousel.
    if (window.bootstrap && window.bootstrap.Carousel) return;
    var slides = Array.prototype.slice.call(root.querySelectorAll('.carousel-item'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.carousel-indicators button'));
    if (slides.length < 2) return;
    var active = Math.max(0, slides.findIndex(function (el) { return el.classList.contains('active'); }));
    var interval = Number(root.getAttribute('data-bs-interval')) || 6500;
    var timer = null;
    function select(i) {
      active = (i + slides.length) % slides.length;
      slides.forEach(function (el, n) {
        var yes = n === active;
        el.classList.toggle('active', yes);
        el.setAttribute('aria-hidden', yes ? 'false' : 'true');
      });
      dots.forEach(function (el, n) {
        var yes = n === active;
        el.classList.toggle('active', yes);
        if (yes) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        timer = setInterval(function () { select(active + 1); }, interval);
    }
    root.querySelectorAll('[data-bs-slide="prev"]').forEach(function (btn) {
      btn.addEventListener('click', function () { select(active - 1); start(); });
    });
    root.querySelectorAll('[data-bs-slide="next"]').forEach(function (btn) {
      btn.addEventListener('click', function () { select(active + 1); start(); });
    });
    dots.forEach(function (btn, n) {
      btn.addEventListener('click', function () { select(n); start(); });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    select(active); start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
