import React from 'react';
import { triggerHaptic } from '../utils/haptics';

interface IosLiquidGlassSwitchTrackProps {
  checked: boolean;
  size?: 'default' | 'compact';
}

/**
 * Pure visual Apple iOS Switch capsule with Liquid Glass finish (#34C759 gradient + specular top arc).
 * Can be used inside standalone switch buttons or composite pills (e.g., Audio / Video switch).
 */
export const IosLiquidGlassSwitchTrack: React.FC<IosLiquidGlassSwitchTrackProps> = ({
  checked,
  size = 'default',
}) => {
  const isCompact = size === 'compact';

  const trackSizeClass = isCompact ? 'w-[42px] h-[26px]' : 'w-[52px] h-[32px]';
  const thumbSizeClass = isCompact ? 'w-[22px] h-[22px]' : 'w-[28px] h-[28px]';
  const thumbTranslateClass = checked
    ? isCompact
      ? 'translate-x-[16px]'
      : 'translate-x-[20px]'
    : 'translate-x-0';

  return (
    <span
      aria-hidden="true"
      data-ios-switch-track={checked ? 'on' : 'off'}
      className={`${trackSizeClass} rounded-full p-[2px] relative inline-flex items-center shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        checked
          ? "bg-gradient-to-b from-[#30D158] to-[#28B84C] ring-1 ring-inset ring-white/35 shadow-[0_2px_10px_rgba(52,199,89,0.35)] before:content-[''] before:absolute before:inset-x-1 before:top-[1px] before:h-[45%] before:rounded-full before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
          : 'bg-white/15 backdrop-blur-md ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.28)]'
      }`}
    >
      <span
        data-ios-switch-thumb=""
        className={`${thumbSizeClass} rounded-full bg-white relative z-10 ring-1 ring-inset ring-white/80 shadow-[0_3px_8px_rgba(0,0,0,0.28),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${thumbTranslateClass}`}
      />
    </span>
  );
};

interface IosLiquidGlassSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  size?: 'default' | 'compact';
  disableAutoHaptic?: boolean;
}

export const IosLiquidGlassSwitch: React.FC<IosLiquidGlassSwitchProps> = ({
  checked,
  onToggle,
  label,
  disabled = false,
  size = 'default',
  disableAutoHaptic = false,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => {
      if (!disableAutoHaptic) {
        triggerHaptic(12);
      }
      onToggle();
    }}
    className="inline-flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.97] transition-transform disabled:opacity-45 cursor-pointer"
  >
    <IosLiquidGlassSwitchTrack checked={checked} size={size} />
  </button>
);
