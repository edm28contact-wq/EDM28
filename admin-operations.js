(() => {
  const app = () => window.EDMAdmin;
  const iso = (value) => new Date(value).toISOString();

  async function createOperation(quote, root) {
    const startsAt = root.querySelector('[data-field="startsAt"]').value;
    const duration = Number(root.querySelector('[data-field="duration"]').value || 60);
    const orderNumber = root.querySelector('[data-field="orderNumber"]').value.trim();
    if (!startsAt || new Date(startsAt) <= new Date()) throw new Error('Une date future est obligatoire.');
    if (!Number