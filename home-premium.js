(function () {
  const style = document.createElement('style');
  style.id = 'edm-premium-home';
  style.textContent = `
    .premium-home{display:grid;gap:18px;margin-top:18px}
    .premium-block{padding:clamp(20px,3vw,32px);border:1px solid #3b474e;border-radius:24px;background:linear-gradient(145deg,#202b31,#12191d);box-shadow:0 18px 44px rgba(0,0,0,.22)}
    .premium-head{text-align:center;margin-bottom:24px}
    .premium-head small{color:#d99162;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .premium-head h2{margin-top:8px;color:#fff!important;font-size:clamp(1.8rem,3vw,2.7rem)}
    .premium-head p{max-width:760px;margin:10px auto 0;color:#bdb7b1!important}

    .premium-services{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
   