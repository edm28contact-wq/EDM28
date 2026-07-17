(() => {
  const style = document.createElement('style');
  style.id = 'edm-white-background';
  style.textContent = `
    :root {
      --bg: #ffffff;
      --surface: #ffffff;
      --surface-2: #f2f4f5;
      --ink: #273137;
      --muted: #68747a;
      --border: #d8dfe2;
      --brand: #b86e42;
      --shadow: 0 18px 46px rgba(36,48,54,.10);
    }

    html, body, .app-shell, .main {
      background: #ffffff !important;
    }
    body {
      color: #273137 !important;
      background-image: none !important;
    }
    p, .small, .field-hint { color: #68747a !important; }

    .sidebar {
      background