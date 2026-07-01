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
  Flame,
  Lock,
  Shield
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

      {/* Mock Screen Workspace */}
      <div className={cn(
        "relative w-full rounded-t-3xl border border-border shadow-xl overflow-hidden flex transition-all duration-300 animate-in fade-in h-[460px]",
        activeApp === "parayu"
          ? "bg-[#fcfbfa] dark:bg-zinc-950 flex-row p-0"
          : "bg-gradient-to-br from-[#eae7e0] via-[#e2ded5] to-[#d8d3c7] dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 flex-col p-6 justify-between"
      )}>
        
        {activeApp === "parayu" ? (
          /* ============================================================ */
          /*  FULL SCREEN PARAYU APP UI                                   */
          /* ============================================================ */
          <div className="flex-grow flex h-full font-sans text-xs select-none">
            {/* Left Sidebar */}
            <div className="w-[185px] bg-[#f6f4f0] dark:bg-zinc-900 border-r border-[#e8e5df] dark:border-zinc-800 p-4 pt-10 flex flex-col justify-between shrink-0 relative">
              {/* Traffic Light Dots */}
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>

              <div className="space-y-5">
                {/* Logo & Brand */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-sm border border-zinc-200">
                    <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-heading font-black text-lg tracking-tight text-[#1c1b19] dark:text-white">Parayu</span>
                </div>

                {/* Nav Items */}
                <div className="space-y-1 relative">
                  <div className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-[#fdeef1] text-[#e01e41] font-extrabold text-[12px] cursor-default before:content-[''] before:absolute before:left-[6px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:height-[16px] before:rounded-full before:bg-[#e01e41]">
                    <Brain className="w-4 h-4" />
                    <span>Home</span>
                  </div>
                  
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <FileText className="w-4 h-4" />
                    <span>Parayu History</span>
                  </div>
                  
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <Volume2 className="w-4 h-4" />
                    <span>Dictionary</span>
                  </div>

                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <Keyboard className="w-4 h-4" />
                    <span>Snippets</span>
                  </div>
                  
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <FileText className="w-4 h-4" />
                    <span>Pro Writing</span>
                    <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/10 text-[#a02bb0]">PRO</span>
                  </div>

                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </div>

                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[#706b61] dark:text-zinc-400 font-bold text-[12px] hover:bg-[#faf9f7] dark:hover:bg-zinc-850 cursor-default transition-all">
                    <Shield className="w-4 h-4" />
                    <span>Admin</span>
                  </div>
                </div>
              </div>

              {/* Enterprise Plan Card */}
              <div className="bg-white dark:bg-zinc-850 border border-[#e8e5df] dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col gap-2 shrink-0 my-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-black text-[#1c1b19] dark:text-white leading-none">Enterprise Plan</div>
                <div className="text-[9px] text-[#706b61] dark:text-zinc-450 leading-tight">Team-wide volumes active. Contact your IT administrator.</div>
                <button className="w-full py-1.5 border border-zinc-200 dark:border-zinc-850 text-[#e01e41] hover:bg-[#e01e41]/5 rounded-lg text-[9px] font-black transition-all bg-white dark:bg-zinc-950 shadow-sm">License details</button>
              </div>
              
              {/* Account profile & dropdown */}
              <div className="flex flex-col gap-1 border-t border-[#e8e5df] dark:border-zinc-800 pt-3.5 shrink-0">
                <div className="flex items-center justify-between text-[11px] cursor-default p-1 hover:bg-zinc-150/40 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#ff5b5b] text-white flex items-center justify-center font-extrabold shadow-sm">DD</div>
                    <div className="min-w-0 leading-tight">
                      <div className="font-extrabold text-[#1c1b19] dark:text-zinc-300 truncate">Dev Demo</div>
                      <div className="text-[9px] text-[#706b61] dark:text-zinc-500 font-bold">Enterprise</div>
                    </div>
                  </div>
                  <span className="text-[#706b61]">▾</span>
                </div>
                <span className="text-[9px] text-[#706b61] dark:text-zinc-500 pl-1 mt-1 font-semibold">Parayu v0.1.0</span>
              </div>
            </div>

            {/* Right Main Panel Content */}
            <div className="flex-grow p-6 overflow-y-auto space-y-5 flex flex-col justify-start bg-[#fcfbfa] dark:bg-zinc-950 select-none">
              
              {/* Header row with Toolbar */}
              <div className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-heading font-black text-[#1c1b19] dark:text-white leading-tight">
                    Insights
                  </h2>
                  <div className="w-5 h-5 rounded-full bg-[#e01e41] flex items-center justify-center text-white">
                    <Sparkles className="w-3 h-3 fill-white stroke-none" />
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  {/* Language Selection Pill */}
                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm text-[10px] font-bold text-[#1c1b19] dark:text-white flex items-center gap-1.5">
                    <span>🌐 Malayalam</span>
                    <span className="text-zinc-400">▾</span>
                  </div>

                  {/* Timezone Pill */}
                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm text-[10px] font-bold text-[#706b61] dark:text-zinc-400 flex items-center gap-1.5">
                    <span>📅 1 Jul 2026 · 5:55 am</span>
                    <span className="text-zinc-350 text-[9px] font-normal font-sans">Asia/Calcutta</span>
                  </div>

                  {/* Tab switches */}
                  <div className="bg-[#ebe7df] dark:bg-zinc-800 p-0.5 rounded-full flex gap-0.5">
                    <div className="bg-white dark:bg-zinc-950 text-[#1c1b19] dark:text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold shadow-sm">
                      Your Usage
                    </div>
                    <div className="text-[#706b61] dark:text-zinc-400 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-default">
                      Your Voice
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI metrics row */}
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="bg-[#f6f4f0] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#e8e5df] dark:border-zinc-800 text-[11px] font-extrabold text-[#1c1b19] dark:text-white">
                  {step === "completed" ? "1,672" : "1,648"} <span className="text-[#706b61] font-semibold ml-0.5">words</span>
                </span>
                <span className="bg-[#f6f4f0] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#e8e5df] dark:border-zinc-800 text-[11px] font-extrabold text-[#1c1b19] dark:text-white">
                  104 <span className="text-[#706b61] font-semibold ml-0.5">wpm</span>
                </span>
                <span className="bg-[#f6f4f0] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#e8e5df] dark:border-zinc-800 text-[11px] font-extrabold text-[#1c1b19] dark:text-white">
                  33 <span className="text-[#706b61] font-semibold ml-0.5">fixes</span>
                </span>
                <span className="bg-[#1f6f63]/10 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-[#1f6f63]/25 text-[11px] font-extrabold text-[#1f6f63] dark:text-emerald-400">
                  Model ready
                </span>
              </div>

              {/* Grid content layout */}
              <div className="grid grid-cols-3 gap-4 flex-grow min-h-0">
                {/* 1. Typing Speed Card */}
                <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative group hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-[#706b61] dark:text-zinc-500 uppercase tracking-wide">Typing Speed</span>
                    <span className="text-[#e81f3a]"><Cpu className="w-3.5 h-3.5" /></span>
                  </div>

                  {/* Semicircular Speed Gauge */}
                  <div className="relative w-full flex justify-center mt-2">
                    <svg viewBox="0 0 170 96" className="w-[125px] h-[70px]">
                      <path
                        d="M 15 85 A 70 70 0 0 1 155 85"
                        fill="none"
                        stroke="#ebe7df"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      {/* Arc sweep path for 104 WPM (104/160 = 65% sweep) */}
                      <path
                        d="M 15 85 A 70 70 0 0 1 112 20"
                        fill="none"
                        stroke="url(#gaugeGradMain)"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gaugeGradMain" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#e81f3a" />
                          <stop offset="60%" stopColor="#d81d54" />
                          <stop offset="100%" stopColor="#a02bb0" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                      <span className="text-lg font-heading font-black leading-none text-[#1c1b19] dark:text-white">104</span>
                      <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase mt-0.5">wpm</span>
                    </div>
                  </div>

                  {/* Trend Indicator Pill */}
                  <div className="flex justify-center mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1f6f63]/10 text-[#1f6f63] dark:text-emerald-400 text-[10px] font-extrabold">
                      📈 +18% vs last week
                    </span>
                  </div>

                  <div className="flex justify-between text-[8px] font-bold text-[#706b61] dark:text-zinc-500 border-t border-[#e8e5df] dark:border-zinc-800 pt-2 mt-2">
                    <span>Target 120 wpm</span>
                    <span className="text-[#e01e41]">16 to goal</span>
                  </div>
                </div>

                {/* 2. Smart Editing Card */}
                <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-[#706b61] dark:text-zinc-500 uppercase tracking-wide">Smart Editing</span>
                    <span className="text-purple-650"><Sparkles className="w-3.5 h-3.5" /></span>
                  </div>

                  <div className="py-2">
                    <div className="text-3xl font-heading font-black text-[#1c1b19] dark:text-white leading-tight">33</div>
                    <div className="text-[9px] text-[#706b61] dark:text-zinc-400 font-bold mt-0.5">Fixes made by Parayu</div>
                  </div>

                  {/* Collapsible Stat Rows mockup */}
                  <div className="space-y-1">
                    <div className="bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[9px] font-bold text-[#1c1b19] dark:text-zinc-350">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        <span>28 corrections</span>
                      </div>
                      <span className="text-zinc-400">▾</span>
                    </div>

                    <div className="bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[9px] font-bold text-[#1c1b19] dark:text-zinc-350">
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-600">📖</span>
                        <span>5 dictionary</span>
                      </div>
                      <span className="text-zinc-400">▾</span>
                    </div>
                  </div>
                </div>

                {/* 3. Dictation Volume Card */}
                <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-[#706b61] dark:text-zinc-500 uppercase tracking-wide">Dictation Volume</span>
                    <span className="text-emerald-600"><Mic className="w-3.5 h-3.5" /></span>
                  </div>

                  <div className="py-2">
                    <div className="text-3xl font-heading font-black text-[#1c1b19] dark:text-white leading-tight">
                      {step === "completed" ? "1,672" : "1,648"}
                    </div>
                    <div className="text-[9px] text-[#706b61] dark:text-zinc-400 font-bold mt-0.5">Total words dictated</div>
                  </div>

                  {/* Rows */}
                  <div className="space-y-1">
                    <div className="bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[9px] font-bold text-[#1c1b19] dark:text-zinc-350">
                      <div className="flex items-center gap-1.5">
                        <span>💻</span>
                        <span>{step === "completed" ? "1672" : "1648"} words pasted</span>
                      </div>
                      <span className="text-zinc-400">▾</span>
                    </div>

                    <div className="bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[9px] font-bold text-[#1c1b19] dark:text-zinc-350">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Ready <span className="text-zinc-400 font-medium ml-1">on-device engine</span></span>
                      </div>
                      <span className="text-zinc-400">▾</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row - Integrations & Streaks */}
              <div className="grid grid-cols-5 gap-4 shrink-0 mt-auto">
                {/* Desktop Integration List (Spans 3 cols) */}
                <div className="col-span-3 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-heading font-black text-xs text-[#1c1b19] dark:text-white">Desktop Integration</h4>
                    <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Apps Integration | 8</span>
                  </div>
                  
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                    {[
                      { label: "Antigravity", words: 592, pct: "w-[85%]", color: "bg-[#e01e41]", init: "A" },
                      { label: "Claude", words: 557, pct: "w-[80%]", color: "bg-orange-500", init: "C" },
                      { 
                        label: "Parayu Super Dev", 
                        words: step === "completed" ? 265 : 241, 
                        pct: step === "completed" ? "w-[42%]" : "w-[35%]", 
                        color: "bg-blue-500", 
                        init: "P" 
                      },
                      { label: "Finder", words: 139, pct: "w-[20%]", color: "bg-cyan-500", init: "F" },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-bold text-zinc-700 dark:text-zinc-350">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-4 h-4 rounded-md text-white font-extrabold flex items-center justify-center text-[8px]", item.color)}>
                              {item.init}
                            </span>
                            <span>{item.label}</span>
                          </div>
                          <span>{item.words} words</span>
                        </div>
                        <div className="w-full bg-[#f6f4f0] dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-500", item.color, item.pct)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2 Day Streak Heatmap Card (Spans 2 cols) */}
                <div className="col-span-2 bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-heading font-black text-xs text-[#1c1b19] dark:text-white flex items-center gap-1">
                      <Flame className="w-4 h-4 text-[#e01e41] fill-[#e01e41]" />
                      <span>2 day streak</span>
                    </h4>
                    <span className="text-[8px] font-bold text-[#706b61] dark:text-zinc-500 uppercase">Longest | 2 days</span>
                  </div>

                  {/* Sized 7x21 cells mock contribution heatmap grid */}
                  <div className="flex justify-center my-2 overflow-hidden">
                    <div className="grid grid-cols-21 gap-[3px]">
                      {Array.from({ length: 147 }).map((_, idx) => {
                        // Make cells look real
                        let lvl = 0;
                        if (idx === 145) {
                          // Today is selected/highlighted active streak day
                          lvl = 4;
                        } else if (idx === 144) {
                          lvl = 3;
                        } else if (idx > 130) {
                          lvl = [0, 1, 0, 2, 0, 1, 3, 0, 2, 0, 1, 0, 4, 0, 3, 2, 0][idx % 17];
                        } else if (idx > 80) {
                          lvl = [0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 2, 1][idx % 15];
                        }
                        
                        const isSelectedToday = idx === 145;

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "w-[6.5px] h-[6.5px] rounded-[1px] transition-all",
                              lvl === 0 && "bg-[#ebe7df] dark:bg-zinc-800",
                              lvl === 1 && "bg-[#e81f3a]/15",
                              lvl === 2 && "bg-[#e81f3a]/40",
                              lvl === 3 && "bg-[#e81f3a]/70",
                              lvl === 4 && "bg-[#e81f3a]",
                              isSelectedToday && "ring-1 ring-[#1c1b19] dark:ring-white scale-110"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between text-[7px] font-bold text-[#706b61] uppercase tracking-wider pt-1.5 border-t border-[#e8e5df] dark:border-zinc-800">
                    <span>Less</span>
                    <div className="flex gap-[3px] items-center">
                      <div className="w-[5px] h-[5px] rounded-[1px] bg-[#ebe7df] dark:bg-zinc-800" />
                      <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e81f3a]/15" />
                      <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e81f3a]/40" />
                      <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e81f3a]/70" />
                      <div className="w-[5px] h-[5px] rounded-[1px] bg-[#e81f3a]" />
                    </div>
                    <span>More</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* ============================================================ */
          /*  FLOATING EXTERNAL APP WINDOWS (Notion, Slack, VS Code, Gmail) */
          /* ============================================================ */
          <>
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
      </>
    )}

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
