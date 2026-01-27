import distance from '@turf/distance';
import { point } from '@turf/helpers';

// --- MIN HEAP CLASS (Speed Fix) ---
class MinHeap {
  constructor() { this.heap = []; }
  push(val) { this.heap.push(val); this.bubbleUp(); }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) { this.heap[0] = bottom; this.sinkDown(); }
    return top;
  }
  bubbleUp() {
    let idx = this.heap.length - 1;
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      if (this.compare(this.heap[idx], this.heap[parentIdx]) < 0) {
        [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
        idx = parentIdx;
      } else break;
    }
  }
  sinkDown() {
    let idx = 0;
    const length = this.heap.length;
    while (true) {
      let leftIdx = 2 * idx + 1;
      let rightIdx = 2 * idx + 2;
      let swap = null;
      if (leftIdx < length) {
        if (this.compare(this.heap[leftIdx], this.heap[idx]) < 0) swap = leftIdx;
      }
      if (rightIdx < length) {
        if ((swap === null && this.compare(this.heap[rightIdx], this.heap[idx]) < 0) ||
            (swap !== null && this.compare(this.heap[rightIdx], this.heap[leftIdx]) < 0)) {
          swap = rightIdx;
        }
      }
      if (swap === null) break;
      [this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]];
      idx = swap;
    }
  }
  compare(a, b) {
    const valA = a.dist !== undefined ? a.dist : (a.f !== undefined ? a.f : a.cost);
    const valB = b.dist !== undefined ? b.dist : (b.f !== undefined ? b.f : b.cost);
    return valA - valB;
  }
  get length() { return this.heap.length; }
}

const getHeuristic = (nodeIdA, nodeIdB, graph) => {
  const nodeA = graph[nodeIdA];
  const nodeB = graph[nodeIdB];
  return distance(point([nodeA.lng, nodeA.lat]), point([nodeB.lng, nodeB.lat]));
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
  const timeTaken = (endTime - startTime).toFixed(1);

  // Robust Cost Calculation
  const totalCost = result.path.reduce((acc, currId, idx) => {
      if (idx === 0) return 0;
      const prevId = result.path[idx - 1];
      const prevNode = graph[prevId];
      const currNode = graph[currId];
      if (!prevNode || !currNode) return acc;
      const edge = prevNode.neighbors.find(n => n.node === currId);
      if (edge) return acc + edge.weight;
      else return acc + distance(point([prevNode.lng, prevNode.lat]), point([currNode.lng, currNode.lat]), {units: 'kilometers'});
  }, 0);

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

  return { ...result, time: timeTaken, cost: totalCost.toFixed(2), visitedCount: result.visitedOrder.length, exploredDist: exploredDist.toFixed(2) };
};

// --- ALGO IMPLEMENTATIONS (Using Heap) ---

const runDijkstra = (graph, start, end) => {
  const distances = {}; const previous = {}; const pq = new MinHeap();
  pq.push({ id: start, dist: 0 });
  const visitedOrder = []; const visitedSet = new Set();
  distances[start] = 0;

  while (pq.length) {
    const { id: curr, dist: currDist } = pq.pop();
    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;
    if (currDist > (distances[curr] || Infinity)) continue;

    for (const edge of graph[curr].neighbors) {
      if (visitedSet.has(edge.node) || edge.weight === Infinity) continue;
      const newDist = currDist + edge.weight;
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
  const gScore = {}; const previous = {}; const visitedOrder = []; const visitedSet = new Set();
  const openSet = new MinHeap();
  gScore[start] = 0;
  openSet.push({ id: start, f: getHeuristic(start, end, graph) });

  while (openSet.length) {
    const { id: curr } = openSet.pop();
    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;

    for (const edge of graph[curr].neighbors) {
      if (edge.weight === Infinity) continue;
      const tentativeG = (gScore[curr] || 0) + edge.weight;
      if (tentativeG < (gScore[edge.node] || Infinity)) {
        previous[edge.node] = curr;
        gScore[edge.node] = tentativeG;
        openSet.push({ id: edge.node, f: tentativeG + getHeuristic(edge.node, end, graph) });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runGreedy = (graph, start, end) => {
  const visitedOrder = []; const previous = {}; const visitedSet = new Set();
  const pq = new MinHeap();
  pq.push({ id: start, cost: getHeuristic(start, end, graph) });

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
        pq.push({ id: edge.node, cost: getHeuristic(edge.node, end, graph) });
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runBidirectional = (graph, start, end) => {
  const distStart = {}; const distEnd = {}; const prevStart = {}; const prevEnd = {};
  const pqStart = new MinHeap(); const pqEnd = new MinHeap();
  pqStart.push({ id: start, dist: 0 }); pqEnd.push({ id: end, dist: 0 });
  const visitedStart = new Set(); const visitedEnd = new Set(); const visitedOrder = [];
  
  distStart[start] = 0; distEnd[end] = 0;
  let bestMeetNode = null; let bestMeetDist = Infinity;

  while (pqStart.length && pqEnd.length) {
    // Forward
    if (pqStart.length) {
        const { id: curr } = pqStart.pop();
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
    // Backward
    if (pqEnd.length) {
        const { id: curr } = pqEnd.pop();
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
    if (bestMeetNode) {
         const topStart = pqStart.length ? pqStart.heap[0].dist : Infinity;
         const topEnd = pqEnd.length ? pqEnd.heap[0].dist : Infinity;
         if (topStart + topEnd >= bestMeetDist) return { visitedOrder, path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd) };
    }
  }
  if (bestMeetNode) return { visitedOrder, path: mergeBidirectionalPath(bestMeetNode, prevStart, prevEnd) };
  return { visitedOrder, path: [] };
};

const runBFS = (graph, start, end) => {
  const queue = [start]; const visitedOrder = []; const visitedSet = new Set([start]); const previous = {};
  while (queue.length) {
    const curr = queue.shift();
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;
    for (const edge of graph[curr].neighbors) {
      if (!visitedSet.has(edge.node) && edge.weight !== Infinity) {
        visitedSet.add(edge.node); previous[edge.node] = curr; queue.push(edge.node);
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const runDFS = (graph, start, end) => {
  const stack = [start]; const visitedOrder = []; const visitedSet = new Set(); const previous = {};
  while (stack.length) {
    const curr = stack.pop();
    if (visitedSet.has(curr)) continue;
    visitedSet.add(curr);
    visitedOrder.push({ id: curr, from: previous[curr] });
    if (curr === end) break;
    const neighbors = [...graph[curr].neighbors].reverse(); 
    for (const edge of neighbors) {
      if (!visitedSet.has(edge.node) && edge.weight !== Infinity) {
        previous[edge.node] = curr; stack.push(edge.node);
      }
    }
  }
  return { visitedOrder, path: reconstructPath(previous, end), previous };
};

const reconstructPath = (previous, end) => {
  const path = []; let curr = end;
  while (curr) { path.unshift(curr); curr = previous[curr]; }
  return path.length > 1 ? path : [];
};

const mergeBidirectionalPath = (meetNode, prevStart, prevEnd) => {
    const path1 = []; let curr = meetNode;
    while(curr) { path1.unshift(curr); curr = prevStart[curr]; }
    const path2 = []; curr = prevEnd[meetNode]; 
    while(curr) { path2.push(curr); curr = prevEnd[curr]; }
    return [...path1, ...path2];
};