import { useState, useCallback, useRef, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(!!SpeechRecognition);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const interimTranscriptRef = useRef('');
  const isManualStopRef = useRef(false);
  const restartTimerRef = useRef(null);
  const onTranscriptRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
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
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-')) || voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

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