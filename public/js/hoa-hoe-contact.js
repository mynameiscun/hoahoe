/* Hoa Hoè | Floating Bouquet Contact 5.2
 * Bộ liên hệ hình cung. Không đụng vào giỏ hàng, sản phẩm, Django hoặc carousel.
 * ĐIỀN LINK THẬT của shop vào CONTACT_LINKS. Để '' khi chưa có.
 */
(function () {
  'use strict';

  // ===== CHỈNH LINK TẠI ĐÂY =====
  var CONTACT_LINKS = {
    messenger: '', // VD: 'https://m.me/TenTrangFacebookCuaShop'
    zalo: '',      // VD: URL Zalo chính thức của shop
    instagram: '', // VD: 'https://www.instagram.com/TenTaiKhoanShop/'
    tiktok: ''     // VD: 'https://www.tiktok.com/@TenTaiKhoanShop'
  };
  // Tên file ảnh: img/iconcontact.png (bó hoa), và 4 ảnh kênh ở CHANNELS.
  // Không cần thêm ảnh kênh ngay: các icon SVG mặc định vẫn hiển thị.

  var CHANNELS = [
    {
      key: 'messenger', label: 'Messenger', image: 'img/contact-messenger.png',
      icon: '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M18 4.5C10.1 4.5 4.5 10 4.5 17.1c0 3.6 1.4 6.7 4.1 8.9v5.4l5.2-2.9c1.3.4 2.7.6 4.2.6 7.8 0 13.5-5.5 13.5-12.6S25.8 4.5 18 4.5Z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="m10.5 20 6.4-6.5 4.7 4.5 4-4.1-6.5 7.1-4.6-4.4-4 3.4Z" fill="currentColor"/></svg>'
    },
    {
      key: 'zalo', label: 'Zalo', image: 'img/contact-zalo.png',
      icon: '<span class="hoa-contact-fab__wordmark" aria-hidden="true">Zalo</span>'
    },
    {
      key: 'instagram', label: 'Instagram', image: 'img/contact-instagram.png',
      icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="5.5" y="5.5" width="25" height="25" rx="7"/><circle cx="18" cy="18" r="6"/><circle cx="26.2" cy="9.8" r="1.8" fill="currentColor" stroke="none"/></svg>'
    },
    {
      key: 'tiktok', label: 'TikTok', image: 'img/contact-tiktok.png',
      icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5v17.4a6.3 6.3 0 1 1-6.3-6.3"/><path d="M21 5c1.2 5.9 4.6 8.6 9.1 8.6"/></svg>'
    }
  ];

  function make(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function addOptionalImage(container, src, cls) {
    var img = make('img', cls);
    img.src = src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    function loaded() { img.classList.add('is-loaded'); }
    function failed() { img.remove(); }
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', failed, { once: true });
    container.appendChild(img);
    if (img.complete) {
      if (img.naturalWidth) loaded();
      else failed();
    }
  }
  function addCSS() {
    if (document.getElementById('hoa-contact-styles')) return;
    var css = make('link');
    css.id = 'hoa-contact-styles';
    css.rel = 'stylesheet';
    css.href = 'css/hoa-hoe-contact.css?v=5.2';
    document.head.appendChild(css);
  }
  function init() {
    if (!document.body || document.getElementById('hoa-contact-fab')) return;
    addCSS();
    document.body.classList.add('hoa-contact-enabled');

    var root = make('aside', 'hoa-contact-fab');
    root.id = 'hoa-contact-fab';
    root.setAttribute('aria-label', 'Liên hệ Hoa Hoè');
    var main = make('button', 'hoa-contact-fab__main');
    main.type = 'button';
    main.setAttribute('aria-label', 'Mở các kênh liên hệ');
    main.setAttribute('aria-expanded', 'false');
    main.setAttribute('aria-controls', 'hoa-contact-items');
    main.title = 'Liên hệ với Hoa Hoè';
   
    addOptionalImage(main, 'img/iconcontact.png', 'hoa-contact-fab__main-image');

    var items = make('div', 'hoa-contact-fab__items');
    items.id = 'hoa-contact-items';
    var status = make('div', 'hoa-contact-fab__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var opened = false;
    var closeTimer = null;
    var statusTimer = null;
    var itemsControls = [];

    function setOpen(value) {
      opened = !!value;
      root.classList.toggle('is-open', opened);
      main.setAttribute('aria-expanded', String(opened));
      main.setAttribute('aria-label', opened ? 'Thu gọn kênh liên hệ' : 'Mở các kênh liên hệ');
      itemsControls.forEach(function (el) {
        el.tabIndex = opened ? 0 : -1;
        el.setAttribute('aria-hidden', String(!opened));
      });
    }
    function cancelClose() { if (closeTimer) clearTimeout(closeTimer); closeTimer = null; }
    function deferClose() {
      cancelClose();
      closeTimer = setTimeout(function () {
        if (!root.contains(document.activeElement)) setOpen(false);
      }, 260);
    }
    function notifyMissing(label) {
      if (statusTimer) clearTimeout(statusTimer);
      status.textContent = 'Chưa có liên kết ' + label + ' của shop. Hãy cập nhật trong js/hoa-hoe-contact.js.';
      status.classList.add('is-visible');
      statusTimer = setTimeout(function () { status.classList.remove('is-visible'); }, 3000);
    }

    CHANNELS.forEach(function (item) {
      var link = String(CONTACT_LINKS[item.key] || '').trim();
      var validLink = /^https:\/\//i.test(link);
      var control = make(validLink ? 'a' : 'button', 'hoa-contact-fab__item');
      control.dataset.channel = item.key;
      control.setAttribute('aria-label', item.label + (validLink ? ' — mở liên kết' : ' — chưa có liên kết'));
      if (validLink) {
        control.href = link;
        control.target = '_blank';
        control.rel = 'noopener noreferrer';
      } else {
        control.type = 'button';
        control.addEventListener('click', function () { notifyMissing(item.label); });
      }
      var pictogram = make('span', 'hoa-contact-fab__icon');
      pictogram.innerHTML = item.icon; // markup SVG cố định, không nhận từ URL/người dùng
      addOptionalImage(pictogram, item.image, 'hoa-contact-fab__channel-image');
      control.appendChild(pictogram);
      control.appendChild(make('span', 'hoa-contact-fab__tooltip', item.label));
      items.appendChild(control);
      itemsControls.push(control);
    });

    root.appendChild(items);
    root.appendChild(main);
    root.appendChild(status);
    document.body.appendChild(root);
    setOpen(false);

    // Desktop: hover nở theo cung; điện thoại: chạm để mở/đóng.
    root.addEventListener('mouseenter', function (evt) {
      cancelClose();
      if (window.matchMedia('(hover: hover)').matches) setOpen(true);
    });
    root.addEventListener('mouseleave', function () {
      if (window.matchMedia('(hover: hover)').matches) deferClose();
    });
    main.addEventListener('click', function (evt) {
      evt.preventDefault();
      cancelClose();
      // Trên desktop hover đã mở menu; click không đóng nhầm. Trên mobile click mới toggle.
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setOpen(true);
      else setOpen(!opened);
    });
    root.addEventListener('focusin', function (evt) {
      // Touch focus xảy ra trước click; chỉ tự mở khi người dùng dùng bàn phím.
      if (evt.target.matches && evt.target.matches(':focus-visible')) {
        cancelClose();
        setOpen(true);
      }
    });
    root.addEventListener('focusout', function () { deferClose(); });
    document.addEventListener('pointerdown', function (evt) {
      if (opened && !root.contains(evt.target)) { cancelClose(); setOpen(false); }
    });
    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape' && opened) {
        setOpen(false);
        main.focus();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
