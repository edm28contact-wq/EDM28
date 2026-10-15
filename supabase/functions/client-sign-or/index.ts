import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1?target=denonext';

const origin = 'https://edm28.fr';
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const env = (name: string) => Deno.env.get(name) || '';
const respond = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: status < 400, message, ...extra }), {
    status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
const sha256 = async (input: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', input))]
  .map(x => x.toString(16).padStart(2, '0')).join('');
const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
async function api(url: string, key: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey',key);
  headers.set('Authorization',`Bearer ${token}`);
  const result = await fetch(url,{...init,headers});
  return result;
}
async function getJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message.slice(0,150) : 'Requête refusée.');
  return data;
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (request.method !== 'POST') return respond(405,'Méthode non autorisée.');
  if (request.headers.get('Origin') !== origin) return respond(403,'Origine non autorisée.');
  if (Number(request.headers.get('content-length') || 0) > 500_000) return respond(413,'Signature trop volumineuse.');
  const url = env('SUPABASE_URL'), pub = env('SUPABASE_ANON_KEY'), secret = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !pub || !secret) return respond(503,'Service de signature non configuré.');
  const bearer = request.headers.get('authorization') || '';
  if (!/^Bearer [^.]+\.[^.]+\.[^.]+$/.test(bearer)) return respond(401,'Connexion requise.');
  let userId = '';
  let uploaded = '';
  try {
    const auth = await api(`${url}/auth/v1/user`,pub,bearer.slice(7));
    if (!auth.ok) return respond(401,'Session expirée.');
    const user = await auth.json();
    userId = user.id;
    if (!uuid(userId)) return respond(401,'Session invalide.');

    const body = await request.json();
    const orderId = body?.orderId;
    const name = String(body?.name || '').trim().replace(/\s+/g,' ');
    const signature = body?.signature;
    if (!uuid(orderId) || !name || name.length > 140 || body?.accepted !== true ||
      typeof signature !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) ||
      signature.length > 240_000) return respond(400,'Signature, identité ou accord incomplet.');
    const png = Uint8Array.from(atob(signature.split(',')[1]),x=>x.charCodeAt(0));
    if(png.length < 200 || png.length > 175_000 || png.slice(0,8).join(',') !== '137,80,78,71,13,10,26,10')
      return respond(400,'Image de signature PNG invalide.');

    const adminHeaders = {'Accept':'application/json'};
    const query = (table: string,params: string) =>
      api(`${url}/rest/v1/${table}?${params}`,secret,secret,{headers:adminHeaders});
    const orders = await getJson(await query('repair_orders',`id=eq.${orderId}&user_id=eq.${userId}&select=id,user_id,order_number,pdf_path,signed_at,status,visible_to_client`));
    const order=orders[0];
    if(!order || order.signed_at || !order.visible_to_client || !['ready','in_progress'].includes(order.status) ||
      !order.pdf_path || !order.pdf_path.startsWith(`${userId}/`))
      return respond(409,'Cet ordre de réparation ne peut pas être signé.');
    const profiles = await getJson(await query('profiles',`id=eq.${userId}&select=first_name,last_name`));
    const expected = [profiles[0]?.first_name, profiles[0]?.last_name].filter(Boolean).join(' ').trim().replace(/\s+/g,' ');
    if(!expected || expected.toLocaleLowerCase('fr') !== name.toLocaleLowerCase('fr'))
      return respond(400,'Saisissez le prénom et le nom de votre compte.');

    const source = await api(`${url}/storage/v1/object/authenticated/repair-documents/${order.pdf_path.split('/').map(encodeURIComponent).join('/')}`,secret,secret);
    if(!source.ok) throw new Error('Document original indisponible.');
    const sourceBytes = new Uint8Array(await source.arrayBuffer());
    if(sourceBytes.length<300 || sourceBytes.length>8_000_000 ||
      new TextDecoder().decode(sourceBytes.slice(0,5)) !== '%PDF-') return respond(422,'PDF original invalide.');
    const originalHash = await sha256(sourceBytes), imageHash=await sha256(png);

    const pdf=await PDFDocument.load(sourceBytes,{ignoreEncryption:false});
    const page=pdf.addPage([595,842]), font=await pdf.embedFont(StandardFonts.Helvetica);
    const sign=await pdf.embedPng(png), size=sign.scale(Math.min(370/sign.width,125/sign.height,1));
    const safeName=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'').slice(0,120);
    page.drawText('EDM28 - ACCORD ELECTRONIQUE DU CLIENT',{x:42,y:765,size:16,font});
    page.drawText('Ordre de reparation : '+String(order.order_number || orderId).slice(0,70),{x:42,y:723,size:10,font});
    page.drawText('Je confirme avoir lu et accepte les travaux et le montant', {x:42,y:690,size:10,font});
    page.drawText('figurant dans les pages precedentes.', {x:42,y:676,size:10,font});
    page.drawText('Nom : '+safeName,{x:42,y:645,size:10,font});
    page.drawText('Date (UTC) : '+new Date().toISOString(),{x:42,y:624,size:10,font});
    page.drawImage(sign,{x:42,y:465,width:size.width,height:size.height});
    page.drawText('Signature saisie sur le compte client authentifie EDM28.',{x:42,y:434,size:9,font});
    page.drawText('SHA-256 du document original :',{x:42,y:147,size:9,font});
    page.drawText(originalHash,{x:42,y:132,size:8,font});
    const final=new Uint8Array(await pdf.save());
    if(final.length>10_000_000) return respond(413,'PDF signé trop volumineux.');
    const path=`${userId}/signed-orders/${orderId}/${crypto.randomUUID()}.pdf`;
    const upload=await api(`${url}/storage/v1/object/repair-documents/${path.split('/').map(encodeURIComponent).join('/')}`,secret,secret,{
      method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:final
    });
    if(!upload.ok) throw new Error('Enregistrement du PDF signé impossible.');
    uploaded=path;
    const update=await api(`${url}/rest/v1/repair_orders?id=eq.${orderId}&user_id=eq.${userId}&signed_at=is.null&pdf_path=eq.${encodeURIComponent(order.pdf_path)}&select=id`,secret,secret,{
      method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({
        pdf_path:path,signed_at:new Date().toISOString(),client_signature_name:expected,
        client_signature_method:'authenticated_server_pdf',
        client_signature_original_pdf_path:order.pdf_path, client_signature_final_pdf_path:path,
        client_signature_source_sha256:originalHash,client_signature_image_sha256:imageHash,
        client_signature_final_sha256:await sha256(final)
      })
    });
    const updated=await getJson(update);
    if(!updated.length) return respond(409,'Cet OR a déjà été signé ou modifié. Actualisez la page.');
    uploaded='';
    return respond(200,'OR signé et enregistré.',{orderId});
  } catch(e) {
    console.error('edm28-sign-order',e instanceof Error?e.name:'error');
    return respond(422,'Signature impossible. Vérifiez le document puis réessayez.');
  } finally {
    // An unsuccessful update leaves no customer-visible orphan document.
    if(uploaded) await api(`${url}/storage/v1/object/repair-documents/${uploaded.split('/').map(encodeURIComponent).join('/')}`,secret,secret,{method:'DELETE'}).catch(()=>{});
  }
});
