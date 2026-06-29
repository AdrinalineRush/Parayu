"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@/lib/use-user";
import { supabase } from "@/lib/supabase";
import { VoiceWaveform } from "@/components/shared/voice-waveform";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Mic, MicOff, Copy, Sparkles, Globe, Calendar, Clock,
  ChevronDown, Pencil, Flame, Terminal, AlignLeft,
  Wand2
} from "lucide-react";

// Writing style options
const WRITING_STYLES = [
  { id: "professional", name: "Professional" },
  { id: "casual", name: "Casual" },
  { id: "technical", name: "Technical" },
  { id: "action", name: "Action-Oriented" },
];

// Pre-defined AI Commands
const DEFAULT_COMMANDS = [
  { trigger: "Draft Email", icon: <Terminal className="w-4 h-4" /> },
  { trigger: "Meeting Notes", icon: <AlignLeft className="w-4 h-4" /> },
  { trigger: "Smart Rewrite", icon: <Sparkles className="w-4 h-4" /> },
];

export default function DashboardOverviewPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"usage" | "voice">("usage");
  
  // Stats Card state (expandable toggles)
  const [smartEditingOpen, setSmartEditingOpen] = useState(true);
  const [dictationVolumeOpen, setDictationVolumeOpen] = useState(true);

  // Voice Dictator state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [formattedOutput, setFormattedOutput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("professional");
  const [selectedCommand, setSelectedCommand] = useState<string | null>("Draft Email");
  const [isGenerating, setIsGenerating] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [simulationActive, setSimulationActive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync user profile fields
  useEffect(() => {
    if (!user) return;
    const syncUser = async () => {
      try {
        const meta = user.user_metadata ?? {};
        await supabase.from("users").update({
          email: user.email ?? "",
          first_name: meta.first_name ?? meta.full_name ?? null,
          last_name: meta.last_name ?? null,
          profile_image_url: meta.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", user.id);
      } catch (e) {
        console.error("Error syncing user:", e);
      }
    };
    syncUser();
  }, [user]);

  // Handle timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Speech Recognition Web API
  const startSpeechRecognition = () => {
    const SpeechRecognitionClass = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      toast.warning("Speech API not fully supported in this browser. Simulating instead.");
      runSimulation();
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
        setSimulationActive(false);
      };

      rec.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + (prev ? " " : "") + finalTranscript);
        }
      };

      rec.onerror = (e: any) => {
        console.error(e);
        if (e.error === "not-allowed") {
          toast.error("Microphone access denied. Simulating speech.");
          runSimulation();
        } else {
          setIsRecording(false);
        }
      };

      rec.onend = () => setIsRecording(false);
      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      runSimulation();
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (simulationActive) {
      setIsRecording(false);
      setSimulationActive(false);
    }
  };

  const runSimulation = () => {
    setIsRecording(true);
    setSimulationActive(true);
    setTranscript("");
    
    const simulatedText = [
      "Hello, dictating via the Parayu on-device speech engine...",
      " Everything runs locally and keeps data fully secure.",
      " Transcribing romanized Malayalam translations is fast and seamless."
    ];

    let currentSegment = 0;
    const interval = setInterval(() => {
      if (currentSegment < simulatedText.length) {
        setTranscript((prev) => prev + simulatedText[currentSegment]);
        currentSegment++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        setSimulationActive(false);
      }
    }, 2000);
    timerRef.current = interval;
  };

  const toggleRecording = () => {
    isRecording ? stopSpeechRecognition() : startSpeechRecognition();
  };

  const applyAIFormatting = () => {
    if (!transcript.trim()) {
      toast.error("Please dictate or type some transcript text first!");
      return;
    }
    setIsGenerating(true);
    setFormattedOutput("");
    
    setTimeout(() => {
      let result = `Formatted Transcription Result:\n\nStyle: ${selectedStyle}\nAI Command: ${selectedCommand}\n\n"Hey! This is clean, formatted text derived offline from your audio dictation stream. Parayu automatically corrects abbreviations, updates syntax, and pastes it instantly."`;
      setFormattedOutput(result);
      setIsGenerating(false);
      toast.success("AI Cleanup applied successfully!");
    }, 1500);
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Mock Apps integration details
  const appsList = [
    { name: "Antigravity", count: 2084, percentage: 85, color: "from-[#e01e41] to-[#d81d54] dark:from-[#a78bfa] dark:to-[#c084fc]", letter: "A", letterBg: "bg-primary" },
    { name: "Claude", count: 1937, percentage: 78, color: "from-[#d81d54] to-[#a02bb0]", letter: "C", letterBg: "bg-[#a855f7]" },
    { name: "Google Chrome", count: 937, percentage: 40, color: "from-[#f59e0b] to-[#e01e41]", letter: "G", letterBg: "bg-[#eab308]" },
    { name: "Finder", count: 466, percentage: 22, color: "from-[#3b82f6] to-[#a02bb0]", letter: "F", letterBg: "bg-[#3b82f6]" }
  ];

  // Mock calendar grid days (15 cols x 7 rows)
  const calendarGrid = Array.from({ length: 105 }, (_, i) => {
    if (i > 95) return "bg-primary";
    if (i > 80 && i % 3 === 0) return "bg-[#a02bb0]";
    if (i > 50 && i % 4 === 0) return "bg-primary/10";
    if (i % 7 === 0) return "bg-primary/10";
    return "bg-secondary";
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-foreground flex items-center gap-1.5">
            Insights
            <Sparkles className="text-primary w-6 h-6 animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">Analyze your speech efficiency and dictation metrics.</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground hover:bg-secondary text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span>Malayalam</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground hover:bg-secondary text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>May 12 – May 18, 2025</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border pb-px">
        <button onClick={() => setActiveTab("usage")} className={`px-6 py-2.5 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === "usage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Your Usage</button>
        <button onClick={() => setActiveTab("voice")} className={`px-6 py-2.5 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === "voice" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Your Voice / Web Dictator</button>
      </div>

      {activeTab === "usage" ? (
        <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TYPING SPEED</span>
              <Clock className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="relative my-8 flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-secondary" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="62.8" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" stroke="url(#speed-gradient)" strokeWidth="9" fill="transparent" strokeDasharray="251.2" strokeDashoffset="100" strokeLinecap="round" />
                <defs><linearGradient id="speed-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--primary)" /><stop offset="50%" stopColor="var(--primary)" /><stop offset="100%" stopColor="#a02bb0" /></linearGradient></defs>
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-foreground tracking-tight">99</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">WPM</span>
              </div>
            </div>
            <div className="text-center font-bold text-foreground text-sm"><span className="text-primary mr-1">↗ +18%</span> vs last week</div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMART EDITING</span>
                <Pencil className="w-4.5 h-4.5 text-[#a855f7]" />
              </div>
              <div className="my-6">
                <span className="text-5xl font-black text-foreground tracking-tight">8</span>
                <span className="block text-xs font-bold text-muted-foreground mt-1">Fixes made by Parayu</span>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <button onClick={() => setSmartEditingOpen(!smartEditingOpen)} className="w-full flex items-center justify-between p-3 bg-secondary hover:bg-primary/5 rounded-xl text-xs font-semibold text-foreground transition-all cursor-pointer">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#10b981]" /><span>0 corrections</span></div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${smartEditingOpen ? "rotate-180" : ""}`} />
              </button>
              {smartEditingOpen && <div className="p-3 bg-card border border-border rounded-xl text-xs text-muted-foreground font-semibold space-y-1.5 animate-in slide-in-from-top-1"><div className="flex justify-between"><span>Spellcheck corrections</span><span className="font-bold text-foreground">0</span></div></div>}
              <div className="w-full flex items-center justify-between p-3 bg-secondary rounded-xl text-xs font-semibold text-foreground"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#a855f7]" /><span>8 dictionary substitutions</span></div><ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DICTATION VOLUME</span>
                <Mic className="w-4.5 h-4.5 text-[#0d9488]" />
              </div>
              <div className="my-6">
                <span className="text-5xl font-black text-foreground tracking-tight">6,823</span>
                <span className="block text-xs font-bold text-muted-foreground mt-1">Total words dictated</span>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <button onClick={() => setDictationVolumeOpen(!dictationVolumeOpen)} className="w-full flex items-center justify-between p-3 bg-secondary hover:bg-primary/5 rounded-xl text-xs font-semibold text-foreground transition-all cursor-pointer">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><span>6823 words pasted</span></div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dictationVolumeOpen ? "rotate-180" : ""}`} />
              </button>
              {dictationVolumeOpen && <div className="p-3 bg-card border border-border rounded-xl text-xs text-muted-foreground font-semibold space-y-1.5 animate-in slide-in-from-top-1"><div className="flex justify-between"><span>Direct global keyboard pastings</span><span className="font-bold text-foreground">6,823</span></div></div>}
              <div className="w-full flex items-center justify-between p-3 bg-secondary rounded-xl text-xs font-semibold text-foreground"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span>Ready on-device engine</span></div><ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /></div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm md:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-bold text-foreground">Desktop Integration</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary px-2.5 py-1 rounded-md border border-border">APPS INTEGRATION | 11</span>
            </div>
            <div className="space-y-4.5 mt-5">
              {appsList.map((app) => (
                <div key={app.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-md ${app.letterBg} flex items-center justify-center text-white text-[10px] font-bold`}>{app.letter}</div><span className="text-foreground font-bold">{app.name}</span></div>
                    <span className="text-muted-foreground font-bold">{app.count} words</span>
                  </div>
                  <div className="w-full h-3 bg-secondary border border-border rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r ${app.color} rounded-full`} style={{ width: `${app.percentage}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5"><Flame className="w-4.5 h-4.5 text-[#ff5d42] fill-[#ff5d42]" /> 3 day streak</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">LONGEST | 3 DAYS</span>
            </div>
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="grid grid-flow-col grid-rows-7 gap-[3.5px]">
                {calendarGrid.map((bgClass, idx) => (<div key={idx} className={`w-3 h-3 rounded-[3.5px] border border-border/10 ${bgClass}`} />))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground"><span>Less</span><div className="w-2.5 h-2.5 rounded-[2px] bg-secondary" /><div className="w-2.5 h-2.5 rounded-[2px] bg-primary/10" /><div className="w-2.5 h-2.5 rounded-[2px] bg-primary" /><div className="w-2.5 h-2.5 rounded-[2px] bg-[#a02bb0]" /><span>More</span></div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-card border border-border rounded-3xl p-6 flex flex-col min-h-[500px] relative shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground"}`}></div>
                  <span className="text-sm font-bold text-foreground">{isRecording ? "Listening..." : "Ready"}</span>
                  {isRecording && (<span className="font-mono text-sm text-primary font-bold ml-2">{formatTime(recordingTime)}</span>)}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary font-bold" onClick={() => copyToClipboard(transcript)}><Copy className="w-4 h-4 mr-2" /> Copy</Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary font-bold" onClick={() => setTranscript("")}>Clear</Button>
                </div>
              </div>
              <div className="flex-grow flex flex-col relative">
                {isRecording && (<div className="h-16 flex items-center justify-center mb-4"><VoiceWaveform /></div>)}
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Start dictating or type here..." className="w-full flex-grow bg-transparent border-none resize-none focus:outline-none text-foreground text-lg leading-relaxed placeholder:text-muted-foreground/50 font-semibold" />
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div className="flex flex-wrap gap-2">{["Summarize", "Translate", "Fix Grammar", "Make Longer"].map((action) => (<button key={action} onClick={() => setTranscript((prev) => prev + (prev ? " " : "") + `[${action}]`)} className="px-4 py-2 rounded-full bg-secondary hover:bg-primary/10 text-xs font-bold text-foreground border border-border transition-colors cursor-pointer">{action}</button>))}</div>
                <div className="relative">
                  {isRecording && (<div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>)}
                  <button onClick={toggleRecording} className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all cursor-pointer ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90 shadow-primary/20"}`}>{isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}</button>
                </div>
              </div>
            </div>
            {formattedOutput && (
              <div className="bg-card border border-border rounded-3xl p-6 relative shadow-sm animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <div className="flex items-center gap-2 text-foreground font-bold"><Wand2 className="w-4.5 h-4.5 text-primary" /> AI Output</div>
                  <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => copyToClipboard(formattedOutput)}><Copy className="w-4 h-4 mr-2" /> Copy Result</Button>
                </div>
                <div className="text-foreground whitespace-pre-wrap leading-relaxed font-semibold text-sm md:text-base">{formattedOutput}</div>
              </div>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-3"><Terminal className="w-4.5 h-4.5 text-primary" /> AI Commands</h3>
              <div className="space-y-2">
                {DEFAULT_COMMANDS.map((cmd) => (
                  <button key={cmd.trigger} onClick={() => setSelectedCommand(cmd.trigger)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${selectedCommand === cmd.trigger ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                    <div className={selectedCommand === cmd.trigger ? "text-primary" : "text-muted-foreground"}>{cmd.icon}</div>
                    <span>{cmd.trigger}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-3"><AlignLeft className="w-4.5 h-4.5 text-primary" /> Tone Styles</h3>
              <div className="grid grid-cols-2 gap-2">
                {WRITING_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`px-3 py-3 rounded-xl border text-xs text-center font-bold transition-all cursor-pointer ${selectedStyle === style.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{style.name}</button>
                ))}
              </div>
            </div>
            <Button onClick={applyAIFormatting} disabled={isGenerating || !transcript} className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/10 gap-2 text-base cursor-pointer">
              {isGenerating ? <span className="animate-pulse flex items-center gap-2"><Sparkles className="w-5 h-5" /> Processing...</span> : <><Wand2 className="w-5 h-5" /> Format Dictation</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
