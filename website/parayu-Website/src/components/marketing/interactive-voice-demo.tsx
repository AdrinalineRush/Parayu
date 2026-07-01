"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
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
  Shield,
  Clock,
  BookOpen,
  Plus,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Static definitions of all app views in scrollytelling walkthrough
const scrollSteps = [
  {
    id: "insights",
    badge: "01. Insights Dashboard",
    title: "Track Your Speech Metrics",
    description: "Our core Insights panel summarizes your daily dictation volume, average typing speed (WPM), and fixes made by Parayu. Monitor integrations and view your daily activity streak heatmap completely offline.",
    color: "#e01e41",
    tab: "Home"
  },
  {
    id: "history",
    badge: "02. Tell Me History",
    title: "Double-Click to Copy Anything",
    description: "Every voice transcription is stored in a clean, local history log. Need to use a past translation elsewhere? Simply double-click any past card to copy the text to your clipboard instantly.",
    color: "#a02bb0",
    tab: "Parayu History"
  },
  {
    id: "dictionary",
    badge: "03. Custom Voice Dictionary",
    title: "Prevent Transcription Errors",
    description: "Map specialized jargon, accents, or misheard words. Define 'misheard → correct' word pairs (e.g., spoken Malayalam dialect to fluent English replacements) so the C++ engine corrects them automatically.",
    color: "#1f6f63",
    tab: "Dictionary"
  },
  {
    id: "snippets",
    badge: "04. Text Expansion Snippets",
    title: "Shorthand Speech Commands",
    description: "Create text macro templates. Dictate custom trigger phrases like 'my signature' or 'project update' to instantly expand into long multiline email templates or boilerplate code blocks.",
    color: "#ff8a1f",
    tab: "Snippets"
  },
  {
    id: "screenwriting",
    badge: "05. Pro Writing Scene Editor",
    title: "Structured Screenplay Mode",
    description: "A specialized screenwriting interface with automatic script formatting helpers. Write character profiles, scene headers, and dialogue lines using optimized local C++ engines.",
    color: "#7c5cff",
    tab: "Pro Writing"
  },
  {
    id: "settings",
    badge: "06. Core Brain Switch",
    title: "Pick Your On-Device Brain",
    description: "Toggle hotkeys and speech models. Choose the speech brain that fits your hardware: LOW (190MB/fast), MEDIUM (539MB/Malayalam Optimized), HIGH (844MB/Multilingual), or PRO (2.9GB/Full Float 16).",
    color: "#0ea5e9",
    tab: "Settings"
  }
];

export function InteractiveVoiceDemo({ className }: { className?: string }) {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind scroll progress for 3D tilt & scale transition
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.95, 1.02, 1.02, 0.95]);
  const rotateX = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [8, 0, 0, -8]);
  const rotateY = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [-8, 0, 0, 8]);

  // Monitor scroll positioning to update active step highlight
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const elements = containerRef.current.querySelectorAll(".scroll-step-target");
      const viewportHeight = window.innerHeight;
      
      let currentActive = 0;
      let minDistance = Infinity;

      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        // Calculate absolute distance of the card center from the screen vertical center
        const distance = Math.abs(rect.top + rect.height / 2 - viewportHeight / 2);
        if (distance < minDistance) {
          minDistance = distance;
          currentActive = index;
        }
      });

      setActiveStep(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial trigger
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyHistory = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div ref={containerRef} className={cn("max-w-6xl mx-auto px-4 relative", className)}>
      
      {/* 2-Column Sticky Scrollytelling Layout */}
      <div className="grid md:grid-cols-2 gap-12 items-start">
        
        {/* Left Column: Sticky macOS Application Mockup Window */}
        <div className="sticky top-28 h-[480px] flex items-center justify-center shrink-0 z-20">
          
          {/* Frameless macOS app mockup window with 3D tilt scroll animation */}
          <motion.div 
            style={{ 
              scale,
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              perspective: 1000
            }}
            className="w-full max-w-[460px] h-[390px] bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 shadow-2xl rounded-2xl flex flex-row overflow-hidden select-none relative animate-in fade-in duration-300"
          >
            
            {/* Left Sidebar Navigation */}
            <div className="w-[145px] bg-[#f6f4f0] dark:bg-zinc-900 border-r border-[#e8e5df] dark:border-zinc-800 p-3 pt-9 flex flex-col justify-between shrink-0 relative">
              {/* macOS Window Dots */}
              <div className="absolute top-3.5 left-3.5 flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>

              <div className="space-y-4">
                {/* Brand Logo Header */}
                <div className="flex items-center gap-1.5 pt-1.5">
                  <div className="w-6.5 h-6.5 rounded-md overflow-hidden shrink-0 border border-zinc-200 shadow-sm bg-white">
                    <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-heading font-black text-sm tracking-tight text-[#1c1b19] dark:text-white">Parayu</span>
                </div>

                {/* Nav Items List with Active State highlight matching activeStep */}
                <div className="space-y-0.5 relative text-[10px]">
                  {[
                    { label: "Home", idx: 0, icon: <Brain className="w-3.5 h-3.5" /> },
                    { label: "Parayu History", idx: 1, icon: <Clock className="w-3.5 h-3.5" /> },
                    { label: "Dictionary", idx: 2, icon: <BookOpen className="w-3.5 h-3.5" /> },
                    { label: "Snippets", idx: 3, icon: <Keyboard className="w-3.5 h-3.5" /> },
                    { label: "Pro Writing", idx: 4, icon: <Code className="w-3.5 h-3.5" />, badge: "PRO" },
                    { label: "Settings", idx: 5, icon: <Settings className="w-3.5 h-3.5" /> }
                  ].map((item) => {
                    const isActive = activeStep === item.idx;
                    return (
                      <div 
                        key={item.label}
                        className={cn(
                          "relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold transition-all duration-200",
                          isActive 
                            ? "bg-[#fdeef1] text-[#e01e41] before:content-[''] before:absolute before:left-[4px] before:top-1/2 before:-translate-y-1/2 before:w-[2.5px] before:height-[12px] before:rounded-full before:bg-[#e01e41]"
                            : "text-[#706b61] dark:text-zinc-400 hover:bg-zinc-150/30"
                        )}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "ml-auto text-[7px] px-1 py-0.2 rounded-full font-black",
                            isActive ? "bg-[#e01e41]/10 text-[#e01e41]" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar enterprise details */}
              <div className="flex flex-col gap-1 border-t border-[#e8e5df] dark:border-zinc-800 pt-2 shrink-0 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-5.5 h-5.5 rounded-full bg-[#ff5b5b] text-white flex items-center justify-center font-black text-[9px] shadow-sm">DD</div>
                  <div className="min-w-0 leading-tight">
                    <div className="font-extrabold text-[#1c1b19] dark:text-zinc-300 truncate">Dev Demo</div>
                    <div className="text-[8px] text-[#706b61] dark:text-zinc-500 font-bold">Enterprise</div>
                  </div>
                </div>
                <span className="text-[8px] text-[#706b61] dark:text-zinc-500 pl-0.5 mt-0.5 font-semibold">Parayu v0.1.0</span>
              </div>
            </div>

            {/* Right Screen: Smooth sliding panels representing all UI frames */}
            <div className="flex-grow h-full overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950">
              <motion.div
                animate={{ y: -activeStep * 390 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-full flex flex-col"
              >
                
                {/* 01. INSIGHTS FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Insights</h4>
                      <span className="w-4 h-4 rounded-full bg-[#e01e41] flex items-center justify-center text-white shrink-0">
                        <Sparkles className="w-2.5 h-2.5 fill-white stroke-none" />
                      </span>
                    </div>
                    <span className="text-[7.5px] text-[#706b61] dark:text-zinc-500 font-bold">1 Jul 2026 · 5:55 am</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-1.5 rounded-lg font-extrabold text-[#1c1b19] dark:text-white">
                      <div>1,648</div>
                      <div className="text-[7px] text-[#706b61] uppercase mt-0.5">words</div>
                    </div>
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-1.5 rounded-lg font-extrabold text-[#1c1b19] dark:text-white">
                      <div>104</div>
                      <div className="text-[7px] text-[#706b61] uppercase mt-0.5">wpm</div>
                    </div>
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-1.5 rounded-lg font-extrabold text-[#1c1b19] dark:text-white">
                      <div>33</div>
                      <div className="text-[7px] text-[#706b61] uppercase mt-0.5">fixes</div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl flex flex-col justify-between h-[80px] shrink-0">
                    <div className="flex justify-between items-center text-[7.5px] font-bold text-[#706b61] uppercase">
                      <span>Typing Speed</span>
                      <span className="text-rose-500">+18% vs last week</span>
                    </div>
                    <div className="relative w-full flex justify-center mt-0.5">
                      <svg viewBox="0 0 170 96" className="w-[80px] h-[44px]">
                        <path d="M 15 85 A 70 70 0 0 1 155 85" fill="none" stroke="#ebe7df" strokeWidth="12" strokeLinecap="round" />
                        <motion.path 
                          initial={{ pathLength: 0 }}
                          animate={activeStep === 0 ? { pathLength: 1 } : { pathLength: 0 }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          d="M 15 85 A 70 70 0 0 1 112 20" 
                          fill="none" 
                          stroke="url(#gGrad)" 
                          strokeWidth="12" 
                          strokeLinecap="round" 
                        />
                        <defs>
                          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#e81f3a" />
                            <stop offset="100%" stopColor="#a02bb0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-end">
                        <span className="text-[11px] font-black leading-none text-[#1c1b19] dark:text-white">104</span>
                        <span className="text-[6.5px] font-bold text-[#706b61] uppercase">wpm</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl space-y-1.5 flex-grow">
                    <div className="text-[7.5px] font-black text-[#706b61] uppercase mb-1">Desktop Integration</div>
                    {[
                      { label: "Antigravity", words: "592 words", color: "bg-[#e01e41]", w: "85%" },
                      { label: "Claude", words: "557 words", color: "bg-orange-500", w: "80%" }
                    ].map((item) => (
                      <div key={item.label} className="space-y-0.5">
                        <div className="flex justify-between text-[7.5px] font-bold text-zinc-650 dark:text-zinc-400">
                          <span>{item.label}</span>
                          <span>{item.words}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: "0%" }}
                            animate={activeStep === 0 ? { width: item.w } : { width: "0%" }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={cn("h-full rounded-full", item.color)} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 02. PARAYU HISTORY FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Parayu History</h4>
                    <span className="text-[7px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Free Tier</span>
                  </div>

                  <div className="text-[8px] text-[#706b61] font-semibold italic border-l-2 border-[#e01e41] pl-2 shrink-0 my-1">
                    Double-click any card below to instantly copy details to clipboard.
                  </div>

                  <div className="space-y-2.5 flex-grow overflow-y-auto pr-0.5 py-1">
                    {[
                      { time: "10:45 AM", text: "Hey, do you remember what I said in yesterday's sync? The project timeline will delay by 2 weeks." },
                      { time: "Yesterday", text: "We need to update the pricing matrix to changes to the free word limits and push." }
                    ].map((h, i) => (
                      <div 
                        key={i}
                        onDoubleClick={() => handleCopyHistory(h.text)}
                        className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl shadow-sm hover:border-[#e01e41]/35 cursor-pointer select-none group transition-all"
                        title="Double-click to copy"
                      >
                        <div className="flex justify-between items-center text-[7.5px] font-bold text-[#706b61] mb-1">
                          <span>{h.time}</span>
                          <span className="text-[7px] text-[#e01e41] opacity-0 group-hover:opacity-100 transition-opacity font-black">Double-click to copy</span>
                        </div>
                        <p className="text-[9px] text-[#1c1b19] dark:text-zinc-200 leading-normal font-semibold">
                          {h.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 03. DICTIONARY FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Dictionary</h4>
                    <span className="text-[7.5px] text-[#706b61] font-bold">Auto-replacements</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 shrink-0 my-1">
                    <input readOnly placeholder="Misheard word" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-2 py-1 rounded text-[8px] focus:outline-none" />
                    <input readOnly placeholder="Correct word" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-2 py-1 rounded text-[8px] focus:outline-none" />
                    <button className="bg-[#e01e41] text-white rounded flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="space-y-1.5 flex-grow overflow-y-auto pr-0.5 py-1">
                    {[
                      { from: "ennale", to: "yesterday" },
                      { from: "karyangal", to: "things" },
                      { from: "lag", to: "delay" }
                    ].map((row) => (
                      <div key={row.from} className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-2 rounded-xl flex items-center justify-between shadow-sm">
                        <span className="font-bold text-[#1c1b19] dark:text-zinc-200">
                          {row.from} <span className="text-[#706b61] font-normal mx-1">→</span> {row.to}
                        </span>
                        <span className="text-[7px] font-black uppercase text-rose-500 hover:underline cursor-default">remove</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 04. SNIPPETS FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Snippets</h4>
                    <span className="text-[7.5px] text-[#706b61] font-bold">Text expansions</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 shrink-0 my-1">
                    <input readOnly placeholder="trigger" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-2 py-1 rounded text-[8px] focus:outline-none" />
                    <input readOnly placeholder="expands to" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-2 py-1 rounded text-[8px] focus:outline-none" />
                    <button className="bg-[#e01e41] text-white rounded flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="space-y-1.5 flex-grow overflow-y-auto pr-0.5 py-1">
                    {[
                      { trigger: "mysig", val: "Kind regards, Adarsh" },
                      { trigger: "timeline", val: "The project timeline will lag by 2 weeks." }
                    ].map((row) => (
                      <div key={row.trigger} className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-2 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="min-w-0 leading-tight">
                          <div className="font-extrabold text-[#e01e41]">{row.trigger}</div>
                          <div className="text-[8px] text-[#706b61] dark:text-zinc-500 truncate mt-0.5">{row.val}</div>
                        </div>
                        <span className="text-[7px] font-black uppercase text-rose-500 cursor-default">remove</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 05. PRO WRITING FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Pro Writing</h4>
                    <span className="text-[7.5px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 font-extrabold">PRO Mode</span>
                  </div>

                  <div className="flex-grow bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-3 rounded-xl flex flex-col justify-start font-mono text-[8px] leading-relaxed text-zinc-700 dark:text-zinc-400 overflow-y-auto space-y-2 my-1">
                    <div className="text-center font-bold text-[#1c1b19] dark:text-white mb-2">SCENE 1: SYNCHRONIZATION</div>
                    <div>INT. MEETING ROOM - DAY</div>
                    <div className="pl-6 font-bold text-[#1c1b19] dark:text-white">ADARSH</div>
                    <div className="pl-12">
                      Innalathe meetingil njan paranja karyangal ormayundo? Athil chila changes undu...
                    </div>
                  </div>
                </div>

                {/* 06. SETTINGS FRAME */}
                <div className="h-[390px] w-full p-4.5 flex flex-col justify-between shrink-0 text-[10px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Settings</h4>
                    <span className="text-[7.5px] text-[#706b61] font-bold">App Config</span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-2.5 rounded-xl shrink-0 flex items-center justify-between my-1">
                    <span className="font-bold text-[#706b61] dark:text-zinc-400">Record Hotkey</span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 px-2 py-0.5 rounded font-mono font-extrabold text-[#1c1b19] dark:text-white">⌥ Space</span>
                  </div>

                  <div className="space-y-1.5 flex-grow overflow-y-auto pr-0.5 py-1">
                    <div className="text-[7.5px] font-black text-[#706b61] uppercase mb-1">Brain Switch catalog</div>
                    {[
                      { name: "LOW", size: "190 MB", desc: "Fast & lightweight bilingual translation" },
                      { name: "MEDIUM", size: "539 MB", desc: "Malayalam Optimized balanced understanding" },
                      { name: "PRO", size: "2.9 GB", desc: "Flagship unquantized float 16 precision", active: true }
                    ].map((model) => (
                      <div 
                        key={model.name}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl border flex items-center justify-between shadow-sm",
                          model.active
                            ? "border-[#e01e41] bg-[#e01e41]/5 text-[#e01e41]"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-black text-[9px] flex items-center gap-1">
                            <span>{model.name}</span>
                            <span className="text-[7px] font-normal opacity-60">· {model.size}</span>
                          </div>
                          <p className="text-[7.5px] opacity-75 truncate mt-0.5">{model.desc}</p>
                        </div>
                        {model.active && <Check className="w-3.5 h-3.5 text-[#e01e41]" />}
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Scrollable Steps explaining each tab */}
        <div className="space-y-16 py-12">
          {scrollSteps.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <div 
                key={step.id}
                className={cn(
                  "scroll-step-target p-6.5 rounded-2xl border transition-all duration-300 space-y-4",
                  isActive
                    ? "bg-white dark:bg-zinc-900 border-[#e8e5df] dark:border-zinc-800 shadow-md scale-[1.02]"
                    : "border-transparent opacity-40 scale-100"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-heading font-black tracking-tight text-[#e01e41]/10 leading-none">
                    {step.badge.split(".")[0]}
                  </span>
                  <div 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider" 
                    style={{ background: `${step.color}15`, color: step.color }}
                  >
                    {step.tab}
                  </div>
                </div>

                <h3 className="text-lg md:text-xl font-heading font-black text-foreground">
                  {step.title}
                </h3>

                <p className="text-xs md:text-sm text-muted-foreground font-semibold leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}
