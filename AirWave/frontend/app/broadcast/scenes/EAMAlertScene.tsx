'use client';

import { useEffect, useState } from 'react';
import { EAMMessage, HFGCSAircraft, EAMAlertConfig } from '@/app/types';
import dynamic from 'next/dynamic';
import { AlertTriangle, Radio, MapPin, Clock } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
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

interface EAMAlertSceneProps {
  eamMessage: EAMMessage;
  relatedAircraft: HFGCSAircraft[];
  config: EAMAlertConfig;
  onReturn?: () => void;
}

const formatTimeAgo = (timestamp: string): string => {
  const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

const formatMessageBody = (body: string): string[] => {
  // Group characters into 5-character segments
  const segments: string[] = [];
  for (let i = 0; i < body.length; i += 5) {
    segments.push(body.substr(i, 5));
  }
  return segments;
};

export default function EAMAlertScene({
  eamMessage,
  relatedAircraft,
  config,
  onReturn,
}: EAMAlertSceneProps) {
  const [countdown, setCountdown] = useState<number>(config.returnDelay);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (!config.autoReturn || isPaused) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (onReturn) onReturn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [config.autoReturn, isPaused, onReturn]);

  const messageSegments = formatMessageBody(eamMessage.message_body);
  const timeAgo = formatTimeAgo(eamMessage.timestamp);

  const mapCenter = relatedAircraft.length > 0 && relatedAircraft[0].position
    ? [relatedAircraft[0].position.lat, relatedAircraft[0].position.lon]
    : [39.8283, -98.5795]; // Default to CONUS

  return (
    <div 
      className="eam-alert-overlay"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="eam-alert-border"></div>

      {/* Main Content */}
      <div className="flex h-full">
        {/* Left: Message Display (60%) */}
        <div className="w-3/5 p-8 flex flex-col justify-center">
          {/* Alert Header */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <AlertTriangle className="w-16 h-16 text-red-500 animate-pulse" />
            <h1 className="text-6xl font-bold text-red-500 glitch-text">
              EMERGENCY ACTION MESSAGE
            </h1>
          </div>

          {/* Message Type Badge */}
          <div className="mb-6 flex justify-center">
            <div className={`px-8 py-3 rounded-lg text-3xl font-bold ${
              eamMessage.type === 'EAM' 
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500' 
                : 'bg-orange-500/20 text-orange-400 border-2 border-orange-500'
            }`}>
              {eamMessage.type}
            </div>
          </div>

          {/* Header Code */}
          {eamMessage.header && (
            <div className="mb-6 text-center">
              <div className="text-sm text-gray-400 mb-2">Header</div>
              <div className="text-5xl font-mono font-bold text-white tracking-wider">
                {eamMessage.header}
              </div>
            </div>
          )}

          {/* Message Body */}
          <div className="mb-6 bg-black/50 border-2 border-red-500/50 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-3">Message Body</div>
            <div className="flex flex-wrap gap-3 justify-center font-mono text-2xl">
              {messageSegments.map((segment, index) => (
                <span 
                  key={index} 
                  className="text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded"
                >
                  {segment}
                </span>
              ))}
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Confidence Level</span>
              <span className={`font-bold ${
                eamMessage.confidence >= 75 ? 'text-green-400' :
                eamMessage.confidence >= 50 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {eamMessage.confidence}%
              </span>
            </div>
            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  eamMessage.confidence >= 75 ? 'bg-green-500' :
                  eamMessage.confidence >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${eamMessage.confidence}%` }}
              />
            </div>
          </div>

          {/* Detection Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-900/50 rounded p-3">
              <div className="text-gray-400 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Detection Time
              </div>
              <div className="text-white font-mono">
                {new Date(eamMessage.timestamp).toISOString().substr(11, 8)} UTC
              </div>
              <div className="text-gray-500 text-xs mt-1">{timeAgo}</div>
            </div>

            {eamMessage.recording_segment_id && (
              <div className="bg-gray-900/50 rounded p-3">
                <div className="text-gray-400 mb-1 flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  Source
                </div>
                <div className="text-white">Multi-segment</div>
                <div className="text-gray-500 text-xs mt-1">Audio reconstruction</div>
              </div>
            )}
          </div>

          {/* Verification Status */}
          {eamMessage.verified && (
            <div className="mt-4 bg-green-500/20 border border-green-500 rounded p-3">
              <div className="flex items-center gap-2 text-green-400 font-bold">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                VERIFIED
              </div>
              {eamMessage.verification_notes && (
                <div className="text-sm text-gray-300 mt-2">
                  {eamMessage.verification_notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Related Aircraft (40%) */}
        <div className="w-2/5 bg-black/70 border-l-2 border-red-500/30 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-orange-400 mb-4 flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            Related HFGCS Aircraft
          </h2>

          {/* Map */}
          {relatedAircraft.length > 0 && (
            <div className="mb-6 h-64 rounded-lg overflow-hidden border-2 border-orange-500/30">
              {typeof window !== 'undefined' && (
                <MapContainer
                  center={mapCenter as [number, number]}
                  zoom={4}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />

                  {relatedAircraft.map((a) => {
                    if (!a.position) return null;
                    return (
                      <Marker key={a.id} position={[a.position.lat, a.position.lon]}>
                        <Popup>
                          <div className="text-sm">
                            <strong>{a.type || 'Unknown'}</strong><br />
                            {a.callsign || 'No callsign'}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              )}
            </div>
          )}

          {/* Aircraft List */}
          <div className="space-y-3">
            {relatedAircraft.length > 0 ? (
              relatedAircraft.map((a) => (
                <div key={a.id} className="bg-orange-900/20 border border-orange-500/30 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-orange-400 text-lg">
                      {a.type || 'Unknown Type'}
                    </span>
                    {(a.type?.includes('E-6') || a.type?.includes('E-4')) && (
                      <span className="px-2 py-1 bg-red-500/30 text-red-400 text-xs rounded">
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-white">
                      Callsign: {a.callsign || 'Unknown'}
                    </div>
                    {a.position && (
                      <>
                        <div className="text-gray-300">
                          Position: {a.position.lat.toFixed(2)}°, {a.position.lon.toFixed(2)}°
                        </div>
                        {a.position.altitude && (
                          <div className="text-gray-300">
                            Altitude: {a.position.altitude}ft
                          </div>
                        )}
                      </>
                    )}
                    <div className="text-gray-400 text-xs">
                      Detection: {a.detection_method}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Last seen: {formatTimeAgo(a.last_seen)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                No related HFGCS aircraft detected at time of EAM
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      {config.autoReturn && (
        <div className="absolute bottom-8 right-8">
          <div className={`eam-countdown ${countdown < 10 ? 'text-red-400' : countdown < 20 ? 'text-yellow-400' : 'text-green-400'}`}>
            {countdown}s
          </div>
          <div className="text-center text-xs text-gray-500 mt-1">
            {isPaused ? 'Paused' : 'Auto-return'}
          </div>
        </div>
      )}

      {/* Close Button */}
      <button
        onClick={onReturn}
        className="absolute top-8 right-8 px-4 py-2 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded border border-gray-600 transition-colors"
      >
        Close [ESC]
      </button>
    </div>
  );
}

