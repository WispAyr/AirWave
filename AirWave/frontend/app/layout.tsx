import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'

// Custom aircraft marker styles
const aircraftMarkerStyles = `
  .aircraft-marker {
    background: transparent !important;
    border: none !important;
  }
  
  .aircraft-marker-content {
    background: linear-gradient(135deg, #00d8ff 0%, #0099cc 100%);
    border: 2px solid #ffffff;
    border-radius: 8px;
    padding: 4px 8px;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #000000;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 216, 255, 0.3);
    min-width: 60px;
    transform: translate(-50%, -50%);
  }
  
  .aircraft-icon {
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  
  .aircraft-callsign {
    font-weight: bold;
    font-size: 9px;
    color: #000000;
    margin-bottom: 1px;
  }
  
  .aircraft-alt, .aircraft-speed {
    font-size: 8px;
    color: #333333;
    line-height: 1.1;
  }
  
  .aircraft-marker:hover .aircraft-marker-content {
    background: linear-gradient(135deg, #00d8ff 0%, #00aaff 100%);
    box-shadow: 0 4px 12px rgba(0, 216, 255, 0.5);
    transform: translate(-50%, -50%) scale(1.1);
    transition: all 0.2s ease;
  }
`

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'AIRWAVE | Mission Control',
  description: 'Real-time aviation data mission control powered by Airframes.io',
  other: {
    'disable-service-worker': 'true',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: aircraftMarkerStyles }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-spacex-dark text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

