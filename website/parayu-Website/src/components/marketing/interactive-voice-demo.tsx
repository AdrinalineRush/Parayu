"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  Square, 
  Sparkles, 
  Check, 
  RefreshCw, 
  FileText, 
  Mail, 
  Code, 
  MessageSquare,
  Keyboard,
  Cpu,
  Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MANGLISH_INPUT = "Innalathe meetingil njan paranja karyangal ormayundo? Athil chila changes undu. Project timeline kurachude lag aavan chance undu...";
const TRANSLATED_OUTPUT = "Hey, do you remember what I said in yesterday's sync? There are a few changes. The timeline might get delayed a bit...";

type AppType = "notion" | "slack" | "vscode" | "gmail";

export function InteractiveVoiceDemo({ className }: { className?: string }) {
  const [activeApp, setActiveApp] = useState<AppType>("notion");
  const [step, setStep] = useState<"idle" | "recording" | "processing" | "completed">("idle");
  const [typedText, setTypedText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio file
  useEffect(() => {
    audioRef.current = new Audio("/dictation.m4a");
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
      }
    };
  }, []);

  const handleAudioEnd = () => {
    setStep("processing");
    
    // Simulate Whisper.cpp processing locally
    setTimeout(() => {
      setTypedText(TRANSLATED_OUTPUT);
      setStep("completed");
      toast.success("Keystroke injected: translated text pasted instantly!");
    }, 1200);
  };

  const handleStart = () => {
    setTypedText("");
    setStep("recording");
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => {
          audioRef.current!.onended = handleAudioEnd;
        })
        .catch((e) => {
          console.error("Audio playback error:", e);
          // Fallback if audio fails to play
          setTimeout(() => {
            handleAudioEnd();
          }, 4500);
        });
    } else {
      // Fallback if audio object not loaded
      setTimeout(() => {
        handleAudioEnd();
      }, 4500);
    }
  };

  const handleReset = () => {
    setTypedText("");
    setStep("idle");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className={cn("relative w-full max-w-4xl mx-auto flex flex-col select-none", className)}>
      
      {/* Target Focus Selection Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6 select-none z-10">
        <span className="text-xs font-bold text-muted-foreground mr-2">Select Active Focused App:</span>
        {[
          { id: "notion", label: "Notion", icon: <FileText className="w-3.5 h-3.5" /> },
          { id: "slack", label: "Slack", icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { id: "vscode", label: "VS Code", icon: <Code className="w-3.5 h-3.5" /> },
          { id: "gmail", label: "Gmail", icon: <Mail className="w-3.5 h-3.5" /> },
        ].map((app) => (
          <button
            key={app.id}
            disabled={step !== "idle" && step !== "completed"}
            onClick={() => setActiveApp(app.id as AppType)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm",
              activeApp === app.id 
                ? "bg-card border-primary text-primary font-black" 
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
            )}
          >
            {app.icon}
            <span>{app.label}</span>
          </button>
        ))}
      </div>

      {/* Mock Desktop Screen Workspace */}
      <div className="relative w-full rounded-t-3xl border border-border bg-gradient-to-br from-[#eae7e0] via-[#e2ded5] to-[#d8d3c7] dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 shadow-xl overflow-hidden flex flex-col h-[460px] p-6 justify-between animate-in fade-in duration-300">
        
        {/* Floating App Window (Simulating whatever app is currently focused) */}
        <div className="w-full max-w-2xl mx-auto bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col h-[280px]">
          
          {/* Focused App window topbar */}
          <div className="h-8 border-b border-border flex items-center justify-between px-3 bg-secondary shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>
            
            {/* Dynamic Window Title */}
            <span className="text-[10px] text-muted-foreground font-mono tracking-tight">
              {activeApp === "notion" && "Notion - 📄 meeting_notes.md"}
              {activeApp === "slack" && "Slack Workspace - #project-updates"}
              {activeApp === "vscode" && "VS Code - app.js"}
              {activeApp === "gmail" && "Gmail - Compose Email"}
            </span>
            <div className="w-10" />
          </div>

          {/* Focused App window body content */}
          <div className="flex-grow p-5 overflow-y-auto flex flex-col bg-background">
            
            {/* Notion UI */}
            {activeApp === "notion" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-xs font-semibold">
                  <span>Work</span> <span>/</span> <span className="text-zinc-600 dark:text-zinc-400 font-bold">Meeting Notes</span>
                </div>
                <h1 className="text-xl font-heading font-black text-foreground">✦ Project Timeline Sync</h1>
                <div className="text-sm text-foreground font-medium leading-relaxed min-h-[100px] border-l-2 border-border pl-4 py-1 relative">
                  {typedText ? (
                    <motion.span 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ duration: 0.2 }}
                    >
                      {typedText}
                    </motion.span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 italic">Click the trigger button below to listen to voice dictation input...</span>
                  )}
                  {step !== "completed" && step !== "idle" && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-block w-1.5 h-4 ml-0.5 bg-primary align-middle"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Slack UI */}
            {activeApp === "slack" && (
              <div className="flex-grow flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center font-bold text-[10px] text-muted-foreground">SR</div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-foreground text-xs">Sanjay Raj</span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">10:42 AM</span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 text-xs mt-0.5">Hey guys, any status updates on the meeting we had yesterday?</p>
                    </div>
                  </div>
                </div>

                <div className="relative mt-2">
                  <div className="w-full bg-card border border-border rounded-xl p-2.5 flex flex-col gap-1.5 shadow-sm">
                    <div className="text-foreground text-xs min-h-[30px] flex items-center">
                      {typedText ? (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{typedText}</motion.span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 italic">Reply to Sanjay...</span>
                      )}
                      {step !== "completed" && step !== "idle" && (
                        <motion.span
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                          className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-muted-foreground text-[9px]">
                      <span>Pasted globally via Keyboard Emulation</span>
                      <button className="text-primary font-bold">Send</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VS Code UI */}
            {activeApp === "vscode" && (
              <div className="flex-grow flex flex-col justify-between font-mono text-xs bg-[#1e1e1e] text-zinc-300 p-4 rounded-lg -mx-2 -my-2 h-full overflow-hidden border border-zinc-800 select-none">
                <div className="space-y-1">
                  <div className="text-zinc-500 text-[10px] border-b border-zinc-800 pb-1.5 mb-2">app.js</div>
                  <div className="flex gap-4">
                    <span className="text-zinc-600 select-none">1</span>
                    <span><span className="text-[#569cd6]">const</span> <span className="text-[#dcdcaa]">updateTimeline</span> = () =&gt; &#123;</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-600 select-none">2</span>
                    <span className="text-emerald-500">
                      {typedText ? (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>// {typedText}</motion.span>
                      ) : (
                        <span className="text-zinc-600 font-normal italic">// [Cursor position: speak comment...]</span>
                      )}
                      {step !== "completed" && step !== "idle" && (
                        <motion.span
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                          className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#569cd6]"
                        />
                      )}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-600 select-none">3</span>
                    <span>&#125;;</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gmail UI */}
            {activeApp === "gmail" && (
              <div className="flex-grow flex flex-col justify-between text-xs">
                <div className="space-y-2 border-b border-border pb-2">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-12 font-bold">To:</span>
                    <span className="text-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">sanjay@parayu.com</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-12 font-bold">Subject:</span>
                    <span className="text-foreground font-semibold">Updates regarding yesterday's sync</span>
                  </div>
                </div>

                <div className="flex-grow pt-3 text-foreground min-h-[70px] relative font-semibold leading-relaxed">
                  {typedText ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{typedText}</motion.span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 italic">Dear Sanjay, [speak email content...]</span>
                  )}
                  {step !== "completed" && step !== "idle" && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-block w-1.5 h-4 ml-0.5 bg-primary"
                    />
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Simulated Floating Parayu Overlay Window (Floating at the bottom of the desktop) */}
        <div className="relative flex justify-center pb-2 select-none">
          <AnimatePresence>
            {(step === "recording" || step === "processing") ? (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="z-40"
              >
                {/* Visual matching of Parayu's overlay.html pill */}
                <div className="flex items-center gap-3.5 h-[52px] px-5 rounded-[26px] bg-[#16161a]/95 backdrop-blur-[28px] border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]">
                  
                  {/* Waveform graphic */}
                  <div className="flex items-center gap-0.5 h-6">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const isListening = step === "recording";
                      const baseHeight = isListening ? [6, 12, 8, 16, 10, 14, 7, 11, 5][i % 9] : 4;
                      
                      return (
                        <motion.div
                          key={i}
                          className="w-[3px] rounded-full"
                          style={{
                            background: isListening
                              ? "linear-gradient(180deg, #ff9d4d, #ff6a3d)" // Orange/Red actual gradient
                              : "linear-gradient(180deg, #6fd0ff, #3d9bff)"  // Cyan/Blue transcribing gradient
                          }}
                          initial={{ height: 4 }}
                          animate={{
                            height: isListening 
                              ? [
                                  baseHeight, 
                                  Math.max(4, Math.random() * 22 + 4), 
                                  Math.max(4, Math.random() * 22 + 4), 
                                  baseHeight
                                ] 
                              : [4, 18, 18, 4]
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: isListening ? 1.0 : 1.1,
                            delay: i * 0.08,
                            ease: "easeInOut"
                          }}
                        />
                      );
                    })}
                  </div>

                  <span className="text-[13.5px] font-semibold text-white tracking-wide whitespace-nowrap flex items-center gap-1.5">
                    {step === "recording" ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                        <span>Listening</span>
                      </>
                    ) : (
                      "Transcribing..."
                    )}
                  </span>
                </div>
              </motion.div>
            ) : (
              /* Idle background watermark representing desktop notification */
              <div className="text-[10px] text-zinc-500 font-bold bg-card/40 dark:bg-zinc-950/40 backdrop-blur-md px-3 py-1 rounded-full border border-border shadow-sm flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-primary" />
                <span>Global overlay inactive (Press ⌥Space shortcut to trigger client)</span>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Controller Area */}
      <div className="p-6 bg-secondary border border-t-0 border-border rounded-b-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Caption detail */}
        <div className="text-sm text-muted-foreground text-center sm:text-left font-semibold flex-grow max-w-md">
          {step === "idle" && (
            <p className="leading-relaxed">Click the button to hear the Malayalam speech input: <span className="text-foreground block italic mt-1 font-normal">"Innalathe meetingil njan paranja karyangal ormayundo?..."</span></p>
          )}
          {step === "recording" && (
            <p className="text-orange-600 font-black flex items-center gap-1.5 justify-center sm:justify-start">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>Playing Malayalam voice recording...</span>
            </p>
          )}
          {step === "processing" && (
            <p className="text-sky-600 font-black flex items-center gap-1.5"><Cpu className="w-4 h-4 animate-spin" /> whisper.cpp transcribing locally on your device...</p>
          )}
          {step === "completed" && (
            <p className="text-emerald-600 font-black flex items-center gap-1.5 justify-center sm:justify-start">
              <Check className="w-4.5 h-4.5" /> 
              <span>Pasted instantly into focused application cursor!</span>
            </p>
          )}
        </div>

        {/* CTA Trigger Button */}
        <div className="shrink-0">
          {step === "idle" && (
            <button
              onClick={handleStart}
              className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all flex items-center gap-2 hover:scale-105 shadow-md shadow-primary/10 cursor-pointer"
            >
              <Mic className="w-5 h-5 animate-pulse" />
              <span>Simulate Voice Dictation</span>
            </button>
          )}

          {step === "recording" && (
            <button
              disabled
              className="h-12 px-6 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 font-bold flex items-center gap-2"
            >
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>Hearing Voice...</span>
            </button>
          )}

          {step === "processing" && (
            <button
              disabled
              className="h-12 px-6 rounded-xl bg-card border border-border text-zinc-500 font-bold flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
              <span>Transcribing...</span>
            </button>
          )}

          {step === "completed" && (
            <button
              onClick={handleReset}
              className="h-12 px-6 rounded-xl bg-card hover:bg-secondary border border-border text-foreground font-bold transition-all flex items-center gap-2 hover:scale-105 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Demo</span>
            </button>
          )}
        </div>
      </div>
      
    </div>
  );
}
