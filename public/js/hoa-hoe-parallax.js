/* Hoa Hoè Parallax 5.0 — nâng cấp độc lập cho INDEX; không sửa Fiama, cart, API. */
(function () {
  'use strict';
  function init() {
    var body = document.body;
    if (!body || !body.classList.contains('hoa-hoe-home') || body.classList.contains('hoa-parallax-ready')) return;
    var hero = document.getElementById('flowerHeroCarousel');
    var products = document.querySelector('.hoa-parallax-products');
    var story = document.querySelector('.hoa-parallax-story');
    var delivery = document.querySelector('.flower-delivery-info');
    if (!hero && !story) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var frame = 0;
    var mobile = window.matchMedia('(max-width: 991px)');

    // Hạn chế độ lệch, không layout shift và không ghi transform trực tiếp lên item.
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function writePx(node, name, val) {
      if (node) node.style.setProperty(name, val.toFixed(2) + 'px');
    }
    function clearLayer(node, keys) {
      if (!node) return;
      keys.forEach(function (name) { node.style.removeProperty(name); });
    }
    function render() {
      frame = 0;
      if (reduceMotion.matches || document.hidden) return;
      var y = Math.max(0, window.scrollY || window.pageYOffset || 0);
      var h = Math.max(window.innerHeight, 1);
      if (hero && y < h * 1.15) {
        var t = clamp(y / h, 0, 1);
        writePx(hero, '--hoa-px-hero-pattern', t * 58);
        writePx(hero, '--hoa-px-hero-photo', t * 42);
        writePx(hero, '--hoa-px-hero-copy', -t * (mobile.matches ? 15 : 32));
      }
      if (products) {
        var p = products.getBoundingClientRect();
        if (p.bottom > -120 && p.top < h + 120) {
          var amt = clamp((h / 2 - (p.top + p.height / 2)) / h, -1.3, 1.3);
          writePx(products, '--hoa-px-product-back', amt * (mobile.matches ? 22 : 54));
          writePx(products, '--hoa-px-product-front', amt * (mobile.matches ? -14 : -32));
        }
      }
      if (story) {
        var rect = story.getBoundingClientRect();
        if (rect.bottom > -130 && rect.top < h + 130) {
          var mid = rect.top + rect.height / 2;
          var v = clamp((h / 2 - mid) / (h / 2 + rect.height / 2), -1, 1);
          var strength = mobile.matches ? .48 : 1;
          writePx(story, '--hoa-story-deep', v * 46 * strength);
          writePx(story, '--hoa-story-near', -v * 65 * strength);
          writePx(story, '--hoa-story-flower', v * 38 * strength);
        }
      }
      if (delivery && !mobile.matches) {
        var d = delivery.getBoundingClientRect();
        if (d.bottom > 0 && d.top < h) {
          var amount = clamp((h / 2 - (d.top + d.height / 2)) / h, -1, 1);
          delivery.querySelectorAll('.flower-info-card').forEach(function (card, i) {
            writePx(card, '--hoa-px-card-offset', amount * [13, -18, 11][i % 3]);
          });
        }
      }
    }
    function requestRender() {
      if (!frame && !reduceMotion.matches) frame = window.requestAnimationFrame(render);
    }
    function onPreferenceChange() {
      if (reduceMotion.matches) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        clearLayer(hero, ['--hoa-px-hero-pattern', '--hoa-px-hero-photo', '--hoa-px-hero-copy']);
        clearLayer(products, ['--hoa-px-product-back', '--hoa-px-product-front']);
        clearLayer(story, ['--hoa-story-deep', '--hoa-story-near', '--hoa-story-flower']);
        if (delivery) delivery.querySelectorAll('.flower-info-card').forEach(function(card) {
          clearLayer(card, ['--hoa-px-card-offset']);
        });
      } else requestRender();
    }
    body.classList.add('hoa-parallax-ready');
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender, { passive: true });
    window.addEventListener('pageshow', requestRender);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) requestRender(); });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onPreferenceChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onPreferenceChange);
    requestRender();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
