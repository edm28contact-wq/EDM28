(function () {
  const style = document.createElement('style');
  style.id = 'edm-premium-light-theme';
  style.textContent = `
    :root {
      --bg: #f4efe9;
      --surface: #fffdfa;
      --surface-2: #f8f3ed;
      --ink: #2d2722;
      --muted: #756b63;
      --border: #ddd2c8;
      --brand: #a9623b;
      --blue: #995a34;
      --blue-soft: #f2e2d5;
      --green: #526d5a;
      --green-soft: #edf4ef;
      --orange: #a9623b;
      --orange-soft: #f8eadf;
      --red: #9c4038;
      --red-soft: #faecea;
      --shadow: 0 20px 55px rgba(68, 49, 37, .10);
    }

    body {
      color: var(--ink) !important;
      background:
        radial-gradient(circle at 10% 0%, rgba(169, 98, 59, .15), transparent 28rem),
        radial-gradient(circle at 100% 18%, rgba(110, 105, 101, .10), transparent 30rem),
        var(--bg) !important;
    }

    p, .small, .field-hint { color: var(--muted) !important; }

    .sidebar {
      color: var(--ink) !important;
      background: linear-gradient(180deg, #f7f0e9 0%, #eee3d9 100%) !important;
      border-right: 1px solid #d7c8bb !important;
      box-shadow: 14px 0 40px rgba(68, 49, 37, .08) !important;
    }

    .brand-name, .sidebar-card b { color: #3b3029 !important; }
    .brand-sub { color: #76675c !important; }

    .nav button {
      color: #51463e !important;
      border-color: transparent !important;
    }

    .nav button:hover, .nav button.active {
      color: #7f4529 !important;
      background: rgba(169, 98, 59, .12) !important;
      border-color: rgba(169, 98, 59, .22) !important;
    }

    .sidebar-card {
      color: #64574e !important;
      background: rgba(255,255,255,.62) !important;
      border-color: #d8cabf !important;
      box-shadow: 0 10px 28px rgba(68,49,37,.06) !important;
    }

    .topbar {
      background: rgba(255, 253, 250, .90) !important;
      border-color: #ddd2c8 !important;
      box-shadow: 0 14px 38px rgba(68,49,37,.09) !important;
    }

    .panel, .card, .service-card, .basket-card, .summary-line, .check-card {
      background: var(--surface) !important;
      border-color: var(--border) !important;
      color: var(--ink) !important;
    }

    .panel { box-shadow: var(--shadow) !important; }

    .hero {
      color: #2f2721 !important;
      background:
        linear-gradient(105deg, rgba(255,253,250,.98) 0%, rgba(248,239,231,.95) 52%, rgba(221,196,176,.90) 100%) !important;
      border: 1px solid #d8c5b5 !important;
      box-shadow: 0 24px 65px rgba(82,57,42,.13) !important;
    }

    .hero p { color: #6f6259 !important; }
    .hero h1 { color: #302720 !important; }
    .eyebrow {
      color: #8f512f !important;
      background: rgba(169,98,59,.11) !important;
      border-color: rgba(169,98,59,.22) !important;
    }

    .hero-card {
      background: rgba(255,255,255,.72) !important;
      border-color: rgba(132,94,68,.20) !important;
      box-shadow: 0 18px 42px rgba(86,59,41,.10) !important;
    }

    .hero-stat { background: rgba(255,255,255,.82) !important; }
    .hero-stat span {
      color: white !important;
      background: linear-gradient(135deg, #b8754a, #8f4d2c) !important;
    }

    .btn-primary, .btn-success, .summary-line.total {
      color: #fff !important;
      background: linear-gradient(135deg, #b8754a, #8f4d2c) !important;
      border-color: transparent !important;
      box-shadow: 0 12px 28px rgba(143,77,44,.22) !important;
    }

    .btn-secondary {
      color: #4d4037 !important;
      background: #eee4db !important;
    }

    .btn-ghost {
      color: #6c4834 !important;
      background: rgba(255,255,255,.55) !important;
      border-color: #d7c5b8 !important;
    }

    .hero .btn-secondary {
      color: white !important;
      background: linear-gradient(135deg, #b8754a, #8f4d2c) !important;
    }

    input, select, textarea {
      color: var(--ink) !important;
      background: #fff !important;
      border-color: #d5c8bd !important;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #aa6840 !important;
      box-shadow: 0 0 0 4px rgba(169,98,59,.13) !important;
    }

    .step.current, .basket-card.selected {
      color: #7f4529 !important;
      background: #f3e2d5 !important;
      border-color: #bf825d !important;
    }

    .service-details, .empty {
      background: #faf6f1 !important;
      border-color: #d9cec4 !important;
    }

    .notice {
      color: #76502f !important;
      background: #fbefe4 !important;
      border-color: #e9c9ac !important;
    }

    .infobox {
      color: #6f4b35 !important;
      background: #f4e7dc !important;
      border-color: #dfc4b0 !important;
    }

    .pill.blue, .pill.orange {
      color: #874b2d !important;
      background: #f3e3d7 !important;
    }

    .pill.green {
      color: #4f6957 !important;
      background: #edf4ef !important;
    }

    .table th { color: #66594f !important; }
    .table th, .table td { border-color: #ddd2c8 !important; }

    .toast {
      background: #3a3029 !important;
      color: #fff !important;
    }

    @media (max-width: 980px) {
      .sidebar { box-shadow: 16px 0 45px rgba(68,49,37,.16) !important; }
    }
  `;
  document.head.appendChild(style);
})();
