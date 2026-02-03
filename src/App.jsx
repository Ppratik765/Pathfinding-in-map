import React, { useRef, useState, useEffect } from 'react';
import { MapBoard } from './components/MapBoard';
import { Background } from './components/Background';
import { CitySelector } from './components/CitySelector'; 
import { buildGraphFromGeoJSON } from './utils/graphUtils';
import { decodeStateFromUrl, updateUrl } from './utils/urlUtils';
import { Play, RefreshCw, Moon, Sun, Map as MapIcon, BrickWall, MousePointer2, Plus, Minus, TrafficCone, RotateCcw, Info, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState("Zoom in & Click 'Load Roads'");
  const [tool, setTool] = useState('start');
  const [showPerimeter, setShowPerimeter] = useState(true); 

  // --- 1. INITIALIZE FROM URL ---
  const urlState = useRef(decodeStateFromUrl()).current; 

  const [activeAlgos, setActiveAlgos] = useState(urlState.activeAlgos || ['dijkstra']); 

  const [viewState, setViewState] = useState(() => {
      if (urlState.viewState) return urlState.viewState;
      const saved = localStorage.getItem('mapViewState');
      return saved ? JSON.parse(saved) : { center: [-0.0803, 51.5145], zoom: 15, pitch: 60, bearing: 0 };
  });

  const [sharedData, setSharedData] = useState({ 
      geojson: null, 
      graph: null, 
      start: urlState.start || null, 
      end: urlState.end || null, 
      obstacles: {} 
  });

  const [results, setResults] = useState({});
  const [finishedCount, setFinishedCount] = useState(0); 
  
  const mapRefs = useRef([]);
  const autoRunRef = useRef({
      needsLoad: urlState.shouldAutoRun,
      needsRun: urlState.shouldAutoRun,
      attemptedLoad: false
  });

  const allAlgorithms = [
      { value: 'dijkstra', label: 'Dijkstra' },
      { value: 'astar', label: 'A* Search' },
      { value: 'bfs', label: 'BFS' },
      { value: 'dfs', label: 'DFS' },
      { value: 'greedy', label: 'Greedy' },
      { value: 'bidirectional', label: 'Bi-Directional' },
  ];

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // --- 2. URL SYNC ---
  useEffect(() => { 
      localStorage.setItem('mapViewState', JSON.stringify(viewState)); 
      updateUrl(viewState, activeAlgos, sharedData.start, sharedData.end);
  }, [viewState, activeAlgos, sharedData.start, sharedData.end]);

  // --- 3. AUTO-PILOT LOGIC ---
  useEffect(() => {
      if (autoRunRef.current.needsLoad && !autoRunRef.current.attemptedLoad) {
          const timer = setTimeout(() => {
              if (mapRefs.current[0]) {
                  console.log("🚀 Auto-Pilot: Loading Roads...");
                  setStatus("Auto-Pilot: Loading Roads from URL location...");
                  mapRefs.current[0].loadRoads();
                  autoRunRef.current.attemptedLoad = true;
                  autoRunRef.current.needsLoad = false;
              }
          }, 1500);
          return () => clearTimeout(timer);
      }
  }, []);

  useEffect(() => {
      if (autoRunRef.current.needsRun && sharedData.graph) {
          console.log("🚀 Auto-Pilot: Running Algorithms...");
          setStatus("Auto-Pilot: Running Algorithms...");
          setTimeout(() => {
              handleRun();
              autoRunRef.current.needsRun = false; 
          }, 500);
      }
  }, [sharedData.graph]);


  const handleViewChange = (center, zoom, pitch, bearing) => { setViewState({ center: [center.lng, center.lat], zoom, pitch, bearing }); };
  const handleDataUpdate = (updates) => {
      setSharedData(prev => {
          const next = { ...prev, ...updates };
          if (updates.geojson || updates.obstacles) {
              const geojson = next.geojson || prev.geojson;
              const isFastMode = geojson?.properties?.isFastMode || false;
              next.graph = buildGraphFromGeoJSON(geojson, next.obstacles || prev.obstacles, isFastMode);
          }
          return next;
      });
  };
  const handleLoadRoads = () => { if(mapRefs.current[0]) mapRefs.current[0].loadRoads(); };
  
  const handlePresetSelect = (city) => {
      setViewState({ center: [city.lng, city.lat], zoom: city.zoom, pitch: 60, bearing: 0 });
      setStatus(`Warping to ${city.name}... Click Load!`);
  };

  const formatDist = (cost, explored) => {
      const c = parseFloat(cost);
      const e = parseFloat(explored);
      if (c === 0 && e > 0) return <span className="text-red-500">No Path</span>;
      return <span className="font-bold text-orange-500">{cost}km</span>;
  };

  const handleRun = () => { 
      setResults({}); 
      setFinishedCount(0); 
      activeAlgos.forEach((_, idx) => { if(mapRefs.current[idx]) mapRefs.current[idx].run(); }); 
  };
  
  const handleReset = () => { 
      setSharedData({ geojson: null, graph: null, start: null, end: null, obstacles: {} }); 
      setResults({});
      setFinishedCount(0);
      mapRefs.current.forEach(ref => ref && ref.reset());
      setStatus("Reset. Load roads again."); 
      autoRunRef.current = { needsLoad: false, needsRun: false, attemptedLoad: false };
  };

  const handleResult = (index, stats) => { 
      setResults(prev => ({ ...prev, [index]: stats }));
      setFinishedCount(prev => prev + 1);
  };

  const handleReplay = (index) => {
      if(mapRefs.current[index]) mapRefs.current[index].run();
  };

  const getWinStatus = (index) => {
      if (activeAlgos.length === 1 || finishedCount < activeAlgos.length) return null;
      const myStats = results[index];
      if (!myStats) return null;
      let isWinner = true;
      for (const k of Object.keys(results)) {
          if (k === index.toString()) continue;
          const other = results[k];
          if (parseFloat(other.cost) < parseFloat(myStats.cost)) isWinner = false;
          else if (parseFloat(other.cost) === parseFloat(myStats.cost) && parseFloat(other.time) < parseFloat(myStats.time)) isWinner = false;
      }
      return isWinner ? 'winner' : 'loser';
  };

  const addMap = () => { if (activeAlgos.length < 4) { const used = new Set(activeAlgos); const next = allAlgorithms.find(a => !used.has(a.value))?.value || 'astar'; setActiveAlgos([...activeAlgos, next]); }};
  const removeMap = () => { if (activeAlgos.length > 1) setActiveAlgos(activeAlgos.slice(0, -1)); };
  const changeAlgo = (index, val) => { const newAlgos = [...activeAlgos]; newAlgos[index] = val; setActiveAlgos(newAlgos); };
  const getAvailableAlgorithms = (currentValue) => { const used = new Set(activeAlgos); return allAlgorithms.filter(a => !used.has(a.value) || a.value === currentValue); };

  const isError = status.includes("Error") || status.includes("Zoom") || status.includes("large") || status.includes("fail") || status.includes("Timed");

  // --- REUSABLE COMPONENTS (RESTORED) ---
  
  const InfoTooltip = () => (
    <div className="relative group shrink-0">
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400">
            <Info size={20} />
        </button>
        <div className="absolute top-10 left-0 md:left-1/2 md:-translate-x-1/2 w-[40vw] sm:w-[230px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-[100] text-xs leading-relaxed">
            <h3 className="font-bold text-sm mb-2 border-b pb-1 border-gray-200 dark:border-gray-700">How to Use</h3>
            <ol className="list-decimal pl-4 space-y-1.5 text-gray-600 dark:text-gray-300">
                <li><span className="font-bold text-blue-500">Search</span> or drag to a city.</li>
                <li><span className="font-bold text-blue-500">Zoom</span> to your desired level.</li>
                <li>Click <span className="font-bold bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded text-indigo-600 dark:text-indigo-400">LOAD</span>.</li>
                <li>Select <span className="font-bold text-green-600">Start</span> tool & click road.</li>
                <li>Select <span className="font-bold text-red-600">End</span> tool & click road.</li>
                <li>(Optional) Add <span className="font-bold">Walls</span>/<span className="font-bold text-orange-500">Traffic</span>.</li>
                <li>Click <span className="font-bold bg-green-100 dark:bg-green-900/30 px-1 rounded text-green-600 dark:text-green-400">RUN</span>!</li>
            </ol>
        </div>
    </div>
  );

  const MapCountControls = () => (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button onClick={removeMap} disabled={activeAlgos.length <= 1} className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"><Minus size={16}/></button>
        <span className="text-sm font-bold w-4 text-center">{activeAlgos.length}</span>
        <button onClick={addMap} disabled={activeAlgos.length >= 4} className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"><Plus size={16}/></button>
    </div>
  );

  const ThemeToggle = () => (
    <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-gray-800 rounded-xl transition-colors">{darkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
  );

  const ResetBtn = () => (
    <button onClick={handleReset} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><RefreshCw size={18}/></button>
  );

  const LoadBtn = () => (
    <button onClick={handleLoadRoads} className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] sm:text-xs shadow-lg hover:-translate-y-0.5 transition-all w-auto whitespace-nowrap"><MapIcon size={14} /> LOAD</button>
  );

  const RunBtn = () => (
    <button onClick={handleRun} className="flex items-center justify-center gap-2 px-3 md:px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-lg hover:-translate-y-0.5 transition-all w-full md:w-auto whitespace-nowrap"><Play size={14} /> RUN</button>
  );

  const ToolsGroup = () => (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-1 md:flex-none justify-center md:justify-start">
        {[
            { id: 'start', icon: MousePointer2, label: 'Start', col: 'text-green-600' },
            { id: 'end', icon: MousePointer2, label: 'End', col: 'text-red-600' },
            { id: 'wall', icon: BrickWall, label: 'Block', col: 'text-gray-600 dark:text-gray-300' },
            { id: 'traffic', icon: TrafficCone, label: 'Slow', col: 'text-orange-500' }
        ].map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} className={clsx("flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 md:flex-none justify-center", tool === t.id ? `bg-white dark:bg-gray-600 shadow-md ${t.col} scale-105` : "opacity-60 hover:opacity-100")}>
                <t.icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.charAt(0)}</span>
            </button>
        ))}
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center font-sans text-gray-800 dark:text-gray-100 relative pb-10 overflow-x-hidden">
      <Background darkMode={darkMode} />
      
      <style>{`
        .maplibregl-ctrl-geocoder { 
            min-width: 0 !important; 
            width: 100% !important; 
            max-width: 100% !important;
            box-shadow: none !important;
            background: transparent !important;
        }
        .maplibregl-ctrl-geocoder--input {
            width: 100% !important;
            height: 32px !important;
            padding: 5px 30px !important;
            font-size: 12px !important;
        }
      `}</style>

      {/* HEADER */}
      <div className="w-full max-w-7xl z-50 p-4 relative">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 border border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden">            
            
            {/* ROW 1 (Mobile) / LEFT (Desktop) */}
            <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-3">
                <h1 className="text-xl font-extrabold flex items-center gap-2">
                    <MapIcon className="text-blue-500" size={24} /> Way<span className="text-blue-600 dark:text-blue-400">Finder</span>
                </h1>
                
                <div className="flex items-center gap-1 md:hidden">
                    <InfoTooltip />
                    <MapCountControls />
                    <ResetBtn />
                    <ThemeToggle />
                </div>
            </div>
            
            {/* ROW 2 (Mobile) / CENTER (Desktop) */}
            <div className="flex items-center w-full md:flex-1 gap-2 order-2 md:order-none ">
                 <div className="hidden md:block"><CitySelector onSelect={handlePresetSelect} /></div>
                 
                 <div id="geocoder-container" className="flex-1 h-8 relative pt-0 min-w-0"></div>
                 <div className="hidden md:block"><InfoTooltip /></div>
                 
                 <div className="md:hidden shrink-0 flex items-center gap-2">
                     <CitySelector onSelect={handlePresetSelect} />
                     <LoadBtn />
                 </div>
            </div>

            {/* ROW 3 (Mobile) / RIGHT (Desktop) */}
            <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-3 order-3 md:order-none flex-shrink-0">
                <ToolsGroup />
                
                <div className="hidden md:flex items-center gap-2">
                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <MapCountControls />
                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <LoadBtn />
                    <RunBtn />
                    <ResetBtn />
                    <ThemeToggle />
                </div>

                <div className="md:hidden w-auto"><RunBtn /></div>
            </div>
        </div>
        
        <div className={clsx("text-center mt-1 text-[10px] font-mono relative -z-10", isError ? "text-red-500 font-bold" : "opacity-50")}>{status}</div>
      </div>

      {/* CANVAS AREA */}
      <div className="flex-1 w-full max-w-7xl p-4 flex flex-wrap justify-center content-start gap-6">
        {activeAlgos.map((algo, index) => {
            let widthClass = "w-full max-w-5xl"; 
            if (activeAlgos.length >= 2) widthClass = "w-full md:w-[calc(50%-1.5rem)]";
            let heightClass = activeAlgos.length <= 2 ? "h-[50vh] min-h-[400px]" : "h-[40vh] min-h-[300px]";

            return (
                <div key={index} className={clsx("flex flex-col gap-1", heightClass, widthClass)}>
                    
                    {/* COMPACT TOP BAR */}
                    <div className="flex justify-between items-center px-0.5 overflow-x-auto overflow-y-hidden w-full whitespace-nowrap min-h-[32px]">
                        <div className="flex items-center gap-1 shrink-0">
                            {index === 0 && (
                                <button onClick={() => setShowPerimeter(!showPerimeter)} className="flex items-center gap-1 px-1.5 bg-gray-200 dark:bg-gray-800 rounded hover:bg-blue-100 text-gray-700 dark:text-gray-300 transition-colors h-6" title="Toggle Loaded Area">
                                    <CheckSquare size={12} className={showPerimeter ? "text-blue-500" : "opacity-40"} />
                                    <span className="opacity-50 text-[9px] font-bold uppercase tracking-tight">Show loaded area</span>
                                </button>
                            )}
                            {results[index] && (
                                <button onClick={() => handleReplay(index)} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded hover:bg-blue-100 text-gray-600 dark:text-gray-300 transition-colors" title="Replay">
                                    <RotateCcw size={12} />
                                </button>
                            )}
                            <div className="bg-white dark:bg-gray-800 px-2 rounded border border-gray-300 dark:border-gray-600 shadow-sm flex items-center gap-1.5 h-6">
                                <span className="opacity-50 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Algo {index+1}</span>
                                <select value={algo} onChange={(e) => changeAlgo(index, e.target.value)} className="bg-transparent outline-none text-[10px] font-bold text-gray-800 dark:text-gray-100 cursor-pointer w-20">
                                    {getAvailableAlgorithms(algo).map(opt => <option key={opt.value} value={opt.value} className="text-black">{opt.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* DESKTOP STATS */}
                        <div className={`hidden md:flex transition-opacity duration-500 ${results[index] ? 'opacity-100' : 'opacity-0'} bg-white dark:bg-gray-800 px-2 rounded border border-gray-300 dark:border-gray-600 shadow-sm items-center gap-2 text-[10px] font-mono h-6 ml-1`}>
                             <div className="flex gap-0.5"><span className="opacity-40">Dist:</span>{formatDist(results[index]?.cost, results[index]?.exploredDist)}</div>
                             <div className="w-px h-2.5 bg-gray-300 dark:bg-gray-600"></div>
                             <div className="flex gap-0.5"><span className="opacity-40">Time:</span><span className="font-bold">{results[index]?.time}ms</span></div>
                             <div className="w-px h-2.5 bg-gray-300 dark:bg-gray-600"></div>
                             <div className="flex gap-0.5"><span className="opacity-40">Explored:</span><span className="font-bold text-blue-500">{results[index]?.exploredDist}km</span></div>                        </div>
                    </div>

                    {/* MAP CANVAS */}
                    <div className="flex-1 relative rounded-xl overflow-hidden shadow-xl transition-all duration-500 border border-gray-200 dark:border-gray-700">
                        <MapBoard 
                            ref={el => mapRefs.current[index] = el}
                            isMaster={index === 0}
                            darkMode={darkMode}
                            algoType={algo}
                            activeTool={tool}
                            sharedViewState={viewState}
                            onViewChange={handleViewChange}
                            sharedData={sharedData}
                            onDataUpdate={handleDataUpdate}
                            onStatus={setStatus}
                            onResult={(stats) => handleResult(index, stats)}
                            winStatus={getWinStatus(index)}
                            showPerimeter={index === 0 ? showPerimeter : false}
                        />
                    </div>

                    {/* MOBILE STATS FOOTER */}
                    <div className={`flex md:hidden justify-end transition-all duration-500 ${results[index] ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0'}`}>
                        <div className="bg-white/90 dark:bg-gray-900/90 px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm flex items-center gap-3 text-[10px] font-mono">
                             <div className="flex gap-1"><span className="opacity-50">Dist:</span>{formatDist(results[index]?.cost, results[index]?.exploredDist)}</div>
                             <div className="w-px h-3 bg-gray-400"></div>
                             <div className="flex gap-1"><span className="opacity-50">Time:</span><span className="font-bold">{results[index]?.time}ms</span></div>
                             <div className="w-px h-3 bg-gray-400"></div>
                             <div className="flex gap-1"><span className="opacity-50">Exp:</span><span className="font-bold text-blue-500">{results[index]?.exploredDist}km</span></div>                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}

export default App;