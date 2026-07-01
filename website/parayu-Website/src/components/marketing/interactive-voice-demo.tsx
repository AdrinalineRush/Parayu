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
  Home,
  Globe,
  Calendar,
  Plus,
  Trash2,
  ArrowRight,
  Download,
  Cpu
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
    id: "offline_ai",
    badge: "04. Active Offline AI",
    title: "On-Device Speech Cleanup",
    description: "Toggle Active Offline AI to automatically clean up stutters, repetitions, and grammar mistakes as you speak. Switch between Fast Mode for speed or Smart Mode for deep linguistic corrections—all running 100% locally.",
    color: "#e01e41",
    tab: "Offline AI",
    icon: Sparkles,
    image: "offline_ai_anim" // Custom animated toggles and text correction loop (no sidebar close-up)
  },
  {
    id: "dictionary",
    badge: "05. Custom Voice Dictionary",
    title: "Prevent Transcription Errors",
    description: "Map specialized jargon, accents, or misheard words. Define 'misheard → correct' word pairs (e.g., spoken Malayalam dialect to fluent English replacements) so the C++ engine corrects them automatically.",
    color: "#1f6f63",
    tab: "Dictionary",
    icon: BookOpen,
    image: "dictionary_anim" // Custom animated dictionary entry + speech rewrite loop WITH sidebar
  },
  {
    id: "snippets",
    badge: "06. Text Expansion Snippets",
    title: "Shorthand Speech Commands",
    description: "Create text macro templates. Dictate custom trigger phrases like 'my signature' or 'project update' to instantly expand into long multiline email templates or boilerplate code blocks.",
    color: "#ff8a1f",
    tab: "Snippets",
    icon: FileText,
    image: "snippets_anim" // Custom animated snippet shortcut addition + transcription expand loop WITH sidebar
  },
  {
    id: "settings",
    badge: "07. Core Brain Switch",
    title: "Pick Your On-Device Brain",
    description: "Toggle hotkeys and speech models. Choose the speech brain that fits your hardware: LOW (190MB/fast), MEDIUM (539MB/Malayalam Optimized), HIGH (844MB/Multilingual), or PRO (2.9GB/Full Float 16).",
    color: "#0ea5e9",
    tab: "Settings",
    icon: Settings,
    image: "settings_anim" // Custom animated brain selector toggle + detail viewer WITH sidebar
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

// Brain features metadata for the Step 7 Switch simulation
const brainOptions = [
  {
    id: "low",
    name: "LOW",
    size: "190 MB",
    badge: "RECOMMENDED",
    desc: "Lightweight, highly optimized model that delivers solid accuracy with fast inference speed.",
    status: "NEEDS DOWNLOAD",
    actionText: "Download",
    rightIcon: "download",
    cursorY: 52
  },
  {
    id: "medium",
    name: "MEDIUM",
    size: "539 MB",
    badge: "MALAYALAM OPTIMIZED",
    desc: "Specifically fine-tuned for regional Malayalam speech translation, providing enhanced voice parsing.",
    status: "NEEDS DOWNLOAD",
    actionText: "Download",
    rightIcon: "download",
    cursorY: 82
  },
  {
    id: "high",
    name: "HIGH",
    size: "844 MB",
    badge: "MULTILINGUAL",
    desc: "High-fidelity multilingual model supporting major Indian and European languages completely offline.",
    status: "INSTALLED",
    actionText: "Select Model",
    rightIcon: "green-check",
    cursorY: 112
  },
  {
    id: "pro",
    name: "PRO",
    size: "2.9 GB",
    badge: "FULL FLOAT 16",
    desc: "Maximum accuracy model running in full Float 16. Requires dedicated GPU hardware for optimal speed.",
    status: "INSTALLED",
    actionText: "Select Model",
    rightIcon: "red-check",
    cursorY: 142
  }
];

// Custom Sidebar Component replicating macOS side card structure exactly (de-congested formatting)
function MockSidebar({ activeView }: { activeView: string }) {
  return (
    <div className="w-[21.7%] bg-[#f6f4f0] dark:bg-zinc-950 border-r border-[#e8e5df] dark:border-zinc-800 flex flex-col justify-between p-2.5 h-full shrink-0 font-sans select-none">
      
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
                  <Icon className={cn("w-2.5 h-2.5 shrink-0", isActive ? "text-[#e01e41]" : "text-zinc-555")} />
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
          <button className="w-full bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 text-[#e01e41] text-[6.5px] font-extrabold py-0.5 rounded transition-colors shadow-sm">
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
          <ChevronDown className="w-2.5 h-2.5 text-zinc-455 shrink-0" />
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

  // Custom animation states for Step 1: Language selection with clean app-hints surrounding layout
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [selectedLang, setSelectedLang] = useState("English");
  const [langListScrollY, setLangListScrollY] = useState(0);
  const [langCursor, setLangCursor] = useState({ x: 300, y: 110, opacity: 0, scale: 1 });

  // Custom animation states for Step 3: History double-click copy
  const [isCopied, setIsCopied] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Custom animation states for Step 4: Active Offline AI demo toggling & text correction
  const [aiActive, setAiActive] = useState(false);
  const [modeActive, setModeActive] = useState("fast"); // "fast" | "smart"
  const [demoText, setDemoText] = useState("");
  const [correctionState, setCorrectionState] = useState("typing"); // "typing" | "waiting" | "correcting" | "clean"

  // Custom animation states for Step 5: Dictionary entry creation + translation rewrite loop
  const [misheardVal, setMisheardVal] = useState("");
  const [correctVal, setCorrectVal] = useState("");
  const [dictAdded, setDictAdded] = useState(false);
  const [dictBtnPress, setDictBtnPress] = useState(false);
  const [dictCursor, setDictCursor] = useState({ x: 260, y: 140, opacity: 0, scale: 1 });
  const [dictDemoText, setDictDemoText] = useState("");
  const [dictDemoState, setDictDemoState] = useState("silent"); // "silent" | "untranslated" | "scanning" | "translated"

  // Custom animation states for Step 6: Snippets entry shortcut addition + shorthand expand loop
  const [snipTriggerVal, setSnipTriggerVal] = useState("");
  const [snipExpandVal, setSnipExpandVal] = useState("");
  const [snipAdded, setSnipAdded] = useState(false);
  const [snipBtnPress, setSnipBtnPress] = useState(false);
  const [snipCursor, setSnipCursor] = useState({ x: 260, y: 140, opacity: 0, scale: 1 });
  const [snipDemoText, setSnipDemoText] = useState("");
  const [snipDemoState, setSnipDemoState] = useState("silent"); // "silent" | "unexpanded" | "matching" | "expanded"

  // Custom animation states for Step 7: Brain Switch selection selector loop
  const [selectedBrain, setSelectedBrain] = useState(0); // 0: LOW, 1: MEDIUM, 2: HIGH, 3: PRO
  const [brainBtnPress, setBrainBtnPress] = useState(false);
  const [brainCursor, setBrainCursor] = useState({ x: 300, y: 52, opacity: 0, scale: 1 });

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

  // Scale and translate transforms
  const scale = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.96, 1.03, 1.03, 0.96]);
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

  // Trigger Step 1: Language selection with clean app-hints surrounding layout animation loops
  useEffect(() => {
    if (activeStep !== 0) {
      setDropdownOpen(true);
      setSelectedLang("English");
      setLangListScrollY(0);
      setLangCursor({ x: 300, y: 110, opacity: 0, scale: 1 });
      return;
    }

    const runLangLoop = () => {
      setDropdownOpen(true);
      setSelectedLang("English");
      setLangListScrollY(0);
      setLangCursor({ x: 300, y: 110, opacity: 0, scale: 1 });

      // 0.8s: Cursor appears
      const showCursorTimer = setTimeout(() => {
        setLangCursor(prev => ({ ...prev, opacity: 1, x: 300, y: 90 }));
      }, 800);

      // 1.5s - 2.8s: List scrolls upwards (simulating list scroll to Malayalam)
      const scrollTimer = setTimeout(() => {
        setLangListScrollY(-26); 
      }, 1500);

      // 3.0s: Cursor moves directly over Malayalam choice row inside dropdown
      const moveCursorTimer = setTimeout(() => {
        setLangCursor(prev => ({ ...prev, x: 280, y: 92 }));
      }, 3000);

      // 3.6s: Click Malayalam (cursor clicks, select state changes)
      const clickTimer = setTimeout(() => {
        setLangCursor(prev => ({ ...prev, scale: 0.8 }));
        setSelectedLang("Malayalam");
      }, 3600);

      // 3.8s: Cursor releases and dropdown menu closes
      const closeDropdownTimer = setTimeout(() => {
        setLangCursor(prev => ({ ...prev, scale: 1, opacity: 0 }));
        setDropdownOpen(false);
      }, 4000);

      // 6.2s: Reset loop (opens dropdown again)
      const resetTimer = setTimeout(() => {
        setDropdownOpen(true);
        setSelectedLang("English");
        setLangListScrollY(0);
      }, 6200);

      return () => {
        clearTimeout(showCursorTimer);
        clearTimeout(scrollTimer);
        clearTimeout(moveCursorTimer);
        clearTimeout(clickTimer);
        clearTimeout(closeDropdownTimer);
        clearTimeout(resetTimer);
      };
    };

    const cleanup = runLangLoop();
    const interval = setInterval(runLangLoop, 7500);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [activeStep]);

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

  // Trigger Offline AI toggling and automatic speech transcription block correction loop for Step 4
  useEffect(() => {
    if (activeStep !== 3) {
      setAiActive(false);
      setModeActive("fast");
      setDemoText("");
      setCorrectionState("typing");
      return;
    }

    // Sequence loop simulating real software transcription pop (not typewriter style)
    const runAiLoop = () => {
      setAiActive(false);
      setModeActive("fast");
      setCorrectionState("typing");
      setDemoText("");

      const transcriptionPopTimer = setTimeout(() => {
        setCorrectionState("waiting");
        setDemoText("We need... we need to test... test the model offline... offline.");
      }, 1200);

      const toggleOnTimer = setTimeout(() => {
        setAiActive(true);
      }, 2400);

      const modeSmartTimer = setTimeout(() => {
        setModeActive("smart");
      }, 3100);

      const correctingTimer = setTimeout(() => {
        setCorrectionState("correcting");
      }, 3700);

      const correctedTimer = setTimeout(() => {
        setCorrectionState("clean");
        setDemoText("We need to test the model offline.");
      }, 4100);

      return () => {
        clearTimeout(transcriptionPopTimer);
        clearTimeout(toggleOnTimer);
        clearTimeout(modeSmartTimer);
        clearTimeout(correctingTimer);
        clearTimeout(correctedTimer);
      };
    };

    const cleanup = runAiLoop();
    const interval = setInterval(runAiLoop, 7200);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [activeStep]);

  // Trigger Step 5: Custom Dictionary Entry + Transcription morph loop animation
  useEffect(() => {
    if (activeStep !== 4) {
      setMisheardVal("");
      setCorrectVal("");
      setDictAdded(false);
      setDictBtnPress(false);
      setDictCursor({ x: 260, y: 140, opacity: 0, scale: 1 });
      setDictDemoText("");
      setDictDemoState("silent");
      return;
    }

    const runDictLoop = () => {
      setMisheardVal("");
      setCorrectVal("");
      setDictAdded(false);
      setDictBtnPress(false);
      setDictCursor({ x: 260, y: 140, opacity: 0, scale: 1 });
      setDictDemoText("");
      setDictDemoState("silent");

      const cursorShowTimer = setTimeout(() => {
        setDictCursor(prev => ({ ...prev, opacity: 1, x: 200, y: 55 }));
      }, 400);

      // Typing "parayoo"
      const typeMisheardTimer = setTimeout(() => {
        setMisheardVal("parayoo");
      }, 1000);

      const cursorMoveCorrectTimer = setTimeout(() => {
        setDictCursor(prev => ({ ...prev, x: 280, y: 55 }));
      }, 1600);

      // Typing "Parayu"
      const typeCorrectTimer = setTimeout(() => {
        setCorrectVal("Parayu");
      }, 2100);

      const cursorMoveAddTimer = setTimeout(() => {
        setDictCursor(prev => ({ ...prev, x: 372, y: 55 }));
      }, 2700);

      // Click Add
      const clickAddTimer = setTimeout(() => {
        setDictCursor(prev => ({ ...prev, scale: 0.85 }));
        setDictBtnPress(true);
        setDictAdded(true);
      }, 3305);

      const releaseAddTimer = setTimeout(() => {
        setDictCursor(prev => ({ ...prev, scale: 1, opacity: 0 }));
        setDictBtnPress(false);
      }, 3600);

      // Dictation voice pop
      const voicePopTimer = setTimeout(() => {
        setDictDemoState("untranslated");
        setDictDemoText("Welcome to parayoo.");
      }, 4300);

      // Scanning word match
      const scannerTimer = setTimeout(() => {
        setDictDemoState("scanning");
      }, 5400);

      // Word morph / replacepop
      const morphTimer = setTimeout(() => {
        setDictDemoState("translated");
        setDictDemoText("Welcome to Parayu.");
      }, 6000);

      return () => {
        clearTimeout(cursorShowTimer);
        clearTimeout(typeMisheardTimer);
        clearTimeout(cursorMoveCorrectTimer);
        clearTimeout(typeCorrectTimer);
        clearTimeout(cursorMoveAddTimer);
        clearTimeout(clickAddTimer);
        clearTimeout(releaseAddTimer);
        clearTimeout(voicePopTimer);
        clearTimeout(scannerTimer);
        clearTimeout(morphTimer);
      };
    };

    const cleanup = runDictLoop();
    const interval = setInterval(runDictLoop, 9000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [activeStep]);

  // Trigger Step 6: Text Expansion Snippets Entry + Expansion demo loop animation (calendly link example)
  useEffect(() => {
    if (activeStep !== 5) {
      setSnipTriggerVal("");
      setSnipExpandVal("");
      setSnipAdded(false);
      setSnipBtnPress(false);
      setSnipCursor({ x: 260, y: 140, opacity: 0, scale: 1 });
      setSnipDemoText("");
      setSnipDemoState("silent");
      return;
    }

    const runSnipLoop = () => {
      setSnipTriggerVal("");
      setSnipExpandVal("");
      setSnipAdded(false);
      setSnipBtnPress(false);
      setSnipCursor({ x: 260, y: 140, opacity: 0, scale: 1 });
      setSnipDemoText("");
      setSnipDemoState("silent");

      const cursorShowTimer = setTimeout(() => {
        setSnipCursor(prev => ({ ...prev, opacity: 1, x: 200, y: 55 }));
      }, 400);

      // Typing trigger phrase "my link"
      const typeTriggerTimer = setTimeout(() => {
        setSnipTriggerVal("my link");
      }, 1000);

      const cursorMoveExpandTimer = setTimeout(() => {
        setSnipCursor(prev => ({ ...prev, x: 280, y: 55 }));
      }, 1600);

      // Typing expansion text "calendly.com/dev-demo"
      const typeExpandTimer = setTimeout(() => {
        setSnipExpandVal("calendly.com/dev-demo");
      }, 2100);

      const cursorMoveAddTimer = setTimeout(() => {
        setSnipCursor(prev => ({ ...prev, x: 372, y: 55 }));
      }, 2700);

      // Click Add
      const clickAddTimer = setTimeout(() => {
        setSnipCursor(prev => ({ ...prev, scale: 0.85 }));
        setSnipBtnPress(true);
        setSnipAdded(true);
      }, 3300);

      const releaseAddTimer = setTimeout(() => {
        setSnipCursor(prev => ({ ...prev, scale: 1, opacity: 0 }));
        setSnipBtnPress(false);
      }, 3600);

      // Dictation voice pop
      const voicePopTimer = setTimeout(() => {
        setSnipDemoState("unexpanded");
        setSnipDemoText("Please book a slot through my link.");
      }, 4300);

      // Scanning mapping match
      const scannerTimer = setTimeout(() => {
        setSnipDemoState("matching");
      }, 5400);

      // Instant text expansion pop
      const expandTimer = setTimeout(() => {
        setSnipDemoState("expanded");
        setSnipDemoText("Please book a slot through calendly.com/dev-demo.");
      }, 6000);

      return () => {
        clearTimeout(cursorShowTimer);
        clearTimeout(typeTriggerTimer);
        clearTimeout(cursorMoveExpandTimer);
        clearTimeout(typeExpandTimer);
        clearTimeout(cursorMoveAddTimer);
        clearTimeout(clickAddTimer);
        clearTimeout(releaseAddTimer);
        clearTimeout(voicePopTimer);
        clearTimeout(scannerTimer);
        clearTimeout(expandTimer);
      };
    };

    const cleanup = runSnipLoop();
    const interval = setInterval(runSnipLoop, 9000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [activeStep]);

  // Trigger Step 7: Brain Switch toggling and description cards updates loop animation
  useEffect(() => {
    if (activeStep !== 6) {
      setSelectedBrain(0);
      setBrainBtnPress(false);
      setBrainCursor({ x: 300, y: 52, opacity: 0, scale: 1 });
      return;
    }

    const runBrainLoop = () => {
      setSelectedBrain(0);
      setBrainBtnPress(false);
      setBrainCursor({ x: 300, y: 52, opacity: 0, scale: 1 });

      const cursorShowTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, opacity: 1, x: 260, y: 52 }));
      }, 600);

      // Transition 1: Select MEDIUM
      const cursorMediumTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, x: 260, y: 82 }));
      }, 1500);

      const clickMediumTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 0.85 }));
        setBrainBtnPress(true);
        setSelectedBrain(1);
      }, 2000);

      const releaseMediumTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 1 }));
        setBrainBtnPress(false);
      }, 2200);

      // Transition 2: Select HIGH
      const cursorHighTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, x: 260, y: 112 }));
      }, 3400);

      const clickHighTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 0.85 }));
        setBrainBtnPress(true);
        setSelectedBrain(2);
      }, 3900);

      const releaseHighTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 1 }));
        setBrainBtnPress(false);
      }, 4100);

      // Transition 3: Select PRO
      const cursorProTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, x: 260, y: 142 }));
      }, 5300);

      const clickProTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 0.85 }));
        setBrainBtnPress(true);
        setSelectedBrain(3);
      }, 5800);

      const releaseProTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 1 }));
        setBrainBtnPress(false);
      }, 6000);

      // Transition 4: Return to LOW
      const cursorLowTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, x: 260, y: 52 }));
      }, 7200);

      const clickLowTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 0.85 }));
        setBrainBtnPress(true);
        setSelectedBrain(0);
      }, 7700);

      const releaseLowTimer = setTimeout(() => {
        setBrainCursor(prev => ({ ...prev, scale: 1 }));
        setBrainBtnPress(false);
      }, 7900);

      return () => {
        clearTimeout(cursorShowTimer);
        clearTimeout(cursorMediumTimer);
        clearTimeout(clickMediumTimer);
        clearTimeout(releaseMediumTimer);
        clearTimeout(cursorHighTimer);
        clearTimeout(clickHighTimer);
        clearTimeout(releaseHighTimer);
        clearTimeout(cursorProTimer);
        clearTimeout(clickProTimer);
        clearTimeout(releaseProTimer);
        clearTimeout(cursorLowTimer);
        clearTimeout(clickLowTimer);
        clearTimeout(releaseLowTimer);
      };
    };

    const cleanup = runBrainLoop();
    const interval = setInterval(runBrainLoop, 9500);

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
      
      {/* 2-Column Sticky Scrollytelling Layout - Improvised grid width (7 cols left, 5 cols right) */}
      <div className="grid md:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Sticky macOS Application Mockup Window (Spans 7 columns, enlarged and centered in viewport) */}
        <div className="md:col-span-7 sticky top-36 h-[520px] flex items-center justify-center shrink-0 z-20">
          
          {/* Frameless mockup window (Max width enlarged to 660px for premium readability) */}
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
            className="w-full max-w-[660px] aspect-[1180/740] bg-[#fcfbfa] dark:bg-zinc-950 border border-[#e8e5df] dark:border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] rounded-2xl flex flex-row overflow-hidden select-none relative animate-in fade-in duration-300 cursor-grab active:cursor-grabbing"
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
                      /* CUSTOM ANIMATED LANGUAGE SELECTOR FRAME (Step 1) - Focused drop-down trigger with top header hints only */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#faf9f7] dark:bg-zinc-950 flex flex-col p-[4%] justify-start">
                        
                        {/* Header Bar containing Language button, Date button, and green Ready pill (app header suggestions) */}
                        <div className="flex justify-between items-center mb-4 shrink-0 px-2 border-b border-zinc-200/60 dark:border-zinc-850 pb-3 mt-4">
                          {/* Green model status badge */}
                          <div className="border border-emerald-600/20 bg-emerald-600/5 text-emerald-600 font-extrabold text-[8px] px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse block" />
                            <span>Ready</span>
                          </div>

                          {/* Dropdown triggers on the right side */}
                          <div className="flex items-center gap-2.5">
                            {/* Language dropdown button mimicking screenshot */}
                            <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm text-[9.5px] font-black text-[#1c1b19] dark:text-white flex items-center gap-1.5 cursor-default relative">
                              <span>🌐 {selectedLang}</span>
                              <ChevronDown className="w-3 h-3 text-zinc-500 animate-bounce" />
                            </div>

                            {/* Date card widget mimicking screenshot */}
                            <div className="bg-white dark:bg-zinc-900 border border-[#e8e5df] dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm text-[9.5px] font-bold text-zinc-505 flex items-center gap-1.5 cursor-default">
                              <Calendar className="w-3 h-3 text-zinc-405" />
                              <span className="font-extrabold text-zinc-705 dark:text-zinc-300">1 Jul 2026</span>
                            </div>
                          </div>
                        </div>

                        {/* Clean background area below the header bar suggestion */}
                        <div className="flex-grow flex items-center justify-center border border-dashed border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl bg-white/40 dark:bg-zinc-950/20 m-2 relative">
                          
                          <div className="text-center space-y-1 opacity-25">
                            <Languages className="w-8 h-8 text-zinc-400 mx-auto" />
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Language selection overlay</p>
                          </div>

                          {/* Floating Language selection dropdown menu box overlaying dashboard */}
                          <AnimatePresence>
                            {dropdownOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-[-10px] right-[40px] w-[200px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-800 dark:text-zinc-200 font-sans p-2.5 gap-2.5 z-50 h-[200px]"
                              >
                                
                                {/* Search bar inside red outline */}
                                <div className="relative border border-[#e01e41] rounded-lg px-2 py-1.5 flex items-center gap-1.5 shrink-0 bg-white dark:bg-zinc-950 shadow-sm">
                                  <Search className="w-3 h-3 text-zinc-400" />
                                  <span className="text-[9.5px] text-zinc-400 dark:text-zinc-505 font-normal">Search language...</span>
                                </div>

                                {/* Scrolling list containing options with beta badges */}
                                <div className="flex-grow overflow-hidden relative">
                                  <motion.div
                                    animate={{ y: langListScrollY }}
                                    transition={{ type: "tween", ease: "easeInOut", duration: 1.2 }}
                                    className="flex flex-col gap-0.5 text-[9.5px] font-bold py-0.5 pr-1"
                                  >
                                    {languageList.map((lang, idx) => (
                                      <div 
                                        key={idx} 
                                        className={cn(
                                          "flex justify-between items-center py-1.5 px-2 rounded-lg transition-colors",
                                          lang.name === selectedLang ? "text-[#e01e41] font-extrabold bg-[#e01e41]/5" : "text-zinc-700 dark:text-zinc-350"
                                        )}
                                      >
                                        <span>{lang.name}</span>
                                        {lang.beta && (
                                          <span className="text-[6.5px] font-black uppercase text-zinc-450 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded-sm scale-90 origin-right">
                                            BETA
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </motion.div>

                                  {/* Custom scrollbar */}
                                  <div className="absolute right-0 top-1 bottom-1 w-1 rounded-full bg-zinc-100 dark:bg-zinc-850 flex justify-center">
                                    <div className="w-0.8 h-10 rounded-full bg-zinc-300 dark:bg-zinc-700 mt-1" />
                                  </div>
                                </div>

                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Cursor indicator simulating selection clicks inside dropdown menu */}
                          <AnimatePresence>
                            {dropdownOpen && langCursor.opacity > 0 && (
                              <motion.div
                                animate={{ 
                                  x: langCursor.x, 
                                  y: langCursor.y, 
                                  scale: langCursor.scale,
                                  opacity: langCursor.opacity
                                }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.8 }}
                                className="absolute w-4.5 h-4.5 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e01e41]" />
                              </motion.div>
                            )}
                          </AnimatePresence>

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
                              <div className="w-7 h-7 rounded-full bg-purple-500/5 text-purple-655 flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[12px] font-heading font-black truncate">
                                  <Counter from={80} to={102} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-455 font-bold uppercase mt-0.5">WPM</div>
                              </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-orange-500/5 text-orange-655 flex items-center justify-center shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="text-[12px] font-heading font-black truncate">
                                  <Counter from={15} to={40} active={activeStep === 1} />
                                </div>
                                <div className="text-[7.5px] text-zinc-455 font-bold uppercase mt-0.5">Fixes</div>
                              </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
                              <div className="w-7 h-7 rounded-full bg-emerald-500/5 text-emerald-650 flex items-center justify-center shrink-0">
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
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-rose-500/10 text-rose-505 flex items-center justify-center bg-rose-505/5">
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
                                    stroke="url(#insightsGrad9)" 
                                    strokeWidth="12" 
                                    strokeLinecap="round" 
                                  />
                                  <defs>
                                    <linearGradient id="insightsGrad9" x1="0%" y1="0%" x2="100%" y2="0%">
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
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full border border-purple-500/10 text-purple-655 flex items-center justify-center bg-purple-500/5">
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
                                <div className="text-[7.5px] text-zinc-455 font-bold mt-0.5">Total words dictated</div>
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
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
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
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-505" />
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
                                  className="absolute w-4.5 h-4.5 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
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
                                  <Check className="w-2.5 h-2.5 text-emerald-505" />
                                  <span>Copied to clipboard!</span>
                                </motion.div>
                              )}
                            </AnimatePresence>

                          </div>

                        </div>
                      </div>
                    );
                  }

                  if (step.image === "offline_ai_anim") {
                    return (
                      /* CUSTOM ANIMATED ACTIVE OFFLINE AI OPTIONS CARD + SPEECH TRANSCRIPTION POP & CLEANUP (Step 4) */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-955 flex flex-col justify-center p-[4%] select-none font-sans text-zinc-800 dark:text-zinc-250">
                        <div className="space-y-[3%] w-full max-w-[390px] mx-auto scale-[0.88] md:scale-95 origin-center">
                          
                          {/* Exact Options Card from User Screenshot */}
                          <motion.div 
                            animate={
                              aiActive 
                                ? { 
                                    borderColor: "rgba(224, 30, 65, 0.25)",
                                    boxShadow: "0 10px 30px -10px rgba(224, 30, 65, 0.08), var(--tw-shadow)"
                                  }
                                : { 
                                    borderColor: "rgba(228, 228, 231, 1)",
                                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                                  }
                            }
                            className="bg-white dark:bg-zinc-900 border p-3 rounded-2xl space-y-3 relative overflow-hidden transition-all duration-300"
                          >
                            
                            {/* Radial Glow pulse sweeping when AI activates */}
                            {aiActive && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: [0, 0.25, 0], scale: [0.8, 1.5, 2] }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute inset-0 bg-radial-glow pointer-events-none"
                                style={{
                                  background: "radial-gradient(circle, rgba(224,30,65,0.18) 0%, transparent 60%)"
                                }}
                              />
                            )}

                            {/* Section 1: Speech language */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-[#e01e41]" />
                                <span className="text-[10px] font-heading font-black text-zinc-900 dark:text-white">Speech language</span>
                              </div>
                              <div className="text-[7.5px] text-zinc-450 font-bold pl-5 leading-none">English transcribes directly.</div>
                              <div className="pl-5 pt-0.5">
                                <div className="inline-flex bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-0.5 rounded-lg">
                                  <button className="bg-white dark:bg-zinc-900 text-zinc-850 dark:text-white text-[8px] font-extrabold px-2.5 py-0.5 rounded-md shadow-sm">English</button>
                                  <button className="text-zinc-455 text-[8px] font-bold px-2.5 py-0.5 rounded-md">Malayalam</button>
                                </div>
                              </div>
                            </div>

                            <div className="h-px bg-zinc-150 dark:bg-zinc-855" />

                            {/* Section 2: Active Offline AI */}
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-[#e01e41]" />
                                  <span className="text-[10px] font-heading font-black text-zinc-900 dark:text-white">Active Offline AI</span>
                                </div>
                                <div className="text-[7.5px] text-zinc-455 font-bold pl-5 leading-normal">
                                  Correct stutters, repetitions, and grammar offline.
                                </div>
                              </div>
                              {/* Sliding Toggle Switch (Flashes glow when ON) */}
                              <div 
                                className={cn(
                                  "w-7 h-4.5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer shrink-0 flex items-center relative",
                                  aiActive ? "bg-[#e01e41] shadow-[0_0_8px_rgba(224,30,65,0.45)]" : "bg-zinc-200 dark:bg-zinc-800"
                                )}
                              >
                                <motion.div 
                                  animate={{ x: aiActive ? 10 : 0 }}
                                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                  className="w-3.5 h-3.5 rounded-full bg-white shadow-sm z-10" 
                                />
                              </div>
                            </div>

                            <div className="h-px bg-zinc-150 dark:bg-zinc-855" />

                            {/* Section 3: Fast Mode / Smart Mode Switcher */}
                            <div className="bg-[#f0ece5] dark:bg-zinc-950 p-0.5 rounded-lg relative flex items-center w-full">
                              <div className="grid grid-cols-2 w-full text-center relative z-10 text-[8px] font-extrabold">
                                <span className={cn("py-1 transition-colors duration-200", modeActive === "fast" ? "text-zinc-900 dark:text-white font-[800]" : "text-zinc-455")}>Fast Mode</span>
                                <span className={cn("py-1 transition-colors duration-200", modeActive === "smart" ? "text-zinc-900 dark:text-white font-[800]" : "text-zinc-455")}>Smart Mode</span>
                              </div>
                              <motion.div 
                                animate={{ 
                                  x: modeActive === "smart" ? "100%" : "0%",
                                  boxShadow: modeActive === "smart" ? "0 1px 3px rgba(224, 30, 65, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.05)"
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-4px)] bg-white dark:bg-zinc-900 rounded-md shadow-sm z-0"
                              />
                            </div>

                            {/* Section 4: Basic Offline Ready Block */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl flex items-center justify-between shadow-sm">
                              <div className="space-y-0.5 min-w-0 leading-tight">
                                <div className="text-[8.5px] font-heading font-black text-zinc-900 dark:text-white">Basic Offline Ready</div>
                                <p className="text-[6.5px] text-zinc-450 font-semibold leading-normal truncate max-w-[200px]">
                                  Private Offline AI model is not included in this build. Basic offline cleanup is still available.
                                </p>
                              </div>
                              <span className="bg-[#f3efea] dark:bg-zinc-950 text-zinc-850 dark:text-white text-[7px] font-black px-2 py-0.5 rounded-md shrink-0">
                                Basic
                              </span>
                            </div>

                          </motion.div>

                          {/* Live Dictation Demo Box - Transforms visually when AI turns ON */}
                          <motion.div 
                            animate={
                              aiActive 
                                ? { 
                                    borderColor: "rgba(224, 30, 65, 0.4)",
                                    boxShadow: "0 0 15px rgba(224, 30, 65, 0.15), var(--tw-shadow)",
                                    background: "rgba(255, 255, 255, 1)"
                                  }
                                : { 
                                    borderColor: "rgba(228, 228, 231, 1)",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                                    background: "rgba(250, 250, 250, 0.7)"
                                  }
                            }
                            className="border p-3 rounded-2xl shadow-sm relative min-h-[75px] flex flex-col justify-between transition-all duration-305"
                          >
                            
                            {/* Glow pulse overlay on text box activation */}
                            {correctionState === "correcting" && (
                              <motion.div 
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                                className="absolute inset-0 z-10 pointer-events-none opacity-20 bg-gradient-to-r from-transparent via-[#e01e41] to-transparent"
                              />
                            )}

                            {/* Dictation Box Header */}
                            <div className="flex justify-between items-center text-[7.5px] font-bold text-zinc-455 border-b border-zinc-100 dark:border-zinc-855 pb-1.5 mb-1.5 shrink-0">
                              <span className="flex items-center gap-1.5">
                                <span className={cn("w-1.5 h-1.5 rounded-full block", aiActive ? "bg-[#e01e41] animate-pulse" : "bg-zinc-400")} />
                                <span className={cn("transition-colors duration-300", aiActive ? "text-[#e01e41] font-black" : "")}>
                                  {aiActive ? "✦ Offline AI Cleaned" : "Direct Speech (No Cleanup)"}
                                </span>
                              </span>
                              <span className="uppercase tracking-widest text-[6px]">Live Output</span>
                            </div>

                            {/* Main text box showing Pop transcription */}
                            <motion.div 
                              animate={
                                correctionState === "correcting" 
                                  ? { filter: "blur(1px)", opacity: 0.6 }
                                  : { filter: "blur(0px)", opacity: 1 }
                              }
                              className="text-[9px] font-semibold leading-relaxed text-[#1c1b19] dark:text-zinc-200 flex-grow pr-5 min-h-[28px]"
                            >
                              {demoText ? (
                                <span>{demoText}</span>
                              ) : (
                                <span className="text-zinc-350 dark:text-zinc-650 italic font-normal">Speak into your microphone...</span>
                              )}
                              <motion.span 
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                                className="inline-block w-1.5 h-3 bg-[#e01e41] ml-0.5 vertical-middle"
                              />
                            </motion.div>

                            {/* Status label at bottom of text area */}
                            <div className="mt-1.5 flex justify-between items-center text-[7px] font-extrabold shrink-0 border-t border-zinc-100 dark:border-zinc-855 pt-1.5 text-zinc-450">
                              <span>Auto-Correction Demo</span>
                              <AnimatePresence mode="wait">
                                {correctionState === "typing" && (
                                  <motion.span key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-zinc-555 flex items-center gap-1"><Mic className="w-2.5 h-2.5 animate-pulse text-[#e01e41]" /> listening... speak now</motion.span>
                                )}
                                {correctionState === "waiting" && (
                                  <motion.span key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-zinc-600 font-black">raw transcription populated</motion.span>
                                )}
                                {correctionState === "correcting" && (
                                  <motion.span key="correcting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[#e01e41] font-black flex items-center gap-1"><Sparkles className="w-2.5 h-2.5 animate-spin" /> executing offline AI...</motion.span>
                                )}
                                {correctionState === "clean" && (
                                  <motion.span key="clean" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-650 font-black flex items-center gap-1"><Check className="w-2.5 h-2.5 text-emerald-500" /> corrected & finalized offline!</motion.span>
                                )}
                              </AnimatePresence>
                            </div>

                          </motion.div>

                        </div>
                      </div>
                    );
                  }

                  if (step.image === "dictionary_anim") {
                    return (
                      /* CUSTOM ANIMATED DICTIONARY VIEW (Step 5) - Full macOS App Interface simulation */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-955 flex flex-row">
                        
                        {/* Sidebar with active tab active */}
                        <MockSidebar activeView="dictionary" />

                        {/* Right Content area: Dictionary control panel */}
                        <div className="flex-grow flex flex-col p-[3%] font-sans text-zinc-800 dark:text-zinc-250 select-none text-[9.5px] overflow-hidden min-w-0 bg-[#faf9f7] dark:bg-zinc-950 relative">
                          
                          {/* Title */}
                          <div className="text-[12px] font-heading font-black text-zinc-900 dark:text-white mb-2 shrink-0">
                            Dictionary
                          </div>

                          {/* Add word pair inputs (replicates screenshot exactly) */}
                          <div className="flex items-center gap-1.5 shrink-0 mb-3">
                            {/* Misheard Input with red border focus */}
                            <div className="relative border border-[#e01e41] rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-900 flex-grow max-w-[125px] shadow-sm">
                              <span className={cn("text-[9px] transition-all font-semibold block leading-none truncate", misheardVal ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-404")}>
                                {misheardVal || "Misheard word"}
                              </span>
                            </div>

                            {/* Correct Input with light border */}
                            <div className="relative border border-zinc-200 dark:border-zinc-850 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-900 flex-grow max-w-[125px] shadow-sm">
                              <span className={cn("text-[9px] transition-all font-semibold block leading-none truncate", correctVal ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-405")}>
                                {correctVal || "Correct word"}
                              </span>
                            </div>

                            {/* Add Button widget (clicks) */}
                            <motion.button 
                              animate={{ scale: dictBtnPress ? 0.95 : 1 }}
                              className="bg-[#1c1b19] dark:bg-zinc-800 hover:bg-[#2b2a26] text-white font-extrabold text-[9px] px-3.5 py-1.5 rounded-lg shrink-0 shadow-sm transition-transform leading-none"
                            >
                              Add
                            </motion.button>
                          </div>

                          {/* List of custom word mappings */}
                          <div className="flex-grow overflow-hidden relative">
                            <div className="text-[8px] font-black text-zinc-455 uppercase tracking-wider mb-1.5">
                              Custom Mappings List
                            </div>

                            <AnimatePresence mode="wait">
                              {!dictAdded ? (
                                <motion.div 
                                  key="no-words"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="text-[9px] text-zinc-405 font-bold pt-1 pl-0.5"
                                >
                                  No custom words yet.
                                </motion.div>
                              ) : (
                                <motion.div 
                                  key="words-list"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-855 p-2 rounded-xl flex items-center justify-between shadow-sm max-w-[280px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="bg-red-500/10 text-[#e01e41] text-[8px] px-1.5 py-0.5 rounded font-extrabold">parayoo</span>
                                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                                    <span className="bg-emerald-500/10 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded font-extrabold">Parayu</span>
                                  </div>
                                  <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Dictation Example Demonstration overlay (showing speech replace pop) */}
                            <AnimatePresence>
                              {dictAdded && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 15 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute bottom-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl shadow-md space-y-1.5"
                                >
                                  {/* Title bar */}
                                  <div className="flex justify-between items-center text-[7px] font-bold text-zinc-450 border-b border-zinc-100 dark:border-zinc-850 pb-1">
                                    <span className="flex items-center gap-1 text-[#1f6f63]">
                                      <Mic className="w-2.5 h-2.5 text-zinc-450 animate-pulse" />
                                      <span>Dictation Replacement Demo</span>
                                    </span>
                                    <span className="uppercase text-[6px]">Scanner</span>
                                  </div>

                                  {/* Speech transcription container */}
                                  <div className="text-[8.5px] font-semibold leading-normal min-h-[14px]">
                                    {dictDemoState === "untranslated" && (
                                      <span>Welcome to <span className="bg-red-500/10 text-[#e01e41] px-1 rounded font-bold">parayoo</span>.</span>
                                    )}
                                    {dictDemoState === "scanning" && (
                                      <span>Welcome to <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 0.4 }} className="bg-yellow-500/10 text-yellow-600 px-1 rounded font-bold">parayoo</motion.span>.</span>
                                    )}
                                    {dictDemoState === "translated" && (
                                      <span>Welcome to <motion.span initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-emerald-500/10 text-emerald-600 px-1 rounded font-bold">Parayu</motion.span>.</span>
                                    )}
                                  </div>

                                  {/* Status indicator bar */}
                                  <div className="flex justify-between items-center text-[6.5px] font-black text-zinc-455 pt-1 border-t border-zinc-100 dark:border-zinc-850">
                                    <span>Spoken input</span>
                                    <AnimatePresence mode="wait">
                                      {dictDemoState === "untranslated" && <span key="unt" className="text-zinc-550">populating raw transcription...</span>}
                                      {dictDemoState === "scanning" && <span key="scan" className="text-[#e01e41] font-extrabold animate-pulse">scanning dictionary matches...</span>}
                                      {dictDemoState === "translated" && <span key="trans" className="text-emerald-650 font-extrabold flex items-center gap-0.5"><Check className="w-2 h-2 text-emerald-500" /> Auto-replaced!</span>}
                                    </AnimatePresence>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                          </div>

                          {/* Cursor indicator simulating click-and-type interaction inside dictionary form */}
                          <AnimatePresence>
                            {dictCursor.opacity > 0 && (
                              <motion.div
                                animate={{ 
                                  x: dictCursor.x, 
                                  y: dictCursor.y, 
                                  scale: dictCursor.scale,
                                  opacity: dictCursor.opacity
                                }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.6 }}
                                className="absolute w-4.5 h-4.5 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e01e41]" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                        </div>

                      </div>
                    );
                  }

                  if (step.image === "snippets_anim") {
                    return (
                      /* CUSTOM ANIMATED SNIPPETS VIEW (Step 6) - Replicates screenshot with new useful example */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-955 flex flex-row">
                        
                        {/* Sidebar with active tab active */}
                        <MockSidebar activeView="snippets" />

                        {/* Right Content area: Snippets control panel */}
                        <div className="flex-grow flex flex-col p-[3%] font-sans text-zinc-800 dark:text-zinc-250 select-none text-[9.5px] overflow-hidden min-w-0 bg-[#faf9f7] dark:bg-zinc-950 relative">
                          
                          {/* Title */}
                          <div className="text-[12px] font-heading font-black text-zinc-900 dark:text-white mb-2 shrink-0">
                            Snippets
                          </div>

                          {/* Add snippet form inputs */}
                          <div className="flex items-center gap-1.5 shrink-0 mb-3">
                            {/* Trigger phrase input (shows red focus ring on active text entry) */}
                            <div 
                              className={cn(
                                "relative border rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-900 flex-grow max-w-[125px] shadow-sm transition-colors",
                                snipTriggerVal && !snipAdded ? "border-[#e01e41]" : "border-zinc-200 dark:border-zinc-805"
                              )}
                            >
                              <span className={cn("text-[9px] transition-all font-semibold block leading-none truncate", snipTriggerVal ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400")}>
                                {snipTriggerVal || "Trigger phrase"}
                              </span>
                            </div>

                            {/* Expands to input */}
                            <div 
                              className={cn(
                                "relative border rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-900 flex-grow max-w-[125px] shadow-sm transition-colors",
                                snipExpandVal && !snipAdded ? "border-[#e01e41]" : "border-zinc-200 dark:border-zinc-805"
                              )}
                            >
                              <span className={cn("text-[9px] transition-all font-semibold block leading-none truncate", snipExpandVal ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-405")}>
                                {snipExpandVal || "Expands to"}
                              </span>
                            </div>

                            {/* Add Button (clicks) */}
                            <motion.button 
                              animate={{ scale: snipBtnPress ? 0.95 : 1 }}
                              className="bg-[#1c1b19] dark:bg-zinc-800 hover:bg-[#2b2a26] text-white font-extrabold text-[9px] px-3.5 py-1.5 rounded-lg shrink-0 shadow-sm transition-transform leading-none"
                            >
                              Add
                            </motion.button>
                          </div>

                          {/* List of active text macro shortcuts */}
                          <div className="flex-grow overflow-hidden relative">
                            
                            <AnimatePresence mode="wait">
                              {!snipAdded ? (
                                <motion.div 
                                  key="no-snips"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="text-[9px] text-zinc-405 font-bold pt-1 pl-0.5"
                                >
                                  No text expansion shortcuts yet.
                                </motion.div>
                              ) : (
                                <motion.div 
                                  key="snips-list"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-855 p-2.5 rounded-xl flex items-center justify-between shadow-md max-w-[340px]"
                                >
                                  <div className="flex flex-col gap-1 min-w-0 leading-tight">
                                    <div className="flex items-center gap-1">
                                      <span className="font-extrabold text-zinc-900 dark:text-white text-[9.5px]">my link</span>
                                      <ArrowRight className="w-3.5 h-3.5 text-zinc-405 shrink-0" />
                                    </div>
                                    <div className="text-[8px] font-bold text-zinc-450 truncate">
                                      calendly.com/dev-demo
                                    </div>
                                  </div>
                                  <span className="text-[7.5px] font-bold text-zinc-400 bg-zinc-105 hover:bg-zinc-150 px-2.5 py-1 rounded-md shrink-0 cursor-default">
                                    remove
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Dictation Example Demonstration overlay (showing speech expansion pop) */}
                            <AnimatePresence>
                              {snipAdded && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 15 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute bottom-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 p-2.5 rounded-xl shadow-md space-y-1.5"
                                >
                                  {/* Title bar */}
                                  <div className="flex justify-between items-center text-[7px] font-bold text-zinc-455 border-b border-zinc-100 dark:border-zinc-850 pb-1">
                                    <span className="flex items-center gap-1 text-[#ff8a1f]">
                                      <Mic className="w-2.5 h-2.5 text-zinc-450 animate-pulse" />
                                      <span>Macro Shorthand Expansion Demo</span>
                                    </span>
                                    <span className="uppercase text-[6px]">Detector</span>
                                  </div>

                                  {/* Speech transcription container */}
                                  <div className="text-[8.5px] font-semibold leading-normal min-h-[22px]">
                                    {snipDemoState === "unexpanded" && (
                                      <span>Please book a slot through <span className="bg-orange-500/10 text-[#ff8a1f] px-1 rounded font-bold">my link</span>.</span>
                                    )}
                                    {snipDemoState === "matching" && (
                                      <span>Please book a slot through <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 0.4 }} className="bg-yellow-500/10 text-yellow-600 px-1 rounded font-bold">my link</motion.span>.</span>
                                    )}
                                    {snipDemoState === "expanded" && (
                                      <span>Please book a slot through <motion.span initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="bg-emerald-500/10 text-emerald-600 px-1 rounded font-bold">calendly.com/dev-demo</motion.span>.</span>
                                    )}
                                  </div>

                                  {/* Status indicator bar */}
                                  <div className="flex justify-between items-center text-[6.5px] font-black text-zinc-455 pt-1 border-t border-zinc-100 dark:border-zinc-850">
                                    <span>Voice command</span>
                                    <AnimatePresence mode="wait">
                                      {snipDemoState === "unexpanded" && <span key="une" className="text-zinc-500">populating raw transcription...</span>}
                                      {snipDemoState === "matching" && <span key="match" className="text-[#ff8a1f] font-extrabold animate-pulse">expanding shortcut trigger...</span>}
                                      {snipDemoState === "expanded" && <span key="exp" className="text-emerald-655 font-extrabold flex items-center gap-0.5"><Check className="w-2 h-2 text-emerald-500" /> expanded macro successfully!</span>}
                                    </AnimatePresence>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                          </div>

                          {/* Cursor indicator simulating click-and-type interaction inside snippets form */}
                          <AnimatePresence>
                            {snipCursor.opacity > 0 && (
                              <motion.div
                                animate={{ 
                                  x: snipCursor.x, 
                                  y: snipCursor.y, 
                                  scale: snipCursor.scale,
                                  opacity: snipCursor.opacity
                                }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.6 }}
                                className="absolute w-4.5 h-4.5 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e01e41]" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                        </div>

                      </div>
                    );
                  }

                  if (step.image === "settings_anim") {
                    return (
                      /* CUSTOM ANIMATED SETTINGS BRAIN SWITCH VIEW (Step 7) - Full macOS App Interface simulation */
                      <div key={step.id} className="h-full w-full shrink-0 overflow-hidden relative bg-[#fcfbfa] dark:bg-zinc-955 flex flex-row">
                        
                        {/* Sidebar with active tab active */}
                        <MockSidebar activeView="settings" />

                        {/* Right Content area: Settings panel with Brain Switch card */}
                        <div className="flex-grow flex flex-col p-[3%] font-sans text-zinc-800 dark:text-zinc-250 select-none text-[9px] overflow-hidden min-w-0 bg-[#faf9f7] dark:bg-zinc-950 relative">
                          
                          {/* Title */}
                          <div className="text-[12px] font-heading font-black text-zinc-900 dark:text-white mb-2 shrink-0">
                            Settings
                          </div>

                          {/* Brain Switch Card replicating screenshot layout */}
                          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-2xl shadow-sm space-y-2 flex-grow flex flex-col overflow-hidden max-h-[305px]">
                            
                            {/* Card Header */}
                            <div className="space-y-0.5 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-[#e01e41]" />
                                <span className="text-[10px] font-heading font-black text-zinc-900 dark:text-white">Brain Switch</span>
                              </div>
                              <div className="text-[7.5px] text-zinc-450 font-bold pl-5 leading-none">
                                Choose offline speech models.
                              </div>
                            </div>

                            {/* Brain Options list (LOW, MEDIUM, HIGH, PRO) */}
                            <div className="space-y-1 shrink-0">
                              {brainOptions.map((opt, idx) => {
                                const isSelected = selectedBrain === idx;
                                return (
                                  <motion.div
                                    key={opt.id}
                                    animate={
                                      isSelected && brainBtnPress
                                        ? { scale: 0.98, borderColor: "#e01e41" }
                                        : isSelected
                                          ? { scale: 1, borderColor: "#e01e41", boxShadow: "0 0 0 1px #e01e41" }
                                          : { scale: 1, borderColor: "rgba(228,228,231,1)", boxShadow: "0 0 0 0px transparent" }
                                    }
                                    className="bg-white dark:bg-zinc-950 border rounded-xl py-1 px-3 flex items-center justify-between transition-all duration-200 cursor-pointer"
                                  >
                                    <div className="flex items-center min-w-0 leading-none">
                                      <span className="text-[9.5px] font-black text-zinc-900 dark:text-white">{opt.name}</span>
                                      <span className="text-[8px] font-bold text-zinc-450 ml-2">{opt.size}</span>
                                    </div>
                                    <div className="shrink-0 flex items-center">
                                      {opt.rightIcon === "download" && (
                                        <Download className="w-3 h-3 text-zinc-455" />
                                      )}
                                      {opt.rightIcon === "green-check" && (
                                        <Check className="w-3 h-3 text-emerald-600 font-extrabold" />
                                      )}
                                      {opt.rightIcon === "red-check" && (
                                        <Check className="w-3 h-3 text-[#e01e41] font-extrabold" />
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Lower Info detail card explaining model features (Morphs details dynamically) */}
                            <div className="bg-[#faf8f5] dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 p-2.5 rounded-xl flex-grow flex flex-col justify-between min-h-[90px]">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 leading-none">
                                  <span className="text-[9.5px] font-black text-zinc-900 dark:text-white">
                                    {brainOptions[selectedBrain].name}
                                  </span>
                                  <span className="text-[8px] font-bold text-zinc-450">
                                    {brainOptions[selectedBrain].size}
                                  </span>
                                  {brainOptions[selectedBrain].badge && (
                                    <span className="bg-[#e01e41]/10 text-[#e01e41] text-[6px] font-black px-1.5 py-0.5 rounded tracking-wide scale-90">
                                      {brainOptions[selectedBrain].badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[7.5px] font-semibold text-zinc-650 dark:text-zinc-350 leading-relaxed mt-1">
                                  {brainOptions[selectedBrain].desc}
                                </p>
                              </div>

                              <div className="h-px bg-zinc-150 dark:bg-zinc-800 my-1" />

                              {/* Status row action */}
                              <div className="flex justify-between items-center text-[7.5px] font-black text-zinc-450">
                                <span>{brainOptions[selectedBrain].status}</span>
                                {brainOptions[selectedBrain].actionText === "Download" ? (
                                  <button className="bg-[#ece7df] dark:bg-zinc-800 hover:bg-[#dedad2] text-zinc-850 dark:text-white text-[7.5px] font-extrabold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-0.5 leading-none">
                                    <Download className="w-2.5 h-2.5" />
                                    <span>Download</span>
                                  </button>
                                ) : (
                                  <button className="bg-[#1c1b19] dark:bg-zinc-800 text-white text-[7.5px] font-extrabold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-0.5 leading-none">
                                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    <span>Active</span>
                                  </button>
                                )}
                              </div>

                            </div>

                          </div>

                          {/* Cursor indicator simulating selection clicks inside options */}
                          <AnimatePresence>
                            {brainCursor.opacity > 0 && (
                              <motion.div
                                animate={{ 
                                  x: brainCursor.x, 
                                  y: brainCursor.y, 
                                  scale: brainCursor.scale,
                                  opacity: brainCursor.opacity
                                }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.5 }}
                                className="absolute w-4.5 h-4.5 rounded-full bg-[#e01e41]/35 border border-[#e01e41] z-50 pointer-events-none flex items-center justify-center"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#e01e41]" />
                              </motion.div>
                            )}
                          </AnimatePresence>

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

        {/* Right Column: Scrollable Steps explaining each tab (Spans 5 columns for layout balance) */}
        <div className="md:col-span-5 space-y-16 py-12">
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
