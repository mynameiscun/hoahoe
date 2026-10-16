/**
 * Hoa Hoe Flower Shop — Sheets order service (Apps Script V8).
 * Script Properties (set privately): SHEET_ID, GAS_API_KEY.
 * Deploy > Web app > Execute as: Me; Who has access: Anyone.
 * Access to spreadsheet is PRIVATE; do not share with public.
 * All requests go through Cloudflare Pages Functions, NEVER directly from public browser.
 */
var TIMEZONE = 'Asia/Ho_Chi_Minh';
var TAB_PRODUCTS = 'Products';
var TAB_ORDERS = 'Orders';
var PRODUCT_HEADERS = ['code','name','price','description','image','active'];
var ORDER_HEADERS = [
  'order_code','submission_id','created_at','status','payment_status',
  'customer_name','customer_phone','customer_email','recipient_name','recipient_phone',
  'delivery_address','delivery_date','delivery_slot','note','subtotal','delivery_fee','items_json',
  'delivery_district_code','delivery_district_name','delivery_ward_name'
];
var DISTRICTS = {
  '760':'Quận 1','761':'Quận 12','764':'Quận Gò Vấp','765':'Quận Bình Thạnh',
  '766':'Quận Tân Bình','767':'Quận Tân Phú','768':'Quận Phú Nhuận',
  '769':'Thành phố Thủ Đức','770':'Quận 3','771':'Quận 10','772':'Quận 11',
  '773':'Quận 4','774':'Quận 5','775':'Quận 6','776':'Quận 8','777':'Quận Bình Tân',
  '778':'Quận 7','783':'Huyện Củ Chi','784':'Huyện Hóc Môn',
  '785':'Huyện Bình Chánh','786':'Huyện Nhà Bè','787':'Huyện Cần Giờ'
};
var STATUSES = {
  pending:'Chờ xác nhận',confirmed:'Đã xác nhận',rejected:'Từ chối',
  completed:'Hoàn thành',cancelled:'Đã hủy'
};
var PAYMENTS = {
  not_requested:'Chưa yêu cầu thanh toán',
  awaiting_transfer:'Chờ chuyển khoản',paid:'Đã thanh toán'
};
var SLOTS = {'09-12':'09:00 – 12:00','13-17':'13:00 – 17:00','18-20':'18:00 – 20:00'};

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function assert_(condition, message) {
  if (!condition) throw new Error(message);
}
function safeCell_(input) {
  var value = String(input == null ? '' : input);
  // Prevent spreadsheet formula injection from user-controlled fields.
  return /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value;
}
function text_(p, key, max, required) {
  var s = p[key];
  assert_(typeof s === 'string', key + ' phải là chuỗi.');
  s = s.trim();
  assert_(s.length <= max && (!required || s.length > 0) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s),
    key + ' không hợp lệ.');
  return s;
}
function phone_(p, key) {
  var s = text_(p, key, 24, true).replace(/[.\s()\-]/g, '');
  if (/^\+84[0-9]{9}$/.test(s)) s = '0' + s.slice(3);
  assert_(/^0[0-9]{9}$/.test(s), key + ' cần số điện thoại Việt Nam hợp lệ.');
  return s;
}
function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  assert_(!!id, 'Chưa cấu hình SHEET_ID trong Script Properties.');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(name);
  assert_(!!sheet, 'Chưa tạo tab ' + name + '. Hãy chạy setupHoaHoeSheets() một lần.');
  return sheet;
}
function readProducts_() {
  var values = sheet_(TAB_PRODUCTS).getDataRange().getValues();
  assert_(values.length > 1, 'Chưa có dữ liệu Products.');
  assert_(values[0].slice(0, 6).join('|') === PRODUCT_HEADERS.join('|'), 'Sai cấu trúc cột Products.');
  var result = [], seen = {};
  values.slice(1).forEach(function(r) {
    var code = String(r[0] || '').trim();
    var name = String(r[1] || '').trim();
    var amount = Number(r[2]);
    var active = r[5] === true || String(r[5]).trim().toLowerCase() === 'true';
    if (!code || !active) return;
    assert_(/^hoa-[0-9]{3,5}$/.test(code) && !seen[code], 'Mã sản phẩm không hợp lệ hoặc trùng: ' + code);
    assert_(name.length > 0 && name.length <= 150, 'Tên sản phẩm không hợp lệ: ' + code);
    assert_(Number.isSafeInteger(amount) && amount > 0 && amount < 2000000000, 'Giá không hợp lệ: ' + code);
    var image = String(r[4] || '').trim();
    assert_(!image || /^\/?img\/(?:product|catalog)\/[a-zA-Z0-9_.-]+\.(?:webp|png|jpg|jpeg)$/.test(image),
      'Đường dẫn ảnh chỉ được nằm trong img/product hoặc img/catalog: ' + code);
    seen[code] = true;
    result.push({code:code,name:name,price:amount,description:String(r[3] || '').slice(0, 1000),image:image,is_active:true});
  });
  assert_(result.length <= 100, 'Tối đa 100 sản phẩm trong phiên bản nhỏ.');
  return result;
}
function verifySchedule_(p) {
  var date = text_(p, 'delivery_date', 10, true);
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(date), 'Ngày giao phải theo định dạng YYYY-MM-DD.');
  var ms = Date.parse(date + 'T00:00:00+07:00');
  var dt = new Date(ms);
  assert_(!isNaN(ms) && Utilities.formatDate(dt, TIMEZONE, 'yyyy-MM-dd') === date, 'Ngày giao không hợp lệ.');
  var slot = text_(p, 'delivery_slot', 10, true);
  assert_(!!SLOTS[slot], 'Khung giờ giao không hợp lệ.');
  assert_(Date.now() < ms - 7 * 60 * 60 * 1000, 'Phải đặt trước 17:00 ngày hôm trước.');
  assert_(ms - Date.now() < 185 * 86400000, 'Chỉ nhận lịch giao trong 6 tháng tới.');
  return {date:date, slot:slot};
}
function area_(p) {
  var districtCode = text_(p, 'delivery_district_code', 4, true);
  assert_(!!DISTRICTS[districtCode], 'Quận/huyện không thuộc khu vực giao.');
  // V1 Sheet: phường/xã luôn nhập tay, người quản lý xác minh trước khi giao.
  assert_(p.delivery_ward_code === 'manual', 'Vui lòng nhập phường/xã để shop xác minh.');
  var ward = text_(p, 'delivery_ward_manual', 100, true);
  var street = text_(p, 'delivery_street', 220, true);
  assert_(street.length >= 5, 'Vui lòng ghi rõ số nhà và tên đường.');
  return {
    districtCode:districtCode, district:DISTRICTS[districtCode], ward:ward,
    address:street + ', ' + ward + ', ' + DISTRICTS[districtCode] + ', TP.HCM'
  };
}
function compute_(p) {
  assert_(Array.isArray(p.items) && p.items.length > 0 && p.items.length <= 30, 'Giỏ hàng không hợp lệ.');
  var products = readProducts_(), lookup = {}, used = {}, sum = 0, items = [];
  products.forEach(function(product) { lookup[product.code] = product; });
  p.items.forEach(function(i) {
    assert_(i && typeof i.code === 'string' && /^hoa-[0-9]{3,5}$/.test(i.code) && !used[i.code], 'Trùng hoặc sai mã hoa.');
    assert_(Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 99, 'Số lượng phải từ 1–99.');
    var product = lookup[i.code];
    assert_(!!product, 'Có sản phẩm đã ngừng bán, vui lòng cập nhật giỏ hàng.');
    used[i.code] = true;
    var total = product.price * i.quantity;
    sum += total;
    assert_(Number.isSafeInteger(sum) && sum <= 2147483647, 'Tổng tiền vượt giới hạn.');
    items.push({code:product.code,name:product.name,quantity:i.quantity,unit_price:product.price,line_total:total});
  });
  return {items:items,subtotal:sum};
}
function preview_(p) {
  var schedule = verifySchedule_(p);
  var area = area_(p);
  var result = compute_(p);
  return {ok:true, delivery_date:schedule.date,delivery_slot:schedule.slot,
    items_count:result.items.length, items:result.items,subtotal:result.subtotal,
    delivery_fee:null, fee_pending:true, can_submit:true,
    delivery_area:{district:area.district,ward:area.ward,ward_reference_checked:false}};
}
function validateCustomer_(p) {
  var email = text_(p, 'customer_email', 254, false);
  assert_(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Email không hợp lệ.');
  return {
    buyer:text_(p, 'customer_name', 150, true), phone:phone_(p, 'customer_phone'),
    email:email, recipient:text_(p, 'recipient_name', 150, true),
    recipientPhone:phone_(p, 'recipient_phone'), note:text_(p, 'note', 1000, false)
  };
}
function ordersValues_() {
  var rows = sheet_(TAB_ORDERS).getDataRange().getValues();
  assert_(rows[0].slice(0, ORDER_HEADERS.length).join('|') === ORDER_HEADERS.join('|'), 'Sai cấu trúc cột Orders.');
  return rows;
}
function findRow_(values, column, value) {
  for (var r = 1; r < values.length; r++) if (String(values[r][column] || '') === value) return values[r];
  return null;
}
function submit_(p) {
  assert_(typeof p.submission_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.submission_id),
    'Mã gửi đơn không hợp lệ.');
  var customer = validateCustomer_(p);
  var lock = LockService.getScriptLock();
  assert_(lock.tryLock(12000), 'Hệ thống đang bận, vui lòng thử lại sau.');
  try {
    var sheet = sheet_(TAB_ORDERS);
    var rows = ordersValues_();
    var previous = findRow_(rows, 1, p.submission_id);
    if (previous) {
      assert_(String(previous[6]) === customer.phone, 'Mã gửi đơn đã được sử dụng.');
      return {ok:true, already_submitted:true,order_code:String(previous[0]),status:'pending'};
    }
    // Revalidate catalog and delivery terms server-side; ignore browser-provided prices.
    var calc = preview_(p);
    var area = area_(p);
    var code;
    do { code = 'HH' + Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase(); }
    while (findRow_(rows, 0, code));
    var values = [code,p.submission_id,Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      'pending','not_requested',customer.buyer,customer.phone,customer.email,customer.recipient,customer.recipientPhone,
      area.address,calc.delivery_date,calc.delivery_slot,customer.note,calc.subtotal,'',JSON.stringify(calc.items),
      area.districtCode,area.district,area.ward].map(safeCell_);
    sheet.appendRow(values);
    SpreadsheetApp.flush();
    return {ok:true,order_code:code,status:'pending',subtotal:calc.subtotal,delivery_fee:null,already_submitted:false};
  } finally { lock.releaseLock(); }
}
function lookup_(p) {
  var code = text_(p, 'order_code', 30, true).toUpperCase();
  assert_(/^HH[0-9A-F]{12}$/.test(code), 'Mã đơn không đúng định dạng.');
  var phone = phone_(p, 'buyer_phone');
  var found = findRow_(ordersValues_(), 0, code);
  if (!found || String(found[6]) !== phone)
    return {ok:false,error_code:'not_found',error:'Không tìm thấy đơn với mã và số điện thoại đã nhập.'};
  var fee = found[15] === '' || found[15] === null ? null : Number(found[15]);
  var subtotal = Number(found[14]);
  assert_(Number.isSafeInteger(subtotal) && (fee === null || (Number.isSafeInteger(fee) && fee >= 0)),
    'Dữ liệu tổng tiền chưa hợp lệ, hãy liên hệ shop.');
  var status = String(found[3] || 'pending'), payment = String(found[4] || 'not_requested');
  assert_(!!STATUSES[status] && !!PAYMENTS[payment], 'Trạng thái chưa hợp lệ, hãy liên hệ shop.');
  var rawDate = found[11] instanceof Date ? Utilities.formatDate(found[11], TIMEZONE, 'yyyy-MM-dd') : String(found[11]);
  return {ok:true,order_code:code,status:status,status_label:STATUSES[status],
    payment_status:payment,payment_label:PAYMENTS[payment],delivery_date:rawDate,
    delivery_slot:SLOTS[String(found[12])] || 'Chờ cập nhật',subtotal:subtotal,
    delivery_fee:fee,fee_pending:fee === null,total:fee === null ? null : subtotal+fee};
}
function doPost(e) {
  try {
    var text = e && e.postData && e.postData.contents;
    assert_(typeof text === 'string' && text.length <= 20000, 'Yêu cầu quá lớn.');
    var body = JSON.parse(text);
    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty('GAS_API_KEY');
    assert_(key && key.length >= 32 && body && body.key === key, 'Không có quyền truy cập.');
    var p = body.payload || {};
    assert_(p && typeof p === 'object' && !Array.isArray(p), 'Payload không hợp lệ.');
    if (body.action === 'products') return respond_({ok:true,products:readProducts_()});
    if (body.action === 'preview') return respond_(preview_(p));
    if (body.action === 'submit') return respond_(submit_(p));
    if (body.action === 'lookup') return respond_(lookup_(p));
    return respond_({ok:false,error:'Chức năng không tồn tại.'});
  } catch (ex) {
    console.error('HoaHoe Apps Script:', String(ex));
    return respond_({ok:false,error:String(ex && ex.message || 'Không xử lý được yêu cầu.')});
  }
}

/** Run ONE TIME after setting SHEET_ID in Script Properties.
 * Creates tabs (if missing) and seeds products only if the Products tab is new/empty.
 */
function setupHoaHoeSheets() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  assert_(!!id, 'Cần đặt SHEET_ID trong Script Properties trước.');
  var ss = SpreadsheetApp.openById(id);
  var products = ss.getSheetByName(TAB_PRODUCTS) || ss.insertSheet(TAB_PRODUCTS);
  var orders = ss.getSheetByName(TAB_ORDERS) || ss.insertSheet(TAB_ORDERS);
  if (products.getLastRow() === 0) {
    products.appendRow(PRODUCT_HEADERS);
    var seeds = seedProducts_();
    products.getRange(2,1,seeds.length,6).setValues(seeds);
    products.getRange(2,6,seeds.length,1).insertCheckboxes().check();
    products.setFrozenRows(1);
  }
  if (orders.getLastRow() === 0) {
    orders.appendRow(ORDER_HEADERS);
    orders.setFrozenRows(1);
    // Phone columns must retain leading 0; show identifiers as text.
    orders.getRange('G:G').setNumberFormat('@');
    orders.getRange('J:J').setNumberFormat('@');
    orders.getRange('L:L').setNumberFormat('@');
    orders.getRange('R:R').setNumberFormat('@');
    orders.getRange('D2:D').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(STATUSES), true).build());
    orders.getRange('E2:E').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(PAYMENTS), true).build());
  }
  SpreadsheetApp.flush();
  Logger.log('Ready. Tab Products: ' + products.getLastRow() + ' rows, Orders: ' + orders.getLastRow() + ' rows.');
}

function seedProducts_() {
  // Data from current Hoa Hoe frontend; edit Products sheet to update prices later.
  return [
    ['hoa-001','Midnight Romance',250000,'Bó hoa đỏ trầm kết hợp sắc kem.','img/product/hoa-01.webp',true],
    ['hoa-002','Sapphire Night',300000,'Bó hoa xanh sapphire nổi bật.','img/product/hoa-02.webp',true],
    ['hoa-003','Blush Reverie',300000,'Bó hoa tông hồng phấn nhẹ nhàng.','img/product/hoa-03.webp',true],
    ['hoa-004','Rosy Daydream',300000,'Bó hoa hồng pastel và trắng.','img/product/hoa-04.webp',true],
    ['hoa-005','Blush Bouquet',500000,'Bó hoa hồng phấn đầy đặn.','img/product/hoa-05.webp',true],
    ['hoa-006','Rosy Meadow',300000,'Sắc hồng trắng xanh tự nhiên.','img/product/hoa-06.webp',true],
    ['hoa-007','Pink Whisper',300000,'Bó hoa nhỏ sắc hồng dịu.','img/product/hoa-07.webp',true],
    ['hoa-008','Sweet Blush',250000,'Bó hoa hồng pastel có nơ.','img/product/hoa-08.webp',true],
    ['hoa-009','Lily Embrace',280000,'Bó hoa nhẹ nhàng, phù hợp quà tặng.','img/product/hoa-09.webp',true]
  ];
}
