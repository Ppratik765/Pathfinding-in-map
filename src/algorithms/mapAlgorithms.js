import distance from '@turf/distance';
import { point } from '@turf/helpers';

const getHeuristic = (nodeIdA, nodeIdB, graph) => {
  const nodeA = graph[nodeIdA];
  const nodeB = graph[nodeIdB];
  return distance(point([nodeA.lng, nodeA.lat]), point([nodeB.lng, nodeB.lat]));
};

export const runAlgorithm = (algoType, graph, startNodeId, endNodeId) => {
  const startTime = performance.now();
  
  // --- SAFETY CHECK: Prevent 0km Glitch ---
  if (!graph[startNodeId] || !graph[endNodeId]) {
      console.warn("Algorithm aborted: Start or End node not found in graph.");
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
  const timeTaken = (endTime - startTime).toFixed(1);

  // --- ROBUST COST CALCULATION (Fixes Half-Distance Bug) ---
  const totalCost = result.path.reduce((acc, currId, idx) => {
      if (idx === 0) return 0;
      const prevId = result.path[idx - 1];
      const prevNode = graph[prevId];
      const currNode = graph[currId];
      
      if (!prevNode || !currNode) return acc;

      // 1. Try to find the defined edge weight (Traffic/Road Speed)
      const edge = prevNode.neighbors.find(n => n.node === currId);
      
      if (edge) {
          return acc + edge.weight;
      } else {
          // 2. Fallback: If edge is missing (e.g. Reverse traversal on One-Way), use raw distance
          // This ensures we never add "0" for a valid step.
          const rawDist = distance(point([prevNode.lng, prevNode.lat]), point([currNode.lng, currNode.lat]), {units: 'kilometers'});
          return acc + rawDist;
      }
  }, 0);

  // Calculate Explored Distance (Visual Metric)
  let exploredDist = 0;
  result.visitedOrder.forEach(item => {
      if (item.from) {
          const parent = graph[item.from];
          if(parent) {
              const edge = parent.neighbors.find(n => n.node === item.id);
              // Use raw distance if edge weight is Infinity (Block) or missing
              const dist = edge && edge.weight !== Infinity ? edge.weight : 0;
              exploredDist += dist;
          }
      }
  });

  return { 
      ...result, 
      time: timeTaken, 
      cost: totalCost.toFixed(2),
      visitedCount: result.visitedOrder.length,
      exploredDist: exploredDist.toFixed(2)
  };
};

// --- ALGORITHMS ---

const runDijkstra = (graph, start, end) => {
  const distances = {};
  const previous = {};
  const pq = [{ id: start, dist: 0 }];
  const visitedOrder = [];
  const visitedSet = new Set();

  // Optimization: Don't fill distances with Infinity upfront (Save Memory on huge maps)
  distances[start] = 0;

  while (pq.length) {
    pq.sort((a, b) => a.dist - b.dist);
    const { id: curr } = pq.shift();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (visitedSet.has(edge.node) || edge.weight === Infinity) continue;
      
      const currentDist = distances[curr] || 0;
      const newDist = currentDist + edge.weight;
      
      if (newDist < (distances[edge.node] || Infinity)) {
        distances[edge.node] = newDist;
        previous[edge.node] = curr;
        pq.push({ id: edge.node, dist: newDist });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runAStar = (graph, start, end) => {
  const gScore = {}; 
  const fScore = {}; 
  const previous = {};
  const visitedOrder = [];
  const visitedSet = new Set();
  
  gScore[start] = 0;
  fScore[start] = getHeuristic(start, end, graph);

  const openSet = [{ id: start, f: fScore[start] }];

  while (openSet.length) {
    openSet.sort((a, b) => a.f - b.f);
    const { id: curr } = openSet.shift();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      const neighbor = edge.node;
      
      const currentG = gScore[curr] || 0;
      const tentativeG = currentG + edge.weight;
      
      if (tentativeG < (gScore[neighbor] || Infinity)) {
        previous[neighbor] = curr;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = gScore[neighbor] + getHeuristic(neighbor, end, graph);
        openSet.push({ id: neighbor, f: fScore[neighbor] });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
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

const runGreedy = (graph, start, end) => {
  const visitedOrder = [];
  const previous = {};
  const visitedSet = new Set();
  const pq = [{ id: start, cost: getHeuristic(start, end, graph) }];

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: curr } = pq.shift();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      if (!visitedSet.has(edge.node)) {
        previous[edge.node] = curr;
        pq.push({ id: edge.node, cost: getHeuristic(edge.node, end, graph) });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

// --- FIXED BIDIRECTIONAL SEARCH (DIJKSTRA) ---
const runBidirectional = (graph, start, end) => {
  const distStart = {};
  const distEnd = {};
  const prevStart = {};
  const prevEnd = {};
  
  const pqStart = [{ id: start, dist: 0 }];
  const pqEnd = [{ id: end, dist: 0 }];
  
  const visitedStart = new Set();
  const visitedEnd = new Set();
  const visitedOrder = [];

  distStart[start] = 0;
  distEnd[end] = 0;

  let bestMeetNode = null;
  let bestMeetDist = Infinity;

  while (pqStart.length && pqEnd.length) {
    // 1. Forward Step
    if (pqStart.length) {
        pqStart.sort((a,b) => a.dist - b.dist);
        const { id: curr } = pqStart.shift();
        
        if (!visitedStart.has(curr)) {
            visitedStart.add(curr);
            visitedOrder.push({ id: curr, from: prevStart[curr] });

            if (visitedEnd.has(curr)) {
                const total = (distStart[curr] || 0) + (distEnd[curr] || 0);
                if (total < bestMeetDist) { bestMeetDist = total; bestMeetNode = curr; }
            }

            for (const edge of graph[curr].neighbors) {
                if(edge.weight === Infinity) continue;
                const newDist = (distStart[curr] || 0) + edge.weight;
                if (newDist < (distStart[edge.node] || Infinity)) {
                    distStart[edge.node] = newDist;
                    prevStart[edge.node] = curr;
                    pqStart.push({ id: edge.node, dist: newDist });
                }
            }
        }
    }

    // 2. Backward Step
    if (pqEnd.length) {
        pqEnd.sort((a,b) => a.dist - b.dist);
        const { id: curr } = pqEnd.shift();

        if (!visitedEnd.has(curr)) {
            visitedEnd.add(curr);
            visitedOrder.push({ id: curr, from: prevEnd[curr] });

            if (visitedStart.has(curr)) {
                const total = (distStart[curr] || 0) + (distEnd[curr] || 0);
                if (total < bestMeetDist) { bestMeetDist = total; bestMeetNode = curr; }
            }

            for (const edge of graph[curr].neighbors) {
                if(edge.weight === Infinity) continue;
                const newDist = (distEnd[curr] || 0) + edge.weight;
                if (newDist < (distEnd[edge.node] || Infinity)) {
                    distEnd[edge.node] = newDist;
                    prevEnd[edge.node] = curr;
                    pqEnd.push({ id: edge.node, dist: newDist });
                }
            }
        }
    }

    // Heuristic Termination: Stop if we found a path and queues are getting worse
    if (bestMeetNode) {
        const topStart = pqStart.length ? pqStart[0].dist : Infinity;
        const topEnd = pqEnd.length ? pqEnd[0].dist : Infinity;
        if (topStart + topEnd >= bestMeetDist) {
             return { visitedOrder, path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd) };
        }
    }
  }
  
  // Fallback if queues empty but path found
  if (bestMeetNode) return { visitedOrder, path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd) };

  return { visitedOrder, path: [] };
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