(() => {
  if (window.__edmOtpLoader) return;
  window.__edmOtpLoader = true;

  const existing = document.querySelector('script[data-edm-otp]');
  if (existing || window.__edmOtpFlow) return;

  const script = document.createElement('script');
  script.src = '/client-otp-flow.js?v=2';
  script.async = false;
  script.dataset.edmOtp = '1';
  script.onerror = () => console.error('EDM OTP module failed to load');
  document.body.appendChild(script);
})();
