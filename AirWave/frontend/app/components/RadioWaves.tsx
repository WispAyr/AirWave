'use client'

export default function RadioWaves() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      {/* Radio wave emanating from top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div className="radio-wave radio-wave-1"></div>
        <div className="radio-wave radio-wave-2"></div>
        <div className="radio-wave radio-wave-3"></div>
        <div className="radio-wave radio-wave-4"></div>
        <div className="radio-wave radio-wave-5"></div>
      </div>

      {/* Radio wave emanating from bottom */}
      <div className="absolute bottom-0 right-1/4">
        <div className="radio-wave-bottom radio-wave-bottom-1"></div>
        <div className="radio-wave-bottom radio-wave-bottom-2"></div>
        <div className="radio-wave-bottom radio-wave-bottom-3"></div>
      </div>

      {/* Circular waves from left */}
      <div className="absolute left-0 top-1/3">
        <div className="radio-circle radio-circle-1"></div>
        <div className="radio-circle radio-circle-2"></div>
        <div className="radio-circle radio-circle-3"></div>
        <div className="radio-circle radio-circle-4"></div>
      </div>

      {/* Circular waves from right */}
      <div className="absolute right-0 bottom-1/4">
        <div className="radio-circle-right radio-circle-right-1"></div>
        <div className="radio-circle-right radio-circle-right-2"></div>
        <div className="radio-circle-right radio-circle-right-3"></div>
      </div>

      {/* Horizontal signal lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00d8ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#00d8ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00d8ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0075c9" stopOpacity="0" />
            <stop offset="50%" stopColor="#0075c9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0075c9" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Animated sine waves */}
        <path className="signal-wave signal-wave-1" d="M0,200 Q250,180 500,200 T1000,200 T1500,200 T2000,200" 
              stroke="url(#waveGradient1)" strokeWidth="2" fill="none" />
        <path className="signal-wave signal-wave-2" d="M0,400 Q250,420 500,400 T1000,400 T1500,400 T2000,400" 
              stroke="url(#waveGradient2)" strokeWidth="2" fill="none" />
        <path className="signal-wave signal-wave-3" d="M0,600 Q250,580 500,600 T1000,600 T1500,600 T2000,600" 
              stroke="url(#waveGradient1)" strokeWidth="1.5" fill="none" />
        <path className="signal-wave signal-wave-4" d="M0,800 Q250,820 500,800 T1000,800 T1500,800 T2000,800" 
              stroke="url(#waveGradient2)" strokeWidth="1.5" fill="none" />
      </svg>

      {/* Transmission tower icon effect */}
      <div className="absolute top-8 right-12 opacity-10">
        <svg width="60" height="80" viewBox="0 0 60 80" className="transmission-tower">
          <line x1="30" y1="10" x2="30" y2="70" stroke="#00d8ff" strokeWidth="2"/>
          <line x1="20" y1="20" x2="40" y2="20" stroke="#00d8ff" strokeWidth="2"/>
          <line x1="15" y1="35" x2="45" y2="35" stroke="#00d8ff" strokeWidth="2"/>
          <line x1="10" y1="50" x2="50" y2="50" stroke="#00d8ff" strokeWidth="2"/>
          <line x1="25" y1="70" x2="35" y2="70" stroke="#00d8ff" strokeWidth="3"/>
          
          {/* Signal emanations */}
          <circle className="tower-signal tower-signal-1" cx="30" cy="10" r="8" 
                  stroke="#00ff41" strokeWidth="1" fill="none"/>
          <circle className="tower-signal tower-signal-2" cx="30" cy="10" r="15" 
                  stroke="#00d8ff" strokeWidth="0.5" fill="none"/>
          <circle className="tower-signal tower-signal-3" cx="30" cy="10" r="22" 
                  stroke="#00ff41" strokeWidth="0.5" fill="none"/>
        </svg>
      </div>

      {/* Satellite dish effect */}
      <div className="absolute bottom-12 left-12 opacity-10">
        <svg width="70" height="70" viewBox="0 0 70 70" className="satellite-dish">
          <ellipse cx="35" cy="35" rx="30" ry="15" stroke="#00d8ff" strokeWidth="2" fill="none"/>
          <line x1="35" y1="50" x2="35" y2="65" stroke="#00d8ff" strokeWidth="2"/>
          <circle cx="35" cy="35" r="3" fill="#00ff41"/>
          
          {/* Signal waves */}
          <path className="dish-signal dish-signal-1" 
                d="M35,35 Q20,15 5,5" stroke="#00d8ff" strokeWidth="1" fill="none"/>
          <path className="dish-signal dish-signal-2" 
                d="M35,35 Q35,10 35,0" stroke="#00ff41" strokeWidth="1" fill="none"/>
          <path className="dish-signal dish-signal-3" 
                d="M35,35 Q50,15 65,5" stroke="#00d8ff" strokeWidth="1" fill="none"/>
        </svg>
      </div>
    </div>
  )
}

