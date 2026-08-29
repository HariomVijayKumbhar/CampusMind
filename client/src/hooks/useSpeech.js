import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Voice input (speech-to-text) via the Web Speech API.
 * Returns { supported, listening, start, stop }.
 * onFinalTranscript is called with the accumulated transcript when speech ends.
 */
export function useSpeechInput(onFinalTranscript) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const callbackRef = useRef(onFinalTranscript);
  callbackRef.current = onFinalTranscript;

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    setSupported(true);

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      if (final) {
        finalRef.current += final;
        callbackRef.current?.(finalRef.current.trim());
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      try { recognition.abort(); } catch { }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    finalRef.current = '';
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { }
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}

/**
 * Text-to-speech playback via speechSynthesis.
 * Returns { ttsSupported, speaking, speak, stopSpeaking }.
 */
export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);

  const ttsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text) => {
      if (!ttsSupported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported]
  );

  const stopSpeaking = useCallback(() => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { ttsSupported, speaking, speak, stopSpeaking };
}
