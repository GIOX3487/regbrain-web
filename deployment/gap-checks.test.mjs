import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuote, quoteIsVerified, verifyEvidence, regulationGateExcludes, applicabilityVerdict, normalizeModelCheck} from '../supabase/functions/_shared/gap-checks.ts';
import {generateCacheFingerprint} from '../supabase/functions/_shared/gap-cache.ts';
import {findRegulatorySource, loadRegulatorySources} from '../supabase/functions/_shared/gap-sources.ts';
import {formatComplianceScore} from '../src/lib/compliance-score.ts';
const text='Il registro contiene finalità categorie di dati e termini di conservazione.';
const docs=[{name:'registro.pdf',content:text},{name:'altro.pdf',content:'Un documento con un contenuto del tutto diverso.'}];
const req={id:'r',regulation:'GDPR',reference:'Articolo 44 GDPR',description_it:'trasferimenti in paesi terzi',risk_level:'high',conditional:true,coverage_keywords:[],recommended_action_it:'Documentare le garanzie.'};
const base={requirement_id:'r',regulation:'GDPR',reference:req.reference,description:req.description_it,severity:'high',remediation_effort:'medium',conditional:true,applicability_note:null,keyword_coverage:0};
const check=(output,profile=null,r=req)=>normalizeModelCheck(r,output,profile,docs,true,base);
test('quotes are attributed to the existing, unique source document',()=>{
  assert.equal(verifyEvidence([{document:'registro.pdf',quote:text}],docs).length,1);
  for(const name of ['altro.pdf','inventato.pdf']) assert.deepEqual(verifyEvidence([{document:name,quote:text}],docs),[]);
  assert.deepEqual(verifyEvidence([{document:'registro.pdf',quote:text}],[...docs,docs[0]]),[]);
});
test('short fabricated segments, reversed order and word fragments fail validation',()=>{
  const corpus=normalizeQuote(text);
  assert.equal(quoteIsVerified(text+' [...] tutto cifrato',corpus),false);
  assert.equal(quoteIsVerified('Il registro contiene [...] termini di conservazione',corpus),true);
  assert.equal(quoteIsVerified('termini di conservazione [...] Il registro contiene',corpus),false);
  assert.equal(quoteIsVerified('registro contiene finalità categorie di dati e termini di conserva',corpus),false);
});
test('declared applicability overrides an unsupported model exclusion',()=>{
  const result=check({status:'not_applicable',applicability:'no',evidence:[]},{answers:{gdpr_transfers:'si'}});
  assert.equal(result.status,'to_verify');assert.equal(result.applicability,'si');assert.equal(result.risk_level,null);
});
test('exclusions require valid evidence and known applicability',()=>{
  assert.equal(check({status:'not_applicable',applicability:'no',evidence:[]}).status,'to_verify');
  assert.equal(check({status:'not_applicable',applicability:'no',evidence:[{document:'registro.pdf',quote:text}]},{answers:{gdpr_transfers:'non_so'}}).status,'to_verify');
  assert.equal(check({status:'not_applicable',applicability:'no',evidence:[{document:'registro.pdf',quote:text}]}).status,'not_applicable');
});
test('a false covered claim cannot survive an invalid citation',()=>{
  const result=check({status:'covered',applicability:'si',evidence:[{document:'inventato.pdf',quote:text}]},{answers:{gdpr_transfers:'si'}});
  assert.equal(result.status,'to_verify');assert.deepEqual(result.evidence,[]);
});
test('unknown/partial role declarations do not exclude a whole regulation',()=>{
  assert.equal(regulationGateExcludes('AI Act',{answers:{ai_provider:'no'}}),null);
  assert.equal(regulationGateExcludes('AI Act',{answers:{ai_provider:'no',ai_deployer:'non_so',ai_importer_distributor:'no'}}),null);
  assert.ok(regulationGateExcludes('AI Act',{answers:{ai_provider:'no',ai_deployer:'no',ai_importer_distributor:'no'}}));
  assert.equal(regulationGateExcludes('AI Act',{answers:{ai_provider:'no',ai_deployer:'si',ai_importer_distributor:'no'}}),null);
});
test('missing dimensions cannot be inferred as affirmative',()=>{
  const r={...req,regulation:'AI Act',description_it:'Obblighi del fornitore e deployer di sistemi ad alto rischio'};
  assert.equal(applicabilityVerdict(r,{answers:{ai_provider:'no'}}).status,'unknown');
});
const src=(id,reg,header,body='')=>({id,regulation:reg,document_id:reg,content:`[${header}]\n${body}`});
test('source matching requires regulation and exact header article, never body cross references',()=>{
  const sources=[src('ai30','AI Act','AI Act, 32024R1689. Art. 30'),src('gdpr30','GDPR','GDPR, 32016R0679. Art. 30','Si veda Articolo 3'),src('gdpr3','GDPR','GDPR, 32016R0679. Art. 3')];
  assert.equal(findRegulatorySource('Articolo 3 GDPR','GDPR',sources).chunk_id,'gdpr3');
  assert.equal(findRegulatorySource('Articolo 3 GDPR','GDPR',sources.slice(0,2)).chunk_id,null);
  assert.equal(findRegulatorySource('Articolo 21 D.Lgs. 138/2024','NIS2',sources).chunk_id,null);
});
test('source reads paginate beyond the API limit and propagate errors',async()=>{
  const chunks=Array.from({length:1201},(_,i)=>({id:String(i),document_id:'doc',content:'text'}));let reads=0;
  const db={from(table){const q={select(){return q},eq(){return q},ilike(){return q},order(){return q},async range(a,b){reads++;return {data:(table==='documents'?[{id:'doc'}]:chunks).slice(a,b+1)}}};return q}};
  assert.equal((await loadRegulatorySources(db,['GDPR'])).length,1201);assert.equal(reads,4);
  const bad={from(){const q={select(){return q},eq(){return q},ilike(){return q},order(){return q},range(){return {error:new Error('unavailable')}}};return q}};
  await assert.rejects(loadRegulatorySources(bad,['GDPR']),/unavailable/);
});
test('cache tracks size, requirement definition, model, and is stable under answer ordering',async()=>{
  const hash=(r=req,p={answers:{},size:'micro'},model='m')=>generateCacheFingerprint(['GDPR'],docs,'it',{},null,[r],p,model);
  const original=await hash();
  assert.notEqual(original,await hash(req,{answers:{},size:'large'}));
  assert.notEqual(original,await hash({...req,description_it:'un obbligo diverso'}));
  assert.notEqual(original,await hash(req,undefined,'other-model'));
  assert.equal(await hash(req,{answers:{a:'si',b:'no'}}),await hash(req,{answers:{b:'no',a:'si'}}));
});
test('a missing score is distinct from measured zero',()=>{
  assert.equal(formatComplianceScore(null),'N/D');assert.equal(formatComplianceScore(undefined),'N/D');
  assert.equal(formatComplianceScore(0),'0%');assert.equal(formatComplianceScore(87.5),'88%');
});

test('paragraph references require the same paragraph in the source heading',()=>{
  const sources=[src('p1','GDPR','GDPR, 32016R0679. Art. 30. Par. 1'),src('p2','GDPR','GDPR, 32016R0679. Art. 30. Par. 2')];
  assert.equal(findRegulatorySource('Articolo 30, paragrafo 2 GDPR','GDPR',sources).chunk_id,'p2');
  assert.equal(findRegulatorySource('Articolo 30, paragrafo 3 GDPR','GDPR',sources).chunk_id,null);
});
