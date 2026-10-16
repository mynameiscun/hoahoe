/* Hoa Hoè Step 09.5 — Checkout ket noi Django, CHI TEST LOCAL.
 * API submit Step09.2 chi nhan 127.0.0.1 DEBUG, CSRF + cookie. Khong co thanh toan.
 * Luu YEU CAU thu nghiem vao MySQL; khong cong khai khi deploy.
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
    const banner = byId('hoa-checkout-mode');
    const rows = byId('hoa-checkout-items');
    const total = byId('hoa-checkout-subtotal');
    const modal = byId('hoa-order-success-modal');
    const modalPanel = modal.querySelector('.hoa-order-modal__panel');
    const modalCode = byId('hoa-order-modal-code');
    const modalCopyStatus = byId('hoa-order-modal-copy-status');
    const modalShopButton = byId('hoa-order-modal-shop');
    const pageWrapper = document.querySelector('.body-wrapper');
    let submittedCode = '';
    let countdownTimer = null;
    let countdownSeconds = 0;

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

    function displayCountdown() {
      modalShopButton.disabled = countdownSeconds > 0;
      modalShopButton.textContent = countdownSeconds > 0
        ? 'Xem thêm hoa xinh (' + countdownSeconds + 's)'
        : 'Xem thêm hoa xinh';
    }

    function showSuccessModal(code) {
      submittedCode = code;
      modalCode.textContent = code;
      modalCopyStatus.textContent = '';
      if (countdownTimer !== null) clearInterval(countdownTimer);
      countdownSeconds = 5;
      displayCountdown();
      modal.hidden = false;
      document.body.classList.add('hoa-order-modal-open');
      if (pageWrapper) pageWrapper.setAttribute('inert', '');
      byId('hoa-order-modal-copy').focus();
      countdownTimer = setInterval(() => {
        countdownSeconds = Math.max(0, countdownSeconds - 1);
        displayCountdown();
        if (countdownSeconds === 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
      }, 1000);
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
      if (message) messageArea.textContent = message;
    }
    const messageArea = document.createElement('small');
    messageArea.id = 'hoa-ward-source-note';
    messageArea.setAttribute('role', 'status');
    wardSelect.insertAdjacentElement('afterend', messageArea);
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
          messageArea.textContent = 'Đang dùng danh sách quận/huyện dự phòng; cần xác minh khi gửi.';
        }
      }
      districtSelect.replaceChildren();
      option(districtSelect, '', 'Chọn quận / huyện cũ');
      data.forEach(d => option(districtSelect, String(d.code), d.name));
    }
    async function loadWards() {
      const requestNo = ++wardRequestCounter;
      wardSelect.replaceChildren();
      wardSelect.disabled = true;
      showManualWard(false);
      messageArea.textContent = '';
      if (!districtSelect.value) {
        option(wardSelect, '', 'Chọn quận / huyện trước');
        return;
      }
      if (!djangoLocal) {
        useManualWard(sheetsWebsite
          ? 'Nhập tên phường/xã. Shop sẽ kiểm tra địa chỉ trên Google Sheets trước khi xác nhận.'
          : 'Bản xem giao diện — không gửi đơn thật tại đây.');
        return;
      }
      option(wardSelect, '', 'Đang tải phường / xã...');
      try {
        const res = await fetch('/api/orders/areas/?district=' + encodeURIComponent(districtSelect.value), {
          cache:'no-store', credentials:'same-origin'
        });
        if (!res.ok) throw new Error('Không tải được danh sách.');
        const body = await res.json();
        if (requestNo !== wardRequestCounter) return;
        if (body.ok !== true || !Array.isArray(body.wards) || !body.wards.length)
          throw new Error('Danh sách hiện chưa sẵn sàng.');
        wardSelect.replaceChildren();
        option(wardSelect, '', 'Chọn phường / xã cũ');
        body.wards.forEach(w => option(wardSelect, String(w.code), w.name));
        option(wardSelect, 'manual', 'Không thấy địa danh? Nhập tay để shop kiểm tra');
        wardSelect.disabled = false;
        messageArea.textContent = 'Địa danh lịch sử theo quận/huyện cũ; shop vẫn kiểm tra địa chỉ trước khi xác nhận.';
      } catch (_) {
        if (requestNo === wardRequestCounter)
          useManualWard('Danh mục phường/xã tạm thời không truy cập được. Bạn có thể nhập tay để Admin kiểm tra.');
      }
    }
    districtSelect.addEventListener('change', loadWards);
    wardSelect.addEventListener('change', () => showManualWard(wardSelect.value === 'manual'));
    loadDistricts();

    const catalog = window.FIAMA_DEMO_PRODUCTS || {};
    let active = false, busy = false, items = [], previewed = null, submissionId = null;

    function message(text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', Boolean(isError));
    }
    function disableActions() {
      previewButton.disabled = !active || busy || items.length === 0;
      submitButton.disabled = !active || busy || !previewed || !consent.checked || (sheetsWebsite && !captchaToken);
    }
    function invalidate(event) {
      if (event && event.target === consent) return;
      if (success.hidden === false || busy) return;
      previewed = null;
      submissionId = null;
      disableActions();
      message('Đã thay đổi thông tin. Hãy kiểm tra yêu cầu lại trước khi gửi.', false);
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
      const lines = Array.isArray(serverItems) ? serverItems.map(p => ({name:p.name, qty:p.quantity, line:p.line_total})) :
        items.map(p => ({name:p.product.name, qty:p.quantity, line:p.product.price * p.quantity}));
      lines.forEach(line => {
        subtotal += line.line;
        const tr = document.createElement('tr'), name = document.createElement('td'), price = document.createElement('td');
        name.textContent = line.name + ' × ' + line.qty;
        price.textContent = money(line.line);
        tr.append(name,price);
        rows.appendChild(tr);
      });
      total.textContent = money(subtotal);
    }
    function payload() {
      const out = Object.fromEntries(new FormData(form).entries());
      // Backend tự chuẩn hóa địa chỉ từ mã khu vực; không tin chuỗi ghép ở client.
      // Không đưa giá/tên hoa lên làm nguồn tính tiền.
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
      busy = true;
      previewed = null;
      disableActions();
      message('Đang kiểm tra lịch giao, sản phẩm và giá từ cửa hàng...', false);
      try {
        const result = await withCsrf('/api/orders/preview/', payload());
        if (!Number.isSafeInteger(result.subtotal) || !Array.isArray(result.items))
          throw new Error('API xem trước trả dữ liệu không đầy đủ.');
        previewed = result;
        renderItems(result.items);
        const areaResult = result.delivery_area;
        const pendingWardReview = areaResult && areaResult.ward_reference_checked === false;
        message('Yêu cầu hợp lệ. Tiền hoa ' + money(result.subtotal) + '. Phí giao được Admin xác nhận sau.' + (pendingWardReview ? ' Phường/xã nhập tay cần được shop đối chiếu.' : '') + ' Chưa thanh toán.', false);
      } catch (error) {
        message('Không thể kiểm tra: ' + error.message, true);
      } finally {busy = false; disableActions();}
    }
    async function doSubmit() {
      if (!active || busy || !previewed || !consent.checked || !validForm()) return;
      busy = true;
      disableActions();
      message('Đang kiểm tra giá lần cuối...', false);
      let orderSaved = false;
      try {
        // Bắt buộc preview lại ngay trước khi gửi để phát hiện giá đổi giữa 2 thao tác.
        const fresh = await withCsrf('/api/orders/preview/', payload());
        if (fresh.subtotal !== previewed.subtotal || JSON.stringify(fresh.items) !== JSON.stringify(previewed.items)) {
          previewed = null;
          renderItems(fresh.items);
          throw new Error('Giá hoặc sản phẩm đã thay đổi. Hãy kiểm tra yêu cầu và xác nhận lại.');
        }
        if (!submissionId) {
          if (!window.crypto || !window.crypto.randomUUID) throw new Error('Trình duyệt không hỗ trợ tạo mã gửi bảo mật.');
          submissionId = window.crypto.randomUUID();
        }
        const body = {...payload(), submission_id:submissionId};
        if (sheetsWebsite) body.turnstile_token = captchaToken;
        const result = await withCsrf('/api/orders/submit/', body);
        if (!result.ok || typeof result.order_code !== 'string' || !result.order_code.trim())
          throw new Error('Phản hồi tạo yêu cầu không hợp lệ.');

        // Lưu mã ở Checkout để khách vẫn lấy lại được sau khi đóng modal.
        const actualCode = result.order_code.trim();
        submittedCode = actualCode;
        orderSaved = true;
        success.hidden = false;
        success.replaceChildren();
        const title = document.createElement('h3');
        title.textContent = sheetsWebsite ? 'Hoa Hoè đã ghi nhận yêu cầu đặt hoa' : 'Hoa Hoè đã tiếp nhận yêu cầu THỬ NGHIỆM';
        const code = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = actualCode;
        code.append('Mã đơn hàng: ', strong);
        const reminder = document.createElement('p');
        reminder.textContent = 'Hãy lưu mã đơn cùng số điện thoại người đặt để tra cứu sau này.';
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.id = 'hoa-checkout-success-copy';
        copyButton.className = 'hoa-checkout-success-copy';
        copyButton.textContent = 'Sao chép mã đơn';
        const copyFeedback = document.createElement('span');
        copyFeedback.className = 'hoa-checkout-success-feedback';
        copyFeedback.setAttribute('role', 'status');
        copyButton.addEventListener('click', () => copyCode(actualCode, copyFeedback));
        const cost = document.createElement('p');
        cost.textContent = 'Tiền hoa: ' + money(result.subtotal) + '. Phí giao: chờ Admin xác nhận.';
        const note = document.createElement('p');
        note.textContent = sheetsWebsite
          ? 'Trạng thái: Chờ xác nhận. Shop sẽ liên hệ để xác nhận khu vực, phí giao và hướng dẫn thanh toán.'
          : 'Trạng thái: Chờ xác nhận. Đơn đang chạy thử trên máy local, không giao hoa và không chuyển khoản.';
        const tracking = document.createElement('a');
        tracking.href = 'order-tracking.html';
        tracking.textContent = 'Tra cứu đơn hàng';
        success.append(title, code, reminder, copyButton, copyFeedback, cost, note, tracking);
        // Sau khi lưu thành công, khóa hẳn luồng gửi để không thể bấm tạo lại.
        active = false;
        // Chỉ khóa biểu mẫu cũ; giữ nút sao chép trong thông báo hoạt động.
        form.querySelectorAll('input, textarea, select, button').forEach(el => {
          if (!success.contains(el)) el.disabled = true;
        });
        try { localStorage.removeItem(CART_KEY); } catch (_) { /* Giữ mã hiển thị ngay cả nếu localStorage bị chặn. */ }
        message(sheetsWebsite
          ? 'Đã ghi nhận yêu cầu vào Google Sheets. Hãy lưu mã đơn để tra cứu.'
          : 'Yêu cầu đã lưu vào MySQL. Hãy lưu mã đơn để tra cứu sau này.', false);
        success.focus();
        // Sau khi lưu DB thành công, lỗi hiển thị modal không được báo nhầm là lỗi đặt đơn.
        try { showSuccessModal(actualCode); } catch (modalError) { console.error('Không mở được modal xác nhận:', modalError); }

      } catch (error) {
        message('Chưa thể gửi yêu cầu: ' + error.message, true);
      } finally {
        busy = false;
        if (sheetsWebsite && !orderSaved && captcha) captcha.reset();
        disableActions();
      }
    }
    previewButton.addEventListener('click', doPreview);
    submitButton.addEventListener('click', doSubmit);

    async function initialize() {
      if (!localOnly) {
        banner.textContent = 'Cổng 5000 chỉ để xem giao diện; muốn thử tạo yêu cầu, mở trang này trên cổng Django 8000.';
        message('Chức năng gửi yêu cầu không bật tại địa chỉ này.', true);
        rows.innerHTML = '<tr><td colspan="2">Chế độ giao diện thử, không lấy giá thực từ MySQL.</td></tr>';
        return;
      }
      try {
        await Promise.resolve(window.HOA_HOE_CATALOG_READY);
        if (window.HOA_HOE_CATALOG_SYNC_STATE !== 'live') throw new Error('Chưa xác minh được giá sản phẩm từ dữ liệu cửa hàng.');
        const r = await fetch('/api/orders/health/', {credentials:'same-origin', cache:'no-store'});
        if (!r.ok) throw new Error('API đơn hàng không hoạt động (HTTP '+r.status+').');
        const health = await r.json();
        if (!health.ok || !health.orders_enabled ||
          (sheetsWebsite ? health.public_orders_enabled !== true : health.public_orders_enabled !== false))
          throw new Error('API chưa cho phép nhận yêu cầu ở chế độ hiện tại.');
        items = readItems();
        renderItems();
        active = Boolean(items.length);
        banner.textContent = sheetsWebsite
          ? 'GỬI YÊU CẦU ĐẶT HOA — Shop xác nhận thủ công trước khi thanh toán/giao hàng. Dữ liệu được lưu trong Google Sheets riêng tư.'
          : 'CHẠY THỬ TRÊN MÁY LOCAL — Gửi yêu cầu sẽ tạo bản ghi trong MySQL; chưa nhận đơn công khai.';
        if (sheetsWebsite) {
          const label = document.querySelector('label.hoa-checkout-consent');
          if (label) {
            // Preserve checkbox and replace text only, no innerHTML from untrusted data.
            const box = consent;
            label.replaceChildren(box, document.createTextNode(' Tôi đồng ý cung cấp thông tin để shop xác nhận, xử lý và giao đơn hoa theo '));
            const link = document.createElement('a');
            link.href = 'policy.html'; link.textContent = 'chính sách cửa hàng';
            label.appendChild(link);
          }
          submitButton.textContent = 'Gửi yêu cầu đặt hoa';
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
        message(items.length
          ? (sheetsWebsite ? 'Điền thông tin rồi chọn “Kiểm tra yêu cầu”. Chưa thanh toán trước khi shop xác nhận.' : 'Điền thông tin rồi chọn “Kiểm tra yêu cầu”. Dùng dữ liệu thử nghiệm, không dùng thông tin khách thật.')
          : 'Giỏ hàng trống. Vui lòng quay về trang Shop chọn hoa.', !items.length);
      } catch (error) {
        banner.textContent = 'Tạm khóa yêu cầu: Chưa xác minh được API dữ liệu cửa hàng.';
        message(error.message, true);
        rows.innerHTML = '<tr><td colspan="2">Không thể xác minh giỏ hàng; không dùng giá mẫu.</td></tr>';
        total.textContent = '—';
      } finally {disableActions();}
    }
    initialize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
