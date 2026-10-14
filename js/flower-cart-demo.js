/* Hoa Hoè — giỏ hàng demo trên trình duyệt, KHÔNG phải backend.
 * Giá hoa lấy từ bảng giá shop cung cấp cho 9 mẫu. Phí giao chưa tính.
 * Sau này Django sẽ là nguồn xác thực sản phẩm, tồn kho, phí giao và thanh toán.
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'hoa_hoe_draft_cart_v1';
  var catalog=window.FIAMA_DEMO_PRODUCTS||{};
  var formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND',maximumFractionDigits:0 });
  function money(n) { return formatter.format(Number(n) || 0); }
  function text(el) { return el ? (el.textContent || '').trim() : ''; }
  function one(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, function(c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function readCart() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(data)) return [];
      return data.filter(function (p) {return p && typeof p.id === 'string' && catalog[p.id] && Number.isInteger(p.qty) && p.qty > 0 && p.qty <= 99;}).map(function(p){var x=catalog[p.id];return {id:x.id,name:x.name,price:x.price,image:x.image,qty:p.qty};});
    } catch (err) { return []; }
  }
  function writeCart(items) {
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(items));} catch(err) {console.warn('Không lưu được giỏ hàng demo (storage bị chặn).',err);}
    renderEverywhere();
  }
  function parsePrice(str) {
    var m = String(str || '').match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? Number(m[1].replace(/,/g, '')) : NaN;
  }
  function getProduct(source) {
    var root=source.closest('.ltn__product-item') || source.closest('.ltn__shop-details-inner');
    if(!root)return null;
    var p=catalog[root.getAttribute('data-fiama-product-id')];
    if(!p)return null;
    var qty=1;
    if(root.classList.contains('ltn__shop-details-inner')){
      var input=one('.cart-plus-minus-box',root);
      qty=Math.max(1,Math.min(99,parseInt(input&&input.value || '1',10)||1));
    }
    return {id:p.id,name:p.name,price:p.price,image:p.image,qty:qty};
  }
  function detailLink(product) {
    var known = window.FIAMA_DEMO_PRODUCTS || {};
    var match = known[product.id];
    if (!match) {
      match = Object.values(known).find(function(x) {
        return x.name === product.name && Number(x.price) === Number(product.price) && x.image === product.image;
      });
    }
    return match ? 'product-details.html?product=' + encodeURIComponent(match.id) : 'shop.html';
  }
  function add(product) {
    var list = readCart();
    var p = list.find(function(x) { return x.id === product.id; });
    if (p) p.qty = Math.min(99, p.qty + product.qty);
    else list.push(product);
    writeCart(list);
    notify('Đã thêm "' + product.name + '" vào giỏ hàng chạy thử.');
  }
  function modify(id, qty) {
    var list = readCart();
    list = list.map(function(p) { if (p.id === id) p.qty = Math.max(0, Math.min(99,qty)); return p; }).filter(function(p) {return p.qty > 0;});
    writeCart(list);
  }
  function subtotal(list) {return list.reduce(function(t,p) {return t + p.qty*p.price;}, 0);}
  function totalQty(list) {return list.reduce(function(t,p) {return t+p.qty;},0);}
  function notify(message) {
    var el = document.getElementById('flower-cart-toast');
    if (!el) {
      el=document.createElement('div'); el.id='flower-cart-toast'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
      document.body.appendChild(el);
    }
    el.textContent=message; el.classList.add('show');
    clearTimeout(notify.timer); notify.timer=setTimeout(function(){el.classList.remove('show');},2600);
  }
  function renderBadges(list) {
    all('.mini-cart-icon-2 sup, .ltn__utilize-buttons a[href="cart.html"] sup').forEach(function(el){ el.textContent=String(totalQty(list)); el.title='Số sản phẩm trong giỏ hàng chạy thử';});
    all('.mini-cart-icon-2 h6').forEach(function(el){el.innerHTML='<span>Giỏ hàng</span> <span class="ltn__secondary-color">'+money(subtotal(list))+'</span>';});
    all('.ltn__utilize-menu-title').forEach(function(el){ if (el.closest('#ltn__utilize-cart-menu')) el.textContent='Giỏ hàng'; });
  }
  function renderMini(list) {
    var mini=one('#ltn__utilize-cart-menu .mini-cart-product-area');
    if (!mini) return;
    if (!list.length) mini.innerHTML='<p class="flower-cart-empty">Giỏ hàng chưa có sản phẩm.</p>';
    else mini.innerHTML=list.map(function(p){
      var img = p.image ? '<img src="'+escapeHTML(p.image)+'" alt="" onerror="this.style.display=\'none\'">' : '';
      return '<div class="mini-cart-item clearfix">'
        +'<div class="mini-cart-img"><a href="'+detailLink(p)+'">'+img+'</a><button type="button" class="mini-cart-item-delete flower-mini-remove" data-demo-remove="'+escapeHTML(p.id)+'" aria-label="Xóa '+escapeHTML(p.name)+'"><i class="icon-trash"></i></button></div>'
        +'<div class="mini-cart-info"><h6><a href="'+detailLink(p)+'">'+escapeHTML(p.name)+'</a></h6>'
        +'<span class="mini-cart-quantity">'+p.qty+' × '+money(p.price)+'</span></div></div>';
    }).join('');
    var sub=one('#ltn__utilize-cart-menu .mini-cart-sub-total span');
    if(sub) sub.textContent=money(subtotal(list));
    var link=one('#ltn__utilize-cart-menu .mini-cart-footer .btn-wrapper a[href="cart.html"]');
    if(link) link.textContent='Xem giỏ hàng';
    var checkoutLink=one('#ltn__utilize-cart-menu .mini-cart-footer .btn-wrapper a.theme-btn-2');
    if(checkoutLink) {checkoutLink.textContent='Trang đặt hoa (chạy thử)';checkoutLink.setAttribute('href','checkout.html');}
    var shippingClaim=one('#ltn__utilize-cart-menu .mini-cart-footer > p');
    if(shippingClaim) shippingClaim.textContent='Phí giao theo vùng sẽ do Admin cấu hình khi triển khai Django.';
  }
  function renderCart(list) {
    if (!document.body.classList.contains('flower-cart-page')) return;
    var body=one('.shoping-cart-table table tbody');
    if(body) {
      if(!list.length) body.innerHTML='<tr><td colspan="6" class="flower-cart-empty">Giỏ hàng trống. <a href="shop.html">Xem sản phẩm hoa</a></td></tr>';
      else body.innerHTML=list.map(function(p){
        var id=escapeHTML(p.id), name=escapeHTML(p.name);
        var img=p.image?'<img src="'+escapeHTML(p.image)+'" alt="" onerror="this.style.display=\'none\'">':'';
        return '<tr data-demo-row="'+id+'"><td class="cart-product-remove"><button type="button" class="flower-remove-btn" data-demo-remove="'+id+'" aria-label="Xóa '+name+'">×</button></td>'
          +'<td class="cart-product-image"><a href="'+detailLink(p)+'">'+img+'</a></td>'
          +'<td class="cart-product-info"><h4><a href="'+detailLink(p)+'">'+name+'</a></h4></td>'
          +'<td class="cart-product-price">'+money(p.price)+'</td>'
          +'<td class="cart-product-quantity"><div class="flower-qty-control"><button type="button" data-demo-step="-1" data-demo-id="'+id+'" aria-label="Giảm số lượng '+name+'">−</button><input type="number" min="1" max="99" value="'+p.qty+'" data-demo-qty="'+id+'" aria-label="Số lượng '+name+'"><button type="button" data-demo-step="1" data-demo-id="'+id+'" aria-label="Tăng số lượng '+name+'">+</button></div></td>'
          +'<td class="cart-product-subtotal">'+money(p.qty*p.price)+'</td></tr>';
      }).join('');
    }
    var totals=one('.shoping-cart-total table tbody');
    if(totals) totals.innerHTML='<tr><td>Tạm tính tiền hoa</td><td>'+money(subtotal(list))+'</td></tr><tr><td>Phí giao hoa</td><td>Chưa tính — Admin sẽ cấu hình theo vùng</td></tr><tr><td><strong>Tiền sản phẩm tạm tính</strong></td><td><strong>'+money(subtotal(list))+'</strong></td></tr>';
    var button=one('.shoping-cart-total a[href="checkout.html"]');
    if(button){button.textContent='Tiếp tục đến trang đặt hoa (chạy thử)'; if(!list.length) {button.classList.add('disabled');button.setAttribute('aria-disabled','true');}else{button.classList.remove('disabled');button.removeAttribute('aria-disabled');}}
    var note=one('#flower-cart-notice');
    if (!note) {
      var node=one('.shoping-cart-inner');
      if(node){note=document.createElement('p');note.id='flower-cart-notice';note.className='flower-cart-demo-note';node.insertBefore(note,node.firstChild);}
    }
    if(note) note.textContent='BẢN CHẠY THỬ — Giá hoa theo bảng shop cung cấp; giỏ chỉ lưu trên trình duyệt. Chưa bao gồm phí giao.';
    var coupon=one('.cart-coupon'); if(coupon) coupon.style.display='none';
    var update=all('button').find(function(b){return text(b).toLowerCase()==='update cart';});if(update) update.style.display='none';
  }
  function renderCheckout(list){
    if(!document.body.classList.contains('flower-checkout-page'))return;
    var wrapper=one('.ltn__checkout-inner') || one('.ltn__checkout-area');
    if(wrapper && !one('#flower-checkout-warning')) {
      var note=document.createElement('div');note.id='flower-checkout-warning';note.className='flower-cart-demo-note';
      note.innerHTML='<strong>CHƯA NHẬN ĐƠN THẬT.</strong> Đây là giao diện HTML để kiểm tra bố cục. Shop chỉ nhận chuyển khoản thủ công <strong>sau khi xác nhận đơn</strong>. Chưa có Django/MySQL để kiểm tra khu vực, lịch giao, xác nhận đơn và thanh toán.';
      wrapper.insertBefore(note,wrapper.firstChild);
    }
    all('.ltn__returning-customer-wrap, .ltn__coupon-code-wrap').forEach(function(el){el.style.display='none';});
    var payment=one('.ltn__checkout-payment-method');
    if(payment){payment.innerHTML='<h4 class="title-2">Thanh toán</h4><p><strong>Chỉ chuyển khoản thủ công sau khi shop xác nhận đơn.</strong> Không thanh toán trên bản chạy thử này.</p>';}
    var total=one('.shoping-cart-total table tbody');
    if(total){total.innerHTML=list.map(function(p){return '<tr><td>'+escapeHTML(p.name)+' × '+p.qty+'</td><td>'+money(p.qty*p.price)+'</td></tr>';}).join('')+'<tr><td>Phí giao</td><td>Chờ cấu hình khu vực</td></tr><tr><td><strong>Tạm tính tiền hoa</strong></td><td><strong>'+money(subtotal(list))+'</strong></td></tr>';}
    all('a,button,input[type="submit"]').forEach(function(btn){
      if((text(btn)||'').toLowerCase().includes('place order')){
        btn.textContent='Chưa thể gửi đơn thật';btn.setAttribute('aria-disabled','true');btn.setAttribute('title','Cần tích hợp Django và MySQL');
        if(btn.tagName==='BUTTON') btn.disabled=true;
        else btn.addEventListener('click',function(e){e.preventDefault();notify('Chức năng gửi đơn sẽ hoàn thiện ở giai đoạn Django.');});
      }
    });
  }
  function renderEverywhere(){var list=readCart();renderBadges(list);renderMini(list);renderCart(list);renderCheckout(list);}
  document.addEventListener('click',function(event){
    var addButton=event.target.closest('[data-demo-add]');
    if(addButton){event.preventDefault();event.stopPropagation();var p=getProduct(addButton);if(p)add(p);else notify('Không lấy được thông tin sản phẩm mẫu.');return;}
    var del=event.target.closest('[data-demo-remove]');
    if(del){event.preventDefault();modify(del.getAttribute('data-demo-remove'),0);return;}
    var step=event.target.closest('[data-demo-step]');
    if(step){event.preventDefault();var list=readCart(),p=list.find(function(x){return x.id===step.getAttribute('data-demo-id');});if(p)modify(p.id,Math.max(1,p.qty+Number(step.getAttribute('data-demo-step'))));return;}
    var checkoutDisabled=event.target.closest('.shoping-cart-total a[aria-disabled="true"]');if(checkoutDisabled){event.preventDefault();notify('Giỏ hàng đang trống.');}
  },true);
  document.addEventListener('change',function(event){var input=event.target.closest('[data-demo-qty]');if(input){modify(input.getAttribute('data-demo-qty'),Math.max(1,Math.min(99,parseInt(input.value,10)||1)));}});
  function wireProducts(){
    all('.ltn__product-item .product-hover-action a[data-bs-target="#add_to_cart_modal"], .ltn__shop-details-inner .d-add-to-cart').forEach(function(a){
      a.removeAttribute('data-bs-toggle');a.removeAttribute('data-bs-target');a.setAttribute('data-demo-add','');a.setAttribute('href','#');a.setAttribute('title','Thêm vào giỏ hàng chạy thử');
    });
  }
  function init(){
    var path=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if(path==='cart.html')document.body.classList.add('flower-cart-page');
    if(path==='checkout.html')document.body.classList.add('flower-checkout-page');
    wireProducts();renderEverywhere();
    var cartForm=one('.shoping-cart-table')?.closest('form');
    if(cartForm)cartForm.addEventListener('submit',function(e){e.preventDefault();notify('Giỏ hàng demo tự cập nhật, không cần gửi form.');});
    var checkoutArea=one('.ltn__checkout-area');
    if(checkoutArea) checkoutArea.querySelectorAll('form').forEach(function(form){form.addEventListener('submit',function(e){e.preventDefault();notify('Chưa có Django nên không thể tạo đơn thật.');});});
    window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY)renderEverywhere();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
