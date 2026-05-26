import osmtogeojson from 'osmtogeojson';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

export const fetchRoadNetwork = async (bounds, zoom) => {
  // --- 1. INSTANT PRE-CHECKS ---
  if (zoom < 12) {
      return { error: "Map is too large. Zoom in closer and load again." };
  }

  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const area = width * height;

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
      console.log("Fast Mode: Major roads + Links");
      roadFilter = `["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]`;
  } else {
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

  // --- 3. ROBUST FETCH (VIA YOUR BACKEND API) ---
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); 

  try {
      // Send a clean JSON request to YOUR backend server
      const response = await fetch('/api/overpass', { 
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query }),
          signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
          const data = await response.json();
          // Convert the raw OSM data into GeoJSON format for the map
          return osmtogeojson(data);
      } else {
          console.error(`Backend returned status ${response.status}`);
          return { error: "Server responded with an error. Please try again." };
      }
  } catch (error) {
      console.error("Fetch failed:", error);
      return { error: "Failed to connect to the routing server. Please try again later." };
  }
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