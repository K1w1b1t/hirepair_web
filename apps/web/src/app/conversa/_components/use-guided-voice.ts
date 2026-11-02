'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { recognitionConstructor, type Recognition } from './voice-text-field';
export type VoiceStatus = 'idle' | 'speaking' | 'listening' | 'preview' | 'unsupported';
export function useGuidedVoice(
  question: string,
  onText: (value: string) => void,
  onSend: (value: string) => void,
) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [notice, setNotice] = useState('');
  const active = useRef<Recognition | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const preview = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onText, onSend, question });
  latest.current = { onText, onSend, question };
  const alive = useRef(true),
    automatic = useRef(false),
    narrated = useRef(false),
    generation = useRef(0);
  const narrationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const text = useRef('');
  const stop = useCallback(() => {
    clearTimeout(silence.current);
    clearTimeout(preview.current);
    clearTimeout(narrationTimer.current);
    const previous = active.current;
    active.current = null;
    if (previous) {
      previous.onend = null;
      previous.onresult = null;
      previous.onerror = null;
      try {
        previous.abort();
      } catch {
        /* already stopped */
      }
    }
  }, []);
  const pause = useCallback(() => {
    automatic.current = false;
    generation.current++;
    stop();
    window.speechSynthesis?.cancel();
    if (alive.current) setStatus('idle');
  }, [stop]);
  const listen = useCallback(() => {
    stop();
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setStatus('unsupported');
      setNotice('Você pode continuar escrevendo.');
      return;
    }
    const prefix = text.current;
    let recognition: Recognition;
    try {
      recognition = new Constructor();
    } catch {
      setStatus('idle');
      setNotice('O microfone não iniciou. Você pode escrever.');
      return;
    }
    active.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    const segments: string[] = [];
    recognition.onstart = () => {
      if (active.current === recognition) {
        setNotice('');
        setStatus('listening');
      }
    };
    recognition.onresult = (event) => {
      if (active.current !== recognition) return;
      clearTimeout(silence.current);
      clearTimeout(preview.current);
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal) segments[i] = event.results[i][0].transcript.trim();
      text.current = [prefix, ...segments.filter(Boolean)].filter(Boolean).join(' ');
      latest.current.onText(text.current);
      if (!text.current.trim()) return;
      silence.current = setTimeout(() => {
        if (active.current !== recognition) return;
        stop();
        setStatus('preview');
        preview.current = setTimeout(() => {
          if (alive.current && text.current.trim()) {
            const answer = text.current;
            text.current = '';
            setStatus('idle');
            latest.current.onSend(answer);
          }
        }, 2000);
      }, 3000);
    };
    recognition.onerror = () => {
      if (active.current === recognition) {
        stop();
        automatic.current = false;
        setStatus('idle');
        setNotice('Não foi possível ouvir sua resposta. Tente falar novamente ou escreva.');
      }
    };
    recognition.onend = () => {
      if (active.current === recognition && !text.current.trim()) {
        stop();
        setStatus('idle');
        setNotice('Não ouvimos uma resposta. Você pode falar ou escrever.');
      }
    };
    try {
      setStatus('listening');
      recognition.start();
    } catch {
      stop();
      setStatus('idle');
      setNotice('O microfone não iniciou. Você pode escrever.');
    }
  }, [stop]);
  const speak = useCallback(
    (thenListen: boolean) => {
      const token = ++generation.current;
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        narrated.current = true;
        if (thenListen) listen();
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(latest.current.question);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95;
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('pt'));
      if (voice) utterance.voice = voice;
      setStatus('speaking');
      utterance.onend = () => {
        if (!alive.current || generation.current !== token) return;
        clearTimeout(narrationTimer.current);
        narrated.current = true;
        setStatus('idle');
        if (thenListen) listen();
      };
      utterance.onerror = () => {
        if (!alive.current || generation.current !== token) return;
        setStatus('idle');
        clearTimeout(narrationTimer.current);
        setNotice('Toque no microfone para ouvir e responder, ou escreva.');
      };
      narrationTimer.current = setTimeout(() => {
        if (generation.current !== token || !alive.current) return;
        synth.cancel();
        setStatus('idle');
        setNotice('A leitura em voz não iniciou. Toque para tentar novamente ou escreva.');
      }, 20000);
      try {
        synth.speak(utterance);
      } catch {
        clearTimeout(narrationTimer.current);
        setStatus('idle');
      }
    },
    [listen],
  );
  const microphone = useCallback(() => {
    if (status === 'listening') {
      pause();
      return;
    }
    automatic.current = true;
    if (!narrated.current) speak(true);
    else listen();
  }, [status, pause, speak, listen]);
  useEffect(() => {
    alive.current = true;
    stop();
    text.current = '';
    narrated.current = false;
    if (question) speak(automatic.current);
    const generationRef = generation;
    return () => {
      generationRef.current++;
      stop();
      window.speechSynthesis?.cancel();
    };
  }, [question, speak, stop]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  return {
    status,
    notice,
    microphone,
    pause,
    replaceDraft: (value: string) => {
      text.current = value;
    },
  };
}
