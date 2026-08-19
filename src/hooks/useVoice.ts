import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceHook } from '../types';

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.startsWith('en'));
  if (!en.length) return voices[0] || null;

  const msNatural = en.find((v) => /natural/i.test(v.name));
  if (msNatural) return msNatural;

  const google = en.find((v) => /google/i.test(v.name) && v.lang === 'en-US');
  if (google) return google;

  const enhanced = en.find((v) => /(enhanced|premium)/i.test(v.name));
  if (enhanced) return enhanced;

  const msOnline = en.find((v) => /microsoft.*online/i.test(v.name));
  if (msOnline) return msOnline;

  const macGood = en.find((v) => /\b(samantha|ava|alex|karen|moira)\b/i.test(v.name));
  if (macGood) return macGood;

  return en.find((v) => v.lang === 'en-US') || en[0] || null;
}

export function useVoice(): VoiceHook {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported] = useState(() => !!SpeechRecognitionAPI);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const interimTranscriptRef = useRef('');
  const isManualStopRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);
  const preferredVoiceNameRef = useRef('');

  const setPreferredVoice = useCallback((name: string) => {
    preferredVoiceNameRef.current = name || '';
  }, []);

  const startListeningInternal = useCallback(
    (onTranscript: ((text: string) => void) | null = null) => {
      if (!SpeechRecognitionAPI) {
        console.warn('Speech recognition not supported');
        return;
      }

      onTranscriptRef.current = onTranscript;
      isManualStopRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped
        }
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        setInterimTranscript('');
        interimTranscriptRef.current = '';
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + ' ' + finalTranscript);
          setInterimTranscript('');
          if (onTranscriptRef.current) {
            onTranscriptRef.current(finalTranscript);
          }
          interimTranscriptRef.current = '';
        } else if (interim) {
          setInterimTranscript(interim);
          interimTranscriptRef.current = interim;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);

        if (
          !isManualStopRef.current &&
          event.error !== 'not-allowed' &&
          event.error !== 'aborted'
        ) {
          if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
          }
          restartTimerRef.current = setTimeout(() => {
            if (!isManualStopRef.current && onTranscriptRef.current) {
              startListeningInternal(onTranscriptRef.current);
            }
          }, 500);
        }
      };

      recognition.onend = () => {
        if (!isManualStopRef.current) {
          setIsListening(false);
          if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
          }
          restartTimerRef.current = setTimeout(() => {
            if (!isManualStopRef.current && onTranscriptRef.current) {
              startListeningInternal(onTranscriptRef.current);
            }
          }, 300);
        }
      };

      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
      }
    },
    []
  );

  const stopListening = useCallback(() => {
    isManualStopRef.current = true;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    interimTranscriptRef.current = '';
  }, []);

  const speak = useCallback((text: string, onEnd: (() => void) | null = null) => {
    if (!synthRef.current) {
      console.warn('Speech synthesis not supported');
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synthRef.current.getVoices();
    const preferred = preferredVoiceNameRef.current
      ? voices.find((v) => v.name === preferredVoiceNameRef.current) || null
      : null;
    utterance.voice = preferred || pickBestVoice(voices);

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      if (onEnd) onEnd();
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current.onend = null;
      currentUtteranceRef.current.onerror = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      const load = () => {
        const voices = synthRef.current?.getVoices() || [];
        if (voices.length) setAvailableVoices(voices);
      };
      load();
      window.speechSynthesis.addEventListener('voiceschanged', load);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', load);
        stopListening();
        stopSpeaking();
      };
    }
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, []);

  const toggleListening = useCallback(
    (onTranscript?: (text: string) => void) => {
      if (isListening) {
        stopListening();
      } else {
        startListeningInternal(onTranscript || null);
      }
    },
    [isListening, startListeningInternal, stopListening]
  );

  return {
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    isSupported,
    availableVoices,
    setPreferredVoice,
    startListening: startListeningInternal,
    stopListening,
    speak,
    stopSpeaking,
    toggleListening,
    isVoiceActive: isListening || isSpeaking,
  };
}
