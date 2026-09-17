import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260916215104_gap_analysis_atomic_results.sql',import.meta.url),'utf8');
const baseline=fs.readFileSync(new URL('../supabase/migrations/20260910133310_regbrain_initial_schema_and_secure_demo.sql',import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222';
const token='33333333-3333-4333-8333-333333333333', rival='44444444-4444-4444-8444-444444444444';
const gapId='55555555-5555-4555-8555-555555555555';

test('analysis persistence is atomic, fenced and service-only',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  for(const table of ['compliance_assessments','identified_gaps','action_plans']) {
    const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`));
    assert.ok(ddl,table);await db.exec(ddl[0]);
  }
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    alter table public.compliance_assessments add column analysis_progress jsonb, add column requirement_checks jsonb;
    alter table public.identified_gaps add column source_chunk_id uuid, add column article_text_excerpt text,
      add column detection_method text, add column evidence jsonb, add column coverage_status text, add column severity text;
    create table public.assessment_requirement_checks (
      assessment_id uuid references public.compliance_assessments(id), requirement_id text not null, check_payload jsonb not null,
      primary key(assessment_id,requirement_id));
    grant usage on schema public to service_role, anon, authenticated;
    grant all on all tables in schema public to service_role;`);
  await db.exec(migration);
  await db.query(`insert into public.compliance_assessments(id,user_id,title,assessment_type,scope_jurisdiction,scope_sector)
    values ($1,$2,'test','gap_analysis','IT','test')`,[id,user]);
  const acquire=(tok=token,u=user)=>db.query('select public.acquire_gap_analysis_lease($1,$2,$3) as acquired',[id,u,tok]);
  const state={total:1,done:1,pending:[],status:'in_progress'};
  const checks=[{requirement_id:'r',status:'missing'}];
  const save=(items=checks,tok=token)=>db.query('select public.save_gap_analysis_progress($1,$2,$3,$4)',[id,tok,JSON.stringify(state),JSON.stringify(items)]);
  const gap={id:gapId,requirement_reference:'Articolo 30 GDPR',requirement_description:'Registro',current_state:'assente',gap_description:'manca',risk_level:'high',risk_score:74,priority:1,remediation_effort:'medium',recommended_actions:[{action:'Compilare il registro'}],source_chunk_id:null,evidence:[],coverage_status:'missing',severity:'high'};
  const finish=(g=gap,p=state,tok=token)=>db.query('select public.finalize_gap_analysis($1,$2,$3,$4,$5,$6,$7)',[id,tok,JSON.stringify({checks}),JSON.stringify({...p,status:'completed'}),JSON.stringify([g]),74,0]);
  const counts=async()=> (await db.query(`select
    (select count(*)::int from public.identified_gaps) as gaps,
    (select count(*)::int from public.action_plans) as actions,
    (select count(*)::int from public.assessment_requirement_checks) as staged,
    (select status from public.compliance_assessments where id='${id}') as status`)).rows[0];
  await t.test('anon and authenticated cannot invoke persistence or read leases',async()=>{
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(acquire(),/permission denied/);
      await assert.rejects(save(),/permission denied/);
      await assert.rejects(finish(),/permission denied/);
      await assert.rejects(db.query('select * from public.gap_analysis_leases'),/permission denied/);
      await db.exec('reset role');
    }
  });
  await db.exec('set role service_role');
  await t.test('ownership is checked and only one worker acquires the lease',async()=>{
    await assert.rejects(acquire(token,rival),/Assessment not found/);
    const results=await Promise.all([acquire(),acquire(rival)]);
    assert.deepEqual(results.map(r=>r.rows[0].acquired),[true,false]);
  });
  await t.test('checkpoint failure does not advance state or partially save checks',async()=>{
    await assert.rejects(save([...checks,{status:'missing'}]),/null value/);
    assert.equal((await counts()).staged,0);
    assert.equal((await db.query('select analysis_progress from public.compliance_assessments')).rows[0].analysis_progress,null);
    await save();assert.equal((await counts()).staged,1);
    await save();assert.equal((await counts()).staged,1);
  });
  await t.test('failure while creating an action rolls back gaps and keeps staging',async()=>{
    await db.query(`insert into public.identified_gaps (id,assessment_id,requirement_reference,requirement_description,gap_description,risk_level,risk_score,priority)
      values ($1,$2,'previous','previous','previous','low',28,3)`,[rival,id]);
    await db.query(`insert into public.action_plans (assessment_id,gap_id,title,description,priority) values ($1,$2,'previous','previous',3)`,[id,rival]);
    await assert.rejects(finish({...gap,recommended_actions:[{}]}),/null value/);
    assert.deepEqual(await counts(),{gaps:1,actions:1,staged:1,status:'in_progress'});
    assert.equal((await db.query('select id from public.identified_gaps')).rows[0].id,rival);
  });
  await t.test('incomplete results and obsolete worker tokens are rejected',async()=>{
    await assert.rejects(finish(gap,{...state,total:2}),/Incomplete/);
    await assert.rejects(finish(gap,{...state,pending:['other']}),/Incomplete/);
    await assert.rejects(save(checks,rival),/lease expired/);
    await assert.rejects(finish(gap,state,rival),/lease expired/);
  });
  await t.test('expired lease can be recovered, fencing the original worker',async()=>{
    await db.query("update public.gap_analysis_leases set expires_at=clock_timestamp()-interval '1 second'");
    assert.equal((await acquire(rival)).rows[0].acquired,true);
    await assert.rejects(save(),/lease expired/);
    await assert.rejects(finish(),/lease expired/);
    await db.query("update public.gap_analysis_leases set expires_at=clock_timestamp()-interval '1 second'");
    assert.equal((await acquire()).rows[0].acquired,true);
  });
  await t.test('successful completion writes results and actions before clearing staging',async()=>{
    await finish();
    assert.deepEqual(await counts(),{gaps:1,actions:1,staged:0,status:'completed'});
    assert.equal((await db.query('select id from public.identified_gaps')).rows[0].id,gapId);
    assert.equal((await db.query('select gap_id from public.action_plans')).rows[0].gap_id,gapId);
    await assert.rejects(finish(),/Incomplete/);
    assert.deepEqual(await counts(),{gaps:1,actions:1,staged:0,status:'completed'});
  });
});
