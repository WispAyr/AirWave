import { useState, useEffect } from 'react';
import { BroadcastConfig } from '@/app/types';

interface UseBroadcastConfigReturn {
  config: BroadcastConfig | null;
  loading: boolean;
  error: Error | null;
  updateConfig: (updates: Partial<BroadcastConfig>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const DEFAULT_CONFIG: BroadcastConfig = {
  modes: {
    airport_focus: {
      defaultAirport: 'EGPK',
      radius: 50,
      showRunways: true,
      showWeather: false
    },
    military_watch: {
      focusRegion: 'conus',
      highlightTypes: ['E-6B', 'E-4B', 'KC-135', 'KC-46'],
      showEAMAlerts: true,
      autoSwitchOnEAM: true
    },
    global_overview: {
      showHeatmap: false,
      clusterMarkers: true,
      maxAircraft: 500
    },
    eam_alert: {
      autoReturn: true,
      returnDelay: 30,
      playSound: true
    }
  },
  layout: {
    showHeader: true,
    showInfoPanel: true,
    showTicker: true,
    transparent: false
  },
  narrative: {
    enabled: true,
    updateInterval: 15,
    templates: {}
  },
  transitions: {
    enabled: true,
    duration: 500,
    autoRotate: false,
    rotateInterval: 300
  }
};

const CACHE_KEY = 'airwave_broadcast_config';

export function useBroadcastConfig(): UseBroadcastConfigReturn {
  const [config, setConfig] = useState<BroadcastConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use backend port for API calls
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/api/admin/broadcast/config`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.config) {
        setConfig(data.config);
        // Cache config in localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.config));
        } catch (e) {
          console.warn('Failed to cache config in localStorage:', e);
        }
      } else {
        throw new Error(data.error || 'Failed to load configuration');
      }
    } catch (err) {
      console.error('Error loading broadcast config:', err);
      setError(err as Error);

      // Try to load from cache or use defaults (no retry loop)
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const cachedConfig = JSON.parse(cached);
          setConfig(cachedConfig);
          console.log('Loaded config from cache');
        } else {
          // Use defaults if no cache available
          setConfig(DEFAULT_CONFIG);
          console.log('Using default config');
        }
      } catch (cacheErr) {
        console.error('Failed to load from cache:', cacheErr);
        setConfig(DEFAULT_CONFIG);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<BroadcastConfig>) => {
    try {
      if (!config) {
        throw new Error('No config loaded');
      }

      const updatedConfig = { ...config, ...updates };

      const response = await fetch('/api/admin/broadcast/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setConfig(updatedConfig);
        // Update cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updatedConfig));
        } catch (e) {
          console.warn('Failed to update cache:', e);
        }
      } else {
        throw new Error(data.error || 'Failed to update configuration');
      }
    } catch (err) {
      console.error('Error updating broadcast config:', err);
      throw err;
    }
  };

  const resetToDefaults = async () => {
    try {
      const response = await fetch('/api/admin/broadcast/config', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setConfig(DEFAULT_CONFIG);
        // Clear cache
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch (e) {
          console.warn('Failed to clear cache:', e);
        }
      } else {
        throw new Error(data.error || 'Failed to reset configuration');
      }
    } catch (err) {
      console.error('Error resetting broadcast config:', err);
      throw err;
    }
  };

  return {
    config,
    loading,
    error,
    updateConfig,
    resetToDefaults,
  };
}

