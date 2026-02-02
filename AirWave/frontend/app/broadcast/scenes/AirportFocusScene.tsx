'use client';

import { useEffect, useState, useMemo } from 'react';
import { ACARSMessage, AirportFocusConfig } from '@/app/types';
import dynamic from 'next/dynamic';
import { Plane, Navigation } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

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

interface AirportInfo {
  name: string;
  icao: string;
  lat: number;
  lon: number;
  elevation?: number;
  runways?: string[];
}

const AIRPORTS: Record<string, AirportInfo> = {
  EGPK: { name: 'Prestwick', icao: 'EGPK', lat: 55.5094, lon: -4.5867, elevation: 65 },
  EGPF: { name: 'Glasgow', icao: 'EGPF', lat: 55.8719, lon: -4.4333, elevation: 26 },
  EGPH: { name: 'Edinburgh', icao: 'EGPH', lat: 55.9500, lon: -3.3725, elevation: 135 },
  EGLL: { name: 'Heathrow', icao: 'EGLL', lat: 51.4700, lon: -0.4543, elevation: 83 },
  KJFK: { name: 'JFK', icao: 'KJFK', lat: 40.6413, lon: -73.7781, elevation: 13 },
  KLAX: { name: 'Los Angeles', icao: 'KLAX', lat: 33.9416, lon: -118.4085, elevation: 38 },
};

interface AirportFocusSceneProps {
  airportCode: string;
  radius: number;
  config: AirportFocusConfig;
  aircraft: ACARSMessage[];
}

// Calculate distance using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3440.065; // Radius of Earth in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Determine if aircraft is inbound or outbound
const determineDirection = (
  aircraft: ACARSMessage,
  airportLat: number,
  airportLon: number
): 'inbound' | 'outbound' | 'overhead' => {
  if (!aircraft.position || !aircraft.heading) return 'overhead';

  const heading = aircraft.heading;
  const lat = aircraft.position.lat;
  const lon = aircraft.position.lon;

  // Calculate bearing to airport
  const dLon = (airportLon - lon) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(airportLat * Math.PI / 180);
  const x = Math.cos(lat * Math.PI / 180) * Math.sin(airportLat * Math.PI / 180) -
    Math.sin(lat * Math.PI / 180) * Math.cos(airportLat * Math.PI / 180) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  // If heading is within 45 degrees of bearing to airport, it's inbound
  const diff = Math.abs(heading - bearing);
  if (diff < 45 || diff > 315) return 'inbound';
  if (diff > 135 && diff < 225) return 'outbound';
  return 'overhead';
};

export default function AirportFocusScene({
  airportCode,
  radius,
  config,
  aircraft,
}: AirportFocusSceneProps) {
  const [airportInfo] = useState<AirportInfo>(AIRPORTS[airportCode] || AIRPORTS.EGPK);

  const filteredAircraft = useMemo(() => {
    return aircraft
      .filter(a => {
        if (!a.position) return false;
        const distance = calculateDistance(
          airportInfo.lat,
          airportInfo.lon,
          a.position.lat,
          a.position.lon
        );
        return distance <= radius;
      })
      .map(a => {
        const distance = calculateDistance(
          airportInfo.lat,
          airportInfo.lon,
          a.position!.lat,
          a.position!.lon
        );
        const direction = determineDirection(a, airportInfo.lat, airportInfo.lon);
        return { ...a, distance, direction };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [aircraft, airportInfo, radius]);

  const statistics = useMemo(() => {
    const inbound = filteredAircraft.filter(a => a.direction === 'inbound').length;
    const outbound = filteredAircraft.filter(a => a.direction === 'outbound').length;
    const overhead = filteredAircraft.filter(a => a.direction === 'overhead').length;

    return {
      total: filteredAircraft.length,
      inbound,
      outbound,
      overhead,
    };
  }, [filteredAircraft]);

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <div className="absolute inset-0">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[airportInfo.lat, airportInfo.lon]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Monitoring radius circle */}
            <Circle
              center={[airportInfo.lat, airportInfo.lon]}
              radius={radius * 1852} // Convert nm to meters
              pathOptions={{ color: 'cyan', fillOpacity: 0.1, weight: 2 }}
            />

            {/* Airport marker */}
            <Marker position={[airportInfo.lat, airportInfo.lon]}>
              <Popup>
                <div className="text-sm">
                  <strong>{airportInfo.name}</strong><br />
                  {airportInfo.icao}<br />
                  Elevation: {airportInfo.elevation}ft
                </div>
              </Popup>
            </Marker>

            {/* Aircraft markers */}
            {filteredAircraft.map((a) => {
              if (!a.position) return null;
              const color = a.direction === 'inbound' ? 'green' : 
                           a.direction === 'outbound' ? 'blue' : 'yellow';
              
              return (
                <Marker key={a.id} position={[a.position.lat, a.position.lon]}>
                  <Popup>
                    <div className="text-sm">
                      <strong>{a.flight || a.hex}</strong><br />
                      Type: {a.aircraft_type || 'Unknown'}<br />
                      Altitude: {a.position.altitude || 'Unknown'}ft<br />
                      Distance: {a.distance.toFixed(1)}nm<br />
                      Direction: {a.direction}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Info Panel Overlay */}
      <div className="absolute top-4 right-4 w-80 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4">
        <div className="space-y-4">
          {/* Airport Info */}
          <div className="border-b border-cyan-500/30 pb-3">
            <h3 className="text-xl font-bold text-cyan-400">{airportInfo.name}</h3>
            <p className="text-sm text-gray-400">{airportInfo.icao}</p>
            <p className="text-xs text-gray-500">Elevation: {airportInfo.elevation}ft</p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-cyan-500/10 rounded p-2">
              <div className="text-2xl font-bold text-cyan-400">{statistics.total}</div>
              <div className="text-xs text-gray-400">Total Aircraft</div>
            </div>
            <div className="bg-green-500/10 rounded p-2">
              <div className="text-2xl font-bold text-green-400">{statistics.inbound}</div>
              <div className="text-xs text-gray-400">Inbound</div>
            </div>
            <div className="bg-blue-500/10 rounded p-2">
              <div className="text-2xl font-bold text-blue-400">{statistics.outbound}</div>
              <div className="text-xs text-gray-400">Departing</div>
            </div>
            <div className="bg-yellow-500/10 rounded p-2">
              <div className="text-2xl font-bold text-yellow-400">{statistics.overhead}</div>
              <div className="text-xs text-gray-400">Overhead</div>
            </div>
          </div>

          {/* Closest Aircraft */}
          <div>
            <h4 className="text-sm font-bold text-cyan-400 mb-2">Closest Aircraft</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredAircraft.slice(0, 5).map((a) => (
                <div key={a.id} className="bg-gray-800/50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white">{a.flight || a.hex}</span>
                    <span className={`text-${a.direction === 'inbound' ? 'green' : a.direction === 'outbound' ? 'blue' : 'yellow'}-400`}>
                      {a.direction === 'inbound' ? '→' : a.direction === 'outbound' ? '←' : '↕'}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    {a.aircraft_type || 'Unknown'} • {a.distance.toFixed(1)}nm
                  </div>
                  <div className="text-gray-500">
                    {a.position?.altitude || 'Unknown'}ft
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Info */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <span className="text-gray-400">Monitoring radius:</span>
          <span className="text-white font-bold">{radius}nm</span>
        </div>
      </div>
    </div>
  );
}

