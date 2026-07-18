(() => {
  const style = document.createElement('style');
  style.id = 'edm-reference-palette';
  style.textContent = `
    :root{
      color-scheme:light;
      --bg:#cec7c0;
      --surface:#e5ded7;
      --surface-2:#d9d0c8;
      --ink:#303538;
      --muted:#68625e;
      --border:#b9afa6;
      --brand:#b86e42;
      --shadow:0 14px 32px rgba(52,46,42,.12)
    }
    html,body,.app-shell,.main{background:#cec7c0!important;color:#303538!important}
    body{background-image:none!important}
    p,.small,.field-hint{color:#68625e!important}
    .sidebar{background:#514b47!important;color:#f3ede7!important;border-color:#756b63!important}
    .brand-name,.sidebar-card b{color:#f3ede7!important}.brand-sub{color:#d7ccc3!important}
    .sidebar-card{background:#625a55!important;color:#e6ddd5!important;border-color:#7b7068!important}
    .nav button{color:#e2d8d0!important}
    .nav button:hover,.nav button.active{background:#78675c!important;color:#fff!important;border-color:#b86e42!important;box-shadow:inset 3px 0 0 #b86e42!important}
    .topbar{background:#68615c!important;border-color:#847970!important;box-shadow:0 14px 32px rgba(52,46,42,.15)!important}
    .topbar-title,.topbar .btn{color:#f7eee7!important}
    .hero{background:linear-gradient(135deg,#ddd3ca,#c8bbb0 70%,#b89d8c)!important;color:#2f3335!important;border-color:#aa9a8e!important}
    .hero h1{color:#2b3032!important;text-shadow:none!important}.hero p{color:#5f5b58!important}
    .hero-card,.hero-stat{background:#d8cec5!important;border-color:#b8aaa0!important;color:#303538!important}
    .panel,.card,.service-card,.basket-card,.summary,.summary-line,.check-card,.premium-block,.premium-step,.premium-trust article,.premium-service,.premium-faq details,.contact-card,.empty,.service-details{background:#e5ded7!important;color:#303538!important;border-color:#b9afa6!important;box-shadow:var(--shadow)!important}
    h1,h2,h3,label,strong,b,.premium-head h2,.premium-step b,.premium-trust b,.premium-service h3,.premium-faq summary{color:#303538!important}
    .premium-head p,.premium-step p,.premium-trust p,.premium-service p,.premium-faq p{color:#68625e!important}
    input,select,textarea{background:#eee8e2!important;color:#303538!important;border-color:#b7aca3!important}
    input::placeholder,textarea::placeholder{color:#8a817a!important}
    input:focus,select:focus,textarea:focus{border-color:#b86e42!important;box-shadow:0 0 0 4px rgba(184,110,66,.16)!important}
    .btn-primary,.btn-success,.btn-blue,.hero .btn-secondary{background:#b86e42!important;color:#fff!important;border-color:#b86e42!important;box-shadow:0 10px 24px rgba(139,78,48,.2)!important}
    .btn-secondary{background:#d6ccc4!important;color:#303538!important;border-color:#b7aca3!important}
    .btn-ghost{background:#e5ded7!important;color:#8b4e30!important;border-color:#bfa491!important}
    .step{background:#d9d0c8!important;color:#68625e!important;border-color:#b9afa6!important}
    .step.current,.basket-card.selected{background:#d6c2b4!important;color:#8b4e30!important;border-color:#b86e42!important}
    .step.done{background:#d7d2c9!important;color:#5f6f61!important;border-color:#9aaa9a!important}
    .pill.blue,.pill.orange,.pill.green{background:#dcc4b4!important;color:#8b4e30!important;border-color:#c79a7c!important}
    .notice,.infobox{background:#ddcfc3!important;color:#68432f!important;border-color:#bc967d!important}
    .okbox{background:#d9e1d8!important;color:#45604b!important;border-color:#9eb09f!important}
    .errorbox{background:#ead4d1!important;color:#7a3f3a!important;border-color:#bd8e88!important}
    .site-footer{background:#bfb4ab!important;color:#303538!important;border-color:#a99d94!important}
    .table th{color:#68432f!important}.table th,.table td{border-color:#b9afa6!important}
    .toast{background:#b86e42!important;color:#fff!important}
    *{scrollbar-color:#8b4e30 #d9d0c8}
  `;
  document.head.appendChild(style);
  document.documentElement.style.colorScheme = 'light';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', '#cec7c0');
})();
