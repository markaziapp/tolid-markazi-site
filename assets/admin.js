function api(path) { return (window.API_BASE || '') + path; }
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => t.classList.remove('show'), 3500);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
// تبدیل تاریخ میلادی ذخیره‌شده در دیتابیس به شمسی (برای نمایش در همه‌جای پنل)
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
const ROLE_LABELS = { producer: 'تولیدکننده', service: 'خدمات‌دهنده', buyer: 'خریدار', other: 'سایر' };
function openLightbox(url) {
    if (!url) return;
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightboxOverlay').classList.add('open');
}
function closeLightbox() { document.getElementById('lightboxOverlay').classList.remove('open'); }
function getToken() { return sessionStorage.getItem('adminToken'); }
function setToken(t) { sessionStorage.setItem('adminToken', t); }
function clearToken() { sessionStorage.removeItem('adminToken'); }

async function apiGet(path) {
    const res = await fetch(api(path), { headers: { Authorization: 'Bearer ' + getToken() } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error || 'خطا') + (data.detail ? ' — ' + data.detail : ''));
    return data;
}
async function apiSend(method, path, body) {
    const res = await fetch(api(path), {
        method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }, body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error || 'خطا') + (data.detail ? ' — ' + data.detail : ''));
    return data;
}

// ------------------------------------------------------------------
// دروازه مخفی: ۵ کلیک پشت‌سرهم روی آرم
// ------------------------------------------------------------------
let clickCount = 0, clickTimer;
document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById('gateLogo');
    logo.addEventListener('click', () => {
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => (clickCount = 0), 1500);
        if (clickCount >= 5) {
            clickCount = 0;
            document.getElementById('gate').style.display = 'none';
            document.getElementById('loginWrap').style.display = 'block';
        }
    });
    if (getToken()) enterPanel();
});

async function adminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (!username || !password) { showToast('نام کاربری و رمز را وارد کنید', 'error'); return; }
    try {
        const data = await (await fetch(api('/api/admin/login'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
        })).json();
        if (data.error) throw new Error(data.error);
        setToken(data.token);
        enterPanel();
    } catch (e) { showToast(e.message, 'error'); }
}
function adminLogout() { clearToken(); location.reload(); }

function enterPanel() {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    switchAdminTab('overview');
    loadNotifications();
}

async function loadNotifications() {
    try {
        const n = await apiGet('/api/admin/notifications');
        const badge = document.getElementById('notifBadge');
        if (n.total > 0) { badge.textContent = n.total; badge.style.display = 'inline-block'; }
        else { badge.style.display = 'none'; }
        setTabBadge('tabBadgePending', n.pendingEdits + n.pendingPresentations + n.pendingReviews);
        setTabBadge('tabBadgeAds', n.pendingAds);
        setTabBadge('tabBadgeMessages', n.unreadMessages);
        setTabBadge('tabBadgeChat', n.pendingReports + n.pendingConversations);
        setTabBadge('tabBadgeSupport', n.pendingSupport);
    } catch {}
}
function setTabBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.textContent = count; el.style.display = 'inline-block'; }
    else { el.style.display = 'none'; }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-page').forEach(el => el.style.display = 'none');
    const target = document.getElementById('admin-' + tab);
    target.style.display = 'block';
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
    document.querySelectorAll('#adminTabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const loaders = {
        overview: loadOverview, pending: loadPending, companies: loadCompanies, offers: loadOffers,
        requests: loadRequests, rfqs: loadRfqs, services: loadServices, ads: loadAds, messages: loadMessages,
        files: loadFiles, lookups: loadLookups, chat: loadAdminChat, sms: loadAdminSms, support: loadAdminSupport, events: loadAdminEvents, content: loadAdminContent, problems: loadAdminProblems,
    };
    loaders[tab] && loaders[tab]();
}

// ------------------------------------------------------------------
// آمار کلی
// ------------------------------------------------------------------
let overviewChart;
async function loadOverview() {
    const el = document.getElementById('admin-overview');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const data = await apiGet('/api/admin/analytics');
        el.innerHTML = `
            <div class="stat-cards">
                <div class="stat-card"><div class="num">${data.totalViews}</div><div class="label">کل بازدید صفحات</div></div>
                <div class="stat-card"><div class="num">${data.totals.companies}</div><div class="label">واحد تولیدی</div></div>
                <div class="stat-card"><div class="num">${data.totals.offers}</div><div class="label">عرضه ثبت‌شده</div></div>
                <div class="stat-card"><div class="num">${data.totals.requests}</div><div class="label">درخواست خرید</div></div>
            </div>
            <canvas id="dailyViewsChart" height="120" style="margin-top:1rem;"></canvas>
            <h3 class="section-title" style="font-size:1rem;">پربازدیدترین صفحات</h3>
            <table class="admin-table"><tr><th>مسیر</th><th>بازدید</th></tr>
                ${data.topPaths.map(p => `<tr><td>${esc(p.path)}</td><td>${p.c}</td></tr>`).join('') || '<tr><td colspan="2">داده‌ای نیست</td></tr>'}
            </table>

            <h3 class="section-title" style="font-size:1rem;">ابزارها</h3>
            <div class="card" style="padding:1rem; margin-bottom:0.8rem;">
                <button class="btn btn-outline btn-sm" onclick="checkEnv()">بررسی تنظیمات GitHub/امنیتی</button>
                <div id="envCheckResult" style="margin-top:0.6rem; font-size:0.85rem;"></div>
            </div>
            <div class="card" style="padding:1rem; margin-bottom:0.8rem;">
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" onclick="downloadBackup()">📥 دانلود پشتیبان کامل (JSON)</button>
                    <button class="btn btn-outline btn-sm" onclick="downloadBackupCsv()">📊 خروجی اکسل (CSV)</button>
                    <label class="btn btn-outline btn-sm" style="cursor:pointer;">📤 بازیابی از فایل
                        <input type="file" id="restoreFile" accept=".json" style="display:none" onchange="uploadRestore(this)">
                    </label>
                </div>
                <p style="font-size:0.75rem; color:var(--text-light); margin-top:0.5rem;">قبل از هر تغییر بزرگ، حتماً یک پشتیبان بگیرید.</p>
            </div>
            <div class="card" style="padding:1rem; border-color:var(--red);">
                <b style="color:var(--red);">⚠️ پاک کردن همه اطلاعات آزمایشی</b>
                <p style="font-size:0.78rem; color:var(--text-light); margin:0.4rem 0;">همه شرکت‌ها، آگهی‌ها، درخواست‌ها و پیام‌ها حذف می‌شود (دسته‌بندی‌ها و شهرستان‌ها باقی می‌مانند). قابل بازگشت نیست مگر با پشتیبان.</p>
                <input type="text" id="wipeConfirmInput" placeholder="برای تایید بنویسید: پاک کن" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.5rem;">
                <button class="btn btn-danger btn-sm" onclick="wipeAllData()">پاک کردن همه چیز</button>
            </div>
        `;
        const labels = data.daily.map(d => d.day).reverse();
        const values = data.daily.map(d => d.c).reverse();
        if (overviewChart) overviewChart.destroy();
        overviewChart = new Chart(document.getElementById('dailyViewsChart'), {
            type: 'line',
            data: { labels: labels.length ? labels : ['بدون داده'], datasets: [{ label: 'بازدید روزانه', data: values.length ? values : [0], borderColor: '#0f3460', backgroundColor: 'rgba(15,52,96,0.1)', fill: true }] },
            options: { responsive: true, plugins: { legend: { display: false } } },
        });
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}

// ------------------------------------------------------------------
// ابزار تشخیصی / پشتیبان‌گیری / بازیابی / پاک‌سازی
// ------------------------------------------------------------------
async function checkEnv() {
    const el = document.getElementById('envCheckResult');
    el.innerHTML = 'در حال بررسی...';
    try {
        const r = await apiGet('/api/admin/env-check');
        const row = (label, ok, extra) => `<div>${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + esc(extra) : ''}</div>`;
        el.innerHTML =
            row('GITHUB_TOKEN', r.GITHUB_TOKEN) +
            row('GITHUB_OWNER', r.GITHUB_OWNER, r.GITHUB_OWNER_value) +
            row('GITHUB_UPLOADS_REPO', r.GITHUB_UPLOADS_REPO, r.GITHUB_UPLOADS_REPO_value) +
            row('GITHUB_BRANCH', r.GITHUB_BRANCH, r.GITHUB_BRANCH_value) +
            row('JWT_SECRET', r.JWT_SECRET) +
            row('SETUP_KEY', r.SETUP_KEY);
    } catch (e) { el.innerHTML = `<span style="color:var(--red);">${esc(e.message)}</span>`; }
}

async function downloadBackup() {
    try {
        const data = await apiGet('/api/admin/backup');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'tolid-markazi-backup-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('فایل پشتیبان دانلود شد', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

function tableToCsv(rows) {
    if (!rows || !rows.length) return '\uFEFF';
    const cols = Object.keys(rows[0]);
    let csv = '\uFEFF' + cols.join(',') + '\n';
    rows.forEach(r => {
        csv += cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    return csv;
}
function downloadCsvFile(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    a.click();
}
async function downloadBackupCsv() {
    try {
        const data = await apiGet('/api/admin/backup');
        const today = new Date().toISOString().slice(0, 10);
        ['companies', 'offers', 'purchase_requests', 'service_requests'].forEach(table => {
            if (data.tables[table] && data.tables[table].length) {
                downloadCsvFile(tableToCsv(data.tables[table]), `${table}-${today}.csv`);
            }
        });
        showToast('فایل‌های CSV دانلود شدند (هر جدول یک فایل)', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function uploadRestore(input) {
    if (!input.files || !input.files[0]) return;
    if (!confirm('اطلاعات فعلی با محتوای این فایل جایگزین می‌شود. مطمئنید؟')) { input.value = ''; return; }
    try {
        const text = await input.files[0].text();
        const data = JSON.parse(text);
        await apiSend('POST', '/api/admin/restore', data);
        showToast('بازیابی انجام شد', 'success');
        loadOverview();
    } catch (e) { showToast('خطا در بازیابی: ' + e.message, 'error'); }
    input.value = '';
}

async function wipeAllData() {
    const confirmText = document.getElementById('wipeConfirmInput').value.trim();
    if (confirmText !== 'پاک کن') { showToast('برای تایید عبارت «پاک کن» را دقیق تایپ کنید', 'error'); return; }
    if (!confirm('این عمل غیرقابل بازگشت است (مگر با فایل پشتیبان). ادامه می‌دهید؟')) return;
    try {
        await apiSend('POST', '/api/admin/wipe', { confirm: 'پاک کن' });
        showToast('همه اطلاعات آزمایشی پاک شد', 'success');
        loadOverview();
    } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// ویرایش‌های در انتظار تایید
// ------------------------------------------------------------------
async function loadPending() {
    const el = document.getElementById('admin-pending');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/pending-edits');
        const reviews = await apiGet('/api/admin/reviews?status=pending');
        el.innerHTML = `<h2 class="section-title">✏️ ویرایش‌های در انتظار تایید</h2>` + (items.map(it => {
            const changes = JSON.parse(it.changes_json || '{}');
            return `<div class="card" style="padding:1rem; margin-bottom:0.8rem;">
                <div style="font-size:0.85rem; color:var(--text-light);">نوع: ${{company:'پروفایل شرکت', offer:'آگهی محصول', service_request:'درخواست خدمات'}[it.entity_type] || it.entity_type} • شناسه: ${it.entity_id} • ${esc(toPersianDate(it.created_at, true))}</div>
                <ul class="spec-list">${Object.entries(changes).map(([k,v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('')}</ul>
                <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                    <button class="btn btn-primary btn-sm" onclick="decidePending(${it.id},'approved')">تایید و اعمال</button>
                    <button class="btn btn-danger btn-sm" onclick="decidePending(${it.id},'rejected')">رد</button>
                </div>
            </div>`;
        }).join('') || '<div class="empty-state">چیزی در انتظار تایید نیست</div>')
        + `<h2 class="section-title" style="margin-top:1.2rem;">⭐ نظرات در انتظار تایید</h2>`
        + (reviews.map(r => `
            <div class="card" style="padding:1rem; margin-bottom:0.8rem;">
                <div style="font-size:0.85rem;">نظر <b>${esc(r.reviewer_name)}</b> دربارهٔ <b>${esc(r.company_name)}</b> • ${esc(toPersianDate(r.created_at))}</div>
                <div style="margin:0.4rem 0; color:#b8860b;">${'⭐'.repeat(r.rating)}</div>
                ${r.comment ? `<p style="font-size:0.85rem;">${esc(r.comment)}</p>` : ''}
                <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                    <button class="btn btn-primary btn-sm" onclick="decideReview(${r.id},'approve')">تایید و نمایش عمومی</button>
                    <button class="btn btn-danger btn-sm" onclick="decideReview(${r.id},'reject')">رد</button>
                </div>
            </div>
        `).join('') || '<div class="empty-state">نظری در انتظار تایید نیست</div>');
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function decideReview(id, decision) {
    try { await apiSend('POST', `/api/admin/reviews/${id}/${decision}`, {}); showToast('ثبت شد', 'success'); loadPending(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function decidePending(id, decision) {
    try { await apiSend('PUT', `/api/admin/pending-edits/${id}`, { decision }); showToast('ثبت شد', 'success'); loadPending(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// نظارت بر گفتگوها (چت داخلی) و گزارش‌های تخلف
// ------------------------------------------------------------------
async function loadAdminChat() {
    const el = document.getElementById('admin-chat');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const [convos, reports, settings] = await Promise.all([
            apiGet('/api/admin/conversations'),
            apiGet('/api/admin/message-reports'),
            apiGet('/api/admin/settings'),
        ]);
        const pending = convos.filter(c => !c.approved);
        el.innerHTML = `
            <h2 class="section-title">⚙️ تنظیمات چت پلتفرم</h2>
            <div class="card" style="padding:1rem; margin-bottom:1.2rem;">
                <label style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border);">
                    <span>چت داخلی پلتفرم برای همه فعال باشد</span>
                    <input type="checkbox" id="chatEnabledToggle" ${settings.chat_enabled ? 'checked' : ''} onchange="updateChatSettings()" style="width:20px; height:20px;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0;">
                    <span>گفتگوهای جدید خودکار تایید شوند (بدون نیاز به تایید من)</span>
                    <input type="checkbox" id="chatAutoApproveToggle" ${settings.chat_auto_approve ? 'checked' : ''} onchange="updateChatSettings()" style="width:20px; height:20px;">
                </label>
                <p style="font-size:0.75rem; color:var(--text-light); margin-top:0.6rem;">
                    اگر تایید خودکار خاموش باشد، گفتگوی جدید فقط برای شروع‌کننده‌اش نمایش داده می‌شود تا وقتی از پایین همین صفحه تایید کنید؛ بعد از آن طرف مقابل هم می‌تواند آن را ببیند.
                </p>
            </div>

            ${pending.length ? `
            <h2 class="section-title">⏳ گفتگوهای در انتظار تایید</h2>
            ${pending.map(c => `
                <div class="card" style="padding:1rem; margin-bottom:0.8rem; border-right:3px solid var(--gold);">
                    <div style="font-size:0.85rem;">بین <b>${esc(c.company_a_name)}</b> و <b>${esc(c.company_b_name)}</b></div>
                    <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                        <button class="btn btn-outline btn-sm" onclick="viewAdminThread(${c.id})">مشاهدهٔ گفتگو</button>
                        <button class="btn btn-primary btn-sm" onclick="approveAdminConversation(${c.id})">تایید گفتگو</button>
                    </div>
                </div>
            `).join('')}
            ` : ''}

            <h2 class="section-title" style="margin-top:1.2rem;">🚩 گزارش‌های تخلف</h2>
            ${reports.map(r => `
                <div class="card" style="padding:1rem; margin-bottom:0.8rem; border-right:3px solid #dc2626;">
                    <div style="font-size:0.85rem; color:var(--text-light);">گزارش‌دهنده: ${esc(r.reported_by_name)}</div>
                    <p style="font-size:0.85rem; margin:0.3rem 0;">متن پیام: «${esc(r.message_body)}»</p>
                    ${r.reason ? `<div style="font-size:0.8rem; color:#dc2626;">دلیل: ${esc(r.reason)}</div>` : ''}
                    <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                        <button class="btn btn-outline btn-sm" onclick="viewAdminThread(${r.conversation_id})">مشاهدهٔ گفتگو</button>
                        <button class="btn btn-danger btn-sm" onclick="closeAdminConversation(${r.conversation_id})">بستن گفتگو</button>
                        <button class="btn btn-primary btn-sm" onclick="resolveReport(${r.id})">بررسی شد</button>
                    </div>
                </div>
            `).join('') || '<div class="empty-state">گزارش تخلفی ثبت نشده</div>'}

            <h2 class="section-title" style="margin-top:1.2rem;">💬 همهٔ گفتگوها</h2>
            <div class="table-wrap"><table class="admin-table">
                <tr><th>طرف اول</th><th>طرف دوم</th><th>تعداد پیام</th><th>وضعیت</th><th>عملیات</th></tr>
                ${convos.map(c => `<tr>
                    <td>${esc(c.company_a_name)}</td>
                    <td>${esc(c.company_b_name)}</td>
                    <td>${c.message_count}${c.pending_reports > 0 ? ` <span class="tab-badge" style="display:inline-block;">${c.pending_reports}</span>` : ''}</td>
                    <td>${!c.approved ? 'در انتظار تایید' : (c.status === 'closed_by_admin' ? 'بسته‌شده' : 'باز')}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn btn-sm btn-outline" onclick="viewAdminThread(${c.id})">مشاهده</button>
                        ${!c.approved ? `<button class="btn btn-sm btn-primary" onclick="approveAdminConversation(${c.id})">تایید</button>` : ''}
                        ${c.status === 'closed_by_admin'
                            ? `<button class="btn btn-sm btn-primary" onclick="reopenAdminConversation(${c.id})">بازگشایی</button>`
                            : `<button class="btn btn-sm btn-danger" onclick="closeAdminConversation(${c.id})">بستن</button>`}
                    </td>
                </tr>`).join('') || '<tr><td colspan="5">گفتگویی ثبت نشده</td></tr>'}
            </table></div>
            <div id="adminThreadView" style="display:none; margin-top:1rem;"></div>
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
// ------------------------------------------------------------------
// چت پشتیبانی: پاسخ به شرکت‌ها
// ------------------------------------------------------------------
let activeSupportThreadId = null;
async function loadAdminSupport() {
    const el = document.getElementById('admin-support');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const threads = await apiGet('/api/admin/support/threads');
        el.innerHTML = `
            <h2 class="section-title">🛟 پشتیبانی شرکت‌ها</h2>
            <div id="supportThreadsList">
                ${threads.map(t => `
                    <div class="chat-list-item" onclick='openAdminSupportThread(${t.id}, ${JSON.stringify(t.company_name)})'>
                        <div>
                            <div class="chat-list-name">${esc(t.company_name)} <span style="color:var(--text-light); font-size:0.75rem;">(${esc(t.company_phone)})</span></div>
                            <div class="chat-list-preview">${esc(t.last_message || 'هنوز پیامی نیست')}</div>
                        </div>
                        ${t.unread_count > 0 ? `<span class="chat-unread-badge">${t.unread_count}</span>` : ''}
                    </div>
                `).join('') || '<div class="empty-state">هنوز هیچ شرکتی پیام پشتیبانی نفرستاده</div>'}
            </div>
            <div id="adminSupportThreadView" style="display:none; margin-top:1rem;">
                <div class="card chat-card">
                    <div class="chat-thread-header">
                        <button class="chat-back-btn" onclick="document.getElementById('adminSupportThreadView').style.display='none'; document.getElementById('supportThreadsList').style.display='block';">← بازگشت</button>
                        <span id="adminSupportThreadTitle"></span>
                    </div>
                    <div id="adminSupportMessages" class="chat-messages"></div>
                    <div class="chat-input-row">
                        <input type="text" id="adminSupportInput" placeholder="پاسخ خود را بنویسید..." onkeydown="if(event.key==='Enter'){sendAdminSupportMessage();}">
                        <button onclick="sendAdminSupportMessage()">ارسال</button>
                    </div>
                </div>
            </div>
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function openAdminSupportThread(id, companyName) {
    activeSupportThreadId = id;
    document.getElementById('supportThreadsList').style.display = 'none';
    document.getElementById('adminSupportThreadView').style.display = 'block';
    document.getElementById('adminSupportThreadTitle').textContent = companyName;
    await loadAdminSupportMessages();
}
async function loadAdminSupportMessages() {
    if (!activeSupportThreadId) return;
    try {
        const msgs = await apiGet(`/api/admin/support/threads/${activeSupportThreadId}/messages`);
        document.getElementById('adminSupportMessages').innerHTML = msgs.map(m => `
            <div class="chat-bubble ${m.sender_type === 'admin' ? 'mine' : 'theirs'}">
                ${esc(m.body)}
                <span class="chat-bubble-time">${esc(toPersianDate(m.created_at, true))}</span>
            </div>
        `).join('') || '<div class="empty-state">پیامی نیست</div>';
    } catch (e) { showToast(e.message, 'error'); }
}
async function sendAdminSupportMessage() {
    const input = document.getElementById('adminSupportInput');
    const body = input.value.trim();
    if (!body || !activeSupportThreadId) return;
    input.value = '';
    try {
        await apiSend('POST', `/api/admin/support/threads/${activeSupportThreadId}/messages`, { body });
        loadAdminSupportMessages();
        loadNotifications();
    } catch (e) { showToast(e.message, 'error'); input.value = body; }
}

// ------------------------------------------------------------------
// تقویم رویدادهای صنعتی استان
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// اخبار و مناقصه‌ها (مدیریت محتوا)
// ------------------------------------------------------------------
async function loadAdminContent() {
    const el = document.getElementById('admin-content');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const [news, tenders] = await Promise.all([apiGet('/api/admin/news'), apiGet('/api/admin/tenders')]);
        const jobs = await apiGet('/api/admin/jobs');
        el.innerHTML = `
            <h2 class="section-title">📰 افزودن خبر جدید</h2>
            <div class="card" style="padding:1rem; margin-bottom:1rem;">
                <input type="text" id="newsTitle" placeholder="عنوان خبر" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.6rem;">
                <textarea id="newsBody" rows="3" placeholder="متن خبر" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.6rem; font-family:inherit;"></textarea>
                <input type="text" id="newsImage" placeholder="لینک تصویر (اختیاری)" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                <button class="btn btn-primary" style="width:100%; margin-top:0.6rem;" onclick="addNews()">انتشار خبر</button>
            </div>
            <table class="admin-table">
                <tr><th>عنوان</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr>
                ${news.map(n => `<tr>
                    <td>${esc(n.title)}</td><td>${esc(toPersianDate(n.created_at))}</td>
                    <td>${n.published ? 'منتشرشده' : 'پیش‌نویس'}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="delNews(${n.id})">حذف</button></td>
                </tr>`).join('') || '<tr><td colspan="4">خبری ثبت نشده</td></tr>'}
            </table>

            <h2 class="section-title" style="margin-top:1.2rem;">📋 مناقصه‌های ثبت‌شده</h2>
            <table class="admin-table">
                <tr><th>عنوان</th><th>شرکت</th><th>مهلت</th><th>پیشنهادها</th><th>عملیات</th></tr>
                ${tenders.map(t => `<tr>
                    <td>${esc(t.title)}</td><td>${esc(t.company_name)}</td>
                    <td>${esc(toPersianDate(t.deadline))}</td><td>${t.bid_count || 0}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="delTender(${t.id})">حذف</button></td>
                </tr>`).join('') || '<tr><td colspan="5">مناقصه‌ای ثبت نشده</td></tr>'}
            </table>

            <h2 class="section-title" style="margin-top:1.2rem;">💼 آگهی‌های استخدام</h2>
            <table class="admin-table">
                <tr><th>عنوان</th><th>شرکت</th><th>شهرستان</th><th>عملیات</th></tr>
                ${jobs.map(j => `<tr>
                    <td>${esc(j.title)}</td><td>${esc(j.company_name)}</td><td>${esc(j.county||'-')}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="delJobAdmin(${j.id})">حذف</button></td>
                </tr>`).join('') || '<tr><td colspan="4">آگهی‌ای ثبت نشده</td></tr>'}
            </table>
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function addNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const body = document.getElementById('newsBody').value.trim();
    if (!title || !body) { showToast('عنوان و متن الزامی است', 'error'); return; }
    try {
        await apiSend('POST', '/api/admin/news', { title, body, imageUrl: document.getElementById('newsImage').value.trim() });
        showToast('خبر منتشر شد', 'success');
        loadAdminContent();
    } catch (e) { showToast(e.message, 'error'); }
}
async function delNews(id) {
    try { await apiSend('DELETE', `/api/admin/news/${id}`); loadAdminContent(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function delTender(id) {
    try { await apiSend('DELETE', `/api/admin/tenders/${id}`); loadAdminContent(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function delJobAdmin(id) {
    try { await apiSend('DELETE', `/api/admin/jobs/${id}`); loadAdminContent(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// مشکلات مشترک، بازدید استانداری و پیگیری مصوبات
// ------------------------------------------------------------------
const PROBLEM_STATUSES = ['ثبت شده', 'در دستور بازدید', 'بازدید شد', 'دارای مصوبه', 'بسته شده'];
const RESOLUTION_STATUSES = ['در حال اجرا', 'اجرا شد', 'اجرا نشد'];

async function loadAdminProblems() {
    const el = document.getElementById('admin-problems');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const problems = await apiGet('/api/admin/problems');
        el.innerHTML = `
            <h2 class="section-title">⚠️ مشکلات ثبت‌شده و پیگیری بازدید</h2>
            ${problems.map(p => `
                <div class="card" style="padding:1rem; margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                        <div>
                            <div style="font-weight:800;">${esc(p.title)}</div>
                            <div style="font-size:0.78rem; color:var(--text-light); margin-top:0.2rem;">
                                ${esc(p.company || 'ناشناس')} — ${esc(p.phone || '')} • ${esc(p.county || '-')} ${p.category ? '• ' + esc(p.category) : ''} • ${esc(toPersianDate(p.created_at))}
                                ${p.urgency === 'فوری' ? ' • <span style="color:#dc2626; font-weight:700;">فوری</span>' : ''}
                            </div>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="delProblemAdmin(${p.id})">حذف</button>
                    </div>
                    ${p.description ? `<p style="font-size:0.85rem; margin-top:0.5rem;">${esc(p.description)}</p>` : ''}

                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.7rem; align-items:center;">
                        <select id="pStatus-${p.id}" style="padding:0.4rem; border-radius:8px; border:1px solid var(--border);">
                            ${PROBLEM_STATUSES.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        <input type="date" id="pVisit-${p.id}" value="${esc((p.visit_date || '').slice(0, 10))}" style="padding:0.4rem; border-radius:8px; border:1px solid var(--border);">
                        <button class="btn btn-sm btn-primary" onclick="updateProblemStatus(${p.id})">به‌روزرسانی وضعیت</button>
                    </div>

                    <div style="margin-top:0.8rem; padding-top:0.8rem; border-top:1px dashed var(--border);">
                        <div style="font-size:0.82rem; font-weight:700; margin-bottom:0.5rem;">مصوبات:</div>
                        ${(p.resolutions || []).map(r => `
                            <div style="background:#f7f8fa; border-radius:8px; padding:0.6rem 0.8rem; margin-bottom:0.5rem; font-size:0.82rem;">
                                <b>${esc(r.title)}</b> ${r.responsible_org ? '— مسئول: ' + esc(r.responsible_org) : ''} ${r.deadline ? '— مهلت: ' + esc(toPersianDate(r.deadline)) : ''}
                                <div style="display:flex; gap:0.4rem; margin-top:0.4rem; align-items:center;">
                                    <select id="rStatus-${r.id}" style="padding:0.3rem; border-radius:6px; border:1px solid var(--border); font-size:0.78rem;">
                                        ${RESOLUTION_STATUSES.map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                    <input type="text" id="rNotes-${r.id}" placeholder="یادداشت پیگیری" value="${esc(r.notes || '')}" style="flex:1; padding:0.3rem 0.5rem; border-radius:6px; border:1px solid var(--border); font-size:0.78rem;">
                                    <button class="btn btn-sm btn-outline" onclick="updateResolution(${r.id}, ${p.id})">ثبت</button>
                                </div>
                            </div>
                        `).join('') || '<div style="font-size:0.78rem; color:var(--text-light);">هنوز مصوبه‌ای ثبت نشده</div>'}

                        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.6rem;">
                            <input type="text" id="newResTitle-${p.id}" placeholder="عنوان مصوبهٔ جدید" style="flex:1; min-width:120px; padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border); font-size:0.8rem;">
                            <input type="text" id="newResOrg-${p.id}" placeholder="سازمان مسئول" style="width:110px; padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border); font-size:0.8rem;">
                            <input type="date" id="newResDeadline-${p.id}" style="padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border); font-size:0.8rem;">
                            <button class="btn btn-sm btn-gold" onclick="addResolution(${p.id})">+ افزودن مصوبه</button>
                        </div>
                    </div>
                </div>
            `).join('') || '<div class="empty-state">مشکلی ثبت نشده</div>'}
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function updateProblemStatus(id) {
    const status = document.getElementById(`pStatus-${id}`).value;
    const visitDate = document.getElementById(`pVisit-${id}`).value;
    try {
        await apiSend('PUT', `/api/admin/problems/${id}`, { status, visitDate });
        showToast('وضعیت به‌روزرسانی شد', 'success');
        loadAdminProblems();
    } catch (e) { showToast(e.message, 'error'); }
}
async function addResolution(problemId) {
    const title = document.getElementById(`newResTitle-${problemId}`).value.trim();
    if (!title) { showToast('عنوان مصوبه را وارد کنید', 'error'); return; }
    try {
        await apiSend('POST', `/api/admin/problems/${problemId}/resolutions`, {
            title,
            responsibleOrg: document.getElementById(`newResOrg-${problemId}`).value.trim(),
            deadline: document.getElementById(`newResDeadline-${problemId}`).value,
        });
        showToast('مصوبه ثبت شد', 'success');
        loadAdminProblems();
    } catch (e) { showToast(e.message, 'error'); }
}
async function updateResolution(id, problemId) {
    const status = document.getElementById(`rStatus-${id}`).value;
    const notes = document.getElementById(`rNotes-${id}`).value.trim();
    try {
        await apiSend('PUT', `/api/admin/resolutions/${id}`, { status, notes });
        showToast('پیگیری ثبت شد', 'success');
        loadAdminProblems();
    } catch (e) { showToast(e.message, 'error'); }
}
async function delProblemAdmin(id) {
    try { await apiSend('DELETE', `/api/admin/problems/${id}`); loadAdminProblems(); }
    catch (e) { showToast(e.message, 'error'); }
}

async function loadAdminEvents() {
    const el = document.getElementById('admin-events');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const events = await apiGet('/api/admin/events');
        el.innerHTML = `
            <h2 class="section-title">📅 افزودن رویداد جدید</h2>
            <div class="card" style="padding:1rem; margin-bottom:1rem;">
                <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                    <input type="text" id="evTitle" placeholder="عنوان رویداد" style="padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                    <input type="date" id="evDate" style="padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                </div>
                <input type="text" id="evLocation" placeholder="محل برگزاری" style="width:100%; margin-top:0.6rem; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                <textarea id="evDescription" rows="2" placeholder="توضیحات" style="width:100%; margin-top:0.6rem; padding:0.5rem; border-radius:8px; border:1px solid var(--border); font-family:inherit;"></textarea>
                <input type="text" id="evLink" placeholder="لینک بیشتر (اختیاری)" style="width:100%; margin-top:0.6rem; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                <button class="btn btn-primary" style="width:100%; margin-top:0.6rem;" onclick="addEvent()">افزودن رویداد</button>
            </div>
            <h2 class="section-title">همهٔ رویدادها</h2>
            <table class="admin-table">
                <tr><th>عنوان</th><th>تاریخ</th><th>محل</th><th>عملیات</th></tr>
                ${events.map(ev => `<tr>
                    <td>${esc(ev.title)}</td>
                    <td>${esc(toPersianDate(ev.event_date))}</td>
                    <td>${esc(ev.location || '-')}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="delEvent(${ev.id})">حذف</button></td>
                </tr>`).join('') || '<tr><td colspan="4">رویدادی ثبت نشده</td></tr>'}
            </table>
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function addEvent() {
    const title = document.getElementById('evTitle').value.trim();
    const eventDate = document.getElementById('evDate').value;
    if (!title || !eventDate) { showToast('عنوان و تاریخ الزامی است', 'error'); return; }
    try {
        await apiSend('POST', '/api/admin/events', {
            title, eventDate,
            location: document.getElementById('evLocation').value.trim(),
            description: document.getElementById('evDescription').value.trim(),
            link: document.getElementById('evLink').value.trim(),
        });
        showToast('رویداد اضافه شد', 'success');
        loadAdminEvents();
    } catch (e) { showToast(e.message, 'error'); }
}
async function delEvent(id) {
    try { await apiSend('DELETE', `/api/admin/events/${id}`); loadAdminEvents(); }
    catch (e) { showToast(e.message, 'error'); }
}

async function loadAdminSms() {
    const el = document.getElementById('admin-sms');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const [companies, counties, log] = await Promise.all([
            apiGet('/api/admin/companies'), apiGet('/api/admin/counties'), apiGet('/api/admin/sms/log'),
        ]);
        window._smsCompanies = companies;
        el.innerHTML = `
            <h2 class="section-title">📨 ارسال پیامک از گوشی خودتان</h2>
            <p style="font-size:0.78rem; color:var(--text-light); margin-bottom:0.8rem;">
                چون هنوز حساب سرویس پیامکی وصل نیست، ارسال از طریق اپ پیامک خودِ گوشی‌تان انجام می‌شود:
                گیرنده(ها) و متن را انتخاب کنید، بعد روی هرکدام که می‌خواهید بزنید تا اپ پیامک گوشی‌تان با شماره و متن آماده باز شود — فقط دکمهٔ ارسال را در همان‌جا بزنید.
            </p>

            <div class="card" style="padding:1rem; margin-bottom:1rem;">
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.7rem;">
                    <select id="smsCountyFilter" onchange="renderSmsRecipients()" style="padding:0.4rem; border-radius:8px; border:1px solid var(--border);">
                        <option value="">همهٔ شهرستان‌ها</option>
                        ${counties.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="smsRoleFilter" onchange="renderSmsRecipients()" style="padding:0.4rem; border-radius:8px; border:1px solid var(--border);">
                        <option value="">همهٔ نقش‌ها</option>
                        <option value="producer">تولیدکننده</option>
                        <option value="service">خدمات‌دهنده</option>
                        <option value="buyer">خریدار</option>
                        <option value="other">سایر</option>
                    </select>
                    <button class="btn btn-outline btn-sm" onclick="selectAllSmsRecipients(true)">انتخاب همه</button>
                    <button class="btn btn-outline btn-sm" onclick="selectAllSmsRecipients(false)">پاک‌کردن انتخاب</button>
                </div>
                <div id="smsRecipientsList" style="max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:0.5rem;"></div>
                <div style="font-size:0.78rem; color:var(--text-light); margin-top:0.5rem;"><span id="smsSelectedCount">0</span> نفر انتخاب شده</div>

                <textarea id="smsMessage" rows="3" placeholder="متن پیامک..." oninput="renderSmsSendLinks()" style="width:100%; margin-top:0.8rem; padding:0.6rem; border-radius:8px; border:1px solid var(--border); font-family:inherit;"></textarea>
                <button class="btn btn-gold" style="width:100%; margin-top:0.6rem;" onclick="renderSmsSendLinks()">آماده‌سازی پیامک‌ها</button>

                <div id="smsSendLinks" style="margin-top:0.8rem;"></div>
            </div>

            <h2 class="section-title">تاریخچهٔ ارسال‌ها</h2>
            <table class="admin-table">
                <tr><th>گیرنده</th><th>متن</th><th>تاریخ</th></tr>
                ${log.map(s => `<tr>
                    <td>${esc(s.company_name || s.phone)}</td>
                    <td>${esc((s.message || '').slice(0, 40))}</td>
                    <td>${esc(toPersianDate(s.created_at, true))}</td>
                </tr>`).join('') || '<tr><td colspan="3">هنوز پیامکی ارسال نشده</td></tr>'}
            </table>
        `;
        renderSmsRecipients();
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}

function renderSmsRecipients() {
    const county = document.getElementById('smsCountyFilter').value;
    const role = document.getElementById('smsRoleFilter').value;
    const list = (window._smsCompanies || []).filter(c =>
        (!county || c.county === county) && (!role || c.role === role)
    );
    const box = document.getElementById('smsRecipientsList');
    box.innerHTML = list.map(c => `
        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0; font-size:0.85rem;">
            <input type="checkbox" class="sms-recipient" value="${c.id}" onchange="updateSmsSelectedCount()">
            ${esc(c.name)} <span style="color:var(--text-light); font-size:0.75rem;">(${esc(c.phone)} — ${esc(c.county || '-')})</span>
        </label>
    `).join('') || '<div class="empty-state">کسی با این فیلتر یافت نشد</div>';
    updateSmsSelectedCount();
}
function selectAllSmsRecipients(state) {
    document.querySelectorAll('.sms-recipient').forEach(cb => { cb.checked = state; });
    updateSmsSelectedCount();
}
function updateSmsSelectedCount() {
    document.getElementById('smsSelectedCount').textContent = document.querySelectorAll('.sms-recipient:checked').length;
}

function renderSmsSendLinks() {
    const ids = [...document.querySelectorAll('.sms-recipient:checked')].map(cb => parseInt(cb.value));
    const message = document.getElementById('smsMessage').value.trim();
    const box = document.getElementById('smsSendLinks');
    if (!ids.length) { showToast('حداقل یک گیرنده انتخاب کنید', 'error'); return; }
    if (!message) { showToast('متن پیامک را بنویسید', 'error'); return; }
    const recipients = (window._smsCompanies || []).filter(c => ids.includes(c.id));
    box.innerHTML = `<div style="font-size:0.8rem; font-weight:700; margin-bottom:0.5rem;">روی هرکدام بزنید تا اپ پیامک گوشی‌تان باز شود:</div>` +
        recipients.map(c => `
            <a href="sms:${esc(c.phone)}?body=${encodeURIComponent(message)}"
               onclick="logSmsSent(${c.id})"
               class="btn btn-outline btn-sm" style="display:block; width:100%; text-align:right; margin-bottom:0.4rem;">
               📤 ارسال به ${esc(c.name)} (${esc(c.phone)})
            </a>
        `).join('');
}
async function logSmsSent(companyId) {
    const message = document.getElementById('smsMessage').value.trim();
    try { await apiSend('POST', '/api/admin/sms/log', { companyId, message }); } catch (e) { /* ثبت تاریخچه اختیاری است */ }
}

async function updateChatSettings() {
    try {
        await apiSend('PUT', '/api/admin/settings', {
            chat_enabled: document.getElementById('chatEnabledToggle').checked ? 1 : 0,
            chat_auto_approve: document.getElementById('chatAutoApproveToggle').checked ? 1 : 0,
        });
        showToast('تنظیمات ذخیره شد', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}
async function approveAdminConversation(id) {
    try { await apiSend('POST', `/api/admin/conversations/${id}/approve`, {}); showToast('گفتگو تایید شد', 'success'); loadAdminChat(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function viewAdminThread(conversationId) {
    const box = document.getElementById('adminThreadView');
    box.style.display = 'block';
    box.innerHTML = '<div class="loading">در حال بارگذاری گفتگو...</div>';
    box.scrollIntoView({ behavior: 'smooth' });
    try {
        const msgs = await apiGet(`/api/admin/conversations/${conversationId}/messages`);
        box.innerHTML = `<h3 class="section-title" style="font-size:1rem; display:flex; justify-content:space-between; align-items:center;">متن گفتگو <button onclick="document.getElementById('adminThreadView').style.display='none';" style="background:none; border:none; font-size:1.1rem; cursor:pointer; color:var(--text-light);">✕</button></h3>
            <div class="card" style="padding:1rem; max-height:360px; overflow-y:auto;">
                ${msgs.map(m => `<div style="margin-bottom:0.6rem;"><b>${esc(m.sender_name)}</b> <span style="color:var(--text-light); font-size:0.72rem;">${esc(toPersianDate(m.created_at, true))}</span><div>${esc(m.body)}</div></div>`).join('') || '<div class="empty-state">پیامی نیست</div>'}
            </div>`;
    } catch (e) { box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function closeAdminConversation(id) {
    try { await apiSend('POST', `/api/admin/conversations/${id}/close`, {}); showToast('گفتگو بسته شد', 'success'); loadAdminChat(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function reopenAdminConversation(id) {
    try { await apiSend('POST', `/api/admin/conversations/${id}/reopen`, {}); showToast('گفتگو بازگشایی شد', 'success'); loadAdminChat(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function resolveReport(id) {
    try { await apiSend('POST', `/api/admin/message-reports/${id}/resolve`, {}); showToast('ثبت شد', 'success'); loadAdminChat(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// واحدهای تولیدی
// ------------------------------------------------------------------
let adminCache = {};

async function loadCompanies() {
    const el = document.getElementById('admin-companies');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        adminCache.companies = await apiGet('/api/admin/companies');
        renderCompaniesTable();
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
function renderCompaniesTable() {
    const el = document.getElementById('admin-companies');
    const q = (document.getElementById('companiesAdminSearch')?.value || '').trim().toLowerCase();
    let items = adminCache.companies || [];
    if (q) items = items.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q));
    el.innerHTML = `<h2 class="section-title">🏭 واحدهای تولیدی</h2>
        <input type="text" id="companiesAdminSearch" placeholder="جستجوی نام یا شماره..." value="${esc(q)}" oninput="renderCompaniesTable()" style="width:100%; padding:0.55rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.8rem;">
        <div class="table-wrap"><table class="admin-table">
            <tr><th>نام</th><th>نقش</th><th>شهرستان</th><th>تاریخ ثبت‌نام</th><th>وضعیت</th><th>پرزنت</th><th>عملیات</th></tr>
            ${items.map(c => `<tr>
                <td>${esc(c.name)}<br><small style="color:var(--text-light)">${esc(c.phone)}</small></td>
                <td>${esc(ROLE_LABELS[c.role] || c.role || '-')}</td>
                <td>${esc(c.county||'-')}</td>
                <td>${esc(toPersianDate(c.created_at))}</td>
                <td>${c.verified ? '✔ تأیید شده' : 'در انتظار'} / ${c.active ? 'فعال' : 'غیرفعال'}</td>
                <td>${c.presentation_status === 'pending' ? `<button class="btn btn-sm btn-outline" onclick="decidePresentation(${c.id},'approved')">تایید پرزنت</button> <button class="btn btn-sm btn-danger" onclick="decidePresentation(${c.id},'rejected')">رد</button>` : (c.presentation_status||'-')}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-sm ${c.verified?'btn-outline':'btn-primary'}" onclick="toggleCompany(${c.id},'verified',${c.verified?0:1})">${c.verified?'لغو تأیید':'تأیید'}</button>
                    <button class="btn btn-sm ${c.active?'btn-danger':'btn-outline'}" onclick="toggleCompany(${c.id},'active',${c.active?0:1})">${c.active?'غیرفعال':'فعال'}</button>
                    <button class="btn btn-sm btn-outline" onclick="resetCompanyPassword(${c.id})">تنظیم رمز جدید</button>
                    <button class="btn btn-sm btn-outline" onclick="testPush(${c.id})">🔔 تست پوش</button>
                </td>
            </tr>`).join('') || '<tr><td colspan="7">نتیجه‌ای یافت نشد</td></tr>'}
        </table></div>`;
    document.getElementById('companiesAdminSearch').focus();
    document.getElementById('companiesAdminSearch').setSelectionRange(q.length, q.length);
}
async function toggleCompany(id, field, value) {
    try { await apiSend('PUT', `/api/admin/companies/${id}`, { [field]: value }); loadCompanies(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function resetCompanyPassword(id) {
    const pw = prompt('رمز جدید برای این کاربر را وارد کنید (حداقل ۴ کاراکتر):');
    if (!pw) return;
    try {
        await apiSend('POST', `/api/admin/companies/${id}/reset-password`, { newPassword: pw });
        showToast('رمز عبور تغییر کرد؛ آن را به کاربر اطلاع دهید', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}
async function testPush(companyId) {
    try {
        const res = await apiSend('POST', '/api/admin/push/test', { companyId });
        showToast(`پیام آزمایشی به ${res.deviceCount} دستگاه ارسال شد`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}
async function decidePresentation(id, status) {
    try { await apiSend('PUT', `/api/admin/companies/${id}`, { presentation_status: status }); showToast('ثبت شد', 'success'); loadCompanies(); loadNotifications(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// عرضه‌ها
// ------------------------------------------------------------------
async function loadOffers() {
    const el = document.getElementById('admin-offers');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        adminCache.offers = await apiGet('/api/admin/offers');
        renderOffersTable();
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
function renderOffersTable() {
    const el = document.getElementById('admin-offers');
    const q = (document.getElementById('offersAdminSearch')?.value || '').trim().toLowerCase();
    let items = adminCache.offers || [];
    if (q) items = items.filter(o => (o.title||'').toLowerCase().includes(q) || (o.company_name||'').toLowerCase().includes(q));
    el.innerHTML = `<h2 class="section-title">📦 عرضه‌ها</h2>
        <input type="text" id="offersAdminSearch" placeholder="جستجوی عنوان یا شرکت..." value="${esc(q)}" oninput="renderOffersTable()" style="width:100%; padding:0.55rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.8rem;">
        <div class="table-wrap"><table class="admin-table">
            <tr><th>عنوان</th><th>شرکت</th><th>قیمت</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr>
            ${items.map(o => `<tr>
                <td>${esc(o.title)}</td><td>${esc(o.company_name)}</td><td>${esc(o.price||'-')}</td>
                <td>${esc(toPersianDate(o.created_at))}</td>
                <td>${o.verified?'✔ تأیید':'در انتظار'} / ${o.active?'فعال':'غیرفعال'} ${o.featured?'/ ⭐ ستاره‌خواسته':''} ${o.featured_approved?'/ ⭐تاییدشده':''}</td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-sm ${o.verified?'btn-outline':'btn-primary'}" onclick="toggleOffer(${o.id},'verified',${o.verified?0:1})">${o.verified?'لغو تأیید':'تأیید'}</button>
                    <button class="btn btn-sm ${o.featured_approved?'btn-outline':'btn-gold'}" onclick="toggleOffer(${o.id},'featured_approved',${o.featured_approved?0:1})">${o.featured_approved?'حذف ستاره':'ستاره‌دار کن'}</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteOffer(${o.id})">حذف</button>
                </td>
            </tr>`).join('') || '<tr><td colspan="6">نتیجه‌ای یافت نشد</td></tr>'}
        </table></div>`;
    const inp = document.getElementById('offersAdminSearch');
    inp.focus(); inp.setSelectionRange(q.length, q.length);
}
async function toggleOffer(id, field, value) {
    try { await apiSend('PUT', `/api/admin/offers/${id}`, { [field]: value }); loadOffers(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function deleteOffer(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/offers/${id}`); loadOffers(); } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// درخواست‌های خرید
// ------------------------------------------------------------------
async function loadRequests() {
    const el = document.getElementById('admin-requests');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        adminCache.requests = await apiGet('/api/admin/requests');
        renderRequestsList();
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
function renderRequestsList() {
    const el = document.getElementById('admin-requests');
    const q = (document.getElementById('requestsAdminSearch')?.value || '').trim().toLowerCase();
    let items = adminCache.requests || [];
    if (q) items = items.filter(r => (r.product||'').toLowerCase().includes(q) || (r.company||'').toLowerCase().includes(q));
    el.innerHTML = `<h2 class="section-title">📋 درخواست‌های خرید</h2>
        <input type="text" id="requestsAdminSearch" placeholder="جستجوی محصول یا شرکت..." value="${esc(q)}" oninput="renderRequestsList()" style="width:100%; padding:0.55rem; border-radius:8px; border:1px solid var(--border); margin-bottom:0.8rem;">` +
        (items.map(r => `
            <div class="card" style="padding:0.9rem; margin-bottom:0.6rem;">
                <div style="display:flex; justify-content:space-between;">
                    <b>${esc(r.product)}</b>
                    <button class="btn btn-sm btn-danger" onclick="deleteRequest(${r.id})">حذف</button>
                </div>
                <div style="font-size:0.82rem; color:var(--text-light);">${esc(r.company)} • ${esc(r.quantity)} ${esc(r.unit||'')} • ${esc(toPersianDate(r.created_at))}</div>
                ${r.responses && r.responses.length
                    ? `<div style="margin-top:0.5rem; font-size:0.82rem;">✅ پاسخ‌ها: ${r.responses.map(rr => `${esc(rr.company_name)} (<a href="tel:${esc(rr.phone)}">${esc(rr.phone)}</a>)`).join('، ')}</div>`
                    : `<div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-light);">هنوز پاسخی نیامده</div>`}
            </div>`).join('') || '<div class="empty-state">نتیجه‌ای یافت نشد</div>');
    const inp = document.getElementById('requestsAdminSearch');
    inp.focus(); inp.setSelectionRange(q.length, q.length);
}
async function deleteRequest(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/requests/${id}`); loadRequests(); } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// استعلام‌ها (RFQ)
// ------------------------------------------------------------------
async function loadRfqs() {
    const el = document.getElementById('admin-rfqs');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/rfqs');
        el.innerHTML = `<h2 class="section-title">📨 استعلام‌های قیمت</h2><div class="table-wrap"><table class="admin-table">
            <tr><th>آگهی</th><th>درخواست‌کننده</th><th>تماس</th><th>مقدار</th><th>وضعیت</th></tr>
            ${items.map(r => `<tr><td>${esc(r.offer_title)}</td><td>${esc(r.company_name||'-')}</td><td>${esc(r.phone)}</td><td>${esc(r.quantity||'-')}</td><td>${esc(r.status)}</td></tr>`).join('')}
        </table></div>` || '<div class="empty-state">استعلامی ثبت نشده</div>';
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}

// ------------------------------------------------------------------
// پیام‌های تماس/پیشنهاد/پشتیبانی
// ------------------------------------------------------------------
async function loadMessages() {
    const el = document.getElementById('admin-messages');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/contact-messages');
        el.innerHTML = `<h2 class="section-title">✉️ پیام‌های تماس/پیشنهاد</h2>` + (items.map(m => `
            <div class="card" style="padding:0.9rem; margin-bottom:0.6rem;">
                <div style="display:flex; justify-content:space-between;">
                    <b>${esc(m.subject || 'بدون موضوع')}</b>
                    <span class="badge ${m.status === 'خوانده‌نشده' ? 'badge-urgent' : 'badge-status'}">${esc(m.status)}</span>
                </div>
                <div style="font-size:0.82rem; color:var(--text-light); margin:0.3rem 0;">${esc(m.name||'ناشناس')} ${m.phone ? '— ' + esc(m.phone) : ''} • ${esc(toPersianDate(m.created_at, true))}</div>
                <p style="font-size:0.88rem;">${esc(m.message)}</p>
                <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button class="btn btn-sm btn-outline" onclick="setMessageStatus(${m.id},'خوانده‌شد')">علامت خوانده‌شد</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMessage(${m.id})">حذف</button>
                </div>
            </div>`).join('') || '<div class="empty-state">پیامی دریافت نشده</div>');
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function setMessageStatus(id, status) {
    try { await apiSend('PUT', `/api/admin/contact-messages/${id}`, { status }); loadMessages(); loadNotifications(); } catch (e) { showToast(e.message, 'error'); }
}
async function deleteMessage(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/contact-messages/${id}`); loadMessages(); } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// درخواست خدمات
// ------------------------------------------------------------------
async function loadServices() {
    const el = document.getElementById('admin-services');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/service-requests');
        el.innerHTML = `<h2 class="section-title">🧑‍💼 درخواست خدمات</h2><div class="table-wrap"><table class="admin-table">
            <tr><th>عنوان</th><th>شرکت</th><th>وضعیت</th><th>عملیات</th></tr>
            ${items.map(s => `<tr><td>${esc(s.role_title)}</td><td>${esc(s.company)}</td><td>${esc(s.status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="setServiceStatus(${s.id},'در حال بررسی')">در حال بررسی</button>
                    <button class="btn btn-sm btn-primary" onclick="setServiceStatus(${s.id},'بسته شد')">بسته شد</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">حذف</button>
                </td></tr>`).join('')}
        </table></div>`;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function setServiceStatus(id, status) {
    try { await apiSend('PUT', `/api/admin/service-requests/${id}`, { status }); loadServices(); } catch (e) { showToast(e.message, 'error'); }
}
async function deleteService(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/service-requests/${id}`); loadServices(); } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// تبلیغات
// ------------------------------------------------------------------
async function loadAds() {
    const el = document.getElementById('admin-ads');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/ads');
        el.innerHTML = `<h2 class="section-title">📢 تبلیغات</h2><div class="table-wrap"><table class="admin-table">
            <tr><th>نوع</th><th>عنوان</th><th>آگهی‌دهنده</th><th>وضعیت</th><th>عملیات</th></tr>
            ${items.map(a => `<tr>
                <td>${esc(a.ad_type)}</td><td>${esc(a.title||'-')}</td><td>${esc(a.advertiser_name)}<br><small>${esc(a.advertiser_phone)}</small></td>
                <td>${esc(a.status)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="setAdStatus(${a.id},'approved')">تایید</button>
                    <button class="btn btn-sm btn-outline" onclick="setAdStatus(${a.id},'rejected')">رد</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAd(${a.id})">حذف</button>
                </td>
            </tr>`).join('')}
        </table></div>
        <h3 class="section-title" style="font-size:1rem;">ثبت تبلیغ مستقیم توسط مدیر</h3>
        <div class="card" style="padding:1rem; max-width:480px;">
            <div class="form-group"><label>نوع</label><select id="newAdType"><option value="text">متن</option><option value="image">عکس</option><option value="video">ویدیو</option></select></div>
            <div class="form-group"><label>عنوان</label><input type="text" id="newAdTitle"></div>
            <div class="form-group"><label>متن</label><textarea id="newAdBody" rows="2"></textarea></div>
            <div class="form-group"><label>عکس (آپلود)</label><input type="file" id="newAdImage" accept="image/*"></div>
            <div class="form-group"><label>یا مستقیم لینک عکس</label><input type="text" id="newAdImageUrl" placeholder="https://..."></div>
            <div class="form-group"><label>لینک ویدیو</label><input type="text" id="newAdVideo" placeholder="لینک آپارات/یوتیوب"></div>
            <button class="btn btn-gold" style="width:100%;" onclick="createAdDirect()">ثبت و تایید فوری</button>
        </div>`;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function setAdStatus(id, status) {
    try { await apiSend('PUT', `/api/admin/ads/${id}`, { status }); loadAds(); loadNotifications(); } catch (e) { showToast(e.message, 'error'); }
}
async function deleteAd(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/ads/${id}`); loadAds(); } catch (e) { showToast(e.message, 'error'); }
}
async function createAdDirect() {
    try {
        let imageUrl = document.getElementById('newAdImageUrl').value.trim();
        const fileInput = document.getElementById('newAdImage');
        if (!imageUrl && fileInput.files && fileInput.files[0]) {
            const fd = new FormData(); fd.append('file', fileInput.files[0]);
            const res = await fetch(api('/api/upload'), { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            imageUrl = data.url;
        }
        // ثبت به‌عنوان درخواست عمومی سپس تایید فوری
        const created = await (await fetch(api('/api/ads'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adType: document.getElementById('newAdType').value, title: document.getElementById('newAdTitle').value,
                bodyText: document.getElementById('newAdBody').value, advertiserName: 'مدیر سایت', advertiserPhone: '-' }),
        })).json();
        await apiSend('PUT', `/api/admin/ads/${created.id}`, { status: 'approved', image_url: imageUrl, video_embed_url: document.getElementById('newAdVideo').value });
        showToast('تبلیغ ثبت و فعال شد', 'success');
        loadAds();
    } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// فایل‌های مفید
// ------------------------------------------------------------------
async function loadFiles() {
    const el = document.getElementById('admin-files');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const items = await apiGet('/api/admin/admin-files');
        el.innerHTML = `<h2 class="section-title">📁 فایل‌های مفید</h2><div class="table-wrap"><table class="admin-table">
            <tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>عملیات</th></tr>
            ${items.map(f => `<tr><td>${esc(f.title)}</td><td>${esc(f.file_type||'-')}</td><td>${f.is_locked?'قفل (فروشی)':'رایگان'}</td>
                <td><button class="btn btn-sm ${f.is_locked?'btn-outline':'btn-gold'}" onclick="toggleFileLock(${f.id},${f.is_locked?0:1})">${f.is_locked?'رایگان کن':'قفل/فروشی کن'}</button>
                <button class="btn btn-sm btn-danger" onclick="deleteFile(${f.id})">حذف</button></td></tr>`).join('')}
        </table></div>
        <h3 class="section-title" style="font-size:1rem;">افزودن فایل جدید</h3>
        <div class="card" style="padding:1rem; max-width:480px;">
            <div class="form-group"><label>عنوان *</label><input type="text" id="newFileTitle"></div>
            <div class="form-group"><label>توضیحات</label><textarea id="newFileDesc" rows="2"></textarea></div>
            <div class="form-group"><label>فایل</label><input type="file" id="newFileUpload"></div>
            <div class="form-group"><label>یا لینک خارجی (اختیاری به‌جای فایل)</label><input type="text" id="newFileLink"></div>
            <button class="btn btn-primary" style="width:100%;" onclick="createFile()">افزودن</button>
        </div>`;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function toggleFileLock(id, value) {
    try { await apiSend('PUT', `/api/admin/admin-files/${id}`, { is_locked: value }); loadFiles(); } catch (e) { showToast(e.message, 'error'); }
}
async function deleteFile(id) {
    if (!confirm('حذف شود؟')) return;
    try { await apiSend('DELETE', `/api/admin/admin-files/${id}`); loadFiles(); } catch (e) { showToast(e.message, 'error'); }
}
async function createFile() {
    const title = document.getElementById('newFileTitle').value.trim();
    if (!title) { showToast('عنوان الزامی است', 'error'); return; }
    try {
        let fileUrl = document.getElementById('newFileLink').value.trim();
        let fileType = fileUrl ? 'link' : '';
        const fileInput = document.getElementById('newFileUpload');
        if (fileInput.files && fileInput.files[0]) {
            const fd = new FormData(); fd.append('file', fileInput.files[0]);
            const res = await fetch(api('/api/upload'), { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            fileUrl = data.url;
            fileType = fileInput.files[0].name.split('.').pop();
        }
        await apiSend('POST', '/api/admin/admin-files', { title, description: document.getElementById('newFileDesc').value, file_url: fileUrl, file_type: fileType, is_locked: 0, price: 0 });
        showToast('افزوده شد', 'success');
        loadFiles();
    } catch (e) { showToast(e.message, 'error'); }
}

// ------------------------------------------------------------------
// دسته‌بندی و شهرستان
// ------------------------------------------------------------------
async function loadLookups() {
    const el = document.getElementById('admin-lookups');
    el.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const [cats, counties, zones] = await Promise.all([
            apiGet('/api/admin/categories'), apiGet('/api/admin/counties'), apiGet('/api/admin/industrial-zones'),
        ]);
        el.innerHTML = `
        <h2 class="section-title">🏷 دسته‌بندی‌ها</h2>
        <div style="display:flex; gap:0.5rem; margin-bottom:0.8rem;"><input type="text" id="newCatName" placeholder="نام دسته جدید" style="flex:1; padding:0.5rem; border-radius:8px; border:1px solid var(--border);"><button class="btn btn-primary btn-sm" onclick="addCategory()">افزودن</button></div>
        <table class="admin-table">${cats.map(c => `<tr><td>${esc(c.name)}</td><td><button class="btn btn-sm btn-danger" onclick="delCategory(${c.id})">حذف</button></td></tr>`).join('')}</table>

        <h2 class="section-title">📍 شهرستان‌ها</h2>
        <div style="display:flex; gap:0.5rem; margin-bottom:0.8rem;"><input type="text" id="newCountyName" placeholder="نام شهرستان جدید" style="flex:1; padding:0.5rem; border-radius:8px; border:1px solid var(--border);"><button class="btn btn-primary btn-sm" onclick="addCounty()">افزودن</button></div>
        <table class="admin-table">${counties.map(c => `<tr><td>${esc(c.name)}</td><td><button class="btn btn-sm btn-danger" onclick="delCounty(${c.id})">حذف</button></td></tr>`).join('')}</table>

        <h2 class="section-title">🏭 شهرک‌ها و نواحی صنعتی</h2>
        <p style="font-size:0.78rem; color:var(--text-light); margin-bottom:0.6rem;">همین فهرست در نقشهٔ ثبت‌نام کارخانه‌ها («از لیست شهرک‌ها») به کاربران نمایش داده می‌شود.</p>
        <div style="display:flex; gap:0.5rem; margin-bottom:0.8rem; flex-wrap:wrap;">
            <input type="text" id="newZoneName" placeholder="نام شهرک/ناحیهٔ صنعتی" style="flex:2; min-width:160px; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
            <select id="newZoneCounty" style="flex:1; min-width:120px; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
                ${counties.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="addZone()">افزودن</button>
        </div>
        <table class="admin-table">${zones.map(z => `<tr><td>${esc(z.name)}</td><td>${esc(z.county)}</td><td><button class="btn btn-sm btn-danger" onclick="delZone(${z.id})">حذف</button></td></tr>`).join('') || '<tr><td colspan="3">شهرکی ثبت نشده</td></tr>'}</table>
        `;
    } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
async function addZone() {
    const name = document.getElementById('newZoneName').value.trim();
    const county = document.getElementById('newZoneCounty').value;
    if (!name) return;
    try { await apiSend('POST', '/api/admin/industrial-zones', { name, county }); loadLookups(); showToast('اضافه شد', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
}
async function delZone(id) {
    try { await apiSend('DELETE', `/api/admin/industrial-zones/${id}`); loadLookups(); }
    catch (e) { showToast(e.message, 'error'); }
}
async function addCategory() {
    const name = document.getElementById('newCatName').value.trim();
    if (!name) return;
    try { await apiSend('POST', '/api/admin/categories', { name, active: 1 }); loadLookups(); } catch (e) { showToast(e.message, 'error'); }
}
async function delCategory(id) {
    try { await apiSend('DELETE', `/api/admin/categories/${id}`); loadLookups(); } catch (e) { showToast(e.message, 'error'); }
}
async function addCounty() {
    const name = document.getElementById('newCountyName').value.trim();
    if (!name) return;
    try { await apiSend('POST', '/api/admin/counties', { name, province_id: 1 }); loadLookups(); } catch (e) { showToast(e.message, 'error'); }
}
async function delCounty(id) {
    try { await apiSend('DELETE', `/api/admin/counties/${id}`); loadLookups(); } catch (e) { showToast(e.message, 'error'); }
}
