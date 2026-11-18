import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { Pool, PoolClient } from "pg";

const usePostgres = Boolean(process.env.DATABASE_URL);

const sqlite = usePostgres
  ? null
  : new Database(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "devin-router.db"));

const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

export type QueryResult = {
  rows: any[];
  rowCount: number | null;
};

export type DbClient = {
  query(sql: string, params?: any[]): Promise<QueryResult>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<QueryResult>;
};

function toPostgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    connector_username TEXT UNIQUE NOT NULL,
    connector_password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'openai-chat',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    device_type TEXT DEFAULT 'windows',
    connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    device_id TEXT,
    provider_name TEXT,
    model TEXT,
    status TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    selected_provider_id TEXT,
    selected_model_id TEXT,
    website_url TEXT DEFAULT 'https://devin-router.uppcoder.com',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);
  CREATE INDEX IF NOT EXISTS idx_models_user ON models(user_id);
  CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_user ON request_logs(user_id);
`;

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    connector_username TEXT UNIQUE NOT NULL,
    connector_password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'openai-chat',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_type TEXT DEFAULT 'windows',
    connected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS request_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT,
    provider_name TEXT,
    model TEXT,
    status TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_provider_id TEXT,
    selected_model_id TEXT,
    website_url TEXT DEFAULT 'https://devin-router.uppcoder.com',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);
  CREATE INDEX IF NOT EXISTS idx_models_user ON models(user_id);
  CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_user ON request_logs(user_id);
`;

async function initializeDatabase() {
  if (usePostgres) {
    if (!pool) throw new Error("PostgreSQL pool unavailable");
    await pool.query(postgresSchema);
    return;
  }
  if (!sqlite) throw new Error("SQLite database unavailable");
  fs.mkdirSync(path.dirname(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "devin-router.db")), { recursive: true });
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(sqliteSchema);
}

const ready = initializeDatabase();

async function query(sql: string, params: any[] = []): Promise<QueryResult> {
  await ready;
  if (usePostgres) {
    if (!pool) throw new Error("PostgreSQL pool unavailable");
    const result = await pool.query(toPostgresSql(sql), params);
    return { rows: result.rows, rowCount: result.rowCount ?? null };
  }
  if (!sqlite) throw new Error("SQLite database unavailable");
  const statement = sqlite.prepare(sql);
  if (statement.reader) {
    const rows = statement.all(...params) as any[];
    return { rows, rowCount: rows.length };
  }
  const info = statement.run(...params);
  return { rows: [], rowCount: Number(info.changes) };
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await query(sql, params);
  return result.rows as T[];
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function run(sql: string, params: any[] = []) {
  return query(sql, params);
}

export async function transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  await ready;
  if (usePostgres) {
    if (!pool) throw new Error("PostgreSQL pool unavailable");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const wrapped: DbClient = {
        query: async (sql, params = []) => {
          const result = await client.query(toPostgresSql(sql), params);
          return { rows: result.rows, rowCount: result.rowCount ?? null };
        },
        all: async <T>(sql: string, params: any[] = []) => {
          const result = await client.query(toPostgresSql(sql), params);
          return result.rows as T[];
        },
        get: async <T>(sql: string, params: any[] = []) => {
          const result = await client.query(toPostgresSql(sql), params);
          return result.rows[0] as T | undefined;
        },
        run: async (sql: string, params: any[] = []) => {
          const result = await client.query(toPostgresSql(sql), params);
          return { rows: result.rows, rowCount: result.rowCount ?? null };
        },
      };
      const value = await callback(wrapped);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  if (!sqlite) throw new Error("SQLite database unavailable");
  sqlite.exec("BEGIN");
  const wrapped: DbClient = {
    query: async (sql, params = []) => {
      const statement = sqlite.prepare(sql);
      if (statement.reader) {
        const rows = statement.all(...params) as any[];
        return { rows, rowCount: rows.length };
      }
      const info = statement.run(...params);
      return { rows: [], rowCount: Number(info.changes) };
    },
    all: async <T>(sql: string, params: any[] = []) => {
      const statement = sqlite.prepare(sql);
      return statement.all(...params) as T[];
    },
    get: async <T>(sql: string, params: any[] = []) => {
      const statement = sqlite.prepare(sql);
      return statement.get(...params) as T | undefined;
    },
    run: async (sql: string, params: any[] = []) => {
      const statement = sqlite.prepare(sql);
      const info = statement.run(...params);
      return { rows: [], rowCount: Number(info.changes) };
    },
  };
  try {
    const value = await callback(wrapped);
    sqlite.exec("COMMIT");
    return value;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export default { all, get, run, transaction };
