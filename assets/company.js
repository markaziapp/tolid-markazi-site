function api(path) { return (window.API_BASE || '') + path; }
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => t.classList.remove('show'), 3500);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

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

function showAuthForm(which) {
    document.getElementById('loginForm').style.display = which === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = which === 'register' ? 'block' : 'none';
    document.getElementById('loginTabBtn').classList.toggle('active', which === 'login');
    document.getElementById('registerTabBtn').classList.toggle('active', which === 'register');
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
        const data = await apiSend('POST', '/api/company/register', { name, phone, password, role });
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

const ROLE_LABELS = { producer: 'تولیدکننده / واحد صنعتی', service: 'تأمین‌کننده خدمات', buyer: 'خریدار / متقاضی خرید', other: 'سایر' };

let chartInstance;
let currentDashData = null;
async function loadDashboard() {
    try {
        const data = await apiGet('/api/company/dashboard', true);
        currentDashData = data;
        document.getElementById('authBox').style.display = 'none';
        document.getElementById('dashboardBox').style.display = 'block';
        document.getElementById('dashCompanyName').textContent = data.company.name + ' — ' + (ROLE_LABELS[data.company.role] || '');
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
        if (data.company.category) document.getElementById('editCategory').value = data.company.category;
        document.getElementById('presentationStatus').textContent =
            'وضعیت پرزنت: ' + ({ none: 'ثبت نشده', pending: 'در انتظار تایید', approved: 'تأیید شده', rejected: 'رد شده' }[data.company.presentation_status] || '-');

        renderMyOffers(data.myOffers || []);
        renderMyServices(data.myServices || []);
        renderMyRequests(data.myRequests || []);
        renderMyRfqsSent(data.myRfqsSent || []);
        renderRfqsReceived(data.rfqsReceived || []);
        checkNewActivity(data);

        const labels = (data.monthlyViews || []).map(m => m.month).reverse();
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
        showToast('نشست شما منقضی شده؛ دوباره وارد شوید', 'error');
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

window.addEventListener('DOMContentLoaded', () => {
    loadLookups();
    if (getToken()) loadDashboard();
    if (location.hash === '#register') showAuthForm('register');
});
