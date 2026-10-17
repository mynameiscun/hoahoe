/* Hoa Hoè Step 12.5D: gắn bảng phí giao vào trang thực tế.
 * Độc lập với API giá sản phẩm, không ghi đơn, không mở thanh toán.
 */
(function () {
  'use strict';
  const path = location.pathname.replace(/\/+$/, '').toLowerCase();
  const isProduct = /(?:^|\/)product-details(?:\.html)?$/.test(path);
  const isCheckout = /(?:^|\/)checkout(?:\.html)?$/.test(path);
  if (!isProduct && !isCheckout) return;

  function mount() {
    const ui = window.HOA_HOE_PAYMENT_UI;
    if (!ui || typeof ui.guide !== 'function') return;
    if (isProduct) {
      if (document.getElementById('hoa-product-shipping-guide')) return;
      const info = document.querySelector('.ltn__shop-details-inner .shop-details-info') || document.querySelector('.shop-details-info');
      if (!info) return;
      const guide = ui.guide({title: 'Phí giao hoa tham khảo', open: false});
      guide.id = 'hoa-product-shipping-guide';
      const anchor = info.querySelector('.product-price-ratting') || info.querySelector('.product-price') || info.querySelector('h3');
      if (anchor) anchor.insertAdjacentElement('afterend', guide);
      else info.prepend(guide);
    }
    if (isCheckout) {
      if (document.getElementById('hoa-checkout-shipping-guide')) return;
      const summary = document.querySelector('.hoa-checkout-summary');
      if (!summary) return;
      const guide = ui.guide({title: 'Kiểm tra phí giao trước khi thanh toán', open: false});
      guide.id = 'hoa-checkout-shipping-guide';
      // Thông báo và bảng phí đặt ngay dưới giỏ, không chạm đến JS đặt đơn.
      const anchor = summary.querySelector('.table-responsive') || summary.querySelector('table');
      if (anchor) anchor.insertAdjacentElement('afterend', guide);
      else summary.appendChild(guide);
    }
  }

  function start() {
    if (window.HOA_HOE_PAYMENT_UI) { mount(); return; }
    const script = document.createElement('script');
    script.src = 'js/hoa-hoe-shipping-ui.js';
    script.onload = mount;
    script.onerror = function () {
      console.error('[Hoa Hoè] Không tải được js/hoa-hoe-shipping-ui.js. Kiểm tra đường dẫn xuất bản của Cloudflare.');
    };
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
