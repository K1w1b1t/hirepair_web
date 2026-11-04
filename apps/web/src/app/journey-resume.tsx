'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { readProgress } from './conversa/_lib/journey-progress';
export function JourneyResume() {
  const pathname = usePathname(),
    [error, setError] = useState('');
  useEffect(() => {
    if (pathname !== '/') return;
    let live = true;
    const navigation = performance.getEntriesByType?.('navigation')?.[0] as
      PerformanceNavigationTiming | undefined;
    const resume = (fromHistory: boolean) => {
      void readProgress()
        .then((progress) => {
          if (live && progress) {
            const exiting =
              fromHistory || sessionStorage.getItem('hirepair_home_exit_intent') === '1';
            sessionStorage.removeItem('hirepair_home_exit_intent');
            window.location.replace(`/conversa?etapa=${progress.phase}${exiting ? '&sair=1' : ''}`);
          }
        })
        .catch(() => {
          if (live) setError('Não foi possível verificar seu progresso salvo neste navegador.');
        });
    };
    resume(navigation?.type === 'back_forward');
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) resume(true);
    };
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pageshow', show);
      live = false;
    };
  }, [pathname]);
  return error ? <p role="alert">{error}</p> : null;
}
