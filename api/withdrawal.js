import {createHash} from 'node:crypto';
import {resolveSupabaseServiceConfig} from './supabase-config.js';

const cfg=resolveSupabaseServiceConfig();
const allowed=new Set(['https://edm28.fr','https://www.edm28.fr']);
const sha=s=>createHash('sha256').update(s).digest('hex');
const clean=(s,max)=>String(s??'').trim().replace(/\s+/g,' ').slice(0,max);
const reply=(res,status,body)=>res.status(status).setHeader('Cache-Control','no-store').json(body);

async function table(path, options={}) {
 const response=await fetch(cfg.url+'/rest/v1/'+path,{
  ...options,
  headers:{apikey:cfg.serviceRoleKey,Authorization:'Bearer '+cfg.serviceRoleKey,
   'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error('Enregistrement indisponible');
 return data;
}
async function sendReceipt(to,id,reference,submitted) {
 const key=process.env.RESEND_API_KEY||'';
 const from=process.env.RESEND_FROM_EMAIL||'';
 if(!/^re_[\w-]+$/.test(key)||!from||/[\r\n]/.test(from))
  throw new Error('Messagerie transactionnelle non configuree');
 const text=[
 'Bonjour,',
 '',
 'Nous accusons reception de votre declaration de retractation EDM28.',
 'Reference de la demande : '+id,
 'Contrat ou devis : '+reference,
 'Date et heure de la declaration (UTC) : '+submitted,
 'Declaration : Je vous notifie ma retractation du contrat indique.',
 '',
 'Cet accuse confirme la reception de votre declaration; son traitement administratif et les consequences financieres eventuelles sont examines selon les droits applicables.',
 'Vous pouvez joindre EDM28 : contact@edm28.fr.'
 ].join('\n');
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[to],subject:'Accuse de reception de votre retractation EDM28 '+id.slice(0,8),text})
 });
 if(!response.ok)throw new Error('Accuse email non remis au fournisseur de messagerie');
}
export default async function handler(req,res) {
 if(req.method!=='POST')return reply(res,405,{success:false,error:'Methode non autorisee'});
 if(!allowed.has(req.headers.origin||''))return reply(res,403,{success:false,error:'Origine non autorisee'});
 if(Number(req.headers['content-length']||0)>6000)return reply(res,413,{success:false,error:'Donnees trop volumineuses'});
 if(!cfg.url||!cfg.serviceRoleKey)return reply(res,503,{success:false,error:'Service de retractation momentanement indisponible'});
 const input=req.body||{};
 // Honeypot field: never accept submissions from bots that fill a hidden field.
 if(input.website)return reply(res,400,{success:false,error:'Formulaire invalide'});
 const ref=clean(input.contractReference,100);
 const name=clean(input.name,160);
 const email=clean(input.email,254).toLowerCase();
 const address=clean(input.address,450);
 if(!ref||name.length<2||!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email)||input.confirmed!==true)
  return reply(res,400,{success:false,error:'Renseignez votre nom, votre email, le devis et confirmez votre declaration'});
 try {
  const since=new Date(Date.now()-3600_000).toISOString();
  const prior=await table('consumer_withdrawal_requests?'+new URLSearchParams({
   consumer_email:'eq.'+email,submitted_at:'gte.'+since,select:'id',limit:'6'
  }));
  if(prior.length>=5)return reply(res,429,{success:false,error:'Trop de demandes rapprochees. Contactez directement contact@edm28.fr'});
  const submitted=new Date().toISOString();
  const statement='Je vous notifie ma retractation du contrat reference ci-dessus.';
  const digest=sha(JSON.stringify([ref,name,email,address,statement,submitted]));
  const created=await table('consumer_withdrawal_requests',{
   method:'POST',body:JSON.stringify({
    contract_reference:ref,consumer_name:name,consumer_email:email,
    consumer_address:address||null,statement,request_digest:digest,
    legal_version:'edm28-cgp-2026-11-09',submitted_at:submitted
   })
  });
  const id=created?.[0]?.id;
  if(!id)throw new Error('Preuve de reception absente');
  let receiptSent=false;
  try{
   await sendReceipt(email,id,ref,submitted);
   receiptSent=true;
   await table('consumer_withdrawal_requests?id=eq.'+id,{
    method:'PATCH',body:JSON.stringify({receipt_status:'sent',receipt_sent_at:new Date().toISOString()})
   });
  }catch(err){
   console.error('edm28 withdrawal receipt delivery',err instanceof Error?err.message:'error');
   await table('consumer_withdrawal_requests?id=eq.'+id,{
    method:'PATCH',body:JSON.stringify({receipt_status:'failed'})
   }).catch(()=>{});
  }
  // A received withdrawal is not automatically rejected if the email service is unavailable.
  return reply(res,200,{
   success:true,reference:id,submittedAt:submitted,receiptSent,
   message:receiptSent
     ? 'Votre declaration a ete enregistree. Un accuse a ete envoye par email.'
     : 'Votre declaration a ete enregistree. Copiez cette reference; l accuse email n a pas pu etre envoye, contactez EDM28.'
  });
 }catch(e){
  console.error('edm28 withdrawal submission',e instanceof Error?e.message:'error');
  return reply(res,503,{success:false,error:'Enregistrement impossible. Exercez votre droit par email a contact@edm28.fr.'});
 }
}
