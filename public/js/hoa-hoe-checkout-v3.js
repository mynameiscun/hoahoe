/* Hoa Hoè Checkout: kiểm tra giá, xác nhận phí giao, chuyển khoản và gửi đơn.
 * Bảo toàn các bước kiểm tra từ API và xác minh giao dịch thủ công của shop.
 */
(function () {
  'use strict';
  const CART_KEY = 'hoa_hoe_draft_cart_v1';
  const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];
  const djangoLocal = location.port === '8000' && LOCAL_HOSTS.includes(location.hostname);
  const sheetsWebsite = location.protocol === 'https:' && !location.hostname.endsWith('.github.io');
  const money = value => new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND', maximumFractionDigits: 0}).format(value);
  const byId = id => document.getElementById(id);

  function start() {
    const form = byId('hoa-checkout-form');
    if (!form) return;
    const previewButton = byId('hoa-preview-order');
    const submitButton = byId('hoa-submit-order');
    const consent = byId('hoa-checkout-test-consent');
    const status = byId('hoa-checkout-status');
    const success = byId('hoa-checkout-success');
    const rows = byId('hoa-checkout-items');
    const total = byId('hoa-checkout-subtotal');
    const modal = byId('hoa-order-success-modal');
    const modalPanel = modal.querySelector('.hoa-order-modal__panel');
    const modalCode = byId('hoa-order-modal-code');
    const modalCopyStatus = byId('hoa-order-modal-copy-status');
    const modalShopButton = byId('hoa-order-modal-shop');
    const pageWrapper = document.querySelector('.body-wrapper');
    const hoaLoading = document.createElement('div');
    hoaLoading.className = 'hoa-action-loading';
    hoaLoading.id = 'hoa-action-loading';
    hoaLoading.hidden = true;
    hoaLoading.tabIndex = -1;
    hoaLoading.setAttribute('role', 'dialog');
    hoaLoading.setAttribute('aria-modal', 'true');
    hoaLoading.setAttribute('aria-labelledby', 'hoa-loading-title');
    const hoaLoadingPanel = document.createElement('div');
    hoaLoadingPanel.className = 'hoa-action-loading__panel';
    const hoaFlower = document.createElement('div');
    hoaFlower.className = 'hoa-action-loading__flower';
    hoaFlower.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) {
      const petal = document.createElement('span');
      petal.className = 'hoa-action-loading__petal';
      petal.style.setProperty('--petal', String(i));
      hoaFlower.appendChild(petal);
    }
    const hoaCenter = document.createElement('span');
    hoaCenter.className = 'hoa-action-loading__center';
    hoaFlower.appendChild(hoaCenter);
    const hoaLoadingText = document.createElement('p');
    hoaLoadingText.id = 'hoa-loading-title';
    hoaLoadingText.className = 'hoa-action-loading__text';
    hoaLoadingText.textContent = 'Hoa Hoè đang xử lý...';
    const hoaLoadingNote = document.createElement('small');
    hoaLoadingNote.textContent = 'Vui lòng không gửi lại đơn khi đang xử lý.';
    hoaLoadingNote.hidden = true;
    hoaLoadingPanel.append(hoaFlower, hoaLoadingText, hoaLoadingNote);
    hoaLoading.appendChild(hoaLoadingPanel);
    document.body.appendChild(hoaLoading);
    let hoaLoadingOldOverflow = '';
    let hoaLoadingFocus = null;
    function hoaShowLoading(text, submitting = false) {
      if (hoaLoading.hidden) {
        hoaLoadingFocus = document.activeElement;
        hoaLoadingOldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.body.setAttribute('aria-busy', 'true');
        hoaLoading.hidden = false;
      }
      hoaLoadingText.textContent = text || 'Hoa Hoè đang xử lý...';
      hoaLoadingNote.hidden = !submitting;
      hoaLoading.focus({preventScroll:true});
    }
    function hoaHideLoading() {
      if (hoaLoading.hidden) return;
      hoaLoading.hidden = true;
      document.body.style.overflow = hoaLoadingOldOverflow;
      document.body.removeAttribute('aria-busy');
      // Khong cuop focus cua modal xac nhan da hien sau khi gui thanh cong.
      if (modal.hidden && hoaLoadingFocus && typeof hoaLoadingFocus.focus === 'function' &&
          hoaLoadingFocus.isConnected && !hoaLoadingFocus.disabled) {
        hoaLoadingFocus.focus({preventScroll:true});
      }
      hoaLoadingFocus = null;
    }
    document.addEventListener('keydown', event => {
      if (!hoaLoading.hidden && (event.key === 'Tab' || event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    let submittedCode = '';
    let paymentStage = null;
    async function copyCode(code, feedback) {
      if (!code) return;
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
          copied = true;
        }
      } catch (_) { /* Có thể bị chặn quyền clipboard: thử cách dự phòng. */ }
      if (!copied) {
        const temporary = document.createElement('textarea');
        temporary.value = code;
        temporary.setAttribute('readonly', '');
        temporary.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(temporary);
        temporary.select();
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
        temporary.remove();
      }
      feedback.textContent = copied ? 'Đã sao chép mã đơn!' : 'Không thể tự sao chép. Hãy bôi đen mã đơn để lưu lại.';
    }

    function closeSuccessModal() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('hoa-order-modal-open');
      if (pageWrapper) pageWrapper.removeAttribute('inert');
      const fallbackCopy = byId('hoa-checkout-success-copy');
      (fallbackCopy || success).focus();
    }

    function showSuccessModal(code) {
      submittedCode = code;
      modalCode.textContent = code;
      modalCopyStatus.textContent = '';
      modalShopButton.disabled = false;
      modalShopButton.textContent = 'Xem thêm hoa';
      modal.hidden = false;
      document.body.classList.add('hoa-order-modal-open');
      if (pageWrapper) pageWrapper.setAttribute('inert', '');
      byId('hoa-order-modal-copy').focus();
    }

    modal.querySelectorAll('[data-hoa-close-modal]').forEach(button => {
      button.addEventListener('click', closeSuccessModal);
    });
    byId('hoa-order-modal-copy').addEventListener('click', () => copyCode(submittedCode, modalCopyStatus));
    modalShopButton.addEventListener('click', () => {
      if (!modalShopButton.disabled) window.location.assign('shop.html');
    });
    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSuccessModal();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(modalPanel.querySelectorAll('button:not(:disabled), a[href]'))
          .filter(el => el.getClientRects().length > 0);
        if (!focusable.length) { event.preventDefault(); modalPanel.focus(); return; }
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modalPanel)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });

    const localOnly = djangoLocal || sheetsWebsite;
    let captcha = null, captchaToken = '';
    const districtSelect = byId('hoa-delivery-district');
    const wardSelect = byId('hoa-delivery-ward');
    const wardManualGroup = byId('hoa-ward-manual-group');
    const wardManualInput = byId('hoa-delivery-ward-manual');
    const streetInput = byId('hoa-delivery-street');
    // Fiama main.js chạy niceSelect() trên mọi <select> khi tải trang.
    // Hai ô địa chỉ lại được nạp option bằng API sau đó: Nice Select giữ bản sao
    // danh sách cũ, khiến menu chỉ hiện một mục 'Chọn quận/huyện'.
    // Trả hai ô chọn này về select gốc của trình duyệt: danh sách luôn cập nhật
    // đúng sau khi fetch, không phụ thuộc vào plugin hay kết nối API.
    if (window.jQuery && typeof window.jQuery.fn.niceSelect === 'function') {
      window.jQuery(districtSelect).niceSelect('destroy');
      window.jQuery(wardSelect).niceSelect('destroy');
    }
    // Danh sách huyện/quận cũ (phạm vi phục vụ) cho chế độ xem giao diện 5000.
    const demoDistricts = [
      ['760','Quận 1'], ['761','Quận 12'], ['764','Quận Gò Vấp'],
      ['765','Quận Bình Thạnh'], ['766','Quận Tân Bình'], ['767','Quận Tân Phú'],
      ['768','Quận Phú Nhuận'], ['769','Thành phố Thủ Đức'], ['770','Quận 3'],
      ['771','Quận 10'], ['772','Quận 11'], ['773','Quận 4'],
      ['774','Quận 5'], ['775','Quận 6'], ['776','Quận 8'],
      ['777','Quận Bình Tân'], ['778','Quận 7'], ['783','Huyện Củ Chi'],
      ['784','Huyện Hóc Môn'], ['785','Huyện Bình Chánh'],
      ['786','Huyện Nhà Bè'], ['787','Huyện Cần Giờ']
    ];

    function option(select, value, text) {
      const item = document.createElement('option');
      item.value = value; item.textContent = text; select.appendChild(item);
    }
    function showManualWard(enabled) {
      wardManualGroup.hidden = !enabled;
      wardManualInput.disabled = !enabled;
      wardManualInput.required = enabled;
      if (!enabled) wardManualInput.value = '';
    }
    function useManualWard(message) {
      wardSelect.replaceChildren();
      option(wardSelect, 'manual', 'Phường / Xã (nhập tay và chờ shop xác minh)');
      wardSelect.disabled = false;
      wardSelect.value = 'manual';
      showManualWard(true);
      messageArea.textContent = message || '';
      messageArea.hidden = !message;
    }
    const messageArea = document.createElement('small');
    messageArea.id = 'hoa-ward-source-note';
    messageArea.setAttribute('role', 'status');
    wardSelect.insertAdjacentElement('afterend', messageArea);
    messageArea.hidden = true;
    let wardRequestCounter = 0;

    async function loadDistricts() {
      let data = demoDistricts.map(([code, name]) => ({code, name}));
      if (djangoLocal) {
        try {
          const res = await fetch('/api/orders/areas/', {cache:'no-store', credentials:'same-origin'});
          if (!res.ok) throw new Error('Không tải được quận/huyện.');
          const body = await res.json();
          if (!body.ok || !Array.isArray(body.districts) || body.districts.length !== 22)
            throw new Error('Danh sách khu vực không hợp lệ.');
          data = body.districts;
        } catch (_) {
          messageArea.textContent = 'Vui lòng kiểm tra lại khu vực giao hoa trước khi gửi.';
          messageArea.hidden = false;
        }
      }
      districtSelect.replaceChildren();
      option(districtSelect, '', 'Chọn quận / huyện cũ');
      data.forEach(d => option(districtSelect, String(d.code), d.name));
    }
    // Phường/xã theo quận huyện cũ. Ưu tiên API của shop, chỉ dùng nguồn
    // công khai v1 (trước 07/2025) nếu API shop không có danh mục.
    // Nếu cả hai không truy cập được, khách vẫn nhập tay; không tự đoán tên địa danh.
    async function fetchWardJson(url, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          cache: 'no-store', signal: controller.signal,
          headers: {Accept: 'application/json'}
        });
        if (!response.ok) throw new Error('Không lấy được danh mục phường/xã.');
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    }
    function cleanWards(data) {
      if (!Array.isArray(data)) throw new Error('Danh mục phường/xã không hợp lệ.');
      const seen = new Set();
      const wards = [];
      data.forEach(w => {
        const code = String(w && w.code != null ? w.code : '');
        const name = String(w && w.name || '').trim();
        if (!/^\d{4,8}$/.test(code) || name.length < 2 || name.length > 100 || seen.has(code)) return;
        seen.add(code);
        wards.push({code, name});
      });
      if (!wards.length) throw new Error('Danh mục phường/xã đang trống.');
      return wards;
    }
    function saveWardCache(district, wards) {
      try { sessionStorage.setItem('hoa-wards-v1-' + district, JSON.stringify(wards)); } catch (_) {}
    }
    function readWardCache(district) {
      try {
        const content = sessionStorage.getItem('hoa-wards-v1-' + district);
        return content ? cleanWards(JSON.parse(content)) : null;
      } catch (_) { return null; }
    }
    function displayWards(wards, notice) {
      wardSelect.replaceChildren();
      option(wardSelect, '', 'Chọn phường / xã cũ');
      wards.forEach(w => option(wardSelect, w.code, w.name));
      option(wardSelect, 'manual', 'Không thấy phường/xã? Nhập tay');
      wardSelect.disabled = false;
      messageArea.textContent = notice || '';
      messageArea.hidden = !notice;
    }
    async function loadWards() {
      const requestNo = ++wardRequestCounter;
      const district = districtSelect.value;
      wardSelect.replaceChildren();
      wardSelect.disabled = true;
      showManualWard(false);
      messageArea.textContent = '';
      messageArea.hidden = true;
      if (!district) {
        option(wardSelect, '', 'Chọn quận / huyện trước');
        return;
      }
      const cached = readWardCache(district);
      if (cached) {
        displayWards(cached, 'Chọn địa danh theo quận/huyện cũ; shop sẽ xác nhận địa chỉ giao.');
        return;
      }
      option(wardSelect, '', 'Đang tải phường / xã...');
      let wards;
      try {
        const body = await fetchWardJson('/api/orders/areas/?district=' + encodeURIComponent(district), 4500);
        if (body.ok !== true) throw new Error('Danh mục nội bộ chưa sẵn sàng.');
        wards = cleanWards(body.wards);
      } catch (_) {
        try {
          // API công khai hỗ trợ địa giới cũ trước 01/07/2025.
          const legacy = await fetchWardJson('https://provinces.open-api.vn/api/v1/d/' + encodeURIComponent(district) + '?depth=2', 7000);
          if (String(legacy.code) !== district) throw new Error('Khu vực không khớp.');
          wards = cleanWards(legacy.wards);
        } catch (__) {
          if (requestNo === wardRequestCounter)
            useManualWard('Chưa tải được danh sách. Hãy nhập tên phường/xã để shop kiểm tra.');
          return;
        }
      }
      if (requestNo !== wardRequestCounter || districtSelect.value !== district) return;
      saveWardCache(district, wards);
      displayWards(wards, 'Danh mục địa danh cũ (trước 01/07/2025); shop sẽ xác nhận địa chỉ giao.');
    }
    districtSelect.addEventListener('change', loadWards);
    wardSelect.addEventListener('change', () => showManualWard(wardSelect.value === 'manual'));
    loadDistricts();

    const catalog = window.FIAMA_DEMO_PRODUCTS || {};
    let active = false, ordersEnabled = false, busy = false, items = [], previewed = null, submissionId = null;

    function message(text, isError) {
      status.textContent = text || '';
      status.hidden = !text;
      status.classList.toggle('is-error', Boolean(isError));
    }
    function friendlyError(error, afterPayment = false) {
      const text = String(error?.message || '').trim();
      const generic = !text || /HTTP \d+|CSRF|Django|Google Sheets|MySQL|JSON|API |turnstile\.js|\[object Object\]/i.test(text);
      if (generic) return afterPayment
        ? 'Chưa thể xác nhận đơn. Hãy tra cứu đơn hoặc liên hệ shop trước khi thử lại. Không chuyển tiền thêm.'
        : 'Hệ thống đang bận. Vui lòng thử lại hoặc liên hệ shop.';
      return text;
    }
    function disableActions() {
      previewButton.disabled = !active || busy || items.length === 0;
      submitButton.disabled = !ordersEnabled || !active || busy || !previewed || !consent.checked || !sheetsWebsite; // Step 12.5E: thanh toán chỉ trên Cloudflare công khai.
    }
    function invalidate(event) {
      if (event && event.target === consent) return;
      if (success.hidden === false || busy) return;
      // Không hiển thị thông báo trên mỗi ký tự khi khách đang nhập form.
      if (!previewed && !submissionId && feeClaimed === null && !checkoutReference) return;
      previewed = null;
      submissionId = null;
      feeClaimed = null;
      checkoutReference = null;
      disableActions();
      message('Thông tin đã thay đổi. Hãy kiểm tra lại đơn trước khi tiếp tục.', false);
    }
    function localDay(addDays) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + addDays);
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    }
    byId('hoa-delivery-date').min = localDay(1);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', invalidate);
    form.addEventListener('change', invalidate);
    consent.addEventListener('change', disableActions);

    function readItems() {
      const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(stored) || stored.length > 30) throw new Error('Giỏ hàng không hợp lệ.');
      const seen = new Set();
      return stored.map(entry => {
        if (!entry || typeof entry.id !== 'string' ||
            !Number.isInteger(entry.qty) || entry.qty < 1 || entry.qty > 99 ||
            seen.has(entry.id)) throw new Error('Giỏ hàng có sản phẩm hoặc số lượng không hợp lệ.');
        seen.add(entry.id);
        const product = catalog[entry.id];
        if (!product || !Number.isSafeInteger(product.price) || product.price < 0)
          throw new Error('Giỏ hàng chứa sản phẩm đã ngừng bán. Hãy trở lại trang Shop kiểm tra.');
        return {code: entry.id, quantity: entry.qty, product};
      });
    }
    // Chi nhan anh o cung website, trong thu muc san pham duoc Apps Script cho phep.
    function trustedProductImage(value) {
      if (typeof value !== 'string' || !value) return '';
      try {
        const url = new URL(value, location.href);
        if (url.origin !== location.origin ||
            !/^\/img\/(?:product|catalog)\/[a-zA-Z0-9_.-]+\.(?:webp|png|jpe?g)$/.test(url.pathname)) return '';
        return url.href;
      } catch (_) { return ''; }
    }
    function renderItems(serverItems) {
      rows.replaceChildren();
      let subtotal = 0;
      if (!items.length) {
        const tr = document.createElement('tr'), td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = 'Giỏ hàng trống. Vui lòng chọn hoa tại trang Shop.';
        tr.appendChild(td);
        rows.appendChild(tr);
        total.textContent = '—';
        return;
      }
      // Noi thong tin API da kiem gia voi anh trong catalog da dong bo.
      // Anh KHONG duoc dung de tinh gia, ma san pham do server tra ve la nguon doi chieu.
      const lineByCode = new Map(items.map(p => [p.code, p]));
      const lines = Array.isArray(serverItems)
        ? serverItems.map(p => {
            const matching = lineByCode.get(String(p.code || ''));
            return {name:p.name, qty:p.quantity, line:p.line_total,
              image:matching ? matching.product.image : ''};
          })
        : items.map(p => ({name:p.product.name, qty:p.quantity,
            line:p.product.price * p.quantity, image:p.product.image}));
      lines.forEach(line => {
        if (!Number.isSafeInteger(line.line) || line.line < 0) return;
        subtotal += line.line;
        const tr = document.createElement('tr');
        const name = document.createElement('td');
        const price = document.createElement('td');
        const wrap = document.createElement('div');
        wrap.className = 'hoa-checkout-product';
        const media = document.createElement('div');
        media.className = 'hoa-checkout-product__media';
        const safeImage = trustedProductImage(line.image);
        if (safeImage) {
          const img = document.createElement('img');
          img.src = safeImage; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
          img.width = 72; img.height = 72;
          img.addEventListener('error', () => {
            img.remove();
            media.classList.add('hoa-checkout-product__media--empty');
          }, {once:true});
          media.appendChild(img);
        } else media.classList.add('hoa-checkout-product__media--empty');
        const content = document.createElement('div');
        content.className = 'hoa-checkout-product__details';
        const label = document.createElement('strong');
        label.textContent = typeof line.name === 'string' ? line.name : 'Sản phẩm';
        const amount = document.createElement('small');
        amount.textContent = 'Số lượng: ' + line.qty;
        content.append(label, amount);
        wrap.append(media, content);
        name.appendChild(wrap);
        price.textContent = money(line.line);
        tr.append(name, price);
        rows.appendChild(tr);
      });
      total.textContent = money(subtotal);
    }
    function payload() {
      const out = Object.fromEntries(new FormData(form).entries());
      // Apps Script Sheets v1 chi chap nhan delivery_ward_code='manual'.
      // Khach van CHON tu danh muc cu; ten da chon se duoc gui de Admin doi chieu.
      // Khong can sua Apps Script/Orders, khong tin thong tin dia chi chi tu client.
      if (sheetsWebsite && wardSelect.value && wardSelect.value !== 'manual') {
        const label = wardSelect.selectedOptions[0]?.textContent?.trim() || '';
        out.delivery_ward_code = 'manual';
        out.delivery_ward_manual = label.slice(0, 100);
      }
      // Khong dua gia/ten hoa len lam nguon tinh tien.
      out.items = items.map(item => ({code:item.code, quantity:item.quantity}));
      return out;
    }
    function getCookie(name) {
      return document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) || '';
    }
    async function withCsrf(url, body) {
      if (sheetsWebsite) {
        const res = await fetch(url, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: {'Content-Type':'application/json','Accept':'application/json'},
          body: JSON.stringify(body)
        });
        let data;
        try { data = await res.json(); }
        catch (_) { throw new Error('API Google Sheets trả dữ liệu không hợp lệ.'); }
        if (!res.ok || data.ok === false) throw new Error(
          typeof data.error === 'string' ? data.error : (data.errors || 'Lỗi HTTP ' + res.status)
        );
        return data;
      }
      // Browser cung origin 8000, khong can CORS / csrf_exempt.
      const csrf = await fetch('/api/orders/csrf/', {credentials:'same-origin', cache:'no-store'});
      if (!csrf.ok) throw new Error('Không lấy được CSRF cookie từ Django.');
      const token = decodeURIComponent(getCookie('csrftoken'));
      if (!token) throw new Error('Không có CSRF token. Kiểm tra cookie của trình duyệt.');
      const res = await fetch(url, {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json', 'Accept':'application/json', 'X-CSRFToken':token},
        body:JSON.stringify(body)
      });
      let response;
      try {response = await res.json();} catch (_) {throw new Error('Django trả về dữ liệu không hợp lệ (HTTP ' + res.status + ').');}
      if (!res.ok || response.ok === false) {
        const reasons = response.errors || response.error || response.message || ('HTTP ' + res.status);
        throw new Error(Array.isArray(reasons) ? reasons.join(' ') : String(reasons));
      }
      return response;
    }
    function validForm() {
      if (!districtSelect.value || !wardSelect.value) {
        message('Hãy chọn đầy đủ quận/huyện và phường/xã.', true);
        return false;
      }
      if (wardSelect.value === 'manual' && !wardManualInput.value.trim()) {
        message('Vui lòng nhập tên phường/xã để shop kiểm tra.', true);
        wardManualInput.focus();
        return false;
      }
      if (!streetInput.value.trim()) {
        message('Vui lòng nhập số nhà, tên đường và địa chỉ cụ thể.', true);
        streetInput.focus();
        return false;
      }
      if (!form.reportValidity()) return false;
      if (!items.length) {message('Giỏ hàng đang trống.', true); return false;}
      return true;
    }
    async function doPreview() {
      if (!active || busy || !validForm()) return;
      // Khi shop chưa bật nhận đơn: chỉ kiểm tra dữ liệu nhập trên trình duyệt.
      // TUYỆT ĐỐI không gọi API preview/submit hay tạo mã đơn.
      if (!ordersEnabled) {
        previewed = null;
        renderItems();
        disableActions();
        message(window.HOA_HOE_CATALOG_SYNC_STATE === 'demo' ? 'Đã kiểm tra biểu mẫu. Đây là bản xem trước; không gửi đơn thật.' : 'Thông tin đã đầy đủ. Shop hiện chưa nhận đơn trực tuyến.', false);
        return;
      }
      busy = true;
      previewed = null;
      disableActions();
      message('', false);
      hoaShowLoading('Đang kiểm tra đơn hoa...');
      try {
        const result = await withCsrf('/api/orders/preview/', payload());
        if (!Number.isSafeInteger(result.subtotal) || !Array.isArray(result.items))
          throw new Error('API xem trước trả dữ liệu không đầy đủ.');
        previewed = result;
        renderItems(result.items);
        const areaResult = result.delivery_area;
        const pendingWardReview = areaResult && areaResult.ward_reference_checked === false;
        message('Đã kiểm tra đơn: ' + money(result.subtotal) + ' (chưa gồm phí giao).' +
          (pendingWardReview ? ' Shop sẽ xác nhận lại địa chỉ giao.' : '') +
          ' Bạn có thể tiếp tục.', false);
      } catch (error) {
        message('Không thể kiểm tra đơn: ' + friendlyError(error), true);
      } finally {hoaHideLoading(); busy = false; disableActions();}
    }
    // Chỉ ghi đơn khi khách đã xác nhận chuyển khoản.
    let inProgressPayment = false;
    let feeClaimed = null;
    let checkoutReference = null;
    function node(tag, className, text) {
      const x = document.createElement(tag);
      if (className) x.className = className;
      if (text !== undefined) x.textContent = text;
      return x;
    }
    function textLine(label, value, highlight) {
      const line = node('div', 'hoa-e-row' + (highlight ? ' hoa-e-row--total' : ''));
      line.append(node('span', '', label), node('strong', '', value));
      return line;
    }
    function newReference() {
      if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error('Trình duyệt cần hỗ trợ tạo mã đối soát an toàn.');
      const b = crypto.getRandomValues(new Uint8Array(6));
      return 'HHCK' + Array.from(b, a => a.toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    function closePayment() {
      if (!paymentStage) return;
      paymentStage.remove(); paymentStage = null;
      document.body.classList.remove('hoa-e-lock');
      form.removeAttribute('aria-hidden');
      submitButton.focus({preventScroll:true});
    }
    function showPaymentStep(view) {
      if (paymentStage) paymentStage.remove();
      const shade = node('div','hoa-e-shade');
      shade.setAttribute('role','dialog'); shade.setAttribute('aria-modal','true');
      shade.setAttribute('aria-label','Các bước xác nhận phí giao và thanh toán');
      const card = node('section','hoa-e-card');
      card.tabIndex = -1;
      const header = node('div','hoa-e-head');
      header.append(node('span','hoa-e-brand','✿  HOA HOÈ'), node('h2','',view === 'fee' ? 'Xác nhận phí giao' : 'Thanh toán chuyển khoản'));
      const step = node('p','hoa-e-step',view === 'fee' ? 'Bước 2/3 · Kiểm tra phí giao' : 'Bước 3/3 · Chuyển khoản');
      const back = node('button','hoa-e-close','×');back.type='button'; back.setAttribute('aria-label','Quay lại Checkout');
      back.addEventListener('click', closePayment);
      header.append(step,back);card.appendChild(header);
      shade.appendChild(card);document.body.appendChild(shade);
      paymentStage = shade;
      document.body.classList.add('hoa-e-lock');
      form.setAttribute('aria-hidden','true');
      card.focus({preventScroll:true});
      return card;
    }
    function contactArea(container) {
      const block=node('div','hoa-e-contact');
      block.appendChild(node('p','', 'Cần hỗ trợ về phí giao? Liên hệ Hoa Hoè:'));
      if (window.HOA_HOE_PAYMENT_UI && window.HOA_HOE_PAYMENT_UI.link) {
        block.appendChild(window.HOA_HOE_PAYMENT_UI.link());
      }
      const backup=node('a','hoa-e-secondary','Thông tin liên hệ khác');
      backup.href='contact.html';block.append(backup);container.append(block);
    }
    function feeStep() {
      const card=showPaymentStep('fee');
      card.appendChild(node('p','hoa-e-hint','Nhập phí giao đã thống nhất với shop để xem tổng thanh toán.'));
      card.appendChild(textLine('Tiền hoa đã kiểm tra',money(previewed.subtotal)));
      const formChoices = node('fieldset','hoa-e-choice');
      formChoices.appendChild(node('legend','','Phí giao hàng'));
      const yesLabel=node('label','hoa-e-radio');const yes=node('input');yes.type='radio';yes.name='hoa-e-shipping-choice';yes.value='confirmed';yes.checked=true;
      yesLabel.append(yes, document.createTextNode(' Tôi đã có phí giao'));
      const laterLabel=node('label','hoa-e-radio');const later=node('input');later.type='radio';later.name='hoa-e-shipping-choice';later.value='later';
      laterLabel.append(later,document.createTextNode(' Tôi cần hỏi phí giao'));
      formChoices.append(yesLabel,laterLabel);card.append(formChoices);
      const confirmedSection=node('div','hoa-e-confirmed');
      const feeLabel=node('label','','Phí giao đã thống nhất (VNĐ)');
      const feeInput=node('input','hoa-e-input');feeInput.type='number';feeInput.inputMode='numeric';feeInput.min='0';feeInput.max='999999';feeInput.step='1000';
      feeInput.placeholder='Ví dụ: 40000';feeInput.value=feeClaimed === null ? '' : String(feeClaimed);
      feeLabel.appendChild(feeInput);
      confirmedSection.appendChild(feeLabel);
      confirmedSection.appendChild(node('small','hoa-e-hint','Nhập 0 nếu shop miễn phí giao.'));
      const agreeLabel=node('label','hoa-e-agree');const agree=node('input');agree.type='checkbox';
      agreeLabel.append(agree,document.createTextNode(' Tôi đã xác nhận phí giao với shop.'));
      confirmedSection.append(agreeLabel);
      const total=textLine('Tổng cần chuyển', '—',true);confirmedSection.append(total);
      const error=node('p','hoa-e-error');error.setAttribute('role','alert');
      const next=node('button','hoa-e-primary','Tiếp tục đến QR →');next.type='button';
      confirmedSection.append(error,next);card.appendChild(confirmedSection);
      const laterSection=node('div','hoa-e-later');laterSection.hidden=true;
      laterSection.append(node('p','','Vui lòng liên hệ shop để xác nhận phí giao trước khi thanh toán.'));
      contactArea(laterSection);
      const returnBtn=node('button','hoa-e-secondary','Đã có phí giao · Tiếp tục');returnBtn.type='button';
      returnBtn.addEventListener('click',()=>{yes.checked=true;toggle();});laterSection.append(returnBtn);card.append(laterSection);
      contactArea(confirmedSection);
      function toggle(){confirmedSection.hidden=later.checked;laterSection.hidden=!later.checked;}
      yes.addEventListener('change',toggle);later.addEventListener('change',toggle);
      feeInput.addEventListener('input',()=>{
        const f=Number(feeInput.value);
        total.lastElementChild.textContent=feeInput.value !== '' && Number.isSafeInteger(f) && f >= 0 && f <= 999999
          ? money(previewed.subtotal + f) : '—';
      });
      feeInput.dispatchEvent(new Event('input'));
      next.addEventListener('click',()=>{
        const fee=Number(feeInput.value);
        if (!feeInput.value.trim() || !Number.isSafeInteger(fee) || fee < 0 || fee > 999999) {
          error.textContent='Phí giao phải là số nguyên từ 0 đến 999.999 đồng.';feeInput.focus();return;
        }
        if (!agree.checked) {error.textContent='Hãy xác nhận bạn đã thống nhất phí giao với shop.';agree.focus();return;}
        feeClaimed=fee;
        if (!checkoutReference) checkoutReference = newReference();
        qrStep();
      });
    }
    function qrStep() {
      const card=showPaymentStep('qr');
      card.appendChild(node('p','hoa-e-hint','Quét mã QR để chuyển đúng số tiền và nội dung bên dưới.'));
      const qrFrame=node('div','hoa-e-qr');
      // HOAHOE_DYNAMIC_QR_12_5F: QR động theo tổng tiền đã xác nhận với shop.
      const placeholder=node('div','hoa-e-qr-empty','Đang tạo QR chuyển khoản...');
      const qr=node('img','hoa-e-qr-image');
      qr.alt='QR VietQR của Hoa Hoè, gồm tổng tiền và mã đối soát';
      qr.hidden=true;
      let qrReady=false;
      const currentPaymentStage=paymentStage;
      const amount=previewed.subtotal + feeClaimed;
      const bankBox=node('div','hoa-e-bank-info');
      qrFrame.append(placeholder,qr);
      card.append(qrFrame,bankBox);
      const validAccount=(bank) => bank && /^\d{6}$/.test(bank.bank_bin) &&
        /^\d{6,19}$/.test(bank.account_number) &&
        typeof bank.account_name === 'string' && bank.account_name.length >= 3 && bank.account_name.length <= 80;
      qr.onload=()=>{
        if(paymentStage!==currentPaymentStage)return;
        qrReady=true;placeholder.hidden=true;qr.hidden=false;
        error.textContent='';refreshButton();
      };
      qr.onerror=()=>{
        if(paymentStage!==currentPaymentStage)return;
        qrReady=false;placeholder.hidden=false;qr.hidden=true;
        placeholder.textContent='Không hiển thị được mã QR.';
        error.textContent='Vui lòng liên hệ shop trước khi chuyển khoản.';
        refreshButton();
      };
      async function loadDynamicQR(){
        try {
          if(!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647 ||
              !/^HHCK[0-9A-F]{12}$/.test(checkoutReference))
            throw new Error('Tổng tiền hoặc mã đối soát chưa hợp lệ.');
          const response=await fetch('/api/payments/config/', {
            method:'GET',credentials:'same-origin',cache:'no-store',
            headers:{'Accept':'application/json'}
          });
          const bank=await response.json();
          if(!response.ok || bank.ok !== true || !validAccount(bank))
            throw new Error(bank && bank.error || 'Shop chưa cấu hình tài khoản nhận tiền.');
          if(paymentStage!==currentPaymentStage)return;
          bankBox.replaceChildren(
            textLine('Số tài khoản',bank.account_number),
            textLine('Chủ tài khoản',bank.account_name)
          );
          // VietQR Quick Link: QR chứa sẵn tiền + mã đối soát, KHÔNG sinh mã đơn.
          const query=new URLSearchParams({amount:String(amount),
            addInfo:checkoutReference,accountName:bank.account_name});
          const imageUrl='https://img.vietqr.io/image/' +
            bank.bank_bin + '-' + bank.account_number + '-qr_only.png?' + query.toString();
          qr.src=imageUrl;
        } catch(err) {
          if(paymentStage!==currentPaymentStage)return;
          qrReady=false;
          placeholder.textContent='Chưa tạo được QR chuyển khoản.';
          error.textContent='Không tạo được QR. Vui lòng liên hệ shop trước khi chuyển khoản.';
          refreshButton();
        }
      }

      card.append(textLine('Tiền hoa',money(previewed.subtotal)),
        textLine('Phí giao bạn đã thống nhất',money(feeClaimed)),
        textLine('Tổng thanh toán',money(previewed.subtotal + feeClaimed),true),
        textLine('Nội dung chuyển khoản',checkoutReference));
      const caution=node('p','hoa-e-hint','Hãy đối chiếu tên chủ tài khoản trước khi chuyển tiền. Shop sẽ xác minh giao dịch sau khi bạn gửi đơn.');
      card.appendChild(caution);
      const confirm=node('label','hoa-e-agree');const checked=node('input');checked.type='checkbox';
      confirm.append(checked,document.createTextNode(' Tôi đã chuyển khoản đúng tổng tiền và nội dung trên.'));
      const error=node('p','hoa-e-error');error.setAttribute('role','alert');
      const send=node('button','hoa-e-primary','Tôi đã chuyển khoản — Gửi đơn hàng');send.type='button';
      const back=node('button','hoa-e-secondary','← Thay đổi phí giao');back.type='button';
      back.addEventListener('click',feeStep);
      card.append(confirm,error,send,back);
      contactArea(card);
      function refreshButton(){send.disabled=!qrReady || !checked.checked || inProgressPayment;}
      checked.addEventListener('change',refreshButton);refreshButton();
      loadDynamicQR();
      send.addEventListener('click',async()=>{
        if (!qrReady || !checked.checked || inProgressPayment) return;
        if (sheetsWebsite && !captchaToken) {
          error.textContent='Vui lòng hoàn tất bước xác minh để gửi đơn.';
          closePayment();captcha?.reset();return;
        }
        inProgressPayment=true;refreshButton();error.textContent='';
        let orderSaved=false;
        hoaShowLoading('Đang ghi nhận đơn hàng...', true);
        try {
          const fresh=await withCsrf('/api/orders/preview/',payload());
          if (!Number.isSafeInteger(fresh.subtotal) || fresh.subtotal !== previewed.subtotal ||
              JSON.stringify(fresh.items) !== JSON.stringify(previewed.items)) {
            previewed=null;closePayment();renderItems(fresh.items);
            throw new Error('Giá hoa đã thay đổi. Nếu bạn đã chuyển khoản, hãy liên hệ shop để được hỗ trợ.');
          }
          if (!submissionId) {
            if (typeof crypto === 'undefined' || !crypto.randomUUID) throw new Error('Trình duyệt không hỗ trợ mã gửi đơn an toàn.');
            submissionId=crypto.randomUUID();
          }
          const data={...payload(),submission_id:submissionId,delivery_fee_claimed:feeClaimed,
            payment_claimed:true,transfer_reference:checkoutReference,
            reported_total:fresh.subtotal+feeClaimed};
          if (sheetsWebsite) data.turnstile_token=captchaToken;
          const result=await withCsrf('/api/orders/paid-submit/',data);
          if (!result.ok || typeof result.order_code !== 'string' || !/^HH[0-9A-F]{12}$/.test(result.order_code))
            throw new Error('Chưa xác nhận được đơn hàng. Hãy tra cứu đơn hoặc liên hệ shop trước khi thử lại.');
          if (result.subtotal !== fresh.subtotal || result.delivery_fee !== feeClaimed ||
              result.total !== fresh.subtotal + feeClaimed) throw new Error('Phản hồi tổng tiền không khớp. Đã ghi nhận mã đơn ' + result.order_code + '. Vui lòng liên hệ shop.');
          orderSaved=true;
          const actualCode=result.order_code;
          submittedCode=actualCode;
          success.hidden=false;
          success.replaceChildren();
          const title=node('h3','', 'Đã gửi đơn · Chờ xác nhận');
          const code=node('p','', 'Mã đơn: '+actualCode);
          const statusText=node('p','', 'Shop sẽ kiểm tra chuyển khoản và xác nhận đơn với bạn.');
          const transfer=node('p','', 'Mã đối soát: '+checkoutReference);
          const copy=node('button','hoa-checkout-success-copy','Sao chép mã đơn');copy.type='button';copy.id='hoa-checkout-success-copy';
          const copyFeed=node('span','hoa-checkout-success-feedback');copyFeed.setAttribute('role','status');
          copy.addEventListener('click',()=>copyCode(actualCode,copyFeed));
          const track=node('a','', 'Tra cứu tình trạng đơn');track.href='order-tracking.html';
          success.append(title,code,statusText,transfer,copy,copyFeed,track);
          active=false;
          form.querySelectorAll('input, textarea, select, button').forEach(el=>{if(!success.contains(el))el.disabled=true;});
          try{localStorage.removeItem(CART_KEY);}catch(_){}
          closePayment();
          message('', false);
          try{showSuccessModal(actualCode);}catch(ex){console.error('Không mở được modal xác nhận',ex);}
        } catch(ex) {
          error.textContent=friendlyError(ex, true);
          if (!paymentStage) message(friendlyError(ex, true), true);
        } finally {
          hoaHideLoading();inProgressPayment=false;
          if(sheetsWebsite && !orderSaved && captcha){
            captcha.reset();captchaToken='';
            // Xác minh có thể đã hết hạn; khách cần xác minh lại trước khi gửi.
          }
          disableActions();refreshButton();
        }
      });
    }
    async function doSubmit() {
      if (!sheetsWebsite || !ordersEnabled || !active || busy || !previewed || !consent.checked || !validForm()) return;
      busy=true;disableActions();
      hoaShowLoading('Đang đối chiếu giỏ hoa lần cuối...');
      try {
        const fresh=await withCsrf('/api/orders/preview/',payload());
        if (!Number.isSafeInteger(fresh.subtotal) || fresh.subtotal !== previewed.subtotal ||
            JSON.stringify(fresh.items)!==JSON.stringify(previewed.items)) {
          previewed=null;renderItems(fresh.items);
          throw new Error('Giá/sản phẩm đã đổi. Vui lòng kiểm tra lại.');
        }
        // TUYET DOI KHONG gọi endpoint tạo đơn ở bước này.
        feeStep();
        message('', false);
      } catch(error) {message('Không thể tiếp tục: '+friendlyError(error),true);}
      finally{hoaHideLoading();busy=false;disableActions();}
    }
    previewButton.addEventListener('click', doPreview);
    submitButton.addEventListener('click', doSubmit);

    async function initialize() {
      message('', false);
      try {
        await Promise.resolve(window.HOA_HOE_CATALOG_READY);
        // Offline/Live Server is a browsing preview only. Render the actual saved
        // cart from the sample catalog, but never enable payment or order APIs.
        if (!localOnly && window.HOA_HOE_CATALOG_SYNC_STATE === 'demo') {
          items = readItems();
          renderItems();
          active = Boolean(items.length);
          ordersEnabled = false;
          previewButton.textContent = 'Kiểm tra thông tin';
          message(items.length
            ? 'Đang xem trước trên máy: giá chỉ để tham khảo, không thể gửi đơn hoặc thanh toán.'
            : 'Giỏ hàng trống. Vui lòng chọn hoa để tiếp tục.', !items.length);
          return;
        }
        if (!localOnly) throw new Error('Địa chỉ này chưa hỗ trợ đặt hoa.');
        if (window.HOA_HOE_CATALOG_SYNC_STATE !== 'live') throw new Error('Chưa xác minh được giá sản phẩm từ dữ liệu cửa hàng.');
        // Hiển thị giỏ ngay khi giá đã xác minh, ngay cả khi API nhận đơn còn khóa.
        items = readItems();
        renderItems();
        const r = await fetch('/api/orders/health/', {credentials:'same-origin', cache:'no-store'});
        if (!r.ok) throw new Error('API đơn hàng không hoạt động (HTTP '+r.status+').');
        const health = await r.json();
        if (!health.ok) throw new Error('API không trả được trạng thái hệ thống.');
        ordersEnabled = Boolean(health.orders_enabled &&
          (sheetsWebsite ? health.public_orders_enabled === true : health.public_orders_enabled === false));
        active = Boolean(items.length);
        previewButton.textContent = 'Kiểm tra đơn';
        if (ordersEnabled && sheetsWebsite) {
          submitButton.textContent = 'Tiếp tục · Xác nhận phí giao';
          const verifyBox = document.createElement('div');
          verifyBox.id = 'hoa-sheets-turnstile';
          verifyBox.style.cssText = 'margin:14px 0;max-width:100%';
          submitButton.before(verifyBox);
          if (!window.HOA_HOE_TURNSTILE) throw new Error('Thiếu js/hoa-hoe-turnstile.js.');
          captcha = await window.HOA_HOE_TURNSTILE.mount(
            verifyBox, health.turnstile_site_key,
            token => { captchaToken = token; disableActions(); }
          );
        }
        message(!items.length
          ? 'Giỏ hàng trống. Vui lòng chọn hoa để tiếp tục.'
          : ordersEnabled ? '' : 'Shop hiện tạm ngừng nhận đơn trực tuyến.', !items.length);
      } catch (error) {
        ordersEnabled = false;
        active = window.HOA_HOE_CATALOG_SYNC_STATE === 'live' && items.length > 0;
        previewButton.textContent = 'Kiểm tra đơn';
        message('Chưa thể kết nối để xác minh đơn. Vui lòng thử lại sau.', true);
        if (window.HOA_HOE_CATALOG_SYNC_STATE === 'live' && items.length) {
          // Giỏ đã được vẽ bằng dữ liệu giá API: giữ nguyên danh sách và tổng tiền.
        } else {
          // API lỗi: chỉ hiện tên và số lượng từ snapshot, không hiện giá nháp.
          let draft = [];
          try { const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            if (Array.isArray(stored)) draft = stored; }
          catch (_) { /* Giỏ bị lỗi định dạng */ }
          rows.replaceChildren();
          draft.slice(0, 30).forEach(entry => {
            if (!entry || typeof entry.id !== 'string' || !Number.isInteger(entry.qty) ||
                entry.qty < 1 || entry.qty > 99) return;
            const tr = document.createElement('tr');
            const name = document.createElement('td');
            const amount = document.createElement('td');
            name.textContent = (typeof entry.name === 'string' && entry.name.trim() ? entry.name : entry.id).slice(0, 150) + ' × ' + entry.qty;
            amount.textContent = 'Chưa xác minh';
            tr.append(name, amount); rows.appendChild(tr);
          });
          if (!rows.childElementCount) rows.innerHTML = '<tr><td colspan="2">Chưa có sản phẩm trong giỏ.</td></tr>';
          total.textContent = '—';
        }
      } finally {disableActions();}
    }
    initialize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
