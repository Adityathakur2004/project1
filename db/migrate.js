import dotenv from 'dotenv'
import { promises as fs } from 'fs'
import path from 'path'
import pg from 'pg'
import process from 'process'
import { fileURLToPath } from 'url'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run migrations.')
  process.exit(1)
}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : undefined,
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, 'migrations')

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function run() {
  await ensureMigrationsTable()
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  const appliedResult = await pool.query('SELECT filename FROM schema_migrations')
  const applied = new Set(appliedResult.rows.map((row) => row.filename))

  for (const file of files) {
    if (applied.has(file)) continue

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
    console.log(`Applying migration ${file}...`)
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await pool.query('COMMIT')
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  }

  console.log('Migrations complete.')
  await pool.end()
}

run().catch(async (error) => {
  console.error(error)
  await pool.end()
  process.exit(1)
})
