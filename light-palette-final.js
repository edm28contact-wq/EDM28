(() => {
  const style = document.createElement('style');
  style.id = 'edm-light-palette-final';
  style.textContent = `
    :root{
      --bg:#f7f5f2;
      --surface:#ffffff;
      --surface-2:#f2eee9;
      --ink:#263238;
      --muted:#66737a;
      --border:#d9d3cc;
      --brand:#b86e42;
      --shadow:0 18px 42px rgba(50,58,62,.10)
    }
    html,body,.app-shell,.main{background:#f7f5f2!important;color:#263238!important}
    body{background-image:none!important}
    p,.small,.field-hint{color:#66737a!important}

    .sidebar{background:#f3eee8!important;color:#263238!important;border-right:1px solid #d9d3cc!important;box-shadow:10px 0 28px rgba(50,58,62,.08)!important}
    .brand-name,.sidebar-card b{color:#263238!important}
    .brand-sub,.sidebar-card{color:#66737a!important}
    .sidebar-card{background:#fff!important;border-color:#ddd6cf!important;box-shadow:0 10px 26px rgba(50,58,62,.06)!important}
    .nav button{color:#465158!important}
    .nav button:hover,.nav button.active{color:#8d4f2f!important;background:#f6e9df!important;border-color:#d9aa89!important;box-shadow:inset 3px 0 0 #b86e42!important}

    .topbar{background:#fff!important;border-color:#ddd6cf!important;box-shadow:0 10px 28px rgba(50,58,62,.08)!important}
    .topbar-title{color:#7f4a30!important}

    .hero{color:#263238!important;background:linear-gradient(135deg,#fff,#f5eee8 72%,#ead8ca)!important;border-color:#d8c7ba!important;box-shadow:0 22px 54px rgba(50,58,62,.10)!important}
    .hero h1{color:#263238!important;text-shadow:none!important}
    .hero p{color:#5e6a70!important}
    .hero-card{background:#fff!important;border-color:#dfd4cb!important;box-shadow:0 14px 34px rgba(50,58,62,.08)!important}
    .hero-stat{background:#f8f5f2!important;border-color:#e4ddd7!important}
    .hero-stat b{color:#263238!important}

    .panel,.card,.service-card,.basket-card,.summary-line,.check-card,.premium-block,.premium-step,.premium-trust article,.premium-service,.premium-faq details,.contact-card{color:#263238!important;background:#fff!important;border-color:#ddd6cf!important;box-shadow:var(--shadow)!important}
    .premium-head h2,.premium-step b,.premium-trust b,.premium-service h3,.premium-faq summary{color:#263238!important}
    .premium-head p,.premium-step p,.premium-trust p,.premium-service p,.premium-faq p{color:#66737a!important}

    input,select,textarea{color:#263238!important;background:#fff!important;border-color:#cfc8c1!important}
    input::placeholder,textarea::placeholder{color:#8a9499!important}
    input:focus,select:focus,textarea:focus{border-color:#b86e42!important;box-shadow:0 0 0 4px rgba(184,110,66,.13)!important}

    .btn-secondary{color:#263238!important;background:#f0ebe6!important;border-color:#d7cec6!important}
    .btn-ghost{color:#8f5334!important;background:#fff!important;border-color:#d9c5b7!important}
    .step,.service-details,.empty{background:#fff!important;border-color:#ddd6cf!important;color:#263238!important}
    .step.current,.basket-card.selected{background:#f7e9df!important;border-color:#c8875e!important;color:#7f4a30!important}
    .notice,.infobox{color:#7b4a31!important;background:#fbf0e8!important;border-color:#e0b99e!important}
    .okbox{color:#40634a!important;background:#edf5ef!important;border-color:#b9d0bf!important}
    .errorbox{color:#8a3f39!important;background:#faecea!important;border-color:#dfb3ae!important}
    .table th,.table td{color:#263238!important;border-color:#ddd6cf!important}
    .site-footer{background:#eee7e1!important;border-color:#d6cdc5!important;color:#263238!important}
    *{scrollbar-color:#b9896d #eee8e2}

    @media(max-width:980px){
      .sidebar{box-shadow:14px 0 34px rgba(50,58,62,.12)!important}
    }
  `;
  document.head.appendChild(style);
})();