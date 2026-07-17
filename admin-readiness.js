(() => {
  const required = ['business_name','legal_name','siret','siren','vat_status','address_line1','postal_code','city','country','phone','email','payment_terms','late_penalty_text','recovery_fee_text','logo_url','calendar_id','timezone'];
  const wait = (fn) => { const timer = setInterval(() => { if (window.EDMAdmin && document.getElementById('saveAutomationBtn')) { clearInterval(timer); fn(); } }, 100); };
  wait(() => {
    const app = window