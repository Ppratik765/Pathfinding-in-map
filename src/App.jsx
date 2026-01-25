import React, { useRef, useState, useEffect } from 'react';
import { Grid } from './components/Grid';
import { Background } from './components/Background';
import { Play, RefreshCw, Moon, Sun, BrickWall, Eraser, MousePointer2, Plus, Minus, Info, Box, TentTree, Waves } from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeAlgos, setActiveAlgos] = useState(['dijkstra']);
  const [results, setResults] = useState({});
  const [masterGrid, setMasterGrid] = useState(null);
  const [drawMode, setDrawMode] = useState('wall'); 
  const [is3D, setIs3D] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const gridRefs = useRef({});

  const allAlgorithms = [
      { value: 'dijkstra', label: 'Dijkstra Algorithm' },
      { value: 'astar', label: 'A* Search' },
      { value: 'bfs', label: 'Breadth-First Search (BFS)' },
      { value: 'dfs', label: 'Depth-First Search (DFS)' },
      { value: 'greedy', label: 'Greedy Best-First Search' },
      { value: 'bidirectional', label: 'Bidirectional BFS' },
  ];

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const handleRun = () => {
    setResults({});
    activeAlgos.forEach(algo => { if(gridRefs.current[algo]) gridRefs.current[algo].animate(); });
  };
  const handleReset = () => {
    setResults({});
    activeAlgos.forEach(algo => { if(gridRefs.current[algo]) gridRefs.current[algo].reset(); });
  };
  const handleClearWalls = () => {
     const masterAlgo = activeAlgos[0];
     if (gridRefs.current[masterAlgo]) gridRefs.current[masterAlgo].clearWalls();
  };
  const handleGenerateMaze = () => {
      handleClearWalls();
      setTimeout(() => {
          const masterAlgo = activeAlgos[0];
          if (gridRefs.current[masterAlgo]) gridRefs.current[masterAlgo].generateMaze();
      }, 100);
  };
  const addAlgorithm = () => {
      if (activeAlgos.length >= 4) return;
      const unused = allAlgorithms.find(a => !activeAlgos.includes(a.value));
      if (unused) setActiveAlgos([...activeAlgos, unused.value]);
  };
  const removeAlgorithm = () => {
      if (activeAlgos.length > 1) {
          const newAlgos = [...activeAlgos]; newAlgos.pop(); setActiveAlgos(newAlgos); setResults({});
      }
  };
  const handleAlgoChange = (index, newValue) => {
      const newAlgos = [...activeAlgos]; newAlgos[index] = newValue; setActiveAlgos(newAlgos); setResults({});
  };
  const handleFinish = (algo, time) => { setResults(prev => ({ ...prev, [algo]: time })); };

  const getWinStatus = (algo) => {
      if (activeAlgos.length === 1) return 'unknown';
      const times = Object.values(results);
      if (times.length === 0) return 'unknown';
      const myTime = results[algo];
      if (!myTime) return 'unknown';
      const minTime = Math.min(...times);
      if (times.length === activeAlgos.length) return myTime === minTime ? 'winner' : 'loser';
      return 'unknown';
  };

  return (
    <div className="min-h-screen h-full flex flex-col items-center justify-start p-4 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-300 overflow-x-hidden relative">
      
      <Background darkMode={darkMode} />

      {/* Instructions Modal */}
      {showInstructions && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-dark-panel p-6 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Info className="text-blue-500" /> How to use
                  </h2>
                  <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                      <p><strong>🖱️ Draw:</strong> Select a terrain type and drag on the grid.</p>
                      <p><strong>🌲 Terrain Costs:</strong> 
                        <br/> - Forest: Cost 3 (Medium)
                        <br/> - Mud: Cost 5 (Heavy)
                        <br/> - Water: Cost 10 (Very Heavy)
                      </p>
                      <p><strong>🎲 Compare:</strong> Add up to 4 algorithms to race them.</p>
                      <p><strong>🧊 3D:</strong> Toggle 3D view for a cool perspective.</p>
                  </div>
                  <button onClick={() => setShowInstructions(false)} className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Close</button>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-4 px-2 z-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Pathfinding <span className="text-blue-600 dark:text-blue-400">Viz</span></h1>
        <div className="flex gap-2">
            <button onClick={() => setShowInstructions(true)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:scale-110 transition-transform shadow-sm"><Info size={20}/></button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:scale-110 transition-transform shadow-sm">{darkMode ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-gray-600"/>}</button>
        </div>
      </div>

      {/* Control Bar - MENU BAR FIX: Added max-w-full and overflow-x-auto */}
      <div className="bg-white dark:bg-dark-panel p-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-nowrap gap-2 items-center justify-start sm:justify-center mb-4 w-fit max-w-full overflow-x-auto z-10 sticky top-2 transition-all duration-300 no-scrollbar">
        
        {/* Left Side: Drawing Tools */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 shrink-0">
            <button onClick={() => setDrawMode('wall')} className={clsx("flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-all", drawMode === 'wall' ? "bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700")}>
                <BrickWall size={14} />
            </button>
            <button onClick={() => setDrawMode('forest')} className={clsx("flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-all", drawMode === 'forest' ? "bg-white dark:bg-gray-600 shadow text-green-700 dark:text-green-400" : "text-gray-500 hover:text-gray-700")}>
                <TentTree size={14} />
            </button>
            <button onClick={() => setDrawMode('mud')} className={clsx("flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-all", drawMode === 'mud' ? "bg-white dark:bg-gray-600 shadow text-amber-800 dark:text-amber-500" : "text-gray-500 hover:text-gray-700")}>
                <Eraser size={14} />
            </button>
            <button onClick={() => setDrawMode('water')} className={clsx("flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-all", drawMode === 'water' ? "bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700")}>
                <Waves size={14} />
            </button>
        </div>

        {/* Center: Algorithms */}
        <div className="flex gap-1 items-center bg-gray-50 dark:bg-gray-800/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
            {activeAlgos.map((currentAlgo, idx) => (
                <select key={idx} value={currentAlgo} onChange={(e) => handleAlgoChange(idx, e.target.value)}
                    className="px-1 py-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none w-auto max-w-[100px]"
                >
                    {allAlgorithms.map(opt => ((opt.value === currentAlgo || !activeAlgos.includes(opt.value)) && <option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
            ))}
            <div className="flex flex-col gap-0.5 ml-1">
                <button onClick={addAlgorithm} disabled={activeAlgos.length >= 4} className="p-0.5 bg-gray-200 hover:bg-green-100 text-gray-600 hover:text-green-600 rounded disabled:opacity-30"><Plus size={10} /></button>
                <button onClick={removeAlgorithm} disabled={activeAlgos.length <= 1} className="p-0.5 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded disabled:opacity-30"><Minus size={10} /></button>
            </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex gap-2 items-center shrink-0">
             <button onClick={handleRun} className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md active:scale-95 text-xs uppercase"><Play size={14} /> Run</button>
             <button onClick={handleReset} className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg font-bold text-xs"><RefreshCw size={14} /> Reset</button>
             <button onClick={() => setIs3D(!is3D)} className={clsx("flex items-center gap-1 px-3 py-2 rounded-lg font-bold text-xs border", is3D ? "bg-purple-100 border-purple-300 text-purple-700" : "bg-gray-100 border-transparent text-gray-500")}><Box size={14} /> 3D</button>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full max-w-7xl mb-4 flex justify-center gap-4 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 flex-wrap z-10">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 border border-green-600 rounded-sm"></div>Start</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 border border-red-600 rounded-full"></div>End</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-800 dark:bg-white border-gray-900 dark:border-white rounded-sm"></div>Wall</div>
            <div className="flex items-center gap-1"><TentTree size={12} className="text-green-600"/>Forest(3)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-mud dark:bg-amber-900 rounded-sm"></div>Mud(5)</div>
            <div className="flex items-center gap-1"><Waves size={12} className="text-blue-500"/>Water(10)</div>
      </div>

      {/* Grids */}
      <div className="flex flex-col gap-6 w-full items-center pb-24 z-10">
        {activeAlgos.map((algo, index) => (
            <div key={algo} className={clsx("relative transition-all duration-500", index > 0 && "opacity-90 hover:opacity-100")}>
                <Grid 
                    ref={el => gridRefs.current[algo] = el}
                    algoType={algo}
                    isComparison={index > 0}
                    masterGridState={index > 0 ? masterGrid : null}
                    onGridUpdate={index === 0 ? setMasterGrid : undefined}
                    onFinish={handleFinish}
                    winStatus={getWinStatus(algo)}
                    drawMode={drawMode}
                    is3D={is3D}
                />
                {index > 0 && <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none backdrop-blur-sm">Linked to Master</div>}
            </div>
        ))}
      </div>

      {/* Floating Bottom */}
      <div className="fixed bottom-6 flex gap-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur p-2 px-4 rounded-full shadow-2xl border border-gray-200 dark:border-gray-600 z-50">
        <button onClick={handleGenerateMaze} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-xs shadow-lg hover:-translate-y-1"><BrickWall size={14} /> Random Maze</button>
        <button onClick={handleClearWalls} className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full font-bold text-xs shadow"><Eraser size={14} /> Clear Board</button>
      </div>

    </div>
  );
}

export default App;