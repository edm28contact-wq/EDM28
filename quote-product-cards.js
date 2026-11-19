(function (root) {
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const P = () => root.EDMSupplierBasketPolicy;
  const app = () => root.EDMAdmin;
  const safeUrl = value => P().safeUrl(value);
  const empty = () => ({ name:'', brand:'', reference:'', quantity:1, photo_url:'', merchants:[{name:'',url:'',price_ttc:null}] });
  const positive = value => Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=24;
  function normalize(value, strict=false) {
    if(!Array.isArray(value) || value.length>12)throw new Error('Maximum 12 pièces par devis.');
    return value.map((part, index)=>{
      const name=String(part.name||'').trim(), brand=String(part.brand||'').trim(), reference=String(part.reference||'').trim();
      const quantity=Number(part.quantity);
      const photo=String(part.photo_url||'').trim();
      if(!name||name.length>160||!reference||reference.length>100||brand.length>100||!positive(quantity))
        throw new Error('Pièce '+(index+1)+' : renseignez la désignation, la référence exacte et une quantité valide.');
      if(photo) safeUrl(photo);
      if(!Array.isArray(part.merchants)||part.merchants.length<1||part.merchants.length>4)
        throw new Error('Pièce '+(index+1)+' : indiquez de 1 à 4 liens marchands.');
      const merchants=part.merchants.map((offer,j)=>{
        const merchant=String(offer.name||'').trim(), link=String(offer.url||'').trim();
        const price=offer.price_ttc==null||offer.price_ttc===''?null:Number(offer.price_ttc);
        if(!merchant||merchant.length>90||!link) throw new Error('Pièce '+(index+1)+', vendeur '+(j+1)+' : nom et lien obligatoires.');
        if(price!==null&&(!Number.isFinite(price)||price<0||price>100000||Math.round(price*100)!==price*100))
          throw new Error('Prix TTC indicatif invalide pour '+merchant+'.');
        return {name:merchant,url:safeUrl(link),price_ttc:price};
      });
      return {name,brand,reference,quantity,photo_url:photo,merchants};
    });
  }
  const summary = cards => ({
    references:cards.map(c=>[c.name,c.brand,c.reference,'x'+c.quantity].filter(Boolean).join(' - ')).join('\n'),
    prices:cards.map(c=>c.merchants.filter(o=>o.price_ttc!=null).map(o=>c.reference+' - '+o.name+' : '+Number(o.price_ttc).toFixed(2)+' EUR TTC (prix indicatif)').join('\n')).filter(Boolean).join('\n'),
    firstUrl:cards[0]?.merchants?.[0]?.url||''
  });
  function merchantEditor(offer={},disabled=false) {
    const d=disabled?' disabled':'';
    return '<div class="grid2" data-part-merchant style="border:1px solid #ddd;border-radius:9px;padding:10px;margin:5px 0">'
      +'<label>Site marchand<input data-merchant="name" maxlength="90" value="'+h(offer.name||'')+'"'+d+'></label>'
      +'<label>Lien direct du produit (HTTPS)<input data-merchant="url" type="url" maxlength="2000" value="'+h(offer.url||'')+'" placeholder="https://..."'+d+'></label>'
      +'<label>Prix indicatif TTC (facultatif)<input data-merchant="price_ttc" type="number" min="0" max="100000" step="0.01" value="'+h(offer.price_ttc??'')+'"'+d+'></label>'
      +(disabled?'':'<button type="button" class="btn ghost" data-remove-merchant>Retirer ce vendeur</button>')+'</div>';
  }
  function partEditor(part=empty(),disabled=false) {
    const d=disabled?' disabled':'';
    const sellers=Array.isArray(part.merchants)&&part.merchants.length?part.merchants:[{name:'',url:'',price_ttc:null}];
    const photo=part.photo_url?safeUrl(part.photo_url):'';
    return '<article data-part-card class="card" style="padding:14px;margin:10px 0">'
      +'<div class="top"><h5>Pièce préconisée</h5>'+(disabled?'':'<button class="btn ghost" type="button" data-remove-part>Supprimer cette fiche</button>')+'</div>'
      +'<div class="grid2"><label>Désignation<input data-part="name" maxlength="160" value="'+h(part.name||'')+'"'+d+'></label>'
      +'<label>Marque fabricant<input data-part="brand" maxlength="100" value="'+h(part.brand||'')+'"'+d+'></label>'
      +'<label>Référence exacte<input data-part="reference" maxlength="100" value="'+h(part.reference||'')+'"'+d+'></label>'
      +'<label>Quantité<input data-part="quantity" type="number" min="1" max="24" step="1" value="'+h(part.quantity||1)+'"'+d+'></label></div>'
      +'<label>Photo de la pièce (URL HTTPS ou import)<input data-part="photo_url" type="url" maxlength="2000" value="'+h(photo)+'" placeholder="https://..."'+d+'></label>'
      +(photo?'<img data-part-preview src="'+h(photo)+'" alt="Photo indicative de la pièce" loading="lazy" style="max-width:180px;max-height:150px;object-fit:contain;margin:8px 0">':'<div data-part-preview></div>')
      +(disabled?'':'<label>Importer une photo du produit (JPG, PNG ou WebP ; 3 Mo max)<input type="file" data-part-upload accept="image/jpeg,image/png,image/webp"></label>')
      +'<strong>Où acheter cette pièce ?</strong><div data-merchant-list>'+sellers.map(x=>merchantEditor(x,disabled)).join('')+'</div>'
      +(disabled?'':'<button type="button" class="btn ghost" data-add-merchant>Ajouter un autre vendeur</button>')
      +'</article>';
  }
  function editor(value=[],disabled=false) {
    return '<section data-product-cards style="margin:16px 0"><h4>Photos, références et sites marchands par pièce</h4>'
      +'<p class="muted">Une fiche par pièce. Chaque lien dirige vers le vendeur. Les pièces ne sont pas vendues ni encaissées par EDM28. Les prix restent indicatifs.</p>'
      +'<div data-product-list>'+value.map(p=>partEditor(p,disabled)).join('')+'</div>'
      +(disabled?'':'<button type="button" class="btn ghost" data-add-part>Ajouter une fiche pièce</button>')
      +'<p data-part-error role="status" aria-live="polite"></p></section>';
  }
  function read(section) {
    if(!section)return [];
    return normalize([...section.querySelectorAll('[data-part-card]')].map(part=>({
      name:part.querySelector('[data-part="name"]').value,
      brand:part.querySelector('[data-part="brand"]').value,
      reference:part.querySelector('[data-part="reference"]').value,
      quantity:part.querySelector('[data-part="quantity"]').value,
      photo_url:part.querySelector('[data-part="photo_url"]').value,
      merchants:[...part.querySelectorAll('[data-part-merchant]')].map(offer=>({
        name:offer.querySelector('[data-merchant="name"]').value,
        url:offer.querySelector('[data-merchant="url"]').value,
        price_ttc:offer.querySelector('[data-merchant="price_ttc"]').value
      }))
    })));
  }
  async function uploadPhoto(root,input) {
    const file=input.files?.[0],part=input.closest('[data-part-card]');
    if(!file||!part)return;
    if(file.size<100||file.size>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))
      throw new Error('Photo refusée : JPG, PNG ou WebP de 3 Mo maximum.');
    const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const isJpg=header[0]===0xff&&header[1]===0xd8&&header[2]===0xff;
    const isPng=header.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';
    const isWebP=String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP';
    if((file.type==='image/jpeg'&&!isJpg)||(file.type==='image/png'&&!isPng)||(file.type==='image/webp'&&!isWebP))
      throw new Error('Le contenu ne correspond pas au format de l’image.');
    const id=root.dataset.quoteId;
    if(!/^[a-f0-9-]{36}$/i.test(id||''))throw new Error('Devis sans identifiant.');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    const path=id+'/'+crypto.randomUUID()+'.'+ext;
    const storage=app().db.storage.from('quote-part-images');
    const result=await storage.upload(path,file,{contentType:file.type,upsert:false});
    if(result.error)throw result.error;
    const url=storage.getPublicUrl(path)?.data?.publicUrl;
    if(!url)throw new Error('URL de la photo indisponible.');
    part.querySelector('[data-part="photo_url"]').value=url;
    const preview=part.querySelector('[data-part-preview]');
    if(preview)preview.outerHTML='<img data-part-preview src="'+h(url)+'" alt="Photo indicative de la pièce" loading="lazy" style="max-width:180px;max-height:150px;object-fit:contain;margin:8px 0">';
  }
  function bind(root) {
    const section=root.querySelector('[data-product-cards]');
    if(!section||section.dataset.bound==='1'||!root.querySelector('[data-add-part]'))return;
    section.dataset.bound='1';
    section.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!button)return;
      const list=section.querySelector('[data-product-list]');
      if(button.matches('[data-add-part]')){
        if(list.querySelectorAll('[data-part-card]').length>=12)return;
        list.insertAdjacentHTML('beforeend',partEditor());return;
      }
      if(button.matches('[data-remove-part]')){button.closest('[data-part-card]').remove();return;}
      if(button.matches('[data-add-merchant]')){
        const box=button.closest('[data-part-card]').querySelector('[data-merchant-list]');
        if(box.querySelectorAll('[data-part-merchant]').length<4)box.insertAdjacentHTML('beforeend',merchantEditor());
        return;
      }
      if(button.matches('[data-remove-merchant]')){
        const box=button.closest('[data-merchant-list]');
        if(box.querySelectorAll('[data-part-merchant]').length>1)button.closest('[data-part-merchant]').remove();
      }
    });
    section.addEventListener('change',async event=>{
      const input=event.target.closest('[data-part-upload]');
      if(!input)return;
      const status=section.querySelector('[data-part-error]');
      input.disabled=true;status.textContent='Enregistrement de la photo…';
      try{await uploadPhoto(root,input);status.textContent='Photo importée. Enregistrez ensuite le devis.';}
      catch(e){status.textContent=e.message||'Photo non importée.';}
      finally{input.disabled=false;input.value='';}
    });
  }
  const api={empty,normalize,summary,editor,read,bind};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EDMQuoteProductCards=api;
})(globalThis);
