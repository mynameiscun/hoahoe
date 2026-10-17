/* Hoa Hoe Sheets API — Cloudflare Pages Function.
 * Secrets: GAS_URL, GAS_API_KEY, TURNSTILE_SECRET_KEY. Never place in public JS or GitHub.
 * Public writes must be explicitly enabled via PUBLIC_ORDERS_ENABLED=true.
 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
function send(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function fail(reason, status) { return send({ok: false, error: reason}, status); }
const LEGACY_HCM_DISTRICT_CODES = new Set([
  '760','761','764','765','766','767','768','769','770','771','772','773',
  '774','775','776','777','778','783','784','785','786','787'
]);
const LEGACY_WARDS_SOURCE = 'tinhthanhpho.com (dữ liệu đơn vị hành chính trước 01/07/2025)';

async function getLegacyWards(request, ctx) {
  const url = new URL(request.url);
  const district = String(url.searchParams.get('district') || '');
  if (!LEGACY_HCM_DISTRICT_CODES.has(district))
    return fail('Quận/huyện không thuộc phạm vi TP.HCM cũ.', 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(url.origin + '/api/orders/areas/?district=' + district, {method:'GET'});
  if (cache) {
    try { const cached = await cache.match(cacheKey); if (cached) return cached; }
    catch (_) { /* Thu muc cache khong san sang */ }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    // Du lieu mo, khong can khoa API; chi tra ve HCMC cu (ma tinh 79).
    const remote = await fetch('https://www.tinhthanhpho.com/api/v1/districts/' + district + '/wards?limit=100&page=1', {
      headers: {'Accept':'application/json'}, signal:controller.signal
    });
    if (!remote.ok) throw new Error('Nguon du lieu khong kha dung');
    const raw = await remote.text();
    if (raw.length > 150000) throw new Error('Phan hoi vuot gioi han');
    const body = JSON.parse(raw);
    if (body.success !== true || !Array.isArray(body.data) || !body.data.length ||
        (body.metadata && Number(body.metadata.total) > body.data.length))
      throw new Error('Danh muc khong day du');
    const seen = new Set();
    const wards = [];
    for (const entry of body.data) {
      if (!entry || typeof entry !== 'object' ||
          (entry.district_code != null && String(entry.district_code) !== district) ||
          (entry.province_code != null && String(entry.province_code) !== '79')) continue;
      const code = String(entry.code || '');
      const name = String(entry.name || '').trim();
      const kind = String(entry.type || '').trim();
      if (!/^\d{4,8}$/.test(code) || !name || name.length > 90 || seen.has(code)) continue;
      seen.add(code);
      const label = /^(phường|xã|thị trấn)\s/i.test(name) ? name : (kind ? kind + ' ' + name : name);
      wards.push({code, name:label});
    }
    if (!wards.length) throw new Error('Khong co phuong xa');
    const result = {ok:true, district, wards, requires_manual_review:true, source:LEGACY_WARDS_SOURCE};
    const response = new Response(JSON.stringify(result), {
      headers: {'content-type':'application/json; charset=utf-8',
        'cache-control':'public, max-age=300', 'x-content-type-options':'nosniff'}
    });
    if (cache && ctx && ctx.waitUntil) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    }
    return response;
  } catch (_) {
    // Danh muc phu thuoc API mo: neu loi thi CHI cho nhap tay va Admin doi chieu.
    return fail('Chưa tải được phường/xã cũ; vui lòng nhập tay để shop kiểm tra.', 503);
  } finally { clearTimeout(timeout); }
}
const ROUTES = {
  'orders/areas': ['GET', 'areas'],
  'products': ['GET', 'products'],
  'orders/health': ['GET', 'health'],
  'payments/config': ['GET', 'payment_config'],
  'orders/preview': ['POST', 'preview'],
  'orders/submit': ['POST', 'submit'],
  'orders/paid-submit': ['POST', 'paid_submit'],
  'orders/lookup': ['POST', 'lookup']
};
async function verifyTurnstile(request, secret, token) {
  if (!secret || typeof token !== 'string' || token.length < 10 || token.length > 2048) return false;
  const values = new URLSearchParams({secret, response:token});
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) values.set('remoteip', ip);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: {'content-type':'application/x-www-form-urlencoded'},
      body: values.toString(), signal: controller.signal
    });
    const result = await response.json();
    // Bind Turnstile token to this website to reject tokens minted for unrelated websites.
    return response.ok && result.success === true && result.hostname === new URL(request.url).hostname;
  } catch (_) { return false; }
  finally { clearTimeout(timeout); }
}
export async function onRequest({ request, env, ctx }) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const entry = ROUTES[route];
  if (!entry) return fail('Không tìm thấy API.', 404);
  if (request.method !== entry[0]) return fail('Phương thức không được hỗ trợ.', 405);
  // Phuong/xa cu: du lieu dia gioi cong khai, khong truy cap Sheets/khong mo nhan don.
  if (route === 'orders/areas') return getLegacyWards(request, ctx);
  if (route === 'orders/submit') return fail('Endpoint dat don cu da tam khoa. Vui long cap nhat Checkout.', 410);
  // HOAHOE_DYNAMIC_QR_12_5F: public receiving account only (NO secrets or customer data).
  // The browser uses it to render VietQR with the current checkout total.
  if (route === 'payments/config') {
    if (env.PUBLIC_ORDERS_ENABLED !== 'true')
      return fail('Cửa hàng chưa mở nhận đơn trực tuyến.', 503);
    const bankId = String(env.PAYMENT_BANK_BIN || '').trim();
    const account = String(env.PAYMENT_BANK_ACCOUNT || '').trim();
    const accountName = String(env.PAYMENT_BANK_NAME || '').trim();
    if (!/^\d{6}$/.test(bankId) || !/^\d{6,19}$/.test(account) ||
        accountName.length < 3 || accountName.length > 80 ||
        /[\x00-\x1f]/.test(accountName))
      return fail('Shop chưa cấu hình thông tin ngân hàng nhận tiền.', 503);
    return send({ok:true,bank_bin:bankId,account_number:account,account_name:accountName});
  }
  const isReady = Boolean(env.GAS_URL && env.GAS_API_KEY && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY);
  const enabled = isReady && env.PUBLIC_ORDERS_ENABLED === 'true';
  if (route === 'orders/health') return send({
    ok: true, source: 'sheets', orders_enabled: enabled, public_orders_enabled: enabled,
    turnstile_site_key: isReady ? env.TURNSTILE_SITE_KEY : ''
  });
  if (!env.GAS_URL || !env.GAS_API_KEY) return fail('Chưa cấu hình nguồn dữ liệu Google Sheets.', 503);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(env.GAS_URL))
    return fail('Cấu hình Apps Script URL không hợp lệ.', 503);
  if (!enabled && route !== 'products') return fail('Chưa bật nhận đơn và tra cứu trên website.', 503);
  // Chỉ cache GET sản phẩm (dữ liệu công khai) tại Cloudflare trong 30 giây.
  // Preview/submit/lookup KHÔNG cache và luôn kiểm tra giá trực tiếp với Sheet.
  let catalogCache = null;
  let catalogKey = null;
  if (route === 'products' && typeof caches !== 'undefined' && caches.default) {
    try {
      catalogCache = caches.default;
      catalogKey = new Request(url.origin + '/api/products/', { method:'GET' });
      const hit = await catalogCache.match(catalogKey);
      if (hit) return send(await hit.json());
    } catch (_) { catalogCache = null; }
  }

  let payload = {};
  if (entry[0] === 'POST') {
    const origin = request.headers.get('origin');
    if (origin !== url.origin) return fail('Yêu cầu không hợp lệ.', 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json'))
      return fail('Chỉ nhận JSON.', 415);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20000) return fail('Dữ liệu vượt giới hạn.', 413);
    const body = await request.text();
    if (body.length > 20000) return fail('Dữ liệu vượt giới hạn.', 413);
    try { payload = JSON.parse(body); } catch (_) { return fail('JSON không hợp lệ.', 400); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Dữ liệu không hợp lệ.', 400);
    if (route === 'orders/submit' || route === 'orders/paid-submit' || route === 'orders/lookup') {
      const token = payload.turnstile_token;
      if (!await verifyTurnstile(request, env.TURNSTILE_SECRET_KEY, token))
        return fail('Vui lòng xác minh bạn không phải robot rồi thử lại.', 403);
    }
    delete payload.turnstile_token;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const upstream = await fetch(env.GAS_URL, {
      method: 'POST', headers: {'content-type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({key: env.GAS_API_KEY, action: entry[1], payload}),
      redirect: 'follow', signal: controller.signal
    });
    if (!upstream.ok) return fail('Google Sheets chưa phản hồi. Hãy thử lại sau.', 502);
    const raw = await upstream.text();
    if (raw.length > 250000) return fail('Phản hồi từ Sheets vượt giới hạn.', 502);
    let output;
    try { output = JSON.parse(raw); } catch (_) { return fail('Google Sheets trả dữ liệu không hợp lệ.', 502); }
    if (!output || typeof output !== 'object' || typeof output.ok !== 'boolean')
      return fail('Phản hồi từ Sheets không hợp lệ.', 502);
    // Chỉ cung cấp thông tin ngân hàng cho đơn tra cứu hợp lệ, đã được
    // Admin xác nhận phí và chuyển sang Chờ chuyển khoản.
    if (route === 'orders/lookup' && output.ok === true &&
        output.status === 'confirmed' && output.payment_status === 'awaiting_transfer' &&
        output.payment_reported !== true &&
        output.fee_pending === false && Number.isSafeInteger(output.delivery_fee) && output.delivery_fee >= 0 &&
        Number.isSafeInteger(output.subtotal) && output.subtotal > 0 &&
        Number.isSafeInteger(output.total) && output.total === output.subtotal + output.delivery_fee &&
        /^HH[0-9A-F]{12}$/.test(String(output.order_code || ''))) {
      const bankId = String(env.PAYMENT_BANK_BIN || '').trim();
      const account = String(env.PAYMENT_BANK_ACCOUNT || '').trim();
      const accountName = String(env.PAYMENT_BANK_NAME || '').trim();
      if (/^\d{6}$/.test(bankId) && /^\d{6,19}$/.test(account) &&
          accountName.length >= 3 && accountName.length <= 80 && !/[\x00-\x1f]/.test(accountName)) {
        output.payment_instructions = {
          bank_bin: bankId, account_number: account, account_name: accountName,
          amount: output.total, transfer_content: output.order_code
        };
      }
    }
    const status = !output.ok ? (output.error_code === 'not_found' ? 404 : 400) : 200;
    if (route === 'products' && output.ok && catalogCache && catalogKey && ctx && ctx.waitUntil) {
      const cacheResponse = new Response(JSON.stringify(output), {
        headers: {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30'}
      });
      ctx.waitUntil(catalogCache.put(catalogKey, cacheResponse).catch(() => {}));
    }
    return send(output, status);
  } catch (_) { return fail('Không liên lạc được Google Sheets. Nếu đã gửi đơn, hãy tra cứu trước khi gửi lại.', 502); }
  finally { clearTimeout(timeout); }
}
