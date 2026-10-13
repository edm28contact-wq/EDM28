(function(root){
  const HOUR = 3600000;
  const time = value => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; };
  // A finished repair order remains active until every associated invoice is paid.
  // The database marks invoices as "paid" only after full payment; never archive
  // an unpaid or partially paid intervention just because 24 hours have elapsed.
  function invoicePaid(invoice) {
    if (invoice?.status !== 'paid') return false;
    const total = Number(invoice.total);
    const amountPaid = Number(invoice.amount_paid);
    return Number.isFinite(total) && total > 0
      && Number.isFinite(amountPaid) && amountPaid + 0.005 >= total;
  }
  function progress({request={},quote={},reservation={},order={},intervention={},invoices=[]},now=Date.now()) {
    const finished = ['completed','invoiced'].includes(order.status) || intervention.status === 'completed';
    const finishedAt = time(order.completed_at) ?? time(intervention.completed_at) ?? (finished ? time(order.updated_at) : null);
    if (finished) {
      const settled = invoices.length > 0 && invoices.every(invoicePaid);
      if (settled) {
        return {key:'paid',label:'Intervention encaissée',tone:'green',archived:true,finishedAt};
      }
      return {key:'finished',label:invoices.length ? 'Intervention terminée — règlement en attente' : 'Intervention terminée — facture à venir',tone:'orange',archived:false,finishedAt};
    }
    if (intervention.status === 'in_progress' || order.status === 'in_progress') return {key:'working',label:'Intervention en cours',tone:'orange',archived:false};
    if (reservation.status === 'confirmed' || (order.id && !reservation.id)) return {key:'confirmed',label:'Rendez-vous validé — intervention en attente',tone:'orange',archived:false};
    if (reservation.status === 'review_pending') return {key:'review',label:'Intervention en préparation',tone:'orange',archived:false,overdue:now >= (time(reservation.review_deadline) ?? Infinity)};
    if (reservation.status === 'held' && (time(reservation.expires_at) ?? 0)>now) return {key:'held',label:'Intervention en préparation',tone:'orange',archived:false};
    if (quote.status === 'refused') return {key:'refused',label:'Devis refusé',tone:'neutral',archived:false};
    if (['cancelled','closed'].includes(request.status) || ['cancelled'].includes(quote.status)) return {key:'closed',label:'Demande close',tone:'neutral',archived:true};
    if (quote.status === 'accepted') return {key:'choose',label:reservation.status === 'held' || reservation.status === 'expired' ? 'Pré-réservation expirée' : 'Devis accepté — choisissez un rendez-vous',tone:'orange',archived:false};
    if (quote.status === 'sent') return {key:'quote',label:'Votre devis est disponible',tone:'neutral',archived:false};
    if (quote.status === 'expired') return {key:'expired',label:'Devis expiré',tone:'neutral',archived:false};
    return {key:'request',label:'Demande en cours d’étude',tone:'neutral',archived:false};
  }
  function group(data) {
    const groups=new Map(),quoteGroup=new Map(),orderGroup=new Map(),appointmentGroup=new Map();
    const ensure=(id,vehicleId)=>{
      if(!groups.has(id))groups.set(id,{id,vehicleId,quotes:[],orders:[],appointments:[],invoices:[],inspections:[],interventions:[],reservations:[]});
      return groups.get(id);
    };
    for(const r of data.requests || []) ensure(r.id,r.vehicle_id).request=r;
    for(const q of data.quotes || []) { const g=ensure(q.service_request_id || 'quote/'+q.id,q.vehicle_id);g.quotes.push(q);quoteGroup.set(q.id,g); }
    for(const o of data.orders || []) {const g=quoteGroup.get(o.quote_id)||ensure(o.service_request_id || 'order/'+o.id,o.vehicle_id);g.orders.push(o);orderGroup.set(o.id,g);if(o.appointment_id)appointmentGroup.set(o.appointment_id,g);}
    for(const a of data.appointments || []) (appointmentGroup.get(a.id)||ensure(a.service_request_id || 'appointment/'+a.id,a.vehicle_id)).appointments.push(a);
    for(const r of data.reservations || []) { const g=quoteGroup.get(r.quote_id);if(g)g.reservations.push(r); }
    for(const i of data.invoices || []) (orderGroup.get(i.repair_order_id)||quoteGroup.get(i.quote_id)||ensure('invoice/'+i.id,i.vehicle_id)).invoices.push(i);
    for(const i of data.inspections || []) (orderGroup.get(i.repair_order_id)||ensure('inspection/'+i.id,i.vehicle_id)).inspections.push(i);
    for(const i of data.interventions || []) orderGroup.get(i.repair_order_id)?.interventions.push(i);
    return [...groups.values()].map(g=>{
      const newest=(rows)=>[...rows].sort((a,b)=>(time(b.created_at)||0)-(time(a.created_at)||0))[0]||{};
      g.quote=newest(g.quotes);g.order=newest(g.orders.filter(o=>o.status!=='cancelled'));g.reservation=newest(g.reservations);g.intervention=newest(g.interventions);
      g.title=g.quote.title || (g.request?.services || []).map(s=>s.name || s.label).filter(Boolean).join(' + ') || 'Intervention';
      g.date=g.order.completed_at || g.intervention.completed_at || g.reservation.starts_at || g.appointments[0]?.starts_at || g.quote.created_at || g.request?.submitted_at || g.request?.created_at || g.invoices[0]?.issued_at || g.inspections[0]?.completed_at;
      g.progress=progress(g);
      if(!g.request && !g.quote.id && !g.order.id) {g.title='Documents conserv\u00e9s';g.progress={key:'archive',label:'Historique',tone:'neutral',archived:true};}
      return g;
    }).sort((a,b)=>(time(b.date)||0)-(time(a.date)||0));
  }
  const api={HOUR,time,invoicePaid,progress,group};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EDMJourneyModel=api;
})(globalThis);
