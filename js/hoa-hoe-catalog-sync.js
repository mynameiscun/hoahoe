/* Đồng bộ các thẻ sản phẩm tĩnh từ catalog để chỉnh giá/tên/ảnh chỉ tại flower-product-data.js. */
(function(){
 'use strict';
 var all=window.FIAMA_DEMO_PRODUCTS||{};
 var money=function(n){return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);};
 document.querySelectorAll('.ltn__product-item[data-fiama-product-id]').forEach(function(card){
   var p=all[card.getAttribute('data-fiama-product-id')];if(!p)return;
   var href='product-details.html?product='+encodeURIComponent(p.id);
   var im=card.querySelector('.product-img img');if(im){im.src=p.image;im.alt='Bó hoa '+p.name;}
   var title=card.querySelector('.product-title a');if(title){title.href=href;title.textContent=p.name;}
   var price=card.querySelector('.product-price span');if(price)price.textContent=money(p.price);
   card.querySelectorAll('.product-img a:not([data-demo-add]), .product-hover-action a:not([data-demo-add])').forEach(function(a){a.href=href;});
   var brief=card.querySelector('.product-brief p');if(brief)brief.textContent=p.description;
   var add=card.querySelector('[data-demo-add]');if(add)add.setAttribute('title','Thêm '+p.name+' vào giỏ');
 });
})();
