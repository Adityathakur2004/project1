CREATE OR REPLACE VIEW cohort_risk_summary AS
SELECT
  target,
  status,
  COUNT(*) AS student_count,
  ROUND(AVG(syllabus_completion), 2) AS avg_completion,
  ROUND(AVG(consistency), 2) AS avg_consistency
FROM students_normalized
GROUP BY target, status;

CREATE OR REPLACE VIEW student_subject_gap_view AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  ss.name AS subject_name,
  ss.score,
  ss.benchmark,
  (ss.benchmark - ss.score) AS score_gap,
  ss.weak_topic
FROM students_normalized s
JOIN student_subjects ss ON ss.student_id = s.id;
