import React, { useRef, useState, useEffect } from 'react';
import { MapBoard } from './components/MapBoard';
import { Background } from './components/Background';
import { buildGraphFromGeoJSON } from './utils/graphUtils';
import { Play, RefreshCw, Moon, Sun, Map as MapIcon, BrickWall, MousePointer2, Plus, Minus, TrafficCone, RotateCcw, Info, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState("Zoom in & Click 'Load Roads'");
  const [activeAlgos, setActiveAlgos] = useState(['dijkstra']); 
  const [tool, setTool] = useState('start');
  const [showPerimeter, setShowPerimeter] = useState(true); 

  const [viewState, setViewState] = useState(() => {
      const saved = localStorage.getItem('mapViewState');
      return saved ? JSON.parse(saved) : { center: [-0.0803, 51.5145], zoom: 15, pitch: 60, bearing: 0 };
  });
  const [sharedData, setSharedData] = useState({ geojson: null, graph: null, start: null, end: null, obstacles: {} });
  const [results, setResults] = useState({});
  const [finishedCount, setFinishedCount] = useState(0); 
  const mapRefs = useRef([]);

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

  useEffect(() => { localStorage.setItem('mapViewState', JSON.stringify(viewState)); }, [viewState]);

  const handleViewChange = (center, zoom, pitch, bearing) => { setViewState({ center: [center.lng, center.lat], zoom, pitch, bearing }); };
  const handleDataUpdate = (updates) => {
      setSharedData(prev => {
          const next = { ...prev, ...updates };
          if (updates.geojson || updates.obstacles) {
              next.graph = buildGraphFromGeoJSON(next.geojson || prev.geojson, next.obstacles || prev.obstacles);
          }
          return next;
      });
  };
  const handleLoadRoads = () => { if(mapRefs.current[0]) mapRefs.current[0].loadRoads(); };
  
  const handleRun = () => { 
      setResults({}); 
      setFinishedCount(0); 
      activeAlgos.forEach((_, idx) => { if(mapRefs.current[idx]) mapRefs.current[idx].run(); }); 
  };
  
  const handleReset = () => { 
      setSharedData(prev => ({ ...prev, start: null, end: null, obstacles: {} })); 
      setResults({});
      setFinishedCount(0);
      mapRefs.current.forEach(ref => ref && ref.reset());
      setStatus("Reset."); 
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center font-sans text-gray-800 dark:text-gray-100 relative pb-10">
      <Background darkMode={darkMode} />
      
      {/* HEADER */}
      <div className="w-full max-w-7xl z-50 p-4 relative">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 min-w-fit">
                <h1 className="text-xl font-extrabold flex items-center gap-2">
                    <MapIcon className="text-blue-500" size={24} /> Way<span className="text-blue-600 dark:text-blue-400">Finder</span>
                </h1>
            </div>
            
            {/* SEARCH + INFO (Fixed Alignment) */}
            <div className="flex-1 min-w-[250px] relative z-50 order-3 md:order-2 flex items-center gap-2">
                 {/* Search bar container */}
                 <div id="geocoder-container" className="flex-1 h-10 relative pt-1"></div>
                 
                 {/* INFO BUTTON */}
                 <div className="relative group shrink-0">
                    <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400">
                        <Info size={20} />
                    </button>
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[300px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-[60] text-sm leading-relaxed">
                        <h3 className="font-bold text-base mb-2 border-b pb-1 border-gray-200 dark:border-gray-700">How to Use</h3>
                        <ol className="list-decimal pl-4 space-y-2 text-gray-600 dark:text-gray-300">
                            <li><span className="font-bold text-blue-500">Search</span> or drag to a city location.</li>
                            <li><span className="font-bold text-blue-500">Zoom In</span> till your desired level.</li>
                            <li>Click <span className="font-bold bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded text-indigo-600 dark:text-indigo-400">LOAD</span> to scan the road network.</li>
                            <li>Select <span className="font-bold text-green-600">Start</span> tool and click on a <b>road line</b>.</li>
                            <li>Select <span className="font-bold text-red-600">End</span> tool and click on another road.</li>
                            <li>(Optional) Add <span className="font-bold">Walls</span> or <span className="font-bold text-orange-500">Traffic</span> to block paths.</li>
                            <li>Click <span className="font-bold bg-green-100 dark:bg-green-900/30 px-1 rounded text-green-600 dark:text-green-400">RUN</span> to watch the algorithm race!</li>
                        </ol>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 order-2 md:order-3">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    {[
                        { id: 'start', icon: MousePointer2, label: 'Start', col: 'text-green-600' },
                        { id: 'end', icon: MousePointer2, label: 'End', col: 'text-red-600' },
                        { id: 'wall', icon: BrickWall, label: 'Block', col: 'text-gray-600 dark:text-gray-300' },
                        { id: 'traffic', icon: TrafficCone, label: 'Slow', col: 'text-orange-500' }
                    ].map(t => (
                        <button key={t.id} onClick={() => setTool(t.id)} className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all", tool === t.id ? `bg-white dark:bg-gray-600 shadow-md ${t.col} scale-105` : "opacity-60 hover:opacity-100")}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>
                <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    <button onClick={removeMap} disabled={activeAlgos.length <= 1} className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"><Minus size={16}/></button>
                    <span className="text-sm font-bold w-4 text-center">{activeAlgos.length}</span>
                    <button onClick={addMap} disabled={activeAlgos.length >= 4} className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"><Plus size={16}/></button>
                </div>
                <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
                <div className="flex gap-2">
                    <button onClick={handleLoadRoads} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg hover:-translate-y-0.5 transition-all"><MapIcon size={14} /> LOAD</button>
                    <button onClick={handleRun} className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-lg hover:-translate-y-0.5 transition-all"><Play size={14} /> RUN</button>
                    <button onClick={handleReset} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><RefreshCw size={18}/></button>
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-gray-800 rounded-xl transition-colors">{darkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
                </div>
            </div>
        </div>
        <div className={clsx("text-center mt-1 text-[10px] font-mono", isError ? "text-red-500 font-bold" : "opacity-50")}>{status}</div>
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
                    <div className="flex justify-between items-center px-0.5 overflow-hidden">
                        
                        {/* LEFT GROUP */}
                        <div className="flex items-center gap-1 shrink-0">
                            
                            {/* MINI CHECKBOX (Master) */}
                            {index === 0 && (
                                <button onClick={() => setShowPerimeter(!showPerimeter)} className="flex items-center gap-1 px-1.5 bg-gray-200 dark:bg-gray-800 rounded hover:bg-blue-100 text-gray-700 dark:text-gray-300 transition-colors h-6" title="Toggle Loaded Area">
                                    <CheckSquare size={12} className={showPerimeter ? "text-blue-500" : "opacity-40"} />
                                    <span className="opacity-50 text-[9px] font-bold uppercase tracking-tight">Show loaded area</span>
                                </button>
                            )}

                            {/* MINI REPLAY */}
                            {results[index] && (
                                <button onClick={() => handleReplay(index)} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded hover:bg-blue-100 text-gray-600 dark:text-gray-300 transition-colors" title="Replay">
                                    <RotateCcw size={12} />
                                </button>
                            )}

                            {/* MINI DROPDOWN */}
                            <div className="bg-white dark:bg-gray-800 px-2 rounded border border-gray-300 dark:border-gray-600 shadow-sm flex items-center gap-1.5 h-6">
                                <span className="opacity-50 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Algo {index+1}</span>
                                <select value={algo} onChange={(e) => changeAlgo(index, e.target.value)} className="bg-transparent outline-none text-[10px] font-bold text-gray-800 dark:text-gray-100 cursor-pointer w-20">
                                    {getAvailableAlgorithms(algo).map(opt => <option key={opt.value} value={opt.value} className="text-black">{opt.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* RIGHT GROUP: COMPACT STATS */}
                        <div className={`transition-opacity duration-500 ${results[index] ? 'opacity-70' : 'opacity-0'} bg-white dark:bg-gray-800 px-2 rounded border border-gray-300 dark:border-gray-600 shadow-sm flex items-center gap-2 text-[10px] font-mono h-6 ml-1`}>
                             <div className="flex gap-0.5"><span className="opacity-40">Dist:</span><span className="font-bold text-orange-500">{results[index]?.cost}km</span></div>
                             <div className="w-px h-2.5 bg-gray-300 dark:bg-gray-600"></div>
                             <div className="flex gap-0.5"><span className="opacity-40">Time:</span><span className="font-bold">{results[index]?.time}ms</span></div>
                             <div className="w-px h-2.5 bg-gray-300 dark:bg-gray-600"></div>
                             <div className="flex gap-0.5"><span className="opacity-40">Explored:</span><span className="font-bold text-blue-500">{results[index]?.exploredDist}km</span></div>
                        </div>
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
                </div>
            );
        })}
      </div>
    </div>
  );
}

export default App;