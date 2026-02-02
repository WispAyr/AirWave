'use client';

import { useEffect, useState, useMemo } from 'react';
import { ACARSMessage } from '@/app/types';
import dynamic from 'next/dynamic';
import { Plane, MapPin, Radio, Activity, Navigation } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });
const Rectangle = dynamic(() => import('react-leaflet').then(mod => mod.Rectangle), { ssr: false });

if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css');
  import('leaflet').then(L => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
    });
  });
}

interface EGPKGroundSceneProps {
  aircraft: ACARSMessage[];
}

// EGPK Airport Reference Point (Glasgow Prestwick International)
const EGPK_CENTER = { lat: 55.5094, lon: -4.5867 };

// EGPK Runway Definitions (Corrected actual coordinates)
const RUNWAYS = [
  {
    name: 'RWY 13/31',
    coords: [
      [55.5198, -4.6050],  // Runway 13 threshold
      [55.4990, -4.5684]   // Runway 31 threshold
    ],
    heading: 130,
    length: 2987, // meters
  },
  {
    name: 'RWY 03/21', 
    coords: [
      [55.5042, -4.5802],  // Runway 03 threshold  
      [55.5146, -4.5932]   // Runway 21 threshold
    ],
    heading: 30,
    length: 1829, // meters
  }
];

// Terminal and Parking Areas (Corrected positions)
const TERMINAL_AREA = {
  bounds: [
    [55.5070, -4.5920],
    [55.5100, -4.5870]
  ]
};

const PARKING_STANDS = [
  // Main terminal stands (west side)
  { id: '1', lat: 55.5082, lon: -4.5905, occupied: false },
  { id: '2', lat: 55.5084, lon: -4.5900, occupied: false },
  { id: '3', lat: 55.5086, lon: -4.5895, occupied: false },
  { id: '4', lat: 55.5088, lon: -4.5890, occupied: false },
  { id: '5', lat: 55.5090, lon: -4.5885, occupied: false },
  { id: '6', lat: 55.5092, lon: -4.5880, occupied: false },
  { id: '7', lat: 55.5094, lon: -4.5875, occupied: false },
  { id: '8', lat: 55.5096, lon: -4.5870, occupied: false },
  // Remote stands (north apron)
  { id: 'R1', lat: 55.5110, lon: -4.5920, occupied: false },
  { id: 'R2', lat: 55.5113, lon: -4.5915, occupied: false },
  { id: 'R3', lat: 55.5116, lon: -4.5910, occupied: false },
  { id: 'R4', lat: 55.5119, lon: -4.5905, occupied: false },
];

const TAXIWAYS = [
  // Main taxiway parallel to RWY 13/31
  {
    name: 'TWY A',
    coords: [
      [55.5193, -4.6045],
      [55.4995, -4.5689]
    ]
  },
  // Connecting taxiway to terminal
  {
    name: 'TWY B',
    coords: [
      [55.5095, -4.5875],
      [55.5070, -4.5845]
    ]
  },
  // Parallel taxiway
  {
    name: 'TWY C',
    coords: [
      [55.5140, -4.5940],
      [55.5050, -4.5750]
    ]
  }
];

export default function EGPKGroundScene({ aircraft }: EGPKGroundSceneProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toISOString().substr(11, 8) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter aircraft at or near EGPK
  const egpkAircraft = useMemo(() => {
    return aircraft.filter(a => {
      if (!a.position) return false;
      const { lat, lon } = a.position;
      
      // Within ~10nm radius of EGPK
      const latDiff = Math.abs(lat - EGPK_CENTER.lat);
      const lonDiff = Math.abs(lon - EGPK_CENTER.lon);
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
      
      return distance < 0.15; // Approximately 10nm
    });
  }, [aircraft]);

  // Aircraft on ground vs airborne
  const groundAircraft = useMemo(() => 
    egpkAircraft.filter(a => a.on_ground || (a.position && a.position.altitude < 500)),
  [egpkAircraft]);

  const airborneNearby = useMemo(() =>
    egpkAircraft.filter(a => !a.on_ground && a.position && a.position.altitude >= 500),
  [egpkAircraft]);

  // Update parking stand occupancy
  const occupiedStands = useMemo(() => {
    const occupied = new Set<string>();
    
    groundAircraft.forEach(a => {
      if (!a.position) return;
      
      // Find nearest parking stand
      let minDist = Infinity;
      let nearestStand = '';
      
      PARKING_STANDS.forEach(stand => {
        const latDiff = a.position!.lat - stand.lat;
        const lonDiff = a.position!.lon - stand.lon;
        const dist = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
        
        if (dist < minDist && dist < 0.0005) { // Very close proximity
          minDist = dist;
          nearestStand = stand.id;
        }
      });
      
      if (nearestStand) {
        occupied.add(nearestStand);
      }
    });
    
    return occupied;
  }, [groundAircraft]);

  return (
    <div className="relative w-full h-full bg-spacex-darker">
      {/* Map */}
      <div className="absolute inset-0">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[EGPK_CENTER.lat, EGPK_CENTER.lon]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            minZoom={12}
            maxZoom={18}
          >
            {/* Satellite imagery for better ground detail */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Esri, Maxar, GeoEye'
            />
            
            {/* Overlay with labels */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
              opacity={0.7}
            />

            {/* Runways */}
            {RUNWAYS.map((runway, idx) => (
              <Polyline
                key={`runway-${idx}`}
                positions={runway.coords as [number, number][]}
                pathOptions={{
                  color: '#ffffff',
                  weight: 30,
                  opacity: 0.7,
                }}
              >
                <Popup>
                  <div className="font-mono text-sm">
                    <strong>{runway.name}</strong><br />
                    Length: {runway.length}m<br />
                    Heading: {runway.heading}°
                  </div>
                </Popup>
              </Polyline>
            ))}

            {/* Runway centerline */}
            {RUNWAYS.map((runway, idx) => (
              <Polyline
                key={`runway-center-${idx}`}
                positions={runway.coords as [number, number][]}
                pathOptions={{
                  color: '#ffff00',
                  weight: 2,
                  opacity: 0.8,
                  dashArray: '10, 10'
                }}
              />
            ))}

            {/* Taxiways */}
            {TAXIWAYS.map((taxiway, idx) => (
              <Polyline
                key={`taxiway-${idx}`}
                positions={taxiway.coords as [number, number][]}
                pathOptions={{
                  color: '#ffff00',
                  weight: 8,
                  opacity: 0.5,
                }}
              >
                <Popup>
                  <div className="font-mono text-sm">
                    {taxiway.name}
                  </div>
                </Popup>
              </Polyline>
            ))}

            {/* Terminal Area */}
            <Rectangle
              bounds={TERMINAL_AREA.bounds as [[number, number], [number, number]]}
              pathOptions={{
                color: '#00ff00',
                weight: 2,
                opacity: 0.6,
                fill: true,
                fillColor: '#00ff00',
                fillOpacity: 0.1
              }}
            >
              <Popup>
                <div className="font-mono text-sm">
                  <strong>Terminal Area</strong>
                </div>
              </Popup>
            </Rectangle>

            {/* Parking Stands */}
            {PARKING_STANDS.map(stand => (
              <Circle
                key={`stand-${stand.id}`}
                center={[stand.lat, stand.lon]}
                radius={20}
                pathOptions={{
                  color: occupiedStands.has(stand.id) ? '#ff0000' : '#00ff00',
                  weight: 2,
                  opacity: 0.8,
                  fill: true,
                  fillColor: occupiedStands.has(stand.id) ? '#ff0000' : '#00ff00',
                  fillOpacity: 0.3
                }}
              >
                <Popup>
                  <div className="font-mono text-sm">
                    <strong>Stand {stand.id}</strong><br />
                    Status: {occupiedStands.has(stand.id) ? 'Occupied' : 'Available'}
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Ground Aircraft */}
            {groundAircraft.map(a => {
              if (!a.position) return null;
              
              return (
                <Marker
                  key={`ground-${a.id}`}
                  position={[a.position.lat, a.position.lon]}
                  icon={
                    typeof window !== 'undefined' && (window as any).L
                      ? new (window as any).L.DivIcon({
                          className: 'custom-aircraft-icon',
                          html: `
                            <div class="relative" style="transform: rotate(${a.position.track || 0}deg);">
                              <svg width="30" height="30" viewBox="0 0 30 30">
                                <circle cx="15" cy="15" r="12" fill="#ff0000" opacity="0.6"/>
                                <path d="M15,5 L18,20 L15,18 L12,20 Z" fill="#ffffff"/>
                              </svg>
                            </div>
                          `,
                          iconSize: [30, 30],
                          iconAnchor: [15, 15],
                        })
                      : undefined
                  }
                >
                  <Popup>
                    <div className="font-mono text-sm">
                      <strong>{a.flight || a.tail || 'Unknown'}</strong><br />
                      {a.tail && <span>Tail: {a.tail}<br /></span>}
                      Status: On Ground<br />
                      Track: {a.position.track}°<br />
                      {a.airline && <span>Airline: {a.airline}<br /></span>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Airborne Aircraft Nearby */}
            {airborneNearby.map(a => {
              if (!a.position) return null;
              
              return (
                <Marker
                  key={`air-${a.id}`}
                  position={[a.position.lat, a.position.lon]}
                  icon={
                    typeof window !== 'undefined' && (window as any).L
                      ? new (window as any).L.DivIcon({
                          className: 'custom-aircraft-icon',
                          html: `
                            <div class="relative" style="transform: rotate(${a.position.track || 0}deg);">
                              <svg width="24" height="24" viewBox="0 0 24 24">
                                <path d="M12,2 L14,14 L12,13 L10,14 Z" fill="#00ff00" opacity="0.8"/>
                              </svg>
                            </div>
                          `,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12],
                        })
                      : undefined
                  }
                >
                  <Popup>
                    <div className="font-mono text-sm">
                      <strong>{a.flight || a.tail || 'Unknown'}</strong><br />
                      {a.tail && <span>Tail: {a.tail}<br /></span>}
                      Altitude: {a.position.altitude}ft<br />
                      Track: {a.position.track}°<br />
                      {a.position.groundspeed && <span>Speed: {a.position.groundspeed}kts<br /></span>}
                      {a.airline && <span>Airline: {a.airline}<br /></span>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Airport Center Marker */}
            <Circle
              center={[EGPK_CENTER.lat, EGPK_CENTER.lon]}
              radius={100}
              pathOptions={{
                color: '#00ffff',
                weight: 2,
                opacity: 0.6,
                fill: true,
                fillColor: '#00ffff',
                fillOpacity: 0.2
              }}
            >
              <Popup>
                <div className="font-mono text-sm">
                  <strong>EGPK</strong><br />
                  Glasgow Prestwick<br />
                  International Airport
                </div>
              </Popup>
            </Circle>
          </MapContainer>
        )}
      </div>

      {/* Info Panel Overlay */}
      <div className="absolute top-4 right-4 w-80 space-y-4 pointer-events-none z-[1000]">
        {/* Header Card */}
        <div className="data-card p-4 pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">EGPK GROUND VIEW</h2>
            </div>
            <Activity className="w-5 h-5 text-green-400 animate-pulse" />
          </div>
          <p className="text-sm text-gray-400 font-mono">Glasgow Prestwick International</p>
          <p className="text-xs text-gray-500 font-mono mt-1">{currentTime}</p>
        </div>

        {/* Statistics Card */}
        <div className="data-card p-4 pointer-events-auto">
          <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center space-x-2">
            <Plane className="w-4 h-4" />
            <span>TRAFFIC STATUS</span>
          </h3>
          
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">On Ground:</span>
              <span className="text-white font-bold">{groundAircraft.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nearby Airborne:</span>
              <span className="text-white font-bold">{airborneNearby.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total in Area:</span>
              <span className="text-white font-bold">{egpkAircraft.length}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2"></div>
            <div className="flex justify-between">
              <span className="text-gray-400">Stands Available:</span>
              <span className="text-green-400 font-bold">
                {PARKING_STANDS.length - occupiedStands.size}/{PARKING_STANDS.length}
              </span>
            </div>
          </div>
        </div>

        {/* Active Runways */}
        <div className="data-card p-4 pointer-events-auto">
          <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center space-x-2">
            <Navigation className="w-4 h-4" />
            <span>ACTIVE RUNWAYS</span>
          </h3>
          
          <div className="space-y-2 text-sm font-mono">
            {RUNWAYS.map(rwy => (
              <div key={rwy.name} className="flex justify-between items-center">
                <span className="text-white font-bold">{rwy.name}</span>
                <div className="text-right">
                  <div className="text-gray-400 text-xs">{rwy.length}m</div>
                  <div className="text-gray-500 text-xs">{rwy.heading}°</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ground Aircraft List */}
        {groundAircraft.length > 0 && (
          <div className="data-card p-4 max-h-64 overflow-y-auto pointer-events-auto">
            <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center space-x-2">
              <Radio className="w-4 h-4" />
              <span>GROUND TRAFFIC</span>
            </h3>
            
            <div className="space-y-2">
              {groundAircraft.map(a => (
                <div key={a.id} className="flex justify-between items-center text-xs font-mono pb-2 border-b border-gray-800">
                  <div>
                    <div className="text-white font-bold">{a.flight || a.tail || 'N/A'}</div>
                    {a.airline && <div className="text-gray-500">{a.airline}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400">{a.position?.track || 0}°</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="data-card p-4 pointer-events-auto">
          <h3 className="text-sm font-bold text-cyan-400 mb-3">LEGEND</h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white opacity-70"></div>
              <span className="text-gray-400">Runways</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-yellow-400"></div>
              <span className="text-gray-400">Taxiways</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-400">Available Stand</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-400">Occupied Stand</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500 opacity-60"></div>
              <span className="text-gray-400">Ground Aircraft</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500"></div>
              <span className="text-gray-400">Airborne Aircraft</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-spacex-darker/90 border-t border-cyan-500/30 flex items-center justify-between px-6 z-[1000]">
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-400">LIVE DATA</span>
          </div>
          <div className="text-gray-600">|</div>
          <div className="text-gray-400">
            EGPK / 55.51°N 4.59°W
          </div>
        </div>
        <div className="text-gray-400 text-xs font-mono">
          AirWave Ground Control System
        </div>
      </div>
    </div>
  );
}

