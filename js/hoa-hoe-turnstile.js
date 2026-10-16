/* Shared Cloudflare Turnstile helper. Runs only on Pages checkout/tracking. */
(function () {
  'use strict';
  let loading;
  function load() {
    if (window.turnstile) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      el.async = true;
      el.onload = () => {
        const start = Date.now();
        function check() {
          if (window.turnstile) return resolve();
          if (Date.now() - start > 3000) return reject(new Error('Không tải được xác minh Turnstile.'));
          setTimeout(check, 60);
        }
        check();
      };
      el.onerror = () => reject(new Error('Không tải được xác minh Turnstile.'));
      document.head.appendChild(el);
    });
    return loading;
  }
  async function mount(container, sitekey, onChange) {
    if (!sitekey || !/^[a-zA-Z0-9._-]{5,80}$/.test(sitekey)) throw new Error('Thiếu Turnstile site key.');
    await load();
    let token = '';
    const widgetId = window.turnstile.render(container, {
      sitekey,
      callback: value => { token = value; onChange(value); },
      'expired-callback': () => { token = ''; onChange(''); },
      'error-callback': () => { token = ''; onChange(''); }
    });
    return {getToken: () => token, reset: () => { token = ''; onChange(''); window.turnstile.reset(widgetId); }};
  }
  window.HOA_HOE_TURNSTILE = {mount};
}());
