import distance from '@turf/distance';
import { point } from '@turf/helpers';

const getHeuristic = (nodeIdA, nodeIdB, graph) => {
  const nodeA = graph[nodeIdA];
  const nodeB = graph[nodeIdB];
  return distance(point([nodeA.lng, nodeA.lat]), point([nodeB.lng, nodeB.lat]));
};

export const runAlgorithm = (algoType, graph, startNodeId, endNodeId) => {
  const startTime = performance.now();
  
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

  // --- FIX: INFINITY KM BUG ---
  // Safely calculate total cost. If an edge is broken or Infinite, don't add it to sum.
  const totalCost = result.path.reduce((acc, currId, idx) => {
      if (idx === 0) return 0;
      const prevId = result.path[idx - 1];
      const edge = graph[prevId].neighbors.find(n => n.node === currId);
      
      // If edge missing or blocked, ignore (or treat as 0 gap)
      if (!edge || edge.weight === Infinity) return acc; 
      
      return acc + edge.weight;
  }, 0);

  // Calculate Explored Distance
  let exploredDist = 0;
  result.visitedOrder.forEach(item => {
      if (item.from) {
          const parent = graph[item.from];
          const edge = parent.neighbors.find(n => n.node === item.id);
          if (edge && edge.weight !== Infinity) exploredDist += edge.weight;
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

// --- Standard Algorithms (Unchanged logic, just ensuring they are here) ---

const runDijkstra = (graph, start, end) => {
  const distances = {};
  const previous = {};
  const pq = [{ id: start, dist: 0 }];
  const visitedOrder = [];
  const visitedSet = new Set();

  Object.keys(graph).forEach(k => distances[k] = Infinity);
  distances[start] = 0;

  while (pq.length) {
    pq.sort((a, b) => a.dist - b.dist);
    const { id: curr } = pq.shift();

    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });

    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (visitedSet.has(edge.node) || edge.weight === Infinity) continue; // Check Block
      const newDist = distances[curr] + edge.weight;
      if (newDist < distances[edge.node]) {
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
  
  Object.keys(graph).forEach(k => { gScore[k] = Infinity; fScore[k] = Infinity; });
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
      if (edge.weight === Infinity) continue; // Check Block
      const neighbor = edge.node;
      const tentativeG = gScore[curr] + edge.weight;
      
      if (tentativeG < gScore[neighbor]) {
        previous[neighbor] = curr;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = gScore[neighbor] + getHeuristic(neighbor, end, graph);
        if (!openSet.find(n => n.id === neighbor)) openSet.push({ id: neighbor, f: fScore[neighbor] });
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
    const neighbors = [...graph[curr].neighbors]; 
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
      if (edge.weight === Infinity) continue; // FIX: Respect walls
      if (!visitedSet.has(edge.node)) {
        previous[edge.node] = curr;
        pq.push({ id: edge.node, cost: getHeuristic(edge.node, end, graph) });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runBidirectional = (graph, start, end) => {
  const qStart = [start];
  const qEnd = [end];
  const visitedStart = new Set([start]);
  const visitedEnd = new Set([end]);
  const prevStart = {};
  const prevEnd = {}; 
  const visitedOrder = [];

  while (qStart.length && qEnd.length) {
    if (qStart.length) {
      const curr = qStart.shift();
      visitedOrder.push({ id: curr, from: prevStart[curr] });
      for (const edge of graph[curr].neighbors) {
        if (!visitedStart.has(edge.node) && edge.weight !== Infinity) {
          visitedStart.add(edge.node);
          prevStart[edge.node] = curr;
          qStart.push(edge.node);
          if (visitedEnd.has(edge.node)) return { visitedOrder, path: mergeBidirectionalPath(curr, edge.node, prevStart, prevEnd) };
        }
      }
    }
    if (qEnd.length) {
      const curr = qEnd.shift();
      visitedOrder.push({ id: curr, from: prevEnd[curr] });
      for (const edge of graph[curr].neighbors) {
        if (!visitedEnd.has(edge.node) && edge.weight !== Infinity) {
          visitedEnd.add(edge.node);
          prevEnd[edge.node] = curr;
          qEnd.push(edge.node);
          if (visitedStart.has(edge.node)) return { visitedOrder, path: mergeBidirectionalPath(edge.node, curr, prevStart, prevEnd) };
        }
      }
    }
  }
  return { visitedOrder, path: [] };
};

const reconstructPath = (previous, end) => {
  const path = [];
  let curr = end;
  while (curr) { path.unshift(curr); curr = previous[curr]; }
  return path.length > 1 ? path : [];
};

const mergeBidirectionalPath = (meetStart, meetEnd, prevStart, prevEnd) => {
    const path1 = [];
    let curr = meetStart;
    while(curr) { path1.unshift(curr); curr = prevStart[curr]; }
    const path2 = [];
    curr = meetEnd;
    while(curr) { path2.push(curr); curr = prevEnd[curr]; }
    return [...path1, ...path2];
};