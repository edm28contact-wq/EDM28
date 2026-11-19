-- Structured per-product recommendations (no sale of parts by EDM28).
ALTER TABLE public.quote_parts_baskets
  ADD COLUMN IF NOT EXISTS product_cards jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.quote_parts_baskets
  DROP CONSTRAINT IF EXISTS edm28_product_cards_is_array;
ALTER TABLE public.quote_parts_baskets
  ADD CONSTRAINT edm28_product_cards_is_array
  CHECK(jsonb_typeof(product_cards)='array' AND jsonb_array_length(product_cards)<=12);
CREATE OR REPLACE FUNCTION private.edm28_validate_product_cards()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $validate$
DECLARE item jsonb; offer jsonb; quantity_number numeric; price_number numeric; image_link text; url text;
BEGIN
 IF jsonb_typeof(new.product_cards) <> 'array'
    OR jsonb_array_length(new.product_cards)>12
    OR (new.requires_parts IS FALSE AND jsonb_array_length(new.product_cards)>0)
 THEN
   RAISE EXCEPTION 'La liste des pieces est invalide (12 maximum).' USING ERRCODE='23514';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(new.product_cards) LOOP
   IF jsonb_typeof(item)<>'object'
     OR length(btrim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 160
     OR length(btrim(coalesce(item->>'reference',''))) NOT BETWEEN 1 AND 100
     OR length(coalesce(item->>'brand',''))>100
     OR jsonb_typeof(item->'quantity') <> 'number'
   THEN RAISE EXCEPTION 'Designation, reference ou quantite de piece invalide.' USING ERRCODE='23514'; END IF;
   quantity_number:=(item->>'quantity')::numeric;
   IF quantity_number<1 OR quantity_number>24 OR quantity_number <> trunc(quantity_number)
   THEN RAISE EXCEPTION 'Quantite de piece invalide.' USING ERRCODE='23514'; END IF;
   image_link:=coalesce(item->>'photo_url','');
   IF length(image_link)>2000 OR (image_link<>'' AND
     image_link !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*[.][A-Za-z0-9-]+(:443)?([/?#][^[:space:]\\]*)?$')
   THEN RAISE EXCEPTION 'Image de piece : URL HTTPS invalide.' USING ERRCODE='23514'; END IF;
   IF jsonb_typeof(item->'merchants') <> 'array'
   THEN RAISE EXCEPTION 'Les vendeurs doivent etre une liste.' USING ERRCODE='23514'; END IF;
   IF jsonb_array_length(item->'merchants') NOT BETWEEN 1 AND 4
   THEN RAISE EXCEPTION 'Chaque piece requiert de 1 a 4 vendeurs.' USING ERRCODE='23514'; END IF;
   FOR offer IN SELECT value FROM jsonb_array_elements(item->'merchants') LOOP
     IF jsonb_typeof(offer)<>'object' OR length(btrim(coalesce(offer->>'name',''))) NOT BETWEEN 1 AND 90
       OR length(coalesce(offer->>'url',''))>2000
     THEN RAISE EXCEPTION 'Nom ou lien du vendeur invalide.' USING ERRCODE='23514'; END IF;
     url:=coalesce(offer->>'url','');
     IF url !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*[.][A-Za-z0-9-]+(:443)?([/?#][^[:space:]\\]*)?$'
     THEN RAISE EXCEPTION 'Chaque offre doit avoir un lien HTTPS valide.' USING ERRCODE='23514'; END IF;
     IF offer ? 'price_ttc' AND offer->'price_ttc' <> 'null'::jsonb THEN
       IF jsonb_typeof(offer->'price_ttc') <> 'number'
       THEN RAISE EXCEPTION 'Prix indicatif invalide.' USING ERRCODE='23514'; END IF;
       price_number:=(offer->>'price_ttc')::numeric;
       IF price_number<0 OR price_number>100000 OR price_number<>round(price_number,2)
       THEN RAISE EXCEPTION 'Prix indicatif invalide.' USING ERRCODE='23514'; END IF;
     END IF;
   END LOOP;
 END LOOP;
 RETURN new;
END;
$validate$;
REVOKE ALL ON FUNCTION private.edm28_validate_product_cards() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS edm28_validate_product_cards ON public.quote_parts_baskets;
CREATE TRIGGER edm28_validate_product_cards BEFORE INSERT OR UPDATE OF product_cards,requires_parts
ON public.quote_parts_baskets FOR EACH ROW EXECUTE FUNCTION private.edm28_validate_product_cards();

-- Uploaded files must be product-only images, never photographs of customers or vehicles.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('quote-part-images','quote-part-images',true,3145728,ARRAY['image/png','image/jpeg','image/webp']::text[])
ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS edm28_admin_upload_quote_part_images ON storage.objects;
CREATE POLICY edm28_admin_upload_quote_part_images ON storage.objects
FOR INSERT TO authenticated WITH CHECK(
 bucket_id='quote-part-images'
 AND (select private.is_admin())
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
);
CREATE OR REPLACE FUNCTION public.admin_save_service_quote(p_quote_id uuid, p_quote jsonb, p_items jsonb, p_basket jsonb, p_expected_revision uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  q public.quotes%rowtype; b public.quote_parts_baskets%rowtype; i jsonb;
  qty numeric; price numeric; rate numeric; v_discount numeric;
  v_subtotal numeric := 0; vat numeric := 0; gross numeric; revision uuid; num text; idx integer := 0;
begin
  if auth.uid() is null or private.is_admin() is not true then raise exception 'Acces administrateur requis.' using errcode = '42501'; end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if not found or q.status <> 'draft' or q.commercial_model <> 'customer_supplied_v1' then raise exception 'Seul un nouveau devis brouillon peut etre modifie.'; end if;
  select * into b from public.quote_parts_baskets where quote_id = q.id;
  if b.revision is distinct from p_expected_revision then raise exception 'Le devis a change. Rechargez avant de modifier.' using errcode = '40001'; end if;
  if jsonb_typeof(p_quote) is distinct from 'object' or jsonb_typeof(p_basket) is distinct from 'object'
    or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Donnees de devis invalides.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'De 1 a 100 lignes de prestation sont requises.'; end if;
  if jsonb_typeof(p_basket->'requires_parts') is distinct from 'boolean' then raise exception 'Precisez les pieces necessaires.'; end if;
  if coalesce(length(p_quote->>'title'),0) not between 1 and 300 or coalesce(length(p_quote->>'description'),0) > 6000 then raise exception 'Titre ou description invalide.'; end if;
  v_discount := coalesce((p_quote->>'discount')::numeric,0);
  if v_discount < 0 or v_discount > 100000000 or v_discount <> round(v_discount,2) then raise exception 'Remise invalide.'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(i) <> 'object' or coalesce(i->>'item_type','') not in ('labor','other') then raise exception 'Pieces non facturables par EDM28.'; end if;
    if coalesce(length(btrim(i->>'designation')),0) not between 1 and 300 or coalesce(length(i->>'description'),0) > 1200 then raise exception 'Designation invalide.'; end if;
    qty := (i->>'quantity')::numeric; price := (i->>'unit_price')::numeric; rate := coalesce((i->>'vat_rate')::numeric,0);
    if qty is null or qty <= 0 or qty > 10000 or qty <> round(qty,2)
      or price is null or price < 0 or price > 1000000 or price <> round(price,2)
      or rate < 0 or rate > 100 then raise exception 'Quantite, prix ou TVA invalide.'; end if;
    v_subtotal := v_subtotal + qty * price;
    vat := vat + qty * price * rate / 100;
  end loop;
  gross := round(v_subtotal + vat,2);
  if v_discount >= gross then raise exception 'Le total des prestations doit etre positif.'; end if;
  num := coalesce(nullif(btrim(p_quote->>'quote_number'),''), q.quote_number);
  if num is null then num := public.next_document_number('quote'); end if;
  if length(num)>80 then raise exception 'Numero de devis invalide.'; end if;
  insert into public.quote_parts_baskets(quote_id,requires_parts,supplier_url,recommended_parts,price_details,price_observed_at,product_cards)
    values(q.id,(p_basket->>'requires_parts')::boolean,nullif(btrim(p_basket->>'supplier_url'),''),coalesce(btrim(p_basket->>'recommended_parts'),''),coalesce(btrim(p_basket->>'price_details'),''),nullif(p_basket->>'price_observed_at','')::date,coalesce(p_basket->'product_cards','[]'::jsonb))
    on conflict(quote_id) do update set requires_parts=excluded.requires_parts,supplier_url=excluded.supplier_url,recommended_parts=excluded.recommended_parts,price_details=excluded.price_details,price_observed_at=excluded.price_observed_at,product_cards=excluded.product_cards
    returning quote_parts_baskets.revision into revision;
  delete from public.quote_items where quote_id = q.id;
  for i in select value from jsonb_array_elements(p_items) loop
    insert into public.quote_items(quote_id,item_type,designation,description,quantity,unit_price,vat_rate,purchase_total,purchase_mode,display_order)
      values(q.id,i->>'item_type',btrim(i->>'designation'),coalesce(nullif(btrim(i->>'description'),''),btrim(i->>'designation')),
        (i->>'quantity')::numeric,(i->>'unit_price')::numeric,coalesce((i->>'vat_rate')::numeric,0),0,'customer_supplied',idx);
    idx := idx + 1;
  end loop;
  update public.quotes set quote_number=num,title=btrim(p_quote->>'title'),description=nullif(btrim(p_quote->>'description'),''),
    subtotal=round(v_subtotal,2),discount=v_discount,total=gross-v_discount,valid_until=nullif(p_quote->>'valid_until','')::date,
    visible_to_client=false,pdf_path=null,updated_at=now() where id=q.id;
  return jsonb_build_object('id',q.id,'revision',revision,'quote_number',num,'total',gross-v_discount);
end;
$function$;
