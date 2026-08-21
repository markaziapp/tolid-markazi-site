// ===================================================================
// ثبت Service Worker + نمایش تذکر نصب برنامه در اولین بازدید
// ===================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

let deferredInstallPrompt = null;

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function showInstallBanner(mode) {
    if (isStandalone()) return; // از قبل به‌عنوان اپ نصب شده
    if (localStorage.getItem('installBannerDismissed') === '1') return;
    if (document.getElementById('pwaInstallBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#0f3460; color:#fff; padding:0.9rem 1rem; display:flex; align-items:center; gap:0.8rem; z-index:3000; box-shadow:0 -4px 16px rgba(0,0,0,0.2); font-family:inherit;';

    const text = document.createElement('div');
    text.style.cssText = 'flex:1; font-size:0.82rem; line-height:1.5;';
    text.textContent = mode === 'ios'
        ? 'برای نصب این برنامه روی گوشی: دکمه Share را بزنید، سپس «Add to Home Screen» را انتخاب کنید.'
        : 'این برنامه را روی گوشی خود نصب کنید تا سریع‌تر و راحت‌تر به آن دسترسی داشته باشید.';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:0.5rem; flex-shrink:0;';

    if (mode !== 'ios') {
        const installBtn = document.createElement('button');
        installBtn.textContent = 'نصب';
        installBtn.style.cssText = 'background:#d4a94e; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-weight:700; font-size:0.82rem; cursor:pointer;';
        installBtn.onclick = async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
            }
            closeBanner();
        };
        btnRow.appendChild(installBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = mode === 'ios' ? 'متوجه شدم' : 'بعداً';
    closeBtn.style.cssText = 'background:transparent; color:#cbd5e1; border:1px solid rgba(255,255,255,0.3); padding:0.5rem 0.9rem; border-radius:8px; font-size:0.8rem; cursor:pointer;';
    closeBtn.onclick = closeBanner;
    btnRow.appendChild(closeBtn);

    function closeBanner() {
        localStorage.setItem('installBannerDismissed', '1');
        banner.remove();
    }

    banner.appendChild(text);
    banner.appendChild(btnRow);
    document.body.appendChild(banner);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner('android');
});

window.addEventListener('appinstalled', () => {
    localStorage.setItem('installBannerDismissed', '1');
    const el = document.getElementById('pwaInstallBanner');
    if (el) el.remove();
});

// روی iOS رویداد beforeinstallprompt اصلاً وجود ندارد؛ راهنمای دستی نشان می‌دهیم
window.addEventListener('DOMContentLoaded', () => {
    if (isIos() && !isStandalone()) {
        setTimeout(() => showInstallBanner('ios'), 1200);
    }
});
