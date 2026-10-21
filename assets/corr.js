// ===================================================================
// صفحهٔ «دستیار اداری» برای واحدها (corr.html)
// ===================================================================
const { esc, fa, api, fmtDate, statusChip, stageBar, payChip, attHtml, timeline, copyText, mountUploader, uploaderUrls, uploaderBusy, uploaderClear } = CX;

const getToken = () => localStorage.getItem('companyToken');
let catalog = null, overview = null, formState = { office: null, service: null }, currentDetail = null;

// ---------------------- ابزارهای عمومی ----------------------
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.remove('show'), 3800);
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', (e) => { if (e.target.classList && e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });

async function apiCall(method, path, body, auth) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth && getToken()) headers.Authorization = 'Bearer ' + getToken();
    const res = await fetch(api(path), { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error((data.error || 'خطا') + (data.detail ? ' — ' + data.detail : '')); err.status = res.status; throw err; }
    return data;
}

function goLogin() {
    sessionStorage.setItem('afterLogin', 'corr.html');
    showToast('ابتدا وارد شوید یا ثبت‌نام کنید', 'error');
    setTimeout(() => { location.href = 'company.html'; }, 900);
}
function planDurationLabel(d) { return d <= 31 ? 'ماهانه' : d <= 95 ? 'سه‌ماهه' : d <= 190 ? '۶ ماهه' : d <= 370 ? 'سالانه' : `${fa(d)} روزه`; }

// ---------------------- کاتالوگ (عمومی) ----------------------
async function loadCatalog() {
    try { catalog = await apiCall('GET', '/api/corr/catalog'); }
    catch { catalog = { ready: false, enabled: false }; }
    if (!catalog.ready || !catalog.enabled) {
        document.getElementById('moduleOff').style.display = 'block';
        document.querySelector('.hero-actions').style.display = 'none';
        document.getElementById('trackSection').style.display = 'none';
        return;
    }
    document.getElementById('heroTitle').textContent = catalog.intro.title;
    document.getElementById('heroText').textContent = catalog.intro.text;
    const stats = [];
    stats.push(`<div><b>${fa(catalog.stats.offices)}</b><span>اداره تحت پوشش</span></div>`);
    if (catalog.stats.done) stats.push(`<div><b>${fa(catalog.stats.done)}</b><span>درخواست انجام‌شده</span></div>`);
    stats.push(`<div><b>۲۴/۷</b><span>رهگیری آنلاین</span></div>`);
    document.getElementById('heroStats').innerHTML = stats.join('');

    if (catalog.plans.length) {
        document.getElementById('plansSection').style.display = 'block';
        document.getElementById('plansGrid').innerHTML = catalog.plans.map((p) => `
            <div class="corr-plan ${p.badge ? 'featured' : ''}">
                ${p.badge ? `<span class="ribbon">${esc(p.badge)}</span>` : ''}
                <h3>${esc(p.title)}</h3>
                <div style="font-size:.78rem;color:var(--text-light);">${esc(p.description || '')}</div>
                <div class="price">${p.price ? fa(p.price) : 'رایگان'} <small>تومان / ${planDurationLabel(p.duration_days)}</small></div>
                <ul>
                    <li>${p.included_requests ? fa(p.included_requests) + ' درخواست در دوره' : 'درخواست نامحدود'}</li>
                    <li>اعتبار ${fa(p.duration_days)} روز</li>
                    <li>بدون پرداخت جداگانهٔ هر درخواست</li>
                </ul>
                <button class="btn ${p.badge ? 'btn-gold' : 'btn-primary'}" style="width:100%" onclick="openSubscribe(${p.id})">انتخاب این طرح</button>
            </div>`).join('');
    }
    if (catalog.services.length) {
        document.getElementById('pricesSection').style.display = 'block';
        document.getElementById('pricesList').innerHTML = catalog.services.map((s) => `
            <div class="corr-price-row">
                <div><b>${esc(s.title)}</b>${s.description ? `<small>${esc(s.description)}</small>` : ''}</div>
                <span class="price-chip">${s.price ? fa(s.price) + ' تومان' : 'طبق توافق'}</span>
            </div>`).join('');
    }
}

// ---------------------- رهگیری عمومی ----------------------
async function doTrack(codeArg) {
    const input = document.getElementById('trackInput');
    const code = String(codeArg || input.value || '').trim().toUpperCase();
    if (!code) { showToast('کد رهگیری را وارد کنید', 'error'); return; }
    input.value = code;
    const box = document.getElementById('trackResult');
    box.innerHTML = '<div class="loading">در حال جستجو...</div>';
    try {
        const r = await apiCall('GET', '/api/corr/track/' + encodeURIComponent(code));
        box.innerHTML = `
            <div style="margin-top:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;">
                    <b style="direction:ltr;">${esc(r.tracking_code)}</b>${statusChip(r.status)}
                </div>
                ${stageBar(r.status)}
                <div style="font-size:.82rem;color:var(--text-light);">
                    اداره: <b style="color:var(--text)">${esc(r.referred_office_name || r.office_name || '—')}</b> ·
                    ثبت: ${fmtDate(r.created_at, false)} · آخرین به‌روزرسانی: ${fmtDate(r.updated_at)}
                </div>
                ${timeline(r.events)}
                <div style="font-size:.74rem;color:var(--text-light);">برای دیدن جزئیات و پاسخ‌ها وارد حساب خود شوید.</div>
            </div>`;
    } catch (e) { box.innerHTML = `<div class="empty-state" style="padding:1rem;">${esc(e.message)}</div>`; }
}

// ---------------------- بخش شخصی ----------------------
async function loadMy() {
    const area = document.getElementById('myArea');
    if (!catalog || !catalog.ready || !catalog.enabled) { area.innerHTML = ''; return; }
    if (!getToken()) {
        area.innerHTML = `<h2>📋 درخواست‌های من</h2>
            <div class="corr-box" style="text-align:center;">
                <p style="font-size:.88rem;margin-bottom:.7rem;">برای ثبت و پیگیری درخواست‌ها وارد حساب خود شوید.</p>
                <button class="btn btn-primary" onclick="goLogin()">ورود / ثبت‌نام</button>
            </div>`;
        return;
    }
    try { overview = await apiCall('GET', '/api/company/corr/overview', null, true); }
    catch (e) {
        if (e.status === 401) { area.innerHTML = `<h2>📋 درخواست‌های من</h2><div class="corr-box" style="text-align:center;"><p style="font-size:.88rem;margin-bottom:.7rem;">نشست شما منقضی شده است.</p><button class="btn btn-primary" onclick="goLogin()">ورود مجدد</button></div>`; return; }
        area.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; return;
    }
    const sub = overview.subscription, pend = overview.pendingSubscription;
    let subHtml = '';
    if (sub) {
        const pct = sub.included_requests ? Math.min(100, Math.round(sub.requests_used / sub.included_requests * 100)) : 0;
        subHtml = `<div class="sub-card">
            <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;"><b>💎 ${esc(sub.plan_title || 'اشتراک فعال')}</b><span style="font-size:.78rem;">تا ${fmtDate(sub.ends_at, false)}</span></div>
            <div style="font-size:.8rem;margin-top:.3rem;">${sub.included_requests ? `${fa(sub.requests_used)} از ${fa(sub.included_requests)} درخواست استفاده شده` : `${fa(sub.requests_used)} درخواست ثبت شده (نامحدود)`}</div>
            ${sub.included_requests ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}
            ${sub.hasQuota ? '' : '<div style="font-size:.78rem;color:var(--red);margin-top:.4rem;">سهمیهٔ این اشتراک تمام شده؛ درخواست‌های بعدی جداگانه حساب می‌شود.</div>'}
        </div>`;
    } else if (pend) {
        subHtml = `<div class="corr-box">⏳ درخواست اشتراک «${esc(pend.plan_title)}» ثبت شده و در انتظار تأیید رسید است.</div>`;
    } else if (catalog.plans.length) {
        subHtml = `<div class="corr-box" style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;">
            <span style="font-size:.86rem;">اشتراک فعال ندارید — با اشتراک، هزینهٔ هر درخواست جداگانه پرداخت نمی‌شود.</span>
            <button class="btn btn-gold btn-sm" onclick="openSubscribe()">مشاهده طرح‌ها</button></div>`;
    }
    const list = overview.requests.length ? overview.requests.map((r) => `
        <button class="corr-req ${r.unread_company ? 'unread' : ''}" onclick="openDetail(${r.id})">
            <div class="row1"><span class="code">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
            <div class="subj">${esc(r.subject)}</div>
            <div class="meta"><span>🏛️ ${esc(r.referred_office_name || r.office_name || '')}</span><span>${fmtDate(r.created_at, false)}</span>${payChip(r)}${r.priority === 'فوری' ? '<span class="pay-chip warn">فوری</span>' : ''}${r.unread_company ? '<span class="pay-chip ok">جدید</span>' : ''}</div>
        </button>`).join('') : '<div class="empty-state">هنوز درخواستی ثبت نکرده‌اید</div>';
    area.innerHTML = `<h2>📋 درخواست‌های من</h2>
        <div style="display:flex;flex-direction:column;gap:.8rem;margin-bottom:.8rem;">${subHtml}
            <button class="btn btn-gold" onclick="openNewRequest()">✍️ ثبت درخواست جدید</button></div>
        ${list}`;
}

// ---------------------- ثبت درخواست جدید ----------------------
function canSubmitWithoutSub() { return catalog.allowWithoutSubscription; }
function hasQuota() { return !!(overview && overview.subscription && overview.subscription.hasQuota); }

function openNewRequest() {
    if (!catalog || !catalog.ready || !catalog.enabled) return;
    if (!getToken()) { goLogin(); return; }
    formState = { office: null, service: null };
    document.getElementById('newReqBody').innerHTML = `
        <div class="form-group"><label>۱. اداره موردنظر *</label>
            <input type="search" id="officeFilter" placeholder="🔍 جستجوی نام اداره..." oninput="renderOfficePick()" style="margin-bottom:.4rem;">
            <div class="pick-list" id="officePick"></div></div>
        <div class="form-group"><label>۲. نوع خدمت *</label>
            <div class="pick-list" id="servicePick"></div>
            <div class="cost-line" id="costLine">یک خدمت انتخاب کنید</div></div>
        <div class="form-group"><label>۳. موضوع *</label><input type="text" id="rqSubject" maxlength="200" placeholder="مثلاً: درخواست تمدید پروانه بهره‌برداری"></div>
        <div class="form-group"><label>۴. متن نامه / توضیحات</label><textarea id="rqBody" rows="6" placeholder="متن نامه یا شرح کار اداری را بنویسید..."></textarea></div>
        <div class="form-group">
            <label style="display:flex;gap:.5rem;align-items:flex-start;font-weight:600;cursor:pointer;">
                <input type="checkbox" id="rqPhysical" style="width:auto;margin-top:.2rem;"> نامهٔ رسمی (زنده/کاغذی) دارم و عکس یا PDF آن را بارگذاری می‌کنم</label>
            <div id="rqFilesBox" style="margin-top:.4rem;"></div>
            <div class="privacy-note">🔒 فایل‌ها با لینک غیرقابل‌حدس ذخیره می‌شوند؛ از ارسال مدارک بسیار محرمانه (کارت ملی، رمز و...) خودداری کنید.</div>
        </div>
        <div class="form-group"><label style="display:flex;gap:.5rem;align-items:center;font-weight:600;cursor:pointer;"><input type="checkbox" id="rqUrgent" style="width:auto;"> این درخواست فوری است</label></div>
        <button class="btn btn-gold" style="width:100%;" id="rqSubmit" onclick="submitRequest()">ثبت درخواست و دریافت کد رهگیری</button>`;
    mountUploader('rqFilesBox', { max: 5, label: '📎 افزودن عکس یا PDF نامه (حداکثر ۵ فایل)', onError: (m) => showToast(m, 'error') });
    renderOfficePick(); renderServicePick(); updateCostLine();
    openModal('newReqModal');
}

function renderOfficePick() {
    const q = (document.getElementById('officeFilter').value || '').trim();
    const offs = catalog.offices.filter((o) => !q || o.name.includes(q) || (o.county || '').includes(q));
    const groups = [['کل', 'ادارات کل (استانی)'], ['شهرستان', 'ادارات شهرستان']];
    let html = '';
    for (const [lv, label] of groups) {
        const part = offs.filter((o) => o.level === lv);
        if (!part.length) continue;
        html += `<div class="pick-group">${label}</div>` + part.map((o) => `
            <div class="pick-item ${formState.office === o.id ? 'sel' : ''}" onclick="pickOffice(${o.id})">
                <input type="radio" ${formState.office === o.id ? 'checked' : ''} tabindex="-1">
                <div class="pk-main">${esc(o.name)}${o.county ? `<small>${esc(o.county)}</small>` : ''}</div></div>`).join('');
    }
    document.getElementById('officePick').innerHTML = html || '<div class="empty-state" style="padding:1rem;">اداره‌ای پیدا نشد</div>';
}
function pickOffice(id) { formState.office = id; renderOfficePick(); }
function renderServicePick() {
    document.getElementById('servicePick').innerHTML = catalog.services.map((s) => `
        <div class="pick-item ${formState.service === s.id ? 'sel' : ''}" onclick="pickService(${s.id})">
            <input type="radio" ${formState.service === s.id ? 'checked' : ''} tabindex="-1">
            <div class="pk-main">${esc(s.title)}${s.description ? `<small>${esc(s.description)}</small>` : ''}</div>
            <span class="price-chip">${s.price ? fa(s.price) + ' تومان' : 'طبق توافق'}</span></div>`).join('');
}
function pickService(id) { formState.service = id; renderServicePick(); updateCostLine(); }
function updateCostLine() {
    const el = document.getElementById('costLine'), btn = document.getElementById('rqSubmit');
    const s = catalog.services.find((x) => x.id === formState.service);
    el.className = 'cost-line'; btn.disabled = false;
    if (hasQuota()) { el.classList.add('good'); el.textContent = '✅ از سهمیهٔ اشتراک شما کسر می‌شود؛ هزینهٔ جداگانه ندارد.'; return; }
    if (!canSubmitWithoutSub()) {
        el.innerHTML = '⚠️ برای ثبت درخواست باید اشتراک فعال داشته باشید. <a href="#" onclick="closeModal(\'newReqModal\');openSubscribe();return false;" style="font-weight:800;text-decoration:underline;">خرید اشتراک</a>';
        btn.disabled = true; return;
    }
    if (catalog.firstRequestFree && overview && !overview.requests.length) { el.classList.add('good'); el.textContent = '🎁 اولین درخواست شما رایگان است.'; return; }
    if (!s) { el.textContent = 'یک خدمت انتخاب کنید'; return; }
    el.textContent = s.price ? `هزینه: ${fa(s.price)} تومان — پس از ثبت، پرداخت کارت‌به‌کارت و بارگذاری رسید.` : 'هزینه پس از بررسی توسط کارگزار اعلام می‌شود.';
}

async function submitRequest() {
    if (!formState.office) { showToast('اداره را انتخاب کنید', 'error'); return; }
    if (!formState.service) { showToast('نوع خدمت را انتخاب کنید', 'error'); return; }
    const subject = document.getElementById('rqSubject').value.trim();
    const body = document.getElementById('rqBody').value.trim();
    if (!subject) { showToast('موضوع را بنویسید', 'error'); return; }
    if (uploaderBusy('rqFilesBox')) { showToast('صبر کنید تا آپلود فایل تمام شود', 'error'); return; }
    const attachments = uploaderUrls('rqFilesBox');
    if (!body && !attachments.length) { showToast('متن نامه را بنویسید یا فایل آن را بارگذاری کنید', 'error'); return; }
    const btn = document.getElementById('rqSubmit'); btn.disabled = true; btn.textContent = 'در حال ثبت...';
    try {
        const r = await apiCall('POST', '/api/company/corr/requests', {
            office_id: formState.office, service_id: formState.service, subject, body, attachments,
            needs_physical: document.getElementById('rqPhysical').checked, priority: document.getElementById('rqUrgent').checked ? 'فوری' : 'عادی',
        }, true);
        closeModal('newReqModal');
        await loadMy();
        await openDetail(r.id, r);
    } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'ثبت درخواست و دریافت کد رهگیری'; }
}

// ---------------------- جزئیات درخواست ----------------------
async function openDetail(id, created) {
    openModal('detailModal');
    const body = document.getElementById('detailBody');
    body.innerHTML = '<div class="loading">در حال بارگذاری...</div>';
    try {
        const r = await apiCall('GET', '/api/company/corr/requests/' + id, null, true);
        currentDetail = r;
        document.getElementById('detailTitle').textContent = 'درخواست ' + r.tracking_code;
        const p = (overview && overview.payment) || {};
        const needsPay = r.payment_status === 'unpaid' || r.payment_status === 'receipt_sent';
        body.innerHTML = `
            ${created ? `<div class="corr-box" style="background:#dcfce7;border-color:#86efac;color:#166534;text-align:center;margin-bottom:.8rem;">
                <b>✅ درخواست ثبت شد</b>
                <div style="font-size:1.2rem;font-weight:800;direction:ltr;margin:.3rem 0;">${esc(r.tracking_code)}</div>
                <div style="font-size:.8rem;">${esc(created.message || '')}</div>
                <button class="btn btn-sm btn-outline" style="margin-top:.5rem;" onclick="copyCode('${esc(r.tracking_code)}')">📋 کپی کد رهگیری</button></div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <span style="direction:ltr;font-weight:800;">${esc(r.tracking_code)}</span>${statusChip(r.status)}</div>
            ${stageBar(r.status)}
            <div class="corr-box" style="font-size:.84rem;">
                <div>🏛️ اداره: <b>${esc(r.office_name || '')}</b>${r.referred_office_name ? ` — ارجاع‌شده به: <b>${esc(r.referred_office_name)}</b>` : ''}</div>
                <div>🧾 خدمت: <b>${esc(r.service_title || '')}</b> · ${payChip(r)}</div>
                <div>📅 ثبت: ${fmtDate(r.created_at)}${r.priority === 'فوری' ? ' · <b style="color:var(--red)">فوری</b>' : ''}</div>
                <hr style="border:none;border-top:1px solid var(--border);margin:.6rem 0;">
                <div><b>${esc(r.subject)}</b></div>
                ${r.body ? `<div style="white-space:pre-wrap;margin-top:.3rem;color:var(--text-light);">${esc(r.body)}</div>` : ''}
                ${attHtml(r.attachments)}
            </div>
            ${needsPay ? payBoxHtml(r, p) : ''}
            <h4 style="margin:1rem 0 .3rem;">خط زمانی</h4>
            ${timeline(r.events)}
            ${r.status !== 'لغو شد' ? `
                <div class="corr-box" style="margin-top:.8rem;">
                    <b style="font-size:.86rem;">💬 ارسال پیام یا مدرک جدید</b>
                    <textarea id="msgText" rows="3" placeholder="پیام خود را بنویسید..." style="margin:.5rem 0;"></textarea>
                    <div id="msgFilesBox"></div>
                    <button class="btn btn-primary btn-sm" style="margin-top:.5rem;" onclick="sendMessage(${r.id})">ارسال</button>
                </div>` : ''}
            ${r.status === 'ثبت شد' ? `<button class="btn btn-danger btn-sm" style="margin-top:.8rem;" onclick="cancelRequest(${r.id})">لغو درخواست</button>` : ''}`;
        if (r.status !== 'لغو شد') mountUploader('msgFilesBox', { max: 3, label: '📎 افزودن فایل', onError: (m) => showToast(m, 'error') });
        if (needsPay) mountUploader('receiptBox', { max: 1, label: '🧾 بارگذاری تصویر رسید', onError: (m) => showToast(m, 'error') });
        loadMy();
    } catch (e) { body.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
function payBoxHtml(r, p) {
    return `<div class="pay-box">
        <b>💳 پرداخت ${r.fee ? fa(r.fee) + ' تومان' : ''}</b>
        ${p.card_number ? `<div class="card-no" onclick="copyCard('${esc(p.card_number)}')" style="cursor:pointer" title="برای کپی کلیک کنید">${esc(p.card_number)}</div>
            <div class="card-meta">${esc(p.card_owner || '')} ${p.bank_name ? '— ' + esc(p.bank_name) : ''}</div>` : '<div style="font-size:.82rem;margin:.4rem 0;">شمارهٔ کارت هنوز توسط مدیر ثبت نشده؛ با پشتیبانی تماس بگیرید.</div>'}
        <div style="font-size:.76rem;color:var(--text-light);margin:.4rem 0;">${esc(p.note || '')}</div>
        ${r.payment_status === 'receipt_sent' ? '<div class="pay-chip warn" style="display:inline-block;margin-bottom:.4rem;">رسید شما ثبت شده و در حال بررسی است</div>' : ''}
        <div id="receiptBox"></div>
        <input type="text" id="receiptNote" placeholder="شمارهٔ پیگیری / توضیح پرداخت (اختیاری)" style="margin-top:.4rem;">
        <button class="btn btn-gold btn-sm" style="margin-top:.5rem;" onclick="sendReceipt(${r.id})">ثبت رسید</button>
    </div>`;
}
async function copyCard(n) { showToast((await copyText(String(n).replace(/\D/g, ''))) ? 'شمارهٔ کارت کپی شد' : 'کپی نشد', 'success'); }
async function copyCode(c) { showToast((await copyText(c)) ? 'کد رهگیری کپی شد' : 'کپی نشد', 'success'); }

async function sendMessage(id) {
    if (uploaderBusy('msgFilesBox')) { showToast('صبر کنید تا آپلود تمام شود', 'error'); return; }
    const text = document.getElementById('msgText').value.trim(), attachments = uploaderUrls('msgFilesBox');
    if (!text && !attachments.length) { showToast('پیام یا فایل لازم است', 'error'); return; }
    try { await apiCall('POST', `/api/company/corr/requests/${id}/messages`, { text, attachments }, true); showToast('ارسال شد', 'success'); openDetail(id); }
    catch (e) { showToast(e.message, 'error'); }
}
async function sendReceipt(id) {
    if (uploaderBusy('receiptBox')) { showToast('صبر کنید تا آپلود تمام شود', 'error'); return; }
    const receipt_url = uploaderUrls('receiptBox')[0] || '', receipt_note = document.getElementById('receiptNote').value.trim();
    if (!receipt_url && !receipt_note) { showToast('تصویر رسید یا شمارهٔ پیگیری را وارد کنید', 'error'); return; }
    try { await apiCall('POST', `/api/company/corr/requests/${id}/receipt`, { receipt_url, receipt_note }, true); showToast('رسید ثبت شد؛ پس از بررسی تأیید می‌شود', 'success'); openDetail(id); }
    catch (e) { showToast(e.message, 'error'); }
}
async function cancelRequest(id) {
    if (!confirm('این درخواست لغو شود؟')) return;
    try { await apiCall('POST', `/api/company/corr/requests/${id}/cancel`, {}, true); showToast('لغو شد', 'success'); openDetail(id); }
    catch (e) { showToast(e.message, 'error'); }
}

// ---------------------- اشتراک ----------------------
let subPick = null;
function openSubscribe(planId) {
    if (!getToken()) { goLogin(); return; }
    if (!catalog.plans.length) { showToast('فعلاً طرح اشتراکی تعریف نشده است', 'error'); return; }
    subPick = planId || (catalog.plans.find((p) => p.badge) || catalog.plans[0]).id;
    renderSubscribe(); openModal('subModal');
}
function renderSubscribe() {
    const p = (overview && overview.payment) || {};
    document.getElementById('subBody').innerHTML = `
        <div class="pick-list" style="max-height:none;margin-bottom:.8rem;">${catalog.plans.map((x) => `
            <div class="pick-item ${subPick === x.id ? 'sel' : ''}" onclick="subPick=${x.id};renderSubscribe()">
                <input type="radio" ${subPick === x.id ? 'checked' : ''} tabindex="-1">
                <div class="pk-main">${esc(x.title)}<small>${x.included_requests ? fa(x.included_requests) + ' درخواست' : 'نامحدود'} · ${fa(x.duration_days)} روز</small></div>
                <span class="price-chip">${fa(x.price)} تومان</span></div>`).join('')}</div>
        <div class="pay-box"><b>💳 پرداخت کارت‌به‌کارت</b>
            ${p.card_number ? `<div class="card-no" onclick="copyCard('${esc(p.card_number)}')" style="cursor:pointer">${esc(p.card_number)}</div><div class="card-meta">${esc(p.card_owner || '')} ${p.bank_name ? '— ' + esc(p.bank_name) : ''}</div>` : '<div style="font-size:.82rem;margin:.4rem 0;">شمارهٔ کارت هنوز ثبت نشده؛ با پشتیبانی تماس بگیرید.</div>'}
            <div style="font-size:.76rem;color:var(--text-light);margin:.4rem 0;">${esc(p.note || '')}</div>
            <div id="subReceiptBox"></div>
            <input type="text" id="subReceiptNote" placeholder="شمارهٔ پیگیری / توضیح پرداخت (اختیاری)" style="margin-top:.4rem;">
        </div>
        <button class="btn btn-gold" style="width:100%;" onclick="submitSubscribe()">ثبت درخواست اشتراک</button>`;
    mountUploader('subReceiptBox', { max: 1, label: '🧾 بارگذاری تصویر رسید', onError: (m) => showToast(m, 'error') });
}
async function submitSubscribe() {
    if (uploaderBusy('subReceiptBox')) { showToast('صبر کنید تا آپلود تمام شود', 'error'); return; }
    const receipt_url = uploaderUrls('subReceiptBox')[0] || '', receipt_note = document.getElementById('subReceiptNote').value.trim();
    if (!receipt_url && !receipt_note) { showToast('تصویر رسید یا شمارهٔ پیگیری را وارد کنید', 'error'); return; }
    try {
        const r = await apiCall('POST', '/api/company/corr/subscribe', { plan_id: subPick, receipt_url, receipt_note }, true);
        closeModal('subModal'); showToast(r.message, 'success'); loadMy();
    } catch (e) { showToast(e.message, 'error'); }
}

// ---------------------- شروع ----------------------
window.addEventListener('DOMContentLoaded', async () => {
    await loadCatalog();
    await loadMy();
    const code = new URLSearchParams(location.search).get('code');
    if (code) {
        const mine = overview && overview.requests.find((r) => r.tracking_code === code.toUpperCase());
        if (mine) openDetail(mine.id); else { document.getElementById('trackInput').value = code; doTrack(code); }
    }
});
