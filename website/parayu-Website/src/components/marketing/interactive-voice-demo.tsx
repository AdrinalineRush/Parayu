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
  Volume2,
  Brain,
  Settings,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MANGLISH_INPUT = "Innalathe meetingil njan paranja karyangal ormayundo? Athil chila changes undu. Project timeline kurachude lag aavan chance undu...";
const TRANSLATED_OUTPUT = "Hey, do you remember what I said in yesterday's sync? There are a few changes. The timeline might get delayed a bit...";

type AppType = "parayu" | "notion" | "slack" | "vscode" | "gmail";

export function InteractiveVoiceDemo({ className }: { className?: string }) {
  const [activeApp, setActiveApp] = useState<AppType>("parayu");
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
          { id: "parayu", label: "Parayu macOS", icon: <Brain className="w-3.5 h-3.5 text-[#e01e41]" /> },
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
            <span className="text-[10px] text-muted-foreground font-mono tracking-tight font-semibold">
              {activeApp === "parayu" && "Parayu Desktop App - Dashboard"}
              {activeApp === "notion" && "Notion - 📄 meeting_notes.md"}
              {activeApp === "slack" && "Slack Workspace - #project-updates"}
              {activeApp === "vscode" && "VS Code - app.js"}
              {activeApp === "gmail" && "Gmail - Compose Email"}
            </span>
            <div className="w-10" />
          </div>

          {/* Focused App window body content */}
          <div className="flex-grow p-5 overflow-y-auto flex flex-col bg-background">
            
            {/* Parayu UI */}
            {activeApp === "parayu" && (
              <div className="flex-grow flex -mx-5 -my-5 h-full bg-[#fcfbfa] dark:bg-zinc-950 font-sans text-xs select-none">
                
                {/* Left Sidebar */}
                <div className="w-[155px] bg-[#f6f4f0] dark:bg-zinc-900 border-r border-[#e8e5df] dark:border-zinc-800 p-3.5 flex flex-col justify-between shrink-0">
                  <div className="space-y-4">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm">
                        <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain" />
                      </div>
                      <span className="font-heading font-extrabold text-[15px] tracking-tight text-[#1c1b19] dark:text-white">Parayu</span>
                    </div>

                    {/* Nav Items */}
                    <div className="space-y-1 relative">
                      {/* Active item dashboard */}
                      <div className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-[#e01e41]/5 text-[#e01e41] font-bold text-[11px] cursor-default before:content-[''] before:absolute before:left-[6px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:height-[16px] before:rounded-full before:bg-gradient-to-b before:from-[#e81f3a] before:to-[#a02bb0]">
                        <Brain className="w-4.5 h-4.5" />
                        <span>Home</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-semibold text-[11px] hover:bg-zinc-150/40 cursor-pointer transition-all">
                        <FileText className="w-4.5 h-4.5" />
                        <span>Parayu History</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-semibold text-[11px] hover:bg-zinc-150/40 cursor-pointer transition-all">
                        <Volume2 className="w-4.5 h-4.5" />
                        <span>Dictionary</span>
                      </div>

                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-semibold text-[11px] hover:bg-zinc-150/40 cursor-pointer transition-all">
                        <Keyboard className="w-4.5 h-4.5" />
                        <span>Snippets</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-semibold text-[11px] hover:bg-zinc-150/40 cursor-pointer transition-all">
                        <FileText className="w-4.5 h-4.5" />
                        <span>Pro Writing</span>
                        <span className="ml-auto text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">PRO</span>
                      </div>

                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-semibold text-[11px] hover:bg-zinc-150/40 cursor-pointer transition-all">
                        <Settings className="w-4.5 h-4.5" />
                        <span>Settings</span>
                      </div>
                    </div>
                  </div>

                  {/* Sign In Pro Card */}
                  <div className="bg-white dark:bg-zinc-850 border border-[#e8e5df] dark:border-zinc-800 rounded-xl p-2.5 shadow-sm flex flex-col gap-1.5 shrink-0 my-3">
                    <div className="w-6 h-6 rounded-lg bg-[#e01e41]/10 text-[#e01e41] flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[10px] font-bold text-[#1c1b19] dark:text-white mt-1 leading-none">Sign in to Parayu</div>
                    <div className="text-[8px] text-[#706b61] dark:text-zinc-500 leading-tight">Access your account and saved settings.</div>
                    <button className="w-full py-1.5 border border-[#e8e5df] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#e01e41] hover:bg-[#e01e41]/5 rounded-lg text-[9px] font-bold transition-all">Sign In</button>
                  </div>
                  
                  {/* Account state */}
                  <div className="flex flex-col gap-1 border-t border-[#e8e5df] dark:border-zinc-800 pt-2 shrink-0">
                    <div className="flex items-center gap-2 text-[10px]">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#e81f3a] to-[#ff9b3d] text-white flex items-center justify-center font-bold shadow-sm">U</div>
                      <div className="min-w-0 leading-tight">
                        <div className="font-bold text-[#1c1b19] dark:text-zinc-350 truncate">Guest User</div>
                        <div className="text-[9px] text-[#706b61] dark:text-zinc-500 font-medium">Free</div>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#706b61] dark:text-zinc-500 pl-1 mt-1">Parayu v1.0.0</span>
                  </div>
                </div>

                {/* Right Content Area simulating Parayu main panel */}
                <div className="flex-grow p-4 overflow-y-auto space-y-4 flex flex-col justify-start bg-[#fcfbfa] dark:bg-zinc-950 select-none">
                  {/* Title Bar inside the app */}
                  <div className="flex justify-between items-start shrink-0">
                    <div>
                      <h3 className="text-sm font-heading font-black text-[#1c1b19] dark:text-white leading-tight">
                        Good morning, Adarsh <span className="inline-block animate-bounce">👋</span>
                      </h3>
                      <p className="text-[9px] text-[#706b61] dark:text-zinc-400 font-medium">Here&apos;s your dictation overview</p>
                    </div>
                    {/* Active Brain Badge */}
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>PRO Brain Active</span>
                    </div>
                  </div>

                  {/* KPI Row (4 pills) */}
                  <div className="grid grid-cols-4 gap-2 shrink-0">
                    {/* Pill 1: Words */}
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 rounded-xl shadow-sm">
                      <div className="w-7 h-7 rounded-lg bg-[#e01e41]/10 text-[#e01e41] flex items-center justify-center shrink-0">
                        <Mic className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-[11px] font-black text-[#1c1b19] dark:text-white">
                          {step === "completed" ? "14,844" : "14,820"}
                        </div>
                        <div className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Words</div>
                      </div>
                    </div>
                    {/* Pill 2: WPM */}
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 rounded-xl shadow-sm">
                      <div className="w-7 h-7 rounded-lg bg-[#a02bb0]/10 text-[#a02bb0] flex items-center justify-center shrink-0">
                        <Cpu className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-[11px] font-black text-[#1c1b19] dark:text-white">87</div>
                        <div className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">WPM</div>
                      </div>
                    </div>
                    {/* Pill 3: Fixes */}
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 rounded-xl shadow-sm">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-[11px] font-black text-[#1c1b19] dark:text-white">324</div>
                        <div className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Fixes</div>
                      </div>
                    </div>
                    {/* Pill 4: Model */}
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 rounded-xl shadow-sm">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-[11px] font-black text-emerald-600">Ready</div>
                        <div className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Model</div>
                      </div>
                    </div>
                  </div>

                  {/* Grid Content: Speed, Integrations, Heatmap */}
                  <div className="grid grid-cols-5 gap-3 flex-grow min-h-0">
                    
                    {/* WPM Gauge Card */}
                    <div className="col-span-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl flex flex-col justify-between h-[115px]">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Typing Speed</span>
                        <span className="text-[#e01e41]"><Cpu className="w-3 h-3" /></span>
                      </div>
                      
                      {/* Semicircular Gauge SVG */}
                      <div className="relative w-full flex justify-center mt-1">
                        <svg viewBox="0 0 170 96" className="w-[100px] h-[55px]">
                          <path
                            d="M 15 85 A 70 70 0 0 1 155 85"
                            fill="none"
                            stroke="#ebe7df"
                            strokeWidth="12"
                            strokeLinecap="round"
                          />
                          {/* Fill sweep: calculated for 87 WPM (87/160 = 54% of sweep) */}
                          <path
                            d="M 15 85 A 70 70 0 0 1 93 16"
                            fill="none"
                            stroke="url(#gaugeGrad)"
                            strokeWidth="12"
                            strokeLinecap="round"
                          />
                          <defs>
                            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#e81f3a" />
                              <stop offset="60%" stopColor="#d81d54" />
                              <stop offset="100%" stopColor="#a02bb0" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1.5">
                          <span className="text-xs font-heading font-black leading-none text-[#1c1b19] dark:text-white">87</span>
                          <span className="text-[7px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">wpm</span>
                        </div>
                      </div>

                      <div className="flex justify-between text-[7px] font-bold text-[#706b61] dark:text-zinc-500 border-t border-[#e8e5df] dark:border-zinc-800 pt-1">
                        <span>Target 120 wpm</span>
                        <span className="text-[#e01e41]">33 to goal</span>
                      </div>
                    </div>

                    {/* App Integration Bar Chart Card */}
                    <div className="col-span-3 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl flex flex-col justify-between h-[115px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Desktop Integration</span>
                        <span className="text-[7px] font-bold text-[#706b61]">Apps | 3</span>
                      </div>
                      <div className="space-y-1.5 flex-grow flex flex-col justify-center">
                        {[
                          { label: "Slack", pct: "45%", w: "w-[45%]", color: "bg-[#e01e41]", initial: "S" },
                          { label: "VS Code", pct: "30%", w: "w-[30%]", color: "bg-[#7c5cff]", initial: "V" },
                          { label: "Chrome", pct: "15%", w: "w-[15%]", color: "bg-emerald-500", initial: "C" },
                        ].map((item) => (
                          <div key={item.label} className="space-y-0.5">
                            <div className="flex justify-between items-center text-[8px] font-bold text-zinc-650 dark:text-zinc-400">
                              <div className="flex items-center gap-1">
                                <span className={cn("w-3.5 h-3.5 rounded-md flex items-center justify-center text-[6px] text-white font-bold", item.color)}>
                                  {item.initial}
                                </span>
                                <span>{item.label}</span>
                              </div>
                              <span>{item.pct}</span>
                            </div>
                            <div className="w-full bg-[#f6f4f0] dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", item.color, item.w)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Heatmap Row & Quick Note Panel */}
                  <div className="grid grid-cols-5 gap-3 shrink-0">
                    {/* Heatmap Grid Calendar */}
                    <div className="col-span-3 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl flex flex-col justify-between h-[85px]">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-[#e01e41] fill-[#e01e41]" />
                          <span>12 day streak</span>
                        </span>
                        <span className="text-[7px] font-bold text-[#706b61]">Longest | 18 days</span>
                      </div>
                      
                      {/* Small mock contribution heatmap calendar grid */}
                      <div className="flex justify-center my-1.5 overflow-hidden">
                        <div className="grid grid-cols-14 gap-[3px]">
                          {Array.from({ length: 70 }).map((_, idx) => {
                            // Assign mock intensity level (0 to 4)
                            let lvl = 0;
                            if (idx > 50) {
                              lvl = [0, 1, 2, 4, 3, 2, 4, 3, 1, 4, 2, 0, 4, 3, 4, 2, 1, 4, 4][idx % 19];
                            } else if (idx > 20) {
                              lvl = [0, 1, 0, 2, 0, 1, 3, 0, 2, 0, 1, 0][idx % 12];
                            }
                            
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "w-[6px] h-[6px] rounded-[1px]",
                                  lvl === 0 && "bg-[#ebe7df] dark:bg-zinc-800",
                                  lvl === 1 && "bg-[#e01e41]/20",
                                  lvl === 2 && "bg-[#e01e41]/40",
                                  lvl === 3 && "bg-[#e01e41]/75",
                                  lvl === 4 && "bg-[#e01e41]"
                                )}
                              />
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-[6px] font-bold text-[#706b61] uppercase tracking-wide">
                        <span>Less</span>
                        <div className="flex gap-[3px] items-center">
                          <div className="w-[5px] h-[5px] rounded-[1px] bg-[#ebe7df] dark:bg-zinc-800" />
                          <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e01e41]/20" />
                          <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e01e41]/40" />
                          <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e01e41]/75" />
                          <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e01e41]" />
                        </div>
                        <span>More</span>
                      </div>
                    </div>

                    {/* Quick Dictation Panel */}
                    <div className="col-span-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl flex flex-col justify-between h-[85px] relative overflow-hidden">
                      <div className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Quick Dictation Note</div>
                      <div className="text-[9px] text-[#1c1b19] dark:text-zinc-200 leading-normal pr-0.5 py-0.5 flex-grow overflow-y-auto font-medium">
                        {typedText ? (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{typedText}</motion.span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 italic">Dictated text will type here...</span>
                        )}
                        {step !== "completed" && step !== "idle" && (
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block w-1 h-3 ml-0.5 bg-primary"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

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
