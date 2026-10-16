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
    const resultPanel = document.getElementById('hoa-track-result');
    const submit = form.querySelector('button[type="submit"]');
    const djangoLocal = location.port === '8000' && ['127.0.0.1', 'localhost'].includes(location.hostname);
    const sheetsWebsite = location.protocol === 'https:' && !location.hostname.endsWith('.github.io');
    const local = djangoLocal || sheetsWebsite;
    let captcha = null, captchaToken = '';
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

    function render(order) {
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
      text.textContent = 'Chưa chuyển khoản nếu shop chưa xác nhận và gửi hướng dẫn trực tiếp. Thông tin liên hệ, địa chỉ và người nhận không hiển thị tại đây.';
      resultPanel.append(heading, details, text);
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
      try {
        const data = await fetchLookup({order_code: code, buyer_phone: phone});
        render(data);
        showMessage('Đã xác minh đơn hàng thành công.', false);
      } catch (error) {
        showMessage(error.message || 'Không thể tra cứu lúc này.', true);
      } finally {
        if (sheetsWebsite && captcha) captcha.reset();
        submit.disabled = sheetsWebsite ? !captchaToken : false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
