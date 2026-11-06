// ข้อมูลสมมติใน loopback เท่านั้น; L2 ที่ seed ไม่ใช่การอ้างผลลัพธ์ของคน/องค์กรจริง
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { localRuntime } from "./local-runtime.ts";
import { privateJson } from "./validation-runtime.ts";
const r = localRuntime();
if (new URL(r.apiUrl).port !== "54321" || new URL(r.dbUrl).port !== "54322") throw Error("S5 local fixture guard");
execFileSync(process.execPath, ["scripts/seed-s4-fixtures.mjs"], { stdio: "pipe", timeout: 240000 });
const f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8"));
f.s5Run = "s5" + randomBytes(6).toString("hex"); f.reportSubjects = []; f.reportOutcomes = [];
const save = () => privateJson(".local/s5-fixtures.json", f), db = new pg.Client({ connectionString: r.dbUrl });
const admin = createClient(r.apiUrl, r.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
await db.connect();
try {
  if ((await db.query("select count(*)::int n from auth.users where email is null or email not like '%@example.test'")).rows[0].n) throw Error("S5 synthetic identities guard");
  await db.query("update private.s5_release set navigator=true,impact=true where singleton");
  const current = new Date(); current.setUTCDate(1); current.setUTCHours(0, 0, 0, 0);
  f.reportMonths = [1, 2, 3, 4].map(back => { const d = new Date(current); d.setUTCMonth(d.getUTCMonth() - back); return d.toISOString().slice(0, 10); });
  for (let i = 0; i < 12; i++) {
    const email = `${f.s5Run}-${i}@example.test`, password = "S5-" + randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { goos_s5_fixture_run: f.s5Run } });
    if (made.error) throw Error("S5 synthetic identity");
    const account = made.data.user.id, c = createClient(r.apiUrl, r.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if ((await c.auth.signInWithPassword({ email, password })).error) throw Error("S5 synthetic login");
    const boot = await c.rpc("goos_bootstrap_account", { p_locale: "en" }); if (boot.error) throw Error("S5 bootstrap");
    const profile = await c.rpc("goos_create_profile", { p_display_alias: "Synthetic aggregate person " + i, p_country_code: "TH", p_age_band: "adult", p_notice_id: "00000000-0000-4000-8000-000000000002", p_confirmed: true });
    if (profile.error) throw Error("S5 profile");
    const subject = profile.data, application = randomUUID(), caseId = randomUUID(), consent = randomUUID();
    f.reportSubjects.push({ account, subject, application, caseId }); save();
    await db.query("begin");
    try {
      await db.query("insert into app.applications select(jsonb_populate_record(null::app.applications,to_jsonb(a)||jsonb_build_object('id',$1::text,'subject_id',$2::text,'actor_id',$3::text,'receipt_code',$4::text))).* from app.applications a where id=$5", [application, subject, account, randomUUID(), f.sourceApplication]);
      await db.query("insert into app.cases select(jsonb_populate_record(null::app.cases,to_jsonb(c)||jsonb_build_object('id',$1::text,'application_id',$2::text,'subject_id',$3::text))).* from app.cases c where id=$4", [caseId, application, subject, f.sourceCase]);
      await db.query("insert into private.s3_consents select(jsonb_populate_record(null::private.s3_consents,to_jsonb(c)||jsonb_build_object('id',$1::text,'subject_id',$2::text,'actor_id',$3::text))).* from private.s3_consents c join app.resource_shares s on s.consent_id=c.id where s.application_id=$4 and s.response_id is null", [consent, subject, account, f.sourceApplication]);
      await db.query("insert into app.resource_shares select(jsonb_populate_record(null::app.resource_shares,to_jsonb(s)||jsonb_build_object('id',$1::text,'application_id',$2::text,'subject_id',$3::text,'consent_id',$4::text))).* from app.resource_shares s where application_id=$5 and response_id is null", [randomUUID(), application, subject, consent, f.sourceApplication]);
      for (let m = 0; m < 4; m++) {
        if (m === 1 && i >= 9 || m === 3 && i >= 10) continue;
        const date = f.reportMonths[m], start = date.slice(0, 8) + "02", end = date.slice(0, 8) + "03";
        const kinds = m === 2 && i < 10 ? ["service_delivered", "job_started"] : m === 3 ? ["service_delivered", "skills_completed"] : ["service_delivered"];
        for (const kind of kinds) {
          const id = randomUUID();
          await db.query("insert into private.s4_outcomes(id,source_case_id,subject_id,organization_id,kind,period_start,period_end,occurred_at,reporter_id,tier,state,encrypted_body,confirmed,reviewed_by,reviewer_id) values($1,$2,$3,$4,$5,$6,$7,$7::date::timestamptz,$8,'L2','verified',private.goos_s3_encrypt('{\"body\":\"Synthetic aggregate fixture only\"}'::jsonb),true,$9,$9)", [id, caseId, subject, f.org, kind, start, end, f.actors.worker.id, f.actors.impact.id]);
          f.reportOutcomes.push({ id, subject, month: date, kind });
        }
      }
      if (i < 10) {
        const app2 = randomUUID(), case2 = randomUUID(), consent2 = randomUUID();
        await db.query("insert into app.applications select(jsonb_populate_record(null::app.applications,to_jsonb(a)||jsonb_build_object('id',$1::text,'subject_id',$2::text,'actor_id',$3::text,'receipt_code',$4::text,'organization_id',$5::text,'opportunity_id',$6::text,'revision_id',p.approved_revision_id))).* from app.applications a cross join app.opportunities p where a.id=$7 and p.id=$6::uuid", [app2, subject, account, randomUUID(), f.foreignOrg, f.targetListing, f.sourceApplication]);
        await db.query("insert into app.cases select(jsonb_populate_record(null::app.cases,to_jsonb(c)||jsonb_build_object('id',$1::text,'application_id',$2::text,'subject_id',$3::text,'organization_id',$4::text))).* from app.cases c where id=$5", [case2, app2, subject, f.foreignOrg, f.sourceCase]);
        await db.query("insert into private.s3_consents select(jsonb_populate_record(null::private.s3_consents,to_jsonb(c)||jsonb_build_object('id',$1::text,'subject_id',$2::text,'actor_id',$3::text,'recipient_org_id',$4::text))).* from private.s3_consents c join app.resource_shares s on s.consent_id=c.id where s.application_id=$5 and s.response_id is null", [consent2, subject, account, f.foreignOrg, f.sourceApplication]);
        await db.query("insert into app.resource_shares select(jsonb_populate_record(null::app.resource_shares,to_jsonb(s)||jsonb_build_object('id',$1::text,'application_id',$2::text,'subject_id',$3::text,'consent_id',$4::text,'recipient_org_id',$5::text))).* from app.resource_shares s where application_id=$6 and response_id is null", [randomUUID(), app2, subject, consent2, f.foreignOrg, f.sourceApplication]);
        const date = f.reportMonths[0];
        await db.query("insert into private.s4_outcomes(source_case_id,subject_id,organization_id,kind,period_start,period_end,occurred_at,reporter_id,tier,state,encrypted_body,confirmed,reviewed_by,reviewer_id) values($1,$2,$3,'service_delivered',$4,$5,$5::date::timestamptz,$6,'L2','verified',private.goos_s3_encrypt('{\"body\":\"Synthetic overlapping organization fixture\"}'::jsonb),true,$7,$7)", [case2, subject, f.foreignOrg, date.slice(0, 8) + "02", date.slice(0, 8) + "03", f.actors.replacement.id, f.actors.impact.id]);
      }
      if (i === 0) {
        const boundary = new Date(f.reportMonths[0]); boundary.setUTCMonth(boundary.getUTCMonth() + 1); boundary.setUTCDate(0); const date = boundary.toISOString().slice(0, 10);
        await db.query("insert into private.s4_outcomes(source_case_id,subject_id,organization_id,kind,period_start,period_end,occurred_at,reporter_id,tier,state,encrypted_body,confirmed,reviewed_by,reviewer_id) values($1,$2,$3,'service_delivered',$4,$4,$5,$6,'L2','verified',private.goos_s3_encrypt('{\"body\":\"Synthetic UTC boundary and distinct-person duplicate\"}'::jsonb),true,$7,$7)", [caseId, subject, f.org, date, date + "T23:30:00Z", f.actors.worker.id, f.actors.impact.id]);
      }
      await db.query("commit");
    } catch (e) { await db.query("rollback"); throw e; }
  }
  save(); console.log("S5 synthetic corpus/report fixtures ready; no real partner or impact claim; credentials remain in ignored local files");
} finally { await db.end(); }
