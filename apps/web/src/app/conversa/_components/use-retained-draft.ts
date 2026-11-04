'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { readLocalDraft, saveLocalDraft } from '../_lib/journey-progress';
export function useRetainedDraft<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>, string] {
  const [value, setValue] = useState(initial),
    [error, setError] = useState('');
  const current = useRef(initial),
    changed = useRef(false);
  useEffect(() => {
    let live = true;
    void readLocalDraft<T>(key)
      .then((saved) => {
        if (live && !changed.current && saved !== null) {
          current.current = saved;
          setValue(saved);
        }
      })
      .catch(() => {
        if (live) setError('Não foi possível abrir o rascunho salvo.');
      });
    return () => {
      live = false;
    };
  }, [key]);
  const update: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      changed.current = true;
      const result = typeof next === 'function' ? (next as (v: T) => T)(current.current) : next;
      current.current = result;
      setValue(result);
      void saveLocalDraft(key, result).catch(() => setError('Não foi possível salvar o rascunho.'));
    },
    [key],
  );
  return [value, update, error];
}
