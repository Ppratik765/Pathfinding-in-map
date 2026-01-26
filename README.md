# GeoViz: Real-World Pathfinding Visualizer

GeoViz is an advanced, interactive geospatial analysis tool that visualises pathfinding algorithms on real-world map data. Unlike traditional grid-based visualizers, GeoViz operates on actual street networks fetched dynamically from OpenStreetMap (OSM).

It allows users to render city blocks in 3D, simulate traffic conditions, place roadblocks, and compare the performance of multiple pathfinding algorithms simultaneously in a synchronised multi-viewport environment.

## Live Demo
https://pathfinding-lab.vercel.app/

## Project Screenshots
<img width="1904" height="943" alt="image" src="https://github.com/user-attachments/assets/980eefe7-b65e-4f66-9471-5068b31f9b63" />
<img width="1877" height="731" alt="image" src="https://github.com/user-attachments/assets/14c33307-c25b-4bfb-863a-99c226f6db0d" />
<img width="1890" height="819" alt="image" src="https://github.com/user-attachments/assets/4ee9a997-0c06-4f4a-bd49-393c31891c3a" />

## Overview

Pathfinding algorithms are fundamental to computer science, used in everything from GPS navigation to network routing. This application provides a grid-based interactive environment where users can draw obstacles, set terrain weights (like mud or water), and visualise how different algorithms traverse the graph to find the shortest path between a Start node and a Target node.

The application focuses on performance and clarity, featuring a comparison mode that allows algorithms to be raced side-by-side and a 3D tilt view for enhanced visualisation.

## Features

### Core Functionality
* **Real-World Data:** Fetches live vector data from OpenStreetMap using the Overpass API to construct a mathematical graph of intersections (nodes) and roads (edges).
* **Graph Visualisation:** Renders the underlying graph network over the map, showing exactly which paths are traversable.
* **3D Environment:** Fully extruded 3D buildings and terrain that work in both Light and Dark modes.
* **Interactive Tools:**
    * **Start/End:** Place distinct markers for the origin and destination.
    * **Roadblocks:** Mark specific streets as impassable (infinite weight).
    * **Traffic:** Simulate heavy traffic conditions (10x weight penalty) to force algorithms to find alternate routes.

### Algorithm Comparison
* **Multi-View System:** Run up to 4 different algorithms simultaneously on the same map data.
* **Viewport Synchronisation:** All map instances are locked to a "Master" view. Panning or zooming one map updates all others instantly.
* **Live Statistics:** Real-time metrics for each algorithm, including:
    * Total Distance (km)
    * Execution Time (ms)
    * Explored Distance (km)

### Supported Algorithms
1.  **Dijkstra's Algorithm:** The father of pathfinding. Guarantees the shortest path.
2.  **A * Search (A-Star):** Uses heuristics (physical distance) to optimise the search direction. accurate and fast.
3.  **Breadth-First Search (BFS):** Explores equally in all directions. Unweighted (ignores traffic/distance costs).
4.  **Depth-First Search (DFS):** Explores as far as possible along each branch before backtracking. Not guaranteed to find the shortest path.
5.  **Greedy Best-First Search:** Prioritises paths that appear to be closer to the goal. Very fast but not always optimal.
6.  **Bidirectional Search:** Runs two simultaneous searches (one from start, one from end) that meet in the middle.

## Technology Stack

* **Frontend Framework:** React (Vite)
* **Language:** JavaScript (ES6+)
* **Styling:** Tailwind CSS
* **Map Rendering:** MapLibre GL JS (Open-source fork of Mapbox GL)
* **Map Tiles & Geocoding:** MapTiler Cloud
* **Geospatial Analysis:** Turf.js (Distance calculations, point-in-polygon)
* **Data Source:** Overpass API (OpenStreetMap data fetching)
* **Data Conversion:** osmtogeojson (Converts OSM XML to GeoJSON)

## Prerequisites

Before running the project, ensure you have the following installed:
* Node.js (v16.0.0 or higher)
* npm (v7.0.0 or higher)

You will also need a free API Key from MapTiler.

## Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Ppratik765/Pathfinding-in-map.git
    cd Pathfinding-in-map
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a file named `.env` in the root directory of the project. Add your MapTiler API key:
    ```env
    VITE_MAPTILER_KEY=your_maptiler_api_key_here
    ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```

5.  **Build for Production**
    ```bash
    npm run build
    ```

## Usage Guide

### 1. Loading a Location
* Use the Search Bar in the top header to find a city (e.g., "Paris", "New York", "Tokyo").
* **Important:** You must zoom in to a specific neighborhood or city block (Zoom level 13+).
* Click the **LOAD** button. The app will fetch road data for the visible area. Wait for the status to say "Graph Ready".

### 2. Setting Up the Simulation
* **Start/End:** Select the Start (Green) or End (Red) tool from the toolbar and click on any highlighted road segment.
* **Obstacles:** Select "Block" (Wall icon) to cut off roads, or "Slow" (Traffic Cone) to increase travel cost on specific streets.

### 3. Running Algorithms
* Select an algorithm from the dropdown menu on the top-left of the map card.
* Click **RUN** in the main header.
* Watch the animation as the algorithm explores the graph (Blue lines) and finds the final path (Orange line).

### 4. Comparing Algorithms
* Click the **+ (Plus)** icon in the menu bar to add a new map view.
* Select a different algorithm for the new view.
* Both maps share the same Start, End, and Obstacles.
* Click **RUN** to race them against each other.

## Project Structure

```text
src/
├── algorithms/          # Pathfinding logic
│   └── mapAlgorithms.js # Implementation of Dijkstra, A*, BFS, etc.
├── components/          # React components
│   ├── Background.jsx   # Particle network background effect
│   └── MapBoard.jsx     # Main map canvas and interaction logic
├── utils/               # Helper functions
│   └── graphUtils.js    # Overpass API fetching and Graph construction
├── App.jsx              # Main layout and state management
├── main.jsx             # Entry point
└── index.css            # Global styles and Tailwind directives
```
## Troubleshooting
**"Area too large! Zoom in closer."** The Overpass API has strict data limits. If you try to load an entire country or a massive city at once, the request will time out. Zoom into a neighbourhood level to ensure a successful graph build.

**"No roads found here."** Ensure you are looking at an area with mapped roads. Some rural areas or bodies of water may not have valid "highway" tags in OpenStreetMap.

**Map is black/blank** Ensure your `.env` file is created correctly and contains a valid `VITE_MAPTILER_KEY`.
