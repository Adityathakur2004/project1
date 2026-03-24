import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function CohortCharts({ riskChartData, subjectGapChartData }) {
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <h3>Risk distribution</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={riskChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={84}>
              {riskChartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Subject benchmark gaps</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={subjectGapChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23,37,34,0.08)" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="score" fill="#0f7870" radius={[8, 8, 0, 0]} />
            <Bar dataKey="benchmark" fill="#f2b167" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CohortCharts
