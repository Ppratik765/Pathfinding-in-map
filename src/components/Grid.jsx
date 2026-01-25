import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { clsx } from 'clsx';
import { RotateCcw, Trees, Waves } from 'lucide-react';
import { runAlgorithm, generateMazeRecursiveDivision } from '../algorithms';

// --- CONFIGURATION ---
const COST_FOREST = 3;
const COST_MUD = 5;
const COST_WATER = 10;

// Dynamic Grid Configuration based on Screen Size
const getGridConfig = () => {
  if (typeof window === 'undefined') return { rows: 20, cols: 45, start: {r:8,c:5}, finish: {r:8,c:35}, nodeClass: 'w-5 h-5', textSize: 'text-[8px]' };
  
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return {
      rows: 24,      // Taller
      cols: 24,      
      start: { r: 2, c: 2 },
      finish: { r: 22, c: 21 },
      nodeClass: 'w-4 h-4', // Smaller nodes (16px)
      textSize: 'text-[6px]'
    };
  }
  
  // Desktop Defaults
  return {
    rows: 20,
    cols: 45,
    start: { r: 8, c: 5 },
    finish: { r: 8, c: 35 },
    nodeClass: 'w-5 h-5', // Standard nodes (20px)
    textSize: 'text-[8px]'
  };
};

const createNode = (col, row, config) => {
  return {
    col,
    row,
    isStart: row === config.start.r && col === config.start.c,
    isFinish: row === config.finish.r && col === config.finish.c,
    distance: Infinity,
    g: Infinity, 
    f: Infinity,
    isVisited: false,
    isWall: false,
    weight: 1, 
    terrainType: 'none', 
    previousNode: null,
    nextNode: null,
  };
};

const getInitialGrid = () => {
  const config = getGridConfig();
  const grid = [];
  for (let row = 0; row < config.rows; row++) {
    const currentRow = [];
    for (let col = 0; col < config.cols; col++) {
      currentRow.push(createNode(col, row, config));
    }
    grid.push(currentRow);
  }
  return grid;
};

export const Grid = forwardRef(({ algoType, onFinish, isComparison = false, masterGridState = null, onGridUpdate, winStatus, drawMode, is3D }, ref) => {
  const [grid, setGrid] = useState(getInitialGrid());
  const [mouseIsPressed, setMouseIsPressed] = useState(false);
  const [dragNode, setDragNode] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [pathCost, setPathCost] = useState(0);
  const [showReplay, setShowReplay] = useState(false);
  
  const [config] = useState(getGridConfig());

  useEffect(() => {
    if (masterGridState && isComparison) {
        const newGrid = masterGridState.map(row => 
            row.map(node => ({
                ...node, 
                distance: Infinity, g: Infinity, f: Infinity,
                isVisited: false, previousNode: null, nextNode: null
            }))
        );
        setGrid(newGrid);
    }
  }, [masterGridState, isComparison]);

  const findStartFinish = (currentGrid) => {
      let start, finish;
      for (let r of currentGrid) {
          for (let n of r) {
              if (n.isStart) start = n;
              if (n.isFinish) finish = n;
          }
      }
      return { start, finish };
  };

  // --- OPTIMIZED ANIMATION LOOP (Fixes Mobile Stutter) ---
  const animateSequence = (nodes, className, onComplete) => {
    let i = 0;
    // Process multiple nodes per frame for speed without blocking UI
    // Mobile CPUs handle 3-5 DOM updates per frame better than 100s of timeouts
    const nodesPerFrame = 4; 

    const step = () => {
      for (let j = 0; j < nodesPerFrame; j++) {
        if (i >= nodes.length) {
          if (onComplete) onComplete();
          return;
        }
        const node = nodes[i];
        const el = document.getElementById(`node-${algoType}-${node.row}-${node.col}`);
        if(el && !node.isStart && !node.isFinish) el.classList.add(className);
        i++;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const runAnimation = () => {
      setShowReplay(false);
      const container = document.getElementById(`grid-container-${algoType}`);
      if(container) {
          container.querySelectorAll('.node-visited, .node-path').forEach(el => 
            el.classList.remove('node-visited', 'node-path')
          );
      }

      // Soft reset
      for (let row of grid) {
          for (let node of row) {
              node.distance = Infinity;
              node.g = Infinity;
              node.f = Infinity;
              node.isVisited = false;
              node.previousNode = null;
              node.nextNode = null;
          }
      }

      const { start, finish } = findStartFinish(grid);
      if (!start || !finish) return;

      const startTime = performance.now();
      const { visitedNodesInOrder, path } = runAlgorithm(grid, start, finish, algoType);
      const endTime = performance.now();
      
      const timeTaken = (endTime - startTime).toFixed(2);
      const totalCost = path.reduce((sum, node) => sum + node.weight, 0);
      setPathCost(totalCost);

      // Run Visited Animation -> Then Path Animation
      animateSequence(visitedNodesInOrder, 'node-visited', () => {
          animateSequence(path, 'node-path', () => {
             setExecutionTime(timeTaken);
             setShowReplay(true);
             if(onFinish) onFinish(algoType, parseFloat(timeTaken));
          });
      });
  };

  useImperativeHandle(ref, () => ({
    animate() { runAnimation(); },
    reset: () => {
        setExecutionTime(0);
        setPathCost(0);
        setShowReplay(false);
        const container = document.getElementById(`grid-container-${algoType}`);
        if(container) container.querySelectorAll('.node-visited, .node-path').forEach(el => el.classList.remove('node-visited', 'node-path'));
        if(!isComparison) setGrid(getInitialGrid()); 
    },
    clearWalls: () => {
        const { start, finish } = findStartFinish(grid);
        const freshGrid = getInitialGrid();
        const newGrid = freshGrid.map(row => row.map(node => {
            const isS = node.row === start.row && node.col === start.col;
            const isF = node.row === finish.row && node.col === finish.col;
            return { ...node, isStart: isS, isFinish: isF };
        }));

        setGrid(newGrid);
        setExecutionTime(0);
        setPathCost(0);
        setShowReplay(false);
        const container = document.getElementById(`grid-container-${algoType}`);
        if(container) container.querySelectorAll('.node-visited, .node-path').forEach(el => el.classList.remove('node-visited', 'node-path'));
        if(onGridUpdate) onGridUpdate(newGrid);
    },
    generateMaze() {
        if(isComparison) return;
        setExecutionTime(0);
        setPathCost(0);
        setShowReplay(false);
        const container = document.getElementById(`grid-container-${algoType}`);
        if(container) container.querySelectorAll('.node-visited, .node-path').forEach(el => el.classList.remove('node-visited', 'node-path'));

        const { start, finish } = findStartFinish(grid);
        const wallNodes = generateMazeRecursiveDivision(grid, start, finish);
        
        // Use Sequence for walls too (prevents freezing)
        let i = 0;
        const animateWalls = () => {
            for(let j=0; j<3; j++) { // 3 walls per frame
                if(i >= wallNodes.length) return;
                const node = wallNodes[i];
                const newGrid = grid.slice(); // Note: Ideally direct DOM manipulation is faster for walls, but state sync needed for algos
                // For maze gen, we need state update to block algos. 
                // We'll update state in chunks or just force render.
                // For smoother maze: update state at end? No, users like seeing it build.
                // We'll stick to setTimeout for maze gen as it's less critical for comparison accuracy, 
                // OR use the optimized approach:
                grid[node.row][node.col].isWall = true;
                // Force update every few walls to avoid react batching lag
                if (i % 5 === 0) setGrid([...grid]); 
                i++;
            }
            requestAnimationFrame(animateWalls);
        };
        animateWalls();
        // Final sync
        setTimeout(() => {
            setGrid([...grid]);
            if(onGridUpdate) onGridUpdate(grid);
        }, wallNodes.length * 2);
    },
  }));

  const handleInteractionStart = (row, col) => {
    if(isComparison) return;
    const node = grid[row][col];
    if (node.isStart) { setDragNode('start'); setMouseIsPressed(true); return; }
    if (node.isFinish) { setDragNode('finish'); setMouseIsPressed(true); return; }

    const newGrid = toggleNode(grid, row, col, drawMode);
    setGrid(newGrid);
    setMouseIsPressed(true);
    if(onGridUpdate) onGridUpdate(newGrid);
  };

  const handleInteractionMove = (row, col) => {
    if (!mouseIsPressed || isComparison) return;
    if (dragNode) {
        const node = grid[row][col];
        if (node.isStart || node.isFinish) return;
        const newGrid = moveSpecialNode(grid, row, col, dragNode);
        setGrid(newGrid);
        if(onGridUpdate) onGridUpdate(newGrid);
        return;
    }
    const newGrid = toggleNode(grid, row, col, drawMode);
    setGrid(newGrid);
    if(onGridUpdate) onGridUpdate(newGrid);
  };

  const handleMouseDown = (row, col) => handleInteractionStart(row, col);
  const handleMouseEnter = (row, col) => handleInteractionMove(row, col);
  const handleMouseUp = () => { setMouseIsPressed(false); setDragNode(null); };

  const handleTouchStart = (e, row, col) => {
      // Allow default behavior (scrolling) unless drawing logic requires intervention
      handleInteractionStart(row, col);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.id.startsWith(`node-${algoType}-`)) {
        const parts = element.id.split('-');
        const c = parseInt(parts.pop());
        const r = parseInt(parts.pop());
        if (!isNaN(r) && !isNaN(c)) handleInteractionMove(r, c);
    }
  };

  const borderClass = winStatus === 'winner' ? 'ring-4 ring-green-500 shadow-green-500/50' 
                   : winStatus === 'loser' ? 'ring-4 ring-red-500 shadow-red-500/50'
                   : 'border border-gray-200 dark:border-gray-700';

  return (
    <div className="flex flex-col items-center relative group" style={{ perspective: '1200px' }}>
       <div className="mb-0.5 flex justify-between w-full px-1 text-[10px] sm:text-xs font-mono font-bold text-gray-600 dark:text-gray-300 leading-tight">
         <span className="uppercase">{algoType}</span>
         <span className={clsx("transition-opacity duration-300", executionTime > 0 ? "opacity-100" : "opacity-0", 
             winStatus === 'winner' ? 'text-green-600 dark:text-green-400 font-extrabold' : 'text-gray-600 dark:text-gray-400'
         )}>
            {executionTime}ms • Cost: {pathCost}
         </span>
      </div>

      <div 
        id={`grid-container-${algoType}`}
        // TOUCH FIX: Added 'touch-action-pan-y' which allows vertical scrolling but captures other gestures
        // Removed 'touch-none'
        className={clsx(
            "bg-white dark:bg-dark-panel p-1 rounded shadow-xl leading-[0] relative transition-all duration-500 overflow-x-auto touch-pan-y", 
            borderClass,
            is3D && "transform rotate-x-12 scale-95 shadow-2xl pb-8"
        )}
        style={is3D ? { transform: 'rotateX(25deg) scale(0.9)', transformStyle: 'preserve-3d' } : {}}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {showReplay && (
            <button onClick={runAnimation} className="absolute inset-0 z-[100] flex items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-[1px] transition-all opacity-0 hover:opacity-100 group-hover:opacity-100">
                <div className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-2xl transform hover:scale-110 transition-transform">
                    <RotateCcw size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
            </button>
        )}

        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center">
            {row.map((node, nodeIdx) => {
              const { row, col, isFinish, isStart, isWall, weight, terrainType } = node;
              
              let extraClass = '';
              let innerContent = null;

              if (isStart) extraClass = 'node-start cursor-grab active:cursor-grabbing z-50 scale-110';
              else if (isFinish) extraClass = 'node-end cursor-grab active:cursor-grabbing z-50 scale-110';
              else if (isWall) {
                  extraClass = 'node-wall bg-gray-800 dark:bg-white border-gray-900 dark:border-white z-10';
                  if(is3D) extraClass += ' shadow-[2px_2px_0px_rgba(0,0,0,0.3)] transform translate-z-4'; 
              }
              else if (terrainType === 'mud') extraClass = 'bg-mud dark:bg-amber-900 border-amber-800 opacity-90';
              else if (terrainType === 'forest') {
                  extraClass = 'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800';
                  innerContent = <Trees size={12} className="text-forest dark:text-green-400 opacity-80" />;
              }
              else if (terrainType === 'water') {
                  extraClass = 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800';
                  innerContent = <Waves size={12} className="text-water dark:text-blue-400 opacity-80" />;
              }

              return (
                    <div
                        key={nodeIdx}
                        id={`node-${algoType}-${row}-${col}`}
                        className={clsx(
                            config.nodeClass,
                            "border-[0.5px] border-gray-300 dark:border-blue-50/10 inline-flex items-center justify-center select-none relative transition-transform", 
                            extraClass
                        )}
                        onMouseDown={() => handleMouseDown(row, col)}
                        onMouseEnter={() => handleMouseEnter(row, col)}
                        onMouseUp={handleMouseUp}
                        onTouchStart={(e) => handleTouchStart(e, row, col)}
                    >
                       {!isStart && !isFinish && !isWall && innerContent}
                       {terrainType === 'mud' && !isStart && !isFinish && (
                            <div className={clsx("w-full h-full flex items-center justify-center opacity-30 text-white", config.textSize)}>⨉</div>
                       )}
                    </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

const toggleNode = (grid, row, col, mode) => {
  const newGrid = grid.slice();
  const node = newGrid[row][col];
  if(node.isStart || node.isFinish) return newGrid;
  
  const newNode = { ...node };
  if (mode === 'wall') {
      newNode.isWall = !newNode.isWall;
      newNode.terrainType = 'none';
      newNode.weight = 1;
  } else {
      newNode.isWall = false;
      if (newNode.terrainType === mode) {
          newNode.terrainType = 'none';
          newNode.weight = 1;
      } else {
          newNode.terrainType = mode;
          if(mode === 'mud') newNode.weight = COST_MUD;
          if(mode === 'forest') newNode.weight = COST_FOREST;
          if(mode === 'water') newNode.weight = COST_WATER;
      }
  }
  newGrid[row][col] = newNode;
  return newGrid;
};

const moveSpecialNode = (grid, row, col, type) => {
    const newGrid = grid.slice();
    const node = newGrid[row][col];
    if (node.isWall) return newGrid; 
    if (type === 'start' && node.isFinish) return newGrid;
    if (type === 'finish' && node.isStart) return newGrid;
    const currentGrid = newGrid.map(r => r.map(n => {
        if (type === 'start' && n.isStart) return { ...n, isStart: false };
        if (type === 'finish' && n.isFinish) return { ...n, isFinish: false };
        return n;
    }));
    currentGrid[row][col] = { ...currentGrid[row][col], isStart: type === 'start', isFinish: type === 'finish' };
    return currentGrid;
};