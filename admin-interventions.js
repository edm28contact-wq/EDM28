(() => {
  const A = () => window.EDMAdmin;
  const esc = (value) => A().esc(value ?? '');
  const levelFor = (total) => Number(total || 0) >= 100 ? '100_plus' : 'under_100';
  const levelLabel = (total) => Number(total || 0) >= 100
    ? 'Checklist complète - 100 € TTC et plus'
    : 'Checklist essentielle - moins de 100 € TTC';

  async function patchOrder(order, patch) {
    const result = await A().db.from('repair_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .in('status', ['ready', 'signed', 'in_progress'])
      .select('id,status,workshop_checks');
    if (result.error) throw result.error;
    if (!result.data?.length) throw new Error('Le dossier atelier a changé. Actualisez la page.');
  }

  async function start(order) {
    await patchOrder(order, { status: 'in_progress' });
    A().status('interventionStatus', 'Intervention démarrée.');
    await load();
    await A().overview();
  }

  async function finish(order) {
    if (order.status !== 'in_progress') throw new Error('Démarrez l’intervention avant de la terminer.');
    const current = order.workshop_checks && typeof order.workshop_checks === 'object' ? order.workshop_checks : {};
    const completedAt = new Date().toISOString();
    await patchOrder(order, {
      workshop_checks: {
        ...current,
        intervention_completed_at: completedAt,
        control_level: levelFor(order.quotes?.total)
      }
    });
    A().status('interventionStatus', 'Intervention terminée. Le dossier est maintenant disponible dans Checklist de contrôle.');
    await load();
    await A().overview();
  }

  function render(rows) {
    const host = A().$('interventionList');
    host.innerHTML = rows.length ? rows.map((order) => {
      const waitingChecklist = Boolean(order.workshop_checks?.intervention_completed_at);
      const client = [order.profiles?.first_name, order.profiles?.last_name].filter(Boolean).join(' ') || order.profiles?.email || 'Client';
      const vehicle = [order.vehicles?.brand, order.vehicles?.model, order.vehicles?.plate].filter(Boolean).join(' ');
      const action = waitingChecklist
        ? '<button class="btn primary" type="button" data-open-checklist>Ouvrir la checklist</button>'
        : order.status === 'in_progress'
          ? '<button class="btn primary" type="button" data-finish>Intervention terminée - passer au contrôle</button>'
          : '<button class="btn primary" type="button" data-start>Démarrer l’intervention</button>';
      return `<article class="card" data-order="${order.id}" style="margin:12px 0">
        <div class="top"><div><span class="pill">${waitingChecklist ? 'Contrôle à faire' : esc(order.status)}</span>
          <h3>${esc(order.order_number || 'Intervention')}</h3>
          <p>${esc(client)} · ${esc(vehicle)}</p></div>
          <div style="text-align:right"><strong>${A().money(order.quotes?.total || 0)}</strong><p class="muted">${esc(levelLabel(order.quotes?.total))}</p></div>
        </div>
        <p class="muted">${waitingChecklist
          ? 'Les travaux sont terminés. La checklist doit être complétée avant la clôture et la facture.'
          : order.status === 'in_progress'
            ? 'Intervention en cours. Terminez les travaux avant de passer au contrôle final.'
            : 'L’OR est prêt. Démarrez l’intervention lorsque le véhicule entre en atelier.'}</p>
        <div class="toolbar">${action}</div>
      </article>`;
    }).join('') : '<p class="muted">Aucune intervention active.</p>';

    host.querySelectorAll('[data-order]').forEach((card) => {
      const order = rows.find((row) => row.id === card.dataset.order);
      card.querySelector('[data-start]')?.addEventListener('click', (event) => {
        event.currentTarget.disabled = true;
        start(order).catch((error) => A().status('interventionStatus', error.message || 'Démarrage impossible.', true))
          .finally(() => { event.currentTarget.disabled = false; });
      });
      card.querySelector('[data-finish]')?.addEventListener('click', (event) => {
        event.currentTarget.disabled = true;
        finish(order).catch((error) => A().status('interventionStatus', error.message || 'Passage au contrôle impossible.', true))
          .finally(() => { event.currentTarget.disabled = false; });
      });
      card.querySelector('[data-open-checklist]')?.addEventListener('click', () => A().page('checklist'));
    });
  }

  async function load() {
    const host = A()?.$('interventionList');
    if (!host) return;
    host.innerHTML = '<p class="muted">Chargement…</p>';
    const { data, error } = await A().db.from('repair_orders')
      .select('id,user_id,vehicle_id,appointment_id,order_number,status,mileage_in,workshop_checks,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model,year,mileage),quotes(id,quote_number,title,total),appointments(starts_at,ends_at,status)')
      .in('status', ['ready','signed','in_progress'])
      .order('updated_at', { ascending: false });
    if (error) throw error;
    render(data || []);
  }

  function bind() {
    document.querySelector('[data-page="interventions"]')?.addEventListener('click', () => load().catch((error) => A().status('interventionStatus', error.message, true)));
    document.getElementById('interventionRefresh')?.addEventListener('click', () => load().catch((error) => A().status('interventionStatus', error.message, true)));
  }

  window.EDMAdminInterventions = { load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();