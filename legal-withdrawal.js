(() => {
 const form=document.getElementById('edmWithdrawalForm');
 if(!form)return;
 const preview=document.getElementById('edmWithdrawalConfirm');
 const status=document.getElementById('edmWithdrawalStatus');
 const submit=document.getElementById('edmWithdrawalSubmit');
 const button=document.getElementById('edmWithdrawalContinue');
 const values=()=>({
  contractReference:form.elements.contractReference.value.trim(),
  name:form.elements.consumerName.value.trim(),
  email:form.elements.consumerEmail.value.trim(),
  address:form.elements.consumerAddress.value.trim(),
  website:form.elements.website.value
 });
 button.addEventListener('click',()=>{
  if(!form.reportValidity())return;
  const v=values();
  if(!v.contractReference||!v.name||!v.email)return;
  document.getElementById('edmWithdrawalSummary').textContent=
   'Je, '+v.name+' ('+v.email+'), vous notifie ma rétractation du contrat/devis '+v.contractReference+'.';
  preview.hidden=false;button.disabled=true;submit.disabled=false;
 });
 form.addEventListener('input',()=>{
  preview.hidden=true;submit.disabled=true;button.disabled=false;
 });
 form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(preview.hidden||!form.reportValidity())return;
  const v=values();
  submit.disabled=true;button.disabled=true;
  status.textContent='Enregistrement de la déclaration…';
  try{
   const response=await fetch('/api/withdrawal',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...v,confirmed:true})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.success)throw new Error(result.error||'Enregistrement impossible');
   const dt=new Date(result.submittedAt);
   const local=Number.isNaN(dt.getTime())?result.submittedAt:dt.toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short'});
   status.textContent='Déclaration enregistrée le '+local+'. Référence : '+result.reference+
    (result.receiptSent?'. Un accusé de réception vous a été envoyé.':'. L’accusé email n’a pas été délivré. Conservez cette référence et contactez EDM28.');
   form.querySelectorAll('input,button').forEach(el=>{el.disabled=true;});
   preview.hidden=true;
  }catch(e){
   status.textContent=e.message||'Enregistrement impossible. Vous pouvez écrire à contact@edm28.fr.';
   submit.disabled=false;button.disabled=false;
  }
 });
})();