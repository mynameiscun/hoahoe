(function () {
  'use strict';
  if (window.HOA_HOE_PAYMENT_UI) return;
  const IG_CHAT_URL = 'https://www.instagram.com/hoahoe_hoahoe?utm_source=ig_web_copy_link';
  const RATES = [
    ['Quận 1, Quận 3, Quận 5, Quận 10', '20.000đ'],
    ['Quận 4, Phú Nhuận', '30.000đ'],
    ['Quận 6, Quận 7, Quận 8, Quận 11, Bình Thạnh', '40.000đ'],
    ['Quận 2 (địa giới cũ)', '50.000đ'],
    ['Tân Bình, Bình Tân, Tân Phú, Gò Vấp', '60.000đ'],
    ['Quận 9, Quận 12, Nhà Bè, Bình Chánh, Thủ Đức (cũ)', '80.000đ'],
    ['Hóc Môn', 'Theo phí Grab; liên hệ shop'],
    ['Củ Chi, Cần Giờ và khu vực chưa nêu', 'Liên hệ shop']
  ];
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function money(n) {
    return new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND', maximumFractionDigits:0}).format(n);
  }
  function link() {
    let url = 'https://www.instagram.com/hoahoe_hoahoe?utm_source=ig_web_copy_link';
    try {
      if (IG_CHAT_URL) {
        const proposed = new URL(IG_CHAT_URL);
        if (proposed.protocol === 'https:' && ['ig.me','www.instagram.com','instagram.com'].includes(proposed.hostname)) url = proposed.href;
      }
    } catch (_) { /* Chưa được cấu hình. */ }
    if (!url) {
      const btn = el('button', 'hoa-ship-contact hoa-ship-contact--missing', 'Nhắn Instagram trao đổi phí giao');
      btn.type = 'button'; btn.disabled = false;
      btn.title = 'Shop sẽ bổ sung liên kết nhắn tin Instagram';
      return btn;
    }
    const a = el('a', 'hoa-ship-contact', 'Nhắn Instagram trao đổi phí giao');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  function guide(options) {
    const opts = options || {};
    const section = el('section','hoa-ship-guide');
    section.setAttribute('aria-label','Tham khảo phí giao hoa');
    section.appendChild(el('h3', '', opts.title || 'Phí giao hoa tham khảo'));
    section.appendChild(el('p','hoa-ship-warning',
      'Giá hoa chưa bao gồm phí giao. Bảng dưới chỉ để tham khảo; phí thực tế cần được shop xác nhận theo địa chỉ trước khi thanh toán.'));
    const details = el('details','hoa-ship-rates');
    if (opts.open) details.open = true;
    details.appendChild(el('summary','','Xem bảng phí giao theo quận/huyện cũ'));
    const table = el('table','hoa-ship-table');
    const thead=el('thead');const tr=el('tr');tr.append(el('th','','Khu vực'),el('th','','Phí tham khảo'));thead.append(tr);table.append(thead);
    const tbody=el('tbody');
    RATES.forEach(function(pair) {const row=el('tr');row.append(el('td','',pair[0]),el('td','',pair[1]));tbody.append(row);});
    table.append(tbody);
    details.appendChild(table);
    details.appendChild(el('p','hoa-ship-note','Tên quận/huyện được ghi theo địa giới cũ. Với một số khu vực và địa chỉ đặc biệt, cửa hàng sẽ báo phí giao riêng.'));
    section.append(details, link());
    return section;
  }
  let busy=null, previousFocus=null, previousOverflow='';
  function makeBusy() {
    const modal=el('div','hoa-pay-loading');modal.id='hoa-pay-loading';modal.hidden=true;
    modal.tabIndex=-1;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const panel=el('div','hoa-pay-loading__panel');
    const petals=el('div','hoa-pay-loading__flower');petals.setAttribute('aria-hidden','true');
    for(let i=0;i<8;i++){const petal=el('i','hoa-pay-loading__petal');petal.style.setProperty('--i',i);petals.append(petal);}
    petals.appendChild(el('i','hoa-pay-loading__center'));
    const text=el('p','hoa-pay-loading__text','Đang tải...');text.id='hoa-pay-loading-title';
    modal.setAttribute('aria-labelledby',text.id);
    panel.append(petals,text,el('small','','Vui lòng đợi trong giây lát.'));modal.appendChild(panel);
    document.body.appendChild(modal);
    document.addEventListener('keydown',function(evt){
      if (!modal.hidden && ['Tab','Escape','Enter',' '].includes(evt.key)) {
        evt.preventDefault();evt.stopImmediatePropagation();
      }
    },true);
    return {modal,text};
  }
  function showBusy(text) {
    if (!busy) busy=makeBusy();
    if (busy.modal.hidden) {
      previousFocus=document.activeElement;
      previousOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';document.body.setAttribute('aria-busy','true');
    }
    busy.modal.hidden=false;busy.text.textContent=text || 'Đang xử lý...';
    busy.modal.focus({preventScroll:true});
  }
  function hideBusy() {
    if (!busy || busy.modal.hidden) return;
    busy.modal.hidden=true;document.body.style.overflow=previousOverflow;
    document.body.removeAttribute('aria-busy');
    if (previousFocus && previousFocus.isConnected && !previousFocus.disabled) previousFocus.focus({preventScroll:true});
    previousFocus=null;
  }
  const style = document.createElement('link');
  style.rel='stylesheet';style.href='css/hoa-hoe-shipping-payment.css';
  document.head.appendChild(style);
  window.HOA_HOE_PAYMENT_UI={guide,link,money,showBusy,hideBusy};
})();
