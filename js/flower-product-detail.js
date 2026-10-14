/* Hoa Hoè: bind product information by ID, using the 9 image pairs uploaded by the user.
 * Prices for items 1–9 are supplied by the shop; descriptions 1–9 and names 7–9 are draft. */
(function(){
 'use strict';
 var catalog=window.FIAMA_DEMO_PRODUCTS||{};
 var root=document.querySelector('.ltn__shop-details-inner');if(!root)return;
 var id=new URLSearchParams(location.search).get('product')||'hoa-001';
 var p=catalog[id],info=root.querySelector('.shop-details-info');
 if(!info)return;
 var title=info.querySelector('h3'),btn=info.querySelector('.d-add-to-cart');
 if(!p){
  if(title)title.textContent='Không tìm thấy mẫu hoa';
  var err=info.querySelector('.modal-product-brief p'); if(err)err.textContent='Mã sản phẩm không tồn tại. Vui lòng quay lại trang Sản phẩm.';
  if(btn){btn.setAttribute('aria-disabled','true');btn.removeAttribute('data-bs-target');btn.removeAttribute('data-demo-add');btn.style.pointerEvents='none';}
  var gallery=root.querySelector('.ltn__shop-details-img-gallery');if(gallery)gallery.style.display='none';return;
 }
 var money=function(v){return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);};
 root.setAttribute('data-fiama-product-id',p.id);
 document.title=p.name+' — Hoa Hoè Flower Shop';
 if(title) title.textContent=p.name;
 var price=info.querySelector('.product-price span');if(price)price.textContent=money(p.price);
 var old=info.querySelector('.product-price del');if(old)old.style.display='none';
 var brief=info.querySelector('.modal-product-brief p');
 if(brief)brief.textContent=p.description;
 var priceBox=info.querySelector('.product-price-ratting');
 if(priceBox&&!info.querySelector('.hoa-detail-price-note')){
   var note=document.createElement('div');note.className='hoa-draft-notice hoa-detail-price-note';
   note.innerHTML='Giá hoa theo bảng shop cung cấp. Phí giao tính riêng theo khu vực.';
   priceBox.after(note);
 }
 var meta=info.querySelector('.modal-product-meta.mb-30');
 if(meta){meta.innerHTML='<div class="hoa-detail-meta"><p><strong>Mã hoa:</strong> '+p.id+'</p><p><strong>Tông màu:</strong> '+p.tone+'</p><p><strong>Thích hợp:</strong> '+p.occasions+'</p></div>';}
 var badVariations=info.querySelector('.modal-product-meta.mb-20');if(badVariations)badVariations.style.display='none';
 var wishlist=info.querySelector('.d-add-to-wishlist');if(wishlist){var li=wishlist.closest('li');if(li)li.remove();else wishlist.remove();}
 var stars=info.querySelector('.product-ratting');if(stars)stars.style.display='none';
 var qty=info.querySelector('.cart-plus-minus-box');if(qty)qty.value='1';
 if(btn){btn.textContent='THÊM VÀO GIỎ';btn.setAttribute('title','Thêm '+p.name+' vào giỏ chạy thử');}
 var thumb=root.querySelector('.ltn__shop-details-small-img');
 var large=root.querySelector('.ltn__shop-details-large-img');
 var imgs=[{src:p.image,caption:'Bó hoa '+p.name},{src:p.poster,caption:'Ảnh thiết kế '+p.name}];
 if(thumb){thumb.innerHTML='';imgs.forEach(function(x){var div=document.createElement('div');div.className='single-small-img';var im=document.createElement('img');im.src=x.src;im.alt=x.caption;div.appendChild(im);thumb.appendChild(div);});}
 if(large){large.innerHTML='';imgs.forEach(function(x){var div=document.createElement('div');div.className='single-large-img';var a=document.createElement('a');a.href=x.src;a.setAttribute('data-rel','lightcase:myCollection');var im=document.createElement('img');im.src=x.src;im.alt=x.caption;a.appendChild(im);div.appendChild(a);large.appendChild(div);});}
 var desc=document.querySelector('#liton_tab_details_1_1 .ltn__shop-details-tab-content-inner');
 if(desc)desc.innerHTML='<p>'+p.description+'</p><p><strong>Thiết kế:</strong> '+p.features+'</p><p><strong>Tông màu:</strong> '+p.tone+'</p><p><strong>Gợi ý dịp tặng:</strong> '+p.occasions+'</p><p class="hoa-draft-notice">Mô tả được soạn dựa trên ảnh. Chủng loại/số lượng hoa và vật liệu thực tế cần cửa hàng xác nhận.</p>';
 var review=document.querySelector('.ltn__shop-details-tab-menu a[href="#liton_tab_details_1_2"]');if(review)review.closest('li')?.remove();
 var reviewPane=document.querySelector('#liton_tab_details_1_2');if(reviewPane)reviewPane.remove();
 var shipping=document.querySelector('#liton_tab_details_1_4 .ltn__shop-details-tab-content-inner');
 if(shipping)shipping.textContent='Shop tự giao trong phạm vi TP.HCM trước sáp nhập năm 2025. Các khung giao dự kiến: 09:00–12:00, 13:00–17:00, 18:00–20:00. Đặt trước 17:00 ngày hôm trước. Phí giao và thời gian cụ thể phải được cửa hàng xác nhận.';
 document.querySelectorAll('.ltn__shop-details-tab-menu a').forEach(function(a){if(a.getAttribute('href')==='#liton_tab_details_1_1')a.textContent='Mô tả';if(a.getAttribute('href')==='#liton_tab_details_1_4')a.textContent='Giao hoa';});
 // Do not suggest the current item as related.
 document.querySelectorAll('.ltn__related-product-slider-one-active .ltn__product-item').forEach(function(card){if(card.dataset.fiamaProductId===p.id)card.closest('.col-12')?.remove();});
})();
