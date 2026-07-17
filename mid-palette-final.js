(() => {
  const s=document.createElement('style');
  s.id='edm-mid-palette-final';
  s.textContent=`
    :root{--bg:#cec7c0;--surface:#e5ded7;--surface-2:#d9d0c8;--ink:#303538;--muted:#68625e;--border:#b9afa6;--brand:#b86e42}
    html,body,.app-shell,.main{background:#cec7c0!important;color:#303538!important}
    .sidebar{background:#514b47!important;color:#f3ede7!important;border-color:#756b63!important}
    .brand-name,.sidebar-card b{color:#f3ede7!important}.brand-sub{color:#d7ccc3!important}
    .sidebar-card{background:#625a55!important;color:#e6ddd5!important;border-color:#7b7068!important}
    .nav button{color:#e2d8d0!important}.nav button:hover,.nav button.active{background:#78675c!important;color:#fff!important;border-color:#b86e42!important}
    .topbar{background:#68615c!important;border-color:#847970!important}.topbar-title,.topbar .btn{color:#f7eee7!important}
    .hero{background:linear-gradient(135deg,#ddd3ca,#c8bbb0 70%,#b89d8c)!important;color:#2f3335!important;border-color:#aa9a8e!important}
    .hero h1{color:#2b3032!important}.hero p{color:#5f5b58!important}
    .hero-card,.hero-stat{background:#d8cec5!important;border-color:#b8aaa0!important;color:#303538!important}
    .panel,.card,.service-card,.basket-card,.summary-line,.check-card,.premium-block,.premium-step,.premium-trust article,.premium-service,.premium-faq details,.contact-card{background:#e5ded7!important;color:#303538!important;border-color:#b9afa6!important;box-shadow:0 14px 32px rgba(52,46,42,.12)!important}
    .premium-head h2,.premium-step b,.premium-trust b,.premium-service h3,.premium-faq summary{color:#303538!important}
    .premium-head p,.premium-step p,.premium-trust p,.premium-service p,.premium-faq p{color:#68625e!important}
    input,select,textarea{background:#eee8e2!important;color:#303538!important;border-color:#b7aca3!important}
    .btn-secondary{background:#d6ccc4!important;color:#303538!important;border-color:#b7aca3!important}
    .btn-ghost{background:#e5ded7!important;color:#8b4e30!important;border-color:#bfa491!important}
    .site-footer{background:#bfb4ab!important;color:#303538!important;border-color:#a99d94!important}
  `;
  document.head.appendChild(s);
})();