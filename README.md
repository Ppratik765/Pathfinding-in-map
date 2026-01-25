# Pathfinding Algorithm Visualiser

An interactive web application designed to visualise how various pathfinding algorithms work in real-time. Built with React, Vite, and Tailwind CSS, this tool helps users 
understand graph theory concepts through dynamic animations, weighted terrain generation, and algorithmic performance comparisons.

## Live Demo
https://pathfinding-lab.vercel.app/

## Project Screenshots
<img width="1904" height="943" alt="image" src="https://github.com/user-attachments/assets/980eefe7-b65e-4f66-9471-5068b31f9b63" />
<img width="1877" height="731" alt="image" src="https://github.com/user-attachments/assets/14c33307-c25b-4bfb-863a-99c226f6db0d" />
<img width="1890" height="819" alt="image" src="https://github.com/user-attachments/assets/4ee9a997-0c06-4f4a-bd49-393c31891c3a" />

## Overview

Pathfinding algorithms are fundamental to computer science, used in everything from GPS navigation to network routing. This application provides a grid-based interactive environment where users can draw obstacles, set terrain weights (like mud or water), and visualise how different algorithms traverse the graph to find the shortest path between a Start node and a Target node.

The application focuses on performance and clarity, featuring a comparison mode that allows algorithms to be raced side-by-side and a 3D tilt view for enhanced visualisation.

## Key Features

- **Interactive Grid System:** Users can draw walls and weighted terrain directly on the grid using a mouse.
- **Real-Time Visualisation:** Smooth animations show the algorithm's visiting order (scanning process) and the final calculated shortest path.
- **Algorithm Comparison Mode:** A split-screen feature allows users to race up to four different algorithms simultaneously to compare execution speed and path efficiency.
- **Weighted Terrain:** Support for non-binary node weights. Algorithms must decide whether to traverse high-cost nodes (like Water) or go around them.
- **Procedural Maze Generation:** Includes a Recursive Division algorithm (with randomised loops) to automatically generate complex, solvable mazes.
- **3D Perspective View:** A CSS-based 3D tilt effect that renders the grid as a three-dimensional board.
- **Performance Metrics:** precise tracking of execution time (in milliseconds) and total path cost.
- **Movable Nodes:** The Start and Target nodes can be dragged to any position on the grid.
- **Responsive Design:** The grid adjusts to the screen size, and the interface features a responsive control bar and dark mode support.

## Algorithms Implemented

The application includes six major graph traversal algorithms:

1. **Dijkstra's Algorithm:**
   - Type: Weighted.
   - Description: The father of pathfinding algorithms. It guarantees the shortest path by exploring nodes in order of their cumulative cost from the start.
   
2. **A* Search (A-Star):**
   - Type: Weighted.
   - Description: An optimisation of Dijkstra's algorithm that uses a heuristic (Manhattan Distance) to estimate the cost to the goal, guiding the search direction more efficiently.

3. **Breadth-First Search (BFS):**
   - Type: Unweighted.
   - Description: Explores the grid layer by layer. It guarantees the shortest path in unweighted graphs but does not account for terrain costs (treats Mud the same as Empty ground).

4. **Depth-First Search (DFS):**
   - Type: Unweighted.
   - Description: Explores as far as possible along each branch before backtracking. It is not guaranteed to find the shortest path and often produces winding, inefficient routes.

5. **Greedy Best-First Search:**
   - Type: Weighted (Heuristic only).
   - Description: Expands the node that is estimated to be closest to the target. It is very fast but does not guarantee the shortest path.

6. **Bidirectional BFS:**
   - Type: Unweighted.
   - Description: Runs two simultaneous breadth-first searches—one from the Start and one from the Target. The algorithm stops when the two searches meet in the middle.

## Terrain and Weights

To demonstrate the difference between "shortest distance" (steps) and "lowest cost" (effort), the grid supports different terrain types:

- **Empty Node:** Cost = 1 (Default movement)
- **Forest:** Cost = 3 (Represented by tree icons)
- **Mud:** Cost = 5 (Represented by brown tiles)
- **Water:** Cost = 10 (Represented by blue wave icons)
- **Wall:** Impassable

*Note: Unweighted algorithms like BFS and DFS treat all traversable nodes as having a cost of 1, effectively ignoring terrain difficulty.*

## Technology Stack

- **Frontend Framework:** React (v18+)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Language:** JavaScript (ES6+)

## Installation and Setup

To run this project locally on your machine, follow these steps:

1. Clone the repository:
   git clone https://github.com/your-username/pathfinding-viz.git

2. Navigate to the project directory:
   cd pathfinding-viz

3. Install dependencies:
   npm install

4. Start the development server:
   npm run dev

5. Open your browser and navigate to the local URL provided (usually http://localhost:5173).

## Usage Guide

1. **Draw the Board:** Click and drag on the grid to create Walls. Use the "Weight" tools in the menu to paint Forest, Mud, or Water.
2. **Move Points:** Click and drag the Green (Start) or Red (Target) icons to change their positions.
3. **Select Algorithm:** Choose an algorithm from the dropdown menu (e.g., Dijkstra).
4. **Compare (Optional):** Click the "+" button to add more grids. Select different algorithms for each to compare them side-by-side.
5. **Run:** Click the "Run" button to start the visualization.
6. **Analyze:** Watch the "Time" and "Cost" metrics in the header of each grid.
   - **Time:** How long the CPU took to calculate the path.
   - **Cost:** The total "weight" of the final path found.
7. **Reset:** Use "Clear Board" to remove walls or "Reset" to clear the path data while keeping the walls.

## Project Structure

- src/
  - algorithms.js: Contains the pure logic for all pathfinding and maze generation algorithms.
  - components/
    - Grid.jsx: The main component handling the grid rendering, animations, and mouse interactions.
    - Node.jsx: (Optional/Implicit) Represents individual cells.
  - App.jsx: The root component handling the layout, control bar, and global state management.
  - index.css: Global styles and Tailwind imports.
- labyrinth.png: Custom favicon/icon for the browser tab.
