// === SETTINGS: Вкажіть ваші контакти тут один раз ===
const COMPANY_PHONE_E164 = "+48796457505"; // приклад: "+48500111222"
const WHATSAPP_NUMBER = COMPANY_PHONE_E164.replace(/^\+/, ""); // wa.me приймає без плюса
const VIBER_NUMBER = encodeURIComponent("+" + WHATSAPP_NUMBER); // viber потребує + та URL-encoding
const TELEGRAM_HANDLE = "photo_fox_22"; // без @

// Підставляємо у кнопки швидкого зв'язку
const waLink = document.getElementById("waLink");
const viberLink = document.getElementById("viberLink");
const tgLink = document.getElementById("tgLink");
const callLink = document.getElementById("callLink");

waLink.href = `https://wa.me/${WHATSAPP_NUMBER}`;
// viberLink.href = `viber://chat?number=%2B${WHATSAPP_NUMBER}`;
viberLink.href = `viber://chat?number=${WHATSAPP_NUMBER}`;
tgLink.href = `https://t.me/${TELEGRAM_HANDLE}`;
callLink.href = `tel:${COMPANY_PHONE_E164}`;

// Валідація та відправка форми
const form = document.getElementById("contactForm");
const success = document.getElementById("success");
const error = document.getElementById("error");

// === NEW: утиліти ===
function hide(el){ if(el) el.style.display = "none"; }
function show(el,msg){ if(!el) return; if(msg!==undefined) el.textContent = msg; el.style.display = "block"; }

function normalizePhone(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/\s+/g,'').replace(/[()\-.]/g,'');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+') && /^\d+$/.test(s)) return s; // дозволяємо чисті цифри
  s = s.replace(/(?!^)\+/g,'').replace(/[^\d+]/g,'');
  return s;
}

// === NEW: дістаємо токен Turnstile з hidden input, який додає віджет ===
function getTurnstileToken() {
  const input = form.querySelector('input[name="cf-turnstile-response"]');
  return input?.value || '';
}

// === NEW: зручна відправка JSON з таймаутом ===
async function postJSON(url, payload, timeoutMs = 20000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: c.signal
    });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const body = isJson ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(success);
  hide(error);

  if (!form.checkValidity()) {
    show(error, "Проверьте, пожалуйста, обязательные поля, отмеченные звёздочкой *");
    return;
  }

  // Збираємо дані
  const data = Object.fromEntries(new FormData(form).entries());

  // === CHANGED: нормалізуємо телефон (раніше phoneNormalized був не оголошений)
  const phoneNormalized = normalizePhone(data.phone);

  const payload = {
    phone: phoneNormalized,
    name: data.name || "",
    email: data.email || "",
    country: data.country || "",
    citizenship: data.citizenship || "",
    age: data.age || "",
    gender: data.gender || "",
    position: data.position || "",
    message: data.message || "",
    submittedAt: new Date().toISOString(),
    source: location.href,
    // === NEW: додаємо токен Turnstile для перевірки на сервері
    turnstileToken: getTurnstileToken()
  };

  // Мінімальна перевірка номера
  if (!payload.phone || payload.phone.replace(/[^\d]/g,'').length < 7) {
    show(error, "Укажите корректный номер телефона.");
    return;
  }

  // === NEW: СПРОБА №1 — надсилаємо на ваш бот-сервер
  try {
    const { ok, status, body } = await postJSON("/api/lead", payload, 20000);
    if (ok && body && body.ok) {
      show(success, "Спасибо! Заявка отправлена. Мы свяжемся с вами в ближайшее время.");
      form.reset();
      // скидаємо капчу на новий сабміт
      if (window.turnstile?.reset) try { window.turnstile.reset(); } catch(_) {}
      return;
    } else {
      // якщо сервер відповів помилкою — покажемо повідомлення і підемо у fallback
      const msg = (body && (body.error || body.message)) || `Ошибка сервера (${status}).`;
      show(error, msg);
    }
  } catch (err) {
    console.error("[lead] post failed:", err);
    // впадемо у fallback нижче
  }
});

// === COOKIE CONSENT ===
const cookieBanner = document.getElementById("cookie-banner");
const btnAccept = document.getElementById("cookie-accept");
const btnDecline = document.getElementById("cookie-decline");

function hideCookieBanner() {
  cookieBanner.style.display = "none";
}
function showCookieBanner() {
  cookieBanner.style.display = "block";
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days*864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];
}

if (!getCookie("cookieConsent")) {
  showCookieBanner();
}

btnAccept?.addEventListener("click", () => {
  setCookie("cookieConsent", "accepted", 365);
  hideCookieBanner();
});

btnDecline?.addEventListener("click", () => {
  setCookie("cookieConsent", "declined", 365);
  hideCookieBanner();
});