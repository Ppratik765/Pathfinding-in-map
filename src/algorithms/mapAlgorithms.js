import distance from '@turf/distance';
import { point } from '@turf/helpers';

// --- OPTIMIZED MIN HEAP ---
class MinHeap {
  constructor(scoreFn) {
    this.heap = [];
    this.scoreFn = scoreFn;
  }

  push(val) {
    this.heap.push(val);
    this.bubbleUp();
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown();
    }
    return top;
  }

  bubbleUp() {
    let idx = this.heap.length - 1;
    while (idx > 0) {
      let parentIdx = (idx - 1) >>> 1; 
      if (this.scoreFn(this.heap[idx]) < this.scoreFn(this.heap[parentIdx])) {
        [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
        idx = parentIdx;
      } else break;
    }
  }

  sinkDown() {
    let idx = 0;
    const length = this.heap.length;
    while (true) {
      let leftIdx = (idx << 1) + 1;
      let rightIdx = leftIdx + 1;
      let swap = null;

      if (leftIdx < length) {
        if (this.scoreFn(this.heap[leftIdx]) < this.scoreFn(this.heap[idx])) swap = leftIdx;
      }
      if (rightIdx < length) {
        if (
          (swap === null && this.scoreFn(this.heap[rightIdx]) < this.scoreFn(this.heap[idx])) ||
          (swap !== null && this.scoreFn(this.heap[rightIdx]) < this.scoreFn(this.heap[leftIdx]))
        ) {
          swap = rightIdx;
        }
      }
      if (swap === null) break;
      [this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]];
      idx = swap;
    }
  }
  
  get length() { return this.heap.length; }
}

// --- FAST HEURISTIC (Zero Allocation) ---
const getHeuristicFast = (nodeIdA, nodeIdB, graph) => {
  const nA = graph[nodeIdA];
  const nB = graph[nodeIdB];
  return Math.abs(nA.lng - nB.lng) + Math.abs(nA.lat - nB.lat);
};

export const runAlgorithm = (algoType, graph, startNodeId, endNodeId) => {
  const startTime = performance.now();
  
  if (!graph[startNodeId] || !graph[endNodeId]) {
      return { visitedOrder: [], path: [], time: 0, cost: 0, visitedCount: 0, exploredDist: 0 };
  }

  let result = { visitedOrder: [], path: [] };

  switch (algoType) {
    case 'dijkstra': result = runDijkstra(graph, startNodeId, endNodeId); break;
    case 'astar': result = runAStar(graph, startNodeId, endNodeId); break;
    case 'bfs': result = runBFS(graph, startNodeId, endNodeId); break;
    case 'dfs': result = runDFS(graph, startNodeId, endNodeId); break;
    case 'greedy': result = runGreedy(graph, startNodeId, endNodeId); break;
    case 'bidirectional': result = runBidirectional(graph, startNodeId, endNodeId); break;
    default: result = runDijkstra(graph, startNodeId, endNodeId); break;
  }

  const endTime = performance.now();
  
  // FIX: If the algorithm provided a specific totalCost, use it.
  // Otherwise, calculate it manually (for BFS/DFS/Greedy which don't track weights perfectly during search).
  let finalCost = result.totalCost;

  if (finalCost === undefined) {
      finalCost = result.path.reduce((acc, currId, idx) => {
          if (idx === 0) return 0;
          const prevId = result.path[idx - 1];
          const prevNode = graph[prevId];
          const currNode = graph[currId];
          if (!prevNode || !currNode) return acc;
          
          const edge = prevNode.neighbors.find(n => n.node === currId);
          if (edge) return acc + edge.weight;
          
          // Fallback only if edge data is missing
          return acc + distance(point([prevNode.lng, prevNode.lat]), point([currNode.lng, currNode.lat]), {units: 'kilometers'});
      }, 0);
  }

  // Calculate Explored Distance
  let exploredDist = 0;
  result.visitedOrder.forEach(item => {
      if (item.from) {
          const parent = graph[item.from];
          if(parent) {
              const edge = parent.neighbors.find(n => n.node === item.id);
              if (edge && edge.weight !== Infinity) exploredDist += edge.weight;
          }
      }
  });

  return { 
      ...result, 
      time: (endTime - startTime).toFixed(1), 
      cost: parseFloat(finalCost).toFixed(2),
      visitedCount: result.visitedOrder.length,
      exploredDist: exploredDist.toFixed(2)
  };
};

// --- ALGORITHMS ---

const runDijkstra = (graph, start, end) => {
  const distances = { [start]: 0 };
  const previous = {};
  const pq = new MinHeap(n => n.dist); 
  pq.push({ id: start, dist: 0 });
  
  const visitedOrder = [];
  const visitedSet = new Set();

  while (pq.length) {
    const { id: curr, dist: currDist } = pq.pop();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) {
        // Return exact cost found by Dijkstra
        return { visitedOrder, path: reconstructPath(previous, end), previous, totalCost: currDist };
    }
    
    if (currDist > (distances[curr] ?? Infinity)) continue;

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      const newDist = currDist + edge.weight;
      if (newDist < (distances[edge.node] ?? Infinity)) {
        distances[edge.node] = newDist;
        previous[edge.node] = curr;
        pq.push({ id: edge.node, dist: newDist });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runAStar = (graph, start, end) => {
  const gScore = { [start]: 0 };
  const previous = {};
  const visitedOrder = [];
  const visitedSet = new Set();
  const openSet = new MinHeap(n => n.f); 
  
  openSet.push({ id: start, f: 0 });

  while (openSet.length) {
    const { id: curr } = openSet.pop();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) {
         return { visitedOrder, path: reconstructPath(previous, end), previous, totalCost: gScore[end] };
    }

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      const neighbor = edge.node;
      const tentativeG = (gScore[curr] ?? Infinity) + edge.weight;
      
      if (tentativeG < (gScore[neighbor] ?? Infinity)) {
        previous[neighbor] = curr;
        gScore[neighbor] = tentativeG;
        const fVal = tentativeG + getHeuristicFast(neighbor, end, graph);
        openSet.push({ id: neighbor, f: fVal });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runGreedy = (graph, start, end) => {
  const visitedOrder = [];
  const previous = {};
  const visitedSet = new Set();
  const pq = new MinHeap(n => n.cost);
  
  pq.push({ id: start, cost: 0 });

  while (pq.length) {
    const { id: curr } = pq.pop();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      if (!visitedSet.has(edge.node)) {
        previous[edge.node] = curr;
        const h = getHeuristicFast(edge.node, end, graph);
        pq.push({ id: edge.node, cost: h });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runBidirectional = (graph, start, end) => {
  const distStart = { [start]: 0 };
  const distEnd = { [end]: 0 };
  const prevStart = {};
  const prevEnd = {};
  
  const pqStart = new MinHeap(n => n.dist);
  const pqEnd = new MinHeap(n => n.dist);
  
  pqStart.push({ id: start, dist: 0 });
  pqEnd.push({ id: end, dist: 0 });
  
  const visitedStart = new Set();
  const visitedEnd = new Set();
  const visitedOrder = [];

  let bestMeetNode = null;
  let bestMeetDist = Infinity;

  while (pqStart.length && pqEnd.length) {
    // 1. Forward
    if (pqStart.length) {
        const { id: curr, dist: d } = pqStart.pop();
        if (!visitedStart.has(curr)) {
            visitedStart.add(curr);
            visitedOrder.push({ id: curr, from: prevStart[curr] });
            
            if (visitedEnd.has(curr)) {
                const total = d + (distEnd[curr] ?? 0);
                if (total < bestMeetDist) { bestMeetDist = total; bestMeetNode = curr; }
            }

            // Pruning: if current path is already longer than best known path, don't expand neighbors
            if (d < bestMeetDist) {
                for (const edge of graph[curr].neighbors) {
                    if(edge.weight === Infinity) continue;
                    const newDist = d + edge.weight;
                    if (newDist < (distStart[edge.node] ?? Infinity)) {
                        distStart[edge.node] = newDist;
                        prevStart[edge.node] = curr;
                        pqStart.push({ id: edge.node, dist: newDist });
                    }
                }
            }
        }
    }

    // 2. Backward
    if (pqEnd.length) {
        const { id: curr, dist: d } = pqEnd.pop();
        if (!visitedEnd.has(curr)) {
            visitedEnd.add(curr);
            visitedOrder.push({ id: curr, from: prevEnd[curr] });
            
            if (visitedStart.has(curr)) {
                const total = (distStart[curr] ?? 0) + d;
                if (total < bestMeetDist) { bestMeetDist = total; bestMeetNode = curr; }
            }

            if (d < bestMeetDist) {
                for (const edge of graph[curr].neighbors) {
                    if(edge.weight === Infinity) continue;
                    const newDist = d + edge.weight;
                    if (newDist < (distEnd[edge.node] ?? Infinity)) {
                        distEnd[edge.node] = newDist;
                        prevEnd[edge.node] = curr;
                        pqEnd.push({ id: edge.node, dist: newDist });
                    }
                }
            }
        }
    }

    // Termination Check
    if (bestMeetNode) {
         const topStart = pqStart.length ? pqStart.heap[0].dist : Infinity;
         const topEnd = pqEnd.length ? pqEnd.heap[0].dist : Infinity;
         if (topStart + topEnd >= bestMeetDist) {
             return { 
                 visitedOrder, 
                 path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd),
                 totalCost: bestMeetDist // FIX: Return exact calculated cost
             };
         }
    }
  }
  
  if (bestMeetNode) {
      return { 
          visitedOrder, 
          path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd),
          totalCost: bestMeetDist 
      };
  }
  return { visitedOrder, path: [] };
};

const runBFS = (graph, start, end) => {
  const queue = [start];
  const visitedOrder = [];
  const visitedSet = new Set([start]);
  const previous = {};
  while (queue.length) {
    const curr = queue.shift();
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;
    for (const edge of graph[curr].neighbors) {
      if (!visitedSet.has(edge.node) && edge.weight !== Infinity) {
        visitedSet.add(edge.node);
        previous[edge.node] = curr;
        queue.push(edge.node);
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runDFS = (graph, start, end) => {
  const stack = [start];
  const visitedOrder = [];
  const visitedSet = new Set();
  const previous = {};
  while (stack.length) {
    const curr = stack.pop();
    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;
    const neighbors = [...graph[curr].neighbors].reverse(); 
    for (const edge of neighbors) {
      if (!visitedSet.has(edge.node) && edge.weight !== Infinity) {
        previous[edge.node] = curr;
        stack.push(edge.node);
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const reconstructPath = (previous, end) => {
  const path = [];
  let curr = end;
  while (curr) { path.unshift(curr); curr = previous[curr]; }
  return path.length > 1 ? path : [];
};

const mergeBidirectionalPath = (meetNode, prevStart, prevEnd) => {
    const path1 = [];
    let curr = meetNode;
    while(curr) { path1.unshift(curr); curr = prevStart[curr]; }
    const path2 = [];
    curr = prevEnd[meetNode]; 
    while(curr) { path2.push(curr); curr = prevEnd[curr]; }
    return [...path1, ...path2];
};