import { useState, useEffect, useCallback, useRef } from 'react';
import { ACARSMessage, HFGCSAircraft, EAMMessage } from '@/app/types';

interface NarrativeContext {
  mode: string;
  aircraft: ACARSMessage[];
  hfgcsAircraft: HFGCSAircraft[];
  eamMessages: EAMMessage[];
  statistics: any;
  airportInfo?: any;
}

interface UseNarrativeReturn {
  narrative: string;
  updateNarrative: () => void;
  setContext: (context: Partial<NarrativeContext>) => void;
}

// Helper functions
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatDistance = (meters: number, useMetric: boolean = false): string => {
  if (useMetric) {
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  }
  const nm = meters / 1852; // Convert to nautical miles
  return `${nm.toFixed(1)}nm`;
};

const formatAltitude = (feet: number): string => {
  return `${feet.toLocaleString()}ft`;
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

const selectMostInteresting = (aircraft: ACARSMessage[]): ACARSMessage | null => {
  if (aircraft.length === 0) return null;

  // Prioritize military aircraft
  const military = aircraft.filter(a => a.hex && (
    a.hex.startsWith('ae') || // US Military
    a.aircraft_type?.includes('E-6') ||
    a.aircraft_type?.includes('E-4') ||
    a.aircraft_type?.includes('KC-')
  ));

  if (military.length > 0) return military[0];

  // Otherwise return first aircraft
  return aircraft[0];
};

export function useNarrative(
  initialContext: Partial<NarrativeContext> = {},
  updateInterval: number = 15000
): UseNarrativeReturn {
  const [narrative, setNarrative] = useState<string>('');
  const [context, setContextState] = useState<NarrativeContext>({
    mode: 'global_overview',
    aircraft: [],
    hfgcsAircraft: [],
    eamMessages: [],
    statistics: null,
    ...initialContext,
  });
  const previousNarrative = useRef<string>('');
  const templateIndex = useRef<number>(0);
  const contextRef = useRef(context);
  
  // Update ref whenever context changes
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const generateAirportNarrative = useCallback((): string => {
    const { aircraft, airportInfo } = contextRef.current;
    
    if (!airportInfo) return 'Initializing airport monitoring...';

    const total = aircraft.length;
    const inbound = aircraft.filter(a => 
      a.heading && airportInfo.heading && 
      Math.abs(a.heading - airportInfo.heading) < 45
    ).length;
    const outbound = total - inbound;

    const templates = [
      `Monitoring ${airportInfo.name} (${airportInfo.icao}). ${total} aircraft within ${airportInfo.radius || 50}nm. ${inbound} inbound, ${outbound} departing.`,
      `${airportInfo.name}: ${total} active flights. ${inbound} arrivals expected, ${outbound} departures tracked.`,
      `Airport operations at ${airportInfo.icao}: ${total} aircraft in vicinity. Traffic flow: ${inbound} in, ${outbound} out.`
    ];

    let baseNarrative = templates[templateIndex.current % templates.length];

    // Add closest aircraft info
    if (aircraft.length > 0 && aircraft[0].position) {
      const closest = aircraft[0];
      baseNarrative += ` Closest: ${closest.flight || closest.hex} at ${closest.position.altitude || 'unknown'}ft.`;
    }

    // Add notable aircraft
    const interesting = selectMostInteresting(aircraft);
    if (interesting && interesting !== aircraft[0]) {
      baseNarrative += ` Notable: ${interesting.aircraft_type || 'Unknown'} ${interesting.flight || interesting.hex}.`;
    }

    return baseNarrative;
  }, [context]);

  const generateMilitaryNarrative = useCallback((): string => {
    const { hfgcsAircraft, eamMessages, aircraft } = contextRef.current;

    const tacamo = hfgcsAircraft.filter(a => a.type?.includes('E-6'));
    const nightwatch = hfgcsAircraft.filter(a => a.type?.includes('E-4'));
    const tankers = aircraft.filter(a => a.aircraft_type?.includes('KC-'));

    if (eamMessages.length > 0) {
      const latestEAM = eamMessages[0];
      const timeAgo = formatTimeAgo(latestEAM.timestamp);
      return `Emergency Action Message detected ${timeAgo}. Type: ${latestEAM.type}. Confidence: ${latestEAM.confidence}%. ${hfgcsAircraft.length} HFGCS aircraft active.`;
    }

    if (tacamo.length > 0) {
      const t = tacamo[0];
      const duration = t.first_seen ? Math.floor((new Date().getTime() - new Date(t.first_seen).getTime()) / 1000) : 0;
      const alt = t.position?.altitude ? formatAltitude(Number(t.position.altitude)) : 'unknown altitude';
      return `TACAMO E-6B ${t.callsign || 'Unknown'} on station. Mission duration: ${formatDuration(duration)}. ${alt}.`;
    }

    if (nightwatch.length > 0) {
      const n = nightwatch[0];
      return `Nightwatch E-4B ${n.callsign || 'Unknown'} detected. National Airborne Operations Center active.`;
    }

    if (tankers.length > 0) {
      const nearbyCount = aircraft.filter(a => 
        a.hex !== tankers[0].hex && 
        a.position && tankers[0].position
      ).length;
      return `${tankers[0].aircraft_type} ${tankers[0].flight || tankers[0].hex} conducting operations. ${nearbyCount} aircraft nearby.`;
    }

    return `${hfgcsAircraft.length} HFGCS aircraft active. ${tacamo.length} TACAMO, ${nightwatch.length} Nightwatch. Monitoring military operations.`;
  }, []);

  const generateGlobalNarrative = useCallback((): string => {
    const { aircraft, statistics } = contextRef.current;

    const total = aircraft.length;
    const rate = statistics?.messagesPerMinute || 0;

    const templates = [
      `Tracking ${total} aircraft worldwide. ${rate} messages/min across all data sources.`,
      `Global aviation monitoring: ${total} active flights. Processing ${rate} messages per minute.`,
      `Worldwide coverage: ${total} aircraft tracked. Data rate: ${rate}/min.`
    ];

    let baseNarrative = templates[templateIndex.current % templates.length];

    // Add regional info if available
    if (statistics?.byRegion) {
      const regions = Object.entries(statistics.byRegion);
      const busiest = regions.sort((a: any, b: any) => b[1] - a[1])[0];
      if (busiest) {
        baseNarrative += ` Busiest region: ${busiest[0]} with ${busiest[1]} aircraft.`;
      }
    }

    // Add records
    if (aircraft.length > 0) {
      const highest = aircraft.reduce((prev, curr) => 
        (curr.position?.altitude || 0) > (prev.position?.altitude || 0) ? curr : prev
      );
      if (highest.position?.altitude) {
        baseNarrative += ` Highest: ${highest.flight || highest.hex} at ${formatAltitude(Number(highest.position.altitude))}.`;
      }
    }

    return baseNarrative;
  }, []);

  const generateEAMNarrative = useCallback((): string => {
    const { eamMessages, hfgcsAircraft } = contextRef.current;

    if (eamMessages.length === 0) return 'No EAM messages detected.';

    const eam = eamMessages[0];
    let narrative = 'EMERGENCY ACTION MESSAGE DETECTED. ';
    narrative += `Type: ${eam.type}. Confidence: ${eam.confidence}%. `;

    if (hfgcsAircraft.length > 0) {
      const tacamo = hfgcsAircraft.filter(a => a.type?.includes('E-6'));
      narrative += `${hfgcsAircraft.length} HFGCS aircraft active. `;
      if (tacamo.length > 0) {
        narrative += `TACAMO ${tacamo[0].callsign || 'Unknown'} detected. `;
      }
    }

    if (eam.recording_segment_id) {
      narrative += `Reconstructed from audio segments. `;
    }

    const timeAgo = formatTimeAgo(eam.timestamp);
    narrative += `Detected ${timeAgo}.`;

    return narrative;
  }, []);

  const generateNarrative = useCallback((): string => {
    const { mode } = contextRef.current;

    switch (mode) {
      case 'airport_focus':
        return generateAirportNarrative();
      case 'military_watch':
        return generateMilitaryNarrative();
      case 'global_overview':
        return generateGlobalNarrative();
      case 'eam_alert':
        return generateEAMNarrative();
      default:
        return 'AirWave broadcast system active.';
    }
  }, [generateAirportNarrative, generateMilitaryNarrative, generateGlobalNarrative, generateEAMNarrative]);

  const updateNarrative = useCallback(() => {
    const newNarrative = generateNarrative();
    
    // Only update if narrative has changed significantly
    if (newNarrative !== previousNarrative.current) {
      setNarrative(newNarrative);
      previousNarrative.current = newNarrative;
      templateIndex.current += 1;
    }
  }, [generateNarrative]);

  const setContext = useCallback((updates: Partial<NarrativeContext>) => {
    setContextState(prev => ({ ...prev, ...updates }));
  }, []);

  // Auto-update narrative - only recreate interval when updateInterval changes
  useEffect(() => {
    const interval = setInterval(() => {
      const newNarrative = generateNarrative();
      if (newNarrative !== previousNarrative.current) {
        setNarrative(newNarrative);
        previousNarrative.current = newNarrative;
        templateIndex.current += 1;
      }
    }, updateInterval);
    
    // Initial update
    const initialNarrative = generateNarrative();
    if (initialNarrative !== previousNarrative.current) {
      setNarrative(initialNarrative);
      previousNarrative.current = initialNarrative;
    }
    
    return () => clearInterval(interval);
  }, [updateInterval, generateNarrative]);

  return {
    narrative,
    updateNarrative,
    setContext,
  };
}

