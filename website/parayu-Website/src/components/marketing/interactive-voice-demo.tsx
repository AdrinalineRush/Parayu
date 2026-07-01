"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
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
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse coordinate values for premium interactive 3D parallax tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Physics springs to make mouse hover tilt butter-smooth
  const rotateXSpring = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 25 });
  const rotateYSpring = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 25 });

  // Bind scroll progress for scaling entry transitions
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.95, 1.02, 1.02, 0.95]);
  const translateY = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [30, 0, 0, -30]);

  // Track scroll position to update active step index
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const elements = containerRef.current.querySelectorAll(".scroll-step-target");
      const viewportHeight = window.innerHeight;
      
      let currentActive = 0;
      let minDistance = Infinity;

      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportHeight / 2);
        if (distance < minDistance) {
          minDistance = distance;
          currentActive = index;
        }
      });

      setActiveStep(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track mouse movements over the mockup window to calculate 3D tilt coordinates
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left - width / 2;
    const mouseY = event.clientY - rect.top - height / 2;
    
    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleCopyHistory = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div ref={containerRef} className={cn("max-w-6xl mx-auto px-4 relative", className)}>
      
      {/* 2-Column Sticky Scrollytelling Layout */}
      <div className="grid md:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Sticky macOS Application Mockup Window */}
        <div className="md:col-span-6 sticky top-28 h-[480px] flex items-center justify-center shrink-0 z-20">
          
          {/* Frameless macOS app mockup window in default 1180:740 ratio with 3D tilt animations */}
          <motion.div 
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ 
              scale,
              y: translateY,
              rotateX: rotateXSpring,
              rotateY: rotateYSpring,
              transformStyle: "preserve-3d",
              perspective: 1200
            }}
            className="w-full max-w-[550px] aspect-[1180/740] bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] rounded-2xl flex flex-row overflow-hidden select-none relative animate-in fade-in duration-300 cursor-grab active:cursor-grabbing"
          >
            
            {/* Left Sidebar Navigation - Replicates exact default ratio width 21.7% */}
            <div className="w-[21.7%] bg-[#f6f4f0] dark:bg-zinc-900 border-r border-[#e8e5df] dark:border-zinc-800 p-[3%] pt-[7%] flex flex-col justify-between shrink-0 relative h-full">
              {/* macOS Window Dots */}
              <div className="absolute top-[5%] left-[6%] flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
              </div>

              <div className="space-y-[15%]">
                {/* Brand Header */}
                <div className="flex items-center gap-[6%] pt-[4%]">
                  <div className="w-[22%] aspect-square rounded-md overflow-hidden shrink-0 border border-zinc-200 shadow-sm bg-white">
                    <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-heading font-black text-[1.4vw] md:text-[0.9vw] xl:text-[13px] tracking-tight text-[#1c1b19] dark:text-white">Parayu</span>
                </div>

                {/* Nav Items List */}
                <div className="space-y-[2%] relative text-[1vw] md:text-[0.65vw] xl:text-[9.5px]">
                  {[
                    { label: "Home", idx: 0, icon: <Brain className="w-3 h-3 md:w-3.5 md:h-3.5" /> },
                    { label: "Parayu History", idx: 1, icon: <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" /> },
                    { label: "Dictionary", idx: 2, icon: <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5" /> },
                    { label: "Snippets", idx: 3, icon: <Keyboard className="w-3 h-3 md:w-3.5 md:h-3.5" /> },
                    { label: "Pro Writing", idx: 4, icon: <Code className="w-3 h-3 md:w-3.5 md:h-3.5" />, badge: "PRO" },
                    { label: "Settings", idx: 5, icon: <Settings className="w-3 h-3 md:w-3.5 md:h-3.5" /> }
                  ].map((item) => {
                    const isActive = activeStep === item.idx;
                    return (
                      <div 
                        key={item.label}
                        className={cn(
                          "relative flex items-center gap-[8%] px-[8%] py-[6%] rounded-lg font-bold transition-all duration-200 cursor-default",
                          isActive 
                            ? "bg-[#e01e41]/5 text-[#e01e41] before:content-[''] before:absolute before:left-[4px] before:top-1/2 before:-translate-y-1/2 before:w-[2.5px] before:height-[45%] before:rounded-full before:bg-gradient-to-b before:from-[#e81f3a] before:to-[#a02bb0]"
                            : "text-[#706b61] dark:text-zinc-400 hover:bg-zinc-150/30"
                        )}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "ml-auto text-[0.8vw] md:text-[0.5vw] xl:text-[7px] px-[5%] py-[2%] rounded-full font-black",
                            isActive ? "bg-[#a02bb0]/10 text-[#a02bb0]" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Sanjay Raj Release Profile Widget */}
              <div className="flex flex-col gap-[8%] border-t border-[#e8e5df] dark:border-zinc-800 pt-[8%] shrink-0 text-[1vw] md:text-[0.6vw] xl:text-[8.5px]">
                <div className="flex items-center gap-[8%]">
                  {/* Release avatar with actual CSS background gradient: linear-gradient(135deg, #e81f3a, #ff9b3d) */}
                  <div className="w-[20%] aspect-square rounded-full bg-gradient-to-br from-[#e81f3a] to-[#ff9b3d] text-white flex items-center justify-center font-black shadow-sm">SR</div>
                  <div className="min-w-0 leading-tight">
                    <div className="font-extrabold text-[#1c1b19] dark:text-zinc-350 truncate">Sanjay Raj</div>
                    <div className="text-[0.9vw] md:text-[0.55vw] xl:text-[7.5px] text-[#706b61] dark:text-zinc-500 font-bold">Pro Plan</div>
                  </div>
                </div>
                <span className="text-[0.8vw] md:text-[0.5vw] xl:text-[7px] text-[#706b61] dark:text-zinc-500 pl-[2%] font-semibold">Parayu v1.0.0</span>
              </div>
            </div>

            {/* Right Screen Area: Smooth sliding frames animation - Replicates exact default ratio width 78.3% */}
            <div className="w-[78.3%] h-full overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950">
              <motion.div
                animate={{ y: `-${activeStep * 100}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
                className="w-full h-full flex flex-col"
              >
                
                {/* 01. INSIGHTS FRAME */}
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-[4%]">
                      <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Insights</h4>
                      <span className="w-[12%] aspect-square rounded-full bg-[#e01e41] flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Sparkles className="w-[60%] h-[60%] fill-white stroke-none" />
                      </span>
                    </div>
                    <span className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] text-[#706b61] dark:text-zinc-500 font-bold">1 Jul 2026 · 5:55 am</span>
                  </div>

                  {/* KPI card row */}
                  <div className="grid grid-cols-3 gap-[3%] shrink-0 text-center">
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-[6%] rounded-lg font-extrabold text-[#1c1b19] dark:text-white shadow-sm">
                      <div className="text-[1.8vw] md:text-[1vw] xl:text-[11px]">1,648</div>
                      <div className="text-[1vw] md:text-[0.55vw] xl:text-[7px] text-[#706b61] uppercase mt-[4%]">words</div>
                    </div>
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-[6%] rounded-lg font-extrabold text-[#1c1b19] dark:text-white shadow-sm">
                      <div className="text-[1.8vw] md:text-[1vw] xl:text-[11px]">104</div>
                      <div className="text-[1vw] md:text-[0.55vw] xl:text-[7px] text-[#706b61] uppercase mt-[4%]">wpm</div>
                    </div>
                    <div className="bg-[#f6f4f0] dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 py-[6%] rounded-lg font-extrabold text-[#1c1b19] dark:text-white shadow-sm">
                      <div className="text-[1.8vw] md:text-[1vw] xl:text-[11px]">33</div>
                      <div className="text-[1vw] md:text-[0.55vw] xl:text-[7px] text-[#706b61] uppercase mt-[4%]">fixes</div>
                    </div>
                  </div>

                  {/* Semicircular Speed Gauge */}
                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-[3.5%] rounded-xl flex flex-col justify-between h-[21%] shrink-0 shadow-sm">
                    <div className="flex justify-between items-center text-[1vw] md:text-[0.55vw] xl:text-[7px] font-bold text-[#706b61] uppercase">
                      <span>Typing Speed</span>
                      <span className="text-rose-500 font-black">+18% vs last week</span>
                    </div>
                    <div className="relative w-full flex justify-center mt-[1%]">
                      <svg viewBox="0 0 170 96" className="w-[30%] aspect-[170/96]">
                        <path d="M 15 85 A 70 70 0 0 1 155 85" fill="none" stroke="#ebe7df" strokeWidth="12" strokeLinecap="round" />
                        <motion.path 
                          initial={{ pathLength: 0 }}
                          animate={activeStep === 0 ? { pathLength: 1 } : { pathLength: 0 }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          d="M 15 85 A 70 70 0 0 1 112 20" 
                          fill="none" 
                          stroke="url(#insightsGrad)" 
                          strokeWidth="12" 
                          strokeLinecap="round" 
                        />
                        <defs>
                          <linearGradient id="insightsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#e81f3a" />
                            <stop offset="100%" stopColor="#a02bb0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-end">
                        <span className="text-[1.8vw] md:text-[1.05vw] xl:text-[11px] font-black leading-none text-[#1c1b19] dark:text-white">104</span>
                        <span className="text-[1vw] md:text-[0.5vw] xl:text-[6.5px] font-bold text-[#706b61] uppercase">wpm</span>
                      </div>
                    </div>
                  </div>

                  {/* Integrations */}
                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-[3.5%] rounded-xl space-y-[2%] flex-grow shadow-sm">
                    <div className="text-[1vw] md:text-[0.55vw] xl:text-[7px] font-black text-[#706b61] uppercase mb-[1%]">Desktop Integration</div>
                    {[
                      { label: "Antigravity", words: "592 words", color: "bg-[#e01e41]", w: "85%" },
                      { label: "Claude", words: "557 words", color: "bg-orange-500", w: "80%" }
                    ].map((item) => (
                      <div key={item.label} className="space-y-[1%]">
                        <div className="flex justify-between text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-bold text-zinc-650 dark:text-zinc-450">
                          <span>{item.label}</span>
                          <span>{item.words}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-[12%] rounded-full overflow-hidden">
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
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Parayu History</h4>
                    <span className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-black px-[3%] py-[1%] rounded-full bg-emerald-500/10 text-emerald-600">Free Tier</span>
                  </div>

                  <div className="text-[1.1vw] md:text-[0.6vw] xl:text-[8px] text-[#706b61] font-semibold italic border-l-2 border-[#e01e41] pl-[2%] shrink-0 my-[1.5%]">
                    Double-click any card below to instantly copy details to clipboard.
                  </div>

                  <div className="space-y-[3%] flex-grow overflow-y-auto pr-[1%] py-[1%]">
                    {[
                      { time: "10:45 AM", text: "Hey, do you remember what I said in yesterday's sync? The project timeline will delay by 2 weeks." },
                      { time: "Yesterday", text: "We need to update the pricing matrix to changes to the free word limits and push." }
                    ].map((h, i) => (
                      <div 
                        key={i}
                        onDoubleClick={() => handleCopyHistory(h.text)}
                        className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-[3.5%] rounded-xl shadow-sm hover:border-[#e01e41]/35 cursor-pointer select-none group transition-all"
                        title="Double-click to copy"
                      >
                        <div className="flex justify-between items-center text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-bold text-[#706b61] mb-[1.5%]">
                          <span>{h.time}</span>
                          <span className="text-[1vw] md:text-[0.5vw] xl:text-[7px] text-[#e01e41] opacity-0 group-hover:opacity-100 transition-opacity font-black">Double-click to copy</span>
                        </div>
                        <p className="text-[1.3vw] md:text-[0.75vw] xl:text-[9px] text-[#1c1b19] dark:text-zinc-200 leading-normal font-semibold">
                          {h.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 03. DICTIONARY FRAME */}
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Dictionary</h4>
                    <span className="text-[1.1vw] md:text-[0.6vw] xl:text-[8px] text-[#706b61] font-bold">Auto-replacements</span>
                  </div>

                  <div className="grid grid-cols-5 gap-[1.5%] shrink-0 my-[1.5%]">
                    <input readOnly placeholder="Misheard word" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-[4%] py-[3%] rounded text-[1.1vw] md:text-[0.6vw] xl:text-[8px] focus:outline-none" />
                    <input readOnly placeholder="Correct word" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-[4%] py-[3%] rounded text-[1.1vw] md:text-[0.6vw] xl:text-[8px] focus:outline-none" />
                    <button className="bg-[#e01e41] text-white rounded flex items-center justify-center shadow-sm"><Plus className="w-[45%] h-[45%]" /></button>
                  </div>

                  <div className="space-y-[2%] flex-grow overflow-y-auto pr-[1%] py-[1%]">
                    {[
                      { from: "ennale", to: "yesterday" },
                      { from: "karyangal", to: "things" },
                      { from: "lag", to: "delay" }
                    ].map((row) => (
                      <div key={row.from} className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-[4%] py-[3%] rounded-xl flex items-center justify-between shadow-sm">
                        <span className="font-bold text-[#1c1b19] dark:text-zinc-200">
                          {row.from} <span className="text-[#706b61] font-normal mx-[1.5%]">→</span> {row.to}
                        </span>
                        <span className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-black uppercase text-rose-500 hover:underline cursor-default">remove</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 04. SNIPPETS FRAME */}
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Snippets</h4>
                    <span className="text-[1.1vw] md:text-[0.6vw] xl:text-[8px] text-[#706b61] font-bold">Text expansions</span>
                  </div>

                  <div className="grid grid-cols-5 gap-[1.5%] shrink-0 my-[1.5%]">
                    <input readOnly placeholder="trigger" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-[4%] py-[3%] rounded text-[1.1vw] md:text-[0.6vw] xl:text-[8px] focus:outline-none" />
                    <input readOnly placeholder="expands to" className="col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-[4%] py-[3%] rounded text-[1.1vw] md:text-[0.6vw] xl:text-[8px] focus:outline-none" />
                    <button className="bg-[#e01e41] text-white rounded flex items-center justify-center shadow-sm"><Plus className="w-[45%] h-[45%]" /></button>
                  </div>

                  <div className="space-y-[2%] flex-grow overflow-y-auto pr-[1%] py-[1%]">
                    {[
                      { trigger: "mysig", val: "Kind regards, Adarsh" },
                      { trigger: "timeline", val: "The project timeline will lag by 2 weeks." }
                    ].map((row) => (
                      <div key={row.trigger} className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-[4%] py-[3%] rounded-xl flex items-center justify-between shadow-sm">
                        <div className="min-w-0 leading-tight">
                          <div className="font-extrabold text-[#e01e41]">{row.trigger}</div>
                          <div className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] text-[#706b61] dark:text-zinc-500 truncate mt-[1.5%]">{row.val}</div>
                        </div>
                        <span className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-black uppercase text-rose-500 cursor-default">remove</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 05. PRO WRITING FRAME */}
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Pro Writing</h4>
                    <span className="text-[1.1vw] md:text-[0.6vw] xl:text-[8px] px-[3%] py-[1%] rounded-full bg-purple-500/10 text-purple-600 font-extrabold">PRO Mode</span>
                  </div>

                  <div className="flex-grow bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-[3.5%] rounded-xl flex flex-col justify-start font-mono text-[1.1vw] md:text-[0.6vw] xl:text-[8px] leading-relaxed text-zinc-700 dark:text-zinc-400 overflow-y-auto space-y-[2.5%] my-[1.5%] shadow-sm">
                    <div className="text-center font-bold text-[#1c1b19] dark:text-white mb-[3%]">SCENE 1: SYNCHRONIZATION</div>
                    <div>INT. MEETING ROOM - DAY</div>
                    <div className="pl-[6%] font-bold text-[#1c1b19] dark:text-white">ADARSH</div>
                    <div className="pl-[12%]">
                      Innalathe meetingil njan paranja karyangal ormayundo? Athil chila changes undu...
                    </div>
                  </div>
                </div>

                {/* 06. SETTINGS FRAME */}
                <div className="h-full w-full p-[4%] flex flex-col justify-between shrink-0 text-[1.4vw] md:text-[0.8vw] xl:text-[9.5px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h4 className="text-[1.8vw] md:text-[1vw] xl:text-[11px] font-heading font-black text-[#1c1b19] dark:text-white leading-tight">Settings</h4>
                    <span className="text-[1.1vw] md:text-[0.6vw] xl:text-[8px] text-[#706b61] font-bold">App Config</span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 p-[3.5%] rounded-xl shrink-0 flex items-center justify-between my-[1.5%] shadow-sm">
                    <span className="font-bold text-[#706b61] dark:text-zinc-450">Record Hotkey</span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 px-[3%] py-[1.5%] rounded font-mono font-extrabold text-[#1c1b19] dark:text-white">⌥ Space</span>
                  </div>

                  <div className="space-y-[2%] flex-grow overflow-y-auto pr-[1%] py-[1%]">
                    <div className="text-[1vw] md:text-[0.55vw] xl:text-[7.5px] font-black text-[#706b61] uppercase mb-[1.5%]">Brain Switch catalog</div>
                    {[
                      { name: "LOW", size: "190 MB", desc: "Fast & lightweight bilingual translation" },
                      { name: "MEDIUM", size: "539 MB", desc: "Malayalam Optimized balanced understanding" },
                      { name: "PRO", size: "2.9 GB", desc: "Flagship unquantized float 16 precision", active: true }
                    ].map((model) => (
                      <div 
                        key={model.name}
                        className={cn(
                          "px-[3.5%] py-[2.5%] rounded-xl border flex items-center justify-between shadow-sm",
                          model.active
                            ? "border-[#e01e41] bg-[#e01e41]/5 text-[#e01e41]"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-black text-[1vw] md:text-[0.6vw] xl:text-[8.5px] flex items-center gap-[4%]">
                            <span>{model.name}</span>
                            <span className="text-[0.9vw] md:text-[0.5vw] xl:text-[7.2px] font-normal opacity-60">· {model.size}</span>
                          </div>
                          <p className="text-[0.9vw] md:text-[0.5vw] xl:text-[7.5px] opacity-75 truncate mt-[1.5%]">{model.desc}</p>
                        </div>
                        {model.active && <Check className="w-[12%] aspect-square text-[#e01e41]" />}
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Scrollable Steps explaining each tab (Spans 6 columns) */}
        <div className="md:col-span-6 space-y-16 py-12">
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
