// حالت تاریک/روشن — این فایل را زود در <head> بارگذاری کنید تا از چشمک‌زدن رنگ جلوگیری شود
(function () {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();
window.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('themeToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'header-toggle-btn';
    btn.title = 'حالت تاریک/روشن';
    const headerSlot = document.querySelector('.topbar');
    if (headerSlot) {
        btn.classList.add('theme-toggle-inline');
        headerSlot.style.position = headerSlot.style.position || 'relative';
        headerSlot.appendChild(btn);
    }
    function updateIcon() {
        btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    }
    btn.onclick = function () {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
        updateIcon();
    };
    updateIcon();
    if (!headerSlot) document.body.appendChild(btn);
});
