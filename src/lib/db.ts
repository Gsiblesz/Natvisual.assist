import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
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
let listoPg: Promise<void> | undefined;
let local: Promise<PGlite> | undefined;

async function archivosMigracion() {
  const carpeta = path.join(process.cwd(), "migrations");
  const files = (await readdir(carpeta).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return { carpeta, files };
}

// Aplica las migraciones pendientes la primera vez que esta instancia toca Postgres.
// No corre en el build: corre al arrancar, con un candado para que dos instancias no choquen.
async function migrarPg(p: pg.Pool) {
  const { carpeta, files } = await archivosMigracion();
  if (!files.length) return;
  const client = await p.connect();
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const hechas = new Set(
      (await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
    );
    const pendientes = files.filter((f) => !hechas.has(f));
    if (!pendientes.length) return;
    await client.query("select pg_advisory_lock(7272741)");
    try {
      const otra = new Set(
        (await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
      );
      for (const file of pendientes.filter((f) => !otra.has(f))) {
        await client.query("begin");
        try {
          await client.query(await readFile(path.join(carpeta, file), "utf8"));
          await client.query("insert into schema_migrations (name) values ($1)", [file]);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      }
    } finally {
      await client.query("select pg_advisory_unlock(7272741)");
    }
  } finally {
    client.release();
  }
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    listoPg ??= migrarPg(pool).catch((error: unknown) => {
      listoPg = undefined;
      throw error;
    });
    await listoPg;
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
  const { carpeta, files } = await archivosMigracion();
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(path.join(carpeta, file), "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}
