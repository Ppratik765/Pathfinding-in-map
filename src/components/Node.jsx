// src/components/Node.jsx
import React from 'react';
import { clsx } from 'clsx';

// We added an 'isCompact' prop to shrink nodes
export const Node = ({ row, col, isStart, isFinish, isWall, isCompact, onMouseDown, onMouseEnter, onMouseUp }) => {
  
  const extraClass = isFinish ? 'node-end'
    : isStart ? 'node-start'
    : isWall ? 'node-wall'
    : '';

  // Dynamic sizing based on Compact mode
  const sizeClass = isCompact ? 'w-3 h-3' : 'w-6 h-6';

  return (
    <div
      id={`node-${row}-${col}`} 
      className={clsx(
        sizeClass,
        "border-t border-l border-blue-50/20 inline-block align-top", // Removed internal gaps, used light border
        extraClass
      )}
      onMouseDown={() => onMouseDown(row, col)}
      onMouseEnter={() => onMouseEnter(row, col)}
      onMouseUp={() => onMouseUp()}
    ></div>
  );
};
