(() => {
  if (window.__edmAccountCompatibility) return;
  window.__edmAccountCompatibility = true;

  function value(id) {
    const node = document.getElementById(id);
    return node && node.value ? node.value.trim() : '';
  }

  function firstValue() {
    for (let i = 0; i < arguments.length; i += 1) {
      const candidate = String(arguments[i]