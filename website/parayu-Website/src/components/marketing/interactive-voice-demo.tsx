"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { 
  Sparkles, 
  Keyboard, 
  Languages, 
  Monitor, 
  Flame,
  Clock,
  BookOpen,
  Settings,
  Search,
  Check,
  Mic,
  Pencil,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Static definitions of all app views in scrollytelling walkthrough
const scrollSteps = [
  {
    id: "languages",
    badge: "01. Language Selection",
    title: "English, Malayalam & Indian Languages",
    description: "Parayu is built for regional dialects. Switch instantly between English, Malayalam, and major Indian languages. Our C++ offline engine translates and cleans up spoken speech natively on your device.",
    color: "#e01e41",
    tab: "Languages",
    icon: Languages,
    image: "languages_anim" // Custom animated view
  },
  {
    id: "insights",
    badge: "02. Insights Dashboard",
    title: "Real-Time Speech Diagnostics",
    description: "Our core Insights panel summarizes your daily dictation volume, average typing speed (WPM), and fixes made by Parayu. Monitor integrations and view your daily activity streak heatmap completely offline.",
    color: "#e01e41",
    tab: "Home",
    icon: Sparkles,
    image: "insights_anim" // Custom animated count-up close-up view matching screenshot
  },
  {
    id: "history",
    badge: "03. Tell Me History",
    title: "Double-Click to Copy Anything",
    description: "Every voice transcription is stored in a clean, local history log. Need to use a past translation elsewhere? Simply double-click any past card to copy the text to your clipboard instantly.",
    color: "#a02bb0",
    tab: "Parayu History",
    icon: Clock,
    image: "history.png"
  },
  {
    id: "dictionary",
    badge: "04. Custom Voice Dictionary",
    title: "Prevent Transcription Errors",
    description: "Map specialized jargon, accents, or misheard words. Define 'misheard → correct' word pairs (e.g., spoken Malayalam dialect to fluent English replacements) so the C++ engine corrects them automatically.",
    color: "#1f6f63",
    tab: "Dictionary",
    icon: BookOpen,
    image: "dictionary.png"
  },
  {
    id: "snippets",
    badge: "05. Text Expansion Snippets",
    title: "Shorthand Speech Commands",
    description: "Create text macro templates. Dictate custom trigger phrases like 'my signature' or 'project update' to instantly expand into long multiline email templates or boilerplate code blocks.",
    color: "#ff8a1f",
    tab: "Snippets",
    icon: Keyboard,
    image: "snippets.png"
  },
  {
    id: "settings",
    badge: "06. Core Brain Switch",
    title: "Pick Your On-Device Brain",
    description: "Toggle hotkeys and speech models. Choose the speech brain that fits your hardware: LOW (190MB/fast), MEDIUM (539MB/Malayalam Optimized), HIGH (844MB/Multilingual), or PRO (2.9GB/Full Float 16).",
    color: "#0ea5e9",
    tab: "Settings",
    icon: Settings,
    image: "settings.png"
  }
];

// Languages list replicating the exact screenshot options and major Indian languages
const languageList = [
  { name: "English", beta: false },
  { name: "Malayalam", highlight: true, beta: false },
  { name: "Hindi", beta: false },
  { name: "Tamil", beta: false },
  { name: "Telugu", beta: false },
  { name: "Kannada", beta: false },
  { name: "Bengali", beta: false },
  { name: "Marathi", beta: false },
  { name: "Gujarati", beta: false },
  { name: "Urdu", beta: false },
  { name: "Punjabi", beta: false },
  { name: "Afrikaans", beta: true },
  { name: "Albanian", beta: true },
  { name: "Amharic", beta: true },
  { name: "Arabic", beta: true },
  { name: "Armenian", beta: true },
  { name: "Assamese", beta: true }
];

// Lightweight count-up hook for moving numbers
function Counter({ from, to, duration = 1.2, active }: { from: number, to: number, duration?: number, active: boolean }) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!active) {
      setCount(from);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [from, to, duration, active]);

  return <span>{count.toLocaleString()}</span>;
}

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

  return (
    <div ref={containerRef} className={cn("max-w-6xl mx-auto px-4 relative", className)}>
      
      {/* 2-Column Sticky Scrollytelling Layout */}
      <div className="grid md:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Sticky macOS Application Mockup Window */}
        <div className="md:col-span-6 sticky top-28 h-[480px] flex items-center justify-center shrink-0 z-20">
          
          {/* Frameless mockup window in default 1180:740 ratio with 3D tilt animations */}
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
            
            {/* macOS Window Titlebar Traffic-Light Buttons (Overlayed on top of screens for authenticity) */}
            <div className="absolute top-[4.5%] left-[3.5%] flex gap-1.5 z-30 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
            </div>

            {/* Screenshots container sliding vertically */}
            <div className="w-full h-full overflow-hidden relative bg-white">
              <motion.div
                animate={{ y: `-${activeStep * 100}%` }}
                transition={{ type: "spring", stiffness: 95, damping: 21 }}
                className="w-full h-full flex flex-col"
              >
                {scrollSteps.map((step) => {
                  if (step.image === "languages_anim") {
                    return (
                      /* CUSTOM ANIMATED LANGUAGE SELECTOR FRAME (Step 1) */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950 flex items-center justify-center p-[6%]">
                        
                        {/* High-fidelity dropdown window reproducing user's exact screenshot */}
                        <div className="w-full max-w-[280px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl flex flex-col overflow-hidden text-zinc-800 dark:text-zinc-200 font-sans p-[4%] gap-[4%] h-[85%]">
                          
                          {/* Search bar inside red outline */}
                          <div className="relative border border-[#e01e41] rounded-xl px-3 py-2 flex items-center gap-2 shrink-0 bg-white dark:bg-zinc-950 shadow-sm">
                            <Search className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">Search language...</span>
                          </div>

                          {/* Scrolling language list moving upwards */}
                          <div className="flex-grow overflow-hidden relative">
                            <motion.div
                              animate={{ y: ["0%", "-68%"] }}
                              transition={{ 
                                repeat: Infinity, 
                                duration: 16, 
                                ease: "linear"
                              }}
                              className="flex flex-col gap-0.5 text-xs font-semibold py-1 pr-1"
                            >
                              {/* Render languages twice to achieve infinite seamless loop */}
                              {[...languageList, ...languageList].map((lang, idx) => (
                                <div 
                                  key={idx} 
                                  className={cn(
                                    "flex justify-between items-center py-2 px-2.5 rounded-lg",
                                    lang.highlight ? "text-[#e01e41] font-extrabold bg-[#e01e41]/5" : "text-zinc-700 dark:text-zinc-350"
                                  )}
                                >
                                  <span>{lang.name}</span>
                                  {lang.beta && (
                                    <span className="text-[7.5px] font-black uppercase text-zinc-450 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded tracking-wide">
                                      BETA
                                    </span>
                                  )}
                                </div>
                              ))}
                            </motion.div>
                            
                            {/* Visual scrollbar mimicking screenshot */}
                            <div className="absolute right-0 top-2 bottom-2 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-850 flex justify-center py-1">
                              <div className="w-1 h-8 rounded-full bg-zinc-450 dark:bg-zinc-700" />
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  }

                  if (step.image === "insights_anim") {
                    return (
                      /* CUSTOM ANIMATED INSIGHTS CLOSE-UP (Step 2) - Matches exact screenshot cards layout */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950 flex flex-col justify-center p-[4%] select-none font-sans text-zinc-800 dark:text-zinc-250">
                        <div className="space-y-[3%] w-full max-w-[490px] mx-auto scale-95 md:scale-100">
                          
                          {/* Top Row (4 Columns) */}
                          <div className="grid grid-cols-4 gap-2">
                            
                            {/* Words Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-[#e01e41]/5 text-[#e01e41] flex items-center justify-center shrink-0">
                                <Mic className="w-3.5 h-3.5 fill-[#e01e41]/10" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[12px] font-heading font-black truncate">
                                  <Counter from={1900} to={2068} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold uppercase mt-0.5">Words</div>
                              </div>
                            </div>

                            {/* WPM Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-purple-500/5 text-purple-600 flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[12px] font-heading font-black truncate">
                                  <Counter from={80} to={102} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold uppercase mt-0.5">WPM</div>
                              </div>
                            </div>

                            {/* Fixes Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-orange-500/5 text-orange-600 flex items-center justify-center shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[12px] font-heading font-black truncate">
                                  <Counter from={15} to={40} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold uppercase mt-0.5">Fixes</div>
                              </div>
                            </div>

                            {/* Status Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-emerald-500/5 text-emerald-600 flex items-center justify-center shrink-0">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[11px] font-heading font-black text-emerald-600 truncate">Ready</div>
                                <div className="text-[7.5px] text-zinc-450 font-bold uppercase mt-0.5">Model ready</div>
                              </div>
                            </div>

                          </div>

                          {/* Bottom Row (3 Columns) */}
                          <div className="grid grid-cols-3 gap-2">
                            
                            {/* TYPING SPEED Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-between h-[135px] shadow-sm relative">
                              <div className="text-[8px] font-black text-zinc-450 uppercase tracking-wide">Typing Speed</div>
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-rose-500/10 text-rose-500 flex items-center justify-center bg-rose-500/5">
                                <Clock className="w-3 h-3" />
                              </div>
                              
                              <div className="relative w-full flex justify-center mt-1">
                                <svg viewBox="0 0 170 96" className="w-[82px] h-[44px]">
                                  <path d="M 15 85 A 70 70 0 0 1 155 85" fill="none" stroke="#ebe7df" strokeWidth="12" strokeLinecap="round" />
                                  <motion.path 
                                    initial={{ pathLength: 0 }}
                                    animate={activeStep === 1 ? { pathLength: 1 } : { pathLength: 0 }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                    d="M 15 85 A 70 70 0 0 1 112 20" 
                                    fill="none" 
                                    stroke="url(#insightsGrad2)" 
                                    strokeWidth="12" 
                                    strokeLinecap="round" 
                                  />
                                  <defs>
                                    <linearGradient id="insightsGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#e81f3a" />
                                      <stop offset="100%" stopColor="#a02bb0" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-end">
                                  <span className="text-[12px] font-black leading-none text-[#1c1b19] dark:text-white">
                                    <Counter from={80} to={102} active={activeStep === 1} />
                                  </span>
                                  <span className="text-[6.5px] font-bold text-[#706b61] uppercase mt-0.5">wpm</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-[7.5px] font-bold text-zinc-500 border-t border-zinc-150 pt-1.5 mt-1 shrink-0">
                                <span>Target 120 wpm</span>
                                <span className="font-extrabold text-[#e01e41]">18 to goal</span>
                              </div>
                            </div>

                            {/* SMART EDITING Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-between h-[135px] shadow-sm relative">
                              <div className="text-[8px] font-black text-zinc-450 uppercase tracking-wide">Smart Editing</div>
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-purple-500/10 text-purple-600 flex items-center justify-center bg-purple-500/5">
                                <Pencil className="w-3 h-3" />
                              </div>

                              <div className="my-1.5 leading-tight">
                                <div className="text-[19px] font-heading font-black text-zinc-850 dark:text-zinc-100">
                                  <Counter from={20} to={40} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold mt-0.5">Fixes made by Parayu</div>
                              </div>

                              {/* Nested rows inside smart editing */}
                              <div className="space-y-1 text-[8.5px] font-bold">
                                <div className="flex items-center justify-between bg-[#faf9f7] dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 px-2 py-1 rounded-lg">
                                  <div className="flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      <Counter from={15} to={33} active={activeStep === 1} /> corrections
                                    </span>
                                  </div>
                                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                                </div>
                                <div className="flex items-center justify-between bg-[#faf9f7] dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 px-2 py-1 rounded-lg">
                                  <div className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3 text-[#a02bb0]" />
                                    <span>
                                      <Counter from={2} to={7} active={activeStep === 1} /> dictionary
                                    </span>
                                  </div>
                                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                                </div>
                              </div>
                            </div>

                            {/* DICTATION VOLUME Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-between h-[135px] shadow-sm relative">
                              <div className="text-[8px] font-black text-zinc-450 uppercase tracking-wide">Dictation Volume</div>
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-emerald-500/10 text-emerald-600 flex items-center justify-center bg-emerald-500/5">
                                <Mic className="w-3 h-3" />
                              </div>

                              <div className="my-1.5 leading-tight">
                                <div className="text-[19px] font-heading font-black text-zinc-850 dark:text-zinc-100">
                                  <Counter from={1900} to={2068} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold mt-0.5">Total words dictated</div>
                              </div>

                              {/* Nested rows inside dictation volume */}
                              <div className="space-y-1 text-[8.5px] font-bold">
                                <div className="flex items-center justify-between bg-[#faf9f7] dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 px-2 py-1 rounded-lg">
                                  <div className="flex items-center gap-1">
                                    <Monitor className="w-3 h-3 text-[#e01e41]" />
                                    <span>
                                      <Counter from={1900} to={2068} active={activeStep === 1} /> words pasted
                                    </span>
                                  </div>
                                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                                </div>
                                <div className="flex items-center justify-between bg-[#faf9f7] dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 px-2 py-1 rounded-lg">
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse block shrink-0" />
                                    <span className="text-emerald-600 font-extrabold">Ready</span>
                                    <span className="text-zinc-450 font-normal">on-device engine</span>
                                  </div>
                                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                                </div>
                              </div>
                            </div>

                          </div>

                        </div>
                      </div>
                    );
                  }

                  return (
                    /* STATIC RELEASE SCREENSHOT PANELS */
                    <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa]">
                      <img 
                        src={`/screenshots/${step.image}`} 
                        alt={step.title}
                        className="w-full h-full object-cover pointer-events-none" 
                      />
                    </div>
                  );
                })}
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
