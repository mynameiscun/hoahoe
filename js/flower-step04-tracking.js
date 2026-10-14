
// Step 04: Chỉ phản hồi ở giao diện; không truy vấn hay tiết lộ dữ liệu đơn hàng.
(function(){
  var form=document.getElementById('flower-order-lookup');
  if(!form) return;
  form.addEventListener('submit',function(event){
    event.preventDefault();
    var code=form.querySelector('#order-code');
    var phone=form.querySelector('#buyer-phone');
    var box=document.getElementById('flower-lookup-notice');
    box.hidden=false;
    if(!code.value.trim() || !phone.value.trim()) {
      box.textContent='Vui lòng nhập đầy đủ mã đơn và số điện thoại người đặt.';
      code.value.trim()?phone.focus():code.focus();
      return;
    }
    box.textContent='Đây là giao diện thử nghiệm Step 04. Chức năng tra cứu sẽ kết nối Django/MySQL ở giai đoạn Backend; hiện chưa có dữ liệu đơn hàng để hiển thị.';
  });
})();
