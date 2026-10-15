(() => {
  const BUCKET='repair-documents';
  async function embed(pdf, bytes, path) {
    if (!path) return null;
    const db=window.EDMAdmin.db;
    const result=await db.storage.from(BUCKET).download(path);
    if(result.error) throw new Error('Image entreprise indisponible : '+result.error.message);
    const imageBytes=await result.data.arrayBuffer();
    if (path.toLowerCase().endsWith('.png')) return pdf.embedPng(imageBytes);
    return pdf.embedJpg(imageBytes);
  }
  async function apply(blob,type,cfg) {
    if(!['quote','invoice','order','inspection'].includes(type))return blob;
    if(!cfg.workshop_stamp_path && !cfg.workshop_signature_path)return blob;
    const lib=window.PDFLib;
    if(!lib)throw new Error('Moteur de cachet PDF non chargé.');
    const pdf=await lib.PDFDocument.load(await blob.arrayBuffer());
    const page=pdf.getPages()[pdf.getPageCount()-1];
    const stamp=await embed(pdf,null,cfg.workshop_stamp_path);
    const sign=await embed(pdf,null,cfg.workshop_signature_path);
    // Append a separate atelier-only validation page: never alter the customer's
    // acceptance field or place an owner's mark as if the customer signed.
    if(stamp || sign){
      const p=pdf.addPage([595,842]);
      const font=await pdf.embedFont(lib.StandardFonts.Helvetica);
      const title=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
      p.drawText('EDM28 - VALIDATION ATELIER',{x:42,y:771,size:19,font:title});
      p.drawText(type==='quote'?'Identification de l’entreprise - devis':type==='invoice'?'Cachet et signature de l’entreprise - facture':type==='order'?'Visa atelier - ordre de réparation':'Validation atelier - fiche de contrôle',{x:42,y:741,size:10,font});
      const name=String(cfg.workshop_signer_name||'Enguerrand D’Anglade').slice(0,100);
      p.drawText(name,{x:42,y:685,size:12,font:title});
      if(stamp){const fit=stamp.scale(Math.min(220/stamp.width,135/stamp.height,1));p.drawImage(stamp,{x:42,y:500,width:fit.width,height:fit.height});}
      if(sign && type!=='quote'){const fit=sign.scale(Math.min(220/sign.width,105/sign.height,1));p.drawImage(sign,{x:322,y:520,width:fit.width,height:fit.height});}
      p.drawText('Visa EDM28 uniquement. La signature du client, si requise, est recueillie séparément.',{x:42,y:84,size:8,font});
    }
    return new Blob([await pdf.save()],{type:'application/pdf'});
  }
  window.EDMCompanyPdfAssets={apply};
})();
