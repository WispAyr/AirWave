import { useMessageStore } from '../store/messageStore'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useMemo } from 'react'

const COLORS = {
  oooi: '#00ff41',
  position: '#0075c9',
  weather: '#60a5fa',
  cpdlc: '#00d8ff',
  atc_request: '#00d8ff',
  performance: '#fbbf24',
  freetext: '#9ca3af',
}

export default function MessageTypeChart() {
  const messages = useMessageStore((state) => state.messages)
  
  const data = useMemo(() => {
    const byCategory: Record<string, number> = {}
    messages.forEach(msg => {
      if (msg.category) {
        byCategory[msg.category] = (byCategory[msg.category] || 0) + 1
      }
    })
    
    return Object.entries(byCategory).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
      color: COLORS[name as keyof typeof COLORS] || '#6b7280',
    }))
  }, [messages.length]) // Only recalculate when message count changes

  if (data.length === 0) {
    return (
      <div className="data-card rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-gray-500 font-mono text-sm">NO DATA</p>
      </div>
    )
  }

  return (
    <div className="data-card rounded-lg p-4">
      <h3 className="text-sm font-bold text-spacex-accent font-mono mb-4">MESSAGE TYPES</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #2d2d2d',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

