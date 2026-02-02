'use client';

import { useEffect, useState, useMemo } from 'react';
import { ACARSMessage } from '@/app/types';
import dynamic from 'next/dynamic';
import { Plane, Navigation, Activity, MapPin, Clock } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });

if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
}

interface AircraftTrackingSceneProps {
  aircraft: ACARSMessage;
  flightHistory: ACARSMessage[];
}

export default function AircraftTrackingScene({ aircraft, flightHistory }: AircraftTrackingSceneProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().substr(0, 19).replace('T', ' ') + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate flight path from history
  const flightPath = useMemo(() => {
    return flightHistory
      .filter(pos => pos.position && pos.position.lat && pos.position.lon)
      .map(pos => [pos.position!.lat, pos.position!.lon] as [number, number]);
  }, [flightHistory]);

  // Altitude history for profile graph
  const altitudeHistory = useMemo(() => {
    return flightHistory
      .filter(pos => pos.position && pos.position.altitude)
      .map(pos => ({
        timestamp: pos.timestamp,
        altitude: pos.position!.altitude || 0,
      }));
  }, [flightHistory]);

  // Calculate stats
  const stats = useMemo(() => {
    const alts = altitudeHistory.map(h => h.altitude).filter(a => a > 0);
    return {
      min: alts.length > 0 ? Math.min(...alts) : 0,
      max: alts.length > 0 ? Math.max(...alts) : 0,
      avg: alts.length > 0 ? Math.round(alts.reduce((a, b) => a + b, 0) / alts.length) : 0,
      positions: flightHistory.length,
    };
  }, [altitudeHistory, flightHistory]);

  const currentPosition = aircraft.position;
  const mapCenter: [number, number] = currentPosition 
    ? [currentPosition.lat, currentPosition.lon] 
    : [39.33, -73.84];

  return (
    <div className="relative w-full h-full bg-[#0a0e1a]">
      {/* Main Map */}
      <div className="absolute inset-0">
        {typeof window !== 'undefined' && currentPosition && (
          <MapContainer
            center={mapCenter}
            zoom={8}
            style={{ height: '100%', width: '100%', background: '#0a0e1a' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
            />

            {/* Flight Path */}
            {flightPath.length > 1 && (
              <Polyline
                positions={flightPath}
                pathOptions={{
                  color: '#00d9ff',
                  weight: 3,
                  opacity: 0.8,
                }}
              />
            )}

            {/* Historical positions */}
            {flightPath.map((pos, idx) => (
              <CircleMarker
                key={`pos-${idx}`}
                center={pos}
                radius={3}
                pathOptions={{
                  color: '#00d9ff',
                  fillColor: '#00d9ff',
                  fillOpacity: 0.6,
                  weight: 1,
                }}
              />
            ))}

            {/* Current position */}
            {currentPosition && (
              <CircleMarker
                center={[currentPosition.lat, currentPosition.lon]}
                radius={12}
                pathOptions={{
                  color: '#00ff88',
                  fillColor: '#00ff88',
                  fillOpacity: 0.8,
                  weight: 3,
                }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Aircraft Info Card - Top Left */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-[#0a1628]/95 border-2 border-cyan-500/50 rounded-lg p-4 min-w-[320px] backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-3xl font-bold text-cyan-400 tracking-wider">
                {aircraft.flight || aircraft.tail || 'UNKNOWN'}
              </h1>
              <p className="text-sm text-gray-400 font-mono mt-1">
                {aircraft.hex || aircraft.tail} • {aircraft.registration || 'N/A'}
              </p>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1 bg-cyan-500/20 rounded border border-cyan-500/50">
              <Plane className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono text-cyan-300">EN ROUTE</span>
            </div>
          </div>

          {/* Flight Level Display */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {aircraft.on_ground ? 'Ground Speed' : 'Altitude'}
            </div>
            <div className="text-4xl font-bold text-cyan-400 tabular-nums">
              {aircraft.on_ground ? '0 kts' : `FL${Math.floor((currentPosition?.altitude || 0) / 100)}`}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-cyan-500/30">
            <div>
              <div className="text-xs text-gray-500 uppercase">Altitude</div>
              <div className="text-lg font-bold text-green-400 tabular-nums">
                {aircraft.on_ground ? 'FL205' : `FL${Math.floor((currentPosition?.altitude || 0) / 100)}`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Ground Speed</div>
              <div className="text-lg font-bold text-white tabular-nums">
                {currentPosition?.groundspeed || 0} kts
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Positions</div>
              <div className="text-lg font-bold text-yellow-400 tabular-nums">
                {stats.positions}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Telemetry - Top Right */}
      <div className="absolute top-4 right-4 z-[1000]">
        <div className="bg-[#0a1628]/95 border-2 border-green-500/50 rounded-lg p-4 min-w-[280px] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">
              Live Telemetry
            </h3>
            <Activity className="w-4 h-4 text-green-400 animate-pulse" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Altitude</span>
              <span className="text-xl font-bold text-green-400 tabular-nums">
                {(currentPosition?.altitude || 0).toLocaleString()} ft
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Speed</span>
              <span className="text-xl font-bold text-green-400 tabular-nums">
                {currentPosition?.groundspeed || 0} kts
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Heading</span>
              <span className="text-xl font-bold text-green-400 tabular-nums">
                {currentPosition?.track || 0}°
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Position Info - Bottom Left */}
      <div className="absolute bottom-24 left-4 z-[1000]">
        <div className="bg-[#0a1628]/95 border border-cyan-500/50 rounded-lg p-3 min-w-[240px] backdrop-blur-sm">
          <div className="text-xs text-gray-500 uppercase mb-1">Position</div>
          <div className="text-sm font-mono text-cyan-400">
            {currentPosition?.lat.toFixed(6)}°, {currentPosition?.lon.toFixed(6)}°
          </div>
          <div className="text-xs text-gray-500 uppercase mt-2 mb-1">Timestamp</div>
          <div className="text-xs font-mono text-gray-400">{currentTime}</div>
        </div>
      </div>

      {/* Mission Control Branding - Bottom Right */}
      <div className="absolute bottom-24 right-4 z-[1000]">
        <div className="bg-[#0a1628]/95 border border-cyan-500/50 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-cyan-400">AIRWAVE</div>
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
            Mission Control
          </div>
        </div>
      </div>

      {/* Altitude Profile - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 z-[1000] bg-[#0a1628]/95 border-t-2 border-cyan-500/50 backdrop-blur-sm">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Altitude Profile
            </h3>
            <div className="text-xs font-mono text-gray-400 space-x-4">
              <span>MIN <span className="text-cyan-400">FL{Math.floor(stats.min / 100)}</span></span>
              <span>MAX <span className="text-cyan-400">FL{Math.floor(stats.max / 100)}</span></span>
              <span>AVG <span className="text-cyan-400">FL{Math.floor(stats.avg / 100)}</span></span>
            </div>
          </div>
          
          {/* Altitude Graph */}
          <div className="relative h-10 bg-gradient-to-r from-cyan-900/20 to-cyan-800/20 rounded">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="altGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#00d9ff" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {altitudeHistory.length > 1 && (
                <polyline
                  fill="url(#altGradient)"
                  stroke="#00d9ff"
                  strokeWidth="2"
                  points={altitudeHistory.map((point, idx) => {
                    const x = (idx / (altitudeHistory.length - 1)) * 100;
                    const y = 100 - ((point.altitude - stats.min) / (stats.max - stats.min || 1)) * 100;
                    return `${x},${y}`;
                  }).join(' ')}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}




