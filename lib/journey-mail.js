import { resolveSupabasePublicConfig } from '../api/supabase-config.js';
import basketPolicy from '../supplier-basket-policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString('fr-FR', { timeZone:'Europe/Paris', dateStyle:'long', timeStyle:'short' });
const titles = {
  held: 'Votre cr\u00e9neau EDM28 est gard\u00e9 pendant 48 h',
  proof_received: 'Votre demande de validation de rendez-vous EDM28',
  confirmed: 'Votre rendez-vous EDM28 est confirm\u00e9',
  reminder: 'Rappel : votre rendez-vous EDM28 approche',
  expired: 'Votre pr\u00e9-r\u00e9servation EDM28 a expir\u00e9',
  rejected: 'Votre rendez-vous EDM28 doit \u00eatre revu',
  completed: 'Votre intervention EDM28 est termin\u00e9e'
};

export function renderJourneyEmail(payload) {
  if (!payload || !Object.hasOwn(titles, payload.kind) || !UUID.test(payload.quote_id || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.recipient || '')) throw new Error('Invalid persisted delivery.');
  const url = 'https://edm28.fr/mes-interventions?devis=' + encodeURIComponent(payload.quote_id);
  const businessName = String(payload.business_name || 'EDM28').trim() || 'EDM28';
  const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.contact_email || '')) ? String(payload.contact_email).trim() : 'contact@edm28.fr';
  const contactPhone = String(payload.contact_phone || '').trim();
  const when = date(payload.starts_at);
  const content = {
    held: `Votre cr\u00e9neau du ${when} est gard\u00e9 jusqu'au ${date(payload.expires_at)}.\n\nVous avez 48 h pour acheter les pi\u00e8ces et joindre votre justificatif dans Mes interventions. Ce d\u00e9lai permet de garder les cr\u00e9neaux pour les interventions qui se pr\u00e9parent r\u00e9ellement. Sans justificatif dans ce d\u00e9lai, le cr\u00e9neau est lib\u00e9r\u00e9.\n\nCe n'est pas encore une confirmation de rendez-vous. Apr\u00e8s r\u00e9ception du justificatif, EDM28 le v\u00e9rifie sous 24 h. Pr\u00e9voyez une livraison avant la date choisie.`,
    proof_received: `${payload.requires_parts ? 'Votre justificatif a bien \u00e9t\u00e9 re\u00e7u.' : 'Cette prestation ne demande pas d\u2019achat de pi\u00e8ces.'}\n\nDate souhait\u00e9e : ${when}.\nEDM28 doit v\u00e9rifier votre demande avant le ${date(payload.review_deadline)}. Le cr\u00e9neau reste gard\u00e9 pendant cette v\u00e9rification. Vous recevrez une confirmation apr\u00e8s notre validation.`,
    confirmed: `Votre rendez-vous est confirm\u00e9 le ${when}.\n\n${payload.address || ''}\n\n${payload.requires_parts ? 'Apportez les pi\u00e8ces indiqu\u00e9es dans le devis.' : 'Aucune pi\u00e8ce de remplacement \u00e0 apporter.'}\nVotre ordre de r\u00e9paration est disponible dans Mes interventions. Il d\u00e9crit les travaux pr\u00e9vus et leur pr\u00e9paration.`,
    reminder: `Rappel de votre rendez-vous du ${when}.\n\n${payload.address || ''}\n\n${payload.requires_parts ? 'Pensez \u00e0 apporter les pi\u00e8ces pr\u00e9conis\u00e9es.' : 'Aucune pi\u00e8ce de remplacement \u00e0 apporter.'} Votre ordre de r\u00e9paration est dans votre espace client. Pr\u00e9venez-nous par email en cas de difficult\u00e9.`,
    expired: `Le d\u00e9lai de 48 h pour transmettre votre justificatif est termin\u00e9. Le cr\u00e9neau du ${when} a \u00e9t\u00e9 lib\u00e9r\u00e9.\n\nVotre devis et vos documents sont conserv\u00e9s. Retrouvez-les dans Mes interventions pour choisir une nouvelle date.`,
    rejected: `Nous ne pouvons pas confirmer le cr\u00e9neau du ${when}.\n\n${payload.review_note || 'Contactez EDM28 pour organiser la suite.'}\n\nLe cr\u00e9neau a \u00e9t\u00e9 lib\u00e9r\u00e9. Votre devis et les documents d\u00e9j\u00e0 transmis sont conserv\u00e9s.`,
    completed: 'Votre intervention est termin\u00e9e. Merci de votre confiance.\n\nElle reste affich\u00e9e pendant 24 h dans la liste en cours, puis vous la retrouverez dans Mes interventions, sous votre v\u00e9hicule, avec son titre et sa date. Vos documents et photos disponibles y restent conserv\u00e9s.'
  }[payload.kind];
  let supplierUrl = null;
  if (payload.requires_parts && payload.supplier_url) supplierUrl = basketPolicy.safeUrl(payload.supplier_url);
  const parts = supplierUrl && ['held','confirmed'].includes(payload.kind) ? [
    '', 'Pi\u00e8ces pr\u00e9conis\u00e9es :', payload.recommended_parts || '',
    'Prix indicatifs TTC' + (payload.price_observed_at ? ' relev\u00e9s le ' + payload.price_observed_at : '') + ' :',
    payload.price_details || 'Consultez le devis ou contactez EDM28 pour les prix.',
    'Vous pouvez acheter ces m\u00eames r\u00e9f\u00e9rences chez un autre vendeur. V\u00e9rifiez son prix et son d\u00e9lai de livraison. Toute autre r\u00e9f\u00e9rence doit \u00eatre valid\u00e9e par EDM28.',
    'Panier fournisseur : ' + supplierUrl
  ] : [];
  const text = ['Bonjour,','',payload.title || 'Votre intervention EDM28',content,...parts,'',
    'EDM28 ne vend pas de pi\u00e8ces. Vous payez directement le fournisseur, sans marge cach\u00e9e d\u2019EDM28. Nos tarifs sont des forfaits par prestation, consommables d\u2019atelier compris, hors pi\u00e8ces.',
    '', 'Mes interventions : '+url, '', 'Contact : '+contactEmail+(contactPhone ? ' - '+contactPhone : ''), businessName].join('\n');
  return { subject:titles[payload.kind], text, reply_to: contactEmail,
    html:`<div style="font:16px/1.6 Arial,sans-serif;color:#18212f;max-width:620px"><div style="white-space:pre-line">${escape(text)}</div><p><a href="${escape(url)}">Ouvrir Mes interventions</a></p>${supplierUrl ? `<p><a href="${escape(supplierUrl)}">Ouvrir le panier fournisseur</a></p>` : ''}<p><a href="mailto:${escape(contactEmail)}">Contacter ${escape(businessName)}</a></p></div>` };
}

function respond(res, status, body) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).end(JSON.stringify(body));
}

export async function handleJourneyDispatch(req, res) {
  if (req.method !== 'POST') return respond(res,405,{success:false});
  const {id,token} = req.body || {};
  if (!UUID.test(id || '') || !/^[a-f0-9]{64}$/.test(token || '')) return respond(res,403,{success:false});
  const {url,key} = resolveSupabasePublicConfig();
  const apiKey = process.env.RESEND_API_KEY || '', from = process.env.RESEND_FROM_EMAIL || '';
  let publicKey = key?.startsWith('sb_publishable_');
  if (!publicKey) { try {publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';} catch (_) {} }
  if (!url || !publicKey || !/^re_[A-Za-z0-9_-]+$/.test(apiKey) || !from || /[\r\n]/.test(from)) return respond(res,503,{success:false});
  const base=`${url}/rest/v1/journey_email_deliveries?id=eq.${encodeURIComponent(id)}`;
  const headers={apikey:key,'Content-Type':'application/json','X-EDM-Delivery-Token':token};
  async function ack(status,provider=null) {
    const result=await fetch(base+'&status=eq.sending',{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({status,provider_message_id:provider}),signal:AbortSignal.timeout(5000)});
    if (!result.ok) throw new Error('Delivery acknowledgement failed.');
  }
  let claimed=false;
  try {
    const claim=await fetch(base+'&status=eq.dispatching&select=id,payload',{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({status:'sending'}),signal:AbortSignal.timeout(5000)});
    if (!claim.ok) return respond(res,403,{success:false});
    const rows=await claim.json();
    if (!Array.isArray(rows)||rows.length!==1||rows[0].id!==id) return respond(res,403,{success:false});
    claimed=true;
    const payload=rows[0].payload, message=renderJourneyEmail(payload);
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`edm28-journey-${id}`},body:JSON.stringify({from,to:[payload.recipient],...message}),signal:AbortSignal.timeout(8000)});
    const result=await sent.json().catch(()=>({}));
    if (!sent.ok || !result.id) throw new Error('Email delivery not confirmed.');
    await ack('sent',String(result.id).slice(0,100));
    return respond(res,200,{success:true});
  } catch (_) {
    // A timed-out send may already have succeeded. The same idempotency key is reused.
    if(claimed)try{await ack('pending');}catch(_){}
    return respond(res,503,{success:false});
  }
}
