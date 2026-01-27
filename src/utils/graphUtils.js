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
  if (zoom < 11) {
      return { error: "Zoom in closer (Level 11+)." };
  }

  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const area = width * height;

  // Strict limit: 0.25 square degrees (approx large city size)
  if (area > 0.25) {
      return { error: "Area too large! Zoom in before loading." };
  }

  // --- 2. DYNAMIC QUERY ---
  let roadFilter = "";
  let isFastMode = false;
  if (zoom < 15) {
      // Fast Mode: Major roads only
      console.log("Fast Mode: Major roads + Links (Relaxed Connectivity)");
      isFastMode = true;
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

// 3. Fetch
  for (const server of SERVERS) {
      const url = `${server}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 

      try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
              const data = await response.json();
              const geojson = osmtogeojson(data);
              // Tag the data so we know how to build the graph later
              geojson.properties = { ...geojson.properties, isFastMode }; 
              return geojson;
          }
      } catch (error) {
          continue; 
      }
  }

  return { error: "Servers busy or area too large. Try zooming in." };
};

// FIX: Added 'relaxed' parameter to ignore one-way rules in sparse maps
export const buildGraphFromGeoJSON = (geojson, obstacles = {}, relaxed = false) => {
  const nodes = {};
  if (!geojson || !geojson.features) return nodes;

  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const props = feature.properties || {};
      
      // FIX: If 'relaxed' is true (Fast Mode), ignore one-way tags to ensure connectivity
      const isOneWay = !relaxed && (props.oneway === 'yes' || props.junction === 'roundabout');

      for (let i = 0; i < coords.length - 1; i++) {
        const from = coords[i];
        const to = coords[i + 1];
        
        const fromId = `${from[0].toFixed(5)},${from[1].toFixed(5)}`;
        const toId = `${to[0].toFixed(5)},${to[1].toFixed(5)}`;
        
        let weight = distance(point(from), point(to), { units: 'kilometers' });

        if (obstacles[toId] === 'block' || obstacles[fromId] === 'block') weight = Infinity;
        else if (obstacles[toId] === 'traffic' || obstacles[fromId] === 'traffic') weight *= 10;

        if (!nodes[fromId]) nodes[fromId] = { id: fromId, lng: from[0], lat: from[1], neighbors: [] };
        if (!nodes[toId]) nodes[toId] = { id: toId, lng: to[0], lat: to[1], neighbors: [] };

        nodes[fromId].neighbors.push({ node: toId, weight });
        
        // If relaxed (Fast Mode) OR not one-way, add reverse connection
        if (relaxed || !isOneWay) {
            nodes[toId].neighbors.push({ node: fromId, weight });
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
  // Increased snap radius to 1.5km to help with sparse "Fast Mode" maps
  return minDst < 0.5 ? closest : null;
};