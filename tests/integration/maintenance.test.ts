import { it, expect } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { login, mfa, runtime } from "./helpers";
import { createClient } from "@supabase/supabase-js";
it("machine processes quarantine, erases original bytes, and cannot read application packages", async () => {
  const email = "maintenance-" + randomUUID() + "@example.test",
    password = randomUUID() + randomUUID();
  const admin = createClient(runtime.apiUrl, runtime.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { goos_fixture_run: "maintenance-acl" },
  });
  expect(createdUser.error).toBeNull();
  const actor = { email, password, id: createdUser.data.user!.id };
  const owner = await login(actor);
  expect(
    (await owner.rpc("goos_bootstrap_account", { p_locale: "en" })).error,
  ).toBeNull();
  await mfa(owner);
  const created = await owner.rpc("goos_create_organization", {
    p_name: "Synthetic worker ACL",
    p_country_code: "TH",
  });
  expect(created.error).toBeNull();
  const c = new pg.Client({ connectionString: runtime.dbUrl });
  await c.connect();
  try {
    await c.query("begin");
    const id = randomUUID();
    await c.query(
      "insert into private.org_evidence(id,organization_id,uploaded_by,status,original_body)values($1,$2,$3,'quarantined',$4)",
      [
        id,
        created.data,
        actor.id,
        readFileSync("public/brand-defaults/favicon.png"),
      ],
    );
    await c.query("set local role goos_worker");
    expect(
      (
        await c.query(
          "select id,original_body from private.org_evidence where id=$1",
          [id],
        )
      ).rowCount,
    ).toBe(1);
    await c.query(
      "update private.org_evidence set status='rejected',original_body=null,safe_body=null,processed_at=now(),inspection='png-rejected-v1' where id=$1",
      [id],
    );
    expect(
      (
        await c.query(
          "select original_body from private.org_evidence where id=$1",
          [id],
        )
      ).rows[0].original_body,
    ).toBeNull();
    await c.query("savepoint deny");
    await expect(
      c.query("select * from private.application_packages"),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await c.query("rollback");
    await c.end();
  }
});
