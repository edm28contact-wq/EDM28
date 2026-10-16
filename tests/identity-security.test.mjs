import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL('../'+path,import.meta.url),'utf8');

test('new accounts have server-side duplicate identity protection',async()=>{
 const sql=await file('supabase/migrations/20261016073000_unique_customer_identity.sql');
 assert.match(sql,/CREATE TRIGGER edm28_guard_profile_identity/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OF first_name,last_name,phone,email/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/edm28_identity_duplicate_name/);
 assert.match(sql,/edm28_identity_duplicate_phone/);
 assert.match(sql,/edm28_identity_duplicate_email/);
 assert.match(sql,/CREATE TRIGGER edm28_protect_profile_role/);
 assert.match(sql,/BEFORE UPDATE OF role,id/);
 assert.doesNotMatch(sql,/DELETE FROM public\.profiles/);
});

test('signup hides which existing identity caused a collision',async()=>{
 const src=await file('public-client.js');
 assert.match(src,/database error saving new user/);
 assert.match(src,/Inscription impossible avec ces coordonnées/);
 assert.match(src,/Mot de passe oublié/);
});
