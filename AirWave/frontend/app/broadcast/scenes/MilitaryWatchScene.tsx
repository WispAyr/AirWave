'use client';

import { useEffect, useState, useMemo } from 'react';
import { ACARSMessage, HFGCSAircraft, EAMMessage, MilitaryWatchConfig } from '@/app/types';
import dynamic from 'next/dynamic';
import { Shield, Plane, AlertTriangle } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });

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

interface MilitaryWatchSceneProps {
  focusRegion: string;
  config: MilitaryWatchConfig;
  aircraft: ACARSMessage[];
  hfgcsAircraft: HFGCSAircraft[];
  eamMessages: EAMMessage[];
}

const REGION_CENTERS: Record<string, { lat: number; lon: number; zoom: number }> = {
  conus: { lat: 39.8283, lon: -98.5795, zoom: 4 },
  europe: { lat: 50.0, lon: 10.0, zoom: 4 },
  northatlantic: { lat: 50.0, lon: -30.0, zoom: 3 },
  global: { lat: 20.0, lon: 0.0, zoom: 2 },
};

const formatDuration = (firstSeen: string): string => {
  const duration = Math.floor((new Date().getTime() - new Date(firstSeen).getTime()) / 1000);
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatTimeAgo = (timestamp: string): string => {
  const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function MilitaryWatchScene({
  focusRegion,
  config,
  aircraft,
  hfgcsAircraft,
  eamMessages,
}: MilitaryWatchSceneProps) {
  const [mapCenter] = useState(REGION_CENTERS[focusRegion] || REGION_CENTERS.global);

  const militaryAircraft = useMemo(() => {
    return aircraft.filter(a => {
      // Filter for US military aircraft
      if (a.hex && a.hex.startsWith('ae')) return true;
      
      // Filter by aircraft type
      if (a.aircraft_type) {
        const type = a.aircraft_type.toUpperCase();
        return config.highlightTypes.some(t => type.includes(t));
      }
      
      return false;
    });
  }, [aircraft, config.highlightTypes]);

  const tacamoAircraft = useMemo(() => {
    return hfgcsAircraft.filter(a => a.type?.includes('E-6'));
  }, [hfgcsAircraft]);

  const nightwatchAircraft = useMemo(() => {
    return hfgcsAircraft.filter(a => a.type?.includes('E-4'));
  }, [hfgcsAircraft]);

  const tankers = useMemo(() => {
    return militaryAircraft.filter(a => 
      a.aircraft_type?.includes('KC-135') || 
      a.aircraft_type?.includes('KC-46') ||
      a.aircraft_type?.includes('KC-10')
    );
  }, [militaryAircraft]);

  const statistics = useMemo(() => {
    const byType: Record<string, number> = {};
    militaryAircraft.forEach(a => {
      const type = a.aircraft_type || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: militaryAircraft.length,
      tacamo: tacamoAircraft.length,
      nightwatch: nightwatchAircraft.length,
      tankers: tankers.length,
      byType,
    };
  }, [militaryAircraft, tacamoAircraft, nightwatchAircraft, tankers]);

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <div className="absolute inset-0">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lon]}
            zoom={mapCenter.zoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* TACAMO markers with radius */}
            {tacamoAircraft.map((a) => {
              if (!a.position) return null;
              return (
                <div key={a.id}>
                  <Marker position={[a.position.lat, a.position.lon]}>
                    <Popup>
                      <div className="text-sm">
                        <strong className="text-orange-400">TACAMO E-6B</strong><br />
                        Callsign: {a.callsign || 'Unknown'}<br />
                        Altitude: {a.position.altitude || 'Unknown'}ft<br />
                        Mission: {formatDuration(a.first_seen)}<br />
                        Detection: {a.detection_method}
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[a.position.lat, a.position.lon]}
                    radius={50000}
                    pathOptions={{ color: 'orange', fillOpacity: 0.05, weight: 1, className: 'pulse-animation' }}
                  />
                </div>
              );
            })}

            {/* Nightwatch markers */}
            {nightwatchAircraft.map((a) => {
              if (!a.position) return null;
              return (
                <div key={a.id}>
                  <Marker position={[a.position.lat, a.position.lon]}>
                    <Popup>
                      <div className="text-sm">
                        <strong className="text-purple-400">NIGHTWATCH E-4B</strong><br />
                        Callsign: {a.callsign || 'Unknown'}<br />
                        Altitude: {a.position.altitude || 'Unknown'}ft<br />
                        Mission: {formatDuration(a.first_seen)}<br />
                        Detection: {a.detection_method}
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[a.position.lat, a.position.lon]}
                    radius={50000}
                    pathOptions={{ color: 'purple', fillOpacity: 0.05, weight: 1, className: 'pulse-animation' }}
                  />
                </div>
              );
            })}

            {/* Tanker markers with refueling radius */}
            {tankers.map((a) => {
              if (!a.position) return null;
              return (
                <div key={a.id}>
                  <Marker position={[a.position.lat, a.position.lon]}>
                    <Popup>
                      <div className="text-sm">
                        <strong className="text-blue-400">{a.aircraft_type}</strong><br />
                        Callsign: {a.flight || a.hex}<br />
                        Altitude: {a.position.altitude || 'Unknown'}ft
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[a.position.lat, a.position.lon]}
                    radius={46300} // 25nm radius
                    pathOptions={{ color: 'blue', fillOpacity: 0.02, weight: 1, dashArray: '5, 5' }}
                  />
                </div>
              );
            })}

            {/* Other military aircraft */}
            {militaryAircraft.filter(a => 
              !tankers.includes(a)
            ).map((a) => {
              if (!a.position) return null;
              return (
                <Marker key={a.id} position={[a.position.lat, a.position.lon]}>
                  <Popup>
                    <div className="text-sm">
                      <strong>{a.aircraft_type || 'Military'}</strong><br />
                      Callsign: {a.flight || a.hex}<br />
                      Altitude: {a.position.altitude || 'Unknown'}ft
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Info Panel */}
      <div className="absolute top-4 right-4 w-96 bg-black/90 backdrop-blur-md border border-red-500/30 rounded-lg p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-red-500/30 pb-3">
            <Shield className="w-5 h-5 text-red-400" />
            <h3 className="text-xl font-bold text-red-400">Military Watch</h3>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-500/10 rounded p-2">
              <div className="text-2xl font-bold text-red-400">{statistics.total}</div>
              <div className="text-xs text-gray-400">Military Aircraft</div>
            </div>
            <div className="bg-orange-500/10 rounded p-2">
              <div className="text-2xl font-bold text-orange-400">{statistics.tacamo}</div>
              <div className="text-xs text-gray-400">TACAMO</div>
            </div>
            <div className="bg-purple-500/10 rounded p-2">
              <div className="text-2xl font-bold text-purple-400">{statistics.nightwatch}</div>
              <div className="text-xs text-gray-400">Nightwatch</div>
            </div>
            <div className="bg-blue-500/10 rounded p-2">
              <div className="text-2xl font-bold text-blue-400">{statistics.tankers}</div>
              <div className="text-xs text-gray-400">Tankers</div>
            </div>
          </div>

          {/* HFGCS Aircraft */}
          {hfgcsAircraft.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Active HFGCS Aircraft
              </h4>
              <div className="space-y-2">
                {hfgcsAircraft.map((a) => (
                  <div key={a.id} className="bg-gray-800/50 border border-orange-500/30 rounded p-3 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-orange-400">
                        {a.type || 'Unknown Type'}
                      </span>
                      <span className="text-gray-400">{formatDuration(a.first_seen)}</span>
                    </div>
                    <div className="space-y-1 text-gray-300">
                      <div>Callsign: {a.callsign || 'Unknown'}</div>
                      {a.position && (
                        <div>
                          Position: {a.position.lat.toFixed(2)}°, {a.position.lon.toFixed(2)}°
                        </div>
                      )}
                      {a.position?.altitude && (
                        <div>Altitude: {a.position.altitude}ft</div>
                      )}
                      <div className="text-gray-500">Detection: {a.detection_method}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent EAMs */}
          {eamMessages.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-red-400 mb-2">Recent EAMs</h4>
              <div className="space-y-2">
                {eamMessages.slice(0, 5).map((eam) => (
                  <div key={eam.id} className="bg-red-900/20 border border-red-500/30 rounded p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-red-400">{eam.type}</span>
                      <span className="text-gray-400">{formatTimeAgo(eam.timestamp)}</span>
                    </div>
                    <div className="text-gray-300 mb-1">
                      Confidence: {eam.confidence}%
                    </div>
                    {eam.header && (
                      <div className="text-gray-400 font-mono text-xs">
                        Header: {eam.header}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tanker Operations */}
          {tankers.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-blue-400 mb-2">Tanker Operations</h4>
              <div className="space-y-2">
                {tankers.map((t) => {
                  const nearby = militaryAircraft.filter(a => 
                    a.id !== t.id && 
                    a.position && t.position &&
                    Math.abs(a.position.lat - t.position.lat) < 1 &&
                    Math.abs(a.position.lon - t.position.lon) < 1
                  );

                  return (
                    <div key={t.id} className="bg-blue-900/20 border border-blue-500/30 rounded p-2 text-xs">
                      <div className="font-bold text-blue-400">{t.flight || t.hex}</div>
                      <div className="text-gray-300">{t.aircraft_type}</div>
                      {t.position && (
                        <div className="text-gray-400">
                          {t.position.altitude || 'Unknown'}ft
                        </div>
                      )}
                      {nearby.length > 0 && (
                        <div className="text-gray-500 mt-1">
                          {nearby.length} aircraft nearby
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
            <span className="text-gray-400">TACAMO</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-gray-400">Nightwatch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-gray-400">Tanker</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className="text-gray-400">Military</span>
          </div>
        </div>
      </div>
    </div>
  );
}

