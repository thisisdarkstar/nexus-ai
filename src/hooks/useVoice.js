import { useState, useCallback, useRef, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function pickBestVoice(voices) {
  const en = voices.filter(v => v.lang.startsWith('en'));
  if (!en.length) return voices[0] || null;

  // 1. Microsoft Neural / Natural voices (Windows — best quality)
  const msNatural = en.find(v => /natural/i.test(v.name));
  if (msNatural) return msNatural;

  // 2. Google voices (Chrome on any OS)
  const google = en.find(v => /google/i.test(v.name) && v.lang === 'en-US');
  if (google) return google;

  // 3. macOS Enhanced / Premium voices
  const enhanced = en.find(v => /(enhanced|premium)/i.test(v.name));
  if (enhanced) return enhanced;

  // 4. Any other Microsoft Online voice
  const msOnline = en.find(v => /microsoft.*online/i.test(v.name));
  if (msOnline) return msOnline;

  // 5. Known good macOS voices
  const macGood = en.find(v => /\b(samantha|ava|alex|karen|moira)\b/i.test(v.name));
  if (macGood) return macGood;

  // 6. en-US fallback, then any English
  return en.find(v => v.lang === 'en-US') || en[0];
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(!!SpeechRecognition);
  const [availableVoices, setAvailableVoices] = useState([]);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const interimTranscriptRef = useRef('');
  const isManualStopRef = useRef(false);
  const restartTimerRef = useRef(null);
  const onTranscriptRef = useRef(null);
  const preferredVoiceNameRef = useRef('');

  const setPreferredVoice = useCallback((name) => {
    preferredVoiceNameRef.current = name || '';
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

  const startListening = useCallback((onTranscript = null) => {
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    onTranscriptRef.current = onTranscript;
    isManualStopRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }

    const recognition = new SpeechRecognition();
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

    recognition.onresult = (event) => {
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
        setTranscript(prev => prev + ' ' + finalTranscript);
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

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      // Auto-restart on certain errors (not manual stop)
      if (!isManualStopRef.current && 
          event.error !== 'not-allowed' && 
          event.error !== 'aborted') {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
          if (!isManualStopRef.current && onTranscriptRef.current) {
            startListening(onTranscriptRef.current);
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      // Only set to false if it was a manual stop, otherwise auto-restart
      if (!isManualStopRef.current) {
        setIsListening(false);
        // Auto-restart after a short delay
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
          if (!isManualStopRef.current && onTranscriptRef.current) {
            startListening(onTranscriptRef.current);
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
  }, []);

  const stopListening = useCallback(() => {
    isManualStopRef.current = true;
    
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    interimTranscriptRef.current = '';
  }, []);

  const speak = useCallback((text, onEnd = null) => {
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
      ? voices.find(v => v.name === preferredVoiceNameRef.current)
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

    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      if (onEnd) onEnd();
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentUtteranceRef.current) {
      // Null out handlers before cancel so the browser-triggered onend/onerror
      // don't fire stale callbacks (e.g. closing the overlay for the next utterance).
      currentUtteranceRef.current.onend = null;
      currentUtteranceRef.current.onerror = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
  }, []);

  const toggleListening = useCallback((onTranscript) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(onTranscript);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    isSupported,
    availableVoices,
    setPreferredVoice,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleListening,
    isVoiceActive: isListening || isSpeaking
  };
}

export function useVoiceState() {
  const [voiceState, setVoiceState] = useState({
    isInteractiveMode: false,
    isListening: false,
    isSpeaking: false,
    currentText: '',
    type: null
  });

  return [voiceState, setVoiceState];
}