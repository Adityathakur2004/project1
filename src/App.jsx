import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import './App.css'

const CohortCharts = lazy(() => import('./components/CohortCharts.jsx'))
const CurriculumComparisonPage = lazy(() => import('./components/CurriculumComparisonPage.jsx'))
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const subjectTemplate = [
  { name: 'Physics', score: 58, benchmark: 74, chaptersDone: 7, totalChapters: 11, weakTopic: 'Rotational Motion' },
  { name: 'Chemistry', score: 66, benchmark: 72, chaptersDone: 8, totalChapters: 10, weakTopic: 'Chemical Bonding' },
  { name: 'Mathematics', score: 71, benchmark: 76, chaptersDone: 9, totalChapters: 12, weakTopic: 'Quadratic Equations' },
]

const defaultForm = {
  name: '',
  target: 'JEE Advanced 2027',
  classLevel: 'Class 11',
  city: '',
  studyHours: 6,
  revisionHours: 1.2,
  mockScore: 150,
  attendance: 88,
  consistency: 75,
  practiceTests: 2,
  syllabusCompletion: 65,
  status: 'Watchlist',
  priority: 'Medium',
  nextReviewDate: '',
  mentorNotes: '',
  interventions: [],
  subjects: subjectTemplate,
}

const defaultAuthForm = {
  name: '',
  email: '',
  password: '',
  role: 'student',
  inviteToken: '',
}

const benchmarkMap = {
  'JEE Advanced 2027': {
    benchmarkScore: 198,
    totalMarks: 300,
    idealHours: 7.5,
    idealRevisionHours: 1.8,
    benchmarkCompletion: 78,
    benchmarkLabel: 'Top JEE coaching benchmark',
  },
  'JEE Main 2027': {
    benchmarkScore: 182,
    totalMarks: 300,
    idealHours: 7,
    idealRevisionHours: 1.6,
    benchmarkCompletion: 75,
    benchmarkLabel: 'Strong engineering entrance benchmark',
  },
  'NEET 2027': {
    benchmarkScore: 590,
    totalMarks: 720,
    idealHours: 8,
    idealRevisionHours: 2,
    benchmarkCompletion: 80,
    benchmarkLabel: 'Top medical prep benchmark',
  },
}

const roleCopy = {
  mentor: {
    title: 'Mentor workspace',
    description: 'Create student records, update subject performance, and drive recovery plans.',
  },
  parent: {
    title: 'Parent overview',
    description: 'Track performance risk, routine health, and the weekly plan for your child.',
  },
  student: {
    title: 'Student dashboard',
    description: 'See your weak chapters, benchmark gap, and the fastest path to recover.',
  },
}

const demoCredentials = [
  { role: 'Mentor', email: 'mentor@edupilot.demo', password: 'edupilot123' },
  { role: 'Student', email: 'student@edupilot.demo', password: 'edupilot123' },
  { role: 'Parent', email: 'parent@edupilot.demo', password: 'edupilot123' },
]

const riskTone = {
  High: 'risk-high',
  Medium: 'risk-medium',
  Low: 'risk-low',
}

const statusTone = {
  'On Track': 'risk-low',
  Watchlist: 'risk-medium',
  'At Risk': 'risk-high',
}

function cloneDefaultForm() {
  return {
    ...defaultForm,
    subjects: defaultForm.subjects.map((subject) => ({ ...subject })),
  }
}

function formatStudentForForm(student) {
  return {
    ...student,
    subjects: student.subjects.map((subject) => ({ ...subject })),
  }
}

function getBenchmark(target) {
  return benchmarkMap[target] ?? benchmarkMap['JEE Advanced 2027']
}

function getRisk(scoreGap) {
  if (scoreGap >= 15) return 'High'
  if (scoreGap >= 7) return 'Medium'
  return 'Low'
}

function getIssue(subject) {
  const chapterGap = subject.totalChapters - subject.chaptersDone
  const scoreGap = subject.benchmark - subject.score

  if (scoreGap >= 15) {
    return `Large performance gap in ${subject.weakTopic}; concept clarity and timed practice both need repair.`
  }

  if (chapterGap >= 2) {
    return `Coverage is trailing in ${subject.weakTopic}; syllabus completion is limiting confidence.`
  }

  return `Moderate weakness around ${subject.weakTopic}; this needs faster revision and mixed-question practice.`
}

function buildWeeklyPlan(student, benchmark) {
  const weakestSubjects = [...student.subjects]
    .sort((a, b) => (a.score - a.benchmark) - (b.score - b.benchmark))
    .slice(0, 3)

  return weakestSubjects.map((subject, index) => {
    const windows = ['Mon-Tue', 'Wed-Thu', 'Fri-Sun']
    const focusHours = Math.max(1, Math.round((benchmark.idealHours - student.studyHours) + 2))

    return {
      title: `${subject.name} recovery`,
      window: windows[index] ?? 'This week',
      items: [
        `${subject.weakTopic} concept rebuild with notes compression`,
        `${focusHours} focused blocks on mixed problem sets and error review`,
        `One timed checkpoint to move toward ${subject.benchmark}% benchmark`,
      ],
    }
  })
}

function computeAnalytics(student) {
  const benchmark = getBenchmark(student.target)
  const scoreGap = Math.max(0, benchmark.benchmarkScore - student.mockScore)
  const paceGap = Math.max(0, benchmark.benchmarkCompletion - student.syllabusCompletion)
  const revisionShare = student.studyHours > 0 ? Math.round((student.revisionHours / student.studyHours) * 100) : 0
  const idealRevisionShare = Math.round((benchmark.idealRevisionHours / benchmark.idealHours) * 100)

  const subjectPerformance = student.subjects.map((subject) => {
    const scoreGapForSubject = subject.benchmark - subject.score

    return {
      ...subject,
      risk: getRisk(scoreGapForSubject),
      issue: getIssue(subject),
    }
  })

  const gapChapters = [...subjectPerformance]
    .sort((a, b) => (a.score - a.benchmark) - (b.score - b.benchmark))
    .map((subject) => ({
      chapter: subject.weakTopic,
      subject: subject.name,
      mastery: subject.score,
      benchmark: subject.benchmark,
      reason:
        subject.chaptersDone < subject.totalChapters
          ? `Only ${subject.chaptersDone}/${subject.totalChapters} chapters are covered, so performance is constrained by pace.`
          : 'Coverage exists, but low timed accuracy is blocking benchmark-level output.',
      action: `Run a 3-step repair cycle: recap, timed practice, and same-day mistake review for ${subject.weakTopic}.`,
    }))

  const routines = [
    {
      label: 'Focused study',
      actual: Number(student.studyHours),
      target: benchmark.idealHours,
      detail: `Current load is ${(benchmark.idealHours - student.studyHours).toFixed(1)} hours below the benchmark plan.`,
    },
    {
      label: 'Revision loop',
      actual: Number(student.revisionHours),
      target: benchmark.idealRevisionHours,
      detail: `Revision share is ${revisionShare}% but strong students stay near ${idealRevisionShare}%.`,
    },
    {
      label: 'Practice tests',
      actual: Number(student.practiceTests),
      target: 3,
      detail:
        student.practiceTests < 3
          ? 'Add one more timed test each week to improve pressure handling.'
          : 'Test frequency is healthy, so keep post-mock analysis disciplined.',
    },
  ]

  const instituteBenchmarks = [
    {
      name: benchmark.benchmarkLabel,
      description: 'Coverage pace and weekly academic rhythm derived from high-performing exam prep programs.',
      value: `${benchmark.benchmarkCompletion}% syllabus pace`,
    },
    {
      name: 'Top performer routine',
      description: 'Strong students usually protect deep work blocks, revision loops, and weekly mock analysis.',
      value: `${benchmark.idealHours} hrs/day with ${idealRevisionShare}% revision`,
    },
    {
      name: 'Outcome projection',
      description: 'Projected readiness based on current score, pace, and behavior pattern.',
      value: scoreGap > 0 ? `Needs +${scoreGap} marks lift` : 'On benchmark pace',
    },
  ]

  const overallRisk =
    scoreGap >= 45 || paceGap >= 15
      ? 'At Risk'
      : scoreGap >= 20 || paceGap >= 8
        ? 'Watchlist'
        : 'On Track'

  const narrativeSummary =
    overallRisk === 'At Risk'
      ? `${student.name} is materially behind the benchmark. The next 7-10 days should focus on backlog repair, revision discipline, and one close mentor review.`
      : overallRisk === 'Watchlist'
        ? `${student.name} is still competitive, but the margin is thinning. Better revision consistency and targeted chapter repair can close the gap quickly.`
        : `${student.name} is broadly aligned with the benchmark. The main goal is to protect consistency and avoid regression in weak topics.`

  const interventions = Array.isArray(student.interventions) ? student.interventions : []
  const interventionHealth = interventions.filter((item) => item.status !== 'Done').length

  return {
    benchmark,
    scoreGap,
    paceGap,
    revisionShare,
    idealRevisionShare,
    subjectPerformance,
    gapChapters,
    routines,
    instituteBenchmarks,
    overallRisk,
    narrativeSummary,
    interventionHealth,
    weeklyPlan: buildWeeklyPlan(student, benchmark),
  }
}

function buildCohortAnalytics(students) {
  if (!students.length) {
    return {
      averageCompletion: 0,
      averageConsistency: 0,
      averageStudyHours: 0,
      riskCounts: { onTrack: 0, watchlist: 0, atRisk: 0 },
      targetMix: [],
      subjectLeaders: [],
      upcomingReviews: [],
    }
  }

  const totals = students.reduce(
    (accumulator, student) => {
      accumulator.completion += Number(student.syllabusCompletion || 0)
      accumulator.consistency += Number(student.consistency || 0)
      accumulator.studyHours += Number(student.studyHours || 0)
      if (student.status === 'At Risk') accumulator.riskCounts.atRisk += 1
      else if (student.status === 'Watchlist') accumulator.riskCounts.watchlist += 1
      else accumulator.riskCounts.onTrack += 1
      return accumulator
    },
    {
      completion: 0,
      consistency: 0,
      studyHours: 0,
      riskCounts: { onTrack: 0, watchlist: 0, atRisk: 0 },
    },
  )

  const targetMap = new Map()
  const subjectMap = new Map()

  students.forEach((student) => {
    targetMap.set(student.target, (targetMap.get(student.target) ?? 0) + 1)

    ;(student.subjects || []).forEach((subject) => {
      if (!subjectMap.has(subject.name)) {
        subjectMap.set(subject.name, { totalScore: 0, totalBenchmark: 0, count: 0 })
      }

      const current = subjectMap.get(subject.name)
      current.totalScore += Number(subject.score || 0)
      current.totalBenchmark += Number(subject.benchmark || 0)
      current.count += 1
    })
  })

  const subjectLeaders = [...subjectMap.entries()]
    .map(([name, value]) => ({
      name,
      score: Math.round(value.totalScore / value.count),
      benchmark: Math.round(value.totalBenchmark / value.count),
      gap: Math.round(value.totalScore / value.count - value.totalBenchmark / value.count),
    }))
    .sort((a, b) => a.gap - b.gap)

  return {
    averageCompletion: Math.round(totals.completion / students.length),
    averageConsistency: Math.round(totals.consistency / students.length),
    averageStudyHours: (totals.studyHours / students.length).toFixed(1),
    riskCounts: totals.riskCounts,
    targetMix: [...targetMap.entries()].map(([label, value]) => ({ label, value })),
    subjectLeaders,
    upcomingReviews: [...students]
      .filter((student) => student.nextReviewDate)
      .sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate))
      .slice(0, 4),
  }
}

function buildMentorReport(students, cohort, selectedStudent, analytics) {
  const lines = [
    `EduPilot Mentor Review`,
    ``,
    `Cohort size: ${students.length}`,
    `Average syllabus completion: ${cohort.averageCompletion}%`,
    `Average consistency: ${cohort.averageConsistency}/100`,
    `Average study hours: ${cohort.averageStudyHours} hrs/day`,
    `Risk distribution: ${cohort.riskCounts.onTrack} On Track, ${cohort.riskCounts.watchlist} Watchlist, ${cohort.riskCounts.atRisk} At Risk`,
    ``,
    `Current student in focus: ${selectedStudent.name}`,
    `Status: ${selectedStudent.status}`,
    `Target: ${selectedStudent.target}`,
    `Benchmark gap: ${analytics.scoreGap} marks`,
    `Next review: ${selectedStudent.nextReviewDate || 'Not scheduled'}`,
    `Mentor note: ${selectedStudent.mentorNotes || 'No note recorded'}`,
    ``,
    `Priority interventions:`,
    ...(selectedStudent.interventions || []).map(
      (item) => `- ${item.title} (${item.status}, owner: ${item.owner || 'Unassigned'}, due: ${item.dueDate || 'TBD'})`,
    ),
    ``,
    `Weakest subject trends in cohort:`,
    ...cohort.subjectLeaders.slice(0, 3).map(
      (subject) => `- ${subject.name}: avg ${subject.score}% vs benchmark ${subject.benchmark}%`,
    ),
  ]

  return lines.join('\n')
}

async function apiFetch(path, options = {}, token = '') {
  const requestUrl = path.startsWith('/api') && apiBaseUrl ? `${apiBaseUrl}${path}` : path
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(requestUrl, {
    ...options,
    headers,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.')
  }

  return data
}

function MetricCard({ label, value, helper, tone = 'default' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  )
}

function ProgressBar({ value, max = 100, tone = 'default' }) {
  return (
    <div className="progress-shell" aria-hidden="true">
      <div className={`progress-fill ${tone}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  )
}

function SubjectCard({ subject }) {
  return (
    <article className="subject-card">
      <div className="subject-card__header">
        <div>
          <h3>{subject.name}</h3>
          <p>{subject.issue}</p>
        </div>
        <span className={`risk-chip ${riskTone[subject.risk]}`}>{subject.risk} risk</span>
      </div>
      <div className="subject-stats">
        <div>
          <span>Student score</span>
          <strong>{subject.score}%</strong>
        </div>
        <div>
          <span>Benchmark</span>
          <strong>{subject.benchmark}%</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{subject.chaptersDone}/{subject.totalChapters} chapters</strong>
        </div>
      </div>
      <ProgressBar value={subject.score} />
    </article>
  )
}

function InterventionCard({ item }) {
  return (
    <article className="intervention-card">
      <div className="intervention-card__top">
        <h3>{item.title}</h3>
        <span className={`risk-chip ${statusTone[item.status === 'Done' ? 'On Track' : item.impact] || 'risk-medium'}`}>
          {item.status}
        </span>
      </div>
      <p>{item.notes}</p>
      <div className="intervention-card__meta">
        <span>Owner: {item.owner || 'Not assigned'}</span>
        <span>Due: {item.dueDate || 'Not scheduled'}</span>
        <span>Impact: {item.impact}</span>
      </div>
    </article>
  )
}

function NavButton({ active, children, onClick }) {
  return (
    <button type="button" className={`nav-button ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function ToastStack({ toasts, dismissToast }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <strong>{toast.title}</strong>
          <p>{toast.message}</p>
          <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)}>
            Close
          </button>
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton({ lines = 3, card = false }) {
  return (
    <div className={card ? 'skeleton-card' : 'skeleton-block'} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeleton-line" />
      ))}
    </div>
  )
}

function EnvironmentStatusCard({ systemHealth, healthLoading, refreshSystemHealth, testConnection, copyCommand }) {
  const storageReady = systemHealth?.storage === 'postgres'
  const aiReady = systemHealth?.aiReports === 'openai'
  const apiReady = systemHealth?.ok === true
  const lastCheck = systemHealth?.date ? new Date(systemHealth.date).toLocaleString('en-IN') : 'Pending'

  const readinessItems = [
    {
      label: 'API health',
      state: apiReady ? 'Ready' : 'Check needed',
      tone: apiReady ? 'risk-low' : 'risk-medium',
      detail: apiReady ? 'Backend health endpoint is responding.' : 'Health endpoint has not confirmed readiness yet.',
    },
    {
      label: 'Database runtime',
      state: storageReady ? 'Postgres live' : 'JSON fallback',
      tone: storageReady ? 'risk-low' : 'risk-medium',
      detail: storageReady ? 'Normalized SQL storage is active.' : 'App is still running on local JSON development storage.',
    },
    {
      label: 'AI reports',
      state: aiReady ? 'OpenAI enabled' : 'Fallback mode',
      tone: aiReady ? 'risk-low' : 'risk-medium',
      detail: aiReady ? 'Parent and curriculum reports use the AI model.' : 'Structured deterministic reports are active.',
    },
  ]

  return (
    <section className="settings-page">
      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Runtime control</span>
              <h2>Platform health and deployment readiness</h2>
            </div>
          </div>
          <div className="settings-status-grid">
            {readinessItems.map((item) => (
              <article key={item.label} className="settings-status-card">
                <div className="settings-status-topline">
                  <strong>{item.label}</strong>
                  <span className={`risk-chip ${item.tone}`}>{item.state}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <div className="settings-callout">
            <strong>Last health check</strong>
            <p>{lastCheck}</p>
            <div className="settings-actions">
              <button type="button" className="secondary-link plain-button" onClick={refreshSystemHealth} disabled={healthLoading}>
                {healthLoading ? 'Refreshing...' : 'Refresh health'}
              </button>
              <button type="button" className="ghost-button" onClick={testConnection} disabled={healthLoading}>
                Test connection
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Environment checklist</span>
              <h2>What production setup still needs</h2>
            </div>
          </div>
          <div className="settings-list">
            <article className="settings-list__item">
              <strong>Database URL</strong>
              <p>{storageReady ? 'Configured and active.' : 'Add DATABASE_URL in .env to switch from JSON fallback to Postgres.'}</p>
            </article>
            <article className="settings-list__item">
              <strong>AI key</strong>
              <p>{aiReady ? 'Configured and active.' : 'Add OPENAI_API_KEY in .env to enable AI-written reports.'}</p>
            </article>
            <article className="settings-list__item">
              <strong>Seeded data</strong>
              <p>Run migrations and seed commands once for a new environment before opening the mentor dashboard.</p>
            </article>
          </div>
        </article>
      </div>

      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Setup commands</span>
              <h2>Fast path to bring a new environment online</h2>
            </div>
          </div>
          <div className="settings-command-grid">
            <article className="settings-command-card">
              <strong>1. Configure environment</strong>
              <pre><code>copy .env.example .env</code></pre>
              <button type="button" className="ghost-button" onClick={() => copyCommand('copy .env.example .env')}>
                Copy command
              </button>
            </article>
            <article className="settings-command-card">
              <strong>2. Run migrations</strong>
              <pre><code>npm run migrate</code></pre>
              <button type="button" className="ghost-button" onClick={() => copyCommand('npm run migrate')}>
                Copy command
              </button>
            </article>
            <article className="settings-command-card">
              <strong>3. Seed database</strong>
              <pre><code>npm run seed:db</code></pre>
              <button type="button" className="ghost-button" onClick={() => copyCommand('npm run seed:db')}>
                Copy command
              </button>
            </article>
            <article className="settings-command-card">
              <strong>4. Start application</strong>
              <pre><code>npm run dev</code></pre>
              <button type="button" className="ghost-button" onClick={() => copyCommand('npm run dev')}>
                Copy command
              </button>
            </article>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Operational notes</span>
              <h2>Current platform behavior</h2>
            </div>
          </div>
          <div className="settings-list">
            <article className="settings-list__item">
              <strong>Storage adapter</strong>
              <p>The server automatically uses normalized Postgres tables when a database URL exists, otherwise it falls back to local JSON.</p>
            </article>
            <article className="settings-list__item">
              <strong>Demo access</strong>
              <p>Demo mentor, student, and parent accounts remain available for product walkthroughs and QA.</p>
            </article>
            <article className="settings-list__item">
              <strong>Reports</strong>
              <p>Parent reports, curriculum comparison, PDF export, and cohort charts stay available in both fallback and production modes.</p>
            </article>
          </div>
        </article>
      </div>
    </section>
  )
}

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(defaultAuthForm)
  const [token, setToken] = useState(() => localStorage.getItem('edupilot-token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(cloneDefaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [mode, setMode] = useState('create')
  const [activeView, setActiveView] = useState('dashboard')
  const [systemHealth, setSystemHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [assignments, setAssignments] = useState({ users: [], invites: [] })
  const [assignmentDraft, setAssignmentDraft] = useState({ name: '', email: '', role: 'parent' })
  const [interventionDraft, setInterventionDraft] = useState({
    title: '',
    owner: '',
    dueDate: '',
    impact: 'Medium',
    notes: '',
  })
  const [parentReport, setParentReport] = useState('')
  const [parentReportProvider, setParentReportProvider] = useState('fallback')
  const [parentReportLoading, setParentReportLoading] = useState(false)
  const [curriculumText, setCurriculumText] = useState('')
  const [curriculumReport, setCurriculumReport] = useState('')
  const [curriculumAnalysis, setCurriculumAnalysis] = useState(null)
  const [curriculumProvider, setCurriculumProvider] = useState('fallback')
  const [curriculumLoading, setCurriculumLoading] = useState(false)
  const [curriculumSourceMeta, setCurriculumSourceMeta] = useState('')
  const [toasts, setToasts] = useState([])

  async function loadSystemHealth(showToast = false) {
    try {
      setHealthLoading(true)
      const data = await apiFetch('/api/health')
      setSystemHealth(data)
      if (showToast) {
        pushToast(
          'success',
          'Health refreshed',
          `Storage: ${data.storage || 'unknown'}, AI: ${data.aiReports || 'unknown'}.`,
        )
      }
      return data
    } catch {
      const fallbackHealth = {
        ok: false,
        storage: 'unknown',
        aiReports: 'unknown',
        date: '',
      }
      setSystemHealth(fallbackHealth)
      if (showToast) {
        pushToast('error', 'Health check failed', 'The backend health endpoint could not be reached.')
      }
      return fallbackHealth
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrapHealth() {
      try {
        setHealthLoading(true)
        const data = await apiFetch('/api/health')
        if (isMounted) {
          setSystemHealth(data)
        }
      } catch {
        if (isMounted) {
          setSystemHealth({
            ok: false,
            storage: 'unknown',
            aiReports: 'unknown',
            date: '',
          })
        }
      } finally {
        if (isMounted) {
          setHealthLoading(false)
        }
      }
    }

    bootstrapHealth()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    async function bootstrap() {
      try {
        setLoading(true)
        const data = await apiFetch('/api/auth/me', {}, token)
        setCurrentUser(data.user)
        setStudents(data.students)

        if (data.students.length > 0) {
          setSelectedId(data.students[0].id)
          setForm(formatStudentForForm(data.students[0]))
          setMode(data.user.role === 'mentor' ? 'edit' : 'view')
        } else {
          setForm(cloneDefaultForm())
          setMode(data.user.role === 'mentor' ? 'create' : 'view')
        }
      } catch (bootstrapError) {
        localStorage.removeItem('edupilot-token')
        setToken('')
        setCurrentUser(null)
        setStudents([])
        setAuthError(bootstrapError.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [token])

  useEffect(() => {
    if (!token || !selectedId) {
      setAssignments({ users: [], invites: [] })
      setParentReport('')
      return
    }

    async function loadAssignments() {
      try {
        const data = await apiFetch(`/api/students/${selectedId}/assignments`, {}, token)
        setAssignments(data)
      } catch {
        setAssignments({ users: [], invites: [] })
      }
    }

    loadAssignments()
  }, [selectedId, token])

  useEffect(() => {
    if (!token || !selectedId) {
      setParentReport('')
      setParentReportLoading(false)
      return
    }

    async function loadParentReport() {
      try {
        setParentReportLoading(true)
        const data = await apiFetch(`/api/students/${selectedId}/parent-report`, {}, token)
        setParentReport(data.report)
        setParentReportProvider(data.provider)
      } catch {
        setParentReport('')
      } finally {
        setParentReportLoading(false)
      }
    }

    loadParentReport()
  }, [selectedId, token])

  const selectedStudent = useMemo(() => {
    if (!students.length && (mode === 'create' || mode === 'view')) return form
    if (mode === 'create') return form
    return students.find((student) => student.id === selectedId) ?? form
  }, [form, mode, selectedId, students])

  const analytics = useMemo(() => computeAnalytics(selectedStudent), [selectedStudent])
  const cohort = useMemo(() => buildCohortAnalytics(students), [students])
  const mentorReport = useMemo(
    () => buildMentorReport(students, cohort, selectedStudent, analytics),
    [analytics, cohort, selectedStudent, students],
  )
  const canEdit = currentUser?.role === 'mentor'
  const roleHeader = currentUser ? roleCopy[currentUser.role] ?? roleCopy.student : null
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.city || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'All' || student.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [searchQuery, statusFilter, students])

  const studentCounts = useMemo(
    () => ({
      total: students.length,
      atRisk: students.filter((student) => student.status === 'At Risk').length,
      watchlist: students.filter((student) => student.status === 'Watchlist').length,
    }),
    [students],
  )

  function pushToast(type, title, message) {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, type, title, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  async function handleRefreshHealth() {
    await loadSystemHealth(true)
  }

  async function handleTestConnection() {
    const nextHealth = await loadSystemHealth()
    if (nextHealth.ok) {
      pushToast(
        'success',
        'Connection healthy',
        `Backend is reachable with ${nextHealth.storage} storage and ${nextHealth.aiReports} reports.`,
      )
      return
    }

    pushToast('error', 'Connection issue', 'The platform could not confirm backend readiness.')
  }

  async function handleCopyCommand(command) {
    try {
      await navigator.clipboard.writeText(command)
      pushToast('success', 'Command copied', command)
    } catch (clipboardError) {
      pushToast('error', 'Copy failed', clipboardError.message || 'Clipboard access was blocked.')
    }
  }
  const riskChartData = useMemo(
    () => [
      { name: 'On Track', value: cohort.riskCounts.onTrack, color: '#3ab68a' },
      { name: 'Watchlist', value: cohort.riskCounts.watchlist, color: '#f2b167' },
      { name: 'At Risk', value: cohort.riskCounts.atRisk, color: '#ec6e4c' },
    ],
    [cohort],
  )
  const subjectGapChartData = useMemo(
    () =>
      cohort.subjectLeaders.slice(0, 5).map((subject) => ({
        name: subject.name,
        score: subject.score,
        benchmark: subject.benchmark,
      })),
    [cohort],
  )

  function renderPdfBar(doc, x, y, width, height, actual, benchmark, label) {
    const clampedActual = Math.max(0, Math.min(actual, 100))
    const clampedBenchmark = Math.max(0, Math.min(benchmark, 100))

    doc.setFontSize(10)
    doc.setTextColor(63, 77, 75)
    doc.text(label, x, y - 4)

    doc.setFillColor(239, 244, 242)
    doc.roundedRect(x, y, width, height, 2, 2, 'F')

    doc.setFillColor(15, 120, 111)
    doc.roundedRect(x, y, (width * clampedActual) / 100, height, 2, 2, 'F')

    doc.setDrawColor(236, 110, 76)
    const benchmarkX = x + (width * clampedBenchmark) / 100
    doc.line(benchmarkX, y - 2, benchmarkX, y + height + 2)

    doc.setFontSize(9)
    doc.setTextColor(93, 108, 105)
    doc.text(`${clampedActual}%`, x + width + 6, y + 4)
    doc.text(`Bench ${clampedBenchmark}%`, x + width + 6, y + 11)
  }

  async function exportParentReportPdf() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 18
      const contentWidth = pageWidth - margin * 2
      const lines = doc.splitTextToSize(parentReport || 'No parent report available.', contentWidth)

      doc.setFillColor(250, 245, 236)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 14, contentWidth, 32, 8, 8, 'F')
      doc.setFontSize(18)
      doc.setTextColor(23, 37, 34)
      doc.text(`EduPilot Parent Report`, margin + 6, 27)
      doc.setFontSize(11)
      doc.setTextColor(93, 108, 105)
      doc.text(`${selectedStudent.name} | ${selectedStudent.target}`, margin + 6, 35)
      doc.text(`Status: ${selectedStudent.status || analytics.overallRisk}`, margin + 6, 41)

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 54, contentWidth, 38, 8, 8, 'F')
      doc.setFontSize(12)
      doc.setTextColor(23, 37, 34)
      doc.text('Performance snapshot', margin + 6, 66)
      doc.setFontSize(10)
      doc.setTextColor(93, 108, 105)
      doc.text(`Syllabus completion: ${selectedStudent.syllabusCompletion}%`, margin + 6, 76)
      doc.text(`Study hours/day: ${selectedStudent.studyHours}`, margin + 74, 76)
      doc.text(`Revision share: ${analytics.revisionShare}%`, margin + 132, 76)
      doc.text(`Consistency: ${selectedStudent.consistency}/100`, margin + 6, 84)
      doc.text(`Mock score: ${selectedStudent.mockScore}/${analytics.benchmark.totalMarks}`, margin + 74, 84)
      doc.text(`Open interventions: ${analytics.interventionHealth}`, margin + 132, 84)

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 98, contentWidth, 74, 8, 8, 'F')
      doc.setFontSize(12)
      doc.setTextColor(23, 37, 34)
      doc.text('Subject comparison', margin + 6, 110)
      analytics.subjectPerformance.slice(0, 3).forEach((subject, index) => {
        renderPdfBar(doc, margin + 6, 120 + index * 15, 96, 7, subject.score, subject.benchmark, subject.name)
      })
      doc.setFontSize(9)
      doc.setTextColor(93, 108, 105)
      doc.text('Orange marker shows benchmark. Green bar shows current performance.', margin + 6, 166)

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 178, contentWidth, 92, 8, 8, 'F')
      doc.setFontSize(12)
      doc.setTextColor(23, 37, 34)
      doc.text('Parent narrative report', margin + 6, 190)
      doc.setFontSize(10)
      doc.setTextColor(63, 77, 75)
      doc.text(lines, margin + 6, 198)

      doc.save(`${selectedStudent.name.replace(/\s+/g, '-').toLowerCase()}-parent-report.pdf`)
      pushToast('success', 'PDF exported', `Parent report for ${selectedStudent.name} is ready.`)
    } catch (pdfError) {
      setError(pdfError.message)
      pushToast('error', 'PDF export failed', pdfError.message)
    }
  }

  async function handleCurriculumAnalyze() {
    if (!curriculumText.trim()) {
      pushToast('error', 'Curriculum missing', 'Paste or upload a curriculum before analysis.')
      return
    }

    setCurriculumLoading(true)
    setError('')

    try {
      const data = await apiFetch(
        '/api/curriculum/analyze',
        {
          method: 'POST',
          body: JSON.stringify({ curriculumText }),
        },
        token,
      )
      setCurriculumAnalysis(data.analysis)
      setCurriculumReport(data.report)
      setCurriculumProvider(data.provider)
      pushToast('success', 'Comparison ready', 'Curriculum gaps and market-fit analysis have been generated.')
    } catch (curriculumError) {
      setError(curriculumError.message)
      pushToast('error', 'Analysis failed', curriculumError.message)
    } finally {
      setCurriculumLoading(false)
    }
  }

  function handleCurriculumFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          setCurriculumLoading(true)
          const arrayBuffer = reader.result
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          bytes.forEach((byte) => {
            binary += String.fromCharCode(byte)
          })
          const fileBase64 = btoa(binary)

          const data = await apiFetch(
            '/api/curriculum/extract-pdf',
            {
              method: 'POST',
              body: JSON.stringify({ fileBase64 }),
            },
            token,
          )

          setCurriculumText(data.text)
          setCurriculumSourceMeta(`Extracted ${data.pages} page(s) from PDF`)
          pushToast('success', 'PDF imported', `Extracted curriculum text from ${data.pages} page(s).`)
        } catch (uploadError) {
          setError(uploadError.message)
          pushToast('error', 'PDF import failed', uploadError.message)
        } finally {
          setCurriculumLoading(false)
        }
      }
      reader.readAsArrayBuffer(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCurriculumText(String(reader.result || ''))
      setCurriculumSourceMeta(`Loaded text from ${file.name}`)
      pushToast('success', 'File loaded', `${file.name} is ready for comparison.`)
    }
    reader.readAsText(file)
  }

  function persistSession(nextToken, nextUser) {
    localStorage.setItem('edupilot-token', nextToken)
    setToken(nextToken)
    setCurrentUser(nextUser)
    setAuthError('')
  }

  function resetWorkspaceForStudentList(studentList, role) {
    setStudents(studentList)
    if (studentList.length > 0) {
      setSelectedId(studentList[0].id)
      setForm(formatStudentForForm(studentList[0]))
      setMode(role === 'mentor' ? 'edit' : 'view')
    } else {
      setSelectedId('')
      setForm(cloneDefaultForm())
      setMode(role === 'mentor' ? 'create' : 'view')
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
              role: authForm.role,
              inviteToken: authForm.inviteToken,
            }

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      persistSession(data.token, data.user)

      const profile = await apiFetch('/api/auth/me', {}, data.token)
      resetWorkspaceForStudentList(profile.students, profile.user.role)
      pushToast(
        'success',
        authMode === 'login' ? 'Welcome back' : 'Account created',
        authMode === 'login'
          ? `Signed in as ${profile.user.name}.`
          : `Your ${profile.user.role} account is ready.`,
      )
    } catch (submitError) {
      setAuthError(submitError.message)
      pushToast('error', 'Authentication failed', submitError.message)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('edupilot-token')
    setToken('')
    setCurrentUser(null)
    setStudents([])
    setSelectedId('')
    setForm(cloneDefaultForm())
    setMode('create')
  }

  function handleTopLevelChange(event) {
    const { name, value } = event.target
    const numericFields = new Set([
      'studyHours',
      'revisionHours',
      'mockScore',
      'attendance',
      'consistency',
      'practiceTests',
      'syllabusCompletion',
    ])

    setForm((current) => ({
      ...current,
      [name]: numericFields.has(name) ? Number(value) : value,
    }))
  }

  function handleSubjectChange(index, field, value) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, subjectIndex) =>
        subjectIndex === index
          ? {
              ...subject,
              [field]: ['score', 'benchmark', 'chaptersDone', 'totalChapters'].includes(field)
                ? Number(value)
                : value,
            }
          : subject,
      ),
    }))
  }

  function startCreateMode() {
    if (!canEdit) return
    setMode('create')
    setSelectedId('')
    setForm(cloneDefaultForm())
    setInterventionDraft({
      title: '',
      owner: '',
      dueDate: '',
      impact: 'Medium',
      notes: '',
    })
    setError('')
  }

  function selectStudent(student) {
    setSelectedId(student.id)
    setForm(formatStudentForForm(student))
    setMode(canEdit ? 'edit' : 'view')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!canEdit) return

    setSaving(true)
    setError('')

    try {
      const isEdit = mode === 'edit' && selectedId
      const data = await apiFetch(
        isEdit ? `/api/students/${selectedId}` : '/api/students',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(form),
        },
        token,
      )

      if (isEdit) {
        setStudents((current) => current.map((student) => (student.id === data.id ? data : student)))
      } else {
        setStudents((current) => [data, ...current])
      }

      setSelectedId(data.id)
      setForm(formatStudentForForm(data))
      setMode('edit')
      pushToast(
        'success',
        isEdit ? 'Student updated' : 'Student created',
        isEdit ? `${data.name}'s profile was saved.` : `${data.name} was added to the roster.`,
      )
    } catch (saveError) {
      setError(saveError.message)
      pushToast('error', 'Save failed', saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignmentSubmit(event) {
    event.preventDefault()
    if (!canEdit || !selectedId) return

    setSaving(true)
    setError('')

    try {
      await apiFetch(
        `/api/students/${selectedId}/invites`,
        {
          method: 'POST',
          body: JSON.stringify(assignmentDraft),
        },
        token,
      )

      const nextAssignments = await apiFetch(`/api/students/${selectedId}/assignments`, {}, token)
      setAssignments(nextAssignments)
      setAssignmentDraft({ name: '', email: '', role: 'parent' })
      pushToast('success', 'Assignment updated', 'The account was linked or an invite token was created.')
    } catch (assignmentError) {
      setError(assignmentError.message)
      pushToast('error', 'Assignment failed', assignmentError.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignedUser(userId) {
    if (!canEdit || !selectedId) return

    try {
      await apiFetch(`/api/students/${selectedId}/assignments/${userId}`, { method: 'DELETE' }, token)
      const nextAssignments = await apiFetch(`/api/students/${selectedId}/assignments`, {}, token)
      setAssignments(nextAssignments)
      pushToast('success', 'Access removed', 'The assigned account no longer has access to this learner.')
    } catch (assignmentError) {
      setError(assignmentError.message)
      pushToast('error', 'Remove failed', assignmentError.message)
    }
  }

  async function cancelInvite(inviteId) {
    if (!canEdit) return

    try {
      await apiFetch(`/api/invites/${inviteId}`, { method: 'DELETE' }, token)
      const nextAssignments = await apiFetch(`/api/students/${selectedId}/assignments`, {}, token)
      setAssignments(nextAssignments)
      pushToast('success', 'Invite cancelled', 'The pending invite token has been revoked.')
    } catch (inviteError) {
      setError(inviteError.message)
      pushToast('error', 'Cancel failed', inviteError.message)
    }
  }

  function addInterventionDraft() {
    if (!canEdit || !interventionDraft.title.trim()) return

    const nextIntervention = {
      id: crypto.randomUUID(),
      title: interventionDraft.title.trim(),
      owner: interventionDraft.owner.trim(),
      dueDate: interventionDraft.dueDate,
      impact: interventionDraft.impact,
      notes: interventionDraft.notes.trim(),
      status: 'Planned',
    }

    setForm((current) => ({
      ...current,
      interventions: [...(current.interventions || []), nextIntervention],
    }))

    setInterventionDraft({
      title: '',
      owner: '',
      dueDate: '',
      impact: 'Medium',
      notes: '',
    })
  }

  function removeIntervention(interventionId) {
    if (!canEdit) return

    setForm((current) => ({
      ...current,
      interventions: (current.interventions || []).filter((item) => item.id !== interventionId),
    }))
  }

  async function handleDeleteStudent() {
    if (!canEdit || !selectedId) return

    setSaving(true)
    setError('')

    try {
      await apiFetch(`/api/students/${selectedId}`, { method: 'DELETE' }, token)
      const nextStudents = students.filter((student) => student.id !== selectedId)
      setStudents(nextStudents)

      if (nextStudents.length > 0) {
        setSelectedId(nextStudents[0].id)
        setForm(formatStudentForForm(nextStudents[0]))
        setMode('edit')
      } else {
        startCreateMode()
      }
      pushToast('success', 'Student deleted', 'The student record and related access links were removed.')
    } catch (deleteError) {
      setError(deleteError.message)
      pushToast('error', 'Delete failed', deleteError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!token || !currentUser) {
    return (
      <main className="app-shell">
        <section className="auth-shell">
          <div className="hero-copy auth-copy">
            <span className="eyebrow">EduPilot access layer</span>
            <h1>Sign in to the role-based student intelligence platform.</h1>
            <p className="hero-text">
              Mentors can manage records, students can view recovery plans, and parents get a focused progress summary.
            </p>
            <div className="demo-card">
              <h3>Demo accounts</h3>
              <ul>
                {demoCredentials.map((item) => (
                  <li key={item.role}>
                    <strong>{item.role}</strong>
                    <span>{item.email}</span>
                    <code>{item.password}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="panel auth-panel">
            <div className="auth-tabs">
              <button
                type="button"
                className={`ghost-button ${authMode === 'login' ? 'is-selected' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`ghost-button ${authMode === 'register' ? 'is-selected' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>

            <form className="student-form" onSubmit={handleAuthSubmit}>
              {authMode === 'register' ? (
                <label>
                  <span>Full name</span>
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Your name"
                  />
                </label>
              ) : null}

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Enter password"
                />
              </label>

              {authMode === 'register' ? (
                <label>
                  <span>Role</span>
                  <select
                    value={authForm.role}
                    onChange={(event) => setAuthForm((current) => ({ ...current, role: event.target.value }))}
                  >
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                    <option value="mentor">Mentor</option>
                  </select>
                </label>
              ) : null}

              {authMode === 'register' ? (
                <label>
                  <span>Invite token</span>
                  <input
                    value={authForm.inviteToken}
                    onChange={(event) => setAuthForm((current) => ({ ...current, inviteToken: event.target.value }))}
                    placeholder="Optional token from mentor"
                  />
                </label>
              ) : null}

              {authError ? <p className="error-copy">{authError}</p> : null}

              <button type="submit" className="primary-link button-link" disabled={authLoading}>
                {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login to dashboard' : 'Create account'}
              </button>
            </form>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <ToastStack toasts={toasts} dismissToast={dismissToast} />
      <section className="top-nav">
        <NavButton active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')}>
          Student intelligence
        </NavButton>
        <NavButton active={activeView === 'curriculum'} onClick={() => setActiveView('curriculum')}>
          Curriculum comparison
        </NavButton>
        <NavButton active={activeView === 'settings'} onClick={() => setActiveView('settings')}>
          Platform settings
        </NavButton>
      </section>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">{roleHeader?.title || 'EduPilot workspace'}</span>
          <h1>EduPilot now supports authenticated access and role-aware dashboards.</h1>
          <p className="hero-text">
            {roleHeader?.description} This makes the product much closer to a real startup app:
            secure access, user roles, protected records, and student-specific analytics.
          </p>
          <div className="hero-actions">
            <a href="#workspace" className="primary-link">Open workspace</a>
            <button type="button" className="secondary-link plain-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="signal-card">
          <p>Signed in as</p>
          <h2>{currentUser.name}</h2>
          <ul className="signal-list">
            <li>
              <span>Role</span>
              <strong>{currentUser.role}</strong>
            </li>
            <li>
              <span>Visible students</span>
              <strong>{students.length}</strong>
            </li>
            <li>
              <span>Current target</span>
              <strong>{selectedStudent.target}</strong>
            </li>
            <li>
              <span>Student status</span>
              <strong>{selectedStudent.status || analytics.overallRisk}</strong>
            </li>
            <li>
              <span>Storage mode</span>
              <strong>{systemHealth?.storage === 'postgres' ? 'Postgres live' : systemHealth?.storage === 'json' ? 'JSON fallback' : 'Checking'}</strong>
            </li>
            <li>
              <span>AI reports</span>
              <strong>{systemHealth?.aiReports === 'openai' ? 'OpenAI enabled' : systemHealth?.aiReports === 'fallback' ? 'Fallback mode' : 'Checking'}</strong>
            </li>
          </ul>
        </div>
      </section>

      {activeView === 'dashboard' ? (
        <>
      <section className="workspace-grid" id="workspace">
        <aside className="panel student-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Student records</span>
              <h2>{canEdit ? 'Mentor roster' : 'Assigned learners'}</h2>
            </div>
            {canEdit ? (
              <button type="button" className="ghost-button" onClick={startCreateMode}>
                New profile
              </button>
            ) : null}
          </div>
          <div className="student-toolbar">
            <input
              className="toolbar-input"
              placeholder="Search by name, exam, city"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              className="toolbar-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="On Track">On Track</option>
              <option value="Watchlist">Watchlist</option>
              <option value="At Risk">At Risk</option>
            </select>
          </div>
          <div className="mini-stats">
            <span>Total {studentCounts.total}</span>
            <span>Watchlist {studentCounts.watchlist}</span>
            <span>At Risk {studentCounts.atRisk}</span>
          </div>
          {loading ? <LoadingSkeleton lines={4} card /> : null}
          <div className="student-list">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                type="button"
                className={`student-list__item ${student.id === selectedId && mode !== 'create' ? 'is-active' : ''}`}
                onClick={() => selectStudent(student)}
              >
                <div className="student-list__row">
                  <strong>{student.name}</strong>
                  <span className={`risk-chip ${statusTone[student.status]}`}>{student.status}</span>
                </div>
                <span>{student.target}</span>
                <small>{student.city || 'City not set'}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{canEdit ? 'Input layer' : 'Access summary'}</span>
              <h2>
                {canEdit
                  ? mode === 'edit'
                    ? 'Update student profile'
                    : 'Create a new student profile'
                  : 'Read-only academic summary'}
              </h2>
            </div>
          </div>
          {canEdit ? (
            <form className="student-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  <span>Name</span>
                  <input name="name" value={form.name} onChange={handleTopLevelChange} placeholder="Student name" />
                </label>
                <label>
                  <span>Target exam</span>
                  <select name="target" value={form.target} onChange={handleTopLevelChange}>
                    {Object.keys(benchmarkMap).map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Class</span>
                  <input name="classLevel" value={form.classLevel} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>City</span>
                  <input name="city" value={form.city} onChange={handleTopLevelChange} placeholder="Kota, Delhi, Pune..." />
                </label>
                <label>
                  <span>Study hours/day</span>
                  <input name="studyHours" type="number" step="0.1" value={form.studyHours} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Revision hours/day</span>
                  <input name="revisionHours" type="number" step="0.1" value={form.revisionHours} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Mock score</span>
                  <input
                    name="mockScore"
                    type="number"
                    max={getBenchmark(form.target).totalMarks}
                    value={form.mockScore}
                    onChange={handleTopLevelChange}
                  />
                </label>
                <label>
                  <span>Syllabus completion %</span>
                  <input name="syllabusCompletion" type="number" value={form.syllabusCompletion} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Attendance %</span>
                  <input name="attendance" type="number" value={form.attendance} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Consistency /100</span>
                  <input name="consistency" type="number" value={form.consistency} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Practice tests/week</span>
                  <input name="practiceTests" type="number" value={form.practiceTests} onChange={handleTopLevelChange} />
                </label>
                <label>
                  <span>Student status</span>
                  <select name="status" value={form.status} onChange={handleTopLevelChange}>
                    <option value="On Track">On Track</option>
                    <option value="Watchlist">Watchlist</option>
                    <option value="At Risk">At Risk</option>
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select name="priority" value={form.priority} onChange={handleTopLevelChange}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
                <label>
                  <span>Next review date</span>
                  <input name="nextReviewDate" type="date" value={form.nextReviewDate} onChange={handleTopLevelChange} />
                </label>
                <label className="subject-editor-card__wide">
                  <span>Mentor notes</span>
                  <textarea name="mentorNotes" value={form.mentorNotes} onChange={handleTopLevelChange} rows="4" />
                </label>
              </div>

              <div className="subjects-editor">
                <div className="subjects-editor__header">
                  <span className="eyebrow">Subject inputs</span>
                  <p>These values drive the analytics engine and chapter gap detection.</p>
                </div>
                {form.subjects.map((subject, index) => (
                  <div key={subject.name} className="subject-editor-card">
                    <h3>{subject.name}</h3>
                    <div className="form-grid compact">
                      <label>
                        <span>Score %</span>
                        <input type="number" value={subject.score} onChange={(event) => handleSubjectChange(index, 'score', event.target.value)} />
                      </label>
                      <label>
                        <span>Benchmark %</span>
                        <input type="number" value={subject.benchmark} onChange={(event) => handleSubjectChange(index, 'benchmark', event.target.value)} />
                      </label>
                      <label>
                        <span>Chapters done</span>
                        <input type="number" value={subject.chaptersDone} onChange={(event) => handleSubjectChange(index, 'chaptersDone', event.target.value)} />
                      </label>
                      <label>
                        <span>Total chapters</span>
                        <input type="number" value={subject.totalChapters} onChange={(event) => handleSubjectChange(index, 'totalChapters', event.target.value)} />
                      </label>
                      <label className="subject-editor-card__wide">
                        <span>Weak topic</span>
                        <input value={subject.weakTopic} onChange={(event) => handleSubjectChange(index, 'weakTopic', event.target.value)} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="subjects-editor">
                <div className="subjects-editor__header">
                  <span className="eyebrow">Intervention tracker</span>
                  <p>Track concrete mentor actions instead of only storing analysis.</p>
                </div>
                <div className="form-grid compact">
                  <label>
                    <span>Intervention title</span>
                    <input
                      value={interventionDraft.title}
                      onChange={(event) => setInterventionDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Physics sprint, revision reset..."
                    />
                  </label>
                  <label>
                    <span>Owner</span>
                    <input
                      value={interventionDraft.owner}
                      onChange={(event) => setInterventionDraft((current) => ({ ...current, owner: event.target.value }))}
                      placeholder="Mentor or student owner"
                    />
                  </label>
                  <label>
                    <span>Due date</span>
                    <input
                      type="date"
                      value={interventionDraft.dueDate}
                      onChange={(event) => setInterventionDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Impact</span>
                    <select
                      value={interventionDraft.impact}
                      onChange={(event) => setInterventionDraft((current) => ({ ...current, impact: event.target.value }))}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  <label className="subject-editor-card__wide">
                    <span>Notes</span>
                    <textarea
                      rows="3"
                      value={interventionDraft.notes}
                      onChange={(event) => setInterventionDraft((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="form-actions form-actions--split">
                  <button type="button" className="secondary-link plain-button" onClick={addInterventionDraft}>
                    Add intervention
                  </button>
                  {mode === 'edit' ? (
                    <button type="button" className="danger-button" onClick={handleDeleteStudent} disabled={saving}>
                      Delete student
                    </button>
                  ) : null}
                </div>
                <div className="intervention-list">
                  {(form.interventions || []).map((item) => (
                    <div key={item.id} className="intervention-list__item">
                      <InterventionCard item={item} />
                      <button type="button" className="ghost-button" onClick={() => removeIntervention(item.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="subjects-editor">
                <div className="subjects-editor__header">
                  <span className="eyebrow">Assignments and invites</span>
                  <p>Connect a student or parent account to this learner, or generate a pending invite token.</p>
                </div>
                <div className="student-form assignment-form">
                  <div className="form-grid compact">
                    <label>
                      <span>Name</span>
                      <input
                        value={assignmentDraft.name}
                        onChange={(event) => setAssignmentDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Person name"
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        value={assignmentDraft.email}
                        onChange={(event) => setAssignmentDraft((current) => ({ ...current, email: event.target.value }))}
                        placeholder="student or parent email"
                      />
                    </label>
                    <label>
                      <span>Role</span>
                      <select
                        value={assignmentDraft.role}
                        onChange={(event) => setAssignmentDraft((current) => ({ ...current, role: event.target.value }))}
                      >
                        <option value="parent">Parent</option>
                        <option value="student">Student</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="secondary-link plain-button" disabled={saving} onClick={handleAssignmentSubmit}>
                      Link or invite
                    </button>
                  </div>
                </div>
                <div className="assignment-columns">
                  <div className="assignment-block">
                    <h3>Assigned accounts</h3>
                    <div className="intervention-list">
                      {assignments.users.length ? (
                        assignments.users.map((item) => (
                          <div key={item.id} className="intervention-list__item">
                            <div className="assignment-row">
                              <div>
                                <strong>{item.name}</strong>
                                <p>{item.email}</p>
                              </div>
                              <span className={`risk-chip ${statusTone[item.role === 'parent' ? 'Watchlist' : 'On Track']}`}>
                                {item.role}
                              </span>
                            </div>
                            <button type="button" className="ghost-button" onClick={() => removeAssignedUser(item.id)}>
                              Remove access
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="muted-copy">No assigned student/parent accounts yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="assignment-block">
                    <h3>Pending invites</h3>
                    <div className="intervention-list">
                      {assignments.invites.length ? (
                        assignments.invites.map((invite) => (
                          <div key={invite.id} className="intervention-list__item">
                            <div className="assignment-row">
                              <div>
                                <strong>{invite.name || invite.email}</strong>
                                <p>{invite.email}</p>
                              </div>
                              <span className="risk-chip risk-medium">{invite.role}</span>
                            </div>
                            <code className="invite-token">Token: {invite.token}</code>
                            <button type="button" className="ghost-button" onClick={() => cancelInvite(invite.id)}>
                              Cancel invite
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="muted-copy">No pending invites for this learner.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error ? <p className="error-copy">{error}</p> : null}

              <div className="form-actions">
                <button type="submit" className="primary-link button-link" disabled={saving}>
                  {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create student'}
                </button>
              </div>
            </form>
          ) : (
            <div className="access-summary">
              <div className="summary-card">
                <h3>Logged-in account</h3>
                <p>{currentUser.email}</p>
              </div>
              <div className="summary-card">
                <h3>What you can do</h3>
                <p>
                  {currentUser.role === 'student'
                    ? 'Review your benchmark gap, subject risks, and weekly recovery plan.'
                    : 'Monitor progress, routine stability, and key intervention areas for your child.'}
                </p>
              </div>
              <div className="summary-card">
                <h3>Editing access</h3>
                <p>Only mentor accounts can create or update student records in this prototype.</p>
              </div>
              <div className="summary-card">
                <h3>Next mentor review</h3>
                <p>{selectedStudent.nextReviewDate || 'No review scheduled yet.'}</p>
              </div>
              <div className="summary-card">
                <h3>Mentor notes</h3>
                <p>{selectedStudent.mentorNotes || 'No mentor note added yet.'}</p>
              </div>
            </div>
          )}
        </section>
      </section>
      <section className="section-grid" id="dashboard">
        <div className="section-heading">
          <span className="eyebrow">Executive dashboard</span>
          <h2>Live analysis generated from protected student data</h2>
        </div>
        <div className="metrics-grid">
          <MetricCard
            label="Syllabus completion"
            value={`${selectedStudent.syllabusCompletion}%`}
            helper={`Benchmark expects ${analytics.benchmark.benchmarkCompletion}% by this week.`}
          />
          <MetricCard
            label="Daily focused hours"
            value={`${selectedStudent.studyHours} hrs`}
            helper={`Ideal benchmark routine is ${analytics.benchmark.idealHours} hrs/day.`}
            tone="warm"
          />
          <MetricCard
            label="Revision share"
            value={`${analytics.revisionShare}%`}
            helper={`Healthy benchmark is ${analytics.idealRevisionShare}% of study time.`}
          />
          <MetricCard
            label="Consistency score"
            value={`${selectedStudent.consistency}/100`}
            helper={`Attendance is ${selectedStudent.attendance}% across sessions and tests.`}
            tone="cool"
          />
        </div>
      </section>

      {canEdit ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Cohort analytics</span>
                <h2>Institute-wide performance pulse</h2>
              </div>
            </div>
            <div className="metrics-grid metrics-grid--compact">
              <MetricCard
                label="Avg completion"
                value={`${cohort.averageCompletion}%`}
                helper="Across all active learners"
              />
              <MetricCard
                label="Avg consistency"
                value={`${cohort.averageConsistency}/100`}
                helper="Habit stability across the cohort"
                tone="cool"
              />
              <MetricCard
                label="Avg study load"
                value={`${cohort.averageStudyHours} hrs`}
                helper="Average focused study time"
                tone="warm"
              />
              <MetricCard
                label="At risk learners"
                value={`${cohort.riskCounts.atRisk}`}
                helper={`Watchlist: ${cohort.riskCounts.watchlist}, On Track: ${cohort.riskCounts.onTrack}`}
              />
            </div>
            <div className="assignment-columns">
              <div className="assignment-block">
                <h3>Upcoming reviews</h3>
                <div className="intervention-list">
                  {cohort.upcomingReviews.map((student) => (
                    <div key={student.id} className="intervention-list__item">
                      <strong>{student.name}</strong>
                      <p>{student.nextReviewDate}</p>
                      <span className={`risk-chip ${statusTone[student.status]}`}>{student.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="assignment-block">
                <h3>Weakest subjects in cohort</h3>
                <div className="intervention-list">
                  {cohort.subjectLeaders.slice(0, 3).map((subject) => (
                    <div key={subject.name} className="intervention-list__item">
                      <strong>{subject.name}</strong>
                      <p>
                        Avg {subject.score}% vs benchmark {subject.benchmark}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Suspense fallback={<LoadingSkeleton lines={4} card />}>
              <CohortCharts riskChartData={riskChartData} subjectGapChartData={subjectGapChartData} />
            </Suspense>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Mentor report</span>
                <h2>Ready-to-share review draft</h2>
              </div>
            </div>
            <textarea className="report-box" readOnly value={mentorReport} rows="18" />
          </article>
        </section>
      ) : null}

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Parent report</span>
              <h2>Shareable family-facing update</h2>
            </div>
            <button type="button" className="secondary-link plain-button" onClick={exportParentReportPdf}>
              Export PDF
            </button>
          </div>
          <p className="muted-copy report-meta">
            Report source: {parentReportProvider === 'openai' ? 'OpenAI-generated' : 'Structured fallback generator'}
          </p>
          {parentReportLoading ? (
            <LoadingSkeleton lines={8} card />
          ) : (
            <textarea
              className="report-box"
              readOnly
              value={parentReport || 'Loading report...'}
              rows="18"
            />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Target mix</span>
              <h2>Cohort exam distribution</h2>
            </div>
          </div>
          <div className="intervention-list">
            {cohort.targetMix.map((item) => (
              <div key={item.label} className="intervention-list__item">
                <strong>{item.label}</strong>
                <p>{item.value} learner(s)</p>
                <ProgressBar value={item.value} max={Math.max(...cohort.targetMix.map((entry) => entry.value), 1)} tone="teal" />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Mentor summary</span>
              <h2>What this week needs most</h2>
            </div>
          </div>
          <div className="summary-highlight">
            <span className={`risk-chip ${statusTone[selectedStudent.status || analytics.overallRisk]}`}>
              {selectedStudent.status || analytics.overallRisk}
            </span>
            <p>{analytics.narrativeSummary}</p>
            <div className="summary-meta">
              <span>Priority: {selectedStudent.priority || 'Medium'}</span>
              <span>Next review: {selectedStudent.nextReviewDate || 'Not scheduled'}</span>
              <span>Open interventions: {analytics.interventionHealth}</span>
            </div>
            <div className="mentor-note-box">
              <h3>Mentor note</h3>
              <p>{selectedStudent.mentorNotes || 'No mentor note recorded yet.'}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Interventions</span>
              <h2>Operational follow-ups</h2>
            </div>
          </div>
          <div className="intervention-list">
            {(selectedStudent.interventions || []).length ? (
              (selectedStudent.interventions || []).map((item) => <InterventionCard key={item.id} item={item} />)
            ) : (
              <p className="muted-copy">No interventions tracked yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Benchmark engine</span>
              <h2>Reference systems this student is measured against</h2>
            </div>
          </div>
          <div className="benchmark-list">
            {analytics.instituteBenchmarks.map((item) => (
              <article key={item.name} className="benchmark-card">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Routine diagnosis</span>
              <h2>Behavior patterns driving the outcome</h2>
            </div>
          </div>
          <div className="routine-stack">
            {analytics.routines.map((routine) => (
              <div key={routine.label} className="routine-row">
                <div className="routine-topline">
                  <h3>{routine.label}</h3>
                  <strong>{routine.actual} / {routine.target}</strong>
                </div>
                <ProgressBar value={routine.actual} max={routine.target} tone="teal" />
                <p>{routine.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Subject analytics</span>
              <h2>Where the biggest performance drag exists</h2>
            </div>
          </div>
          <div className="subject-grid">
            {analytics.subjectPerformance.map((subject) => (
              <SubjectCard key={subject.name} subject={subject} />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Gap detection</span>
              <h2>Priority chapter interventions</h2>
            </div>
          </div>
          <div className="gap-table">
            {analytics.gapChapters.map((gap) => (
              <article key={`${gap.subject}-${gap.chapter}`} className="gap-row">
                <div>
                  <h3>{gap.chapter} <span>{gap.subject}</span></h3>
                  <p>{gap.reason}</p>
                </div>
                <div className="gap-metrics">
                  <div>
                    <span>Mastery</span>
                    <strong>{gap.mastery}%</strong>
                  </div>
                  <div>
                    <span>Benchmark</span>
                    <strong>{gap.benchmark}%</strong>
                  </div>
                </div>
                <p className="gap-action">{gap.action}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="plan-panel">
        <div className="section-heading">
          <span className="eyebrow">Recommendation engine</span>
          <h2>Auto-generated weekly recovery plan</h2>
        </div>
        <div className="plan-grid">
          {analytics.weeklyPlan.map((block) => (
            <article key={`${block.window}-${block.title}`} className="plan-card">
              <span>{block.window}</span>
              <h3>{block.title}</h3>
              <ul>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-panel" id="architecture">
        <div className="section-heading">
          <span className="eyebrow">Product architecture</span>
          <h2>Current system layers in this prototype</h2>
        </div>
        <div className="architecture-grid">
          <article>
            <h3>1. Auth layer</h3>
            <p>Users register and sign in, and the server validates a signed token on protected routes.</p>
          </article>
          <article>
            <h3>2. Role access</h3>
            <p>Mentors can edit data, while parents and students see only the learners assigned to them.</p>
          </article>
          <article>
            <h3>3. Storage layer</h3>
            <p>Local JSON powers development, while normalized Postgres migrations now define the production data model.</p>
          </article>
          <article>
            <h3>4. Runtime health</h3>
            <p>
              Current runtime: {systemHealth?.storage === 'postgres' ? 'Postgres enabled' : systemHealth?.storage === 'json' ? 'JSON fallback active' : 'health check pending'} with{' '}
              {systemHealth?.aiReports === 'openai' ? 'OpenAI reports enabled' : systemHealth?.aiReports === 'fallback' ? 'fallback report generation' : 'AI status pending'}.
            </p>
          </article>
          <article>
            <h3>5. Input layer</h3>
            <p>Mentors can enter routines, scores, chapter coverage, and weak topics from the web form.</p>
          </article>
          <article>
            <h3>6. Analytics layer</h3>
            <p>The client computes benchmark gaps, subject risk, routine deficits, and chapter priority.</p>
          </article>
          <article>
            <h3>7. Expansion path</h3>
            <p>Next upgrades can include proper SQL models, password reset, invite flows, and AI counseling.</p>
          </article>
        </div>
      </section>
        </>
      ) : activeView === 'curriculum' ? (
        <Suspense fallback={<LoadingSkeleton lines={8} card />}>
          <CurriculumComparisonPage
            curriculumText={curriculumText}
            setCurriculumText={setCurriculumText}
            curriculumLoading={curriculumLoading}
            handleCurriculumAnalyze={handleCurriculumAnalyze}
            handleCurriculumFileUpload={handleCurriculumFileUpload}
            curriculumSourceMeta={curriculumSourceMeta}
            curriculumProvider={curriculumProvider}
            curriculumReport={curriculumReport}
            curriculumAnalysis={curriculumAnalysis}
            MetricCard={MetricCard}
            LoadingSkeleton={LoadingSkeleton}
          />
        </Suspense>
      ) : (
        <EnvironmentStatusCard
          systemHealth={systemHealth}
          healthLoading={healthLoading}
          refreshSystemHealth={handleRefreshHealth}
          testConnection={handleTestConnection}
          copyCommand={handleCopyCommand}
        />
      )}
    </main>
  )
}

export default App
