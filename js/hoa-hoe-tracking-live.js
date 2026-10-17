/* Hoa Hoè Step 09.6 — Tra cứu đơn đã xác minh, CHỈ local Django DEBUG.
 * Không lưu mã đơn / số điện thoại trong localStorage hay URL.
 */
(function () {
  'use strict';

  function start() {
    const form = document.getElementById('flower-order-lookup');
    if (!form) return;

    const codeInput = document.getElementById('order-code');
    const phoneInput = document.getElementById('buyer-phone');
    const notice = document.getElementById('flower-lookup-notice');
    let resultPanel = document.getElementById('hoa-track-result');
    if (!resultPanel) {
      resultPanel = document.createElement('section');
      resultPanel.id = 'hoa-track-result';
      resultPanel.hidden = true;
      resultPanel.tabIndex = -1;
      const noticeHolder = document.getElementById('flower-lookup-notice');
      if (noticeHolder) noticeHolder.insertAdjacentElement('afterend', resultPanel);
      else form.insertAdjacentElement('afterend', resultPanel);
    }
    const submit = form.querySelector('button[type="submit"]');
    const djangoLocal = location.port === '8000' && ['127.0.0.1', 'localhost'].includes(location.hostname);
    const sheetsWebsite = location.protocol === 'https:' && !location.hostname.endsWith('.github.io');
    const local = djangoLocal || sheetsWebsite;
    let captcha = null, captchaToken = '';
    // Dùng chung bảng phí giao + loading với trang sản phẩm. Chỉ tải từ nguồn cùng website.
    let uiReady = null;
    function loadPaymentUI() {
      if (window.HOA_HOE_PAYMENT_UI) return Promise.resolve(window.HOA_HOE_PAYMENT_UI);
      if (uiReady) return uiReady;
      uiReady = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/hoa-hoe-shipping-ui.js';
        script.onload = () => window.HOA_HOE_PAYMENT_UI ? resolve(window.HOA_HOE_PAYMENT_UI) : reject(new Error('Thiếu tiện ích phí giao.'));
        script.onerror = () => reject(new Error('Không tải được giao diện phí giao.'));
        document.head.appendChild(script);
      });
      return uiReady;
    }

    const formatMoney = value => new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(value);

    function showMessage(message, error) {
      notice.hidden = false;
      notice.textContent = message;
      notice.classList.toggle('flower-notice--neutral', !error);
      notice.classList.toggle('flower-notice--error', !!error);
      notice.setAttribute('role', error ? 'alert' : 'status');
    }

    function hidePreviousResult() {
      resultPanel.hidden = true;
      resultPanel.replaceChildren();
    }

    function row(label, value) {
      const wrap = document.createElement('div');
      wrap.className = 'hoa-track-row';
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      wrap.append(dt, dd);
      return wrap;
    }

    function makeRow(label,value) {
      const wrap=document.createElement('div'); wrap.className='hoa-pay-row';
      const left=document.createElement('span');left.textContent=label;
      const right=document.createElement('strong');right.textContent=value;
      wrap.append(left,right);return wrap;
    }

    // QR của chính shop: người quản trị chỉ cần chép ảnh vào đúng thư mục public.
    // Đây là ảnh QR tĩnh; tiền và nội dung chuyển khoản được hiển thị RIÊNG
    // để khách nhập đúng tổng tiền đã thương lượng và mã đơn.
    const SHOP_QR_IMAGE = 'img/payment/hoa-hoe-qr.png';

    function renderShopPaymentQR(order, info, ui) {
      const frame = document.createElement('div');
      frame.className = 'hoa-pay-shop';

      const brand = document.createElement('p');
      brand.className = 'hoa-pay-shop__brand';
      brand.textContent = '✿  HOA HOÈ FLOWER SHOP  ✿';
      const heading = document.createElement('h4');
      heading.className = 'hoa-pay-shop__title';
      heading.textContent = 'Thanh toán chuyển khoản';
      const subtitle = document.createElement('p');
      subtitle.className = 'hoa-pay-shop__subtitle';
      subtitle.textContent = 'Một chút yêu thương, gửi qua một lần chuyển khoản.';
      frame.append(brand, heading, subtitle);

      const qrBox = document.createElement('div');
      qrBox.className = 'hoa-pay-shop__qr-frame';
      qrBox.setAttribute('aria-label', 'Vị trí mã QR của Hoa Hoè');
      const qrPlaceholder = document.createElement('div');
      qrPlaceholder.className = 'hoa-pay-shop__placeholder';
      qrPlaceholder.setAttribute('role', 'status');
      const flower = document.createElement('span');
      flower.className = 'hoa-pay-shop__placeholder-icon';
      flower.setAttribute('aria-hidden', 'true');
      flower.textContent = '✿';
      const placeholderText = document.createElement('strong');
      placeholderText.textContent = 'Mã QR của Hoa Hoè';
      const placeholderHint = document.createElement('small');
      placeholderHint.textContent = 'Shop đang cập nhật ảnh QR. Bạn có thể dùng thông tin chuyển khoản bên dưới.';
      qrPlaceholder.append(flower, placeholderText, placeholderHint);
      const image = document.createElement('img');
      image.className = 'hoa-pay-shop__qr-img';
      image.alt = 'Ảnh mã QR tài khoản nhận chuyển khoản của Hoa Hoè';
      image.loading = 'eager';
      image.decoding = 'async';
      image.hidden = true;
      // Không sử dụng QR ngân hàng giả, ảnh VietQR tạo tự động hoặc thông tin mẫu.
      image.addEventListener('load', () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          image.hidden = false;
          qrPlaceholder.hidden = true;
        }
      });
      image.addEventListener('error', () => {
        image.hidden = true;
        qrPlaceholder.hidden = false;
      });
      qrBox.append(qrPlaceholder, image);
      image.src = SHOP_QR_IMAGE;
      frame.appendChild(qrBox);

      const caption = document.createElement('p');
      caption.className = 'hoa-pay-shop__caption';
      caption.textContent = 'Hãy kiểm tra tên người nhận, số tiền và nội dung chuyển khoản trước khi xác nhận trên ứng dụng ngân hàng.';
      frame.appendChild(caption);

      const summary = document.createElement('div');
      summary.className = 'hoa-pay-shop__summary';
      summary.append(
        makeRow('Tiền hoa', ui.money(order.subtotal)),
        makeRow('Phí ship đã xác nhận', ui.money(order.delivery_fee))
      );
      const total = makeRow('Tổng thanh toán', ui.money(order.total));
      total.classList.add('hoa-pay-shop__sum');
      summary.appendChild(total);
      frame.appendChild(summary);

      const bank = document.createElement('div');
      bank.className = 'hoa-pay-shop__bank';
      const bankTitle = document.createElement('h5');
      bankTitle.textContent = 'Thông tin chuyển khoản';
      bank.appendChild(bankTitle);
      [
        ['Mã ngân hàng (BIN)', info.bank_bin],
        ['Chủ tài khoản', info.account_name],
        ['Số tài khoản', info.account_number],
        ['Số tiền cần chuyển', ui.money(info.amount)],
        ['Nội dung chuyển khoản', info.transfer_content]
      ].forEach(([key, val]) => bank.appendChild(makeRow(key, val)));
      frame.appendChild(bank);

      const warning = document.createElement('p');
      warning.className = 'hoa-pay-shop__note';
      warning.textContent = 'Lưu ý: QR ảnh của shop có thể không tự điền số tiền hoặc mã đơn. Hãy nhập đúng tổng tiền và mã đơn phía trên. Chỉ Admin được xác nhận đã nhận tiền sau khi đối soát ngân hàng.';
      frame.appendChild(warning);
      return frame;
    }

    function renderPayment(order, ui) {
      const container=document.createElement('div');
      container.className='hoa-pay-flow';
      container.appendChild(ui.guide({open:false,title:'Phí giao hoa tham khảo'}));
      const panel=document.createElement('section');panel.className='hoa-pay-card';
      panel.setAttribute('aria-label','Xác nhận phí giao và thanh toán');
      const title=document.createElement('h3');title.textContent='Xác nhận phí giao và thanh toán';panel.appendChild(title);
      const instructions=document.createElement('p');instructions.className='hoa-pay-muted';
      if(order.payment_status === 'paid') {
        instructions.textContent='Shop đã ghi nhận thanh toán. Nếu cần đối chiếu, vui lòng liên hệ trực tiếp với shop.';
        panel.appendChild(instructions);container.appendChild(panel);return container;
      }
      // Step 12.5E payment_reported â€” Khach da BAO chuyen khoan; khong mo QR lan hai.
      if (order.payment_reported === true) {
        instructions.textContent = 'Ban da bao chuyen khoan cho don nay. Hoa Hoe dang cho Admin doi soat so tien thuc nhan va phi giao da thong nhat. KHONG chuyen khoan lan nua.';
        panel.appendChild(instructions);
        panel.append(makeRow('Tien hoa', ui.money(order.subtotal)));
        if (Number.isSafeInteger(order.delivery_fee))
          panel.append(makeRow('Phi giao khach da khai', ui.money(order.delivery_fee)));
        if (Number.isSafeInteger(order.total))
          panel.append(makeRow('Tong da bao chuyen', ui.money(order.total)));
        container.appendChild(panel);
        return container;
      }
      const allowed = order.status === 'confirmed' && order.payment_status === 'awaiting_transfer' &&
        order.fee_pending === false && Number.isSafeInteger(order.delivery_fee) && order.delivery_fee >= 0 &&
        Number.isSafeInteger(order.subtotal) && order.subtotal > 0 &&
        Number.isSafeInteger(order.total) && order.total === order.subtotal+order.delivery_fee;
      if (!allowed) {
        instructions.textContent = 'Đơn đang chờ shop xác nhận tổng tiền (gồm tiền hoa và phí giao đã thương lượng). Chưa chuyển khoản lúc này. Hãy liên hệ shop qua Instagram và tra cứu lại sau khi được báo xác nhận.';
        panel.appendChild(instructions);container.appendChild(panel);return container;
      }
      panel.append(makeRow('Tiền hoa',ui.money(order.subtotal)));
      panel.append(makeRow('Phí giao đã được Admin chốt',ui.money(order.delivery_fee)));
      const sum=makeRow('Tổng chuyển khoản một lần',ui.money(order.total));sum.classList.add('hoa-pay-total');panel.appendChild(sum);
      instructions.textContent='Chỉ tiếp tục khi bạn đã thống nhất phí giao với shop. Giá ở bảng tham khảo không thay thế số tiền Admin đã chốt.';
      panel.appendChild(instructions);
      const consent=document.createElement('label');consent.className='hoa-pay-check';
      const checkbox=document.createElement('input');checkbox.type='checkbox';
      const label=document.createElement('span');label.textContent='Tôi đã trao đổi với shop và đồng ý phí giao ' + ui.money(order.delivery_fee) + ' cùng tổng thanh toán ' + ui.money(order.total) + '.';
      consent.append(checkbox,label);panel.appendChild(consent);
      const reveal=document.createElement('button');reveal.type='button';reveal.className='hoa-pay-primary';
      reveal.textContent='Tôi đã xác nhận phí giao — Xem hướng dẫn chuyển khoản';reveal.disabled=true;panel.appendChild(reveal);
      const message=document.createElement('p');message.className='hoa-pay-muted';message.setAttribute('role','status');panel.appendChild(message);
      const info=order.payment_instructions;
      const valid = info && typeof info.bank_bin==='string' && /^\d{6}$/.test(info.bank_bin) &&
        typeof info.account_number==='string' && /^\d{6,19}$/.test(info.account_number) &&
        typeof info.account_name==='string' && info.account_name.trim().length>=3 &&
        Number.isSafeInteger(info.amount) && info.amount===order.total &&
        info.transfer_content===order.order_code;
      if (!valid) {
        message.textContent='Shop chưa cấu hình QR ngân hàng trong Cloudflare hoặc thông tin thanh toán chưa hợp lệ. Chưa chuyển khoản; vui lòng liên hệ shop.';
      }
      checkbox.disabled=!valid;
      checkbox.addEventListener('change',()=>{reveal.disabled = !checkbox.checked || !valid;});
      const qrWrap=document.createElement('section');qrWrap.className='hoa-pay-qr';qrWrap.hidden=true;
      qrWrap.setAttribute('aria-label','Mã QR chuyển khoản đơn hàng');
      reveal.addEventListener('click',()=>{
        if(!checkbox.checked || !valid || !qrWrap.hidden) return;
        qrWrap.appendChild(renderShopPaymentQR(order, info, ui));
        qrWrap.hidden=false;reveal.disabled=true;reveal.textContent='Đã mở hướng dẫn thanh toán';
        qrWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
      });
      panel.appendChild(qrWrap);container.appendChild(panel);return container;
    }

    function render(order, ui) {
      hidePreviousResult();
      const heading = document.createElement('h3');
      heading.textContent = 'Kết quả tra cứu';
      const details = document.createElement('dl');
      details.className = 'hoa-track-details';
      const ymd = String(order.delivery_date || '');
      const dateText = /^\d{4}-\d{2}-\d{2}$/.test(ymd)
        ? ymd.substring(8, 10) + '/' + ymd.substring(5, 7) + '/' + ymd.substring(0, 4)
        : 'Chưa xác định';
      const feeText = order.fee_pending || order.delivery_fee === null
        ? 'Chờ shop xác nhận'
        : formatMoney(order.delivery_fee);
      const totalText = order.total === null ? 'Chờ xác nhận phí giao' : formatMoney(order.total);
      [
        ['Mã đơn', order.order_code],
        ['Trạng thái đơn', order.status_label],
        ['Trạng thái thanh toán', order.payment_label],
        ['Ngày giao dự kiến', dateText],
        ['Khung giờ giao', order.delivery_slot],
        ['Tiền hoa', formatMoney(order.subtotal)],
        ['Phí giao', feeText],
        ['Tổng tiền', totalText]
      ].forEach(([label, value]) => details.appendChild(row(label, value)));
      const text = document.createElement('p');
      text.className = 'hoa-track-advice';
      text.textContent = 'Giá hoa chưa bao gồm phí giao. Bạn chỉ thanh toán một lần sau khi shop xác nhận phí giao và bạn đồng ý tổng tiền. Thông tin người nhận không hiển thị ở đây.';
      resultPanel.append(heading, details, text, renderPayment(order, ui));
      resultPanel.hidden = false;
      resultPanel.focus();
    }

    function getCsrfCookie() {
      const match = document.cookie.split(';').map(item => item.trim())
        .find(item => item.startsWith('csrftoken='));
      return match ? decodeURIComponent(match.slice('csrftoken='.length)) : '';
    }

    async function fetchLookup(data) {
      if (sheetsWebsite) {
        const response = await fetch('/api/orders/lookup/', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: {'Content-Type':'application/json', 'Accept':'application/json'},
          body: JSON.stringify({...data, turnstile_token: captchaToken})
        });
        let body;
        try { body = await response.json(); } catch (_) { throw new Error('API tra cứu trả dữ liệu không hợp lệ.'); }
        if (!response.ok || !body.ok) throw new Error(body.error || 'Không tra cứu được đơn.');
        return body;
      }
      const csrf = await fetch('/api/orders/csrf/', {credentials: 'same-origin', cache: 'no-store'});
      if (!csrf.ok) throw new Error('Không thể xác minh phiên làm việc với Django.');
      const token = getCsrfCookie();
      if (!token) throw new Error('Không đọc được CSRF cookie. Hãy bật cookie trên trình duyệt.');

      const response = await fetch('/api/orders/lookup/', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRFToken': token
        },
        body: JSON.stringify(data)
      });
      let body;
      try { body = await response.json(); }
      catch (_) { throw new Error('Máy chủ trả về dữ liệu không hợp lệ.'); }
      if (!response.ok || !body.ok) {
        const reason = typeof body.error === 'string' ? body.error : 'Không tra cứu được đơn hàng.';
        throw new Error(reason);
      }
      return body;
    }

    loadPaymentUI().catch(err => console.warn('Hoa Hoè shipping UI:', err));

    if (!local) {
      submit.disabled = true;
      showMessage('Cổng 5000 chỉ để xem giao diện. Tra cứu đơn thử nghiệm trên http://127.0.0.1:8000/order-tracking.html.', true);
      return;
    }

    if (sheetsWebsite) {
      submit.disabled = true;
      showMessage('Đang kết nối tra cứu qua Google Sheets...', false);
      fetch('/api/orders/health/', {cache:'no-store'})
        .then(res => res.json())
        .then(async health => {
          if (!health.ok || !health.orders_enabled || !health.public_orders_enabled) throw new Error('Tra cứu chưa được bật.');
          if (!window.HOA_HOE_TURNSTILE) throw new Error('Thiếu file xác minh Turnstile.');
          const verifyBox = document.createElement('div');
          verifyBox.style.cssText = 'margin:15px 0;max-width:100%';
          submit.before(verifyBox);
          captcha = await window.HOA_HOE_TURNSTILE.mount(verifyBox, health.turnstile_site_key, token => {
            captchaToken = token;
            submit.disabled = !captchaToken;
          });
          showMessage('Nhập mã đơn và số điện thoại người đặt để tra cứu. Vui lòng hoàn thành xác minh.', false);
        }).catch(e => { submit.disabled = true; showMessage(e.message || 'Chưa sẵn sàng tra cứu.', true); });
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      hidePreviousResult();
      if (!form.reportValidity() || submit.disabled) return;
      const code = codeInput.value.trim().toUpperCase();
      const phone = phoneInput.value.trim();
      if (!/^HH[0-9A-F]{12}$/.test(code)) {
        showMessage('Mã đơn phải bắt đầu bằng HH và tiếp theo là 12 ký tự số hoặc chữ A–F.', true);
        return;
      }
      submit.disabled = true;
      showMessage('Đang xác minh thông tin đơn hàng...', false);
      let ui = null;
      try {
        ui = await loadPaymentUI();
        ui.showBusy('Đang tra cứu đơn hàng...');
        const data = await fetchLookup({order_code: code, buyer_phone: phone});
        render(data, ui);
        showMessage('Đã xác minh đơn hàng thành công.', false);
      } catch (error) {
        showMessage(error.message || 'Không thể tra cứu lúc này.', true);
      } finally {
        if (ui) ui.hideBusy();
        if (sheetsWebsite && captcha) captcha.reset();
        submit.disabled = sheetsWebsite ? !captchaToken : false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
