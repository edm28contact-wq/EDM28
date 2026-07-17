(() => {
  const style = document.createElement('style');
  style.id = 'edm-light-palette-final';
  style.textContent = `
    :root{
      --bg:#ddd8d2;
      --surface:#f2ede7;
      --surface-2:#e7e0d8;
      --ink:#273238;
      --muted:#657078;
      --border:#c8beb4;
      --brand:#b86e42;
      --shadow:0 16px 36px rgba(45,52,56,.12)
    }
    html,body,.app-shell,.main{background:#ddd8d2!important;color:#273238!important}
    body{background