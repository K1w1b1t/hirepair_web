'use client';

import { useEffect, useState } from 'react';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
}

interface CountdownProps {
  deadline: string;
  initialNow: number;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function getCountdownParts(deadline: string, now: number): CountdownParts {
  const remaining = Math.max(0, Date.parse(deadline) - now);

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    finished: remaining === 0,
  };
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function Countdown({ deadline, initialNow }: CountdownProps) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), SECOND);
    return () => window.clearInterval(interval);
  }, []);

  const countdown = getCountdownParts(deadline, now);
  const units = [
    { label: 'dias', value: countdown.days },
    { label: 'horas', value: countdown.hours },
    { label: 'minutos', value: countdown.minutes },
    { label: 'segundos', value: countdown.seconds },
  ];

  return (
    <div
      aria-label="Contagem regressiva para o lançamento"
      aria-live="off"
      className="grid grid-cols-4 gap-2 sm:gap-4"
      role="timer"
    >
      {units.map((unit) => (
        <div
          className="rounded-2xl border border-white/15 bg-white/10 px-2 py-4 text-center backdrop-blur-sm sm:px-5"
          key={unit.label}
        >
          <span
            className="block font-[family-name:var(--font-heading)] text-2xl font-extrabold tabular-nums text-white sm:text-4xl"
            data-unit={unit.label}
          >
            {twoDigits(unit.value)}
          </span>
          <span className="mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/70 sm:text-xs">
            {unit.label}
          </span>
        </div>
      ))}
      <span className="sr-only">
        {countdown.finished ? 'O lançamento chegou.' : 'Lançamento em 31 de outubro de 2026.'}
      </span>
    </div>
  );
}
