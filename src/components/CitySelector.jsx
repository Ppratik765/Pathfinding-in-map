import React from 'react';
import { Map as MapIcon, ChevronDown } from 'lucide-react';
import { CITY_PRESETS } from '../data/cityPresets';

export const CitySelector = ({ onSelect }) => {
  return (
    <div className="relative group shrink-0">
      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-xl transition-all text-xs font-bold text-gray-700 dark:text-gray-200">
        <MapIcon size={14} className="text-indigo-500" />
        <span className="hidden sm:inline">Presets</span>
        <ChevronDown size={12} className="opacity-50" />
      </button>
      
      {/* Dropdown Menu */}
      <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden hidden group-focus-within:block z-[100]">
        <div className="py-1">
          <div className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 bg-gray-50 dark:bg-gray-800/50">Featured Maps</div>
          {CITY_PRESETS.map((city) => (
            <button
              key={city.name}
              onClick={() => onSelect(city)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-2"
            >
              {city.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};