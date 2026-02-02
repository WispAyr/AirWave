'use client';

import { useEffect, useState, useRef } from 'react';
import { ACARSMessage } from '@/app/types';
import EGPKGroundScene from '../broadcast/scenes/EGPKGroundScene';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export default function EGPKGroundPage() {
  const [aircraft, setAircraft] = useState<ACARSMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('EGPK Ground View: WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle ADS-B batch updates
        if (data.type === 'adsb_batch' && data.aircraft) {
          setAircraft(prev => {
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
          setAircraft(prev => {
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
            setAircraft(positions);
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, []);

  return (
    <div className="fixed inset-0 bg-spacex-darker">
      <EGPKGroundScene aircraft={aircraft} />
    </div>
  );
}




