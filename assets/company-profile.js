// ===================================================================
// پروفایل عمومی شرکت — کارت ویزیت QR، امتیاز/نظر، شروع گفتگو
// این فایل مستقل است (برای جلوگیری از تداخل با کدهای مخصوص index.html)
// ===================================================================
function api(path) { return (window.API_BASE || '') + path; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function getToken() { return localStorage.getItem('companyToken'); }
function isLoggedIn() { return !!getToken(); }

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => t.classList.remove('show'), 3500);
}
async function apiGet(path) {
    const headers = {};
    if (getToken()) headers.Authorization = 'Bearer ' + getToken();
    const res = await fetch(api(path), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'خطا در دریافت اطلاعات');
    return data;
}
async function apiPost(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (getToken()) headers.Authorization = 'Bearer ' + getToken();
    const res = await fetch(api(path), { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'خطا در ثبت اطلاعات');
    return data;
}
function requireLogin(actionLabel) {
    if (isLoggedIn()) return true;
    showToast('برای ' + actionLabel + ' ابتدا باید ثبت‌نام یا وارد شوید', 'error');
    setTimeout(() => { location.href = 'company.html'; }, 900);
    return false;
}
async function renderAuthArea() {
    const el = document.getElementById('authArea');
    if (!el) return;
    if (!isLoggedIn()) {
        el.innerHTML = `<button class="btn btn-outline btn-sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4);" onclick="location.href='company.html'">ثبت‌نام / ورود</button>`;
        return;
    }
    el.innerHTML = `<button class="btn btn-outline btn-sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4);" onclick="location.href='company.html'">پنل من</button>`;
}
async function startChatWith(companyId) {
    if (!requireLogin('شروع گفتگو')) return;
    try {
        const data = await apiPost('/api/chat/start', { companyId });
        location.href = `company.html#chat-${data.conversationId}`;
    } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
const ROLE_LABELS = { producer: 'تولیدکننده', service: 'خدمات‌دهنده', buyer: 'خریدار', other: 'سایر' };
const params = new URLSearchParams(location.search);
const companyId = parseInt(params.get('id'));
let currentCompany = null;

async function loadProfile() {
    if (!companyId) { showError(); return; }
    try {
        currentCompany = await apiGet(`/api/companies/${companyId}`);
        renderProfile(currentCompany);
        loadReviews();
    } catch (e) { showError(); }
}

function showError() {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileError').style.display = 'block';
}

function renderProfile(c) {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileBox').style.display = 'block';
    document.getElementById('pName').textContent = c.name;
    document.getElementById('pCounty').textContent = `${c.county || ''} — ${ROLE_LABELS[c.role] || ''}`;
    document.getElementById('pVerified').innerHTML = c.verified ? '<span class="badge badge-verified">✔ تأیید شده</span>' : '';
    document.getElementById('pRating').textContent = c.rating_count > 0 ? `⭐ ${c.rating_avg.toFixed(1)} از ۵ (${c.rating_count} نظر)` : 'هنوز امتیازی ثبت نشده';
    document.getElementById('pBadges').innerHTML = (c.badges || []).map(b => `<span class="badge-trust">${esc(b)}</span>`).join(' ');
    document.getElementById('pDetails').innerHTML = `
        ${c.products ? `<div>محصولات / خدمات: ${esc(c.products)}</div>` : ''}
        ${c.capacity ? `<div>ظرفیت تولید: ${esc(c.capacity)}</div>` : ''}
        ${c.category ? `<div>دسته‌بندی: ${esc(c.category)}</div>` : ''}
    `;
    document.getElementById('pChatBtn').onclick = () => startChatWith(c.id);
    document.title = `${c.name} | همتا صنعت`;
    renderAuthArea();
}

function toggleQr() {
    const box = document.getElementById('qrBox');
    const isOpen = box.style.display === 'block';
    box.style.display = isOpen ? 'none' : 'block';
    if (!isOpen && currentCompany) {
        const url = `${location.origin}${location.pathname}?id=${currentCompany.id}`;
        QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 220 }, (err) => {
            if (err) showToast('ساخت QR ممکن نشد', 'error');
        });
    }
}

async function loadReviews() {
    try {
        const reviews = await apiGet(`/api/companies/${companyId}/reviews`);
        const el = document.getElementById('reviewsList');
        if (!reviews.length) { el.innerHTML = '<div class="empty-state">هنوز نظری ثبت نشده</div>'; return; }
        el.innerHTML = reviews.map(r => `
            <div style="padding:0.6rem 0; border-bottom:1px solid #f0f0f0;">
                <div style="color:#b8860b;">${'⭐'.repeat(r.rating)}</div>
                ${r.comment ? `<p style="font-size:0.85rem; margin-top:0.2rem;">${esc(r.comment)}</p>` : ''}
                <div style="font-size:0.72rem; color:var(--text-light); margin-top:0.2rem;">${esc(r.reviewer_name)} • ${esc((r.created_at || '').slice(0, 10))}</div>
            </div>
        `).join('');
    } catch (e) { /* اگر نشد، بخش نظرات خالی می‌ماند */ }
}

async function submitReview() {
    if (!requireLogin('ثبت نظر')) return;
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();
    try {
        await apiPost('/api/reviews', { companyId, rating, comment });
        showToast('نظر شما ثبت شد و بعد از تایید مدیریت نمایش داده می‌شود', 'success');
        document.getElementById('reviewComment').value = '';
    } catch (e) { showToast(e.message, 'error'); }
}

window.addEventListener('DOMContentLoaded', () => {
    renderAuthArea();
    loadProfile();
});
