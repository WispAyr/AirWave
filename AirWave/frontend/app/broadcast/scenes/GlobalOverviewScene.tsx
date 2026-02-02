'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { ACARSMessage, GlobalOverviewConfig, DatabaseStats, DataSourceStats } from '@/app/types';
import dynamic from 'next/dynamic';
import { Globe, Activity, Database } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const useMap = dynamic(() => import('react-leaflet').then(mod => mod.useMap), { ssr: false });

if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
  import('leaflet').then(L => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  });
}

interface GlobalOverviewSceneProps {
  config: GlobalOverviewConfig;
  aircraft: ACARSMessage[];
  statistics: DatabaseStats | null;
  dataSourceStats: Record<string, DataSourceStats>;
}

export default function GlobalOverviewScene({
  config,
  aircraft,
  statistics,
  dataSourceStats,
}: GlobalOverviewSceneProps) {
  const [messageRate, setMessageRate] = useState<number>(0);
  const [previousAircraftCount, setPreviousAircraftCount] = useState<number>(0);
  const [messageCountHistory, setMessageCountHistory] = useState<number[]>([]);

  // Compute message rate (messages per minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const totalMessages = Object.values(dataSourceStats).reduce((sum, s) => sum + (s.messages || 0), 0);
      setMessageCountHistory(prev => {
        const updated = [...prev, totalMessages];
        const last = updated.slice(-6); // Keep last 60 seconds (10s intervals)
        
        if (last.length >= 2) {
          const rate = ((last[last.length - 1] - last[0]) / (last.length - 1)) * 6; // Convert to per minute
          setMessageRate(Math.round(rate));
        }
        
        return last;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [dataSourceStats]);

  // Limit aircraft for performance
  const displayAircraft = useMemo(() => {
    return aircraft
      .filter(a => a.position)
      .slice(0, config.maxAircraft || 500);
  }, [aircraft, config.maxAircraft]);

  const regionalStats = useMemo(() => {
    const regions = {
      'North America': 0,
      'Europe': 0,
      'Asia': 0,
      'Other': 0,
    };

    displayAircraft.forEach(a => {
      if (!a.position) return;
      const { lat, lon } = a.position;

      if (lat >= 15 && lat <= 72 && lon >= -170 && lon <= -50) {
        regions['North America']++;
      } else if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) {
        regions['Europe']++;
      } else if (lat >= -10 && lat <= 55 && lon >= 60 && lon <= 150) {
        regions['Asia']++;
      } else {
        regions['Other']++;
      }
    });

    return regions;
  }, [displayAircraft]);

  const altitudeBands = useMemo(() => {
    const bands = {
      'Ground': 0,
      '0-10,000ft': 0,
      '10,000-30,000ft': 0,
      '30,000ft+': 0,
    };

    displayAircraft.forEach(a => {
      const alt = Number(a.position?.altitude) || 0;
      if (alt === 0 || a.on_ground) {
        bands['Ground']++;
      } else if (alt < 10000) {
        bands['0-10,000ft']++;
      } else if (alt < 30000) {
        bands['10,000-30,000ft']++;
      } else {
        bands['30,000ft+']++;
      }
    });

    return bands;
  }, [displayAircraft]);

  const topAirlines = useMemo(() => {
    const airlineCounts: Record<string, number> = {};
    
    displayAircraft.forEach(a => {
      if (a.airline) {
        airlineCounts[a.airline] = (airlineCounts[a.airline] || 0) + 1;
      }
    });

    return Object.entries(airlineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [displayAircraft]);

  const dataSourceStatus = useMemo(() => {
    const active = Object.values(dataSourceStats).filter(s => s.connected).length;
    const total = Object.keys(dataSourceStats).length;
    return { active, total };
  }, [dataSourceStats]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!config.showHeatmap) return [];
    
    return displayAircraft
      .filter(a => a.position)
      .map(a => ({
        lat: a.position!.lat,
        lng: a.position!.lon,
        intensity: 0.5 + (Math.min(Number(a.position?.altitude) || 0, 40000) / 80000), // Higher altitude = more intensity
      }));
  }, [displayAircraft, config.showHeatmap]);

  // Heatmap layer component
  const HeatmapLayer = () => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (!config.showHeatmap || heatmapData.length === 0) return;

      // Create canvas overlay
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '400';
      
      const container = map.getContainer();
      container.appendChild(canvas);
      canvasRef.current = canvas;

      const updateHeatmap = () => {
        const size = map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw heat points
        heatmapData.forEach(point => {
          const latLng = map.latLngToContainerPoint([point.lat, point.lng]);
          
          const gradient = ctx.createRadialGradient(latLng.x, latLng.y, 0, latLng.x, latLng.y, 30);
          gradient.addColorStop(0, `rgba(255, 0, 0, ${point.intensity})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 0, ${point.intensity * 0.5})`);
          gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(latLng.x - 30, latLng.y - 30, 60, 60);
        });
      };

      updateHeatmap();
      map.on('move', updateHeatmap);
      map.on('zoom', updateHeatmap);

      return () => {
        map.off('move', updateHeatmap);
        map.off('zoom', updateHeatmap);
        if (canvasRef.current && container.contains(canvasRef.current)) {
          container.removeChild(canvasRef.current);
        }
      };
    }, [map, heatmapData, config.showHeatmap]);

    return null;
  };

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <div className="absolute inset-0">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Heatmap layer */}
            {config.showHeatmap && <HeatmapLayer />}

            {/* Aircraft markers */}
            {!config.showHeatmap && displayAircraft.map((a) => {
              if (!a.position) return null;
              
              return (
                <Marker 
                  key={a.id} 
                  position={[a.position.lat, a.position.lon]}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{a.flight || a.hex}</strong><br />
                      {a.aircraft_type && <span>Type: {a.aircraft_type}<br /></span>}
                      {a.airline && <span>Airline: {a.airline}<br /></span>}
                      Altitude: {a.position.altitude || 'Unknown'}ft<br />
                      {a.ground_speed && <span>Speed: {a.ground_speed}kts</span>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Info Panel */}
      <div className="absolute top-4 right-4 w-96 bg-black/90 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-cyan-500/30 pb-3">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className="text-xl font-bold text-cyan-400">Global Overview</h3>
          </div>

          {/* Main Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 bg-cyan-500/10 rounded p-3">
              <div className="text-3xl font-bold text-cyan-400">{displayAircraft.length}</div>
              <div className="text-xs text-gray-400">Aircraft Tracked</div>
            </div>
            <div className="bg-green-500/10 rounded p-2">
              <div className="text-xl font-bold text-green-400">{statistics?.total_messages || 0}</div>
              <div className="text-xs text-gray-400">Total Messages</div>
            </div>
            <div className="bg-blue-500/10 rounded p-2">
              <div className="text-xl font-bold text-blue-400">{messageRate}</div>
              <div className="text-xs text-gray-400">Messages/min</div>
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <h4 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Data Sources
            </h4>
            <div className="space-y-2">
              {Object.entries(dataSourceStats).map(([source, stats]) => (
                <div key={source} className="bg-gray-800/50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white capitalize">{source}</span>
                    <span className={`w-2 h-2 rounded-full ${stats.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  {stats.tracked_aircraft !== undefined && (
                    <div className="text-gray-400">
                      Aircraft: {stats.tracked_aircraft}
                    </div>
                  )}
                  {stats.message_count !== undefined && (
                    <div className="text-gray-400">
                      Messages: {stats.message_count}
                    </div>
                  )}
                </div>
              ))}
              <div className="text-xs text-gray-500 mt-2">
                {dataSourceStatus.active} of {dataSourceStatus.total} sources active
              </div>
            </div>
          </div>

          {/* Regional Distribution */}
          <div>
            <h4 className="text-sm font-bold text-cyan-400 mb-2">By Region</h4>
            <div className="space-y-1">
              {Object.entries(regionalStats).map(([region, count]) => (
                <div key={region} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{region}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Altitude Bands */}
          <div>
            <h4 className="text-sm font-bold text-cyan-400 mb-2">By Altitude</h4>
            <div className="space-y-1">
              {Object.entries(altitudeBands).map(([band, count]) => (
                <div key={band} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{band}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Airlines */}
          {topAirlines.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-cyan-400 mb-2">Top Airlines</h4>
              <div className="space-y-1">
                {topAirlines.map(([airline, count], index) => (
                  <div key={airline} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      {index + 1}. {airline}
                    </span>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Database Stats */}
          {statistics && (
            <div>
              <h4 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Aircraft</span>
                  <span className="text-white">{statistics.total_aircraft}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Aircraft</span>
                  <span className="text-white">{statistics.active_aircraft}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Database Size</span>
                  <span className="text-white">{statistics.database_size_mb}MB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Info */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400">Displaying:</span>
          <span className="text-white font-bold">{displayAircraft.length} / {aircraft.length} aircraft</span>
          {config.clusterMarkers && (
            <span className="text-gray-500">(Clustering enabled)</span>
          )}
        </div>
      </div>
    </div>
  );
}

