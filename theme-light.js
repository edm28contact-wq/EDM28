(function () {
  const style = document.createElement('style');
  style.id = 'edm-premium-dark-theme';
  style.textContent = `
    :root {
      --bg: #080d10;
      --surface: #11181c;
      --surface-2: #171f24;
      --ink: #f2eee9;
      --muted: #a9a39d;
      --border: #2d373d;
      --brand: #b56d43;
      --blue: #c17b50;
      --blue-soft: #2b211c;
      --green: #8ba38d;
      --green-soft: #17231b;
      --orange: #c17b50;
      --orange-soft: #2c2019;
      --red: #d16d64;
      --red-soft: #2c1918;
      --shadow: 0 24px 70px rgba(0,0,0,.38);
    }

    body {
      color: var(--ink) !important;
      background:
        radial-gradient(circle at 18% 0%, rgba(181,109,67,.14), transparent 30rem),
        radial-gradient(circle at 100% 18%, rgba(120,128,132,.09), transparent 32rem),
        linear-gradient(180deg, #0a1013, #070b0d 70%) !important;
    }

    p, .small, .field-hint { color: var(--muted) !important; }

    .sidebar {
      color: var(--ink) !important;
      background: linear-gradient(180deg, #10171b 0%, #090e11 100%) !important;
      border-right: 1px solid #283238 !important;
      box-shadow: 18px 0 45px rgba(0,0,0,.28) !important;
    }

    .brand-block { grid-template-columns: 66px 1fr !important; align-items: center !important; }
    .brand-mark {
      width: 66px !important;
      height: 66px !important;
      padding: 0 !important;
      border-radius: 18px !important;
      overflow: hidden !important;
      background: #20282d !important;
      box-shadow: 0 14px 34px rgba(0,0,0,.38), 0 0 0 1px rgba(211,154,114,.18) !important;
    }
    .brand-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .brand-name, .sidebar-card b { color: #f3eee9 !important; }
    .brand-name { color: #d4956c !important; letter-spacing: .12em !important; }
    .brand-sub { color: #a8a29c !important; }

    .nav button { color: #c8c4c0 !important; border-color: transparent !important; }
    .nav button:hover, .nav button.active {
      color: #f3d0b8 !important;
      background: linear-gradient(90deg, rgba(181,109,67,.20), rgba(181,109,67,.07)) !important;
      border-color: rgba(202,130,84,.28) !important;
      box-shadow: inset 3px 0 0 #c27a4e !important;
    }

    .sidebar-card {
      color: #b9b4af !important;
      background: rgba(255,255,255,.035) !important;
      border-color: #2c363b !important;
      box-shadow: 0 12px 30px rgba(0,0,0,.16) !important;
    }

    .topbar {
      background: rgba(13,19,22,.88) !important;
      border-color: #2a343a !important;
      box-shadow: 0 16px 42px rgba(0,0,0,.28) !important;
    }
    .topbar-title { color: #d4956c !important; }

    .panel, .card, .service-card, .basket-card, .summary-line, .check-card {
      color: var(--ink) !important;
      background: linear-gradient(145deg, rgba(24,32,37,.97), rgba(14,20,23,.98)) !important;
      border-color: var(--border) !important;
    }
    .panel { box-shadow: var(--shadow) !important; }
    .card, .service-card, .basket-card { box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important; }

    .hero {
      position: relative !important;
      color: #f5f0eb !important;
      background:
        radial-gradient(circle at 82% 42%, rgba(181,109,67,.25), transparent 24rem),
        linear-gradient(118deg, #121a1f 0%, #0c1215 58%, #17130f 100%) !important;
      border-color: #334047 !important;
      box-shadow: 0 30px 80px rgba(0,0,0,.48) !important;
    }
    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(120deg, transparent 46%, rgba(215,151,106,.05) 47%, transparent 48%);
    }
    .hero p { color: #bbb5af !important; }
    .hero h1 { color: #f2ece6 !important; text-shadow: 0 8px 30px rgba(0,0,0,.32); }
    .hero h1::first-line { color: #d4956c; }
    .eyebrow {
      color: #e1a77f !important;
      background: rgba(181,109,67,.12) !important;
      border-color: rgba(202,130,84,.30) !important;
    }
    .hero-card {
      background: rgba(12,18,21,.76) !important;
      border-color: rgba(208,139,94,.22) !important;
      box-shadow: 0 20px 46px rgba(0,0,0,.34) !important;
    }
    .hero-stat { background: rgba(255,255,255,.035) !important; border: 1px solid rgba(255,255,255,.05); }
    .hero-stat span {
      color: #101519 !important;
      background: linear-gradient(135deg, #dda077, #a65e38) !important;
      box-shadow: 0 7px 20px rgba(181,109,67,.24) !important;
    }

    .btn-primary, .btn-success, .summary-line.total {
      color: #fff !important;
      background: linear-gradient(135deg, #c47b4d, #8d4d2f) !important;
      border-color: rgba(235,178,137,.16) !important;
      box-shadow: 0 13px 30px rgba(112,58,33,.32), inset 0 1px 0 rgba(255,255,255,.18) !important;
    }
    .btn-primary:hover, .btn-success:hover { box-shadow: 0 17px 38px rgba(138,72,40,.42) !important; }
    .btn-secondary {
      color: #e7e1dc !important;
      background: linear-gradient(145deg, #283238, #1d262b) !important;
      border: 1px solid #354148 !important;
    }
    .btn-ghost {
      color: #dca27b !important;
      background: rgba(255,255,255,.025) !important;
      border-color: #39434a !important;
    }
    .hero .btn-secondary {
      color: #fff !important;
      background: linear-gradient(135deg, #c47b4d, #8d4d2f) !important;
      border-color: transparent !important;
    }

    input, select, textarea {
      color: #f2eee9 !important;
      background: #0d1417 !important;
      border-color: #354047 !important;
    }
    input::placeholder, textarea::placeholder { color: #777f83 !important; }
    input:focus, select:focus, textarea:focus {
      border-color: #b66c42 !important;
      box-shadow: 0 0 0 4px rgba(181,109,67,.14) !important;
    }

    .step { background: #121a1e !important; border-color: #303a40 !important; }
    .step.current, .basket-card.selected {
      color: #edb18a !important;
      background: linear-gradient(145deg, #2b211c, #1d1815) !important;
      border-color: #a9633b !important;
      box-shadow: 0 0 0 1px rgba(196,123,77,.16), 0 12px 30px rgba(0,0,0,.18) !important;
    }
    .step.done { color: #a9c0ad !important; background: #152019 !important; border-color: #3d5a45 !important; }

    .service-details, .empty { background: #0d1417 !important; border-color: #303a40 !important; }
    .notice { color: #ddb08f !important; background: #261c17 !important; border-color: #67452f !important; }
    .infobox { color: #d8b49c !important; background: #241b17 !important; border-color: #60412f !important; }
    .okbox { color: #b7d2bc !important; background: #142019 !important; border-color: #3e5b47 !important; }
    .errorbox { color: #e7aaa4 !important; background: #291817 !important; border-color: #6d3935 !important; }

    .pill.blue, .pill.orange { color: #e4aa82 !important; background: #2b201a !important; }
    .pill.green { color: #b7ceb9 !important; background: #17231b !important; }
    .table th { color: #d1cbc5 !important; }
    .table th, .table td { border-color: #323c42 !important; }
    .toast { background: #d18a5c !important; color: #11171a !important; box-shadow: 0 18px 50px rgba(0,0,0,.42) !important; }

    ::selection { background: rgba(196,123,77,.35); color: white; }
    * { scrollbar-color: #7f4d31 #11181c; }

    @media (max-width: 980px) {
      .sidebar { box-shadow: 18px 0 50px rgba(0,0,0,.52) !important; }
      .brand-block { grid-template-columns: 58px 1fr !important; }
      .brand-mark { width: 58px !important; height: 58px !important; }
    }
  `;
  document.head.appendChild(style);

  function installBranding() {
    const mark = document.querySelector('.brand-mark');
    if (mark) mark.innerHTML = '<img src="/logo-edm.svg" alt="Logo EDM, spécialiste du freinage">';

    const name = document.querySelector('.brand-name');
    if (name) name.textContent = 'EDM';

    const sub = document.querySelector('.brand-sub');
    if (sub) sub.innerHTML = 'Freinage & liaison au sol<br>Mesures · prix · accord';

    const topbar = document.querySelector('.topbar-title');
    if (topbar) topbar.innerHTML = '<img src="/logo-edm.svg" alt="" style="width:38px;height:38px;border-radius:10px;object-fit:cover"><span>EDM · Freinage & liaison au sol</span>';
  }

  installBranding();
  window.addEventListener('load', installBranding);
})();
