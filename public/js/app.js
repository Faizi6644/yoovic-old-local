(function () {
  if (window.lucide) window.lucide.createIcons();

  document.addEventListener('click', function (e) {
    const navToggle = e.target.closest('[data-nav-toggle]');
    if (navToggle) {
      const sub = document.getElementById(navToggle.getAttribute('aria-controls'));
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      sub.hidden = expanded;
    } else if (e.target.closest('[data-sidebar-toggle]')) document.body.classList.toggle('sidebar-open');
    else if (e.target.closest('[data-sidebar-close]')) document.body.classList.remove('sidebar-open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
  });
})();
