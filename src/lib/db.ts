import { mkdir, readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

function limpiarUrl(raw: string) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return raw.replace(/([?&])channel_binding=[^&]*/g, "$1").replace(/[?&]$/, "");
  }
}

const databaseUrl = limpiarUrl(process.env.DATABASE_URL?.trim() ?? "");
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  await mkdir(".data", { recursive: true });
  const db = new PGlite(".data/pglite");
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}
