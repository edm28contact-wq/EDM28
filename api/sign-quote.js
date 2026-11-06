import crypto from 'node:crypto';
import { resolveSupabaseServiceConfig } from './supabase-config.js';

const cfg=resolveSupabaseServiceConfig();
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ORIGINS=new Set(['https://edm28.fr','https://www.edm28.fr']);
const fail=(res,status,error)=>res.status(status).json({success:false,error});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hmac=(challenge,code,secret)=>crypto.createHmac('sha256',secret).update(challenge+':'+code).digest('hex');
const base=()=>cfg.url.replace(/\/$/,'');
const serviceHeaders=(additional={})=>({
 apikey:cfg.serviceRoleKey,Authorization:'Bearer '+cfg.serviceRoleKey,...additional
});
async function db(table,params={},method='GET',body=null){
 const query=new URLSearchParams(params);
 const url=base()+'/rest/v1/'+table+(query.size?'?'+query:'');
 const response=await fetch(url,{method,headers:serviceHeaders({
  'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'
 }),...(body===null?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error('Acces au dossier impossible');
 return data;
}
async function auth(req){
 const authorization=String(req.headers.authorization||'');
 if(!/^Bearer [^\s]+$/.test(authorization))return null;
 const r=await fetch(base()+'/auth/v1/user',{headers:{apikey:cfg.key,Authorization:authorization}});
 if(!r.ok)return null;
 const user=await r.json().catch(()=>null);
 return user?.id && user?.email && user.email_confirmed_at ? user : null;
}
async function getQuote(user,id){
 const [quote]=await db('quotes',{id:'eq.'+id,user_id:'eq.'+user.id,
  select:'id,user_id,status,visible_to_client,quote_number,total,valid_until,pdf_path'});
 if(!quote||quote.status!=='sent'||!quote.visible_to_client||
    !quote.pdf_path?.startsWith(user.id+'/quote/'))
    throw new Error('Devis non disponible pour signature');
 const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const nowParis=[dateParts.year,dateParts.month,dateParts.day].join('-');
 if(quote.valid_until && quote.valid_until<nowParis)throw new Error('Devis expire');
 return quote;
}
async function sourceDocument(quote){
 const p=quote.pdf_path.split('/').map(encodeURIComponent).join('/');
 const r=await fetch(base()+'/storage/v1/object/authenticated/repair-documents/'+p,
  {headers:serviceHeaders()});
 if(!r.ok)throw new Error('Document original indisponible');
 const buf=Buffer.from(await r.arrayBuffer());
 if(buf.length<200||buf.length>8_000_000||buf.subarray(0,5).toString()!=='%PDF-')
   throw new Error('Devis PDF invalide');
 return sha(buf);
}
async function profile(user){
 const rows=await db('profiles',{id:'eq.'+user.id,select:'first_name,last_name,email'});
 const p=rows?.[0];
 if(!p)throw new Error('Profil introuvable');
 return p;
}
async function sendCode(to,code,quote){
 const apiKey=process.env.RESEND_API_KEY||'';
 const from=process.env.RESEND_FROM_EMAIL||'';
 if(!/^re_[A-Za-z0-9_-]+$/.test(apiKey)||!from||/[\r\n]/.test(from))
   throw new Error('Envoi de code non configure');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',
  headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
  body:JSON.stringify({
   from,to:[to],subject:'EDM28 - Code de signature du devis '+String(quote.quote_number||''),
   text:'Votre code de signature EDM28 est : '+code+'\n\nCe code expire dans 10 minutes. Ne le communiquez a personne.\n\nSi vous n avez pas demande cette signature, ignorez ce message.\n\nLe code ne vaut pas signature sans votre confirmation sur edm28.fr.'
  })});
 if(!r.ok)throw new Error('Envoi du code par email indisponible');
}
async function recordWrongCode(challengeId){
 const r=await fetch(base()+'/rest/v1/rpc/edm28_signature_wrong_code',{
  method:'POST',headers:serviceHeaders({'Content-Type':'application/json'}),
  body:JSON.stringify({p_id:challengeId})});
 if(!r.ok)throw new Error('Le code ne peut pas etre verifie');
 return r.json().catch(()=>5);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return fail(res,405,'Methode non autorisee');
 if(!ORIGINS.has(String(req.headers.origin||'')))return fail(res,403,'Origine non autorisee');
 if(Number(req.headers['content-length']||0)>4096)return fail(res,413,'Demande trop volumineuse');
 if(!cfg.url||!cfg.key||!cfg.serviceRoleKey)return fail(res,503,'Service de signature non configure');
 const secret=process.env.QUOTE_SIGNATURE_SECRET||cfg.serviceRoleKey;
 if(secret.length<32)return fail(res,503,'Secret de verification indisponible');
 try{
  const user=await auth(req);
  if(!user)return fail(res,401,'Veuillez verifier votre email et vous reconnecter');
  const {action,quoteId}=req.body||{};
  if(!UUID.test(quoteId||''))return fail(res,400,'Identifiant de devis invalide');
  const quote=await getQuote(user,quoteId);
  if(action==='start'){
   const existing=(await db('quote_signature_challenges',{quote_id:'eq.'+quoteId,select:'id,state,expires_at,sent_at'}))[0];
   if(existing?.state==='pending'&&Date.now()-new Date(existing.sent_at).getTime()<60_000)
      return fail(res,429,'Un code vient deja d etre envoye. Reessayez dans une minute');
   const person=await profile(user);
   const name=[person.first_name,person.last_name].filter(Boolean).join(' ').trim().replace(/\s+/g,' ');
   if(name.length<3)return fail(res,400,'Completez votre nom et prenom dans votre compte');
   const sourceHash=await sourceDocument(quote);
   const challengeId=crypto.randomUUID(),code=String(crypto.randomInt(10000000,100000000));
   await db('quote_signature_challenges',{on_conflict:'quote_id'},'POST',{
    id:challengeId,quote_id:quote.id,user_id:user.id,signer_email:user.email,
    source_path:quote.pdf_path,source_sha256:sourceHash,code_hash:hmac(challengeId,code,secret),
    attempts:0,expires_at:new Date(Date.now()+600_000).toISOString(),
    created_at:new Date().toISOString(),sent_at:new Date().toISOString(),state:'pending'
   });
   try{await sendCode(user.email,code,quote);}
   catch(_){await db('quote_signature_challenges',{id:'eq.'+challengeId},'DELETE');return fail(res,503,'Envoi email indisponible, aucune signature realisee');}
   return res.status(200).json({success:true,expires_in_seconds:600});
  }
  if(action!=='sign')return fail(res,400,'Action inconnue');
  const {code,consent,name}=req.body||{};
  if(consent!==true||typeof code!=='string'||!/^\d{8}$/.test(code)||typeof name!=='string')
    return fail(res,400,'Nom, consentement et code a huit chiffres obligatoires');
  const c=(await db('quote_signature_challenges',{quote_id:'eq.'+quoteId,user_id:'eq.'+user.id,select:'*'}))[0];
  if(!c||c.state!=='pending'||c.attempts>=5||Date.now()>=new Date(c.expires_at).getTime())
    return fail(res,409,'Demandez un nouveau code');
  const normalized=name.trim().replace(/\s+/g,' ');
  const p=await profile(user);
  const expected=[p.first_name,p.last_name].filter(Boolean).join(' ').trim().replace(/\s+/g,' ');
  if(normalized.toLocaleLowerCase('fr')!==expected.toLocaleLowerCase('fr'))
    return fail(res,400,'Le nom doit correspondre au titulaire du compte');
  const digest=hmac(c.id,code,secret);
  if(!crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(c.code_hash,'hex'))){
    await recordWrongCode(c.id);
    return fail(res,400,'Code invalide. Cinq tentatives maximum');
  }
  if(c.source_path!==quote.pdf_path||c.source_sha256!==await sourceDocument(quote))
    return fail(res,409,'Le devis a change. Demandez un nouveau code');
  const networkDigest=sha(String(req.headers['x-forwarded-for']||'').split(',')[0].slice(0,100)+'|'+String(req.headers['user-agent']||'').slice(0,300));
  const signed=await fetch(base()+'/functions/v1/client-sign-quote',{
   method:'POST',headers:serviceHeaders({'Content-Type':'application/json'}),
   body:JSON.stringify({quoteId:quote.id,challengeId:c.id,codeHash:digest,
    userId:user.id,name:normalized,networkDigest})
  });
  const response=await signed.json().catch(()=>({}));
  if(!signed.ok||response.success!==true)
    return fail(res,signed.status===503?503:409,'Signature non terminee. Verifiez le document et reessayez');
  return res.status(200).json({success:true,quote_id:quote.id,signed_at:response.signed_at});
 }catch(e){
  console.error('edm28 quote signature',e instanceof Error?e.message:'internal');
  return fail(res,422,'Signature impossible. Veuillez reessayer ou contacter EDM28');
 }
}
