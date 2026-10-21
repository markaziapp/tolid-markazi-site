// ===================================================================
// پورتال ادارات (office.html) — فقط نامه‌های ارجاع‌شده به همان اداره
// ===================================================================
(function () {
    const { esc, fa, api, fmtDate, statusChip, attHtml, timeline, mountUploader, uploaderUrls, uploaderBusy } = CX;
    const KEY = 'officeToken', INFO = 'officeInfo';
    let items = [], filter = 'open';

    const token = () => localStorage.getItem(KEY);
    function toast(msg, type = '') {
        const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3500);
    }
    async function call(method, path, body) {
        const headers = {}; if (body) headers['Content-Type'] = 'application/json';
        if (token()) headers.Authorization = 'Bearer ' + token();
        const res = await fetch(api(path), { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const e = new Error(data.error || 'خطا'); e.status = res.status; throw e; }
        return data;
    }
    const show = (id, on) => { document.getElementById(id).style.display = on ? 'block' : 'none'; };

    function showLogin() {
        show('loginView', true); show('listView', false);
        document.getElementById('officeHeaderActions').innerHTML = '';
    }
    function showList() {
        const info = JSON.parse(localStorage.getItem(INFO) || '{}');
        show('loginView', false); show('listView', true);
        document.getElementById('ofOfficeName').textContent = info.office || 'اداره';
        document.getElementById('ofUserName').textContent = info.user ? 'نماینده: ' + info.user : '';
        document.getElementById('officeHeaderActions').innerHTML = '<button class="btn btn-outline btn-sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4);" onclick="OFFICE.logout()">خروج</button>';
    }

    async function login() {
        const username = document.getElementById('ofUser').value.trim(), password = document.getElementById('ofPass').value;
        if (!username || !password) { toast('نام کاربری و رمز را وارد کنید', 'error'); return; }
        try {
            const r = await call('POST', '/api/office/login', { username, password });
            localStorage.setItem(KEY, r.token);
            localStorage.setItem(INFO, JSON.stringify({ office: r.office.name, user: r.user.name }));
            showList(); await load();
        } catch (e) { toast(e.message, 'error'); }
    }
    function logout() { localStorage.removeItem(KEY); localStorage.removeItem(INFO); showLogin(); }

    async function load() {
        const list = document.getElementById('ofList');
        list.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
        try { items = await call('GET', '/api/office/requests'); }
        catch (e) { if (e.status === 401) { logout(); toast('نشست شما منقضی شده؛ دوباره وارد شوید', 'error'); return; } list.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; return; }
        render();
    }
    function render() {
        const isOpen = (r) => !['انجام شد', 'لغو شد'].includes(r.status);
        const newCount = items.filter((r) => r.status === 'ارجاع شد').length;
        document.getElementById('ofCounts').innerHTML = `${fa(items.filter(isOpen).length)} نامهٔ باز${newCount ? ` · <b style="color:var(--gold)">${fa(newCount)} جدید</b>` : ''}`;
        const tabs = [['open', 'باز'], ['all', 'همه'], ['done', 'انجام‌شده']];
        document.getElementById('ofFilters').innerHTML = tabs.map(([k, l]) => `<button class="${filter === k ? 'active' : ''}" onclick="OFFICE.setFilter('${k}')">${l}</button>`).join('');
        const shown = items.filter((r) => filter === 'all' || (filter === 'open' ? isOpen(r) : r.status === 'انجام شد'));
        document.getElementById('ofList').innerHTML = shown.length ? shown.map((r) => `
            <button class="corr-req ${r.status === 'ارجاع شد' ? 'unread' : ''}" onclick="OFFICE.open(${r.id})">
                <div class="row1"><span class="code">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
                <div class="subj">${esc(r.subject)}</div>
                <div class="meta"><span>📤 فرستنده: ${esc(r.company_name || '')}</span><span>${fmtDate(r.updated_at)}</span>${r.priority === 'فوری' ? '<span class="pay-chip warn">فوری</span>' : ''}</div>
            </button>`).join('') : '<div class="empty-state">نامه‌ای در این بخش وجود ندارد</div>';
    }
    function setFilter(f) { filter = f; render(); }

    async function open(id) {
        document.getElementById('ofModal').classList.add('open');
        const body = document.getElementById('ofModalBody');
        body.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
        try {
            const r = await call('GET', '/api/office/requests/' + id);
            document.getElementById('ofModalTitle').textContent = 'نامه ' + r.tracking_code;
            const closed = ['انجام شد', 'لغو شد'].includes(r.status);
            body.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;"><span style="direction:ltr;font-weight:800;">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
                <div class="corr-box" style="margin-top:.7rem;font-size:.86rem;">
                    <div>📤 فرستنده: <b>${esc(r.company_name || '')}</b></div>
                    <div>📅 تاریخ: ${fmtDate(r.created_at)}${r.priority === 'فوری' ? ' · <b style="color:var(--red)">فوری</b>' : ''}</div>
                    <hr style="border:none;border-top:1px solid var(--border);margin:.6rem 0;">
                    <div><b>${esc(r.subject)}</b></div>
                    ${r.body ? `<div style="white-space:pre-wrap;margin-top:.3rem;">${esc(r.body)}</div>` : ''}
                    ${r.needs_physical ? '<div style="font-size:.76rem;color:var(--text-light);margin-top:.3rem;">نامهٔ رسمی (زنده) — تصویر/PDF پیوست است.</div>' : ''}
                    ${attHtml(r.attachments)}
                </div>
                <h4 style="margin:1rem 0 .3rem;">سوابق</h4>
                ${timeline(r.events)}
                ${closed ? '' : `
                <div class="corr-box" style="margin-top:.8rem;">
                    <b style="font-size:.88rem;">✍️ ثبت پاسخ اداره</b>
                    <textarea id="ofReply" rows="4" placeholder="پاسخ یا توضیحات اداره..." style="margin:.5rem 0;"></textarea>
                    <div id="ofReplyFiles"></div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem;">
                        <button class="btn btn-gold btn-sm" onclick="OFFICE.reply(${r.id}, 'reply')">ثبت پاسخ</button>
                        <button class="btn btn-outline btn-sm" onclick="OFFICE.reply(${r.id}, 'ack')">فقط اعلام دریافت نامه</button>
                    </div>
                    <div style="font-size:.72rem;color:var(--text-light);margin-top:.5rem;">پاسخ ثبت‌شده ابتدا توسط همتاصنعت بررسی و سپس برای واحد منتشر می‌شود.</div>
                </div>`}`;
            if (!closed) mountUploader('ofReplyFiles', { max: 4, label: '📎 پیوست پاسخ (عکس یا PDF)', onError: (m) => toast(m, 'error') });
        } catch (e) { body.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
    }
    async function reply(id, kind) {
        if (uploaderBusy('ofReplyFiles')) { toast('صبر کنید تا آپلود تمام شود', 'error'); return; }
        const text = document.getElementById('ofReply').value.trim(), attachments = uploaderUrls('ofReplyFiles');
        if (kind === 'reply' && !text && !attachments.length) { toast('متن یا پیوست پاسخ را وارد کنید', 'error'); return; }
        try {
            await call('POST', `/api/office/requests/${id}/reply`, { kind, text, attachments });
            toast(kind === 'ack' ? 'دریافت نامه ثبت شد' : 'پاسخ ثبت شد', 'success');
            await load(); open(id);
        } catch (e) { toast(e.message, 'error'); }
    }
    function closeModal() { document.getElementById('ofModal').classList.remove('open'); }
    document.addEventListener('click', (e) => { if (e.target.id === 'ofModal') closeModal(); });

    window.OFFICE = { login, logout, setFilter, open, reply, closeModal };
    window.addEventListener('DOMContentLoaded', () => { if (token()) { showList(); load(); } else showLogin(); });
})();
