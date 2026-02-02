'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ACARSMessage } from '@/app/types';
import AircraftTrackingScene from '../broadcast/scenes/AircraftTrackingScene';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export default function TrackPage() {
  const searchParams = useSearchParams();
  const targetHex = searchParams.get('hex');
  const targetFlight = searchParams.get('flight');
  
  const [aircraft, setAircraft] = useState<ACARSMessage | null>(null);
  const [flightHistory, setFlightHistory] = useState<ACARSMessage[]>([]);
  const [allAircraft, setAllAircraft] = useState<ACARSMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Find target aircraft from all aircraft
  useEffect(() => {
    if (!allAircraft.length) return;
    
    const target = allAircraft.find(a => {
      if (targetHex && (a.hex === targetHex || a.tail === targetHex)) return true;
      if (targetFlight && (a.flight === targetFlight || a.tail === targetFlight)) return true;
      return false;
    });
    
    if (target) {
      setAircraft(target);
      setFlightHistory(prev => {
        // Add to history if position exists
        if (target.position) {
          const newHistory = [...prev, target];
          // Keep last 100 positions
          return newHistory.slice(-100);
        }
        return prev;
      });
    }
  }, [allAircraft, targetHex, targetFlight]);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('Aircraft Tracking: WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle ADS-B batch updates
        if (data.type === 'adsb_batch' && data.aircraft) {
          setAllAircraft(prev => {
            const aircraftMap = new Map(prev.map(a => [a.hex || a.id, a]));
            
            data.aircraft.forEach((newAircraft: ACARSMessage) => {
              const key = newAircraft.hex || newAircraft.id;
              aircraftMap.set(key, newAircraft);
            });
            
            return Array.from(aircraftMap.values());
          });
        }
        // Handle individual ACARS/ADSB messages
        else if (data.type === 'acars' || data.type === 'adsb') {
          const newAircraft = data.data;
          setAllAircraft(prev => {
            const key = newAircraft.hex || newAircraft.id;
            const filtered = prev.filter(a => (a.hex || a.id) !== key);
            return [...filtered, newAircraft];
          });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt reconnect after delay
      setTimeout(() => {
        const newWebsocket = new WebSocket(WS_URL);
        newWebsocket.onopen = websocket.onopen;
        newWebsocket.onmessage = websocket.onmessage;
        newWebsocket.onerror = websocket.onerror;
        newWebsocket.onclose = websocket.onclose;
        setWs(newWebsocket);
      }, 5000);
    };

    setWs(websocket);
    wsRef.current = websocket;

    return () => {
      websocket.close();
    };
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const aircraftRes = await fetch(`${API_BASE}/api/messages?limit=500`);
        if (aircraftRes.ok) {
          const data = await aircraftRes.json();
          const positions = data.messages || data.positions || data.data || [];
          if (Array.isArray(positions)) {
            setAllAircraft(positions);
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, []);

  // If no aircraft found or specified, show selection
  if (!targetHex && !targetFlight) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cyan-400 mb-4">Aircraft Tracking</h1>
          <p className="text-gray-400 mb-8">
            Add ?hex=HEXCODE or ?flight=CALLSIGN to track an aircraft
          </p>
          
          {allAircraft.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-xl text-cyan-400 mb-4">Available Aircraft:</h2>
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {allAircraft.slice(0, 20).map(a => (
                  <a
                    key={a.hex || a.id}
                    href={`/track?${a.hex ? `hex=${a.hex}` : `flight=${a.flight || a.tail}`}`}
                    className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded hover:border-cyan-400 transition-colors"
                  >
                    <div className="font-bold text-white">{a.flight || a.tail || 'Unknown'}</div>
                    <div className="text-xs text-gray-400">{a.hex || a.tail}</div>
                    {a.position && (
                      <div className="text-xs text-green-400 mt-1">
                        FL{Math.floor(a.position.altitude / 100)}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If aircraft not found yet
  if (!aircraft) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <h1 className="text-xl font-bold text-cyan-400">
            Searching for {targetHex || targetFlight}...
          </h1>
          <p className="text-gray-400 mt-2">Waiting for aircraft data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0e1a]">
      <AircraftTrackingScene aircraft={aircraft} flightHistory={flightHistory} />
    </div>
  );
}




