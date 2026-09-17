function api(path) { return (window.API_BASE || '') + path; }
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => t.classList.remove('show'), 3500);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
// تبدیل تاریخ میلادی ذخیره‌شده در دیتابیس به شمسی
function toPersianDate(input, withTime) {
    if (!input) return '';
    const d = new Date(String(input).replace(' ', 'T') + 'Z');
    if (isNaN(d)) return input;
    const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
    let gy = d.getUTCFullYear(), gm = d.getUTCMonth() + 1, gd = d.getUTCDate();
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    const pad = n => String(n).padStart(2, '0');
    let out = `${jy}/${pad(jm)}/${pad(jd)}`;
    if (withTime) out += ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    return out;
}

function getToken() { return localStorage.getItem('companyToken'); }
function setToken(t) { localStorage.setItem('companyToken', t); }
function clearToken() { localStorage.removeItem('companyToken'); }

async function apiGet(path, auth) {
    const headers = auth ? { Authorization: 'Bearer ' + getToken() } : {};
    const res = await fetch(api(path), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error || 'خطا') + (data.detail ? ' — ' + data.detail : ''));
    return data;
}
async function apiSend(method, path, body, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer ' + getToken();
    const res = await fetch(api(path), { method, headers, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error || 'خطا') + (data.detail ? ' — ' + data.detail : ''));
    return data;
}

// ------------------------------------------------------------------
// ناوبری بین صفحات ورود/ثبت‌نام
// ------------------------------------------------------------------
function showScreen(id) {
    const flexScreens = ['authEntry', 'mapScreen'];
    ['authEntry', 'mapScreen', 'regScreen', 'loginScreen', 'dashboardMain'].forEach(s => {
        const el = document.getElementById(s);
        if (!el) return;
        if (s === 'loginScreen') { el.classList.toggle('show', s === id); }
        else { el.style.display = (s === id) ? (flexScreens.includes(s) ? 'flex' : 'block') : 'none'; }
    });
    document.getElementById('mainHeader').style.display = (id === 'dashboardMain') ? 'block' : 'none';
}
function goLogin() { showScreen('loginScreen'); }
function goBack(fromId, toId) { showScreen(toId); }

// ------------------------------------------------------------------
// نقشه‌ی ثبت موقعیت کارخانه هنگام ثبت‌نام (با جستجوی آدرس مثل گوگل‌مپ)
// ------------------------------------------------------------------
const MARKAZI_CENTER = [34.35, 49.9];
const MARKAZI_COUNTIES = ['اراک', 'ساوه', 'خمین', 'محلات', 'دلیجان', 'شازند', 'تفرش', 'آشتیان', 'خنداب', 'فراهان', 'کمیجان', 'زرندیه'];
let regMapInstance = null, regMarker = null, pendingLat = null, pendingLng = null, searchDebounce = null;
let pendingCounty = '', pendingIndustrialZone = null;
let zonesCache = [], zonesLoaded = false;

// ------------------------------------------------------------------
// سوییچ بین «روی نقشه» و «از لیست شهرک‌های صنعتی»
// ------------------------------------------------------------------
function setLocationMode(mode) {
    const isZone = mode === 'zone';
    document.getElementById('modeMapBtn').classList.toggle('active', !isZone);
    document.getElementById('modeZoneBtn').classList.toggle('active', isZone);
    document.getElementById('zoneListPanel').style.display = isZone ? 'flex' : 'none';
    document.getElementById('mapSearchBar').style.display = isZone ? 'none' : 'flex';
    document.getElementById('mapBottomBar').style.display = isZone ? 'none' : 'block';
    document.getElementById('zoneBottomBar').style.display = isZone ? 'block' : 'none';
    document.getElementById('modeTagline').textContent = isZone
        ? 'شهرک یا ناحیهٔ صنعتی محل کارخانه را از لیست انتخاب کنید'
        : 'آدرس را جستجو کنید یا روی نقشه کلیک کنید';
    if (isZone && !zonesLoaded) loadIndustrialZones();
    if (!isZone && regMapInstance) setTimeout(() => regMapInstance.invalidateSize(), 50);
}

async function loadIndustrialZones() {
    const sel = document.getElementById('zoneSelect');
    try {
        zonesCache = await apiGet('/api/industrial-zones');
        zonesLoaded = true;
        if (!zonesCache.length) { sel.innerHTML = '<option value="">فهرستی ثبت نشده</option>'; return; }
        const byCounty = {};
        zonesCache.forEach(z => { (byCounty[z.county] = byCounty[z.county] || []).push(z); });
        sel.innerHTML = '<option value="">— انتخاب کنید —</option>' + Object.keys(byCounty).map(county =>
            `<optgroup label="${esc(county)}">${byCounty[county].map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('')}</optgroup>`
        ).join('');
    } catch (e) {
        sel.innerHTML = '<option value="">خطا در بارگذاری فهرست</option>';
    }
}

function confirmZoneSelection() {
    const sel = document.getElementById('zoneSelect');
    const zone = zonesCache.find(z => String(z.id) === sel.value);
    if (!zone) { showToast('یک شهرک صنعتی را از لیست انتخاب کنید', 'error'); return; }
    pendingIndustrialZone = zone.name;
    pendingCounty = zone.county;
    pendingLat = null; pendingLng = null; // مختصات دقیق این شهرک ثبت نشده؛ کاربر می‌تواند بعداً از پنل، پین دقیق را هم اضافه کند
    showScreen('regScreen');
}

// حدس شهرستان از روی مختصات، با استفاده از همان جواب Nominatim (best-effort)
function guessCountyFromAddress(addr) {
    if (!addr) return '';
    const candidates = [addr.county, addr.state_district, addr.city, addr.town, addr.city_district].filter(Boolean);
    for (const c of candidates) {
        const hit = MARKAZI_COUNTIES.find(name => c.includes(name));
        if (hit) return hit;
    }
    return '';
}

function goMapScreen() {
    showScreen('mapScreen');
    setLocationMode('map');
    setTimeout(() => {
        if (!regMapInstance) {
            regMapInstance = L.map('regMap', { zoomControl: false }).setView(MARKAZI_CENTER, 9);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(regMapInstance);
            regMapInstance.on('click', (e) => placeRegMarker(e.latlng.lat, e.latlng.lng));
            // پرواز آرام و باحس صنعتی به‌جای پرش ناگهانی
            setTimeout(() => regMapInstance.flyTo(MARKAZI_CENTER, 10, { duration: 3.2, easeLinearity: 0.15 }), 400);
        } else {
            regMapInstance.invalidateSize();
        }
    }, 60);
}

function placeRegMarker(lat, lng, label) {
    pendingLat = lat; pendingLng = lng;
    pendingIndustrialZone = null; // پین دستی جایگزین انتخاب شهرک می‌شود
    if (regMarker) regMapInstance.removeLayer(regMarker);
    const factoryIcon = L.divIcon({
        className: 'factory-pin',
        html: '<div style="font-size:2.2rem; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));">🏭</div>',
        iconSize: [40, 40], iconAnchor: [20, 36],
    });
    regMarker = L.marker([lat, lng], { icon: factoryIcon }).addTo(regMapInstance);
    document.getElementById('mapPlaceName').textContent = label || 'موقعیت انتخاب‌شده روی نقشه';
    document.getElementById('mapPlaceCoords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('mapConfirmBox').classList.add('show');
    document.getElementById('mapHint').style.display = 'none';
    guessCountyFromCoords(lat, lng);
}

// حدس شهرستان از روی مختصات (best-effort، خطا یا نتیجهٔ خالی مشکلی ایجاد نمی‌کند)
async function guessCountyFromCoords(lat, lng) {
    pendingCounty = '';
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=fa&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        pendingCounty = guessCountyFromAddress(data.address);
    } catch (e) { /* اگر نشد، کاربر خودش بعداً از پنل شهرستان را انتخاب می‌کند */ }
}

function useGps() {
    if (!navigator.geolocation) { showToast('مرورگر شما GPS را پشتیبانی نمی‌کند', 'error'); return; }
    document.getElementById('mapHint').textContent = 'در حال یافتن موقعیت شما...';
    document.getElementById('mapHint').style.display = 'block';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            regMapInstance.flyTo([latitude, longitude], 16, { duration: 1.5 });
            setTimeout(() => placeRegMarker(latitude, longitude, 'موقعیت فعلی شما'), 1500);
        },
        () => { showToast('دسترسی به موقعیت مکانی رد شد', 'error'); document.getElementById('mapHint').style.display = 'none'; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function debouncedSearch(q) {
    clearTimeout(searchDebounce);
    if (!q || q.trim().length < 3) { document.getElementById('searchResults').style.display = 'none'; return; }
    searchDebounce = setTimeout(() => doSearch(), 600);
}

async function doSearch() {
    const q = document.getElementById('mapSearchInput').value.trim();
    if (!q) return;
    const resultsEl = document.getElementById('searchResults');
    resultsEl.innerHTML = '<div class="search-result-item">در حال جستجو...</div>';
    resultsEl.style.display = 'block';
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=fa&q=${encodeURIComponent(q + ' استان مرکزی ایران')}`);
        const data = await res.json();
        if (!data.length) { resultsEl.innerHTML = '<div class="search-result-item">نتیجه‌ای یافت نشد</div>'; return; }
        resultsEl.innerHTML = data.map((d, i) => `<div class="search-result-item" onclick="selectSearchResult(${i})">${esc(d.display_name)}</div>`).join('');
        window._searchResultsCache = data;
    } catch (e) {
        resultsEl.innerHTML = '<div class="search-result-item">خطا در جستجو؛ دوباره تلاش کنید</div>';
    }
}
function selectSearchResult(i) {
    const d = window._searchResultsCache[i];
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('mapSearchInput').value = d.display_name.split('،')[0];
    regMapInstance.flyTo([parseFloat(d.lat), parseFloat(d.lon)], 16, { duration: 1.6 });
    setTimeout(() => placeRegMarker(parseFloat(d.lat), parseFloat(d.lon), d.display_name.split('،')[0]), 1600);
}

function changeLocation() {
    document.getElementById('mapConfirmBox').classList.remove('show');
    document.getElementById('mapHint').textContent = 'روی نقشه ضربه بزنید یا آدرس را جستجو کنید';
    document.getElementById('mapHint').style.display = 'block';
}
function confirmLocation() {
    if (pendingLat == null) { showToast('ابتدا موقعیتی را روی نقشه انتخاب کنید', 'error'); return; }
    showScreen('regScreen');
}

// ------------------------------------------------------------------
// نقشه‌ی شهرستان‌ها (شماتیک، هشت‌ضلعی) — داخل پنل داشبورد برای ویرایش
// ------------------------------------------------------------------
function selectCountyHex(name) {
    document.querySelectorAll('.county-hex').forEach(el => el.classList.toggle('selected', el.dataset.county === name));
    document.getElementById('editCounty').value = name;
    document.getElementById('countyMapHint').textContent = 'شهرستان انتخاب‌شده: ' + name;
}
function syncCountyHexFromSelect() {
    const val = document.getElementById('editCounty').value;
    if (val) selectCountyHex(val);
}

// ------------------------------------------------------------------
// نقشه‌ی واقعی داخل داشبورد برای ویرایش بعدی موقعیت کارخانه
// ------------------------------------------------------------------
let locationMapInstance = null, locationMarker = null;
function initLocationMap(lat, lng) {
    const center = (lat && lng) ? [lat, lng] : (pendingLat ? [pendingLat, pendingLng] : MARKAZI_CENTER);
    if (!locationMapInstance) {
        locationMapInstance = L.map('locationMap').setView(center, (lat || pendingLat) ? 13 : 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(locationMapInstance);
        locationMapInstance.on('click', (e) => setLocationMarker(e.latlng.lat, e.latlng.lng));
    } else {
        locationMapInstance.invalidateSize();
        locationMapInstance.setView(center, (lat || pendingLat) ? 13 : 8);
    }
    if (lat && lng) setLocationMarker(lat, lng, true);
    else if (pendingLat) setLocationMarker(pendingLat, pendingLng, true);
}
function setLocationMarker(lat, lng, skipMove) {
    if (locationMarker) locationMapInstance.removeLayer(locationMarker);
    locationMarker = L.marker([lat, lng]).addTo(locationMapInstance);
    document.getElementById('companyLat').value = lat;
    document.getElementById('companyLng').value = lng;
    document.getElementById('locationStatus').textContent = `موقعیت ثبت شد (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    if (!skipMove) locationMapInstance.panTo([lat, lng]);
}
function useMyLocation() {
    if (!navigator.geolocation) { showToast('مرورگر شما GPS را پشتیبانی نمی‌کند', 'error'); return; }
    document.getElementById('locationStatus').textContent = 'در حال یافتن موقعیت...';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            locationMapInstance.setView([latitude, longitude], 15);
            setLocationMarker(latitude, longitude, true);
        },
        () => { showToast('دسترسی به موقعیت مکانی رد شد', 'error'); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

let countiesCache = [], categoriesCache = [];
async function loadLookups() {
    try {
        const [counties, categories] = await Promise.all([apiGet('/api/counties'), apiGet('/api/categories')]);
        countiesCache = counties; categoriesCache = categories;
        const countySelects = ['editCounty'];
        countySelects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = counties.map(c => `<option>${esc(c.name)}</option>`).join('');
        });
        const catSelects = ['editCategory', 'newOfferCategory'];
        catSelects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = categories.map(c => `<option>${esc(c.name)}</option>`).join('');
        });
    } catch {}
}

function uploadPreview(input, labelId, icon) {
    const label = document.getElementById(labelId);
    if (input.files && input.files[0]) { label.textContent = '✅ ' + input.files[0].name; label.classList.add('has-file'); }
}
async function compressImageFile(file, maxDim = 900, quality = 0.6) {
    if (!file || !file.type.startsWith('image/')) return file;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
}
async function uploadFile(inputEl, compress) {
    if (!inputEl.files || !inputEl.files[0]) return '';
    const original = inputEl.files[0];
    const toSend = compress ? await compressImageFile(original) : original;
    const fd = new FormData();
    fd.append('file', toSend, original.name.replace(/\.[^.]+$/, '') + (compress ? '.jpg' : ''));
    const res = await fetch(api('/api/upload'), { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'خطا در آپلود فایل');
    return data.url;
}

async function doRegister() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    if (!name || !phone || !password) { showToast('همه فیلدها الزامی است', 'error'); return; }
    try {
        const data = await apiSend('POST', '/api/company/register', {
            name, phone, password, role,
            county: pendingCounty || '',
            latitude: pendingLat, longitude: pendingLng,
            industrialZone: pendingIndustrialZone || null,
            refCode: new URLSearchParams(location.search).get('ref') || null,
        });
        setToken(data.token);
        showToast('ثبت‌نام شما انجام شد', 'success');
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function doLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!phone || !password) { showToast('شماره و رمز عبور را وارد کنید', 'error'); return; }
    try {
        const data = await apiSend('POST', '/api/company/login', { phone, password });
        setToken(data.token);
        showToast('خوش آمدید', 'success');
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

function logout() { clearToken(); location.reload(); }

function toggleForgotBox() {
    const box = document.getElementById('forgotBox');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}
async function submitForgotPassword() {
    const phone = document.getElementById('forgotPhone').value.trim();
    if (!phone) { showToast('شماره تماس را وارد کنید', 'error'); return; }
    try {
        await apiSend('POST', '/api/contact', {
            phone, subject: '🔑 درخواست بازیابی رمز عبور',
            message: `کاربر با شماره ${phone} رمز عبورش را فراموش کرده و درخواست بازیابی داده است.`,
        });
        showToast('درخواست شما ثبت شد؛ به‌زودی با شما تماس گرفته می‌شود', 'success');
        document.getElementById('forgotBox').style.display = 'none';
        document.getElementById('forgotPhone').value = '';
    } catch (e) { showToast(e.message, 'error'); }
}

const ROLE_LABELS = { producer: 'تولیدکننده / واحد صنعتی', service: 'تأمین‌کننده خدمات', buyer: 'خریدار / متقاضی خرید', other: 'سایر' };

let chartInstance;
let currentDashData = null;
async function loadDashboard() {
    try {
        const data = await apiGet('/api/company/dashboard', true);
        currentDashData = data;
        showScreen('dashboardMain');
        document.getElementById('dashCompanyName').textContent = data.company.name + ' — ' + (ROLE_LABELS[data.company.role] || '');
        const catalogBtn = document.getElementById('catalogBtn');
        catalogBtn.href = `catalog.html?id=${data.company.id}`;
        catalogBtn.style.display = 'inline-flex';
        if (data.company.verified) {
            const certBtn = document.getElementById('certificateBtn');
            certBtn.href = `certificate.html?id=${data.company.id}`;
            certBtn.style.display = 'inline-flex';
        }
        loadWeeklyDigest();
        loadSupportThread();
        loadReferralInfo();
        loadFavorites();
        loadMyTenders();
        loadMyJobs();
        resumePendingChat();
        if (location.hash === '#support') {
            setTimeout(() => document.getElementById('supportMessages')?.scrollIntoView({ behavior: 'smooth' }), 300);
        }
        document.getElementById('verifyNotice').innerHTML = data.company.verified
            ? '<div class="badge badge-verified">✔ حساب شما تأیید شده است</div>'
            : '<div class="badge badge-urgent">در انتظار تأیید مدیر</div>';

        document.getElementById('completeProfileNotice').innerHTML = data.company.profile_completed
            ? ''
            : `<div class="response-note" style="background:#fff7ed; color:#92400e; display:block; padding:0.6rem; border-radius:8px; margin:0.5rem 0;">برای دیده‌شدن بهتر، مشخصاتتان را در بخش «تکمیل / ویرایش مشخصات» پایین همین صفحه کامل کنید.</div>`;

        document.getElementById('statCards').innerHTML = `
            <div class="stat-card"><div class="num">${data.stats.offers}</div><div class="label">تعداد آگهی</div></div>
            <div class="stat-card"><div class="num">${data.stats.rfqs}</div><div class="label">استعلام دریافتی</div></div>
            <div class="stat-card"><div class="num">${data.stats.myRequests}</div><div class="label">درخواست خرید من</div></div>
            <div class="stat-card"><div class="num">${data.stats.profileViews}</div><div class="label">بازدید پروفایل</div></div>
        `;
        document.getElementById('editName').value = data.company.name || '';
        document.getElementById('editProducts').value = data.company.products || '';
        document.getElementById('editCapacity').value = data.company.capacity || '';
        if (data.company.county) document.getElementById('editCounty').value = data.company.county;
        syncCountyHexFromSelect();
        setTimeout(() => initLocationMap(data.company.latitude, data.company.longitude), 100);
        if (data.company.category) document.getElementById('editCategory').value = data.company.category;
        document.getElementById('presentationStatus').textContent =
            'وضعیت پرزنت: ' + ({ none: 'ثبت نشده', pending: 'در انتظار تایید', approved: 'تأیید شده', rejected: 'رد شده' }[data.company.presentation_status] || '-');

        renderMyOffers(data.myOffers || []);
        renderMyServices(data.myServices || []);
        renderMyRequests(data.myRequests || []);
        renderMyRfqsSent(data.myRfqsSent || []);
        renderRfqsReceived(data.rfqsReceived || []);
        checkNewActivity(data);
        loadNotifications();
        checkChatEnabled();

        function checkChatEnabled() {
            apiGet('/api/platform-settings').then(s => {
                const chatCard = document.getElementById('chatCard');
                const chatHeading = chatCard?.previousElementSibling;
                if (!s.chat_enabled) {
                    if (chatCard) chatCard.style.display = 'none';
                    if (chatHeading) chatHeading.style.display = 'none';
                    return;
                }
                if (chatCard) chatCard.style.display = '';
                if (chatHeading) chatHeading.style.display = '';
                loadConversations().then(() => {
                    const m = location.hash.match(/^#chat-(\d+)/);
                    if (m) openChatThread(parseInt(m[1]));
                });
            }).catch(() => {
                // اگر تنظیمات در دسترس نبود، فرض را بر فعال‌بودن چت می‌گذاریم
                loadConversations();
            });
        }

        const labels = (data.monthlyViews || []).map(m => toPersianDate(m.month + '-01').slice(0, 7)).reverse();
        const values = (data.monthlyViews || []).map(m => m.c).reverse();
        if (chartInstance) chartInstance.destroy();
        const ctx = document.getElementById('viewsChart');
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels.length ? labels : ['بدون داده'], datasets: [{ label: 'بازدید ماهانه پروفایل', data: values.length ? values : [0], backgroundColor: '#d4a94e' }] },
            options: { responsive: true, plugins: { legend: { display: false } } },
        });
    } catch (e) {
        clearToken();
        showScreen('authEntry');
    }
}

function renderMyOffers(list) {
    const el = document.getElementById('myOffersList');
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<h4 style="font-size:0.9rem; margin-bottom:0.5rem;">آگهی‌های من</h4>' + list.map(o => `
        <div class="card" style="padding:0.8rem; margin-bottom:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><b>${esc(o.title)}</b><div style="font-size:0.78rem; color:var(--text-light);">${esc(o.price||'توافقی')} تومان • ${o.views} بازدید</div></div>
                <span class="badge ${o.verified ? 'badge-verified' : 'badge-status'}">${o.verified ? '✔ تأیید' : 'در انتظار'}</span>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                <button class="btn btn-sm btn-outline" onclick="openEditOffer(${o.id}, '${escAttr(o.title)}', '${o.price||''}', '${escAttr(o.description||'')}')">ویرایش</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMyOffer(${o.id})">حذف</button>
            </div>
        </div>`).join('');
}

function renderMyServices(list) {
    const el = document.getElementById('myServicesList');
    if (!list || !list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<h4 style="font-size:0.9rem; margin-bottom:0.5rem;">درخواست‌های خدمات من</h4>' + list.map(s => `
        <div class="card" style="padding:0.8rem; margin-bottom:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b>${esc(s.role_title)}</b>
                <span class="badge badge-status">${esc(s.status)}</span>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                <button class="btn btn-sm btn-outline" onclick="openEditService(${s.id}, '${escAttr(s.role_title)}', '${escAttr(s.description||'')}')">ویرایش</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMyService(${s.id})">حذف</button>
            </div>
        </div>`).join('');
}

function escAttr(s) { return String(s ?? '').replace(/'/g, "\\'").replace(/\n/g, ' '); }

let editTarget = null;
function openEditOffer(id, title, price, description) {
    editTarget = { type: 'offer', id };
    document.getElementById('editItemTitleLabel').textContent = 'عنوان محصول';
    document.getElementById('editItemTitle').value = title;
    document.getElementById('editItemExtraGroup').style.display = 'block';
    document.getElementById('editItemExtraLabel').textContent = 'قیمت (تومان)';
    document.getElementById('editItemExtra').value = price;
    document.getElementById('editItemDesc').value = description;
    document.getElementById('editItemModalTitle').textContent = 'ویرایش آگهی محصول';
    document.getElementById('editItemModal').classList.add('open');
}
function openEditService(id, title, description) {
    editTarget = { type: 'service', id };
    document.getElementById('editItemTitleLabel').textContent = 'عنوان نیاز';
    document.getElementById('editItemTitle').value = title;
    document.getElementById('editItemExtraGroup').style.display = 'none';
    document.getElementById('editItemDesc').value = description;
    document.getElementById('editItemModalTitle').textContent = 'ویرایش درخواست خدمات';
    document.getElementById('editItemModal').classList.add('open');
}
function closeEditItemModal() { document.getElementById('editItemModal').classList.remove('open'); }

async function submitEditItem() {
    if (!editTarget) return;
    const title = document.getElementById('editItemTitle').value.trim();
    const description = document.getElementById('editItemDesc').value;
    try {
        if (editTarget.type === 'offer') {
            const price = document.getElementById('editItemExtra').value;
            await apiSend('PUT', `/api/company/offers/${editTarget.id}`, { title, price, description }, true);
        } else {
            await apiSend('PUT', `/api/company/service-requests/${editTarget.id}`, { role_title: title, description }, true);
        }
        showToast('تغییرات برای تایید مدیر ارسال شد', 'success');
        closeEditItemModal();
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteMyOffer(id) {
    if (!confirm('این آگهی حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/company/offers/${id}`, null, true); showToast('حذف شد', 'success'); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function deleteMyService(id) {
    if (!confirm('این درخواست حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/company/service-requests/${id}`, null, true); showToast('حذف شد', 'success'); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function deleteMyRequest(id) {
    if (!confirm('این درخواست خرید حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/company/requests/${id}`, null, true); showToast('حذف شد', 'success'); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}

function renderMyRequests(list) {
    const el = document.getElementById('myRequestsList');
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<h4 style="font-size:0.9rem; margin-bottom:0.5rem;">درخواست‌های خرید من</h4>' + list.map(r => `
        <div class="card" style="padding:0.8rem; margin-bottom:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b>${esc(r.product)}</b> — ${esc(r.quantity)} ${esc(r.unit||'')}
                <button class="btn btn-sm btn-danger" onclick="deleteMyRequest(${r.id})">حذف</button>
            </div>
            ${r.responses && r.responses.length
                ? `<div style="margin-top:0.5rem; font-size:0.82rem;">✅ ${r.responses.length} تأمین‌کننده پاسخ داده:<ul style="margin-top:0.3rem;">${r.responses.map(rr => `<li>${esc(rr.company_name)} — <a href="tel:${esc(rr.phone)}">${esc(rr.phone)}</a></li>`).join('')}</ul></div>`
                : `<div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-light);">هنوز پاسخی دریافت نشده</div>`}
        </div>`).join('');
}

function renderMyRfqsSent(list) {
    const el = document.getElementById('myRfqsSentList');
    el.innerHTML = list.length ? list.map(r => `
        <div class="card" style="padding:0.8rem; margin-bottom:0.5rem;">
            <b>${esc(r.offer_title)}</b>
            <div style="font-size:0.8rem; color:var(--text-light); margin-top:0.3rem;">${esc(r.message||'')}</div>
            <span class="badge badge-status" style="margin-top:0.4rem; display:inline-block;">${esc(r.status)}</span>
        </div>`).join('') : '<div class="empty-state">استعلامی ارسال نکرده‌اید</div>';
}

function renderRfqsReceived(list) {
    const el = document.getElementById('rfqsReceivedList');
    el.innerHTML = list.length ? list.map(r => `
        <div class="card" style="padding:0.8rem; margin-bottom:0.5rem;">
            <b>${esc(r.offer_title)}</b>
            <div style="font-size:0.82rem; margin-top:0.3rem;">${esc(r.company_name||'')} — <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></div>
            ${r.quantity ? `<div style="font-size:0.8rem; color:var(--text-light);">مقدار: ${esc(r.quantity)}</div>` : ''}
            ${r.message ? `<div style="font-size:0.8rem; color:var(--text-light);">${esc(r.message)}</div>` : ''}
        </div>`).join('') : '<div class="empty-state">استعلامی دریافت نشده</div>';
}

async function submitNewOffer() {
    const title = document.getElementById('newOfferTitle').value.trim();
    if (!title) { showToast('عنوان محصول الزامی است', 'error'); return; }
    try {
        let imageUrl = document.getElementById('newOfferImageUrl').value.trim();
        if (!imageUrl) {
            try { imageUrl = await uploadFile(document.getElementById('newOfferImage'), true); }
            catch (e) { showToast('آپلود عکس ناموفق بود: ' + e.message, 'error'); return; }
        }
        await apiSend('POST', '/api/offers', {
            title,
            category: document.getElementById('newOfferCategory').value,
            price: document.getElementById('newOfferPrice').value,
            moq: document.getElementById('newOfferMoq').value,
            description: document.getElementById('newOfferDesc').value,
            imageUrl,
        }, true);
        showToast('آگهی ثبت شد', 'success');
        ['newOfferTitle','newOfferPrice','newOfferMoq','newOfferDesc','newOfferImageUrl'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('newOfferImage').value = '';
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function submitNewRequest() {
    const product = document.getElementById('newReqProduct').value.trim();
    const quantity = document.getElementById('newReqQty').value.trim();
    if (!product || !quantity) { showToast('محصول و مقدار الزامی است', 'error'); return; }
    try {
        await apiSend('POST', '/api/requests', { product, quantity, unit: document.getElementById('newReqUnit').value }, true);
        showToast('درخواست خرید ثبت شد', 'success');
        document.getElementById('newReqProduct').value = ''; document.getElementById('newReqQty').value = '';
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function submitNewService() {
    const roleTitle = document.getElementById('newSrvRole').value.trim();
    if (!roleTitle) { showToast('عنوان نیاز الزامی است', 'error'); return; }
    try {
        await apiSend('POST', '/api/service-requests', { roleTitle }, true);
        showToast('درخواست خدمات ثبت شد', 'success');
        document.getElementById('newSrvRole').value = '';
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

function checkNewActivity(data) {
    const lastSeenKey = 'lastSeenActivity_' + data.company.id;
    const lastSeen = localStorage.getItem(lastSeenKey);
    const latestTimes = [];
    (data.rfqsReceived || []).forEach(r => latestTimes.push(r.created_at));
    (data.myRequests || []).forEach(r => (r.responses || []).forEach(rr => latestTimes.push(rr.created_at)));
    const newest = latestTimes.sort().reverse()[0];
    const notice = document.getElementById('newActivityNotice');
    if (newest && (!lastSeen || newest > lastSeen)) {
        notice.innerHTML = '<div class="response-note" style="background:#fef3c7; color:#92400e; display:block; padding:0.6rem; border-radius:8px; margin:0.5rem 0;">🔔 فعالیت جدید دارید — استعلام یا پاسخ تازه دریافت کرده‌اید</div>';
    } else {
        notice.innerHTML = '';
    }
    if (newest) localStorage.setItem(lastSeenKey, newest);
}

async function saveProfileEdit() {
    try {
        let logoUrl = document.getElementById('editLogoUrl').value.trim();
        let licenseUrl = document.getElementById('editLicenseUrl').value.trim();
        if (!logoUrl) {
            try { logoUrl = await uploadFile(document.getElementById('editLogo'), true); }
            catch (e) { showToast('آپلود لوگو ناموفق بود: ' + e.message, 'error'); return; }
        }
        if (!licenseUrl) {
            try { licenseUrl = await uploadFile(document.getElementById('editLicense'), false); }
            catch (e) { showToast('آپلود مجوز ناموفق بود: ' + e.message, 'error'); return; }
        }
        const body = {
            name: document.getElementById('editName').value,
            county: document.getElementById('editCounty').value,
            category: document.getElementById('editCategory').value,
            products: document.getElementById('editProducts').value,
            capacity: document.getElementById('editCapacity').value,
        };
        if (logoUrl) body.logo_url = logoUrl;
        if (licenseUrl) body.license_url = licenseUrl;
        const lat = document.getElementById('companyLat').value;
        const lng = document.getElementById('companyLng').value;
        if (lat && lng) { body.latitude = parseFloat(lat); body.longitude = parseFloat(lng); }
        await apiSend('PUT', '/api/company/profile', body, true);
        showToast('تغییرات برای تایید مدیر ارسال شد', 'success');
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function submitPresentation() {
    try {
        await apiSend('POST', '/api/company/presentation', {
            url: document.getElementById('presentationUrl').value,
            type: document.getElementById('presentationType').value,
        }, true);
        showToast('برای تایید مدیر ارسال شد', 'success');
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadSupportThread() {
    try {
        const data = await apiGet('/api/support/thread', true);
        const box = document.getElementById('supportMessages');
        if (!box) return;
        box.innerHTML = (data.messages || []).map(m => `
            <div class="chat-bubble ${m.sender_type === 'company' ? 'mine' : 'theirs'}">
                ${esc(m.body)}
                <span class="chat-bubble-time">${esc(toPersianDate(m.created_at, true))}</span>
            </div>
        `).join('') || '<div class="empty-state">اگر سؤال یا مشکلی دارید، همین‌جا بنویسید</div>';
        box.scrollTop = box.scrollHeight;
        if (!window._supportPollStarted) {
            window._supportPollStarted = true;
            setInterval(loadSupportThread, 15000);
        }
    } catch (e) { /* اگر نشد، بی‌سروصدا رد می‌شود */ }
}
async function sendSupportMessage() {
    const input = document.getElementById('supportInput');
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    try {
        await apiSend('POST', '/api/support/messages', { body }, true);
        loadSupportThread();
    } catch (e) { showToast(e.message, 'error'); input.value = body; }
}

async function loadReferralInfo() {
    try {
        const d = await apiGet('/api/company/referrals', true);
        const card = document.getElementById('referralCard');
        card.style.display = 'block';
        const link = `${location.origin}${location.pathname}?ref=${d.referralCode}`;
        card.innerHTML = `
            <div class="rf-title">🤝 دعوت از همکاران — با هر ثبت‌نام موفق، شبکه‌تان بزرگ‌تر می‌شود</div>
            <div class="rf-code">${esc(d.referralCode)}</div><br>
            <button onclick="navigator.clipboard.writeText('${link}'); showToast('لینک کپی شد', 'success');">📋 کپی لینک دعوت</button>
            <div class="rf-count">${d.count} نفر تا الان با لینک شما ثبت‌نام کرده‌اند</div>
        `;
    } catch (e) { /* اگر نشد، این کارت را نمایش نده */ }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('مرورگر شما از اعلان فوری پشتیبانی نمی‌کند', 'error'); return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { showToast('اجازهٔ اعلان داده نشد', 'error'); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
        });
        await apiSend('POST', '/api/push/subscribe', sub.toJSON(), true);
        showToast('اعلان فوری فعال شد ✅', 'success');
        document.getElementById('pushEnableBtn').textContent = '🔔 اعلان فوری فعال است';
    } catch (e) { showToast('فعال‌سازی ممکن نشد: ' + e.message, 'error'); }
}

async function checkPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) document.getElementById('pushEnableBtn').textContent = '🔔 اعلان فوری فعال است';
    } catch (e) {}
}
window.addEventListener('DOMContentLoaded', checkPushStatus);

async function loadWeeklyDigest() {
    try {
        const d = await apiGet('/api/company/weekly-digest', true);
        const total = d.views + d.newMessages + d.newRfqs + d.newMatches;
        const card = document.getElementById('weeklyDigestCard');
        if (!total) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        card.innerHTML = `
            <div class="wd-title">📊 خلاصهٔ عملکرد این هفته</div>
            <div class="wd-stats">
                <div class="wd-stat"><div class="num">${d.views}</div><div class="lbl">بازدید پروفایل</div></div>
                <div class="wd-stat"><div class="num">${d.newMessages}</div><div class="lbl">پیام جدید</div></div>
                <div class="wd-stat"><div class="num">${d.newRfqs}</div><div class="lbl">استعلام جدید</div></div>
                <div class="wd-stat"><div class="num">${d.newMatches}</div><div class="lbl">تطبیق هوشمند</div></div>
            </div>`;
    } catch (e) { /* اگر نشد، این کارت را نمایش نده */ }
}

async function submitChangePassword() {
    const currentPassword = document.getElementById('curPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    if (!currentPassword || !newPassword) { showToast('هر دو رمز را وارد کنید', 'error'); return; }
    try {
        await apiSend('POST', '/api/company/change-password', { currentPassword, newPassword }, true);
        showToast('رمز عبور با موفقیت تغییر کرد', 'success');
        document.getElementById('curPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// اعلان‌ها (زنگوله)
// ------------------------------------------------------------------
let notifPollInterval = null;

async function loadNotifications() {
    try {
        const data = await apiGet('/api/company/inbox', true);
        const badge = document.getElementById('notifBadge');
        if (data.unread > 0) { badge.style.display = 'flex'; badge.textContent = data.unread > 9 ? '9+' : data.unread; }
        else { badge.style.display = 'none'; }
        const list = document.getElementById('notifList');
        if (!data.items.length) { list.innerHTML = '<div class="empty-state" style="padding:1rem;">اعلانی ندارید</div>'; return; }
        list.innerHTML = data.items.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="openNotification(${n.id}, '${escAttr(n.link || '')}')">
                <div class="notif-title">${esc(n.title)}</div>
                <div>${esc(n.body || '')}</div>
                <div class="notif-time">${esc(toPersianDate(n.created_at, true))}</div>
            </div>
        `).join('');
    } catch (e) { /* اگر نشد، بی‌سروصدا رد می‌شود */ }
    if (!notifPollInterval) notifPollInterval = setInterval(loadNotifications, 20000);
}

function toggleNotifDropdown() {
    const dd = document.getElementById('notifDropdown');
    const open = dd.style.display === 'block';
    dd.style.display = open ? 'none' : 'block';
    if (!open) loadNotifications();
}

async function markAllNotifsRead() {
    try { await apiSend('POST', '/api/company/inbox/read-all', {}, true); loadNotifications(); } catch (e) {}
}

async function openNotification(id, link) {
    try { await apiSend('POST', `/api/company/inbox/${id}/read`, {}, true); } catch (e) {}
    loadNotifications();
    document.getElementById('notifDropdown').style.display = 'none';
    const m = (link || '').match(/^#chat-(\d+)/);
    if (m) { openChatThread(parseInt(m[1])); document.getElementById('chatCard').scrollIntoView({ behavior: 'smooth' }); }
}

// ------------------------------------------------------------------
// چت داخلی
// ------------------------------------------------------------------
let activeConversationId = null, chatPollInterval = null, myCompanyId = null;

async function resumePendingChat() {
    const companyId = new URLSearchParams(location.search).get('startChat');
    if (!companyId) return;
    history.replaceState(null, '', location.pathname + location.hash);
    try {
        const data = await apiSend('POST', '/api/chat/start', { companyId: parseInt(companyId) }, true);
        document.getElementById('chatCard')?.scrollIntoView({ behavior: 'smooth' });
        await loadConversations();
        openChatThread(data.conversationId);
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadConversations() {
    try {
        const list = await apiGet('/api/chat/conversations', true);
        myCompanyId = currentDashData?.company?.id;
        const el = document.getElementById('chatConversationsList');
        renderContactsBook(list);
        if (!list.length) { el.innerHTML = '<div class="empty-state">هنوز گفتگویی ندارید</div>'; return; }
        el.innerHTML = list.map(c => `
            <div class="chat-list-item" onclick="openChatThread(${c.id})">
                <div>
                    <div class="chat-list-name">${esc(c.other_name)} ${c.pending_approval ? '<span class="badge badge-status">در انتظار تایید مدیر</span>' : ''}</div>
                    <div class="chat-list-preview">${esc(c.last_message || 'گفتگو را شروع کنید')}</div>
                </div>
                ${c.unread_count > 0 ? `<span class="chat-unread-badge">${c.unread_count}</span>` : ''}
            </div>
        `).join('');
    } catch (e) { /* اگر نشد، بی‌سروصدا رد می‌شود */ }
}

function renderContactsBook(conversations) {
    const box = document.getElementById('contactsBook');
    if (!box) return;
    if (!conversations.length) { box.innerHTML = '<div class="empty-state">هنوز مخاطبی ندارید — از چت با کسی شروع کنید</div>'; return; }
    box.innerHTML = conversations.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f0f0f0;">
            <div>
                <div style="font-weight:700; font-size:0.88rem;">${esc(c.other_name)}</div>
                <div style="font-size:0.78rem; color:var(--text-light);">${esc(c.other_phone || '')} ${c.other_county ? '• ' + esc(c.other_county) : ''}</div>
            </div>
            <a href="tel:${esc(c.other_phone)}" class="btn btn-outline btn-sm">📞 تماس</a>
        </div>
    `).join('');
}

async function loadMyTenders() {
    const box = document.getElementById('myTendersList');
    try {
        const tenders = await apiGet('/api/company/my-tenders', true);
        if (!tenders.length) { box.innerHTML = '<div class="empty-state">هنوز مناقصه‌ای ثبت نکرده‌اید — از تب «مناقصه‌ها» در سایت اصلی ثبت کنید</div>'; return; }
        box.innerHTML = tenders.map(t => `
            <div style="padding:0.6rem 0; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:700; font-size:0.88rem;">${esc(t.title)}</div>
                <div style="font-size:0.78rem; color:var(--text-light); margin:0.2rem 0;">مهلت: ${esc(toPersianDate(t.deadline))} • ${t.bid_count} پیشنهاد</div>
                ${t.bid_count > 0 ? `<button class="btn btn-outline btn-sm" onclick="viewTenderBids(${t.id})">مشاهدهٔ پیشنهادها</button>` : ''}
                <div id="bids-${t.id}" style="margin-top:0.5rem;"></div>
            </div>
        `).join('');
    } catch (e) { box.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>'; }
}
async function viewTenderBids(tenderId) {
    const box = document.getElementById(`bids-${tenderId}`);
    box.innerHTML = 'در حال بارگذاری...';
    try {
        const bids = await apiGet(`/api/tenders/${tenderId}/bids`, true);
        box.innerHTML = bids.map(b => `
            <div style="background:#f7f8fa; border-radius:8px; padding:0.5rem 0.7rem; margin-top:0.4rem; font-size:0.82rem;">
                <b>${esc(b.company_name)}</b> (${esc(b.company_phone)}) — ${esc(b.price)}
                ${b.message ? `<div style="color:var(--text-light); margin-top:0.2rem;">${esc(b.message)}</div>` : ''}
            </div>
        `).join('') || '<div class="empty-state">پیشنهادی نیست</div>';
    } catch (e) { box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}

async function loadMyJobs() {
    const box = document.getElementById('myJobsList');
    try {
        const jobs = await apiGet('/api/company/my-jobs', true);
        if (!jobs.length) { box.innerHTML = '<div class="empty-state">هنوز آگهی استخدامی ثبت نکرده‌اید</div>'; return; }
        box.innerHTML = jobs.map(j => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f0f0f0;">
                <div>
                    <div style="font-weight:700; font-size:0.88rem;">${esc(j.title)}</div>
                    <div style="font-size:0.78rem; color:var(--text-light);">${esc(toPersianDate(j.created_at))}</div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="delJob(${j.id})">حذف</button>
            </div>
        `).join('');
    } catch (e) { box.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>'; }
}
async function delJob(id) {
    try { await apiSend('DELETE', `/api/company/jobs/${id}`, null, true); loadMyJobs(); }
    catch (e) { showToast(e.message, 'error'); }
}

async function loadFavorites() {
    const box = document.getElementById('favoritesList');
    try {
        const items = await apiGet('/api/favorites', true);
        if (!items.length) { box.innerHTML = '<div class="empty-state">هنوز چیزی را علاقه‌مند نکرده‌اید — روی ⭐ کنار هر آگهی یا شرکت بزنید</div>'; return; }
        box.innerHTML = items.map(it => it.type === 'offer'
            ? `<div style="padding:0.5rem 0; border-bottom:1px solid #f0f0f0; font-size:0.85rem;"><b>${esc(it.data.title)}</b> — ${esc(it.data.company_name)} — ${esc(it.data.price || 'توافقی')}</div>`
            : `<div style="padding:0.5rem 0; border-bottom:1px solid #f0f0f0; font-size:0.85rem;"><a href="company-profile.html?id=${it.data.id}"><b>${esc(it.data.name)}</b></a> — ${esc(it.data.county || '')}</div>`
        ).join('');
    } catch (e) { box.innerHTML = '<div class="empty-state">خطا در بارگذاری</div>'; }
}

function exportMyStatsCsv() {
    if (!currentDashData) { showToast('اطلاعات هنوز کامل بارگذاری نشده', 'error'); return; }
    const d = currentDashData;
    let csv = '\uFEFF'; // BOM برای نمایش درست فارسی در اکسل
    csv += 'نوع,عنوان,وضعیت,تاریخ ثبت\n';
    (d.myOffers || []).forEach(o => { csv += `آگهی محصول,"${(o.title||'').replace(/"/g,'')}",${o.active?'فعال':'غیرفعال'},${(o.created_at||'').slice(0,10)}\n`; });
    (d.myServices || []).forEach(s => { csv += `درخواست خدمات,"${(s.role_title||'').replace(/"/g,'')}",${s.status||''},${(s.created_at||'').slice(0,10)}\n`; });
    (d.myRequests || []).forEach(r => { csv += `درخواست خرید,"${(r.product||'').replace(/"/g,'')}",${(r.responses||[]).length + ' پاسخ'},${(r.created_at||'').slice(0,10)}\n`; });
    (d.myRfqsSent || []).forEach(rq => { csv += `استعلام ارسالی,"${(rq.offer_title||'').replace(/"/g,'')}",-,${(rq.created_at||'').slice(0,10)}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `آمار-من-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

async function openChatThread(id) {
    activeConversationId = id;
    document.getElementById('chatListView').style.display = 'none';
    document.getElementById('chatThreadView').style.display = 'block';
    await loadChatMessages();
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadChatMessages, 5000);
}

function closeChatThread() {
    activeConversationId = null;
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
    document.getElementById('chatThreadView').style.display = 'none';
    document.getElementById('chatListView').style.display = 'block';
    history.replaceState(null, '', location.pathname);
    loadConversations();
    loadNotifications();
}

async function loadChatMessages() {
    if (!activeConversationId) return;
    try {
        const msgs = await apiGet(`/api/chat/conversations/${activeConversationId}/messages`, true);
        const box = document.getElementById('chatMessages');
        const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
        box.innerHTML = msgs.map(m => `
            <div class="chat-bubble ${m.sender_company_id === myCompanyId ? 'mine' : 'theirs'}">
                ${esc(m.body)}
                <span class="chat-bubble-time">${esc((m.created_at || '').slice(11, 16))}</span>
            </div>
        `).join('');
        if (wasAtBottom || msgs.length <= 1) box.scrollTop = box.scrollHeight;
        const convo = (await apiGet('/api/chat/conversations', true)).find(c => c.id === activeConversationId);
        document.getElementById('chatThreadTitle').textContent = convo?.other_name || 'گفتگو';
    } catch (e) { showToast(e.message, 'error'); }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const body = input.value.trim();
    if (!body || !activeConversationId) return;
    input.value = '';
    try {
        await apiSend('POST', `/api/chat/conversations/${activeConversationId}/messages`, { body }, true);
        loadChatMessages();
    } catch (e) { showToast(e.message, 'error'); input.value = body; }
}

window.addEventListener('DOMContentLoaded', () => {
    loadLookups();
    if (getToken()) { loadDashboard(); }
    else if (location.hash === '#register') { goMapScreen(); }
    else { showScreen('authEntry'); }
});

// محو-به-نمایان‌شدن نرم تصاویری که بعداً به صفحه اضافه می‌شوند
(function () {
    function prep(img) {
        if (img.dataset.faded) return;
        img.dataset.faded = '1';
        img.classList.add('js-fade');
        if (img.complete && img.naturalWidth > 0) { img.classList.add('js-loaded'); return; }
        img.addEventListener('load', () => img.classList.add('js-loaded'), { once: true });
        img.addEventListener('error', () => img.classList.add('js-loaded'), { once: true });
    }
    new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.tagName === 'IMG') prep(node);
            node.querySelectorAll && node.querySelectorAll('img').forEach(prep);
        }));
    }).observe(document.body, { childList: true, subtree: true });
})();
