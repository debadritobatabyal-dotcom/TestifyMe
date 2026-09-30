import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export interface TimerProps {
  expiresAt: number;
  onTimeExpired: () => void;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ expiresAt, onTimeExpired, className = '' }) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        onTimeExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onTimeExpired]);

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isLowTime = totalSeconds < 300 && totalSeconds > 0; // Less than 5 minutes

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[16px] font-heading font-extrabold text-sm sm:text-base border transition-colors select-none ${
        isLowTime
          ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
          : 'bg-white text-[#332F3A] border-[#635F69]/20 shadow-xs'
      } ${className}`}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formattedTime}`}
    >
      {isLowTime ? (
        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
      ) : (
        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#7C3AED] shrink-0" />
      )}
      <span className="tabular-nums tracking-wider">{formattedTime}</span>
    </div>
  );
};
