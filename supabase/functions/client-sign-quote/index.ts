import {PDFDocument, StandardFonts} from 'npm:pdf-lib@1.17.1';

const env = (key:string)=>Deno.env.get(key)||'';
const json=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
const sha256=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const headers=(key:string,more:Record<string,string>={})=>({'apikey':key,'Authorization':'Bearer '+key,...more});
const fetchRows=async(url:string,key:string,table:string,query:string)=>{
  const r=await fetch(url+'/rest/v1/'+table+'?'+query,{headers:headers(key)});
  if(!r.ok)throw new Error('Lecture securisee impossible.');return await r.json();
};
const limited=(s:string,max:number)=>s.replace(/[^\x20-\x7e]/g,'').slice(0,max);

Deno.serve(async(request)=>{
 if(request.method!=='POST')return json(405,{success:false,error:'Method not allowed'});
 const base=env('SUPABASE_URL'), secret=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!secret)return json(503,{success:false,error:'Configuration serveur manquante'});
 const authorization=request.headers.get('Authorization')||'';
 if(authorization!=='Bearer '+secret)return json(403,{success:false,error:'Acces serveur uniquement'});
 let savedPath='';
 try{
  const payload=await request.json();
  const quoteId=payload.quoteId, challengeId=payload.challengeId;
  const codeHash=payload.codeHash, signer=String(payload.name||'').trim().replace(/\s+/g,' ');
  const networkDigest=payload.networkDigest;
  if(!uuid(quoteId)||!uuid(challengeId)||!/^([0-9a-f]{64})$/.test(codeHash||'')||
     !/^[0-9a-f]{64}$/.test(networkDigest||'')||signer.length<3||signer.length>140)
   return json(400,{success:false,error:'Donnees de signature invalides'});
  const [cs,qs,profiles]=await Promise.all([
   fetchRows(base,secret,'quote_signature_challenges','id=eq.'+challengeId+'&quote_id=eq.'+quoteId+'&select=*'),
   fetchRows(base,secret,'quotes','id=eq.'+quoteId+'&select=id,user_id,quote_number,total,status,valid_until,pdf_path,visible_to_client'),
   fetchRows(base,secret,'profiles','id=eq.'+encodeURIComponent(String(payload.userId||''))+'&select=id,first_name,last_name')
  ]);
  const c=cs[0], q=qs[0],profile=profiles[0];
  const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ').trim().replace(/\s+/g,' ');
  if(!c||!q||!profile||c.user_id!==q.user_id||c.user_id!==profile.id
      ||c.state!=='pending'||new Date(c.expires_at).getTime()<=Date.now()||c.attempts>=5
      ||c.code_hash!==codeHash||q.status!=='sent'||q.visible_to_client!==true
      ||q.pdf_path!==c.source_path||name.toLocaleLowerCase('fr')!==signer.toLocaleLowerCase('fr'))
   return json(409,{success:false,error:'Devis ou demande de signature non valide'});
  const paris=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const parisDay=[paris.year,paris.month,paris.day].join('-');
  if(q.valid_until && q.valid_until<parisDay)return json(409,{success:false,error:'Devis expire'});
  const path=c.source_path;
  if(!path?.startsWith(q.user_id+'/quote/'))return json(422,{success:false,error:'Chemin du devis invalide'});
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const original=await fetch(base+'/storage/v1/object/authenticated/repair-documents/'+encoded,{headers:headers(secret)});
  if(!original.ok)throw new Error('Devis PDF indisponible');
  const bytes=new Uint8Array(await original.arrayBuffer());
  if(bytes.length<200||bytes.length>8_000_000||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')
   return json(422,{success:false,error:'PDF du devis invalide'});
  const originalHash=await sha256(bytes);
  if(originalHash!==c.source_sha256)return json(409,{success:false,error:'Le devis a ete modifie. Recommencez la signature'});
  const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false});
  const page=pdf.addPage([595,842]);
  const font=await pdf.embedFont(StandardFonts.Helvetica),fontBold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const at=new Date().toISOString();
  // Avoid custom PDF graphics or rendering of HTML from untrusted text.
  const draw=(value:string,y:number,size=11,bold=false)=>page.drawText(limited(value,100),{x:44,y,size,font:bold?fontBold:font});
  draw('EDM28 - ATTESTATION DE CONSENTEMENT ELECTRONIQUE',765,15,true);
  draw('Devis : '+String(q.quote_number||q.id),724);
  draw('Montant total : '+Number(q.total).toFixed(2)+' EUR',696);
  draw('Signataire : '+signer.normalize('NFD').replace(/[\u0300-\u036f]/g,''),668);
  draw('Email verifie : '+String(c.signer_email),642);
  draw('Date de validation (UTC) : '+at,616);
  draw('Methode : compte authentifie + code de confirmation email',590,10);
  draw('Consentement : J accepte le devis, ses prestations et son prix.',565,10);
  draw('Empreinte SHA-256 du PDF original :',498,10,true);
  draw(originalHash.slice(0,54),475,8);
  draw(originalHash.slice(54),461,8);
  draw('Cette attestation n est pas une signature qualifiee eIDAS.',403,10);
  draw('L historique probatoire est conserve par EDM28.',387,10);
  const signed=new Uint8Array(await pdf.save());
  if(signed.length>10_000_000)return json(413,{success:false,error:'PDF trop volumineux'});
  const finalHash=await sha256(signed);
  savedPath=q.user_id+'/signed-quotes/'+q.id+'/'+crypto.randomUUID()+'.pdf';
  const upload=await fetch(base+'/storage/v1/object/repair-documents/'+savedPath.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',headers:headers(secret,{'Content-Type':'application/pdf','x-upsert':'false'}),body:signed
  });
  if(!upload.ok)throw new Error('Stockage du devis signe impossible');
  const commit=await fetch(base+'/rest/v1/rpc/edm28_finalize_signed_quote',{
   method:'POST',headers:headers(secret,{'Content-Type':'application/json'}),
   body:JSON.stringify({p_quote_id:q.id,p_challenge_id:c.id,p_code_hash:codeHash,p_name:signer,
    p_signed_path:savedPath,p_signed_sha256:finalHash,p_network_digest:networkDigest})
  });
  if(!commit.ok)throw new Error('Validation finale du devis impossible');
  const data=await commit.json();
  savedPath='';
  return json(200,{success:true,signed_at:data.signed_at,quote_id:q.id});
 }catch(e){
   console.error('edm28 quote signing:',e instanceof Error?e.message:'internal');
   return json(422,{success:false,error:'Signature impossible. Verifiez le code et reessayez.'});
 }finally{
   if(savedPath)await fetch(base+'/storage/v1/object/repair-documents/'+savedPath.split('/').map(encodeURIComponent).join('/'),{
    method:'DELETE',headers:headers(secret)
   }).catch(()=>{});
 }
});
