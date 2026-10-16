/* Sync featured static cards when API catalog finishes loading (Django local or Sheets online).
 * Keep original Fiama markup/animations. Remove stale listings if product is not active.
 */
(function () {
  'use strict';
  var catalog = window.FIAMA_DEMO_PRODUCTS || {};
  var money = function (value) {
    return new Intl.NumberFormat('vi-VN', {
      style:'currency', currency:'VND', maximumFractionDigits:0
    }).format(value);
  };
  function sync() {
    var state = window.HOA_HOE_CATALOG_SYNC_STATE;
    document.querySelectorAll('.ltn__product-item[data-fiama-product-id]').forEach(function (card) {
      var p = catalog[card.getAttribute('data-fiama-product-id')];
      // Trong thời gian tải API, chỉ hiển thị trạng thái tải, không dùng giá demo.
      if (state === 'error' || state === 'loading') {
        var label = card.querySelector('.product-price span');
        if (label) label.textContent = state === 'error' ? 'Không tải được giá' : 'Đang tải giá…';
        return;
      }
      if (!p) {
        if (state === 'live' || state === 'error') {
          card.style.display = 'none';
          var add = card.querySelector('[data-demo-add]');
          if (add) add.removeAttribute('data-demo-add');
        }
        return;
      }
      card.style.display = '';
      var href = 'product-details.html?product=' + encodeURIComponent(p.id);
      var image = card.querySelector('.product-img img');
      if (image) {
        if (p.image) image.src = p.image;
        else image.removeAttribute('src');
        image.alt = 'Bó hoa ' + p.name;
      }
      var title = card.querySelector('.product-title a');
      if (title) { title.href = href; title.textContent = p.name; }
      var price = card.querySelector('.product-price span');
      if (price) price.textContent = money(p.price);
      card.querySelectorAll('.product-img a:not([data-demo-add]), .product-hover-action a:not([data-demo-add])')
        .forEach(function (a) { a.href = href; });
      var brief = card.querySelector('.product-brief p');
      if (brief) brief.textContent = p.description || '';
      var add = card.querySelector('[data-demo-add]');
      if (add) add.title = 'Thêm ' + p.name + ' vào giỏ';
    });
  }
  document.addEventListener('hoa-hoe:catalog-ready', sync);
  document.addEventListener('hoa-hoe:catalog-error', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
}());
