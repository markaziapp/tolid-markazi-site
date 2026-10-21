// ===================================================================
// توابع مشترک ماژول «دستیار اداری» — در صفحهٔ واحد، پورتال ادارات و پنل مدیریت
// همه‌چیز زیر یک نام (CX) است تا با توابع هم‌نام سایر فایل‌ها تداخل نکند.
// ===================================================================
(function () {
    const STATUSES = ['ثبت شد', 'در حال بررسی', 'ارجاع شد', 'پاسخ اداره دریافت شد', 'پاسخ ارسال شد', 'انجام شد', 'لغو شد'];
    const STAGES = ['ثبت', 'بررسی', 'ارجاع', 'پاسخ', 'انجام'];

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
    const api = (p) => (window.API_BASE || '') + p;

    function fmtDate(sql, withTime = true) {
        if (!sql) return '—';
        const d = new Date(String(sql).replace(' ', 'T') + 'Z');
        if (isNaN(d)) return String(sql);
        const opt = withTime
            ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
            : { year: 'numeric', month: '2-digit', day: '2-digit' };
        return d.toLocaleString('fa-IR', opt);
    }
    const statusClass = (st) => { const i = STATUSES.indexOf(st); return 'st-' + (i < 0 ? 0 : i); };
    const statusChip = (st) => `<span class="st-chip ${statusClass(st)}">${esc(st)}</span>`;
    function stageIndex(st) {
        return ({ 'ثبت شد': 0, 'در حال بررسی': 1, 'ارجاع شد': 2, 'پاسخ اداره دریافت شد': 3, 'پاسخ ارسال شد': 3, 'انجام شد': 4 })[st] ?? -1;
    }
    function stageBar(st) {
        if (st === 'لغو شد') return '<div class="stage-bar"><div class="stg now" style="flex:1"><div class="dot" style="background:var(--red)">✕</div>لغو شد</div></div>';
        const cur = stageIndex(st);
        return '<div class="stage-bar">' + STAGES.map((s, i) =>
            `<div class="stg ${i < cur || (cur === 4 && i === 4) ? 'done' : i === cur ? 'now' : ''}"><div class="dot">${i < cur || (cur === 4 && i === 4) ? '✓' : i + 1}</div>${s}</div>`).join('') + '</div>';
    }
    function payChip(r) {
        const m = {
            unpaid: ['در انتظار پرداخت' + (r.fee ? ` (${fa(r.fee)} تومان)` : ''), 'warn'],
            receipt_sent: ['رسید در حال بررسی', 'warn'],
            paid: ['پرداخت‌شده', 'ok'],
            subscription: ['از محل اشتراک', 'ok'],
            free: ['رایگان', 'ok'],
        }[r.payment_status];
        return m ? `<span class="pay-chip ${m[1]}">${m[0]}</span>` : '';
    }
    function attHtml(urls) {
        if (!urls || !urls.length) return '';
        return '<div class="att-list">' + urls.map((u, i) => {
            const name = decodeURIComponent(String(u).split('/').pop() || ('پیوست ' + (i + 1))).slice(-28);
            return `<span class="att-chip">📎 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(name)}</a></span>`;
        }).join('') + '</div>';
    }
    // خط زمانی؛ extra(ev) می‌تواند HTML اضافه (مثلاً دکمه‌های انتشار برای مدیر) برگرداند
    function timeline(events, extra) {
        if (!events || !events.length) return '<div class="empty-state" style="padding:1rem;">هنوز رویدادی ثبت نشده</div>';
        return '<div class="timeline">' + events.map((e) => `
            <div class="tl-item ${e.actor === 'office' ? 'office' : e.actor === 'company' ? 'company' : ''} ${extra && e.visible_company === 0 && e.visible_office === 0 ? 'hidden-ev' : ''}">
                <div class="tl-head"><b>${esc(e.title || '')}</b><span>${fmtDate(e.created_at)}</span></div>
                ${e.actor_name ? `<div class="tl-who">${esc(e.actor_name)}</div>` : ''}
                ${e.text ? `<div class="tl-text">${esc(e.text)}</div>` : ''}
                ${attHtml(e.attachments)}
                ${extra ? extra(e) : ''}
            </div>`).join('') + '</div>';
    }

    async function copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            let ok = false; try { ok = document.execCommand('copy'); } catch { }
            ta.remove(); return ok;
        }
    }

    // ---------------- آپلود فایل (عکس با فشرده‌سازی ملایم، PDF بدون تغییر) ----------------
    async function prepFile(file) {
        if (!file.type.startsWith('image/')) return file;
        try {
            const bmp = await createImageBitmap(file);
            let w = bmp.width, h = bmp.height; const max = 1800;
            if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').drawImage(bmp, 0, 0, w, h);
            const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
            return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
        } catch { return file; }
    }
    async function uploadFile(file) {
        const f = await prepFile(file);
        if (f.size > 8 * 1024 * 1024) throw new Error('حجم هر فایل باید کمتر از ۸ مگابایت باشد');
        const fd = new FormData(); fd.append('file', f, f.name);
        const res = await fetch(api('/api/upload'), { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'آپلود ناموفق بود');
        return data.url;
    }

    const uploaders = {};
    function mountUploader(id, opts = {}) {
        const el = document.getElementById(id); if (!el) return;
        const max = opts.max || 5, label = opts.label || '📎 افزودن عکس یا PDF';
        uploaders[id] = { items: [], max };
        el.innerHTML = `<label class="upload-zone" for="${id}_in">${label}</label>
            <input type="file" id="${id}_in" accept="image/*,.pdf" ${max > 1 ? 'multiple' : ''} hidden>
            <div class="att-list" id="${id}_list"></div>`;
        el.querySelector('input').addEventListener('change', async (e) => {
            const u = uploaders[id];
            const files = [...e.target.files]; e.target.value = '';
            for (const f of files) {
                if (u.items.length >= u.max) { opts.onError && opts.onError(`حداکثر ${u.max} فایل`); break; }
                const item = { name: f.name, uploading: true, url: '' }; u.items.push(item); renderUploader(id);
                try { item.url = await uploadFile(f); item.uploading = false; }
                catch (err) { u.items.splice(u.items.indexOf(item), 1); opts.onError && opts.onError(err.message); }
                renderUploader(id);
            }
        });
    }
    function renderUploader(id) {
        const u = uploaders[id], list = document.getElementById(id + '_list'); if (!u || !list) return;
        list.innerHTML = u.items.map((it, i) => it.uploading
            ? `<span class="att-chip">⏳ ${esc(it.name.slice(-24))}</span>`
            : `<span class="att-chip">📎 <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name.slice(-24))}</a>
                 <button type="button" title="حذف" onclick="CX.removeUpload('${id}',${i})">×</button></span>`).join('');
    }
    function removeUpload(id, i) { uploaders[id].items.splice(i, 1); renderUploader(id); }
    const uploaderUrls = (id) => (uploaders[id] ? uploaders[id].items.filter((i) => i.url).map((i) => i.url) : []);
    const uploaderBusy = (id) => (uploaders[id] ? uploaders[id].items.some((i) => i.uploading) : false);
    const uploaderClear = (id) => { if (uploaders[id]) { uploaders[id].items = []; renderUploader(id); } };

    window.CX = {
        STATUSES, STAGES, esc, fa, api, fmtDate, statusClass, statusChip, stageIndex, stageBar, payChip, attHtml, timeline, copyText,
        uploadFile, mountUploader, removeUpload, uploaderUrls, uploaderBusy, uploaderClear,
    };
})();
