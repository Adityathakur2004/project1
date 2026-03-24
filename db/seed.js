import dotenv from 'dotenv'
import { promises as fs } from 'fs'
import path from 'path'
import pg from 'pg'
import process from 'process'
import { fileURLToPath } from 'url'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to seed Postgres.')
  process.exit(1)
}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : undefined,
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const dataDir = path.join(projectRoot, 'data')

const resetMode = process.argv.includes('--reset')

async function readSeedJson(filename) {
  const raw = await fs.readFile(path.join(dataDir, filename), 'utf8')
  return JSON.parse(raw)
}

async function assertSchemaReady() {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users_normalized',
        'students_normalized',
        'student_subjects',
        'student_interventions',
        'student_assignments',
        'invites_normalized'
      )
  `)

  if (result.rows.length < 6) {
    throw new Error('Normalized tables are missing. Run `npm run migrate` first.')
  }
}

async function run() {
  await assertSchemaReady()

  const [users, students, invites] = await Promise.all([
    readSeedJson('users.json'),
    readSeedJson('students.json'),
    readSeedJson('invites.json'),
  ])

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (resetMode) {
      await client.query('DELETE FROM invites_normalized')
      await client.query('DELETE FROM student_assignments')
      await client.query('DELETE FROM student_interventions')
      await client.query('DELETE FROM student_subjects')
      await client.query('DELETE FROM students_normalized')
      await client.query('DELETE FROM users_normalized')
    }

    for (const user of users) {
      await client.query(
        `INSERT INTO users_normalized (id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role`,
        [user.id, user.name, user.email, user.passwordHash, user.role],
      )
    }

    for (const student of students) {
      await client.query(
        `INSERT INTO students_normalized (
          id, name, target, class_level, city, study_hours, revision_hours, mock_score,
          attendance, consistency, practice_tests, syllabus_completion, status, priority,
          next_review_date, mentor_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          NULLIF($15, '')::date, $16
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          target = EXCLUDED.target,
          class_level = EXCLUDED.class_level,
          city = EXCLUDED.city,
          study_hours = EXCLUDED.study_hours,
          revision_hours = EXCLUDED.revision_hours,
          mock_score = EXCLUDED.mock_score,
          attendance = EXCLUDED.attendance,
          consistency = EXCLUDED.consistency,
          practice_tests = EXCLUDED.practice_tests,
          syllabus_completion = EXCLUDED.syllabus_completion,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          next_review_date = EXCLUDED.next_review_date,
          mentor_notes = EXCLUDED.mentor_notes,
          updated_at = NOW()`,
        [
          student.id,
          student.name,
          student.target,
          student.classLevel,
          student.city,
          student.studyHours,
          student.revisionHours,
          student.mockScore,
          student.attendance,
          student.consistency,
          student.practiceTests,
          student.syllabusCompletion,
          student.status,
          student.priority,
          student.nextReviewDate || '',
          student.mentorNotes || '',
        ],
      )

      await client.query('DELETE FROM student_subjects WHERE student_id = $1', [student.id])
      await client.query('DELETE FROM student_interventions WHERE student_id = $1', [student.id])

      for (const subject of student.subjects ?? []) {
        await client.query(
          `INSERT INTO student_subjects (student_id, name, score, benchmark, chapters_done, total_chapters, weak_topic)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            student.id,
            subject.name,
            subject.score,
            subject.benchmark,
            subject.chaptersDone,
            subject.totalChapters,
            subject.weakTopic,
          ],
        )
      }

      for (const intervention of student.interventions ?? []) {
        await client.query(
          `INSERT INTO student_interventions (id, student_id, title, status, owner, due_date, impact, notes)
           VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             status = EXCLUDED.status,
             owner = EXCLUDED.owner,
             due_date = EXCLUDED.due_date,
             impact = EXCLUDED.impact,
             notes = EXCLUDED.notes`,
          [
            intervention.id,
            student.id,
            intervention.title,
            intervention.status,
            intervention.owner,
            intervention.dueDate || '',
            intervention.impact,
            intervention.notes,
          ],
        )
      }
    }

    await client.query('DELETE FROM student_assignments')
    for (const user of users) {
      for (const studentId of user.studentIds ?? []) {
        await client.query(
          `INSERT INTO student_assignments (student_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, user_id) DO NOTHING`,
          [studentId, user.id],
        )
      }
    }

    if (resetMode) {
      await client.query('DELETE FROM invites_normalized')
    }

    for (const invite of invites) {
      await client.query(
        `INSERT INTO invites_normalized (id, token, email, name, role, student_id, status, created_at, created_by, accepted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(NULLIF($8, '')::timestamptz, NOW()), $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           token = EXCLUDED.token,
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           student_id = EXCLUDED.student_id,
           status = EXCLUDED.status,
           created_at = EXCLUDED.created_at,
           created_by = EXCLUDED.created_by,
           accepted_by = EXCLUDED.accepted_by`,
        [
          invite.id,
          invite.token,
          invite.email,
          invite.name || '',
          invite.role,
          invite.studentId,
          invite.status,
          invite.createdAt || '',
          invite.createdBy || '',
          invite.acceptedBy || '',
        ],
      )
    }

    await client.query('COMMIT')
    console.log(
      `Seed complete. Users: ${users.length}, students: ${students.length}, invites: ${invites.length}, reset: ${resetMode}`,
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(async (error) => {
  console.error(error)
  await pool.end()
  process.exit(1)
})
