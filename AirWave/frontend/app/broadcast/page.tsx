'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ACARSMessage, HFGCSAircraft, EAMMessage, DatabaseStats, DataSourceStats } from '@/app/types';
import BroadcastLayout from './components/BroadcastLayout';
import AirportFocusScene from './scenes/AirportFocusScene';
import MilitaryWatchScene from './scenes/MilitaryWatchScene';
import GlobalOverviewScene from './scenes/GlobalOverviewScene';
import EAMAlertScene from './scenes/EAMAlertScene';
import { useBroadcastConfig } from './hooks/useBroadcastConfig';
import { useNarrative } from './hooks/useNarrative';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface TickerItem {
  id: string;
  text: string;
  type: 'aircraft' | 'eam' | 'emergency' | 'info';
  timestamp: string;
}

export default function BroadcastPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'global_overview';
  const transparent = searchParams.get('transparent') === 'true';
  const airportParam = searchParams.get('airport');
  const regionParam = searchParams.get('region');

  const { config, loading } = useBroadcastConfig();
  
  const [aircraft, setAircraft] = useState<ACARSMessage[]>([]);
  const [hfgcsAircraft, setHfgcsAircraft] = useState<HFGCSAircraft[]>([]);
  const [eamMessages, setEamMessages] = useState<EAMMessage[]>([]);
  const [statistics, setStatistics] = useState<DatabaseStats | null>(null);
  const [dataSourceStats, setDataSourceStats] = useState<Record<string, DataSourceStats>>({});
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentMode, setCurrentMode] = useState<string>(mode);
  const [showEAMAlert, setShowEAMAlert] = useState<boolean>(false);
  const [latestEAM, setLatestEAM] = useState<EAMMessage | null>(null);
  const [previousMode, setPreviousMode] = useState<string>(mode);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(config?.layout.showInfoPanel ?? true);
  const [showTicker, setShowTicker] = useState<boolean>(config?.layout.showTicker ?? true);
  const [sceneTransitioning, setSceneTransitioning] = useState<boolean>(false);
  
  // Use refs to avoid WebSocket reconnection loops
  const configRef = useRef(config);
  const currentModeRef = useRef(currentMode);
  
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  
  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  // Get config values with fallbacks
  const airportCode = airportParam || config?.modes.airport_focus.defaultAirport || 'EGPK';
  const radius = config?.modes.airport_focus.radius || 50;
  const focusRegion = regionParam || config?.modes.military_watch.focusRegion || 'conus';

  // Narrative hook
  const { narrative, setContext } = useNarrative(
    {
      mode: currentMode,
      aircraft,
      hfgcsAircraft,
      eamMessages,
      statistics,
    },
    config?.narrative.updateInterval ? config.narrative.updateInterval * 1000 : 15000
  );

  // Update narrative context when data changes
  useEffect(() => {
    setContext({
      mode: currentMode,
      aircraft,
      hfgcsAircraft,
      eamMessages,
      statistics,
      airportInfo: currentMode === 'airport_focus' ? {
        name: airportCode, // Using ICAO as name for now
        icao: airportCode,
        radius,
        lat: 55.5094, // Prestwick default
        lon: -4.5867,
        heading: 310, // Runway heading for EGPK RWY 31
      } : undefined,
    });
  }, [currentMode, aircraft, hfgcsAircraft, eamMessages, statistics, airportCode, radius, setContext]);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('Broadcast WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'adsb_batch':
            if (message.data && Array.isArray(message.data)) {
              setAircraft(prev => {
                const updated = [...prev];
                message.data.forEach((newAircraft: ACARSMessage) => {
                  const index = updated.findIndex(a => a.hex === newAircraft.hex);
                  if (index >= 0) {
                    updated[index] = newAircraft;
                  } else {
                    updated.push(newAircraft);
                  }
                });
                // Keep only recent aircraft (last 1000)
                return updated.slice(-1000);
              });

              // Add to ticker
              if (message.data.length > 0) {
                const sample = message.data[0];
                if (sample.flight) {
                  addTickerItem({
                    id: `aircraft-${Date.now()}`,
                    text: `Aircraft detected: ${sample.flight} ${sample.aircraft_type || ''}`,
                    type: 'aircraft',
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
            break;

          case 'hfgcs_aircraft':
            if (message.data) {
              const { event, aircraft: hfgcsData } = message.data;
              
              setHfgcsAircraft(prev => {
                if (event === 'detected') {
                  return [...prev, hfgcsData];
                } else if (event === 'updated') {
                  return prev.map(a => a.id === hfgcsData.id ? hfgcsData : a);
                } else if (event === 'lost') {
                  return prev.filter(a => a.id !== hfgcsData.id);
                }
                return prev;
              });

              // Add to ticker
              if (event === 'detected') {
                addTickerItem({
                  id: `hfgcs-${Date.now()}`,
                  text: `HFGCS Aircraft detected: ${hfgcsData.type || 'Unknown'} ${hfgcsData.callsign || ''}`,
                  type: 'emergency',
                  timestamp: new Date().toISOString(),
                });
              }
            }
            break;

          case 'eam_detected':
            if (message.data) {
              const eam: EAMMessage = message.data;
              setEamMessages(prev => [eam, ...prev.slice(0, 9)]);
              setLatestEAM(eam);

              // Auto-switch to EAM alert if configured
              if (configRef.current?.modes.military_watch.autoSwitchOnEAM && currentModeRef.current === 'military_watch') {
                setPreviousMode(currentModeRef.current);
                setShowEAMAlert(true);
              }

              // Add to ticker
              addTickerItem({
                id: `eam-${Date.now()}`,
                text: `⚠️ EMERGENCY ACTION MESSAGE DETECTED: ${eam.type} - Confidence: ${eam.confidence}%`,
                type: 'eam',
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case 'transcription_complete':
            // Could add transcriptions to ticker if needed
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
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

    return () => {
      websocket.close();
    };
  }, []); // Empty dependency array - only run once on mount

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch aircraft positions
        const aircraftRes = await fetch(`${API_BASE}/api/messages?limit=500`);
        if (aircraftRes.ok) {
          const data = await aircraftRes.json();
          const positions = data.messages || data.positions || data.data || [];
          if (Array.isArray(positions)) {
            setAircraft(positions);
          }
        }

        // Fetch HFGCS aircraft
        const hfgcsRes = await fetch(`${API_BASE}/api/hfgcs/aircraft`);
        if (hfgcsRes.ok) {
          const data = await hfgcsRes.json();
          const hfgcs = data.aircraft || data.data || [];
          if (Array.isArray(hfgcs)) {
            setHfgcsAircraft(hfgcs);
          }
        }

        // Fetch recent EAMs
        const eamRes = await fetch(`${API_BASE}/api/eam?limit=10`);
        if (eamRes.ok) {
          const data = await eamRes.json();
          const eams = data.messages || data.data || [];
          if (Array.isArray(eams)) {
            setEamMessages(eams);
          }
        }

        // Fetch data source stats
        const sourcesRes = await fetch(`${API_BASE}/api/sources`);
        if (sourcesRes.ok) {
          const data = await sourcesRes.json();
          if (data.stats) {
            setDataSourceStats(data.stats);
          }
        }

        // Fetch statistics
        const statsRes = await fetch(`${API_BASE}/api/stats`);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStatistics(data);
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();

    // Poll for statistics every 30 seconds
    const statsInterval = setInterval(async () => {
      try {
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStatistics(data);
        }
      } catch (err) {
        console.error('Error polling statistics:', err);
      }
    }, 30000);

    // Poll for data sources every 30 seconds
    const sourcesInterval = setInterval(async () => {
      try {
        const sourcesRes = await fetch('/api/sources');
        if (sourcesRes.ok) {
          const data = await sourcesRes.json();
          if (data.stats) {
            setDataSourceStats(data.stats);
          }
        }
      } catch (err) {
        console.error('Error polling data sources:', err);
      }
    }, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(sourcesInterval);
    };
  }, []);

  // Add ticker item helper
  const addTickerItem = useCallback((item: TickerItem) => {
    setTickerItems(prev => {
      const updated = [item, ...prev];
      return updated.slice(0, 20); // Keep last 20 items
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'escape':
          if (showEAMAlert) {
            setShowEAMAlert(false);
            setCurrentMode(previousMode);
          }
          break;
        case 'm':
          // Mode selection menu (could implement modal)
          break;
        case 'h':
          // Toggle info panel
          setShowInfoPanel(prev => !prev);
          break;
        case 't':
          // Toggle ticker
          setShowTicker(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showEAMAlert, previousMode]);

  // Auto-rotate modes
  useEffect(() => {
    if (!config?.transitions.autoRotate || showEAMAlert) return;

    const modes = ['global_overview', 'airport_focus', 'military_watch'];
    const currentIndex = modes.indexOf(currentMode);
    
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % modes.length;
      setSceneTransitioning(true);
      setTimeout(() => {
        setCurrentMode(modes[nextIndex]);
        setSceneTransitioning(false);
      }, config.transitions.duration || 500);
    }, (config.transitions.rotateInterval || 300) * 1000);

    return () => clearInterval(interval);
  }, [config?.transitions, currentMode, showEAMAlert]);

  // Handle EAM alert return
  const handleEAMReturn = useCallback(() => {
    setShowEAMAlert(false);
    setCurrentMode(previousMode);
  }, [previousMode]);

  // Data source status
  const dataSourceStatus = useMemo(() => {
    return {
      tar1090: ws?.readyState === WebSocket.OPEN,
      airframes: ws?.readyState === WebSocket.OPEN,
      adsbexchange: ws?.readyState === WebSocket.OPEN,
      opensky: ws?.readyState === WebSocket.OPEN,
    };
  }, [ws?.readyState]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading broadcast configuration...</div>
      </div>
    );
  }

  // Render EAM Alert Scene
  if (showEAMAlert && latestEAM) {
    return (
      <EAMAlertScene
        eamMessage={latestEAM}
        relatedAircraft={hfgcsAircraft}
        config={config?.modes.eam_alert || { autoReturn: true, returnDelay: 30, playSound: true }}
        onReturn={handleEAMReturn}
      />
    );
  }

  // Render normal broadcast view
  return (
    <BroadcastLayout
      mode={currentMode}
      showHeader={config?.layout.showHeader ?? true}
      showInfoPanel={showInfoPanel}
      showTicker={showTicker}
      transparent={transparent}
      tickerItems={tickerItems}
      dataSourceStatus={dataSourceStatus}
    >
      <div className={`transition-opacity duration-${config?.transitions.duration || 500} ${sceneTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {currentMode === 'airport_focus' && (
        <AirportFocusScene
          airportCode={airportCode}
          radius={radius}
          config={config?.modes.airport_focus || { defaultAirport: 'EGPK', radius: 50, showRunways: true, showWeather: false }}
          aircraft={aircraft}
        />
      )}

      {currentMode === 'military_watch' && (
        <MilitaryWatchScene
          focusRegion={focusRegion}
          config={config?.modes.military_watch || { focusRegion: 'conus', highlightTypes: ['E-6B', 'E-4B'], showEAMAlerts: true, autoSwitchOnEAM: true }}
          aircraft={aircraft}
          hfgcsAircraft={hfgcsAircraft}
          eamMessages={eamMessages}
        />
      )}

      {currentMode === 'global_overview' && (
        <GlobalOverviewScene
          config={config?.modes.global_overview || { showHeatmap: false, clusterMarkers: true, maxAircraft: 500 }}
          aircraft={aircraft}
          statistics={statistics}
          dataSourceStats={dataSourceStats}
        />
      )}
      </div>

      {/* Narrative Overlay */}
      {config?.narrative.enabled && narrative && (
        <div className="absolute bottom-24 left-4 right-4 max-w-4xl mx-auto">
          <div className="narrative-text bg-black/70 backdrop-blur-md border border-cyan-500/30 rounded-lg px-6 py-4">
            {narrative}
          </div>
        </div>
      )}
    </BroadcastLayout>
  );
}

