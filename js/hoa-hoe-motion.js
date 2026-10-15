/* Hoa Hoè Motion V2 — progressive enhancement, không đụng đến logic bán hàng. */
(function () {
  'use strict';

  function init() {
    var body = document.body;
    if (!body || body.classList.contains('hoa-motion-ready')) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var header = document.querySelector('.ltn__header-area');
    var isHome = body.classList.contains('hoa-hoe-home');
    var heroCarousel = isHome ? document.getElementById('flowerHeroCarousel') : null;
    // Ảnh ở slide 2/3 cần được tải trước khi autoplay để không chớp nền trống.
    if (heroCarousel) {
      heroCarousel.querySelectorAll('.carousel-item img').forEach(function (img) {
        img.loading = 'eager';
      });
    }
    var lastY = Math.max(0, window.scrollY || 0);
    var directionTotal = 0;
    var lastDirection = 0;
    var frame = 0;

    // Hero phai dần theo vị trí cuộn; chỉ ghi một CSS custom property mỗi frame.
    // Giữ opacity 1 trong 7% đầu; tại cuối banner gần như ẩn, không gây flash.
    function updateHeroFade(y) {
      if (!heroCarousel) return;
      if (reduceMotion.matches) {
        heroCarousel.style.removeProperty('--hoa-hero-scroll-opacity');
        return;
      }
      var h = Math.max(1, window.innerHeight);
      var progress = Math.min(1, Math.max(0, (y - h * 0.07) / (h * 0.80)));
      var eased = progress * progress * (3 - 2 * progress);
      heroCarousel.style.setProperty('--hoa-hero-scroll-opacity', (1 - eased * .92).toFixed(3));
    }

    // Navbar luôn ở một hệ tọa độ (sticky với trang thường; fixed với home).
    // Chỉ hide khi kéo xuống một quãng, hiện lại khi kéo lên; tránh rung ở mỗi pixel.
    function updateNav() {
      frame = 0;
      var y = Math.max(0, window.scrollY || 0);
      updateHeroFade(y);
      if (!header) return;
      var delta = y - lastY;
      lastY = y;
      if (Math.abs(delta) < 1) return;
      var dir = delta > 0 ? 1 : -1;
      if (dir !== lastDirection) directionTotal = 0;
      lastDirection = dir;
      directionTotal += Math.abs(delta);
      var threshold = isHome ? Math.max(window.innerHeight * .85, 460) : 300;
      var menuOpen = body.classList.contains('ltn__utilize-open');
      var hasKeyboardFocus = header.contains(document.activeElement);
      var keepVisible = y < threshold || menuOpen || hasKeyboardFocus || reduceMotion.matches;
      if (keepVisible) {
        header.classList.remove('hoa-nav-hidden');
      } else if (directionTotal >= 18) {
        if (dir > 0) header.classList.add('hoa-nav-hidden');
        else header.classList.remove('hoa-nav-hidden');
        directionTotal = 0;
      }
    }
    function scheduleNav() {
      if (!frame) frame = requestAnimationFrame(updateNav);
    }
    if (header || heroCarousel) {
      window.addEventListener('scroll', scheduleNav, { passive: true });
      window.addEventListener('resize', scheduleNav, { passive: true });
      window.addEventListener('pageshow', scheduleNav);
    }
    if (header) {
      header.addEventListener('focusin', function () { header.classList.remove('hoa-nav-hidden'); });
      header.addEventListener('mouseenter', function () { header.classList.remove('hoa-nav-hidden'); });
    }

    // Dựng bộ quan sát một lần; các thẻ phát sinh do lọc/sắp xếp vẫn được xử lý.
    var observer = null;
    if (!reduceMotion.matches && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: .08, rootMargin: '0px 0px -28px 0px' });
    }
    var targets = '.ltn__product-item[data-fiama-product-id], .section-title-area, .flower-panel, .flower-feature, .flower-more-section, .flower-delivery-info';
    function attachReveals(root) {
      var items = [];
      if (root.matches && root.matches(targets)) items.push(root);
      if (root.querySelectorAll) {
        root.querySelectorAll(targets).forEach(function (el) { items.push(el); });
      }
      items.forEach(function (el) {
        if (el.classList.contains('hoa-reveal')) return;
        // Nếu đã ở trong vùng nhìn lúc trang tải, tránh nhấp nháy hoặc giấu phần đầu trang.
        var rect = el.getBoundingClientRect();
        var alreadyVisible = rect.top < window.innerHeight * .93 && rect.bottom > 0;
        el.classList.add('hoa-reveal');
        if (el.classList.contains('ltn__product-item')) {
          var parent = el.parentElement;
          var offset = parent ? Array.prototype.indexOf.call(parent.parentElement.children, parent) : 0;
          el.style.setProperty('--hoa-reveal-delay', (Math.max(0, offset) % 4) * 65 + 'ms');
        }
        if (alreadyVisible || !observer) el.classList.add('is-visible');
        else observer.observe(el);
      });
    }
    // Không thêm animation nặng vào layout trước khi DOM và JS catalog sẵn sàng.
    body.classList.add('hoa-motion-ready');
    attachReveals(document);

    // Một số trang thay đổi thứ tự thẻ sau khi lọc/sắp xếp: không quan sát lại mọi frame.
    if ('MutationObserver' in window) {
      var pending = false;
      var changedNodes = [];
      var mutations = new MutationObserver(function (records) {
        records.forEach(function (record) {
          if (record.type === 'childList') {
            record.addedNodes.forEach(function (node) {
              if (node.nodeType === 1) changedNodes.push(node);
            });
          }
        });
        if (changedNodes.length && !pending) {
          pending = true;
          requestAnimationFrame(function () {
            pending = false;
            var batch = changedNodes.splice(0, changedNodes.length);
            batch.forEach(attachReveals);
          });
        }
      });
      mutations.observe(document.body, { childList: true, subtree: true });
    }

    // Carousel Bootstrap vốn có sẵn: không khởi tạo carousel thứ hai.
    // Dừng autoplay theo yêu cầu giảm chuyển động.
    var carousel = document.getElementById('flowerHeroCarousel');
    if (carousel && window.bootstrap && window.bootstrap.Carousel) {
      function syncCarouselPreference() {
        var instance = window.bootstrap.Carousel.getOrCreateInstance(carousel);
        if (reduceMotion.matches) instance.pause();
        else if (!document.hidden) instance.cycle();
      }
      syncCarouselPreference();
      if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', syncCarouselPreference);
    }
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener('change', function () {
        scheduleNav();
        if (reduceMotion.matches) {
          if (header) header.classList.remove('hoa-nav-hidden');
          document.querySelectorAll('.hoa-reveal').forEach(function (el) { el.classList.add('is-visible'); });
        }
      });
    }
    scheduleNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
