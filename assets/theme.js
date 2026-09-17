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
    const actionsSlot = document.querySelector('.topbar .header-actions');
    if (actionsSlot) {
        actionsSlot.insertBefore(btn, actionsSlot.firstChild);
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
    if (!actionsSlot) document.body.appendChild(btn);
});
