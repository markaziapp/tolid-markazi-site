// ===================================================================
// دکمهٔ شناور پشتیبانی — همه‌جای سایت در دسترس
// فقط کافی است <script src="assets/support-widget.js"></script> را
// قبل از بسته‌شدن </body> در هر صفحه‌ای اضافه کنید
// ===================================================================
(function () {
    function api(path) { return (window.API_BASE || '') + path; }
    function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function getToken() { return localStorage.getItem('companyToken'); }

    // ---------- استایل ----------
    const style = document.createElement('style');
    style.textContent = `
        #supportFab {
            position: fixed; bottom: 18px; left: 18px; z-index: 9998;
            width: 56px; height: 56px; border-radius: 50%;
            background: linear-gradient(135deg, #0f3460, #0a2647);
            color: #d4a94e; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; box-shadow: 0 4px 16px rgba(15,52,96,0.4);
            transition: transform 0.2s;
        }
        #supportFab:hover { transform: scale(1.08); }
        @keyframes supportShake {
            0%, 100% { transform: rotate(0); }
            10% { transform: rotate(-12deg) scale(1.05); }
            20% { transform: rotate(10deg) scale(1.05); }
            30% { transform: rotate(-8deg); }
            40% { transform: rotate(6deg); }
            50% { transform: rotate(0); }
        }
        #supportFab.shake { animation: supportShake 0.8s ease; }
        #supportPanel {
            position: fixed; bottom: 84px; left: 18px; z-index: 9999;
            width: 300px; max-width: calc(100vw - 36px); height: 380px;
            background: #fff; border-radius: 14px; overflow: hidden;
            box-shadow: 0 10px 34px rgba(0,0,0,0.25); display: none;
            flex-direction: column; font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl;
        }
        #supportPanel.open { display: flex; }
        #supportPanel .sp-head { background: #0f3460; color: #fff; padding: 0.7rem 1rem; font-weight: 700; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; }
        #supportPanel .sp-head button { background: none; border: none; color: #fff; font-size: 1.1rem; cursor: pointer; }
        #supportPanel .sp-body { flex: 1; overflow-y: auto; padding: 0.7rem; background: #f7f8fa; }
        #supportPanel .sp-msg { max-width: 80%; padding: 0.45rem 0.7rem; border-radius: 10px; font-size: 0.82rem; margin-bottom: 0.5rem; line-height: 1.5; }
        #supportPanel .sp-msg.mine { background: #0f3460; color: #fff; margin-right: auto; border-bottom-left-radius: 3px; }
        #supportPanel .sp-msg.theirs { background: #fff; border: 1px solid #e2e8f0; margin-left: auto; border-bottom-right-radius: 3px; }
        #supportPanel .sp-input-row { display: flex; gap: 0.4rem; padding: 0.6rem; border-top: 1px solid #e2e8f0; }
        #supportPanel .sp-input-row input, #supportPanel .sp-input-row textarea { flex: 1; padding: 0.5rem 0.7rem; border-radius: 18px; border: 1px solid #e2e8f0; font-family: inherit; font-size: 0.82rem; }
        #supportPanel .sp-input-row button { background: #d4a94e; color: #fff; border: none; padding: 0.5rem 0.9rem; border-radius: 18px; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
        #supportPanel .sp-guest-form { padding: 0.9rem; font-size: 0.82rem; }
        #supportPanel .sp-guest-form input, #supportPanel .sp-guest-form textarea { width: 100%; margin-bottom: 0.6rem; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit; font-size: 0.82rem; }
        #supportPanel .sp-guest-form button { width: 100%; background: #d4a94e; color: #fff; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // ---------- ساخت دکمه و پنل ----------
    const fab = document.createElement('button');
    fab.id = 'supportFab';
    fab.innerHTML = '💬';
    fab.title = 'پشتیبانی';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'supportPanel';
    panel.innerHTML = `
        <div class="sp-head"><span>🛟 پشتیبانی</span><button id="spClose">✕</button></div>
        <div class="sp-body" id="spBody"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById('spClose').onclick = () => panel.classList.remove('open');
    fab.onclick = () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) initPanel();
    };

    // هر ۲۵ ثانیه یک تکان کوچک برای جلب توجه (فقط وقتی پنل بسته است)
    setInterval(() => {
        if (!panel.classList.contains('open')) {
            fab.classList.add('shake');
            setTimeout(() => fab.classList.remove('shake'), 800);
        }
    }, 25000);

    // ---------- منطق داخل پنل ----------
    let pollInterval = null;

    function initPanel() {
        const body = document.getElementById('spBody');
        if (getToken()) {
            body.innerHTML = `
                <div id="spMessages" style="display:flex; flex-direction:column;"></div>
            `;
            panel.querySelector('.sp-body').insertAdjacentHTML('afterend', `
                <div class="sp-input-row">
                    <input type="text" id="spInput" placeholder="پیام خود را بنویسید...">
                    <button id="spSend">ارسال</button>
                </div>
            `);
            document.getElementById('spSend').onclick = sendLoggedInMessage;
            document.getElementById('spInput').onkeydown = (e) => { if (e.key === 'Enter') sendLoggedInMessage(); };
            loadLoggedInThread();
            if (!pollInterval) pollInterval = setInterval(loadLoggedInThread, 15000);
        } else {
            if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
            const existingInputRow = panel.querySelector('.sp-input-row');
            if (existingInputRow) existingInputRow.remove();
            body.innerHTML = `
                <div class="sp-guest-form">
                    <p style="margin-bottom:0.6rem; color:#64748b;">برای گفتگوی مستقیم باید وارد پنل خود شوید. اگر ثبت‌نام نکرده‌اید، همین‌جا پیام بگذارید تا با شما تماس بگیریم:</p>
                    <input type="text" id="spGuestName" placeholder="نام شما">
                    <input type="tel" id="spGuestPhone" placeholder="شماره تماس *">
                    <textarea id="spGuestMsg" rows="3" placeholder="پیام شما *"></textarea>
                    <button id="spGuestSend">ارسال پیام</button>
                    <div id="spGuestNote" style="margin-top:0.6rem; color:#16a34a; display:none;">پیام شما ارسال شد ✔</div>
                </div>
            `;
            document.getElementById('spGuestSend').onclick = sendGuestMessage;
        }
    }

    async function loadLoggedInThread() {
        try {
            const res = await fetch(api('/api/support/thread'), { headers: { Authorization: 'Bearer ' + getToken() } });
            const data = await res.json();
            const box = document.getElementById('spMessages');
            if (!box) return;
            box.innerHTML = (data.messages || []).map(m => `
                <div class="sp-msg ${m.sender_type === 'company' ? 'mine' : 'theirs'}">${esc(m.body)}</div>
            `).join('') || '<div style="color:#94a3b8; font-size:0.8rem; text-align:center; margin-top:1rem;">سؤال یا مشکلی دارید؟ همین‌جا بنویسید</div>';
            panel.querySelector('.sp-body').scrollTop = panel.querySelector('.sp-body').scrollHeight;
        } catch (e) { /* بی‌سروصدا رد می‌شود */ }
    }
    async function sendLoggedInMessage() {
        const input = document.getElementById('spInput');
        const body = input.value.trim();
        if (!body) return;
        input.value = '';
        try {
            await fetch(api('/api/support/messages'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
                body: JSON.stringify({ body }),
            });
            loadLoggedInThread();
        } catch (e) { input.value = body; }
    }
    async function sendGuestMessage() {
        const name = document.getElementById('spGuestName').value.trim();
        const phone = document.getElementById('spGuestPhone').value.trim();
        const message = document.getElementById('spGuestMsg').value.trim();
        if (!phone || !message) { alert('شماره تماس و متن پیام الزامی است'); return; }
        try {
            await fetch(api('/api/contact'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, subject: '💬 پیام از دکمهٔ شناور پشتیبانی', message }),
            });
            document.getElementById('spGuestNote').style.display = 'block';
            document.getElementById('spGuestMsg').value = '';
        } catch (e) { alert('ارسال ناموفق بود؛ دوباره امتحان کنید'); }
    }
})();
