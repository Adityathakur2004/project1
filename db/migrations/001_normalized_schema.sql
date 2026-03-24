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

CREATE INDEX IF NOT EXISTS idx_students_status ON students_normalized(status);
CREATE INDEX IF NOT EXISTS idx_students_target ON students_normalized(target);
CREATE INDEX IF NOT EXISTS idx_subjects_student_id ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_interventions_student_id ON student_interventions(student_id);
