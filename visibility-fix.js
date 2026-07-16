(function () {
  const style = document.createElement('style');
  style.id = 'edm-visibility-fix';
  style.textContent = `
    :root {
      --bg: #11181c !important;
      --surface: #1b252b !important;
      --surface-2: #253139 !important;
      --ink: #fffdfb !important;
      --muted: #d7d0ca !important;
      --border: #53616a !important;
      --brand: #d88d5d !important;
      --blue: #d88d5d !important;
      --orange: #d88d5d !important;
    }

    body {
      font-size: 16px !important;
      line-height: 1.55 !important;
      background:
        radial-gradient(circle at 16% 0%, rgba(216,141,93,.20), transparent 34rem),
        radial-gradient(circle at 100% 24%, rgba(255,255,255,.07), transparent 30rem),
        linear-gradient(180deg, #182126 0%, #10171b 72%) !important;
    }

    p, .small, .field-hint {
      color: #d7d0ca !important;
      opacity: 1 !important;
    }

    h1, h2, h3, label, strong, b {
      color: #fffdfb !important;
    }

    h1 { text-shadow: 0 4px 18px rgba(0,0,0,.28) !important; }
    h2 { color: #f3c09d !important; }

    .sidebar {
      background: linear-gradient(180deg, #1b252b 0%, #12191d 100%) !important;
      border-right: 1px solid #52616a !important;
    }

    .nav button {
      color: #eee8e3 !important;
      font-size: .98rem !important;
    }

    .nav button:hover, .nav button.active {
      color: #fff4ec !important;
      background: linear-gradient(90deg, rgba(216,141,93,.32), rgba(216,141,93,.12)) !important;
      border-color: rgba(232,166,121,.58) !important;
      box-shadow: inset 4px 0 0 #e29a69, 0 8px 22px rgba(0,0,0,.15) !important;
    }

    .topbar {
      background: rgba(27,37,43,.96) !important;
      border-color: #596872 !important;
    }

    .panel,
    .card,
    .service-card,
    .basket-card,
    .check-card {
      background: linear-gradient(145deg, #253139 0%, #1b252b 100%) !important;
      border-color: #586872 !important;
      box-shadow: 0 18px 44px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.06) !important;
    }

    .panel { border-width: 1px !important; }

    .hero {
      background:
        radial-gradient(circle at 78% 40%, rgba(216,141,93,.32), transparent 23rem),
        linear-gradient(118deg, #27343b 0%, #1a2429 56%, #2a211b 100%) !important;
      border-color: #667680 !important;
    }

    .hero p { color: #e5ded8 !important; }
    .hero-card { background: rgba(20,29,34,.88) !important; border-color: rgba(231,164,117,.48) !important; }
    .hero-stat { background: rgba(255,255,255,.075) !important; border-color: rgba(255,255,255,.11) !important; }

    .btn {
      min-height: 50px !important;
      font-size: .98rem !important;
      border-width: 1px !important;
    }

    .btn-primary, .btn-success, .hero .btn-secondary {
      background: linear-gradient(135deg, #e09a69, #aa5d36) !important;
      color: #fff !important;
      box-shadow: 0 14px 30px rgba(147,76,39,.36), inset 0 1px 0 rgba(255,255,255,.28) !important;
    }

    .btn-secondary {
      color: #fffaf6 !important;
      background: linear-gradient(145deg, #39474f, #29363d) !important;
      border-color: #65747d !important;
    }

    .btn-ghost {
      color: #ffc9a6 !important;
      background: rgba(255,255,255,.06) !important;
      border-color: #65747d !important;
    }

    input, select, textarea {
      min-height: 52px !important;
      color: #fff !important;
      background: #141d21 !important;
      border-color: #66757e !important;
      font-size: 1rem !important;
    }

    input::placeholder, textarea::placeholder { color: #aaa39e !important; }
    input:focus, select:focus, textarea:focus {
      border-color: #e09a69 !important;
      box-shadow: 0 0 0 4px rgba(224,154,105,.22) !important;
    }

    .step {
      color: #ddd6d0 !important;
      background: #202b31 !important;
      border-color: #596871 !important;
    }

    .step.current, .basket-card.selected {
      color: #ffd0b0 !important;
      background: linear-gradient(145deg, #493126, #2d241f) !important;
      border-color: #df9362 !important;
      box-shadow: 0 0 0 2px rgba(223,147,98,.17), 0 14px 30px rgba(0,0,0,.20) !important;
    }

    .notice, .infobox, .okbox, .errorbox {
      font-size: .96rem !important;
      border-width: 1px !important;
    }

    .notice { color: #ffd0ae !important; background: #3b2b22 !important; border-color: #986342 !important; }
    .infobox { color: #f1c4a6 !important; background: #34271f !important; border-color: #855a3f !important; }
    .okbox { color: #cce2cf !important; background: #203128 !important; border-color: #58765f !important; }
    .errorbox { color: #ffc1bb !important; background: #3a2524 !important; border-color: #92504b !important; }

    .table th { color: #f4c6a7 !important; background: #202b31 !important; }
    .table th, .table td { border-color: #56656e !important; }

    @media (max-width: 700px) {
      body { font-size: 16px !important; }
      .main { padding: 14px 12px 48px !important; }
      .panel { padding: 18px !important; border-radius: 22px !important; }
      h1 { font-size: clamp(2.35rem, 13vw, 4rem) !important; line-height: .98 !important; }
      h2 { font-size: clamp(1.8rem, 9vw, 2.7rem) !important; }
      .btn { width: 100%; }
      .topbar { top: 8px !important; }
    }
  `;
  document.head.appendChild(style);
})();
