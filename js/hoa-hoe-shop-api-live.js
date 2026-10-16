/* Hoa Hoè — Step 07: MySQL là nguồn dữ liệu của trang Shop.
 * Chạy khi shop.html được mở qua Django tại 127.0.0.1:8000.
 * Giữ mã hoa-001 ... hoa-009 để giao diện và giỏ hàng DEMO nhận đúng sản phẩm.
 * Lưu ý: trang chi tiết/giỏ hàng/checkout chưa phải giao dịch thật; sẽ tích hợp ở bước tiếp theo.
 * shop.html?source=demo: xem tạm giao diện 9 mẫu tĩnh để đối chiếu.
 */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('source') === 'demo') return;

  // Cổng 5000/Live Server chỉ phục vụ HTML, không có Django API.
  // Giữ nguyên 9 mẫu tĩnh thay vì gọi /api/products/ sai cổng rồi xóa danh sách.
  // Trong giai đoạn phát triển, chỉ dùng MySQL trực tiếp khi mở trang qua Django :8000.
  var isGitHubDemo = location.hostname.endsWith('.github.io');
  var apiWebsite = location.port === '8000' || (location.protocol === 'https:' && !isGitHubDemo);
  if (!apiWebsite) {
    console.info('Hoa Hoè: đang xem giao diện tĩnh, mở http://127.0.0.1:8000/shop.html để xem sản phẩm từ MySQL.');
    return;
  }

  var grid = document.querySelector('#liton_product_grid .ltn__product-grid-view > .row');
  var list = document.querySelector('#liton_product_list .ltn__product-list-view > .row');
  var options = document.querySelector('.ltn__shop-options');
  var catalog = window.FIAMA_DEMO_PRODUCTS;
  if (!grid || !list || !options || !catalog) return;

  var gridSample = grid.querySelector('[data-flower-sort-id]');
  var listSample = list.querySelector('[data-flower-sort-id]');
  if (!gridSample || !listSample) return;

  // Giữ mẫu Fiama để sao chép, chỉ ẩn các thẻ tĩnh trong lúc tải API.
  gridSample = gridSample.cloneNode(true);
  listSample = listSample.cloneNode(true);
  grid.style.visibility = 'hidden';
  list.style.visibility = 'hidden';

  var banner = document.createElement('p');
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'margin:0 0 18px; padding:10px 14px; border:1px solid #ddd; font-size:14px;';
  banner.textContent = 'Đang tải sản phẩm từ Hoa Hoè…';
  options.parentNode.insertBefore(banner, options);

  var numberFormat = new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0
  });

  function notifyCatalogChange() {
    var sort = document.getElementById('hoa-sort');
    if (sort) sort.dispatchEvent(new Event('change'));
    // Script giỏ hàng demo hiện có nghe sự kiện storage để cập nhật mini-cart.
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'hoa_hoe_draft_cart_v1'
      }));
    } catch (error) {
      // Không ảnh hưởng đến phần hiển thị nếu môi trường cũ không hỗ trợ StorageEvent.
    }
  }

  function clearCatalog() {
    Object.keys(catalog).forEach(function (id) { delete catalog[id]; });
  }

  function setImage(image, product) {
    if (!image) return;
    image.alt = 'Bó hoa ' + product.name;
    // Allow same-origin product images from Sheets or Django media; never allow external/untrusted URLs.
    if (product.image && typeof product.image === 'string') {
      var imageURL = new URL(product.image, location.href);
      if (imageURL.origin === location.origin &&
          /^\/(?:media|img\/(?:product|catalog))\//.test(imageURL.pathname)) {
        image.src = imageURL.href;
        image.style.display = '';
        return;
      }
    }
    image.removeAttribute('src');
    image.style.display = 'none';
  }

  function renderItem(sample, product) {
    var el = sample.cloneNode(true);
    var id = product.code;
    el.setAttribute('data-flower-sort-id', id);
    var card = el.querySelector('.ltn__product-item');
    if (!card) return null;
    card.setAttribute('data-fiama-product-id', id);

    setImage(el.querySelector('.product-img img'), product);
    var href = 'product-details.html?product=' + encodeURIComponent(id);
    var title = el.querySelector('.product-title a');
    if (title) { title.textContent = product.name; title.href = href; }
    var price = el.querySelector('.product-price span');
    if (price) price.textContent = numberFormat.format(product.price);
    var brief = el.querySelector('.product-brief p');
    if (brief) brief.textContent = product.description || '';
    el.querySelectorAll('.product-img a:not([data-demo-add]), .product-hover-action a:not([data-demo-add])')
      .forEach(function (a) { a.href = href; });

    var add = el.querySelector('[data-demo-add]');
    if (add) add.title = 'Thêm ' + product.name + ' vào giỏ chạy thử';
    return el;
  }

  function validProduct(p) {
    return p && typeof p.code === 'string' && p.code.length > 0 && p.code.length <= 20 &&
      typeof p.name === 'string' && p.name.trim().length > 0 &&
      Number.isSafeInteger(p.price) && p.price >= 0 &&
      (p.image == null || typeof p.image === 'string');
  }

  function failure(message) {
    // Không bao giờ xóa 9 mẫu tĩnh khi lỗi mạng/API. Khôi phục hiển thị.
    // Nêu rõ dữ liệu đang là DEMO để không gây hiểu lầm về giá MySQL.
    banner.textContent = 'Không kết nối được API sản phẩm (' + message +
      '). Đang hiển thị 9 mẫu DEMO để bạn kiểm tra giao diện; giá chưa xác nhận từ database.';
    grid.style.visibility = '';
    list.style.visibility = '';
  }

  window.HOA_HOE_CATALOG_SYNC_STATE = 'loading';
  window.HOA_HOE_CATALOG_READY = fetch('/api/products/', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !Array.isArray(payload.products)) throw new Error('Dữ liệu API không đúng định dạng');
      var rows = payload.products;
      if (!rows.every(validProduct)) throw new Error('Sản phẩm có dữ liệu không hợp lệ');
      var ids = rows.map(function (p) { return p.code; });
      if (new Set(ids).size !== rows.length) throw new Error('Có mã sản phẩm trùng');

      var gridNodes = [];
      var listNodes = [];
      var nextCatalog = {};
      rows.forEach(function (p) {
        var g = renderItem(gridSample, p);
        var l = renderItem(listSample, p);
        if (!g || !l) throw new Error('Không tạo được thẻ sản phẩm Fiama');
        gridNodes.push(g);
        listNodes.push(l);
        var previous = catalog[p.code] || {};
        nextCatalog[p.code] = Object.assign({}, previous, {
          id: p.code,
          name: p.name,
          price: p.price,
          image: p.image || '',
          description: p.description || ''
        });
      });

      // Giữ chính object cũ vì các script tìm kiếm/giỏ hàng đã lưu tham chiếu.
      clearCatalog();
      Object.keys(nextCatalog).forEach(function (id) { catalog[id] = nextCatalog[id]; });
      grid.replaceChildren.apply(grid, gridNodes);
      list.replaceChildren.apply(list, listNodes);
      grid.style.visibility = '';
      list.style.visibility = '';
      notifyCatalogChange();
      window.HOA_HOE_CATALOG_SYNC_STATE = 'live';
      document.dispatchEvent(new CustomEvent('hoa-hoe:catalog-ready'));
      banner.textContent = rows.length
        ? 'Đang hiển thị ' + rows.length + ' sản phẩm từ cửa hàng. Giá được xác minh lại khi gửi đơn.'
        : 'Hiện chưa có bó hoa nào đang kinh doanh.';
      return 'live';
    })
    .catch(function (error) {
      console.error('Lỗi tải sản phẩm Hoa Hoè từ API:', error);
      window.HOA_HOE_CATALOG_SYNC_STATE = 'error';
      document.dispatchEvent(new CustomEvent('hoa-hoe:catalog-error'));
      failure(error.message || 'Không xác định');
      return 'error';
    });
})();
