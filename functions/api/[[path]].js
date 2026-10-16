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
const ROUTES = {
  'products': ['GET', 'products'],
  'orders/health': ['GET', 'health'],
  'orders/preview': ['POST', 'preview'],
  'orders/submit': ['POST', 'submit'],
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
    if (route === 'orders/submit' || route === 'orders/lookup') {
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
