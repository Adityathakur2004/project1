import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function CurriculumCharts({ roleFit, missingMarketSkills }) {
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <h3>Role fit comparison</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={roleFit}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23,37,34,0.08)" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="score" fill="#0f7870" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Major skill gaps</h3>
        <div className="intervention-list">
          {missingMarketSkills.slice(0, 8).map((skill) => (
            <div key={skill} className="intervention-list__item">
              <strong>{skill}</strong>
              <p>Add this through projects, labs, electives, or self-study.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CurriculumCharts
