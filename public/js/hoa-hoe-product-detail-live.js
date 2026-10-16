/* Step 08: chi tiết sản phẩm theo catalog đã đồng bộ Django/MySQL.
 * Chỉ sửa vùng nội dung sản phẩm; giữ nguyên Fiama header/footer và giỏ hàng demo.
 */
(function () {
  'use strict';

  var root = document.querySelector('.ltn__shop-details-inner');
  if (!root) return;
  var info = root.querySelector('.shop-details-info');
  if (!info) return;
  var button = info.querySelector('.d-add-to-cart');
  var title = info.querySelector('h3');
  var status = document.createElement('p');
  status.className = 'hoa-draft-notice hoa-detail-api-status';
  status.setAttribute('role', 'status');
  status.textContent = (location.port === '8000' || (location.protocol === 'https:' && !location.hostname.endsWith('.github.io'))) ? 'Đang lấy thông tin sản phẩm từ cửa hàng…' : '';
  info.insertBefore(status, info.firstChild);
  if (button) {
    button.setAttribute('aria-disabled', 'true');
    button.style.pointerEvents = 'none';
  }

  var money = function (v) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
  };
  function text(el, value) { if (el) el.textContent = value; }
  function disable(message) {
    text(title, 'Chưa thể hiển thị bó hoa');
    status.textContent = message;
    if (button) {
      button.removeAttribute('data-demo-add');
      button.removeAttribute('data-bs-toggle');
      button.removeAttribute('data-bs-target');
      button.setAttribute('aria-disabled', 'true');
      button.style.pointerEvents = 'none';
    }
    var gallery = root.querySelector('.ltn__shop-details-img-gallery');
    if (gallery) gallery.style.display = 'none';
    root.removeAttribute('data-fiama-product-id');
  }
  function updateGallery(p) {
    var thumb = root.querySelector('.ltn__shop-details-small-img');
    var large = root.querySelector('.ltn__shop-details-large-img');
    if (!thumb || !large) return;
    var gallery = root.querySelector('.ltn__shop-details-img-gallery');
    if (!p.image) {
      if (gallery) gallery.style.display = 'none';
      return;
    }
    if (gallery) gallery.style.display = '';
    var images = [{ src: p.image, caption: 'Bó hoa ' + p.name }];
    // Poster chỉ là tư liệu mô tả địa phương, không thay thế ảnh chính trong Django.
    if (p.poster && p.poster !== p.image) images.push({ src: p.poster, caption: 'Ảnh thiết kế ' + p.name });

    // main.js đã tạo Slick; tháo ra đúng cách trước khi thay nội dung.
    var jq = window.jQuery;
    if (jq && jq.fn && jq.fn.slick) {
      [thumb, large].forEach(function (el) {
        if (jq(el).hasClass('slick-initialized')) jq(el).slick('unslick');
      });
    }
    thumb.replaceChildren();
    large.replaceChildren();
    images.forEach(function (img) {
      var small = document.createElement('div');
      small.className = 'single-small-img';
      var mini = document.createElement('img');
      mini.src = img.src;
      mini.alt = img.caption;
      small.appendChild(mini);
      thumb.appendChild(small);

      var big = document.createElement('div');
      big.className = 'single-large-img';
      var link = document.createElement('a');
      link.href = img.src;
      link.setAttribute('data-rel', 'lightcase:myCollection');
      var full = document.createElement('img');
      full.src = img.src;
      full.alt = img.caption;
      link.appendChild(full);
      big.appendChild(link);
      large.appendChild(big);
    });
    if (jq && jq.fn && jq.fn.slick && images.length > 1) {
      jq(large).slick({ slidesToShow: 1, slidesToScroll: 1, arrows: false, fade: true,
        asNavFor: '.ltn__shop-details-small-img', adaptiveHeight: true });
      jq(thumb).slick({ slidesToShow: Math.min(2, images.length), slidesToScroll: 1,
        asNavFor: '.ltn__shop-details-large-img', dots: false, arrows: false, focusOnSelect: true });
    }
  }

  function updateRelated(catalog, currentId) {
    document.querySelectorAll('.ltn__related-product-slider-one-active .ltn__product-item').forEach(function (card) {
      var id = card.getAttribute('data-fiama-product-id');
      var p = catalog[id];
      if (id === currentId || !p) {
        card.style.display = 'none';
        card.querySelectorAll('[data-demo-add]').forEach(function (a) {
          a.removeAttribute('data-demo-add'); a.style.pointerEvents = 'none';
        });
        return;
      }
      var img = card.querySelector('.product-img img');
      if (img) {
        if (p.image) { img.src = p.image; img.style.display = ''; }
        else img.style.display = 'none';
        img.alt = 'Bó hoa ' + p.name;
      }
      var a = card.querySelector('.product-title a');
      if (a) { a.textContent = p.name; a.href = 'product-details.html?product=' + encodeURIComponent(p.id); }
      var price = card.querySelector('.product-price span');
      text(price, money(p.price));
    });
  }

  function render() {
    if (window.HOA_HOE_CATALOG_SYNC_STATE === 'error') {
      disable('Không kết nối được API sản phẩm. Để tránh hiển thị giá cũ, chức năng thêm vào giỏ tạm khóa.');
      return;
    }
    var id = new URLSearchParams(location.search).get('product') || 'hoa-001';
    var catalog = window.FIAMA_DEMO_PRODUCTS || {};
    var p = catalog[id];
    if (!p) { disable('Sản phẩm không tồn tại hoặc đang tạm ngừng kinh doanh. Vui lòng trở lại trang Sản phẩm.'); return; }

    root.setAttribute('data-fiama-product-id', p.id);
    document.title = p.name + ' — Hoa Hoè Flower Shop';
    text(title, p.name);
    text(info.querySelector('.product-price span'), money(p.price));
    var old = info.querySelector('.product-price del'); if (old) old.style.display = 'none';
    text(info.querySelector('.modal-product-brief p'), p.description || 'Liên hệ cửa hàng để được tư vấn thêm về bó hoa.');
    var variations = info.querySelector('.modal-product-meta.mb-20'); if (variations) variations.style.display = 'none';
    var wishlist = info.querySelector('.d-add-to-wishlist'); if (wishlist) {
      var li = wishlist.closest('li'); if (li) li.remove(); else wishlist.remove();
    }
    var stars = info.querySelector('.product-ratting'); if (stars) stars.style.display = 'none';
    var qty = info.querySelector('.cart-plus-minus-box'); if (qty) qty.value = '1';
    if (button) {
      button.textContent = 'THÊM VÀO GIỎ';
      button.setAttribute('title', 'Thêm ' + p.name + ' vào giỏ hàng chạy thử');
      button.removeAttribute('aria-disabled');
      button.style.pointerEvents = '';
      button.removeAttribute('data-bs-target');
      button.removeAttribute('data-bs-toggle');
      button.setAttribute('data-demo-add', '');
    }
    var meta = info.querySelector('.modal-product-meta.mb-30');
    if (meta) {
      meta.replaceChildren();
      var sku = document.createElement('p');
      var strong = document.createElement('strong'); strong.textContent = 'Mã hoa: ';
      sku.appendChild(strong); sku.appendChild(document.createTextNode(p.id));
      meta.appendChild(sku);
      if (p.tone) {
        var tone = document.createElement('p'); tone.textContent = 'Tông màu: ' + p.tone; meta.appendChild(tone);
      }
    }
    var desc = document.querySelector('#liton_tab_details_1_1 .ltn__shop-details-tab-content-inner');
    if (desc) {
      desc.replaceChildren();
      var paragraph = document.createElement('p');
      paragraph.textContent = p.description || 'Liên hệ cửa hàng để biết thêm về sản phẩm.';
      desc.appendChild(paragraph);
    }
    var reviewsLink = document.querySelector('.ltn__shop-details-tab-menu a[href="#liton_tab_details_1_2"]');
    if (reviewsLink) reviewsLink.style.display = 'none';
    var reviewPane = document.querySelector('#liton_tab_details_1_2'); if (reviewPane) reviewPane.remove();
    var shipping = document.querySelector('#liton_tab_details_1_4 .ltn__shop-details-tab-content-inner');
    if (shipping) shipping.textContent = 'Shop tự giao theo khu vực hỗ trợ. Khung giờ dự kiến: 09:00–12:00, 13:00–17:00 và 18:00–20:00. Đặt trước 17:00 ngày hôm trước. Phí giao sẽ được xác nhận riêng.';
    document.querySelectorAll('.ltn__shop-details-tab-menu a').forEach(function (a) {
      if (a.getAttribute('href') === '#liton_tab_details_1_1') a.textContent = 'Mô tả';
      if (a.getAttribute('href') === '#liton_tab_details_1_4') a.textContent = 'Giao hoa';
    });
    updateGallery(p);
    updateRelated(catalog, p.id);
    status.textContent = window.HOA_HOE_CATALOG_SYNC_STATE === 'live'
      ? 'Giá và thông tin được đồng bộ từ dữ liệu cửa hàng. Phí giao được xác nhận riêng.'
      : 'Bản xem giao diện (cổng 5000). Giá và giỏ hàng chỉ dùng để thử nghiệm.';
  }

  function start() {
    Promise.resolve(window.HOA_HOE_CATALOG_READY).then(render, function () {
      disable('Không thể tải dữ liệu sản phẩm.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
