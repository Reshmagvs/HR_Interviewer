import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ResumeAnalysis } from '../types';
import { Mic, MicOff, PhoneOff, Clock, User, Cpu, Play, AlertCircle, RefreshCw } from 'lucide-react';
import { float32ArrayToBase64, decodeAudioData } from '../utils/audio';

interface InterviewSessionProps {
  analysis: ResumeAnalysis;
  duration: number;
  onComplete: (transcript: string) => void;
}

export default function InterviewSession({ analysis, duration, onComplete }: InterviewSessionProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isMicOn, setIsMicOn] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: 'user' | 'model', text: string}[]>([]);
  
  // Refs for audio handling and cleanup
  const aiRef = useRef<GoogleGenAI | null>(null);
  const activeSessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const transcriptTextRef = useRef<string>('');
  const isConnectedRef = useRef<boolean>(false);
  const connectionIdRef = useRef<string>('');
  const isMicOnRef = useRef<boolean>(true);
  const isEndedRef = useRef<boolean>(false);
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = useRef<number>(0);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const pulseBgRef = useRef<HTMLDivElement>(null);

  // Sync mic state
  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  const cleanupAudio = async () => {
    connectionIdRef.current = ''; // Invalidate current session
    
    // 1. Close Live API Session
    if (activeSessionRef.current) {
      const session = activeSessionRef.current;
      activeSessionRef.current = null;
      try {
        await session.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
    }
    
    isConnectedRef.current = false;
    sessionPromiseRef.current = null;

    // 2. Stop Media Stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // 3. Close Audio Contexts safely
    if (inputAudioContextRef.current) {
      const ctx = inputAudioContextRef.current;
      inputAudioContextRef.current = null;
      try { if (ctx.state !== 'closed') await ctx.close(); } catch (e) {}
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      try { if (ctx.state !== 'closed') await ctx.close(); } catch (e) {}
    }

    // 4. Disconnect Nodes
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;

    // 5. Stop Animation
    if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = 0;
    }
  };

  const startSession = async () => {
    setError(null);
    setStatus('Initializing...');
    await cleanupAudio();
    
    const currentConnectionId = Date.now().toString();
    connectionIdRef.current = currentConnectionId;
    isEndedRef.current = false;
    
    // Reset state
    isConnectedRef.current = false;
    nextStartTimeRef.current = 0;
    transcriptTextRef.current = '';
    setTranscript([]);
    setIsConnected(false);
    setTimeLeft(duration * 60); // Reset timer

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser not supported. Please use Chrome/Edge.");
      }

      setStatus('Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });

      if (connectionIdRef.current !== currentConnectionId) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;

      // --- Setup Audio Output ---
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      // Ensure context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const outputAnalyser = audioContextRef.current.createAnalyser();
      outputAnalyser.fftSize = 64;
      outputAnalyser.smoothingTimeConstant = 0.5;
      outputAnalyser.connect(audioContextRef.current.destination);
      outputAnalyserRef.current = outputAnalyser;

      // --- Setup Audio Input ---
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 }); // Try 16k
      const inputCtx = inputAudioContextRef.current;
      
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      
      const inputSampleRate = inputCtx.sampleRate;
      sourceRef.current = inputCtx.createMediaStreamSource(stream);
      
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 64;
      sourceRef.current.connect(analyser);
      analyserRef.current = analyser;

      processorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
      
      // Audio Processing Loop
      processorRef.current.onaudioprocess = (e) => {
        if (connectionIdRef.current !== currentConnectionId || !isConnectedRef.current || !isMicOnRef.current) return;
        if (!activeSessionRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample to 16kHz if needed
        let processingData = inputData;
        if (inputSampleRate > 16000) {
          const ratio = inputSampleRate / 16000;
          const newLength = Math.floor(inputData.length / ratio);
          const downsampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            downsampled[i] = inputData[Math.floor(i * ratio)];
          }
          processingData = downsampled;
        }

        const base64Data = float32ArrayToBase64(processingData);
        
        try {
          activeSessionRef.current.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        } catch (err) {
          // Silent catch for safe transmission
        }
      };

      // Mute local feedback
      gainRef.current = inputCtx.createGain();
      gainRef.current.gain.value = 0;
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(gainRef.current);
      gainRef.current.connect(inputCtx.destination);

      // --- Connect to Gemini ---
      setStatus('Connecting to AI...');
      setHasStarted(true);
      startVisualizer();

      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            You are Sarah, a professional HR Interviewer.
            Conduct a ${duration}-minute interview for a candidate with:
            Skills: ${analysis.skills.join(', ')}
            Experience: ${analysis.experienceSummary}
            
            RULES:
            1. Speak immediately. Say "Hello, I'm Sarah. Welcome to your interview."
            2. Speak ONLY in English. Do not switch languages.
            3. Ask one question at a time.
            4. Keep responses short (under 20s).
            5. If the user stops speaking, wait briefly then ask the next question.
          `,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (connectionIdRef.current === currentConnectionId) {
              console.log("Connected");
              isConnectedRef.current = true;
              setIsConnected(true);
              setStatus('Interview in Progress');
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (connectionIdRef.current !== currentConnectionId) return;
            
            try {
              // Audio Output
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && audioContextRef.current && outputAnalyserRef.current) {
                const ctx = audioContextRef.current;
                const buffer = await decodeAudioData(audioData, ctx, 24000);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputAnalyserRef.current);
                const now = ctx.currentTime;
                const startTime = Math.max(now, nextStartTimeRef.current);
                source.start(startTime);
                nextStartTimeRef.current = startTime + buffer.duration;
              }

              // Transcriptions
              const inputTrans = message.serverContent?.inputTranscription?.text;
              if (inputTrans) {
                transcriptTextRef.current += inputTrans;
                setTranscript(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'user') {
                    return [...prev.slice(0, -1), { ...last, text: last.text + inputTrans }];
                  }
                  return [...prev, { role: 'user', text: inputTrans }];
                });
              }

              const outputTrans = message.serverContent?.outputTranscription?.text;
              if (outputTrans) {
                transcriptTextRef.current += outputTrans;
                setTranscript(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'model') {
                    return [...prev.slice(0, -1), { ...last, text: last.text + outputTrans }];
                  }
                  return [...prev, { role: 'model', text: outputTrans }];
                });
              }
            } catch (e) {
              console.error("Error processing message:", e);
            }
          },
          onclose: () => {
            if (connectionIdRef.current === currentConnectionId) {
              console.log("Session closed");
              isConnectedRef.current = false;
              setIsConnected(false);
            }
          },
          onerror: (err: any) => {
            if (connectionIdRef.current === currentConnectionId) {
              console.error("Session Error", err);
              // Do not immediately kill the UI if it's a minor error, but for fatal errors we must stop.
              // We'll mark as disconnected but let user retry or end.
              isConnectedRef.current = false;
              setIsConnected(false);
              setError("Connection interrupted. Please try restarting.");
            }
          }
        }
      };

      if (aiRef.current) {
        const session = await aiRef.current.live.connect(config);
        if (connectionIdRef.current === currentConnectionId) {
          activeSessionRef.current = session;
        } else {
          session.close();
        }
      }

    } catch (err: any) {
      console.error("Init Error:", err);
      if (connectionIdRef.current === currentConnectionId) {
        setHasStarted(false);
        setError("Failed to start session. " + (err.message || ""));
        cleanupAudio();
      }
    }
  };

  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 400 * dpr;
    ctx.scale(dpr, dpr);
    
    const bufferLength = 32; 
    const micDataArray = new Uint8Array(bufferLength);
    const aiDataArray = new Uint8Array(bufferLength);
    
    const render = () => {
      visualizerFrameRef.current = requestAnimationFrame(render);
      if (!ctx) return;

      let micVol = 0;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(micDataArray);
        micVol = micDataArray.reduce((a, b) => a + b, 0) / bufferLength;
      }
      
      let aiVol = 0;
      if (outputAnalyserRef.current) {
        outputAnalyserRef.current.getByteFrequencyData(aiDataArray);
        aiVol = aiDataArray.reduce((a, b) => a + b, 0) / bufferLength;
      }

      const isAiSpeaking = aiVol > 10 && aiVol > (micVol * 0.8);
      const activeData = isAiSpeaking ? aiDataArray : micDataArray;
      const activeVol = isAiSpeaking ? aiVol : micVol;
      const normalizeVol = activeVol / 255;
      
      // Animations
      if (pulseRingRef.current) {
        pulseRingRef.current.style.transform = `scale(${1 + normalizeVol * 0.5})`;
        pulseRingRef.current.style.opacity = `${0.3 + normalizeVol * 0.7}`;
        pulseRingRef.current.style.borderColor = isAiSpeaking ? '#c084fc' : '#e0e7ff';
      }
      if (pulseBgRef.current) {
        pulseBgRef.current.style.transform = `scale(${1 + normalizeVol * 0.2})`;
        pulseBgRef.current.style.borderColor = isAiSpeaking ? '#d8b4fe' : '#c7d2fe';
      }

      // Draw
      ctx.clearRect(0, 0, 400, 400); 
      ctx.save();
      ctx.translate(200, 200);
      const bars = 40; 
      const step = (Math.PI * 2) / bars;
      
      for (let i = 0; i < bars; i++) {
        const val = activeData[Math.floor((i / bars) * bufferLength)];
        const h = (val / 255) * 60; 
        ctx.rotate(step);
        if (val > 10) {
          ctx.fillStyle = isAiSpeaking 
            ? `rgba(192, 132, 252, ${val / 255})` 
            : `rgba(99, 102, 241, ${val / 255})`;
          ctx.beginPath();
          ctx.roundRect(-2, 100, 4, h, 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };
    
    render();
  };

  const handleEndInterview = async () => {
    if (isEndedRef.current) return;
    isEndedRef.current = true;
    
    setStatus('Finalizing...');
    await cleanupAudio();
    setIsConnected(false);
    
    const finalTranscript = transcript.map(t => 
      `${t.role === 'user' ? 'Candidate' : 'Interviewer'}: ${t.text}`
    ).join('\n\n') || transcriptTextRef.current || "No transcript available.";

    // Slight delay for UX
    setTimeout(() => {
      onComplete(finalTranscript);
    }, 1000);
  };

  useEffect(() => {
    let interval: any;
    // Timer runs if we have started, even if connection dips briefly
    if (hasStarted && !isEndedRef.current) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { // Stop at 0 (or 1 to be safe then trigger)
            clearInterval(interval);
            handleEndInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasStarted]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!hasStarted) {
    return (
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center h-[500px] bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-6 animate-pulse">
            <Mic size={40} />
          </div>
          
          <h2 className="text-3xl font-bold text-slate-800">Ready for your Interview?</h2>
          
          <p className="text-slate-500">
            Please ensure you are in a quiet environment.
          </p>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-left">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-700 text-sm font-medium">{error}</p>
                <button 
                  onClick={() => { setError(null); startSession(); }}
                  className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-full transition-colors font-medium flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </div>
          )}
          
          {status && !error && (
             <p className="text-indigo-600 font-medium">{status}</p>
          )}

          <button 
            onClick={startSession}
            disabled={!!status && !error}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-3 mx-auto"
          >
            {status && !error ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Play size={24} fill="currentColor" />
            )}
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
             <span className="font-medium tracking-wide">{isConnected ? 'Live Interview' : 'Reconnecting...'}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
             <Clock size={16} className="text-slate-400" />
             <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="p-8 h-[500px] flex flex-col justify-between relative bg-gradient-to-b from-slate-50 to-white">
          
          <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
             <canvas 
               ref={canvasRef} 
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
               style={{ width: '400px', height: '400px' }}
             />
             <div 
               ref={pulseRingRef}
               className="absolute w-64 h-64 rounded-full border-4 border-indigo-100 transition-all duration-75 ease-out"
             ></div>
             <div 
               ref={pulseBgRef}
               className="absolute w-48 h-48 rounded-full bg-indigo-50 border-4 border-indigo-200 transition-all duration-75 ease-out flex items-center justify-center"
             >
                <div className="w-32 h-32 rounded-full bg-indigo-600 shadow-2xl flex items-center justify-center text-white relative overflow-hidden z-10">
                   <Cpu size={48} className="relative z-10" />
                </div>
             </div>
             
             <div className="mt-48 text-center z-10 relative">
               <h3 className="text-xl font-bold text-slate-800 mb-1">AI Interviewer</h3>
               <p className="text-slate-500 text-sm">
                 {isConnected ? "Listening & Analyzing..." : "Waiting for connection..."}
               </p>
             </div>
          </div>

          <div className="mt-6 h-40 overflow-y-auto bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 scroll-smooth shadow-inner z-10 relative">
             {transcript.length === 0 && <p className="text-center text-slate-400 text-sm italic">Conversation will appear here...</p>}
             {transcript.map((t, i) => (
               <div key={i} className={`flex gap-3 ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  {t.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0"><Cpu size={14} className="text-indigo-600"/></div>}
                  <div className={`p-3 rounded-lg text-sm max-w-[80%] ${t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
                    {t.text}
                  </div>
                  {t.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0"><User size={14} className="text-slate-600"/></div>}
               </div>
             ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 z-10 relative">
             <button 
               onClick={() => setIsMicOn(!isMicOn)}
               disabled={!isConnected}
               className={`p-4 rounded-full transition-all shadow-lg ${isMicOn ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200' : 'bg-red-50 text-red-500 border border-red-100'}`}
             >
               {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
             </button>

             <button 
               onClick={handleEndInterview}
               className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-red-200 transition-all flex items-center gap-2"
             >
               <PhoneOff size={20} />
               End Interview
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
