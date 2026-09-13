'use strict';
(function(){
  var THEME_KEY = 'sap_theme';
  function sapCookieGet(name){
    return document.cookie.split('; ').reduce(function(acc, part){
      var p = part.split('='); return p[0] === name ? decodeURIComponent(p.slice(1).join('=')) : acc;
    }, '');
  }
  function sapCookieSet(name, value){
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
  }
  function getSavedTheme(){
    return sapCookieGet(THEME_KEY) || 'light';
  }
  function saveTheme(value){
    value = value === 'dark' ? 'dark' : 'light';
    sapCookieSet(THEME_KEY, value);
  }
  function sapApplyTheme(t){
    t = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','theme-color'); document.head.appendChild(meta); }
    meta.setAttribute('content', t === 'dark' ? '#151624' : '#ffffff');
    document.querySelectorAll('[data-theme-icon]').forEach(function(el){
      el.textContent = t === 'dark' ? '☀' : '☾';
    });
  }
  function sapToggleTheme(){
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    saveTheme(cur);
    sapApplyTheme(cur);
    if (typeof renderDashboard === 'function') setTimeout(renderDashboard, 0);
  }
  window.sapApplyTheme = sapApplyTheme;
  window.sapToggleTheme = sapToggleTheme;
  window.toggleTheme = sapToggleTheme;
  sapApplyTheme(getSavedTheme());
})();
