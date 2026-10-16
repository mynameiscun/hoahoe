/**
 * HoaHoe Admin 12.3 — private, STANDALONE Apps Script project.
 * DO NOT paste into the publicly accessible Sheets API project.
 * Deploy: Execute as Me, Who has access: Only myself.
 * Script Properties: SHEET_ID and ADMIN_ACCESS_KEY (random >= 24 chars).
 * Do not configure this admin project with GAS_API_KEY, do not expose it via Cloudflare.
 */
var HH_TZ = 'Asia/Ho_Chi_Minh';
var HH_PRODUCTS = 'Products';
var HH_ORDERS = 'Orders';
var HH_AUDIT = 'AdminAudit';
var HH_PRODUCT_HEADERS = ['code','name','price','description','image','active'];
var HH_ORDER_HEADERS = [
  'order_code','submission_id','created_at','status','payment_status',
  'customer_name','customer_phone','customer_email','recipient_name','recipient_phone',
  'delivery_address','delivery_date','delivery_slot','note','subtotal','delivery_fee','items_json',
  'delivery_district_code','delivery_district_name','delivery_ward_name'
];
var HH_STATUSES = {pending:'Chờ xác nhận',confirmed:'Đã xác nhận',rejected:'Từ chối',completed:'Hoàn thành',cancelled:'Đã hủy'};
var HH_PAYMENTS = {not_requested:'Chưa yêu cầu thanh toán',awaiting_transfer:'Chờ chuyển khoản',paid:'Đã thanh toán'};
var HH_AUDIT_HEADERS = ['timestamp','actor','entity','entity_id','action','before_json','after_json'];
var HH_SESSION_SECONDS = 30 * 60;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin').setTitle('HoaHoè · Quản lý cửa hàng')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function hhRequire_(condition, message) {
  if (!condition) throw new Error(message);
}
function hhText_(input, label, max, required) {
  hhRequire_(typeof input === 'string', label + ' phải là chuỗi.');
  var text = input.trim();
  hhRequire_(text.length <= max && (!required || text.length > 0), label + ' không hợp lệ.');
  hhRequire_(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text), label + ' chứa ký tự không hợp lệ.');
  return text;
}
function hhSafeCell_(value) {
  var s = String(value == null ? '' : value);
  return /^[\s]*[=+@\-\t\r]/.test(s) ? "'" + s : s;
}
function hhLock_() {
  var lock = LockService.getScriptLock();
  hhRequire_(lock.tryLock(12000), 'Có thao tác khác đang xử lý, hãy thử lại.');
  return lock;
}
function hhSheet_(tab, headers) {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  hhRequire_(id && id.length > 10, 'Chưa cấu hình SHEET_ID trong Admin Script Properties.');
  var spreadsheet = SpreadsheetApp.openById(id);
  var sh = spreadsheet.getSheetByName(tab);
  hhRequire_(!!sh, 'Không tìm thấy tab ' + tab + ' trong Google Sheets.');
  if (headers) {
    var actual = sh.getRange(1,1,1,headers.length).getValues()[0];
    hhRequire_(actual.join('|') === headers.join('|'), 'Sai cấu trúc cột tab ' + tab + '. Không chỉnh cột thủ công.');
  }
  return sh;
}
function hhAuthorize_(token) {
  hhRequire_(typeof token === 'string' && /^[a-f0-9-]{64,80}$/i.test(token), 'Phiên quản trị không hợp lệ. Hãy đăng nhập lại.');
  var cache = CacheService.getScriptCache();
  hhRequire_(cache.get('hoahoe_admin_' + token) === 'yes', 'Phiên quản trị hết hạn. Hãy đăng nhập lại.');
  cache.put('hoahoe_admin_' + token, 'yes', HH_SESSION_SECONDS);
}
/** Run once inside the private Admin project to authorize spreadsheet access. No data is modified. */
function adminPreflight() {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_ACCESS_KEY');
  hhRequire_(key && key.length >= 24, 'Chưa cấu hình ADMIN_ACCESS_KEY ít nhất 24 ký tự.');
  var products = hhSheet_(HH_PRODUCTS, HH_PRODUCT_HEADERS);
  var orders = hhSheet_(HH_ORDERS, HH_ORDER_HEADERS);
  var summary = {ok:true, products:Math.max(0,products.getLastRow()-1),
    orders:Math.max(0,orders.getLastRow()-1)};
  Logger.log(JSON.stringify(summary));
  return summary;
}
function adminLogin(secret) {
  var configured = PropertiesService.getScriptProperties().getProperty('ADMIN_ACCESS_KEY');
  hhRequire_(configured && configured.length >= 24, 'Chưa thiết lập ADMIN_ACCESS_KEY (ít nhất 24 ký tự).');
  hhRequire_(typeof secret === 'string' && secret === configured, 'Mã quản trị không đúng.');
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('hoahoe_admin_' + token,'yes',HH_SESSION_SECONDS);
  return {token:token,expires_minutes:30};
}
function adminLogout(token) {
  if (typeof token === 'string' && /^[a-f0-9-]{64,80}$/i.test(token))
    CacheService.getScriptCache().remove('hoahoe_admin_' + token);
  return {ok:true};
}
function hhDate_(value) {
  return value instanceof Date ? Utilities.formatDate(value, HH_TZ, 'yyyy-MM-dd HH:mm:ss') : String(value == null ? '' : value);
}
function hhOrderRevision_(row) {
  return JSON.stringify([String(row[3] || ''),String(row[4] || ''),String(row[15] == null ? '' : row[15])]);
}
function hhOrdersRaw_() {
  var sh = hhSheet_(HH_ORDERS, HH_ORDER_HEADERS);
  if (sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2,1,sh.getLastRow()-1,HH_ORDER_HEADERS.length).getValues();
  return rows.map(function(row,i){return {row:row,number:i+2};});
}
function hhOrderLite_(rec) {
  var r = rec.row;
  return {code:String(r[0]||''),created_at:hhDate_(r[2]),status:String(r[3]||''),
    payment_status:String(r[4]||''),customer_name:String(r[5]||''),
    customer_phone_hint:String(r[6]||'').replace(/.(?=.{3})/g,'•'),
    delivery_date:hhDate_(r[11]).slice(0,10),subtotal:Number(r[14])||0,
    delivery_fee:r[15]===''||r[15]===null?null:Number(r[15])};
}
function hhOrderDetail_(rec) {
  var r=rec.row, lines=[];
  try {lines=JSON.parse(String(r[16]||'[]'));} catch (_) {lines=[];}
  if (!Array.isArray(lines)) lines=[];
  return {code:String(r[0]||''),created_at:hhDate_(r[2]),status:String(r[3]||''),
    payment_status:String(r[4]||''),customer_name:String(r[5]||''),customer_phone:String(r[6]||''),
    customer_email:String(r[7]||''),recipient_name:String(r[8]||''),recipient_phone:String(r[9]||''),
    address:String(r[10]||''),delivery_date:hhDate_(r[11]).slice(0,10),
    delivery_slot:String(r[12]||''),note:String(r[13]||''),subtotal:Number(r[14])||0,
    delivery_fee:r[15]===''||r[15]===null?null:Number(r[15]),items:lines,
    revision:hhOrderRevision_(r)};
}
function adminListOrders(token, options) {
  hhAuthorize_(token);
  options=options||{};
  var status=String(options.status||'all');
  hhRequire_(status==='all'||Object.prototype.hasOwnProperty.call(HH_STATUSES,status), 'Trạng thái lọc không hợp lệ.');
  var query=String(options.query||'').trim().toLowerCase().slice(0,100);
  var all=hhOrdersRaw_();
  var counts={all:all.length,pending:0,confirmed:0,rejected:0,completed:0,cancelled:0};
  all.forEach(function(rec){var status=String(rec.row[3]||'');if (Object.prototype.hasOwnProperty.call(counts,status)) counts[status]++;});
  var list=all.filter(function(rec){
    var r=rec.row;
    if (status!=='all' && String(r[3])!==status) return false;
    if (!query) return true;
    return [r[0],r[5],r[6],r[8],r[9]].some(function(v){return String(v||'').toLowerCase().indexOf(query)>=0;});
  }).reverse();
  var limit=100;
  return {ok:true,counts:counts,total_matches:list.length,orders:list.slice(0,limit).map(hhOrderLite_),limit:limit};
}
function adminGetOrder(token,code) {
  hhAuthorize_(token);
  var id=hhText_(code,'Mã đơn',24,true);
  hhRequire_(/^HH[0-9A-F]{12}$/.test(id), 'Mã đơn không hợp lệ.');
  var found=hhOrdersRaw_().filter(function(rec){return String(rec.row[0])===id;})[0];
  hhRequire_(!!found,'Không tìm thấy đơn hàng.');
  return {ok:true,order:hhOrderDetail_(found)};
}
function hhAllProducts_() {
  var sh=hhSheet_(HH_PRODUCTS,HH_PRODUCT_HEADERS);
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,6).getValues().map(function(r,i){
    return {row_number:i+2,code:String(r[0]||''),name:String(r[1]||''),price:Number(r[2])||0,
      description:String(r[3]||''),image:String(r[4]||''),active:r[5]===true||String(r[5]).toLowerCase()==='true'};
  }).filter(function(p){return !!p.code;});
}
function adminListProducts(token) {
  hhAuthorize_(token);
  return {ok:true,products:hhAllProducts_()};
}
function hhAudit_(entity,id,action,before,after) {
  var ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var sh=ss.getSheetByName(HH_AUDIT);
  if(!sh){sh=ss.insertSheet(HH_AUDIT);sh.appendRow(HH_AUDIT_HEADERS);sh.setFrozenRows(1);}
  var actor=Session.getEffectiveUser().getEmail()||'owner';
  sh.appendRow([Utilities.formatDate(new Date(),HH_TZ,'yyyy-MM-dd HH:mm:ss'),actor,
    entity,id,action,JSON.stringify(before),JSON.stringify(after)].map(hhSafeCell_));
}
function adminSaveProduct(token,form) {
  hhAuthorize_(token);
  hhRequire_(form && typeof form==='object'&&!Array.isArray(form),'Dữ liệu sản phẩm không hợp lệ.');
  var name=hhText_(form.name,'Tên hoa',150,true);
  var description=hhText_(form.description||'','Mô tả',1000,false);
  var image=hhText_(form.image||'','Đường dẫn ảnh',250,false);
  hhRequire_(!image || /^\/?img\/(product|catalog)\/[a-zA-Z0-9_.-]+\.(webp|png|jpg|jpeg)$/.test(image),
    'Ảnh phải nằm trong img/product/ hoặc img/catalog/ trên website.');
  var price=Number(form.price);
  hhRequire_(Number.isSafeInteger(price) && price>0 && price<2000000000,'Giá phải là số nguyên dương nhỏ hơn 2 tỷ.');
  hhRequire_(typeof form.active==='boolean','Trạng thái còn bán không hợp lệ.');
  var code=String(form.code||'').trim();
  hhRequire_(!code||/^hoa-[0-9]{3,5}$/.test(code),'Mã hoa không hợp lệ.');
  var lock=hhLock_();
  try {
    var products=hhAllProducts_(), sheet=hhSheet_(HH_PRODUCTS,HH_PRODUCT_HEADERS);
    var before=null,idx=-1,action='update';
    if(!code){
      var max=0;
      products.forEach(function(p){var n=Number(p.code.slice(4));if(n>max)max=n;});
      hhRequire_(max<99999,'Đã đạt giới hạn mã sản phẩm.');
      code='hoa-'+String(max+1).padStart(3,'0');
      action='create';
    } else {
      for(var j=0;j<products.length;j++) if(products[j].code===code){idx=products[j].row_number;before=products[j];break;}
      hhRequire_(idx>0,'Không tìm thấy mã sản phẩm để cập nhật.');
    }
    hhRequire_(products.length<100 || action==='update', 'Tối đa 100 sản phẩm đang quản lý.');
    var data=[code,hhSafeCell_(name),price,hhSafeCell_(description),image,form.active];
    if(action==='create') sheet.appendRow(data);
    else sheet.getRange(idx,1,1,6).setValues([data]);
    SpreadsheetApp.flush();
    var result={code:code,name:name,price:price,description:description,image:image,active:form.active};
    hhAudit_('product',code,action,before,result);
    return {ok:true,product:result,created:action==='create'};
  } finally {lock.releaseLock();}
}
function adminUpdateOrder(token,changes) {
  hhAuthorize_(token);
  hhRequire_(changes&&typeof changes==='object','Dữ liệu đơn không hợp lệ.');
  var code=String(changes.code||'').trim();
  hhRequire_(/^HH[0-9A-F]{12}$/.test(code),'Mã đơn không hợp lệ.');
  var status=String(changes.status||'');
  var payment=String(changes.payment_status||'');
  hhRequire_(Object.prototype.hasOwnProperty.call(HH_STATUSES,status),'Trạng thái đơn không hợp lệ.');
  hhRequire_(Object.prototype.hasOwnProperty.call(HH_PAYMENTS,payment),'Trạng thái thanh toán không hợp lệ.');
  var feeRaw=String(changes.delivery_fee==null?'':changes.delivery_fee).trim();
  hhRequire_(feeRaw===''||/^(0|[1-9][0-9]{0,8})$/.test(feeRaw),'Phí giao phải để trống hoặc là số nguyên từ 0 đến 999.999.999.');
  var fee=feeRaw===''?'':Number(feeRaw);
  hhRequire_(typeof changes.expected_revision==='string','Thiếu mã phiên bản đơn. Hãy tải lại.');
  var lock=hhLock_();
  try {
    var sh=hhSheet_(HH_ORDERS,HH_ORDER_HEADERS);
    var rows=hhOrdersRaw_();
    var rec=rows.filter(function(item){return String(item.row[0])===code;})[0];
    hhRequire_(!!rec,'Không tìm thấy đơn.');
    hhRequire_(hhOrderRevision_(rec.row)===changes.expected_revision,
      'Đơn đã thay đổi ở nơi khác. Hãy làm mới trước khi lưu.');
    var before={status:String(rec.row[3]||''),payment_status:String(rec.row[4]||''),delivery_fee:rec.row[15]===''?'':Number(rec.row[15])};
    sh.getRange(rec.number,4,1,2).setValues([[status,payment]]);
    sh.getRange(rec.number,16).setValue(fee);
    SpreadsheetApp.flush();
    var after={status:status,payment_status:payment,delivery_fee:fee};
    hhAudit_('order',code,'update',before,after);
    rec.row[3]=status;rec.row[4]=payment;rec.row[15]=fee;
    return {ok:true,order:hhOrderDetail_(rec)};
  } finally {lock.releaseLock();}
}


/**
 * Step 12.4.5 — upload ảnh lên repository Cloudflare Pages (private Admin ONLY).
 * Script Properties (chỉ trong dự án Admin):
 * GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (main), GITHUB_TOKEN.
 * Repo mặc định có thư mục public/ => public/img/product/.
 * Không dùng API khách và tuyệt đối không xuất token ra trình duyệt.
 */
function adminUploadProductImage(token, upload) {
  hhAuthorize_(token);
  hhRequire_(upload && typeof upload === 'object' && !Array.isArray(upload), 'Thiếu thông tin ảnh.');
  var base64 = upload.base64;
  var mime = upload.mime;
  hhRequire_(typeof base64 === 'string' && base64.length > 0 && base64.length <= 3900000 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(base64), 'Ảnh vượt giới hạn hoặc nội dung không hợp lệ.');
  hhRequire_(mime === 'image/webp' || mime === 'image/jpeg' || mime === 'image/png', 'Chỉ nhận JPG, PNG, WebP.');
  var bytes = Utilities.base64Decode(base64);
  hhRequire_(bytes.length > 0 && bytes.length <= 2500000, 'Ảnh tối đa 2,5 MB sau khi tối ưu.');
  var unsigned = function (index) { return bytes[index] & 255; };
  var jpeg = bytes.length > 4 && unsigned(0) === 255 && unsigned(1) === 216 && unsigned(2) === 255;
  var png = bytes.length > 8 && [137,80,78,71,13,10,26,10].every(function (v,i) {return unsigned(i) === v;});
  var webp = bytes.length > 12 && [82,73,70,70].every(function(v,i){return unsigned(i)===v;}) &&
    [87,69,66,80].every(function(v,i){return unsigned(i+8)===v;});
  hhRequire_((mime === 'image/jpeg' && jpeg) || (mime === 'image/png' && png) ||
    (mime === 'image/webp' && webp), 'Định dạng tệp thực tế không khớp loại ảnh.');

  var props = PropertiesService.getScriptProperties();
  var owner = String(props.getProperty('GITHUB_OWNER') || '').trim();
  var repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  var branch = String(props.getProperty('GITHUB_BRANCH') || 'main').trim();
  var secret = String(props.getProperty('GITHUB_TOKEN') || '').trim();
  var prefix = String(props.getProperty('GITHUB_UPLOAD_PREFIX') || 'public/img/product').trim().replace(/\/$/,'');
  hhRequire_(/^[a-zA-Z0-9-]{1,39}$/.test(owner) && /^[a-zA-Z0-9._-]{1,100}$/.test(repo),
    'Chưa cấu hình GITHUB_OWNER hoặc GITHUB_REPO hợp lệ trong Script Properties.');
  hhRequire_(/^[a-zA-Z0-9._/-]{1,150}$/.test(branch) && branch.indexOf('..') < 0 && branch[0] !== '/',
    'GITHUB_BRANCH không hợp lệ.');
  hhRequire_(secret.length >= 20, 'Chưa cấu hình GITHUB_TOKEN trong Script Properties.');
  hhRequire_(prefix === 'public/img/product' || prefix === 'img/product',
    'GITHUB_UPLOAD_PREFIX chỉ được là public/img/product hoặc img/product.');

  var ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  var unique = String(Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  var stamp = Utilities.formatDate(new Date(), HH_TZ, 'yyyyMMdd');
  var basename = 'hh-' + stamp + '-' + unique + '.' + ext;
  var path = prefix + '/' + basename;
  var url = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' +
    encodeURIComponent(repo) + '/contents/' + path;
  var payload = {
    message: 'Upload product image ' + basename,
    content: base64,
    branch: branch
  };
  var response = UrlFetchApp.fetch(url, {
    method: 'put', contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + secret,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });
  var status = response.getResponseCode();
  hhRequire_(status === 201, 'GitHub trả mã ' + status +
    '. Kiểm tra tên repo, nhánh và quyền Contents (Read and write) của token.');
  var result = {};
  try { result = JSON.parse(response.getContentText()); } catch (_) { /* no-op */ }
  hhRequire_(result.content && result.content.path === path,
    'GitHub phản hồi thiếu đường dẫn ảnh. Kiểm tra commit trong repository trước khi tải lại.');
  return {
    ok: true,
    path: 'img/product/' + basename,
    github_path: path,
    note: 'Ảnh đã ghi vào GitHub. Chờ Cloudflare deploy xong và bấm Lưu sản phẩm để cập nhật Google Sheets.'
  };
}
