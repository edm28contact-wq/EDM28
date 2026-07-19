(() => {
  if (document.getElementById('edm-white-background')) return;
  const style = document.createElement('style');
  style.id = 'edm-white-background';
  style.textContent = `
    :root{--bg:#fff;--surface:#fff;--surface-2:#f2f4f5;--ink:#273137;--muted:#68747a;--border:#d8dfe2;--brand:#b86e42;--shadow:0 18px 46px rgba(36,48,54,.10)}
    html,body,.app-shell,.main{background:#fff!important}
    body{color:#273137!important;background-image:none!important}
    p,.small,.field-hint{color:#68747a!important}
    .sidebar,.topbar,.panel,.card{background:#fff!important;color:#273137!important;border-color:#d8dfe2!important}
    input,select,textarea{background:#fff!important;color:#273137!important;border-color:#cbd4d8!important}
    .nav button:not(.active),.btn-ghost{color:#273137!important}
    .table th,.table td{border-color:#d8dfe2!important}
  `;
  document.head.appendChild(style);
})();
