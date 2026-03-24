import cors from 'cors'
import dotenv from 'dotenv'
import { Buffer } from 'buffer'
import crypto from 'crypto'
import express from 'express'
import { promises as fs } from 'fs'
import OpenAI from 'openai'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import pg from 'pg'
import process from 'process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const distDir = path.join(__dirname, 'dist')
const studentsFile = path.join(dataDir, 'students.json')
const usersFile = path.join(dataDir, 'users.json')
const invitesFile = path.join(dataDir, 'invites.json')
const app = express()
const port = Number(process.env.PORT || 4000)
const tokenSecret = 'edupilot-local-secret'
const { Pool } = pg

dotenv.config()

function getEnvironmentHealth() {
  return {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    apiBaseConfigured: Boolean(process.env.VITE_API_BASE_URL),
    nodeEnv: process.env.NODE_ENV || 'development',
  }
}

function logEnvironmentWarnings() {
  const envHealth = getEnvironmentHealth()
  const warnings = []

  if (!envHealth.databaseConfigured) {
    warnings.push('DATABASE_URL is not set. EduPilot will run on local JSON fallback storage.')
  }

  if (!envHealth.openaiConfigured) {
    warnings.push('OPENAI_API_KEY is not set. AI-generated reports will use fallback mode.')
  }

  if (envHealth.nodeEnv === 'production' && !envHealth.databaseConfigured) {
    warnings.push('Production mode is active without Postgres. Configure DATABASE_URL before real deployment.')
  }

  warnings.forEach((warning) => {
    console.warn(`[EduPilot config] ${warning}`)
  })
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : undefined,
    })
  : null

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
let normalizedSeedPromise = null

logEnvironmentWarnings()

app.use(cors())
app.use(express.json())

async function ensureFile(filePath, fallback) {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, fallback)
  }
}

async function readJson(filePath, fallback = '[]') {
  await ensureFile(filePath, fallback)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2))
}

async function ensureNormalizedSchema() {
  if (!pool) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users_normalized (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('mentor', 'student', 'parent', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS students_normalized (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target TEXT NOT NULL,
      class_level TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      study_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
      revision_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
      mock_score NUMERIC(8,2) NOT NULL DEFAULT 0,
      attendance NUMERIC(5,2) NOT NULL DEFAULT 0,
      consistency NUMERIC(5,2) NOT NULL DEFAULT 0,
      practice_tests INTEGER NOT NULL DEFAULT 0,
      syllabus_completion NUMERIC(5,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('On Track', 'Watchlist', 'At Risk')),
      priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
      next_review_date DATE,
      mentor_notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS student_subjects (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students_normalized(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      score NUMERIC(5,2) NOT NULL DEFAULT 0,
      benchmark NUMERIC(5,2) NOT NULL DEFAULT 0,
      chapters_done INTEGER NOT NULL DEFAULT 0,
      total_chapters INTEGER NOT NULL DEFAULT 0,
      weak_topic TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS student_interventions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students_normalized(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      due_date DATE,
      impact TEXT NOT NULL CHECK (impact IN ('Low', 'Medium', 'High')),
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS student_assignments (
      id BIGSERIAL PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students_normalized(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users_normalized(id) ON DELETE CASCADE,
      UNIQUE (student_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites_normalized (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
      student_id TEXT NOT NULL REFERENCES students_normalized(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL DEFAULT '',
      accepted_by TEXT NOT NULL DEFAULT ''
    );
  `)
}

function mapStudentRecord(baseRow, subjects, interventions) {
  return {
    id: baseRow.id,
    name: baseRow.name,
    target: baseRow.target,
    classLevel: baseRow.class_level,
    city: baseRow.city,
    studyHours: Number(baseRow.study_hours),
    revisionHours: Number(baseRow.revision_hours),
    mockScore: Number(baseRow.mock_score),
    attendance: Number(baseRow.attendance),
    consistency: Number(baseRow.consistency),
    practiceTests: Number(baseRow.practice_tests),
    syllabusCompletion: Number(baseRow.syllabus_completion),
    status: baseRow.status,
    priority: baseRow.priority,
    nextReviewDate: baseRow.next_review_date || '',
    mentorNotes: baseRow.mentor_notes,
    interventions: interventions
      .filter((item) => item.student_id === baseRow.id)
      .map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        owner: item.owner,
        dueDate: item.due_date || '',
        impact: item.impact,
        notes: item.notes,
      })),
    subjects: subjects
      .filter((item) => item.student_id === baseRow.id)
      .map((item) => ({
        name: item.name,
        score: Number(item.score),
        benchmark: Number(item.benchmark),
        chaptersDone: Number(item.chapters_done),
        totalChapters: Number(item.total_chapters),
        weakTopic: item.weak_topic,
      })),
  }
}

async function seedNormalizedStorage() {
  if (!pool) return
  if (!normalizedSeedPromise) {
    normalizedSeedPromise = (async () => {
      await ensureNormalizedSchema()
      const countResult = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users_normalized) AS users_count,
          (SELECT COUNT(*)::int FROM students_normalized) AS students_count,
          (SELECT COUNT(*)::int FROM invites_normalized) AS invites_count
      `)

      const counts = countResult.rows[0]
      if (counts.users_count > 0 || counts.students_count > 0 || counts.invites_count > 0) return

      const [users, students, invites] = await Promise.all([
        readJson(usersFile),
        readJson(studentsFile),
        readJson(invitesFile),
      ])

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        for (const user of users) {
          await client.query(
            `INSERT INTO users_normalized (id, name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
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
            ON CONFLICT (id) DO NOTHING`,
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
               ON CONFLICT (id) DO NOTHING`,
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

        for (const invite of invites) {
          await client.query(
            `INSERT INTO invites_normalized (id, token, email, name, role, student_id, status, created_at, created_by, accepted_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(NULLIF($8, '')::timestamptz, NOW()), $9, $10)
             ON CONFLICT (id) DO NOTHING`,
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
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    })()
  }

  return normalizedSeedPromise
}

async function listStudents() {
  if (!pool) return readJson(studentsFile)
  await seedNormalizedStorage()

  const [studentResult, subjectResult, interventionResult] = await Promise.all([
    pool.query('SELECT * FROM students_normalized ORDER BY created_at DESC, id'),
    pool.query('SELECT * FROM student_subjects ORDER BY student_id, id'),
    pool.query('SELECT * FROM student_interventions ORDER BY student_id, due_date NULLS LAST, id'),
  ])

  return studentResult.rows.map((row) => mapStudentRecord(row, subjectResult.rows, interventionResult.rows))
}

async function getStudentById(studentId) {
  const students = await listStudents()
  return students.find((student) => student.id === studentId) || null
}

async function saveStudentToNormalized(student) {
  await seedNormalizedStorage()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO students_normalized (
        id, name, target, class_level, city, study_hours, revision_hours, mock_score,
        attendance, consistency, practice_tests, syllabus_completion, status, priority,
        next_review_date, mentor_notes, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        NULLIF($15, '')::date, $16, NOW()
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

    for (const subject of student.subjects) {
      await client.query(
        `INSERT INTO student_subjects (student_id, name, score, benchmark, chapters_done, total_chapters, weak_topic)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [student.id, subject.name, subject.score, subject.benchmark, subject.chaptersDone, subject.totalChapters, subject.weakTopic],
      )
    }

    for (const intervention of student.interventions) {
      await client.query(
        `INSERT INTO student_interventions (id, student_id, title, status, owner, due_date, impact, notes)
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7, $8)`,
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

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return getStudentById(student.id)
}

async function deleteStudentFromStore(studentId) {
  if (!pool) {
    const students = await readJson(studentsFile)
    const nextStudents = students.filter((entry) => entry.id !== studentId)
    if (nextStudents.length === students.length) return false
    await writeJson(studentsFile, nextStudents)
    const users = await readJson(usersFile)
    const nextUsers = users.map((user) => ({
      ...user,
      studentIds: (user.studentIds ?? []).filter((entry) => entry !== studentId),
    }))
    await writeJson(usersFile, nextUsers)
    const invites = await readJson(invitesFile)
    await writeJson(invitesFile, invites.filter((invite) => invite.studentId !== studentId))
    return true
  }

  await seedNormalizedStorage()
  const result = await pool.query('DELETE FROM students_normalized WHERE id = $1', [studentId])
  return result.rowCount > 0
}

async function listUsers() {
  if (!pool) return readJson(usersFile)
  await seedNormalizedStorage()

  const [userResult, assignmentResult] = await Promise.all([
    pool.query('SELECT * FROM users_normalized ORDER BY created_at DESC, id'),
    pool.query('SELECT user_id, student_id FROM student_assignments ORDER BY user_id, student_id'),
  ])

  return userResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    studentIds: assignmentResult.rows.filter((item) => item.user_id === row.id).map((item) => item.student_id),
  }))
}

async function getUserById(userId) {
  const users = await listUsers()
  return users.find((user) => user.id === userId) || null
}

async function createUser(user) {
  if (!pool) {
    const users = await readJson(usersFile)
    users.unshift(user)
    await writeJson(usersFile, users)
    return user
  }

  await seedNormalizedStorage()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO users_normalized (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.name, user.email, user.passwordHash, user.role],
    )

    for (const studentId of user.studentIds ?? []) {
      await client.query(
        `INSERT INTO student_assignments (student_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (student_id, user_id) DO NOTHING`,
        [studentId, user.id],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return getUserById(user.id)
}

async function assignUserToStudent(userId, studentId) {
  if (!pool) {
    const users = await readJson(usersFile)
    const user = users.find((entry) => entry.id === userId)
    if (!user) return null
    user.studentIds = [...new Set([...(user.studentIds ?? []), studentId])]
    await writeJson(usersFile, users)
    return user
  }

  await seedNormalizedStorage()
  await pool.query(
    `INSERT INTO student_assignments (student_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (student_id, user_id) DO NOTHING`,
    [studentId, userId],
  )
  return getUserById(userId)
}

async function removeUserAssignment(userId, studentId) {
  if (!pool) {
    const users = await readJson(usersFile)
    const user = users.find((entry) => entry.id === userId)
    if (!user) return false
    user.studentIds = (user.studentIds ?? []).filter((entry) => entry !== studentId)
    await writeJson(usersFile, users)
    return true
  }

  await seedNormalizedStorage()
  const result = await pool.query('DELETE FROM student_assignments WHERE student_id = $1 AND user_id = $2', [studentId, userId])
  return result.rowCount > 0
}

async function listInvites() {
  if (!pool) return readJson(invitesFile)
  await seedNormalizedStorage()

  const result = await pool.query(`
    SELECT i.*, s.name AS student_name
    FROM invites_normalized i
    JOIN students_normalized s ON s.id = i.student_id
    ORDER BY i.created_at DESC, i.id
  `)

  return result.rows.map((row) => ({
    id: row.id,
    token: row.token,
    email: row.email,
    name: row.name,
    role: row.role,
    studentId: row.student_id,
    studentName: row.student_name,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    acceptedBy: row.accepted_by,
  }))
}

async function createInvite(invite) {
  if (!pool) {
    const invites = await readJson(invitesFile)
    invites.unshift(invite)
    await writeJson(invitesFile, invites)
    return invite
  }

  await seedNormalizedStorage()
  await pool.query(
    `INSERT INTO invites_normalized (id, token, email, name, role, student_id, status, created_at, created_by, accepted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(NULLIF($8, '')::timestamptz, NOW()), $9, $10)`,
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
  return invite
}

async function updateInviteAcceptance(inviteId, acceptedByEmail) {
  if (!pool) {
    const invites = await readJson(invitesFile)
    const invite = invites.find((entry) => entry.id === inviteId)
    if (!invite) return null
    invite.status = 'Accepted'
    invite.acceptedBy = acceptedByEmail
    await writeJson(invitesFile, invites)
    return invite
  }

  await seedNormalizedStorage()
  await pool.query(
    `UPDATE invites_normalized
     SET status = 'Accepted', accepted_by = $2
     WHERE id = $1`,
    [inviteId, acceptedByEmail],
  )
  const invites = await listInvites()
  return invites.find((invite) => invite.id === inviteId) || null
}

async function deleteInvite(inviteId) {
  if (!pool) {
    const invites = await readJson(invitesFile)
    const nextInvites = invites.filter((entry) => entry.id !== inviteId)
    if (nextInvites.length === invites.length) return false
    await writeJson(invitesFile, nextInvites)
    return true
  }

  await seedNormalizedStorage()
  const result = await pool.query('DELETE FROM invites_normalized WHERE id = $1', [inviteId])
  return result.rowCount > 0
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function normalizeStudent(payload) {
  return {
    id: payload.id,
    name: String(payload.name || '').trim(),
    target: String(payload.target || '').trim(),
    classLevel: String(payload.classLevel || '').trim(),
    city: String(payload.city || '').trim(),
    studyHours: toNumber(payload.studyHours),
    revisionHours: toNumber(payload.revisionHours),
    mockScore: toNumber(payload.mockScore),
    attendance: toNumber(payload.attendance),
    consistency: toNumber(payload.consistency),
    practiceTests: toNumber(payload.practiceTests),
    syllabusCompletion: toNumber(payload.syllabusCompletion),
    status: String(payload.status || 'On Track').trim(),
    priority: String(payload.priority || 'Medium').trim(),
    nextReviewDate: String(payload.nextReviewDate || '').trim(),
    mentorNotes: String(payload.mentorNotes || '').trim(),
    interventions: Array.isArray(payload.interventions)
      ? payload.interventions.map((item) => ({
          id: String(item.id || crypto.randomUUID()).trim(),
          title: String(item.title || '').trim(),
          status: String(item.status || 'Planned').trim(),
          owner: String(item.owner || '').trim(),
          dueDate: String(item.dueDate || '').trim(),
          impact: String(item.impact || 'Medium').trim(),
          notes: String(item.notes || '').trim(),
        }))
      : [],
    subjects: Array.isArray(payload.subjects)
      ? payload.subjects.map((subject) => ({
          name: String(subject.name || '').trim(),
          score: toNumber(subject.score),
          benchmark: toNumber(subject.benchmark),
          chaptersDone: toNumber(subject.chaptersDone),
          totalChapters: toNumber(subject.totalChapters),
          weakTopic: String(subject.weakTopic || '').trim(),
        }))
      : [],
  }
}

function validateStudent(student) {
  if (!student.name || !student.target || !student.classLevel) {
    return 'Name, target, and class level are required.'
  }

  if (!student.subjects.length) {
    return 'At least one subject is required.'
  }

  if (!['On Track', 'Watchlist', 'At Risk'].includes(student.status)) {
    return 'Status must be On Track, Watchlist, or At Risk.'
  }

  return null
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, passwordHash) {
  const [salt, expectedHash] = String(passwordHash).split(':')
  if (!salt || !expectedHash) return false
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signToken(payload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', tokenSecret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

function readToken(token) {
  const [encodedPayload, signature] = String(token || '').split('.')
  if (!encodedPayload || !signature) return null

  const expected = crypto.createHmac('sha256', tokenSecret).update(encodedPayload).digest('base64url')
  if (signature !== expected) return null

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentIds: user.studentIds ?? [],
  }
}

function sanitizeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name || '',
    role: invite.role,
    studentId: invite.studentId,
    studentName: invite.studentName,
    status: invite.status,
    createdAt: invite.createdAt,
    token: invite.token,
  }
}

function getAccessibleStudents(user, students) {
  if (user.role === 'mentor' || user.role === 'admin') {
    return students
  }

  return students.filter((student) => (user.studentIds ?? []).includes(student.id))
}

function buildFallbackParentReport(student) {
  const subjectLines = (student.subjects ?? []).map(
    (subject) => `${subject.name}: ${subject.score}% vs benchmark ${subject.benchmark}% around ${subject.weakTopic}.`,
  )
  const interventionLines = (student.interventions ?? []).map(
    (item) => `${item.title} is ${item.status} and due ${item.dueDate || 'soon'}.`,
  )

  return [
    `Parent Progress Report for ${student.name}`,
    ``,
    `${student.name} is currently marked as ${student.status} with ${student.syllabusCompletion}% syllabus completion and a consistency score of ${student.consistency}/100.`,
    `The current priority is ${student.priority}. Next mentor review: ${student.nextReviewDate || 'not yet scheduled'}.`,
    ``,
    `Subject snapshot:`,
    ...subjectLines,
    ``,
    `Study routine: ${student.studyHours} hours/day with ${student.revisionHours} hours/day reserved for revision and ${student.practiceTests} practice tests each week.`,
    `Mentor note: ${student.mentorNotes || 'No additional mentor note yet.'}`,
    ``,
    `Current intervention plan:`,
    ...(interventionLines.length ? interventionLines : ['No intervention has been assigned yet.']),
    ``,
    `Parent action suggestion: keep the home routine calm and consistent, review the next mentor checkpoint, and encourage completion of the highest-priority intervention first.`,
  ].join('\n')
}

async function generateParentReport(student) {
  if (!openai) {
    return buildFallbackParentReport(student)
  }

  const prompt = [
    `Write a concise parent-friendly academic progress report.`,
    `Student: ${student.name}`,
    `Target: ${student.target}`,
    `Status: ${student.status}`,
    `Syllabus completion: ${student.syllabusCompletion}%`,
    `Consistency: ${student.consistency}/100`,
    `Study hours: ${student.studyHours}`,
    `Revision hours: ${student.revisionHours}`,
    `Practice tests per week: ${student.practiceTests}`,
    `Mentor notes: ${student.mentorNotes || 'None'}`,
    `Subjects: ${(student.subjects ?? []).map((subject) => `${subject.name} ${subject.score}% vs ${subject.benchmark}%`).join('; ')}`,
    `Interventions: ${(student.interventions ?? []).map((item) => `${item.title} ${item.status}`).join('; ') || 'None'}`,
    `Use simple language, focus on strengths, risks, and 3 practical parent actions.`,
  ].join('\n')

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: prompt,
  })

  return response.output_text || buildFallbackParentReport(student)
}

const curriculumBenchmarks = {
  institutes: [
    {
      name: 'IIT benchmark',
      focus: ['data structures', 'algorithms', 'operating systems', 'database systems', 'computer networks', 'system design', 'mathematics', 'problem solving'],
    },
    {
      name: 'NIT benchmark',
      focus: ['object oriented programming', 'dbms', 'computer networks', 'software engineering', 'aptitude', 'project work', 'coding practice'],
    },
    {
      name: 'IIIT / product benchmark',
      focus: ['web development', 'machine learning', 'cloud fundamentals', 'api design', 'git', 'open source', 'internship readiness'],
    },
  ],
  marketRoles: [
    {
      name: 'Software engineer',
      skills: ['data structures', 'algorithms', 'sql', 'git', 'api design', 'javascript', 'system design', 'testing'],
    },
    {
      name: 'Data / AI engineer',
      skills: ['python', 'statistics', 'machine learning', 'sql', 'data analysis', 'llms', 'cloud fundamentals'],
    },
    {
      name: 'Frontend / product engineer',
      skills: ['html', 'css', 'javascript', 'react', 'ui engineering', 'api integration', 'testing'],
    },
  ],
}

function analyzeCurriculumText(curriculumText) {
  const normalizedText = String(curriculumText || '').toLowerCase()
  const benchmarkSkills = [...new Set(curriculumBenchmarks.institutes.flatMap((item) => item.focus))]
  const marketSkills = [...new Set(curriculumBenchmarks.marketRoles.flatMap((item) => item.skills))]

  const matchedInstituteSkills = benchmarkSkills.filter((skill) => normalizedText.includes(skill))
  const missingInstituteSkills = benchmarkSkills.filter((skill) => !normalizedText.includes(skill))
  const matchedMarketSkills = marketSkills.filter((skill) => normalizedText.includes(skill))
  const missingMarketSkills = marketSkills.filter((skill) => !normalizedText.includes(skill))

  const readinessScore = Math.max(
    20,
    Math.min(
      95,
      Math.round(((matchedInstituteSkills.length * 0.45 + matchedMarketSkills.length * 0.55) / (benchmarkSkills.length * 0.45 + marketSkills.length * 0.55)) * 100),
    ),
  )

  const topInstituteGap = curriculumBenchmarks.institutes.map((item) => ({
    name: item.name,
    matched: item.focus.filter((skill) => normalizedText.includes(skill)),
    missing: item.focus.filter((skill) => !normalizedText.includes(skill)),
  }))

  const roleFit = curriculumBenchmarks.marketRoles.map((role) => ({
    name: role.name,
    matched: role.skills.filter((skill) => normalizedText.includes(skill)),
    missing: role.skills.filter((skill) => !normalizedText.includes(skill)),
    score: Math.round((role.skills.filter((skill) => normalizedText.includes(skill)).length / role.skills.length) * 100),
  }))

  return {
    readinessScore,
    matchedInstituteSkills,
    missingInstituteSkills,
    matchedMarketSkills,
    missingMarketSkills,
    topInstituteGap,
    roleFit,
  }
}

function buildFallbackCurriculumReport(curriculumText, analysis) {
  const strongestRole = [...analysis.roleFit].sort((a, b) => b.score - a.score)[0]
  const weakestRole = [...analysis.roleFit].sort((a, b) => a.score - b.score)[0]

  return [
    `Curriculum Comparison Report`,
    ``,
    `Your uploaded curriculum shows a readiness score of ${analysis.readinessScore}/100 against top-institute and market skill benchmarks.`,
    `Current strongest role alignment: ${strongestRole.name} (${strongestRole.score}%).`,
    `Weakest role alignment: ${weakestRole.name} (${weakestRole.score}%).`,
    ``,
    `Top gaps against institute-style syllabi:`,
    ...analysis.missingInstituteSkills.slice(0, 8).map((skill) => `- ${skill}`),
    ``,
    `Top market-facing gaps:`,
    ...analysis.missingMarketSkills.slice(0, 8).map((skill) => `- ${skill}`),
    ``,
    `What to focus next:`,
    `1. Add 2-3 missing computer science core subjects into your self-study plan.`,
    `2. Build one job-oriented project that proves ${analysis.missingMarketSkills.slice(0, 3).join(', ') || 'modern engineering skills'}.`,
    `3. Follow a weekly plan combining fundamentals, coding practice, and one portfolio-ready project.`,
    ``,
    `Curriculum preview snippet: ${String(curriculumText || '').slice(0, 240)}`,
  ].join('\n')
}

async function generateCurriculumReport(curriculumText, analysis) {
  if (!openai) {
    return buildFallbackCurriculumReport(curriculumText, analysis)
  }

  const prompt = [
    `You are an academic and placement readiness analyst.`,
    `Compare a student's university curriculum with benchmark Indian institute expectations and market job skills.`,
    `Write a practical report in simple language with these sections: overall readiness, academic gaps, market gaps, focus roadmap, and job-oriented advice.`,
    `Curriculum text: ${curriculumText}`,
    `Institute gap summary: ${JSON.stringify(analysis.topInstituteGap)}`,
    `Role fit summary: ${JSON.stringify(analysis.roleFit)}`,
    `Missing market skills: ${analysis.missingMarketSkills.join(', ')}`,
  ].join('\n')

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: prompt,
  })

  return response.output_text || buildFallbackCurriculumReport(curriculumText, analysis)
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = readToken(token)

  if (!payload?.userId) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const user = await getUserById(payload.userId)

  if (!user) {
    return res.status(401).json({ message: 'Invalid session.' })
  }

  req.user = sanitizeUser(user)
  next()
}

app.get('/api/health', (_req, res) => {
  const envHealth = getEnvironmentHealth()
  res.json({
    ok: true,
    date: new Date().toISOString(),
    storage: pool ? 'postgres' : 'json',
    aiReports: openai ? 'openai' : 'fallback',
    environment: envHealth,
  })
})

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'student', studentIds = [], inviteToken = '' } = req.body
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' })
  }

  const existingUsers = await listUsers()
  const existingInvites = await listInvites()

  if (existingUsers.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ message: 'An account with this email already exists.' })
  }

  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: ['student', 'parent', 'mentor'].includes(role) ? role : 'student',
    studentIds: Array.isArray(studentIds) ? studentIds : [],
  }

  if (inviteToken) {
    const invite = existingInvites.find((entry) => entry.token === inviteToken && entry.status === 'Pending')
    if (!invite) {
      return res.status(400).json({ message: 'Invite token is invalid or expired.' })
    }

    if (invite.email !== normalizedEmail || invite.role !== user.role) {
      return res.status(400).json({ message: 'Invite details do not match this account.' })
    }

    user.studentIds = [...new Set([...(user.studentIds ?? []), invite.studentId])]
    await updateInviteAcceptance(invite.id, normalizedEmail)
  }

  await createUser(user)

  const safeUser = sanitizeUser(user)
  const token = signToken({
    userId: safeUser.id,
    role: safeUser.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })

  return res.status(201).json({ token, user: safeUser })
})

app.post('/api/auth/login', async (req, res) => {
  const users = await listUsers()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const user = users.find((entry) => entry.email.toLowerCase() === email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  const safeUser = sanitizeUser(user)
  const token = signToken({
    userId: safeUser.id,
    role: safeUser.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })

  return res.json({ token, user: safeUser })
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const students = await listStudents()
  const visibleStudents = getAccessibleStudents(req.user, students)
  res.json({
    user: req.user,
    students: visibleStudents,
  })
})

app.get('/api/users', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can browse users.' })
  }

  const users = await listUsers()
  res.json(users.map(sanitizeUser))
})

app.get('/api/invites', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can view invites.' })
  }

  const invites = await listInvites()
  res.json(invites.map(sanitizeInvite))
})

app.get('/api/students', authMiddleware, async (req, res) => {
  const students = await listStudents()
  res.json(getAccessibleStudents(req.user, students))
})

app.get('/api/students/:id', authMiddleware, async (req, res) => {
  const students = await listStudents()
  const allowedStudents = getAccessibleStudents(req.user, students)
  const student = allowedStudents.find((entry) => entry.id === req.params.id)

  if (!student) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  return res.json(student)
})

app.get('/api/students/:id/assignments', authMiddleware, async (req, res) => {
  const students = await listStudents()
  const allowedStudents = getAccessibleStudents(req.user, students)
  const student = allowedStudents.find((entry) => entry.id === req.params.id)

  if (!student) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  const users = await listUsers()
  const invites = await listInvites()

  const assignedUsers = users
    .filter((user) => (user.studentIds ?? []).includes(req.params.id) && user.role !== 'mentor' && user.role !== 'admin')
    .map(sanitizeUser)

  const pendingInvites = invites
    .filter((invite) => invite.studentId === req.params.id && invite.status === 'Pending')
    .map(sanitizeInvite)

  return res.json({
    users: assignedUsers,
    invites: pendingInvites,
  })
})

app.get('/api/students/:id/parent-report', authMiddleware, async (req, res) => {
  const students = await listStudents()
  const allowedStudents = getAccessibleStudents(req.user, students)
  const student = allowedStudents.find((entry) => entry.id === req.params.id)

  if (!student) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  const report = await generateParentReport(student)
  return res.json({
    studentId: student.id,
    report,
    provider: openai ? 'openai' : 'fallback',
  })
})

app.post('/api/curriculum/analyze', authMiddleware, async (req, res) => {
  const curriculumText = String(req.body.curriculumText || '').trim()

  if (!curriculumText) {
    return res.status(400).json({ message: 'Curriculum text is required.' })
  }

  const analysis = analyzeCurriculumText(curriculumText)
  const report = await generateCurriculumReport(curriculumText, analysis)

  return res.json({
    analysis,
    report,
    provider: openai ? 'openai' : 'fallback',
    benchmarks: curriculumBenchmarks,
  })
})

app.post('/api/curriculum/extract-pdf', authMiddleware, async (req, res) => {
  const fileBase64 = String(req.body.fileBase64 || '')

  if (!fileBase64) {
    return res.status(400).json({ message: 'PDF file content is required.' })
  }

  try {
    const buffer = Buffer.from(fileBase64, 'base64')
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    await parser.destroy()
    const extractedText = String(parsed.text || '').replace(/\s+\n/g, '\n').trim()

    if (!extractedText) {
      return res.status(422).json({ message: 'Could not extract readable text from this PDF.' })
    }

    return res.json({
      text: extractedText,
      pages: parsed.total || 0,
      info: parsed.info || {},
    })
  } catch {
    return res.status(400).json({ message: 'Failed to parse PDF file.' })
  }
})

app.post('/api/students', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can create student records.' })
  }

  const student = normalizeStudent(req.body)
  student.id = crypto.randomUUID()

  const validationError = validateStudent(student)
  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  if (!pool) {
    const students = await readJson(studentsFile)
    const nextStudents = [student, ...students]
    await writeJson(studentsFile, nextStudents)
    return res.status(201).json(student)
  }

  const savedStudent = await saveStudentToNormalized(student)
  return res.status(201).json(savedStudent)
})

app.put('/api/students/:id', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can update student records.' })
  }

  const existingStudent = await getStudentById(req.params.id)

  if (!existingStudent) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  const student = normalizeStudent({ ...req.body, id: req.params.id })
  const validationError = validateStudent(student)

  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  if (!pool) {
    const students = await readJson(studentsFile)
    const index = students.findIndex((entry) => entry.id === req.params.id)
    students[index] = student
    await writeJson(studentsFile, students)
    return res.json(student)
  }

  const savedStudent = await saveStudentToNormalized(student)
  return res.json(savedStudent)
})

app.post('/api/students/:id/invites', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can manage assignments.' })
  }

  const student = await getStudentById(req.params.id)

  if (!student) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  const users = await listUsers()
  const invites = await listInvites()
  const email = String(req.body.email || '').trim().toLowerCase()
  const role = String(req.body.role || '').trim()
  const name = String(req.body.name || '').trim()

  if (!email || !['student', 'parent'].includes(role)) {
    return res.status(400).json({ message: 'Email and role are required for assignments.' })
  }

  const existingUser = users.find((entry) => entry.email.toLowerCase() === email)

  if (existingUser) {
    if (existingUser.role !== role) {
      return res.status(400).json({ message: 'Existing user has a different role.' })
    }

    await assignUserToStudent(existingUser.id, req.params.id)
    return res.status(201).json({
      mode: 'assigned',
      user: sanitizeUser(await getUserById(existingUser.id)),
    })
  }

  const existingInvite = invites.find(
    (entry) => entry.email === email && entry.studentId === req.params.id && entry.status === 'Pending',
  )

  if (existingInvite) {
    return res.status(409).json({ message: 'A pending invite already exists for this email.' })
  }

  const invite = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(12).toString('hex'),
    email,
    name,
    role,
    studentId: req.params.id,
    studentName: student.name,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  }

  await createInvite(invite)

  return res.status(201).json({
    mode: 'invited',
    invite: sanitizeInvite(invite),
  })
})

app.delete('/api/students/:id/assignments/:userId', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can manage assignments.' })
  }

  const user = await getUserById(req.params.userId)

  if (!user) {
    return res.status(404).json({ message: 'Assigned user not found.' })
  }

  await removeUserAssignment(req.params.userId, req.params.id)
  return res.json({ ok: true })
})

app.delete('/api/invites/:id', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can manage invites.' })
  }

  const deleted = await deleteInvite(req.params.id)

  if (!deleted) {
    return res.status(404).json({ message: 'Invite not found.' })
  }

  return res.json({ ok: true })
})

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  if (!['mentor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only mentors can delete student records.' })
  }

  const deleted = await deleteStudentFromStore(req.params.id)

  if (!deleted) {
    return res.status(404).json({ message: 'Student not found.' })
  }
  return res.json({ ok: true })
})

app.use(express.static(distDir))

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }

  try {
    await fs.access(path.join(distDir, 'index.html'))
    return res.sendFile(path.join(distDir, 'index.html'))
  } catch {
    return res
      .status(404)
      .send('Frontend build not found. Run "npm run build" for production or "npm run dev" for local development.')
  }
})

app.listen(port, () => {
  console.log(`EduPilot server listening on http://localhost:${port}`)
})
