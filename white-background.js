(() => {
  const style = document.createElement('style');
  style.id = 'edm-white-background';
  style.textContent = `
    :root { --bg: #ffffff; }
    html, body, .app-shell, .main {
      background: #ffffff !important;
    }
    body { background-image: none !important; }
    @media (max-width: 980px) {
      html, body, .app-shell, .main { background: #ffffff !important; }
    }
  `;
  document.head.appendChild(style);
})();
