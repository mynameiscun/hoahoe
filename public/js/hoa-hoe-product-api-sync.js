/* Step 08: nguồn dữ liệu thống nhất cho trang chi tiết và giỏ hàng.
 * Cổng 8000: chỉ tin Django API. Cổng khác: giữ catalog demo để thiết kế giao diện.
 * Không gửi đơn/thanh toán tại đây.
 */
(function () {
  'use strict';

  var catalog = window.FIAMA_DEMO_PRODUCTS || {};
  window.HOA_HOE_CATALOG_SYNC_STATE = 'loading';

  var isGitHubDemo = location.hostname.endsWith('.github.io');
  var apiWebsite = location.port === '8000' || (location.protocol === 'https:' && !isGitHubDemo);
  if (!apiWebsite) {
    window.HOA_HOE_CATALOG_SYNC_STATE = 'demo';
    window.HOA_HOE_CATALOG_READY = Promise.resolve('demo');
    return;
  }

  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 22000);
  window.HOA_HOE_CATALOG_READY = fetch('/api/products/', {
    signal: controller.signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  }).then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(function (data) {
    if (!data || data.ok === false || !Array.isArray(data.products)) throw new Error(data && data.error || 'Dữ liệu API không hợp lệ');

    var next = {};
    data.products.forEach(function (item) {
      if (!item || typeof item.code !== 'string' || !/^[\w-]{1,20}$/.test(item.code)) return;
      if (typeof item.name !== 'string' || !item.name.trim()) return;
      var amount = Number(item.price);
      if (!Number.isSafeInteger(amount) || amount < 0) return;
      var previous = catalog[item.code] || {};
      var image = '';
      if (typeof item.image === 'string' && item.image) {
        try {
          var url = new URL(item.image, location.origin);
          if (url.origin === location.origin && /^https?:$/.test(url.protocol)) image = url.href;
        } catch (e) { /* Từ chối đường dẫn ảnh không hợp lệ. */ }
      }
      next[item.code] = Object.assign({}, previous, {
        id: item.code,
        name: item.name.trim(),
        slug: typeof item.slug === 'string' ? item.slug : '',
        price: amount,
        description: typeof item.description === 'string' ? item.description : '',
        image: image,
        isActive: true
      });
    });

    // Không để sản phẩm đã ẩn vẫn được mua bằng giá ở catalog demo.
    Object.keys(catalog).forEach(function (id) { delete catalog[id]; });
    Object.keys(next).forEach(function (id) { catalog[id] = next[id]; });
    window.HOA_HOE_CATALOG_SYNC_STATE = 'live';
    document.dispatchEvent(new CustomEvent('hoa-hoe:catalog-ready'));
    return 'live';
  }).catch(function (error) {
    console.error('Hoa Hoè: Không thể lấy giá sản phẩm từ API:', error);
    window.HOA_HOE_CATALOG_SYNC_STATE = 'error';
    // Không xóa snapshot giỏ hoặc catalog giao diện khi API lỗi. Chức năng mua vẫn khóa.
    document.dispatchEvent(new CustomEvent('hoa-hoe:catalog-error'));
    return 'error';
  }).finally(function () { clearTimeout(timeout); });
}());
