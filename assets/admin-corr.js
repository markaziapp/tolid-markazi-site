// ===================================================================
// تب «امور اداری» در پنل مدیریت
// از توابع apiGet / apiSend / showToast خود admin.js استفاده می‌کند.
// همه‌چیز داخل یک بسته (CORRADM) است تا با نام‌های دیگر تداخل نکند.
// ===================================================================
(function () {
    const { esc, fa, fmtDate, statusChip, payChip, attHtml, timeline, STATUSES, copyText, mountUploader, uploaderUrls, uploaderBusy, uploaderClear } = CX;
    const $ = (id) => document.getElementById(id);
    const PAY_LABELS = { none: 'بدون هزینه', unpaid: 'در انتظار پرداخت', receipt_sent: 'رسید ارسال شد', paid: 'پرداخت‌شده', subscription: 'از محل اشتراک', free: 'رایگان' };
    const TABS = [['dash', '📊 داشبورد'], ['reqs', '📨 درخواست‌ها'], ['subs', '💎 اشتراک‌ها'], ['offices', '🏛️ ادارات'], ['ousers', '🔑 کاربران ادارات'], ['services', '💰 خدمات و نرخ‌ها'], ['plans', '🎫 طرح‌های اشتراک'], ['settings', '⚙️ تنظیمات']];

    const S = { tab: 'dash', offices: [], filters: { status: '', office_id: '', payment: '', q: '', open: '1', unread: '' }, subFilter: 'pending', badge: { requests: 0, subscriptions: 0 }, detailId: null, detail: null };
    let searchTimer = null, companyTimer = null;

    const err = (e) => window.showToast(e.message || 'خطا', 'error');
    const ok = (m) => window.showToast(m || 'ذخیره شد', 'success');

    // ------------------------------------------------------------------
    // ورودی اصلی تب
    // ------------------------------------------------------------------
    async function loadCorr() {
        const root = $('admin-corr');
        root.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
        try {
            const b = await apiGet('/api/admin/corr/badge');
            if (b.notReady) { root.innerHTML = setupBanner(); return; }
            S.badge = b; setTabBadge(b.total);
        } catch (e) { root.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; return; }
        S.offices = await apiGet('/api/admin/corr/offices').catch(() => []);
        shell(); await renderTab();
    }
    function setupBanner() {
        return `<div class="setup-banner">
            <h3 style="margin-bottom:.4rem;">🛠️ راه‌اندازی ماژول امور اداری</h3>
            <p style="font-size:.86rem;margin-bottom:.8rem;">برای اولین‌بار، جدول‌های لازم باید ساخته شوند. فقط یک‌بار کلیک کنید (اجرای مجدد هم بی‌خطر است).<br>همراه آن چند اداره، خدمت و طرح اشتراک نمونه ساخته می‌شود که بعداً ویرایش می‌کنید.</p>
            <button class="btn btn-gold" onclick="CORRADM.runSetup(this)">ساخت جدول‌ها و داده نمونه</button></div>`;
    }
    async function runSetup(btn) {
        btn.disabled = true; btn.textContent = 'در حال ساخت...';
        try {
            const r = await apiSend('POST', '/api/admin/corr/setup', {});
            if (!r.ok) { window.showToast('بخشی از دستورها خطا داد: ' + JSON.stringify(r.failed).slice(0, 200), 'error'); btn.disabled = false; btn.textContent = 'تلاش دوباره'; return; }
            ok('ماژول راه‌اندازی شد'); loadCorr();
        } catch (e) { err(e); btn.disabled = false; btn.textContent = 'تلاش دوباره'; }
    }
    function setTabBadge(n) {
        const el = $('tabBadgeCorr'); if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = 'inline-block'; } else el.style.display = 'none';
    }
    async function refreshBadge() {
        try { const b = await apiGet('/api/admin/corr/badge'); if (!b.notReady) { S.badge = b; setTabBadge(b.total); if ($('corrTabs')) shell(true); } } catch { }
    }
    function shell(keepBody) {
        const tabs = TABS.map(([k, l]) => {
            const cnt = k === 'reqs' ? S.badge.requests : k === 'subs' ? S.badge.subscriptions : 0;
            return `<button class="${S.tab === k ? 'active' : ''}" onclick="CORRADM.setTab('${k}')">${l}${cnt ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
        }).join('');
        if (keepBody && $('corrTabs')) { $('corrTabs').innerHTML = tabs; return; }
        $('admin-corr').innerHTML = `<h2 class="section-title">📨 دستیار اداری (امور اداری واحدها)</h2><div class="corr-tabs" id="corrTabs">${tabs}</div><div id="corrBody"></div>`;
    }
    async function setTab(k, filters) {
        S.tab = k; if (filters) S.filters = { status: '', office_id: '', payment: '', q: '', open: '', unread: '', ...filters };
        shell(true); await renderTab();
    }
    async function renderTab() {
        const body = $('corrBody'); body.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
        try {
            await ({ dash: tabDash, reqs: tabReqs, subs: tabSubs, offices: tabOffices, ousers: tabOUsers, services: tabServices, plans: tabPlans, settings: tabSettings })[S.tab](body);
        } catch (e) { body.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
    }

    // ------------------------------------------------------------------
    // ۱) داشبورد: دسته‌بندی منظم بر اساس وضعیت و اداره
    // ------------------------------------------------------------------
    async function tabDash(body) {
        const d = await apiGet('/api/admin/corr/stats');
        const cnt = Object.fromEntries(d.byStatus.map((x) => [x.status, x.c]));
        body.innerHTML = `
            <h3 style="font-size:.95rem;margin-bottom:.5rem;">بر اساس وضعیت</h3>
            <div class="status-cards">${STATUSES.map((s) => `<button class="status-card" onclick="CORRADM.setTab('reqs',{status:'${s}'})"><b>${fa(cnt[s] || 0)}</b><span>${s}</span></button>`).join('')}</div>
            <h3 style="font-size:.95rem;margin:1.2rem 0 .5rem;">پرداخت و اشتراک</h3>
            <div class="status-cards">
                <button class="status-card" onclick="CORRADM.setTab('reqs',{payment:'receipt_sent'})"><b>${fa(d.payments.receipts)}</b><span>رسید منتظر تأیید</span></button>
                <button class="status-card" onclick="CORRADM.setTab('reqs',{payment:'unpaid',open:'1'})"><b>${fa(d.payments.unpaid)}</b><span>پرداخت‌نشده</span></button>
                <button class="status-card" onclick="CORRADM.setTab('subs')"><b>${fa(d.subscriptions.pending)}</b><span>اشتراک منتظر تأیید</span></button>
                <button class="status-card" onclick="CORRADM.setTab('subs')"><b>${fa(d.subscriptions.active)}</b><span>اشتراک فعال</span></button>
            </div>
            <h3 style="font-size:.95rem;margin:1.2rem 0 .5rem;">بر اساس اداره (کلیک = فهرست همان اداره)</h3>
            <div class="office-cards">${d.byOffice.length ? d.byOffice.map((o) => `
                <button class="office-card" onclick="CORRADM.setTab('reqs',{office_id:'${o.office_id || ''}'})">
                    <b>${esc(o.office_name || '—')}</b><small>${fa(o.open_count)} باز از ${fa(o.c)} درخواست</small></button>`).join('') : '<div class="empty-state">هنوز درخواستی ثبت نشده</div>'}</div>`;
    }

    // ------------------------------------------------------------------
    // ۲) فهرست درخواست‌ها + فیلتر
    // ------------------------------------------------------------------
    async function tabReqs(body) {
        const f = S.filters;
        body.innerHTML = `
            <div class="filter-row">
                <select id="fStatus" onchange="CORRADM.applyFilters()"><option value="">همهٔ وضعیت‌ها</option>${STATUSES.map((s) => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                <select id="fOffice" onchange="CORRADM.applyFilters()"><option value="">همهٔ ادارات</option>${S.offices.map((o) => `<option value="${o.id}" ${String(f.office_id) === String(o.id) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
                <select id="fPay" onchange="CORRADM.applyFilters()"><option value="">همهٔ پرداخت‌ها</option>${Object.entries(PAY_LABELS).map(([k, l]) => `<option value="${k}" ${f.payment === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <input type="search" id="fQ" placeholder="🔍 کد، موضوع یا نام واحد" value="${esc(f.q)}" oninput="CORRADM.debounceSearch()">
                <label style="display:flex;align-items:center;gap:.3rem;font-size:.8rem;"><input type="checkbox" id="fOpen" ${f.open === '1' ? 'checked' : ''} onchange="CORRADM.applyFilters()"> فقط باز</label>
                <label style="display:flex;align-items:center;gap:.3rem;font-size:.8rem;"><input type="checkbox" id="fUnread" ${f.unread === '1' ? 'checked' : ''} onchange="CORRADM.applyFilters()"> فقط خوانده‌نشده</label>
            </div><div id="reqList"><div class="loading">در حال بارگذاری...</div></div>`;
        await loadReqList();
    }
    function applyFilters() {
        S.filters = { status: $('fStatus').value, office_id: $('fOffice').value, payment: $('fPay').value, q: $('fQ').value.trim(), open: $('fOpen').checked ? '1' : '', unread: $('fUnread').checked ? '1' : '' };
        loadReqList();
    }
    function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(applyFilters, 450); }
    async function loadReqList() {
        const qs = Object.entries(S.filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const list = $('reqList'); if (!list) return;
        try {
            const rows = await apiGet('/api/admin/corr/requests' + (qs ? '?' + qs : ''));
            list.innerHTML = rows.length ? rows.map((r) => `
                <button class="corr-req ${r.unread_admin ? 'unread' : ''}" onclick="CORRADM.openDetail(${r.id})">
                    <div class="row1"><span class="code">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
                    <div class="subj">${esc(r.subject)}</div>
                    <div class="meta"><span>🏭 ${esc(r.company_name || '—')}</span><span>🏛️ ${esc(r.referred_office_name || r.office_name || '')}</span><span>${fmtDate(r.updated_at)}</span>
                        ${payChip(r)}${r.priority === 'فوری' ? '<span class="pay-chip warn">فوری</span>' : ''}${r.needs_physical ? '<span class="pay-chip">نامهٔ زنده</span>' : ''}${r.unread_admin ? '<span class="pay-chip ok">جدید</span>' : ''}</div>
                </button>`).join('') : '<div class="empty-state">درخواستی با این فیلتر پیدا نشد</div>';
        } catch (e) { list.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
    }

    // ------------------------------------------------------------------
    // جزئیات یک درخواست (مدیریت، ارجاع، پیام، انتشار پاسخ ادارات)
    // ------------------------------------------------------------------
    function offerOptions(selected) {
        const grp = (lv, label) => {
            const part = S.offices.filter((o) => o.level === lv && (o.active || String(o.id) === String(selected)));
            return part.length ? `<optgroup label="${label}">${part.map((o) => `<option value="${o.id}" ${String(selected) === String(o.id) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</optgroup>` : '';
        };
        return `<option value="">— بدون ارجاع —</option>${grp('کل', 'ادارات کل')}${grp('شهرستان', 'ادارات شهرستان')}`;
    }
    async function openDetail(id) {
        S.detailId = id; $('corrModal').classList.add('open');
        const body = $('corrModalBody'); body.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
        try {
            const r = await apiGet('/api/admin/corr/requests/' + id); S.detail = r;
            $('corrModalTitle').textContent = 'درخواست ' + r.tracking_code;
            const evExtra = (e) => `<div class="tl-flags">
                <button class="${e.visible_company ? 'on' : ''}" onclick="CORRADM.toggleEv(${e.id},'visible_company',${e.visible_company ? 0 : 1})">👁 واحد ${e.visible_company ? 'می‌بیند' : 'نمی‌بیند'}</button>
                <button class="${e.visible_office ? 'on' : ''}" onclick="CORRADM.toggleEv(${e.id},'visible_office',${e.visible_office ? 0 : 1})">🏛️ اداره ${e.visible_office ? 'می‌بیند' : 'نمی‌بیند'}</button></div>`;
            body.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;">
                    <span style="direction:ltr;font-weight:800;">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
                <div class="corr-box" style="margin-top:.7rem;font-size:.84rem;">
                    <div>🏭 <b>${esc(r.company_name || '—')}</b> · <a href="tel:${esc(r.company_phone || '')}" style="color:var(--primary);font-weight:700;">${esc(r.company_phone || '')}</a> ${r.company_county ? '· ' + esc(r.company_county) : ''}</div>
                    <div>🏛️ اداره: <b>${esc(r.office_name || '')}</b> · 🧾 ${esc(r.service_title || '')} · ${payChip(r)}</div>
                    <div>📅 ${fmtDate(r.created_at)}${r.needs_physical ? ' · <b>نامهٔ زنده (فیزیکی)</b>' : ''}</div>
                    <hr style="border:none;border-top:1px solid var(--border);margin:.6rem 0;">
                    <div><b>${esc(r.subject)}</b></div>
                    ${r.body ? `<div style="white-space:pre-wrap;margin-top:.3rem;">${esc(r.body)}</div>` : ''}
                    ${attHtml(r.attachments)}
                    ${r.receipt_url || r.receipt_note ? `<div style="margin-top:.5rem;padding:.5rem;border:1px dashed var(--gold);border-radius:8px;">🧾 رسید پرداخت: ${r.receipt_url ? `<a href="${esc(r.receipt_url)}" target="_blank" rel="noopener" style="font-weight:800;text-decoration:underline;">مشاهده تصویر</a>` : ''} ${esc(r.receipt_note || '')}</div>` : ''}
                </div>

                <div class="corr-box" style="margin-top:.8rem;">
                    <b style="font-size:.9rem;">⚙️ مدیریت درخواست</b>
                    <div class="edit-row" style="border:none;padding:.5rem 0 0;">
                        <div class="er-fields">
                            <div><label>وضعیت</label><select id="cdStatus">${STATUSES.map((s) => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                            <div><label>توضیح وضعیت (واحد می‌بیند)</label><input type="text" id="cdStatusNote" placeholder="اختیاری"></div>
                            <div><label>ارجاع به اداره</label><select id="cdRef">${offerOptions(r.referred_office_id || '')}</select></div>
                            <div><label>توضیح ارجاع (اداره و واحد می‌بینند)</label><input type="text" id="cdRefNote" placeholder="اختیاری"></div>
                            <div><label>هزینه (تومان)</label><input type="number" id="cdFee" min="0" value="${r.fee || 0}"></div>
                            <div><label>وضعیت پرداخت</label><select id="cdPay">${Object.entries(PAY_LABELS).map(([k, l]) => `<option value="${k}" ${r.payment_status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
                            <div><label>اولویت</label><select id="cdPrio"><option ${r.priority === 'عادی' ? 'selected' : ''}>عادی</option><option ${r.priority === 'فوری' ? 'selected' : ''}>فوری</option></select></div>
                        </div>
                        <div><label>یادداشت داخلی (فقط مدیر)</label><textarea id="cdNote" rows="2">${esc(r.admin_note || '')}</textarea></div>
                        <div class="er-actions"><button class="btn btn-primary btn-sm" onclick="CORRADM.saveDetail()">ذخیره تغییرات</button></div>
                    </div>
                </div>

                <h4 style="margin:1rem 0 .3rem;">خط زمانی <span style="font-size:.72rem;color:var(--text-light);font-weight:400;">(با دکمه‌های هر رویداد، تعیین کنید چه کسی ببیند — مثلاً پاسخ اداره را برای واحد منتشر کنید)</span></h4>
                ${timeline(r.events, evExtra)}

                <div class="corr-box" style="margin-top:.8rem;">
                    <b style="font-size:.9rem;">💬 ارسال پیام</b>
                    <textarea id="cmText" rows="3" placeholder="متن پیام..." style="margin:.5rem 0;"></textarea>
                    <div id="cmFiles"></div>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin:.6rem 0;font-size:.82rem;">
                        <label style="display:flex;gap:.3rem;align-items:center;"><input type="checkbox" id="cmToCompany" checked> نمایش برای واحد</label>
                        <label style="display:flex;gap:.3rem;align-items:center;"><input type="checkbox" id="cmToOffice" ${r.referred_office_id ? '' : 'disabled'}> نمایش برای اداره${r.referred_office_id ? '' : ' (ارجاع نشده)'}</label>
                    </div>
                    <button class="btn btn-gold btn-sm" onclick="CORRADM.sendMessage()">ارسال</button>
                </div>`;
            mountUploader('cmFiles', { max: 4, label: '📎 پیوست (عکس یا PDF)', onError: (m) => window.showToast(m, 'error') });
            refreshBadge();
        } catch (e) { body.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
    }
    function closeModal() { $('corrModal').classList.remove('open'); if (S.tab === 'reqs') loadReqList(); else if (S.tab === 'dash') renderTab(); }
    async function saveDetail() {
        const r = S.detail, b = {};
        const st = $('cdStatus').value; if (st !== r.status) { b.status = st; b.status_note = $('cdStatusNote').value.trim(); }
        const ref = $('cdRef').value, cur = r.referred_office_id ? String(r.referred_office_id) : '';
        if (ref !== cur) { b.referred_office_id = ref || null; b.referral_note = $('cdRefNote').value.trim(); }
        const fee = Number($('cdFee').value || 0); if (fee !== (r.fee || 0)) b.fee = fee;
        const ps = $('cdPay').value; if (ps !== r.payment_status) b.payment_status = ps;
        const pr = $('cdPrio').value; if (pr !== r.priority) b.priority = pr;
        const nt = $('cdNote').value; if (nt !== (r.admin_note || '')) b.admin_note = nt;
        if (!Object.keys(b).length) { window.showToast('تغییری انجام نشده'); return; }
        try { await apiSend('PUT', '/api/admin/corr/requests/' + r.id, b); ok(); await openDetail(r.id); }
        catch (e) { err(e); }
    }
    async function sendMessage() {
        if (uploaderBusy('cmFiles')) { window.showToast('صبر کنید تا آپلود تمام شود', 'error'); return; }
        const text = $('cmText').value.trim(), attachments = uploaderUrls('cmFiles');
        if (!text && !attachments.length) { window.showToast('متن یا پیوست لازم است', 'error'); return; }
        const visible_company = $('cmToCompany').checked, visible_office = $('cmToOffice').checked;
        if (!visible_company && !visible_office) { window.showToast('حداقل یک گیرنده انتخاب کنید', 'error'); return; }
        try { await apiSend('POST', `/api/admin/corr/requests/${S.detail.id}/messages`, { text, attachments, visible_company, visible_office }); ok('ارسال شد'); await openDetail(S.detail.id); }
        catch (e) { err(e); }
    }
    async function toggleEv(id, field, val) {
        try { await apiSend('PUT', '/api/admin/corr/events/' + id, { [field]: val }); await openDetail(S.detail.id); } catch (e) { err(e); }
    }

    // ------------------------------------------------------------------
    // ۳) اشتراک‌ها
    // ------------------------------------------------------------------
    async function tabSubs(body) {
        const [subs, plans] = await Promise.all([
            apiGet('/api/admin/corr/subscriptions' + (S.subFilter ? '?status=' + S.subFilter : '')),
            apiGet('/api/admin/corr/plans'),
        ]);
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const SUBL = { pending: 'در انتظار تأیید', active: 'فعال', rejected: 'ردشده', expired: 'منقضی' };
        body.innerHTML = `
            <div class="corr-tabs">${[['pending', 'منتظر تأیید'], ['active', 'فعال'], ['', 'همه']].map(([k, l]) => `<button class="${S.subFilter === k ? 'active' : ''}" onclick="CORRADM.setSubFilter('${k}')">${l}</button>`).join('')}</div>
            ${subs.length ? subs.map((s) => `
                <div class="corr-box">
                    <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;"><b>🏭 ${esc(s.company_name || '—')} <a href="tel:${esc(s.company_phone || '')}" style="font-weight:400;font-size:.8rem;">${esc(s.company_phone || '')}</a></b>
                        <span class="st-chip ${s.status === 'active' ? 'st-5' : s.status === 'pending' ? 'st-1' : 'st-6'}">${SUBL[s.status] || s.status}</span></div>
                    <div style="font-size:.82rem;margin:.3rem 0;">${esc(s.plan_title || '')} · ${fa(s.amount)} تومان · ${s.included_requests ? `${fa(s.requests_used)}/${fa(s.included_requests)} درخواست` : `${fa(s.requests_used)} درخواست (نامحدود)`}</div>
                    ${s.starts_at ? `<div style="font-size:.78rem;color:var(--text-light);">از ${fmtDate(s.starts_at, false)} تا ${fmtDate(s.ends_at, false)}${s.status === 'active' && s.ends_at < now ? ' (پایان‌یافته)' : ''}</div>` : ''}
                    ${s.receipt_url || s.receipt_note ? `<div style="font-size:.8rem;margin-top:.3rem;">🧾 ${s.receipt_url ? `<a href="${esc(s.receipt_url)}" target="_blank" rel="noopener" style="font-weight:800;text-decoration:underline;">تصویر رسید</a>` : ''} ${esc(s.receipt_note || '')}</div>` : ''}
                    ${s.admin_note ? `<div style="font-size:.76rem;color:var(--text-light);">یادداشت: ${esc(s.admin_note)}</div>` : ''}
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem;">
                        ${s.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="CORRADM.subAction(${s.id},'approve')">✓ تأیید و فعال‌سازی</button><button class="btn btn-danger btn-sm" onclick="CORRADM.subAction(${s.id},'reject')">رد</button>` : ''}
                        ${s.status === 'active' ? `<button class="btn btn-outline btn-sm" onclick="CORRADM.subAction(${s.id},'expire')">پایان‌دادن</button>` : ''}
                    </div>
                </div>`).join('') : '<div class="empty-state">موردی وجود ندارد</div>'}
            <div class="corr-box" style="margin-top:1rem;">
                <b>🎁 اعطای دستی اشتراک</b>
                <p style="font-size:.76rem;color:var(--text-light);margin:.2rem 0 .6rem;">برای توافق‌های خارج از سیستم یا هدیه به واحد.</p>
                <div class="edit-row" style="border:none;padding:0;"><div class="er-fields">
                    <div><label>جستجوی واحد</label><input type="search" id="gCompanyQ" placeholder="نام یا شماره" oninput="CORRADM.searchCompany()"><select id="gCompany" size="3" style="margin-top:.3rem;display:none;"></select></div>
                    <div><label>طرح</label><select id="gPlan">${plans.map((p) => `<option value="${p.id}">${esc(p.title)}${p.active ? '' : ' (غیرفعال)'}</option>`).join('')}</select></div>
                    <div><label>مبلغ دریافتی (اختیاری)</label><input type="number" id="gAmount" min="0" value="0"></div>
                    <div><label>مدت (روز؛ خالی = طبق طرح)</label><input type="number" id="gDays" min="1"></div>
                </div><div class="er-actions"><button class="btn btn-gold btn-sm" onclick="CORRADM.grantSub()">اعطا</button></div></div>
            </div>`;
    }
    function setSubFilter(k) { S.subFilter = k; renderTab(); }
    async function subAction(id, action) {
        let admin_note = '';
        if (action === 'reject') { admin_note = prompt('دلیل رد (برای واحد نمایش داده می‌شود):', 'رسید نامعتبر است') || ''; }
        if (action === 'expire' && !confirm('این اشتراک پایان داده شود؟')) return;
        try { await apiSend('PUT', '/api/admin/corr/subscriptions/' + id, { action, admin_note }); ok(); refreshBadge(); renderTab(); } catch (e) { err(e); }
    }
    function searchCompany() {
        clearTimeout(companyTimer);
        companyTimer = setTimeout(async () => {
            const q = $('gCompanyQ').value.trim(), sel = $('gCompany');
            if (q.length < 2) { sel.style.display = 'none'; return; }
            try {
                const rows = await apiGet('/api/admin/corr/company-search?q=' + encodeURIComponent(q));
                sel.innerHTML = rows.map((c) => `<option value="${c.id}">${esc(c.name)} — ${esc(c.phone)}</option>`).join('');
                sel.style.display = rows.length ? 'block' : 'none'; if (rows.length) sel.selectedIndex = 0;
            } catch { }
        }, 400);
    }
    async function grantSub() {
        const company_id = $('gCompany').value; if (!company_id) { window.showToast('واحد را جستجو و انتخاب کنید', 'error'); return; }
        try {
            await apiSend('POST', '/api/admin/corr/subscriptions', { company_id, plan_id: $('gPlan').value, amount: $('gAmount').value, duration_days: $('gDays').value });
            ok('اشتراک فعال شد'); S.subFilter = 'active'; renderTab();
        } catch (e) { err(e); }
    }

    // ------------------------------------------------------------------
    // سازندهٔ ردیف‌های قابل‌ویرایش (ادارات / خدمات / طرح‌ها)
    // ------------------------------------------------------------------
    function fieldHtml(f, it, attr) {
        const v = it ? it[f.k] : (f.def ?? '');
        const common = `data-k="${f.k}" ${attr}`;
        if (f.type === 'select') return `<div><label>${f.label}</label><select ${common}>${f.options.map((o) => `<option ${String(v) === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
        if (f.type === 'check') return `<div><label>${f.label}</label><label style="display:flex;gap:.4rem;align-items:center;font-weight:400;"><input type="checkbox" ${common} ${v === undefined || v === '' || Number(v) ? 'checked' : ''} style="width:auto;"> فعال</label></div>`;
        if (f.type === 'textarea') return `<div style="grid-column:1/-1"><label>${f.label}</label><textarea rows="2" ${common}>${esc(v)}</textarea></div>`;
        return `<div><label>${f.label}</label><input type="${f.type || 'text'}" ${common} value="${esc(v)}" ${f.type === 'number' ? 'min="0"' : ''}></div>`;
    }
    function editRow(kind, it, fields, extra = '') {
        const attr = `data-row="${kind}:${it.id}"`;
        return `<div class="edit-row" ${attr}><div class="er-fields">${fields.map((f) => fieldHtml(f, it, attr)).join('')}</div>${extra}
            <div class="er-actions"><button class="btn btn-primary btn-sm" onclick="CORRADM.saveRow('${kind}',${it.id})">ذخیره</button><button class="btn btn-danger btn-sm" onclick="CORRADM.delRow('${kind}',${it.id})">حذف</button></div></div>`;
    }
    function addForm(kind, fields, title) {
        const attr = `data-add="${kind}"`;
        return `<div class="corr-box" style="margin-top:1rem;"><b>➕ ${title}</b><div class="edit-row" style="border:none;padding:.5rem 0 0;"><div class="er-fields">${fields.map((f) => fieldHtml(f, null, attr)).join('')}</div>
            <div class="er-actions"><button class="btn btn-gold btn-sm" onclick="CORRADM.addRow('${kind}')">افزودن</button></div></div></div>`;
    }
    function readFields(selector) {
        const o = {};
        document.querySelectorAll(selector).forEach((el) => {
            o[el.dataset.k] = el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.type === 'number' ? Number(el.value || 0) : el.value.trim();
        });
        return o;
    }
    async function saveRow(kind, id) {
        try { await apiSend('PUT', `/api/admin/corr/${kind}/${id}`, readFields(`[data-row="${kind}:${id}"][data-k]`)); ok(); if (kind === 'offices') S.offices = await apiGet('/api/admin/corr/offices'); }
        catch (e) { err(e); }
    }
    async function delRow(kind, id) {
        if (!confirm('حذف شود؟')) return;
        try {
            const r = await apiSend('DELETE', `/api/admin/corr/${kind}/${id}`);
            ok(r.message || 'حذف شد'); if (kind === 'offices') S.offices = await apiGet('/api/admin/corr/offices'); renderTab();
        } catch (e) { err(e); }
    }
    async function addRow(kind) {
        const data = readFields(`[data-add="${kind}"][data-k]`);
        try { await apiSend('POST', `/api/admin/corr/${kind}`, data); ok('افزوده شد'); if (kind === 'offices') S.offices = await apiGet('/api/admin/corr/offices'); renderTab(); }
        catch (e) { err(e); }
    }

    // ------------------------------------------------------------------
    // ۴) ادارات
    // ------------------------------------------------------------------
    const OFFICE_FIELDS = [
        { k: 'name', label: 'نام اداره' }, { k: 'level', label: 'سطح', type: 'select', options: ['کل', 'شهرستان'], def: 'شهرستان' },
        { k: 'county', label: 'شهرستان / محل' }, { k: 'sort_order', label: 'ترتیب نمایش', type: 'number', def: 0 }, { k: 'active', label: 'وضعیت', type: 'check' },
    ];
    async function tabOffices(body) {
        const rows = await apiGet('/api/admin/corr/offices'); S.offices = rows;
        body.innerHTML = `<p style="font-size:.8rem;color:var(--text-light);margin-bottom:.6rem;">ادارهٔ استفاده‌شده در درخواست‌ها با «حذف» فقط غیرفعال می‌شود تا تاریخچه حفظ شود.</p>
            ${rows.map((o) => editRow('offices', o, OFFICE_FIELDS, `<div style="font-size:.74rem;color:var(--text-light);">${fa(o.requests_count)} درخواست · ${fa(o.users_count)} کاربر پورتال</div>`)).join('')}
            ${addForm('offices', OFFICE_FIELDS, 'افزودن اداره جدید')}`;
    }

    // ------------------------------------------------------------------
    // ۵) کاربران ادارات (ورود به پورتال)
    // ------------------------------------------------------------------
    async function tabOUsers(body) {
        const [users, offices] = await Promise.all([apiGet('/api/admin/corr/office-users'), apiGet('/api/admin/corr/offices')]);
        S.offices = offices;
        const link = new URL('office.html', location.href).href;
        body.innerHTML = `
            <div class="corr-box" style="font-size:.82rem;">🔗 آدرس پورتال ادارات: <b style="direction:ltr;display:inline-block;">${esc(link)}</b>
                <button class="btn btn-outline btn-sm" style="margin-right:.4rem;" onclick="CORRADM.copy('${esc(link)}')">کپی</button>
                <div style="color:var(--text-light);margin-top:.3rem;">نام کاربری و رمز را بعد از ساخت، خودتان به نمایندهٔ اداره بدهید. هر کاربر فقط نامه‌هایی را می‌بیند که به اداره‌اش ارجاع داده‌اید.</div></div>
            <div style="margin-top:.8rem;">${users.length ? users.map((u) => `
                <div class="edit-row">
                    <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;"><b>${esc(u.full_name || u.username)} <span style="direction:ltr;display:inline-block;color:var(--text-light);font-weight:400;">@${esc(u.username)}</span></b>
                        <span class="st-chip ${u.active ? 'st-5' : 'st-6'}">${u.active ? 'فعال' : 'غیرفعال'}</span></div>
                    <div style="font-size:.78rem;color:var(--text-light);">🏛️ ${esc(u.office_name || '—')} · آخرین ورود: ${u.last_login_at ? fmtDate(u.last_login_at) : 'هرگز'}</div>
                    <div class="er-actions"><button class="btn btn-outline btn-sm" onclick="CORRADM.resetPass(${u.id})">تغییر رمز</button>
                        <button class="btn btn-outline btn-sm" onclick="CORRADM.toggleUser(${u.id},${u.active ? 0 : 1})">${u.active ? 'غیرفعال کن' : 'فعال کن'}</button>
                        <button class="btn btn-danger btn-sm" onclick="CORRADM.delUser(${u.id})">حذف</button></div></div>`).join('') : '<div class="empty-state">هنوز کاربری ساخته نشده</div>'}</div>
            <div class="corr-box" style="margin-top:1rem;"><b>➕ ساخت کاربر برای اداره</b>
                <div class="edit-row" style="border:none;padding:.5rem 0 0;"><div class="er-fields">
                    <div><label>اداره</label><select id="nuOffice">${offices.filter((o) => o.active).map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
                    <div><label>نام و نام خانوادگی</label><input type="text" id="nuName"></div>
                    <div><label>نام کاربری (انگلیسی)</label><input type="text" id="nuUser" style="direction:ltr;text-align:left;"></div>
                    <div><label>رمز عبور (حداقل ۶)</label><input type="text" id="nuPass" style="direction:ltr;text-align:left;"></div>
                </div><div class="er-actions"><button class="btn btn-gold btn-sm" onclick="CORRADM.addUser()">ساخت کاربر</button></div></div></div>`;
    }
    async function addUser() {
        try {
            await apiSend('POST', '/api/admin/corr/office-users', { office_id: $('nuOffice').value, full_name: $('nuName').value, username: $('nuUser').value, password: $('nuPass').value });
            ok('کاربر ساخته شد'); renderTab();
        } catch (e) { err(e); }
    }
    async function resetPass(id) {
        const p = prompt('رمز جدید (حداقل ۶ کاراکتر):'); if (!p) return;
        try { await apiSend('PUT', '/api/admin/corr/office-users/' + id, { password: p }); ok('رمز تغییر کرد'); } catch (e) { err(e); }
    }
    async function toggleUser(id, active) { try { await apiSend('PUT', '/api/admin/corr/office-users/' + id, { active }); renderTab(); } catch (e) { err(e); } }
    async function delUser(id) { if (!confirm('این کاربر حذف شود؟')) return; try { await apiSend('DELETE', '/api/admin/corr/office-users/' + id); renderTab(); } catch (e) { err(e); } }

    // ------------------------------------------------------------------
    // ۶ و ۷) خدمات / طرح‌های اشتراک
    // ------------------------------------------------------------------
    const SERVICE_FIELDS = [{ k: 'title', label: 'عنوان خدمت' }, { k: 'price', label: 'نرخ (تومان؛ ۰ = طبق توافق)', type: 'number', def: 0 }, { k: 'sort_order', label: 'ترتیب', type: 'number', def: 0 }, { k: 'active', label: 'وضعیت', type: 'check' }, { k: 'description', label: 'توضیح کوتاه', type: 'textarea' }];
    const PLAN_FIELDS = [{ k: 'title', label: 'عنوان طرح' }, { k: 'price', label: 'قیمت (تومان)', type: 'number', def: 0 }, { k: 'duration_days', label: 'مدت (روز)', type: 'number', def: 30 }, { k: 'included_requests', label: 'تعداد درخواست (۰ = نامحدود)', type: 'number', def: 0 }, { k: 'badge', label: 'برچسب (مثلاً پیشنهاد ویژه)' }, { k: 'sort_order', label: 'ترتیب', type: 'number', def: 0 }, { k: 'active', label: 'وضعیت (نمایش در سایت)', type: 'check' }, { k: 'description', label: 'توضیح کوتاه', type: 'textarea' }];
    async function tabServices(body) {
        const rows = await apiGet('/api/admin/corr/services');
        body.innerHTML = `<p style="font-size:.8rem;color:var(--text-light);margin-bottom:.6rem;">نرخ هر خدمت برای واحدهایی که اشتراک ندارند. نرخ ۰ یعنی «طبق توافق» (هزینه را بعداً روی هر درخواست مشخص می‌کنید).</p>
            ${rows.map((s) => editRow('services', s, SERVICE_FIELDS)).join('')}${addForm('services', SERVICE_FIELDS, 'افزودن خدمت جدید')}`;
    }
    async function tabPlans(body) {
        const rows = await apiGet('/api/admin/corr/plans');
        body.innerHTML = `<p style="font-size:.8rem;color:var(--text-light);margin-bottom:.6rem;">طرح‌های نمونه «غیرفعال» ساخته شده‌اند؛ قیمت واقعی را بگذارید و تیک «فعال» را بزنید تا در سایت نمایش داده شوند.</p>
            ${rows.map((p) => editRow('plans', p, PLAN_FIELDS)).join('')}${addForm('plans', PLAN_FIELDS, 'افزودن طرح جدید')}`;
    }

    // ------------------------------------------------------------------
    // ۸) تنظیمات
    // ------------------------------------------------------------------
    async function tabSettings(body) {
        const s = await apiGet('/api/admin/corr/settings');
        const inp = (k, label, extra = '') => `<div><label>${label}</label><input type="text" data-set="${k}" value="${esc(s[k])}" ${extra}></div>`;
        const chk = (k, label) => `<label style="display:flex;gap:.5rem;align-items:center;font-size:.86rem;margin:.4rem 0;"><input type="checkbox" data-set="${k}" ${s[k] === '1' ? 'checked' : ''} style="width:auto;"> ${label}</label>`;
        body.innerHTML = `
            <div class="corr-box"><b>💳 اطلاعات پرداخت (به واحدها نمایش داده می‌شود)</b>
                <div class="edit-row" style="border:none;padding:.5rem 0 0;"><div class="er-fields">
                    ${inp('card_number', 'شماره کارت', 'style="direction:ltr;text-align:left;"')}${inp('card_owner', 'به نام')}${inp('bank_name', 'بانک')}</div>
                    ${inp('payment_note', 'توضیح زیر شماره کارت')}</div></div>
            <div class="corr-box"><b>📝 متن بنر صفحهٔ دستیار اداری</b>
                <div class="edit-row" style="border:none;padding:.5rem 0 0;">${inp('intro_title', 'عنوان')}${inp('intro_text', 'متن زیر عنوان')}</div></div>
            <div class="corr-box"><b>⚙️ قوانین</b>
                ${chk('module_enabled', 'سرویس فعال باشد (خاموش = صفحه «به‌زودی» نمایش داده می‌شود)')}
                ${chk('allow_without_subscription', 'واحدهای بدون اشتراک هم بتوانند درخواست ثبت کنند (با پرداخت نرخ هر خدمت)')}
                ${chk('first_request_free', 'اولین درخواست هر واحد رایگان باشد (قلاب جذب)')}</div>
            <button class="btn btn-gold" onclick="CORRADM.saveSettings()">ذخیره تنظیمات</button>
            <div class="corr-box" style="margin-top:1.2rem;"><b>🗄️ پشتیبان و پاک‌سازی (فقط امور اداری)</b>
                <p style="font-size:.76rem;color:var(--text-light);margin:.3rem 0 .6rem;">پشتیبان اصلی سایت، جدول‌های این ماژول را شامل نمی‌شود؛ از این دکمه‌ها استفاده کنید.</p>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" onclick="CORRADM.downloadBackup()">📥 دانلود پشتیبان امور اداری</button>
                    <label class="btn btn-outline btn-sm" style="cursor:pointer;">📤 بازیابی از فایل<input type="file" accept=".json" hidden onchange="CORRADM.restoreBackup(this)"></label>
                </div>
                <hr style="border:none;border-top:1px solid var(--border);margin:.8rem 0;">
                <div style="font-size:.8rem;margin-bottom:.4rem;">پاک‌کردن درخواست‌ها و اشتراک‌های آزمایشی (ادارات، خدمات، طرح‌ها و تنظیمات می‌مانند):</div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;"><input type="text" id="wipeConfirm" placeholder="برای تأیید بنویسید: پاک کن" style="flex:1;min-width:150px;padding:.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:inherit;">
                    <button class="btn btn-danger btn-sm" onclick="CORRADM.wipeRequests()">پاک کردن</button></div></div>`;
    }
    async function saveSettings() {
        const o = {};
        document.querySelectorAll('[data-set]').forEach((el) => { o[el.dataset.set] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value.trim(); });
        try { await apiSend('PUT', '/api/admin/corr/settings', o); ok(); } catch (e) { err(e); }
    }

    async function downloadBackup() {
        try {
            const d = await apiGet('/api/admin/corr/backup');
            const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = 'corr-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(url);
            ok('فایل پشتیبان دانلود شد');
        } catch (e) { err(e); }
    }
    async function restoreBackup(input) {
        if (!input.files || !input.files[0]) return;
        if (!confirm('اطلاعات فعلی «امور اداری» با محتوای این فایل جایگزین می‌شود. مطمئنید؟')) { input.value = ''; return; }
        try { await apiSend('POST', '/api/admin/corr/restore', JSON.parse(await input.files[0].text())); ok('بازیابی انجام شد'); loadCorr(); }
        catch (e) { err(e); }
        input.value = '';
    }
    async function wipeRequests() {
        const c = $('wipeConfirm').value.trim();
        if (c !== 'پاک کن') { window.showToast('برای تأیید عبارت «پاک کن» را دقیق تایپ کنید', 'error'); return; }
        if (!confirm('همهٔ درخواست‌ها و اشتراک‌ها پاک می‌شود و برگشت‌پذیر نیست (مگر با فایل پشتیبان). ادامه می‌دهید؟')) return;
        try { await apiSend('POST', '/api/admin/corr/wipe-requests', { confirm: 'پاک کن' }); ok('پاک شد'); refreshBadge(); } catch (e) { err(e); }
    }

    async function copy(t) { window.showToast((await copyText(t)) ? 'کپی شد' : 'کپی نشد', 'success'); }

    // اعلان تب: هر بار اعلان‌های اصلی پنل به‌روز شد، شمارندهٔ این تب هم به‌روز شود
    const origNotif = window.loadNotifications;
    if (typeof origNotif === 'function') window.loadNotifications = async function () { try { await origNotif(); } finally { refreshBadge(); } };

    window.loadCorr = loadCorr;
    window.CORRADM = { runSetup, setTab, applyFilters, debounceSearch, openDetail, closeModal, saveDetail, sendMessage, toggleEv, setSubFilter, subAction, searchCompany, grantSub, saveRow, delRow, addRow, addUser, resetPass, toggleUser, delUser, saveSettings, copy, refreshBadge, downloadBackup, restoreBackup, wipeRequests };
})();
