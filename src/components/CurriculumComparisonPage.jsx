import { Suspense, lazy } from 'react'

const CurriculumCharts = lazy(() => import('./CurriculumCharts.jsx'))

function CurriculumComparisonPage(props) {
  const {
    curriculumText,
    setCurriculumText,
    curriculumLoading,
    handleCurriculumAnalyze,
    handleCurriculumFileUpload,
    curriculumSourceMeta,
    curriculumProvider,
    curriculumReport,
    curriculumAnalysis,
  } = props
  const MetricCardComponent = props.MetricCard
  const LoadingSkeleton = props.LoadingSkeleton

  return (
    <section className="curriculum-page">
      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">AI curriculum comparison</span>
              <h2>Compare university curriculum with top institutes and market demand</h2>
            </div>
          </div>
          <p className="hero-text">
            Upload or paste your college syllabus or curriculum outline. EduPilot compares it against
            benchmark skills inspired by IIT/NIT/IIIT-style expectations and current job-oriented skill clusters.
          </p>
          <div className="curriculum-actions">
            <label className="secondary-link plain-button file-button">
              Upload curriculum file
              <input type="file" accept=".txt,.md,.csv,.pdf" onChange={handleCurriculumFileUpload} hidden />
            </label>
            <button type="button" className="primary-link" onClick={handleCurriculumAnalyze} disabled={curriculumLoading}>
              {curriculumLoading ? 'Analyzing...' : 'Analyze curriculum'}
            </button>
          </div>
          {curriculumSourceMeta ? <p className="muted-copy report-meta">{curriculumSourceMeta}</p> : null}
          <textarea
            className="report-box curriculum-input"
            rows="18"
            placeholder="Paste semester syllabus, subject list, lab curriculum, electives, and project components here, or upload a PDF..."
            value={curriculumText}
            onChange={(event) => setCurriculumText(event.target.value)}
          />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Comparison result</span>
              <h2>Where the student is lacking and what to learn next</h2>
            </div>
          </div>
          <p className="muted-copy report-meta">
            Report source: {curriculumProvider === 'openai' ? 'OpenAI-generated' : 'Structured fallback generator'}
          </p>
          <textarea
            className="report-box"
            readOnly
            rows="18"
            value={curriculumReport || 'Run the comparison to generate an institute and market gap report.'}
          />
        </article>
      </div>

      {curriculumAnalysis ? (
        <div className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Readiness summary</span>
                <h2>Benchmark alignment snapshot</h2>
              </div>
            </div>
            <div className="metrics-grid metrics-grid--compact">
              <MetricCardComponent
                label="Readiness score"
                value={`${curriculumAnalysis.readinessScore}/100`}
                helper="Combined academic and market alignment"
              />
              <MetricCardComponent
                label="Matched institute skills"
                value={`${curriculumAnalysis.matchedInstituteSkills.length}`}
                helper="Topics already visible in the curriculum"
                tone="cool"
              />
              <MetricCardComponent
                label="Missing market skills"
                value={`${curriculumAnalysis.missingMarketSkills.length}`}
                helper="Job-facing competencies to add"
                tone="warm"
              />
              <MetricCardComponent
                label="Matched market skills"
                value={`${curriculumAnalysis.matchedMarketSkills.length}`}
                helper="Employability-aligned coverage"
              />
            </div>
            <Suspense fallback={LoadingSkeleton ? <LoadingSkeleton lines={4} card /> : <p className="muted-copy">Loading charts...</p>}>
              <CurriculumCharts
                roleFit={curriculumAnalysis.roleFit}
                missingMarketSkills={curriculumAnalysis.missingMarketSkills}
              />
            </Suspense>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Institute comparison</span>
                <h2>How your syllabus compares with top benchmarks</h2>
              </div>
            </div>
            <div className="intervention-list">
              {curriculumAnalysis.topInstituteGap.map((item) => (
                <div key={item.name} className="intervention-list__item">
                  <strong>{item.name}</strong>
                  <p>Matched: {item.matched.join(', ') || 'None yet'}</p>
                  <p>Missing: {item.missing.slice(0, 6).join(', ') || 'No major gaps'}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}

export default CurriculumComparisonPage
