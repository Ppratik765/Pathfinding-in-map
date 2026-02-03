import osmtogeojson from 'osmtogeojson';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

// Server rotation
const SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

export const fetchRoadNetwork = async (bounds, zoom) => {
  // --- 1. INSTANT PRE-CHECKS (No waiting) ---
  if (zoom < 12) {
      return { error: "Map is too large. Zoom in closer and load again." };
  }

  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const area = width * height;

  // Desktop (>768px): 0.33 (Large area)
  // Mobile (<768px): 0.15 (Restricted area to prevent crashes)
  const isMobile = window.innerWidth < 768;
  const maxArea = isMobile ? 0.15 : 0.33;

  if (area > maxArea) {
      return { 
          error: isMobile 
            ? "Area too large for mobile! Zoom in." 
            : "Area too large! Zoom in and load again." 
      };
  }

  // --- 2. DYNAMIC QUERY ---
  let roadFilter = "";
  if (zoom < 15) {
      // Fast Mode: Major roads only
      console.log("Fast Mode: Major roads + Links (Relaxed Connectivity)");
      roadFilter = `["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]`;
  } else {
      // Detail Mode: Everything playable
      console.log("Detail Mode: All streets");
      roadFilter = `["highway"]["highway"!~"footway|cycleway|path|service|track|steps|pedestrian|construction"]`;
  }

  const query = `
    [out:json][timeout:16];
    (
      way${roadFilter}
      (${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out body;
    >;
    out skel qt;
  `;

  // --- 3. ROBUST FETCH ---
  for (const server of SERVERS) {
      const url = `${server}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Max per server

      try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
              const data = await response.json();
              return osmtogeojson(data);
          }
      } catch (error) {
          // Silent fail, try next server
      }
  }

  return { error: "Servers are busy, unable to load roads networks. Try after some time." };
};

export const buildGraphFromGeoJSON = (geojson, obstacles = {}) => {
  const nodes = {};
  if (!geojson || !geojson.features) return nodes;

  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const props = feature.properties || {};
      
      // Strict Realism: Respect one-way tags
      const isOneWay = props.oneway === 'yes' || props.junction === 'roundabout';

      for (let i = 0; i < coords.length - 1; i++) {
        const from = coords[i];
        const to = coords[i + 1];
        
        const fromId = `${from[0].toFixed(5)},${from[1].toFixed(5)}`;
        const toId = `${to[0].toFixed(5)},${to[1].toFixed(5)}`;
        
        let weight = distance(point(from), point(to), { units: 'kilometers' });

        if (obstacles[toId] === 'block' || obstacles[fromId] === 'block') weight = Infinity;
        else if (obstacles[toId] === 'traffic' || obstacles[fromId] === 'traffic') weight *= 10;

        // Initialize node structure with BOTH neighbors (Forward) and reverseNeighbors (Backward)
        if (!nodes[fromId]) nodes[fromId] = { id: fromId, lng: from[0], lat: from[1], neighbors: [], reverseNeighbors: [] };
        if (!nodes[toId]) nodes[toId] = { id: toId, lng: to[0], lat: to[1], neighbors: [], reverseNeighbors: [] };

        // 1. Forward Connection (A -> B)
        nodes[fromId].neighbors.push({ node: toId, weight });
        // This edge "comes from" A, so B sees A as a reverse neighbor
        nodes[toId].reverseNeighbors.push({ node: fromId, weight });

        // 2. Backward Connection (B -> A) -- Only if NOT One-Way
        if (!isOneWay) {
            nodes[toId].neighbors.push({ node: fromId, weight });
            // This edge "comes from" B, so A sees B as a reverse neighbor
            nodes[fromId].reverseNeighbors.push({ node: toId, weight });
        }
      }
    }
  });
  return nodes;
};

export const findNearestNode = (lat, lng, graphNodes) => {
  let closest = null;
  let minDst = Infinity;
  Object.values(graphNodes).forEach(node => {
    const d = distance(point([lng, lat]), point([node.lng, node.lat]));
    if (d < minDst) { minDst = d; closest = node; }
  });
  return minDst < 0.5 ? closest : null;
};