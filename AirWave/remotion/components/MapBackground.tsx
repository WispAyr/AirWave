import React from 'react';
import { Bounds, calculateZoomLevel, getBoundsCenter } from '../utils/coordinateConverter';
import { Img, staticFile } from 'remotion';

interface MapBackgroundProps {
  bounds: Bounds;
  width: number;
  height: number;
}

/**
 * Renders a broadcast-quality map background using OpenStreetMap tiles
 * Enhanced with professional effects for TV-ready output
 */
export const MapBackground: React.FC<MapBackgroundProps> = ({ bounds, width, height }) => {
  const center = getBoundsCenter(bounds);
  const zoom = Math.max(4, Math.min(calculateZoomLevel(bounds, width, height), 13));

  // Use high-quality OpenStreetMap tiles with broadcast-ready styling
  const tileUrl = getMapTileUrl(center.lat, center.lon, zoom, width, height);

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0e27',
        overflow: 'hidden',
      }}
    >
      {/* Real map tiles from OpenStreetMap - Enhanced quality */}
      <Img
        src={tileUrl}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) scale(1.05)',
          minWidth: '105%',
          minHeight: '105%',
          width: 'auto',
          height: 'auto',
          objectFit: 'cover',
          opacity: 0.6,
          filter: 'brightness(0.35) contrast(1.3) saturate(0.2)',
        }}
      />
      
      {/* Broadcast-quality gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            linear-gradient(to bottom, 
              rgba(10, 14, 39, 0.3) 0%, 
              rgba(10, 14, 39, 0.5) 50%, 
              rgba(10, 14, 39, 0.75) 100%
            )
          `,
        }}
      />
      
      {/* Professional grid overlay for broadcast aesthetic */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `
            repeating-linear-gradient(0deg, 
              transparent 0px, 
              transparent 49px, 
              rgba(0, 216, 255, 0.03) 49px, 
              rgba(0, 216, 255, 0.03) 50px
            ),
            repeating-linear-gradient(90deg, 
              transparent 0px, 
              transparent 49px, 
              rgba(0, 216, 255, 0.03) 49px, 
              rgba(0, 216, 255, 0.03) 50px
            )
          `,
        }}
      />

      {/* Corner accents for broadcast framing */}
      {[
        { top: 20, left: 20, rotate: 0 },
        { top: 20, right: 20, rotate: 90 },
        { bottom: 300, left: 20, rotate: -90 },
        { bottom: 300, right: 20, rotate: 180 },
      ].map((corner, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            ...corner,
            width: 60,
            height: 60,
            border: '3px solid rgba(0, 216, 255, 0.4)',
            borderRight: 'none',
            borderBottom: 'none',
            transform: `rotate(${corner.rotate}deg)`,
            boxShadow: '0 0 10px rgba(0, 216, 255, 0.2)',
          }}
        />
      ))}

      {/* Map source attribution - Broadcast professional layout */}
      <div
        style={{
          position: 'absolute',
          bottom: 295,
          right: 15,
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(0, 216, 255, 0.2)',
          borderRadius: 3,
          fontSize: 10,
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          letterSpacing: '0.5px',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        }}
      >
        Map: © OpenStreetMap | CartoDB Dark Matter
      </div>
    </div>
  );
};

/**
 * Generate map tile URL using OpenStreetMap/CartoDB Dark Matter tiles
 * These are free tiles that don't require an API key
 */
function getMapTileUrl(
  lat: number,
  lon: number,
  zoom: number,
  width: number,
  height: number
): string {
  // Convert lat/lon to tile coordinates
  const xtile = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const ytile = Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)
  );

  // Use CartoDB Dark Matter tiles (free, dark theme perfect for our aesthetic)
  // These tiles are served via CDN and don't require API keys
  const tileServer = 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all';
  
  // Construct the tile URL
  // Format: https://server/{z}/{x}/{y}.png
  return `${tileServer}/${zoom}/${xtile}/${ytile}.png`;
}

