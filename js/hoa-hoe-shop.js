/* Hoa Hoè — Shop: sắp xếp / tìm kiếm cho cả dữ liệu DEMO và Django/MySQL.
 * Hoạt động với Nice Select của Fiama (jQuery) và thẻ <select> gốc.
 * Không thay đổi giá, sản phẩm, cart hay yêu cầu mạng.
 */
(function () {
  'use strict';

  var select = document.getElementById('hoa-sort');
  var search = document.getElementById('flower-search-input');
  var form = document.getElementById('flower-shop-search');
  var grid = document.querySelector('#liton_product_grid .ltn__product-grid-view > .row');
  var list = document.querySelector('#liton_product_list .ltn__product-list-view > .row');
  var countLabel = document.querySelector('.showing-product-number span');
  if (!grid && !list) return;

  function catalog() {
    // API thay đổi thuộc tính của object này sau khi tải xong dữ liệu MySQL.
    return window.FIAMA_DEMO_PRODUCTS || {};
  }

  function update() {
    var products = catalog();
    var ids = Object.keys(products);
    var originalOrder = new Map(ids.map(function (id, index) { return [id, index]; }));
    var order = select ? select.value : 'default';
    var needle = search ? search.value.trim().toLocaleLowerCase('vi') : '';
    var visibleCount = 0;

    [grid, list].forEach(function (container, viewIndex) {
      if (!container) return;
      var cards = Array.from(container.children).filter(function (element) {
        return element.hasAttribute('data-flower-sort-id');
      });

      cards.sort(function (a, b) {
        var aId = a.getAttribute('data-flower-sort-id');
        var bId = b.getAttribute('data-flower-sort-id');
        var x = products[aId];
        var y = products[bId];
        if (!x || !y) return 0;
        if (order === 'price-low') return (Number(x.price) - Number(y.price)) || ((originalOrder.get(aId) || 0) - (originalOrder.get(bId) || 0));
        if (order === 'price-high') return (Number(y.price) - Number(x.price)) || ((originalOrder.get(aId) || 0) - (originalOrder.get(bId) || 0));
        if (order === 'name') return String(x.name).localeCompare(String(y.name), 'vi');
        return (originalOrder.get(aId) || 0) - (originalOrder.get(bId) || 0);
      });

      cards.forEach(function (card) {
        var id = card.getAttribute('data-flower-sort-id');
        var product = products[id];
        var matches = Boolean(product && String(product.name).toLocaleLowerCase('vi').includes(needle));
        card.style.display = matches ? '' : 'none';
        if (viewIndex === 0 && matches) visibleCount++;
        // Chỉ di chuyển khi cần: hạn chế DOM thay đổi và tránh nháy màn hình.
        container.appendChild(card);
      });
    });

    if (!grid && list) {
      visibleCount = Array.from(list.children).filter(function (element) {
        return element.hasAttribute('data-flower-sort-id') && element.style.display !== 'none';
      }).length;
    }
    if (countLabel) countLabel.textContent = visibleCount + ' / ' + ids.length + ' mẫu hoa';
  }

  var keyword = new URLSearchParams(location.search).get('search');
  if (keyword && search) search.value = keyword;

  if (select) {
    // Người dùng thay đổi trực tiếp thẻ select (và API gọi dispatchEvent('change')).
    select.addEventListener('change', update);

    // Fiama Nice Select gọi jQuery .trigger('change'), không phát native change.
    if (window.jQuery) window.jQuery(select).on('change.hoaHoeShop', update);

    // Dự phòng khi plugin Nice Select được khởi tạo sau script này:
    // click option ở giao diện tùy biến, đợi plugin cập nhật select.value.
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var option = target.closest('.nice-select .option');
      if (option && option.closest('.nice-select') === select.nextElementSibling) {
        window.setTimeout(update, 0);
      }
    });
  }

  if (search) search.addEventListener('input', update);
  if (form) form.addEventListener('submit', function (event) {
    event.preventDefault();
    update();
  });

  update();
})();
