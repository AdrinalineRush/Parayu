"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  FileText, 
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
  ChevronDown,
  Lock,
  ShieldCheck,
  Home
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
    image: "languages_anim" // Custom animated dropdown scroll list (no sidebar close-up)
  },
  {
    id: "insights",
    badge: "02. Insights Dashboard",
    title: "Real-Time Speech Diagnostics",
    description: "Our core Insights panel summarizes your daily dictation volume, average typing speed (WPM), and fixes made by Parayu. Monitor integrations and view your daily activity streak heatmap completely offline.",
    color: "#e01e41",
    tab: "Home",
    icon: Sparkles,
    image: "insights_anim" // Custom animated count-up close-up view (no sidebar close-up)
  },
  {
    id: "history",
    badge: "03. Tell Me History",
    title: "Double-Click to Copy Anything",
    description: "Every voice transcription is stored in a clean, local history log. Need to use a past translation elsewhere? Simply double-click any past card to copy the text to your clipboard instantly.",
    color: "#a02bb0",
    tab: "Parayu History",
    icon: Clock,
    image: "history_anim" // Custom double-click scroll copy animation view WITH sidebar
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
    icon: FileText,
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

// Languages list replicating the exact screenshot options
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

// Mockup logs demonstrating actual software product usage instead of dev conversation screenshot text
const mockupHistoryItems = [
  { time: "11:24", text: "ഇന്നലെ ഞാൻ അയച്ച ഇമെയിൽ വായിച്ചുനോക്കിയോ? അജണ്ടയിൽ ചില മാറ്റങ്ങൾ വരുത്തേണ്ടതുണ്ട്. (Did you read the email I sent yesterday? We need to make changes to the agenda.)" },
  { time: "11:15", text: "We need to finalize the product requirements document and deploy the local models." },
  { time: "11:08", text: "സുപ്രഭാതം, ഇന്നത്തെ മീറ്റിംഗിന്റെ അജണ്ട ഒന്ന് അയച്ചുതരാൻ താല്പര്യപ്പെടുന്നു. (Good morning, please send today's meeting agenda.)" },
  { time: "10:52", text: "The translation engine will compile offline directly on the CPU without network requests." },
  { time: "10:30", text: "Please restore the clipboard delay settings to six hundred milliseconds." }
];

// Reusable mock navigation item style definition for sidebar menu sync
const sidebarMenuItems = [
  { view: "home", label: "Home", icon: Home, showBadge: false },
  { view: "history", label: "Parayu History", icon: Clock, showBadge: false },
  { view: "dictionary", label: "Dictionary", icon: BookOpen, showBadge: false },
  { view: "snippets", label: "Snippets", icon: FileText, showBadge: false }, 
  { view: "screenwriting", label: "Pro Writing", icon: Pencil, showBadge: true },
  { view: "settings", label: "Settings", icon: Settings, showBadge: false },
  { view: "admin", label: "Admin", icon: ShieldCheck, showBadge: false }
];

// Custom Sidebar Component replicating macOS side card structure exactly (de-congested formatting)
function MockSidebar({ activeView }: { activeView: string }) {
  return (
    <div className="w-[21.7%] bg-[#f6f4f0] dark:bg-zinc-950 border-r border-[#e8e5df] dark:border-zinc-800 flex flex-col justify-between p-2 h-full shrink-0 font-sans select-none">
      
      {/* Upper Area */}
      <div className="space-y-2">
        {/* Brand logo & title */}
        <div className="flex items-center gap-1 px-0.5 py-0.5">
          <img src="/logo.png" alt="Parayu Logo" className="w-4.5 h-4.5 rounded-lg object-contain shrink-0" />
          <span className="text-[10px] font-heading font-black tracking-tight text-zinc-900 dark:text-white leading-none">
            Paray<span className="text-[#e01e41]">u</span>
          </span>
        </div>

        {/* Sidebar Nav Links */}
        <div className="space-y-0">
          {sidebarMenuItems.map((item) => {
            const isActive = item.view === activeView;
            const Icon = item.icon;
            return (
              <div 
                key={item.view}
                className={cn(
                  "flex items-center justify-between py-1 px-1.5 text-[7.5px] font-semibold rounded-[6px] transition-all cursor-pointer relative",
                  isActive
                    ? "bg-[#e01e41]/5 text-[#e01e41] font-[800] pl-[13px]"
                    : "text-zinc-650 dark:text-zinc-400 hover:bg-zinc-200/50 hover:text-zinc-900 hover:pl-[13px]"
                )}
              >
                {/* Active indicator line on the left side of the nav item itself */}
                {isActive && (
                  <div 
                    className="absolute left-[4px] top-1/2 -translate-y-1/2 w-[2.5px] h-[12px] rounded-full" 
                    style={{ background: "linear-gradient(135deg, #e81f3a 0%, #d81d54 58%, #a02bb0 100%)" }}
                  />
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn("w-2.5 h-2.5 shrink-0", isActive ? "text-[#e01e41]" : "text-zinc-550")} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.showBadge && (
                  <span className="bg-[#a02bb0]/10 text-[#a02bb0] text-[5.5px] font-extrabold px-1 rounded-sm tracking-wide shrink-0 scale-90 origin-right">
                    PRO
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Area */}
      <div className="space-y-1.5">
        {/* Enterprise Plan Card matching user screenshot (scaled down) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-lg shadow-sm space-y-1">
          <div className="flex items-start gap-1.5">
            <div className="w-4.5 h-4.5 rounded bg-purple-500/10 text-purple-650 flex items-center justify-center shrink-0">
              <Lock className="w-2.5 h-2.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[7.5px] font-extrabold text-zinc-900 dark:text-zinc-200">Enterprise Plan</div>
              <p className="text-[5.5px] font-medium text-zinc-450 mt-0.5 leading-normal">
                Team active. Contact IT admin.
              </p>
            </div>
          </div>
          <button className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 text-[#e01e41] text-[6.5px] font-extrabold py-0.5 rounded transition-colors shadow-sm">
            License details
          </button>
        </div>

        {/* User profile widget matching Dev Demo avatar */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-1.5 px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Red DD initials circle */}
            <div className="w-5.5 h-5.5 rounded-full bg-[#e01e41] text-white flex items-center justify-center text-[6.5px] font-black shrink-0">
              DD
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[7.5px] font-extrabold truncate text-zinc-900 dark:text-white">Dev Demo</div>
              <div className="text-[6.5px] text-zinc-450 font-bold truncate">Enterprise</div>
            </div>
          </div>
          <ChevronDown className="w-2.5 h-2.5 text-zinc-450 shrink-0" />
        </div>

        {/* App Version */}
        <div className="text-[6px] text-zinc-400 font-bold text-center">Parayu v1.0.0</div>
      </div>

    </div>
  );
}

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

  // Custom animation states for Step 3: History double-click copy
  const [isCopied, setIsCopied] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [showToast, setShowToast] = useState(false);

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

  // Trigger double-click copying automation loops for Step 3
  useEffect(() => {
    if (activeStep !== 2) {
      setIsCopied(false);
      setIsClicking(false);
      setShowToast(false);
      return;
    }

    const runAnimationLoop = () => {
      setIsCopied(false);
      setIsClicking(false);
      setShowToast(false);

      const clickTimer = setTimeout(() => {
        setIsClicking(true);
      }, 3500);

      const copyTimer = setTimeout(() => {
        setIsCopied(true);
        setShowToast(true);
      }, 3700);

      const resetTimer = setTimeout(() => {
        setShowToast(false);
        const hideBadgeTimer = setTimeout(() => {
          setIsCopied(false);
          setIsClicking(false);
        }, 300);
      }, 5800);

      return () => {
        clearTimeout(clickTimer);
        clearTimeout(copyTimer);
        clearTimeout(resetTimer);
      };
    };

    const cleanup = runAnimationLoop();
    const interval = setInterval(runAnimationLoop, 6500);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [activeStep]);

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
                      /* CUSTOM ANIMATED LANGUAGE SELECTOR FRAME (Step 1) - Close-up without sidebar */
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
                      /* CUSTOM ANIMATED INSIGHTS CLOSE-UP (Step 2) - Close-up without sidebar */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950 flex flex-col justify-center p-[6%] select-none font-sans text-zinc-800 dark:text-zinc-250">
                        <div className="space-y-4 w-full max-w-sm mx-auto">
                          
                          {/* Top Row (4 Columns) */}
                          <div className="grid grid-cols-4 gap-2">
                            
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

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-between h-[135px] shadow-sm relative">
                              <div className="text-[8px] font-black text-zinc-450 uppercase tracking-wide">Smart Editing</div>
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-purple-500/10 text-purple-650 flex items-center justify-center bg-purple-500/5">
                                <Pencil className="w-3 h-3" />
                              </div>

                              <div className="my-1.5 leading-tight">
                                <div className="text-[19px] font-heading font-black text-zinc-850 dark:text-zinc-100">
                                  <Counter from={20} to={40} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold mt-0.5">Fixes made by Parayu</div>
                              </div>

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

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-between h-[135px] shadow-sm relative">
                              <div className="text-[8px] font-black text-zinc-450 uppercase tracking-wide">Dictation Volume</div>
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-emerald-500/10 text-emerald-650 flex items-center justify-center bg-emerald-500/5">
                                <Mic className="w-3 h-3" />
                              </div>

                              <div className="my-1.5 leading-tight">
                                <div className="text-[19px] font-heading font-black text-[#1c1b19] dark:text-white">
                                  <Counter from={1900} to={2068} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-450 font-bold mt-0.5">Total words dictated</div>
                              </div>

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

                  if (step.image === "history_anim") {
                    return (
                      /* CUSTOM ANIMATED HISTORY LOG SCROLL + DOUBLE CLICK COPY (Step 3) - WITH Sidebar menu included */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-950 flex flex-row">
                        
                        {/* Sidebar included only for this step! */}
                        <MockSidebar activeView="history" />

                        {/* Right Content area */}
                        <div className="flex-grow flex flex-col p-[3%] font-sans text-zinc-800 dark:text-zinc-250 select-none text-[9.5px] overflow-hidden min-w-0 bg-[#faf9f7] dark:bg-zinc-950">
                          
                          {/* Status / Instruction bar replicating screenshot */}
                          <div className="flex justify-between items-center mb-2.5 shrink-0 px-1">
                            <div className="flex items-center gap-1.5 text-zinc-450 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse" />
                              <span>Press</span>
                              <span className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded font-mono font-extrabold text-[#1c1b19] dark:text-white">⌥ Option</span>
                              <span>to start dictating</span>
                            </div>
                            {/* Dropdown replica */}
                            <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-2.5 py-1 rounded-lg shadow-sm text-[8.5px] font-black text-[#1c1b19] dark:text-white flex items-center gap-1 cursor-default">
                              <span>🌐 English</span>
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                          </div>

                          {/* History list wrapper */}
                          <div className="flex-grow overflow-hidden relative px-1">
                            <motion.div
                              animate={
                                activeStep === 2
                                  ? { y: [0, -95, -95, 0] }
                                  : { y: 0 }
                              }
                              transition={{
                                duration: 5.5,
                                times: [0, 0.4, 0.75, 1],
                                repeat: Infinity,
                                repeatDelay: 1,
                                ease: "easeInOut"
                              }}
                              className="space-y-2.5 pr-1 py-1"
                            >
                              {mockupHistoryItems.map((h, i) => {
                                const isTargetCard = i === 0; // Target the top card for copy animation
                                return (
                                  <motion.div 
                                    key={i}
                                    animate={
                                      isTargetCard && isCopied
                                        ? { 
                                            borderColor: "#e01e41", 
                                            boxShadow: "0 0 0 1px #e01e41, 0 4px 20px rgba(0, 0, 0, 0.015)" 
                                          }
                                        : { 
                                            borderColor: "#e8e5df", 
                                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.015)" 
                                          }
                                    }
                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl flex flex-col justify-start relative transition-colors duration-200"
                                  >
                                    <div className="flex justify-between items-center text-[7px] font-bold text-zinc-450 mb-1.5">
                                      <span>{h.time}</span>
                                      <span 
                                        className={cn(
                                          "font-black text-[#e01e41] text-[8px] transition-opacity duration-150",
                                          isTargetCard && isCopied ? "opacity-100" : "opacity-0"
                                        )}
                                      >
                                        Copied
                                      </span>
                                    </div>
                                    <p className="text-[9.5px] text-[#1c1b19] dark:text-zinc-200 leading-normal font-semibold">
                                      {h.text}
                                    </p>
                                  </motion.div>
                                );
                              })}
                            </motion.div>

                            {/* Circular pointer indicator simulating cursor dot double clicking */}
                            <AnimatePresence>
                              {activeStep === 2 && (
                                <motion.div
                                  initial={{ opacity: 0, x: 230, y: 130 }}
                                  animate={{ 
                                    opacity: 1,
                                    x: [230, 160, 160, 230],
                                    y: [130, 35, 35, 130],
                                    scale: isClicking ? [1, 0.8, 1.1, 1] : 1
                                  }}
                                  exit={{ opacity: 0 }}
                                  transition={{
                                    duration: 5.5,
                                    times: [0, 0.5, 0.75, 1],
                                    repeat: Infinity,
                                    repeatDelay: 1,
                                    ease: "easeInOut"
                                  }}
                                  className="absolute w-4 h-4 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
                                >
                                  {/* Core clicking point */}
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#e01e41]" />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Dynamic Toast popup mimicking feedback */}
                            <AnimatePresence>
                              {showToast && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  className="absolute top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white font-bold text-[8.5px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 z-50 border border-white/10"
                                >
                                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                                  <span>Copied to clipboard!</span>
                                </motion.div>
                              )}
                            </AnimatePresence>

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
