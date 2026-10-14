/* Danh sách sản phẩm: sắp xếp và lọc tại trình duyệt; không gọi backend. */
(function(){'use strict';
var data=window.FIAMA_DEMO_PRODUCTS||{};
var select=document.getElementById('hoa-sort'), search=document.getElementById('flower-search-input');
var form=document.getElementById('flower-shop-search');
function update(){
 var order=select?select.value:'default', needle=search?search.value.trim().toLocaleLowerCase('vi'):'';
 ['#liton_product_grid .row','#liton_product_list .row'].forEach(function(selector){
  var row=document.querySelector(selector);if(!row)return;
  var cols=Array.from(row.querySelectorAll('[data-flower-sort-id]'));
  cols.sort(function(a,b){var x=data[a.dataset.flowerSortId],y=data[b.dataset.flowerSortId];if(!x||!y)return 0;
    if(order==='price-low')return x.price-y.price;
    if(order==='price-high')return y.price-x.price;
    if(order==='name')return x.name.localeCompare(y.name,'vi');
    return Number(x.id.slice(-3))-Number(y.id.slice(-3));});
  cols.forEach(function(col){var x=data[col.dataset.flowerSortId];col.style.display=x && x.name.toLocaleLowerCase('vi').includes(needle)?'':'none';row.appendChild(col);});
 });
 var count=Object.values(data).filter(function(x){return x.name.toLocaleLowerCase('vi').includes(needle);}).length;
 var label=document.querySelector('.showing-product-number span');if(label)label.textContent=count+' / '+Object.keys(data).length+' mẫu hoa';
}
var q=new URLSearchParams(location.search).get('search');if(q&&search)search.value=q;
if(select)select.addEventListener('change',update);
if(search)search.addEventListener('input',update);
if(form)form.addEventListener('submit',function(e){e.preventDefault();update();});
update();
})();