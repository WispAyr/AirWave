'use client';

import { useState, useEffect } from 'react';
import { Radio, Plane, Shield, Globe, AlertTriangle } from 'lucide-react';

interface BroadcastLayoutProps {
  mode: string;
  showHeader?: boolean;
  showInfoPanel?: boolean;
  showTicker?: boolean;
  transparent?: boolean;
  children: React.ReactNode;
  tickerItems?: TickerItem[];
  dataSourceStatus?: Record<string, boolean>;
}

interface TickerItem {
  id: string;
  text: string;
  type: 'aircraft' | 'eam' | 'emergency' | 'info';
  timestamp: string;
}

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'airport_focus':
      return <Plane className="w-4 h-4" />;
    case 'military_watch':
      return <Shield className="w-4 h-4" />;
    case 'global_overview':
      return <Globe className="w-4 h-4" />;
    case 'eam_alert':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Radio className="w-4 h-4" />;
  }
};

const getModeName = (mode: string) => {
  switch (mode) {
    case 'airport_focus':
      return 'AIRPORT FOCUS';
    case 'military_watch':
      return 'MILITARY WATCH';
    case 'global_overview':
      return 'GLOBAL OVERVIEW';
    case 'eam_alert':
      return 'EAM ALERT';
    default:
      return 'BROADCAST';
  }
};

export default function BroadcastLayout({
  mode,
  showHeader = true,
  showInfoPanel = true,
  showTicker = true,
  transparent = false,
  children,
  tickerItems = [],
  dataSourceStatus = {},
}: BroadcastLayoutProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [infoPanelVisible, setInfoPanelVisible] = useState(showInfoPanel);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().substr(11, 8) + ' UTC');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setInfoPanelVisible(showInfoPanel);
  }, [showInfoPanel]);

  return (
    <div className={`broadcast-container ${transparent ? 'broadcast-transparent' : ''}`}>
      {/* Header */}
      {showHeader && (
        <div className="broadcast-header flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {getModeIcon(mode)}
            <span className="text-xl font-bold text-cyan-400">{getModeName(mode)}</span>
            
            {/* Live Indicator */}
            <div className="live-indicator">
              <div className="live-dot"></div>
              <span className="text-xs font-mono text-red-400">LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Data Source Indicators */}
            <div className="flex items-center gap-2">
              {Object.entries(dataSourceStatus).map(([source, active]) => (
                <div
                  key={source}
                  className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-600'}`}
                  title={`${source}: ${active ? 'Active' : 'Inactive'}`}
                />
              ))}
            </div>

            {/* Time */}
            <div className="text-sm font-mono text-gray-400">{currentTime}</div>

            {/* Branding */}
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              <span className="text-lg font-bold text-white">AirWave</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative" style={{ 
        height: showHeader && showTicker ? 'calc(100vh - 140px)' : 
                showHeader ? 'calc(100vh - 64px)' :
                showTicker ? 'calc(100vh - 80px)' : '100vh',
        top: showHeader ? '64px' : '0'
      }}>
        {children}
      </div>

      {/* Ticker Bar */}
      {showTicker && (
        <div className="broadcast-ticker flex items-center overflow-hidden">
          <div className="ticker-content">
            {tickerItems.length > 0 ? (
              <>
                {tickerItems.map((item, index) => (
                  <span key={`ticker-${item.id}-${index}`} className={`ticker-item ${item.type}`}>
                    {item.text}
                  </span>
                ))}
                {/* Duplicate for seamless loop */}
                {tickerItems.map((item, index) => (
                  <span key={`ticker-dup-${item.id}-${index}`} className={`ticker-item ${item.type}`}>
                    {item.text}
                  </span>
                ))}
              </>
            ) : (
              <>
                <span key="ticker-default-1" className="ticker-item info">AirWave Broadcast System Active</span>
                <span key="ticker-default-2" className="ticker-item info">Monitoring Aviation Traffic</span>
                <span key="ticker-default-3" className="ticker-item info">Real-time Data Updates</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

