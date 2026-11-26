import React from 'react';

interface EqualizerBarsProps {
  active: boolean;
  className?: string;
}

export const EqualizerBars: React.FC<EqualizerBarsProps> = ({ active, className = '' }) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-[2.5px] h-3.5 shrink-0 ${className}`}
    >
      <span
        className={`w-[2.5px] h-full rounded-full bg-gradient-to-t from-emerald-500 to-lime-300 transition-opacity duration-200 ${
          active ? 'eq-bar-1 opacity-100' : 'scale-y-[0.3] opacity-40'
        }`}
      />
      <span
        className={`w-[2.5px] h-full rounded-full bg-gradient-to-t from-emerald-500 to-lime-300 transition-opacity duration-200 ${
          active ? 'eq-bar-2 opacity-100' : 'scale-y-[0.5] opacity-40'
        }`}
      />
      <span
        className={`w-[2.5px] h-full rounded-full bg-gradient-to-t from-emerald-500 to-lime-300 transition-opacity duration-200 ${
          active ? 'eq-bar-3 opacity-100' : 'scale-y-[0.25] opacity-40'
        }`}
      />
      <span
        className={`w-[2.5px] h-full rounded-full bg-gradient-to-t from-emerald-500 to-lime-300 transition-opacity duration-200 ${
          active ? 'eq-bar-4 opacity-100' : 'scale-y-[0.45] opacity-40'
        }`}
      />
    </span>
  );
};
