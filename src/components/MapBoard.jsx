import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeocodingControl } from "@maptiler/geocoding-control/maplibregl";
import "@maptiler/geocoding-control/style.css";
import { fetchRoadNetwork, findNearestNode } from '../utils/graphUtils';
import { runAlgorithm } from '../algorithms/mapAlgorithms';
import { renderToString } from 'react-dom/server';
import { Home, Flag, BrickWall, TrafficCone } from 'lucide-react';

const API_KEY = import.meta.env.VITE_MAPTILER_KEY;

const createMarkerElement = (type) => {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.transform = 'translate(-50%, -100%)'; 
    el.style.filter = 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))';
    
    const pinColor = type === 'start' ? '#22c55e' : (type === 'end' ? '#ef4444' : '#fff');
    let icon = null;
    if (type === 'start') icon = <Home fill="white" size={16} />;
    else if (type === 'end') icon = <Flag fill="white" size={16} />;
    else if (type === 'block') icon = <BrickWall color="#ef4444" size={20} />;
    else if (type === 'traffic') icon = <TrafficCone fill="orange" size={20} />;

    if (type === 'start' || type === 'end') {
        const svg = `
        <svg width="34" height="42" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20 12 30 12 30C12 30 24 20 24 12C24 5.37258 18.6274 0 12 0Z" fill="${pinColor}"/>
            <circle cx="12" cy="12" r="8" fill="rgba(0,0,0,0.1)"/>
        </svg>`;
        el.innerHTML = `<div style="position: relative; width: 34px; height: 42px;">${svg}<div style="position: absolute; top: 8px; left: 9px; color: white;">${renderToString(icon)}</div></div>`;
    } else {
        el.innerHTML = renderToString(icon);
    }
    return el;
};

export const MapBoard = forwardRef(({ 
    darkMode, algoType, activeTool, sharedViewState, onViewChange, sharedData, onDataUpdate, onStatus, isMaster, onResult, winStatus, showPerimeter 
}, ref) => {
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]); 
  const sharedDataRef = useRef(sharedData);
  const activeToolRef = useRef(activeTool);
  const lastLoadedCenter = useRef(null);
  
  // FIX: Track the animation frame ID to cancel it later
  const currentAnimationId = useRef(null);

  useEffect(() => { sharedDataRef.current = sharedData; }, [sharedData]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // FIX: Helper to kill any running loop
  const cancelAnimation = () => {
      if (currentAnimationId.current) {
          cancelAnimationFrame(currentAnimationId.current);
          currentAnimationId.current = null;
      }
  };

  useEffect(() => { 
      if (map.current && map.current.getSource('roads')) {
          if (sharedData.geojson) {
              map.current.getSource('roads').setData(sharedData.geojson);
              // Note: Only redraw box if bounds logic exists here or parent handles it
          } else {
              // RESET: Clear data & kill animation
              cancelAnimation();
              map.current.getSource('roads').setData({ type: 'FeatureCollection', features: [] });
              if (map.current.getSource('area-boundary')) {
                  map.current.getSource('area-boundary').setData({ type: 'FeatureCollection', features: [] });
              }
          }
      }
  }, [sharedData.geojson]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    if (map.current.getLayer('area-glow')) {
        map.current.setLayoutProperty('area-glow', 'visibility', showPerimeter ? 'visible' : 'none');
        const color = darkMode ? '#0000FF' : '#FFFF00';
        map.current.setPaintProperty('area-glow', 'line-color', color);
    }
  }, [showPerimeter, darkMode]);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${API_KEY}`,
      center: sharedViewState.center,
      zoom: sharedViewState.zoom,
      pitch: sharedViewState.pitch,
      bearing: sharedViewState.bearing,
      antialias: true,
      attributionControl: false
    });

    if (isMaster) {
        const gc = new GeocodingControl({ apiKey: API_KEY, placeholder: 'Search City...', collapsed: false });
        const searchContainer = document.getElementById('geocoder-container');
        if (searchContainer) { const ctrl = gc.onAdd(map.current); searchContainer.appendChild(ctrl); } 
        else { map.current.addControl(gc, 'top-left'); }
        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.current.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
    }

    map.current.on('load', async () => { setupLayers(); setup3DBuildings(); if (isMaster && !sharedData.graph) await loadRoadsInternal(); });
    
    map.current.on('move', () => { 
        if(isMaster && onViewChange) {
            onViewChange(map.current.getCenter(), map.current.getZoom(), map.current.getPitch(), map.current.getBearing());
            if (lastLoadedCenter.current) {
                const dist = map.current.getCenter().distanceTo(lastLoadedCenter.current);
                if (dist > 25000) { if (onStatus) onStatus("Area Changed. Click 'Load Roads' to explore algorithms"); }
            }
        }
    });
    
    map.current.on('click', handleMapClickInternal);
    map.current.on('mousemove', handleMouseMoveInternal);
  }, []);

  useEffect(() => { if(!map.current || isMaster) return; map.current.jumpTo({ center: sharedViewState.center, zoom: sharedViewState.zoom, pitch: sharedViewState.pitch, bearing: sharedViewState.bearing }); }, [sharedViewState]);

  const setupLayers = () => {
      const m = map.current;
      if(!m) return;

      const sources = ['visited', 'path', 'roads', 'graph-network', 'area-boundary', 'obstacles'];
      sources.forEach(s => { if(!m.getSource(s)) m.addSource(s, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); });

      const perimeterColor = darkMode ? '#0000FF' : '#ff9900';

      if(!m.getLayer('graph-layer')) m.addLayer({
          id: 'graph-layer', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': darkMode ? '#ffffff' : '#000000', 'line-width': 2, 'line-opacity': 0.1 }
      });

      if(!m.getLayer('area-glow')) m.addLayer({
          id: 'area-glow', type: 'line', source: 'area-boundary',
          layout: { 
              'line-join': 'round', 
              'line-cap': 'round',
              'visibility': showPerimeter ? 'visible' : 'none'
          },
          paint: { 
              'line-color': perimeterColor,
              'line-width': 6,
              'line-blur': 4,
              'line-opacity': 1,
              'line-dasharray': [2, 1] 
          }
      });

      if(!m.getLayer('visited-layer')) m.addLayer({ 
          id: 'visited-layer', type: 'line', source: 'visited', 
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.7 } 
      });
      
      if(m.getLayer('path-layer')) m.removeLayer('path-layer');
      m.addLayer({ 
          id: 'path-layer', type: 'line', source: 'path', 
          layout: { 'line-cap': 'round', 'line-join': 'round' }, 
          paint: { 'line-color': '#ff6600', 'line-width': 6, 'line-opacity': 1 } 
      });

      if(!m.getLayer('obstacle-layer')) m.addLayer({ 
          id: 'obstacle-layer', type: 'circle', source: 'obstacles', 
          paint: { 'circle-color': 'transparent', 'circle-radius': 1 } 
      });
  };

  const setup3DBuildings = () => {
      const m = map.current;
      if(m.getLayer('3d-buildings')) return;
      const layers = m.getStyle().layers;
      let labelId;
      for (const layer of layers) { if (layer.type === 'symbol' && layer.layout['text-field']) { labelId = layer.id; break; } }
      if(!m.getSource('openmaptiles')) m.addSource('openmaptiles', { url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${API_KEY}`, type: 'vector' });
      m.addLayer({
          'id': '3d-buildings', 'source': 'openmaptiles', 'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 
          'minzoom': 7,
          'paint': { 'fill-extrusion-color': '#d1d5db', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.8 }
      }, labelId);
  };

  const loadRoadsInternal = async () => {
      if(onStatus) onStatus("Scanning...");
      const bounds = map.current.getBounds();
      const zoom = map.current.getZoom(); 
      const bbox = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
      const geojson = await fetchRoadNetwork(bbox, zoom);
      
      if (geojson && geojson.error) {
          if(onStatus) onStatus(geojson.error);
          return;
      }

      if(geojson && geojson.features.length > 0) {
          onDataUpdate({ geojson }); 
          lastLoadedCenter.current = map.current.getCenter();

          if(map.current.getSource('roads')) map.current.getSource('roads').setData(geojson);
          
          const polygon = {
              type: 'Feature',
              geometry: {
                  type: 'Polygon',
                  coordinates: [[ [bbox.west, bbox.north], [bbox.east, bbox.north], [bbox.east, bbox.south], [bbox.west, bbox.south], [bbox.west, bbox.north] ]]
              }
          };
          if(map.current.getSource('area-boundary')) map.current.getSource('area-boundary').setData(polygon);

          if(onStatus) onStatus(`Graph ready for roads inside perimeter, ${geojson.features.length} segments`);
      } else {
          if(onStatus) onStatus("Map is too large to load in. Zoom in closer!");
      }
  };

  const handleMouseMoveInternal = (e) => {
      if (!sharedDataRef.current.graph) return;
      map.current.getCanvas().style.cursor = activeToolRef.current ? 'crosshair' : 'grab';
  };

  const handleMapClickInternal = (e) => {
      const currentData = sharedDataRef.current;
      const currentTool = activeToolRef.current;
      if(!currentData.graph) return;
      const { lng, lat } = e.lngLat;
      const nearest = findNearestNode(lat, lng, currentData.graph);
      
      if(!nearest) return;

      if(currentTool === 'start') onDataUpdate({ start: nearest });
      else if (currentTool === 'end') onDataUpdate({ end: nearest });
      else if (currentTool === 'wall' || currentTool === 'traffic') {
          const type = currentTool === 'wall' ? 'block' : 'traffic';
          const newObstacles = { ...currentData.obstacles, [nearest.id]: type };
          onDataUpdate({ obstacles: newObstacles });
      }
  };

  const updateVisuals = () => {
      if(!map.current) return;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if(sharedData.start) markersRef.current.push(new maplibregl.Marker({ element: createMarkerElement('start'), anchor: 'bottom' }).setLngLat([sharedData.start.lng, sharedData.start.lat]).addTo(map.current));
      if(sharedData.end) markersRef.current.push(new maplibregl.Marker({ element: createMarkerElement('end'), anchor: 'bottom' }).setLngLat([sharedData.end.lng, sharedData.end.lat]).addTo(map.current));
      Object.keys(sharedData.obstacles).forEach(id => {
          const type = sharedData.obstacles[id];
          const node = sharedData.graph[id];
          if(node) markersRef.current.push(new maplibregl.Marker({ element: createMarkerElement(type) }).setLngLat([node.lng, node.lat]).addTo(map.current));
      });
  };

  useEffect(() => { updateVisuals(); }, [sharedData.start, sharedData.end, sharedData.obstacles]);
  useEffect(() => { if (map.current && sharedData.geojson && map.current.getSource('roads')) map.current.getSource('roads').setData(sharedData.geojson); }, [sharedData.geojson]);

  useImperativeHandle(ref, () => ({
    loadRoads: loadRoadsInternal,
    reset: () => { 
        cancelAnimation(); // FIX: Kill loop
        map.current.getSource('visited').setData({type:'FeatureCollection', features:[]});
        map.current.getSource('path').setData({type:'FeatureCollection', features:[]});
    },
    run: () => {
        if(!sharedData.graph || !sharedData.start || !sharedData.end) return;
        
        // FIX: Start fresh. Kill previous loop.
        cancelAnimation();
        
        map.current.getSource('visited').setData({type:'FeatureCollection', features:[]});
        map.current.getSource('path').setData({type:'FeatureCollection', features:[]});

        // Add a tiny delay to ensure React state/map sources settle before heavy calc
        setTimeout(() => {
            const result = runAlgorithm(algoType, sharedData.graph, sharedData.start.id, sharedData.end.id);
            const { visitedOrder, path, time, cost, visitedCount, exploredDist } = result;
            
            let i = 0;
            const totalSteps = visitedOrder.length;
            const stepsPerFrame = 90; // Adjust for speed
            const visitedFeatures = [];

            const animate = () => {
                if(i >= totalSteps) {
                    if (path.length) {
                        const pathCoords = path.map(id => [sharedData.graph[id].lng, sharedData.graph[id].lat]);
                        map.current.getSource('path').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: pathCoords } }] });
                    }
                    const finalStats = { time, cost, visited: visitedCount, exploredDist };
                    setTimeout(() => { if (onResult) onResult(finalStats); }, 500);
                    currentAnimationId.current = null; // Done
                    return;
                }
                
                for(let j=0; j<stepsPerFrame && i<totalSteps; j++) {
                    const item = visitedOrder[i];
                    if (item.from) {
                        const fromNode = sharedData.graph[item.from];
                        const toNode = sharedData.graph[item.id];
                        // Only add valid lines
                        if(fromNode && toNode) {
                            visitedFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[fromNode.lng, fromNode.lat], [toNode.lng, toNode.lat]] } });
                        }
                    }
                    i++;
                }
                
                // Batch update
                map.current.getSource('visited').setData({ type: 'FeatureCollection', features: visitedFeatures });
                
                currentAnimationId.current = requestAnimationFrame(animate);
            };
            
            // Start the loop
            currentAnimationId.current = requestAnimationFrame(animate);
        }, 10);
    }
  }));

  const borderClass = winStatus === 'winner' ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]' 
                    : winStatus === 'loser' ? 'border-red-500 opacity-90'
                    : 'border-white dark:border-gray-700';

  const filterStyle = darkMode ? 'invert(1) hue-rotate(180deg) brightness(1.1) contrast(0.9)' : 'none';

  return (
    <div className={`w-full h-full relative border-4 rounded-xl overflow-hidden transition-all duration-300 ${borderClass}`}>
        <div 
            ref={mapContainer} 
            className="w-full h-full" 
            style={{ filter: filterStyle, transition: 'filter 0.3s ease' }} 
        />
    </div>
  );
});