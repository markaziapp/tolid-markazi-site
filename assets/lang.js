// ===================================================================
// دوزبانه (فارسی/انگلیسی) — نسخهٔ پایه
// این نسخه ناوبری اصلی و بخش سردر صفحه را ترجمه می‌کند؛ محتوای تولیدشده
// توسط کاربران (آگهی‌ها، توضیحات و ...) همچنان فارسی می‌ماند چون توسط
// خودِ کاربران به فارسی نوشته می‌شود.
// ===================================================================
const I18N_DICT = {
    tab_home: { fa: 'خانه', en: 'Home' },
    tab_offers: { fa: 'عرضه محصولات', en: 'Products' },
    tab_requests: { fa: 'درخواست خرید', en: 'Buy Requests' },
    tab_services: { fa: 'درخواست خدمات', en: 'Services' },
    tab_companies: { fa: 'واحدهای تولیدی', en: 'Companies' },
    hero_title: { fa: 'همتا صنعت', en: 'Hamta Sanat' },
    hero_sub: { fa: 'خرید، فروش و حل نیازهای تولید در یک جا — رایگان', en: 'Buy, sell, and solve production needs in one place — free' },
    search_placeholder: { fa: 'جستجوی محصول، شرکت یا نیاز صنعتی...', en: 'Search products, companies, or needs...' },
    btn_supply: { fa: '+ عرضه محصول', en: '+ List a Product' },
    btn_purchase: { fa: '+ درخواست خرید', en: '+ Buy Request' },
    btn_service: { fa: '+ درخواست خدمات', en: '+ Service Request' },
};

function applyLang(lang) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (I18N_DICT[key]) el.textContent = I18N_DICT[key][lang] || I18N_DICT[key].fa;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (I18N_DICT[key]) el.placeholder = I18N_DICT[key][lang] || I18N_DICT[key].fa;
    });
    localStorage.setItem('lang', lang);
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = lang === 'fa' ? 'EN' : 'FA';
}

window.addEventListener('DOMContentLoaded', function () {
    const actionsSlot = document.querySelector('.topbar .header-actions');
    if (!actionsSlot) return;
    const btn = document.createElement('button');
    btn.id = 'langToggle';
    btn.className = 'header-toggle-btn lang-toggle-inline';
    btn.title = 'FA / EN';
    btn.onclick = function () {
        const current = localStorage.getItem('lang') || 'fa';
        applyLang(current === 'fa' ? 'en' : 'fa');
    };
    actionsSlot.insertBefore(btn, actionsSlot.firstChild);
    applyLang(localStorage.getItem('lang') || 'fa');
});
