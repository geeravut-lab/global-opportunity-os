import pg from "pg";
import { localRuntime } from "../../scripts/local-runtime";

// S1 runs with the same default-off S4 DB gate as its app flags; S4's own suite tests the enabled matrix.
export default async function setup() {
  const runtime = localRuntime();
  if (new URL(runtime.dbUrl).port !== "54322")
    throw Error("S1 browser setup requires the guarded original local stack");
  const db = new pg.Client({ connectionString: runtime.dbUrl });
  await db.connect();
  let enabled = false;
  try {
    const rows = await db.query(
      "select enabled from private.s4_release where singleton",
    );
    enabled = rows.rows[0]?.enabled === true;
    await db.query(
      "update private.s4_release set enabled=false where singleton",
    );
  } finally {
    await db.end();
  }
  return async () => {
    const restore = new pg.Client({ connectionString: runtime.dbUrl });
    await restore.connect();
    try {
      await restore.query(
        "update private.s4_release set enabled=$1 where singleton",
        [enabled],
      );
    } finally {
      await restore.end();
    }
  };
}
