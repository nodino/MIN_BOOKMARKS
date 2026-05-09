import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Trash2, 
  Clock,
  Keyboard,
  X,
  Save,
  Edit2,
  Check,
  Power
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Marker {
  id: string;
  timecode: string;
  note: string;
  timestamp: number;
  color?: string;
}

interface ShortcutMap {
  [key: string]: string;
}

const DEFAULT_SHORTCUTS: ShortcutMap = {
  F1: "START",
  F2: "END",
  F3: "HIGHLIGHT",
  F4: "RE-TAKE",
  F5: "INTERVIEW",
  F6: "B-ROLL",
  F7: "AUDIO FIX",
  F8: "ALARM"
};

import { Language, translations } from './translations';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [currentTimecode, setCurrentTimecode] = useState('00:00:00:00');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [autoAddMode, setAutoAddMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xml' | 'srt'>('csv');
  const [activeNote, setActiveNote] = useState('');
  const [selectedColor, setSelectedColor] = useState('accent');
  
  const [timecodeMode, setTimecodeMode] = useState<'sync' | 'free'>('sync');
  const [freeRunStartTime, setFreeRunStartTime] = useState<number | null>(null);
  const [freeRunOffset, setFreeRunOffset] = useState<number>(0);
  const [isFreeRunning, setIsFreeRunning] = useState(false);
  const [freeRunStartInput, setFreeRunStartInput] = useState('00:00:00:00');
  const [framerate, setFramerate] = useState<number>(30);

  // Companion SSE connection state
  const [companionConnected, setCompanionConnected] = useState(false);
  const companionSseRef = useRef<EventSource | null>(null);

  // Shutdown confirmation modal
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  // Stable refs for SSE callbacks (avoids stale closure issues)
  const framerateRef = useRef(framerate);
  useEffect(() => { framerateRef.current = framerate; }, [framerate]);
  const freeRunStartInputRef = useRef(freeRunStartInput);
  useEffect(() => { freeRunStartInputRef.current = freeRunStartInput; }, [freeRunStartInput]);

  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingTimecode, setEditingTimecode] = useState('');

  const parseTimecodeToMs = (tc: string, fps: number = 30) => {
    const parts = tc.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    const f = parseInt(parts[3], 10) || 0;
    return ((h * 3600) + (m * 60) + s) * 1000 + (f * (1000 / fps));
  };


  const inputRef = useRef<HTMLInputElement>(null);
  const isFreeRunningRef = useRef(isFreeRunning);
  useEffect(() => { isFreeRunningRef.current = isFreeRunning; }, [isFreeRunning]);

  const shutdownServer = async () => {
    setIsShuttingDown(true);
    try {
      const basePath = import.meta.env.BASE_URL || '/';
      await fetch(`${basePath}api/shutdown`, { method: 'POST' });
    } catch (_) { /* server closed before responding, that's fine */ }
    setTimeout(() => {
      setIsShuttingDown(false);
      setShowShutdownConfirm(false);
    }, 1000);
  };

  const toggleFreeRun = () => {
    if (isFreeRunning) {
      setIsFreeRunning(false);
      if (freeRunStartTime) {
        setFreeRunOffset(prev => prev + (Date.now() - freeRunStartTime));
      }
    } else {
      setIsFreeRunning(true);
      setFreeRunStartTime(Date.now());
    }
  };

  const resetFreeRun = () => {
    setIsFreeRunning(false);
    const ms = parseTimecodeToMs(freeRunStartInput, framerate);
    setFreeRunOffset(ms);
    setFreeRunStartTime(null);
    setCurrentTimecode(freeRunStartInput);
  };

  // Local Timecode Generator for Free Run Mode
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timecodeMode === 'free' && isFreeRunning) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - (freeRunStartTime || now) + freeRunOffset;
        
        const totalFrames = Math.floor((elapsed / 1000) * framerate);
        const calcFps = Math.round(framerate);
        const frames = totalFrames % calcFps;
        const totalSeconds = Math.floor(elapsed / 1000);
        const seconds = totalSeconds % 60;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;
        const hours = Math.floor(totalMinutes / 60);

        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
        setCurrentTimecode(formatted);
      }, 33); // roughly 30fps update
    }
    return () => clearInterval(interval);
  }, [timecodeMode, isFreeRunning, freeRunStartTime, freeRunOffset, framerate]);

  // ---------------------------------------------------------------------------
  // Companion SSE listener — connects on mount, reconnects on drop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;

    const connect = () => {
      const basePath = import.meta.env.BASE_URL || '/';
      const es = new EventSource(`${basePath}api/events`);
      companionSseRef.current = es;

      es.onopen = () => {
        setCompanionConnected(true);
        console.log('[SSE] Connected to server events');
      };

      es.addEventListener('rec-start', (e: MessageEvent) => {
        console.log('[Companion] rec-start received', e.data);
        let startTc = '00:00:00:00';
        try {
          const payload = JSON.parse(e.data);
          if (payload.timecode) startTc = payload.timecode;
        } catch (_) {}

        // Switch to Free Run mode and start the timecode
        setTimecodeMode('free');
        setFreeRunStartInput(startTc);
        const offsetMs = parseTimecodeToMs(startTc, framerateRef.current);
        setFreeRunOffset(offsetMs);
        setFreeRunStartTime(Date.now());
        setIsFreeRunning(true);

        console.log('REC via Companion');
      });

      es.addEventListener('rec-stop', () => {
        console.log('[Companion] rec-stop received');
        if (isFreeRunningRef.current) {
          setFreeRunOffset(prev => prev + (Date.now() - (Date.now())));
          setIsFreeRunning(false);
          setFreeRunStartTime(null);
        }

        console.log('REC stopped via Companion');
      });

      es.onerror = () => {
        setCompanionConnected(false);
        es.close();
        // Reconnect after 3 s
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      companionSseRef.current?.close();
      clearTimeout(retryTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const addMarker = (note: string) => {
    if (autoAddMode && !isFreeRunning) return;
    const cleanNote = note.trim() || 'MANUAL MARKER';
    const newMarker: Marker = {
      id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      timecode: currentTimecode,
      note: cleanNote,
      timestamp: Date.now(),
      color: selectedColor
    };
    setMarkers(prev => [newMarker, ...prev]);
  };

  const deleteMarker = (id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const startEditing = (m: Marker) => {
    setEditingMarkerId(m.id);
    setEditingNote(m.note);
    setEditingTimecode(m.timecode);
  };

  const cancelEditing = () => {
    setEditingMarkerId(null);
  };

  const saveEditing = (id: string) => {
    setMarkers(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, note: editingNote, timecode: editingTimecode };
      }
      return m;
    }));
    setEditingMarkerId(null);
  };

  const handleLiveNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote.trim()) return;
    addMarker(activeNote);
    setActiveNote('');
  };

  const exportToPremiereCSV = () => {
    if (markers.length === 0) return;
    const header = "Marker Name,Description,In,Out,Duration,Marker Type\n";
    const rows = markers.map(m => `"${m.note}","","${m.timecode}","${m.timecode}","00:00:00:01","Comment"`).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `tc1_markers_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportToPremiereXML = () => {
    if (markers.length === 0) return;
    
    // Helper function to convert timecode to frames
    const tcToFrames = (tc: string, fps: number): number => {
      const parts = tc.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const s = parseInt(parts[2], 10) || 0;
      const f = parseInt(parts[3], 10) || 0;
      return ((h * 3600) + (m * 60) + s) * fps + f;
    };

    // Calculate total duration (using the last marker's timecode for simplicity)
    const lastMarker = markers[markers.length - 1];
    let totalFrames = 0;
    if (lastMarker) {
      totalFrames = tcToFrames(lastMarker.timecode, framerate);
    }
    
    // Generate XML with proper structure according to template
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <!-- Sequence definition -->
  <sequence id="seq-001"
            TL.SQAudioVisibleBase="0"
            TL.SQVideoVisibleBase="0"
            TL.SQVisibleBaseTime="0">
    <uuid>00000000-0000-0000-0000-000000000000</uuid>

    <!-- Basic sequence information -->
    <duration>${totalFrames}</duration>                 <!-- total frames of the sequence -->
    <rate>
      <timebase>${Math.round(framerate)}</timebase>        <!-- e.g. 25, 30, 50 -->
      <ntsc>${framerate === 59.94 || framerate === 29.97 || framerate === 23.976 ? 'TRUE' : 'FALSE'}</ntsc>
    </rate>
    <name>Marker Session ${new Date().toLocaleDateString()}</name>

    <!-- Minimal media block – required by Premiere even if empty -->
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${Math.round(framerate)}</timebase>
              <ntsc>${framerate === 59.94 || framerate === 29.97 || framerate === 23.976 ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
            <width>1920</width>                     <!-- e.g. 1920 -->
            <height>1080</height>                  <!-- e.g. 1080 -->
            <pixelaspectratio>square</pixelaspectratio>
          </samplecharacteristics>
        </format>
      </video>
      <audio>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
      </audio>
    </media>

    <!-- MARKERS ---------------------------------------------------------- -->
    <!-- Use frame numbers for <in> and <out>.  -1 means “no out point”. -->
    <!-- Optional <pproColor> can be any 32‑bit unsigned int (RGB+alpha). -->
`;
    
    // Add markers with converted timecodes
    markers.forEach((m, index) => {
      // Assign colors for markers (if desired)
      const colors = [
        4280578025, // Red
        4281740498, // Green  
        4294741314, // Blue
        4294967295, // White
        4278190080, // Black
        4286611584, // Yellow
        4286611712, // Orange
        4286771328  // Purple
      ];
      
      const color = colors[index % colors.length];
      
      xml += `    <marker>
      <comment></comment>
      <name>${m.note}</name>
      <in>${tcToFrames(m.timecode, framerate)}</in>
      <out>-1</out>        <!-- use -1 if you only need an in‑point -->
      <pproColor>${color}</pproColor>   <!-- e.g. 4280578025 -->
    </marker>
`;
    });

    // Add timecode display
    xml += `    <!-- --------------------------------------------------------------- -->

    <!-- Timecode display (optional but useful) -->
    <timecode>
      <rate>
        <timebase>${Math.round(framerate)}</timebase>
        <ntsc>${framerate === 59.94 || framerate === 29.97 || framerate === 23.976 ? 'TRUE' : 'FALSE'}</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
  </sequence>
</xmeml>`;

    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    downloadFile(blob, `tc1_markers_${new Date().toISOString().split('T')[0]}.xml`);
  };

  const timecodeToSRT = (tc: string, fps: number) => {
    const parts = tc.split(':');
    const h = parts[0];
    const m = parts[1];
    const s = parts[2];
    const f = parseInt(parts[3], 10);
    const ms = Math.floor((f / fps) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };

  const exportToSRT = () => {
    if (markers.length === 0) return;
    let srt = '';
    // Reverse markers to export chronologically if they are currently newest-first
    const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedMarkers.forEach((m, index) => {
      const timestamp = timecodeToSRT(m.timecode, framerate);
      srt += `${index + 1}\n`;
      srt += `${timestamp} --> ${timestamp}\n`;
      srt += `${m.note}\n\n`;
    });

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8;' });
    downloadFile(blob, `tc1_markers_${new Date().toISOString().split('T')[0]}.srt`);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in a text field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || showSettings) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      if (e.key.startsWith('F')) {
        const keyName = e.key;
        if (shortcuts[keyName]) {
          e.preventDefault();
          addMarker(shortcuts[keyName]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTimecode, autoAddMode, shortcuts, showSettings]);

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[#0a0a0c] text-[#e0e0e6] overflow-hidden">
      {/* Mini Sidebar Menu */}
      <aside className="w-full lg:w-[64px] h-[70px] lg:h-auto bg-[#15161a] border-t lg:border-t-0 lg:border-r border-border flex flex-row lg:flex-col items-center justify-around lg:justify-start py-0 lg:py-6 px-4 lg:px-0 gap-2 lg:gap-6 order-last lg:order-first z-10 shrink-0">
        <div className="flex-col items-center gap-1 mb-0 lg:mb-4 hidden lg:flex">
          <div className="bg-accent p-2 rounded-lg">
            <Activity className="h-5 w-5 text-white" />
          </div>
        </div>

        <nav className="flex flex-row lg:flex-col gap-8 lg:gap-6 items-center">
          <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 text-text-dim hover:text-white transition-colors group">
            <Settings className="h-5 w-5 lg:h-5 lg:w-5 group-hover:rotate-45 transition-transform" />
            <span className="text-[8px] uppercase font-bold tracking-tighter hidden lg:block">{t.nav.config}</span>
          </button>
          
          <button 
            onClick={() => setAutoAddMode(!autoAddMode)} 
            className={`flex flex-col items-center gap-1 transition-colors ${autoAddMode ? 'text-accent' : 'text-text-dim hover:text-white'}`}
          >
            {autoAddMode ? <CheckCircle2 className="h-5 w-5 lg:h-5 lg:w-5" /> : <AlertCircle className="h-5 w-5 lg:h-5 lg:w-5" />}
            <span className="text-[8px] uppercase font-bold tracking-tighter hidden lg:block">{autoAddMode ? t.nav.sync : t.nav.free}</span>
          </button>

          <button onClick={() => setMarkers([])} className="flex flex-col items-center gap-1 text-text-dim hover:text-red-500 transition-colors">
            <Trash2 className="h-5 w-5 lg:h-5 lg:w-5" />
            <span className="text-[8px] uppercase font-bold tracking-tighter hidden lg:block">{t.nav.clear}</span>
          </button>
        </nav>

        <div className="mt-0 lg:mt-auto flex flex-row lg:flex-col items-center gap-4 py-0 lg:py-4 lg:border-t border-border lg:w-full">
           <button onClick={() => {
             if (exportFormat === 'csv') exportToPremiereCSV();
             else if (exportFormat === 'xml') exportToPremiereXML();
             else exportToSRT();
           }} className="flex flex-col items-center gap-1 text-accent hover:text-white transition-colors" disabled={markers.length === 0}>
            <Download className="h-5 w-5 lg:h-5 lg:w-5" />
            <span className="text-[8px] uppercase font-bold tracking-tighter hidden lg:block">{t.nav.export}</span>
          </button>

          {/* Shutdown button — only visible when running as .exe (server reachable) */}
          <button
            onClick={() => setShowShutdownConfirm(true)}
            className="flex flex-col items-center gap-1 text-text-dim/30 hover:text-red-500 transition-colors"
            title="Arrêter le serveur"
          >
            <Power className="h-5 w-5 lg:h-5 lg:w-5" />
            <span className="text-[8px] uppercase font-bold tracking-tighter hidden lg:block">Stop</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="border-b border-border flex flex-col lg:flex-row items-center justify-between px-4 lg:px-8 py-3 lg:py-0 bg-[#15161a]/30 gap-4 shrink-0 lg:h-[60px]">
          <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-6 w-full lg:w-auto justify-between lg:justify-start">
            <h1 className="text-xs font-black tracking-[0.2em] uppercase">
              MIN <span className="text-accent">MARKERS</span>
            </h1>

            {/* Companion SSE status badge */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest transition-all ${
              companionConnected
                ? 'bg-green-500/10 border-green-500/40 text-green-400'
                : 'bg-white/5 border-border text-text-dim/40'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${
                companionConnected ? 'bg-green-400 animate-pulse' : 'bg-text-dim/30'
              }`} />
              COMPANION
            </div>

            <div className="flex items-center bg-black/40 p-1 rounded-lg border border-border shrink-0">
              <button 
                onClick={() => {
                  setTimecodeMode('free');
                  if (!isFreeRunning) {
                    setCurrentTimecode(freeRunStartInput);
                    setFreeRunOffset(parseTimecodeToMs(freeRunStartInput, framerate));
                  }
                }} 
                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded transition-all ${timecodeMode === 'free' ? 'bg-[#2a2c33] text-white shadow' : 'text-text-dim hover:text-white'}`}
              >
                {t.header.freeRun}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 bg-black/40 px-2 rounded border border-border h-[26px] flex-1 lg:flex-none justify-center">
              <div className="flex items-center group relative">
                <input 
                  value={freeRunStartInput}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9:]/g, '');
                    setFreeRunStartInput(val);
                    if (!isFreeRunning) {
                      setCurrentTimecode(val);
                      setFreeRunOffset(parseTimecodeToMs(val, framerate));
                    }
                  }}
                  maxLength={11}
                  disabled={isFreeRunning}
                  className="bg-transparent border-none outline-none text-[9px] font-mono w-16 text-center text-text-dim disabled:opacity-50 focus:text-white hover:text-white transition-colors"
                  placeholder="00:00:00:00"
                />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-widest font-bold text-text-dim opacity-0 group-hover:opacity-100 transition-opacity bg-black px-1.5 py-0.5 rounded border border-border whitespace-nowrap pointer-events-none z-10">Start Time</div>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <select
                value={framerate}
                onChange={(e) => {
                  const fps = Number(e.target.value);
                  setFramerate(fps);
                  if (!isFreeRunning) {
                    setFreeRunOffset(parseTimecodeToMs(freeRunStartInput, fps));
                  }
                }}
                disabled={isFreeRunning}
                className="bg-transparent border-none outline-none text-[9px] font-mono text-text-dim disabled:opacity-50 appearance-none cursor-pointer hover:text-white text-center w-14"
                title="Framerate"
              >
                <option value={23.976}>23.98 fps</option>
                <option value={24}>24 fps</option>
                <option value={25}>25 fps</option>
                <option value={29.97}>29.97 fps</option>
                <option value={30}>30 fps</option>
                <option value={50}>50 fps</option>
                <option value={59.94}>59.94 fps</option>
                <option value={60}>60 fps</option>
              </select>
              <div className="h-4 w-px bg-border"></div>
              <button onClick={toggleFreeRun} className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded transition-all ${isFreeRunning ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}>
                {isFreeRunning ? 'Pause' : 'Start'}
              </button>
              <button onClick={resetFreeRun} className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded text-text-dim hover:bg-white/10 hover:text-white transition-all">
                Reset
              </button>
            </div>

            <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest flex items-center gap-1.5 transition-all shrink-0 ${isFreeRunning ? 'bg-accent/10 border-accent text-accent' : 'bg-white/5 border-border text-text-dim'}`}>
              <div className={`h-2 w-2 rounded-full ${isFreeRunning ? 'bg-accent animate-pulse-dot shadow-[0_0_8px_#ff4e00]' : 'bg-text-dim'}`} />
              {isFreeRunning ? t.header.status.running : t.header.status.stopped}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden relative">
          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_350px] min-h-full lg:h-full">
            {/* Working Central Column */}
            <div className="flex flex-col p-4 lg:p-6 gap-4 lg:gap-8 lg:overflow-y-auto border-b lg:border-b-0 border-border pb-6 lg:min-h-0">
              
              {/* Huge Timecode Display */}
              <div className="bg-black/60 rounded-3xl p-6 lg:p-10 flex flex-col items-center justify-center border border-white/5 shadow-2xl relative group min-h-[120px] lg:min-h-auto">
                <div className="absolute top-4 left-6 lg:top-5 lg:left-8 text-[9px] lg:text-[10px] font-bold tracking-[0.4em] text-text-dim opacity-30 uppercase">{t.header.masterTc}</div>
                <div className="text-[50px] sm:text-[70px] lg:text-[100px] font-tc font-black tracking-[0.1em] text-[#e0e0e6] tc-glow leading-none tabular-nums select-none translate-y-1 w-full text-center">
                  {currentTimecode}
                </div>
              </div>

              {/* Live Entry Logic */}
              <div className="flex flex-col gap-4 lg:gap-6 shrink-0">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-panel border border-border p-4 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-text-dim">{t.main.currentTime}</span>
                      <span className="text-lg lg:text-xl font-mono font-bold">{currentTimecode}</span>
                    </div>
                    <div className="bg-panel border border-border p-4 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-text-dim">{t.main.logColor}</span>
                      <div className="flex gap-2">
                         {['accent', 'blue-500', 'purple-500'].map(c => (
                           <button 
                             key={c}
                             onClick={() => setSelectedColor(c)}
                             className={`h-5 w-5 lg:h-4 lg:w-4 rounded-full border-2 transition-all ${selectedColor === c ? 'border-white scale-110' : 'border-transparent opacity-40 hover:opacity-100'}`}
                             style={{ backgroundColor: c === 'accent' ? 'var(--color-accent)' : c === 'blue-500' ? '#3b82f6' : '#a855f7' }}
                           />
                         ))}
                      </div>
                    </div>
                 </div>

                 <form onSubmit={handleLiveNoteSubmit} className="relative">
                    <input 
                      ref={inputRef}
                      value={activeNote}
                      onChange={(e) => setActiveNote(e.target.value)}
                      placeholder={t.main.placeholder}
                      className="w-full bg-black/60 border-2 border-border focus:border-accent rounded-2xl py-4 px-5 lg:py-5 lg:px-6 text-lg lg:text-xl font-bold transition-all outline-none placeholder:text-text-dim placeholder:opacity-30 shadow-inner"
                    />
                    <div className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 lg:gap-3">
                      <span className="hidden sm:inline bg-white/5 text-[8px] lg:text-[9px] font-bold text-text-dim px-2 lg:px-2 py-0.5 rounded border border-white/10">ENTER</span>
                      <button type="submit" className="p-2 lg:p-2 bg-accent rounded-full shadow-lg shadow-accent/20">
                        <Save className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                      </button>
                    </div>
                 </form>
              </div>

              {/* Instant Actions Grid */}
              <div className="shrink-0 pt-2 lg:pt-0">
                <h3 className="text-[11px] uppercase font-bold tracking-[0.3em] text-text-dim mb-4 lg:mb-6">{t.main.instantActions}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
                  {Object.entries(shortcuts).map(([key, note]) => (
                    <button
                      key={key}
                      onClick={() => addMarker(note as string)}
                      className="group flex flex-col items-center justify-center p-3 lg:p-4 bg-[#15161a] border border-border rounded-xl transition-all hover:bg-[#2a2c33] active:scale-95"
                    >
                      <span className="text-[8px] lg:text-[9px] font-bold text-text-dim/40 mb-1">{key}</span>
                      <strong className="text-[10px] lg:text-xs font-black tracking-widest uppercase group-hover:text-accent transition-colors text-center leading-tight">{note}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Markers List Column */}
            <div className="bg-[#15161a]/50 lg:border-l border-border flex flex-col lg:overflow-hidden lg:min-h-0 h-[500px] lg:h-auto">
               <div className="p-3 lg:p-4 border-b border-border flex items-center justify-between bg-black/20 shrink-0">
                  <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-dim">{t.session.title}</h2>
                  <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-black">{markers.length}</span>
               </div>
               
               <div className="flex-1 overflow-y-auto px-3 lg:px-4 py-3 lg:py-4">
                  <div className="flex flex-col gap-2">
                     <AnimatePresence initial={false}>
                        {markers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 lg:py-16 text-text-dim/20 gap-3">
                             <Clock className="h-6 w-6 lg:h-8 lg:w-8" />
                             <p className="text-[9px] lg:text-[10px] uppercase font-bold tracking-widest">{t.session.noMarkers}</p>
                          </div>
                        ) : (
                          markers.map((m, i) => (
                             <motion.div 
                               key={m.id}
                               initial={{ x: 20, opacity: 0 }}
                               animate={{ x: 0, opacity: 1 }}
                               className={`bg-[#15161a] border border-border p-2.5 lg:p-3 rounded-xl flex items-center justify-between group transition-all hover:border-white/10 ${i === 0 ? 'ring-1 ring-accent/30' : ''}`}
                             >
                               {editingMarkerId === m.id ? (
                                  <div className="flex flex-col gap-2 w-full pr-2">
                                    <input 
                                       value={editingNote}
                                       onChange={(e) => setEditingNote(e.target.value)}
                                       className="bg-black/40 border border-border rounded px-2 py-1 text-xs font-black text-white w-full outline-none focus:border-accent"
                                       autoFocus
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <input 
                                         value={editingTimecode}
                                         onChange={(e) => setEditingTimecode(e.target.value)}
                                         className="bg-black/40 border border-border rounded px-2 py-1 text-[10px] font-mono font-bold text-text-dim w-full outline-none focus:border-accent"
                                      />
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => saveEditing(m.id)} className="p-1 text-green-500 hover:bg-green-500/20 rounded transition-all">
                                           <Check className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => cancelEditing()} className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-all">
                                           <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                               ) : (
                                 <>
                                   <div className="flex flex-col gap-0.5 lg:gap-1 overflow-hidden pr-2">
                                      <div className="flex items-center gap-2">
                                         <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color === 'accent' ? 'var(--color-accent)' : m.color === 'blue-500' ? '#3b82f6' : m.color === 'purple-500' ? '#a855f7' : 'var(--color-text-dim)' }} />
                                         <span className="text-[10px] lg:text-[11px] font-black tracking-wide text-text-main group-hover:scale-[1.02] origin-left transition-transform truncate">{m.note}</span>
                                      </div>
                                      <span className="text-[9px] lg:text-[10px] font-mono font-bold text-text-dim ml-3.5">{m.timecode}</span>
                                   </div>
                                   <div className="flex items-center gap-1 shrink-0">
                                     <button onClick={() => startEditing(m)} className="p-1.5 text-text-dim/50 hover:text-white transition-all opacity-0 group-hover:opacity-100 sm-max:opacity-100">
                                        <Edit2 className="h-3 w-3" />
                                     </button>
                                     <button onClick={() => deleteMarker(m.id)} className="p-1.5 text-text-dim/50 hover:text-accent transition-all">
                                        <Trash2 className="h-3 w-3" />
                                     </button>
                                   </div>
                                 </>
                               )}
                             </motion.div>
                          ))
                        )}
                     </AnimatePresence>
                  </div>
               </div>

               <div className="p-4 lg:p-6 border-t border-border bg-black/20 flex flex-col gap-3 lg:gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                     <button 
                       onClick={() => setExportFormat('csv')}
                       className={`flex-1 py-2 lg:py-2 text-[10px] font-bold uppercase tracking-widest rounded border transition-all ${exportFormat === 'csv' ? 'bg-accent text-white border-accent' : 'border-border text-text-dim'}`}
                     >
                       CSV
                     </button>
                     <button 
                       onClick={() => setExportFormat('xml')}
                       className={`flex-1 py-2 lg:py-2 text-[10px] font-bold uppercase tracking-widest rounded border transition-all ${exportFormat === 'xml' ? 'bg-accent text-white border-accent' : 'border-border text-text-dim'}`}
                     >
                       XML
                     </button>
                     <button 
                       onClick={() => setExportFormat('srt')}
                       className={`flex-1 py-2 lg:py-2 text-[10px] font-bold uppercase tracking-widest rounded border transition-all ${exportFormat === 'srt' ? 'bg-accent text-white border-accent' : 'border-border text-text-dim'}`}
                     >
                       SRT
                     </button>
                  </div>
                  <button 
                    onClick={() => {
                      if (exportFormat === 'csv') exportToPremiereCSV();
                      else if (exportFormat === 'xml') exportToPremiereXML();
                      else exportToSRT();
                    }}
                    disabled={markers.length === 0}
                    className="w-full bg-text-main text-bg-dark py-2 lg:py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all disabled:opacity-20 shadow-xl"
                  >
                    {t.export.download}
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Unchanged Logically) */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#15161a] border border-border rounded-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl flex flex-col"
            >
              <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0 sticky top-0 bg-[#15161a] z-10">
                <div className="flex items-center gap-3">
                  <Keyboard className="text-accent h-5 w-5 md:h-6 md:w-6" />
                  <h2 className="text-lg md:text-xl font-black tracking-tight uppercase">{t.config.title}</h2>
                </div>
                <div className="flex items-center gap-2 mr-4">
                  <button 
                    onClick={() => setLang('en')}
                    className={`px-2 py-1 text-[10px] font-black rounded border transition-all ${lang === 'en' ? 'bg-accent text-white border-accent' : 'border-border text-text-dim'}`}
                  >
                    EN
                  </button>
                  <button 
                    onClick={() => setLang('fr')}
                    className={`px-2 py-1 text-[10px] font-black rounded border transition-all ${lang === 'fr' ? 'bg-accent text-white border-accent' : 'border-border text-text-dim'}`}
                  >
                    FR
                  </button>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-text-dim hover:text-white transition-colors p-2">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {Object.keys(DEFAULT_SHORTCUTS).map(key => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">{key} {t.config.noteLabel}</label>
                    <input 
                      value={shortcuts[key]}
                      onChange={(e) => setShortcuts(prev => ({ ...prev, [key]: e.target.value.toUpperCase() }))}
                      className="bg-black/60 border border-border rounded-xl px-4 py-2 text-xs text-white focus:border-accent outline-none font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 md:p-6 bg-black/20 border-t border-border flex items-center justify-between mt-auto sticky bottom-0 z-10">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-accent text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/80 transition-all shadow-lg shadow-accent/20"
                >
                  <Save className="h-4 w-4" /> {t.config.save}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shutdown Confirmation Modal */}
      <AnimatePresence>
        {showShutdownConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#15161a] border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center gap-6"
            >
              <div className="bg-red-500/10 p-4 rounded-full">
                <Power className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-black uppercase tracking-tight mb-2">Arrêter le serveur ?</h2>
                <p className="text-[11px] text-text-dim leading-relaxed">
                  Le serveur va s'arrêter.<br />Ferme cet onglet ensuite.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowShutdownConfirm(false)}
                  disabled={isShuttingDown}
                  className="flex-1 py-3 rounded-xl border border-border text-[11px] font-black uppercase tracking-widest text-text-dim hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  onClick={shutdownServer}
                  disabled={isShuttingDown}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isShuttingDown ? (
                    <><span className="animate-spin h-3 w-3 border-2 border-white/40 border-t-white rounded-full" /> Arrêt...</>
                  ) : (
                    <><Power className="h-3.5 w-3.5" /> Confirmer</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
