'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

interface TrackPoint {
  timestamp: string
  altitude?: string | number
  vertical_rate?: number
}

interface AltitudeChartProps {
  trackPoints: TrackPoint[]
  className?: string
}

export default function AltitudeChart({ trackPoints, className = '' }: AltitudeChartProps) {
  const chartData = useMemo(() => {
    return trackPoints
      .filter(p => p.altitude !== undefined && p.altitude !== null)
      .map(point => {
        // Parse altitude - might be string or number
        const altStr = typeof point.altitude === 'string' ? point.altitude : String(point.altitude)
        const altitude = parseInt(altStr.replace(/[^\d]/g, '')) || 0
        
        return {
          timestamp: new Date(point.timestamp).getTime(),
          altitude: altitude,
          vertical_rate: point.vertical_rate || 0,
          time: format(new Date(point.timestamp), 'HH:mm'),
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [trackPoints])

  // Separate data into climb/cruise/descent segments for color coding
  const { climbData, cruiseData, descentData } = useMemo(() => {
    const climb: typeof chartData = []
    const cruise: typeof chartData = []
    const descent: typeof chartData = []
    
    chartData.forEach((point, idx) => {
      const vr = point.vertical_rate
      
      // Threshold for cruise: vertical rate between -300 and +300 fpm
      if (vr > 300) {
        climb.push(point)
        cruise.push({ ...point, altitude: null as any })
        descent.push({ ...point, altitude: null as any })
      } else if (vr < -300) {
        descent.push(point)
        climb.push({ ...point, altitude: null as any })
        cruise.push({ ...point, altitude: null as any })
      } else {
        cruise.push(point)
        climb.push({ ...point, altitude: null as any })
        descent.push({ ...point, altitude: null as any })
      }
    })
    
    return { climbData: climb, cruiseData: cruise, descentData: descent }
  }, [chartData])

  const { minAlt, maxAlt } = useMemo(() => {
    if (chartData.length === 0) return { minAlt: 0, maxAlt: 40000 }
    
    const altitudes = chartData.map(d => d.altitude)
    const min = Math.min(...altitudes)
    const max = Math.max(...altitudes)
    
    // Add 10% padding
    const padding = (max - min) * 0.1
    
    return {
      minAlt: Math.max(0, Math.floor((min - padding) / 1000) * 1000),
      maxAlt: Math.ceil((max + padding) / 1000) * 1000
    }
  }, [chartData])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-spacex-darker border border-cyan-400/50 rounded p-3 font-mono text-xs">
          <div className="text-spacex-accent font-bold mb-1">{data.time}</div>
          <div className="text-white">
            Altitude: <span className="text-cyan-400">{data.altitude.toLocaleString()}ft</span>
          </div>
          {data.vertical_rate !== 0 && (
            <div className={data.vertical_rate > 0 ? 'text-green-400' : 'text-orange-400'}>
              V/S: {data.vertical_rate > 0 ? '+' : ''}{data.vertical_rate}fpm
            </div>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className={`data-card rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-bold text-spacex-accent font-mono mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          ALTITUDE PROFILE
        </h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-30" />
            <p className="text-gray-500 font-mono text-sm">No altitude data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`data-card rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-spacex-accent font-mono flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          ALTITUDE PROFILE
        </h3>
        <div className="text-sm font-mono text-gray-400">
          {minAlt.toLocaleString()} - {maxAlt.toLocaleString()}ft
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            style={{ fontSize: '11px', fontFamily: 'monospace' }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '11px', fontFamily: 'monospace' }}
            tick={{ fill: '#6b7280' }}
            domain={[minAlt, maxAlt]}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Climb segments - green */}
          <Line
            type="monotone"
            dataKey="altitude"
            data={climbData}
            stroke="#00ff41"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: '#00ff41' }}
            connectNulls={false}
          />
          
          {/* Cruise segments - cyan */}
          <Line
            type="monotone"
            dataKey="altitude"
            data={cruiseData}
            stroke="#00d8ff"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: '#00d8ff' }}
            connectNulls={false}
          />
          
          {/* Descent segments - orange */}
          <Line
            type="monotone"
            dataKey="altitude"
            data={descentData}
            stroke="#fb923c"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: '#fb923c' }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend and stats */}
      <div className="mt-4 space-y-3">
        {/* Color legend */}
        <div className="flex items-center justify-center space-x-4 text-xs font-mono">
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-green-400 mr-1.5"></div>
            <span className="text-gray-400">CLIMB</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-cyan-400 mr-1.5"></div>
            <span className="text-gray-400">CRUISE</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-orange-400 mr-1.5"></div>
            <span className="text-gray-400">DESCENT</span>
          </div>
        </div>
        
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
          <div className="text-center">
            <div className="text-gray-500">MAX ALT</div>
            <div className="text-spacex-accent font-bold">
              {Math.max(...chartData.map(d => d.altitude)).toLocaleString()}ft
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">DATA POINTS</div>
            <div className="text-cyan-400 font-bold">{chartData.length}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">CURRENT ALT</div>
            <div className="text-spacex-green font-bold">
              {chartData[chartData.length - 1]?.altitude.toLocaleString() || 0}ft
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

