import osmtogeojson from 'osmtogeojson';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

// Server rotation prevents "Connection Failed" if one is busy
const SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://api.openstreetmap.fr/oapi/interpreter"
];

export const fetchRoadNetwork = async (bounds, zoom) => {
  // 1. Zoom Check
  if (zoom < 12) {
      return { error: "Map is too big, zoom in closer!." };
  }

  // 2. Area Check
  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const area = width * height;

  if (area > 0.33) {
      return { error: "Area too massive! Zoom in slightly." };
  }

  // --- 3. DYNAMIC OPTIMIZATION (The Speed Fix) ---
  let roadFilter = "";
  
  if (zoom < 15) {
      // FAST MODE (Zoom 9-14): Only load major arteries. 
      // Ignores thousands of small residential streets.
      console.log("🚀 Fast Mode: Major roads + Links");
      roadFilter = `["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]`;
  } else {
      // DETAIL MODE (Zoom 13+): Load everything playable.
      console.log("🔍 Detail Mode: All streets");
      roadFilter = `["highway"]["highway"!~"footway|cycleway|path|service|track|pedestrian"]`;
  }

  const query = `
    [out:json][timeout:15];
    (
      way${roadFilter}
      (${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out body;
    >;
    out skel qt;
  `;

  // 4. Robust Fetch
  for (const server of SERVERS) {
      const url = `${server}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 10s Limit

      try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
              const data = await response.json();
              return osmtogeojson(data);
          } else {
              // Try next server on error
              continue; 
          }
      } catch (error) {
          // Try next server on timeout
          continue; 
      }
  }

  return { error: "Servers busy. Try zooming in or wait 10s." };
};

export const buildGraphFromGeoJSON = (geojson, obstacles = {}) => {
  const nodes = {};
  if (!geojson || !geojson.features) return nodes;

  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const props = feature.properties || {};
      
      // --- FIX: ONE-WAY LOGIC ---
      // Check if road is explicitly one-way OR is a roundabout
      const isOneWay = props.oneway === 'yes' || props.junction === 'roundabout';

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

        // Always add Forward direction (From -> To)
        nodes[fromId].neighbors.push({ node: toId, weight });

        // Only add Backward direction (To -> From) if NOT one-way
        if (!isOneWay) {
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
  return minDst < 0.5 ? closest : null;
};