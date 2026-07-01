"use client";

import { motion } from "framer-motion";
import { 
  Keyboard, 
  Cpu, 
  Languages, 
  Sparkles, 
  Monitor, 
  Chrome, 
  FileText, 
  MessageSquare, 
  Code, 
  Mail, 
  Flame,
  Volume2,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

const walkthroughSteps = [
  {
    number: "01",
    badge: "The Global Trigger",
    title: "Press ⌥ Space Anywhere",
    description: "Hold the customizable hotkey shortcut to start recording. A clean, subtle voice wave overlay appears right beside your active text cursor in Slack, Notion, terminal, or any app. Release to stop.",
    icon: Keyboard,
    color: "#e01e41",
    visual: (
      <div className="relative w-full h-[220px] bg-white dark:bg-zinc-900 rounded-2xl border border-[#e8e5df] dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
        {/* Abstract mock application text */}
        <div className="absolute inset-x-8 top-10 space-y-2 opacity-30 select-none">
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded w-2/3" />
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded w-full" />
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded w-3/4" />
        </div>

        {/* Simulated Cursor and Overlay */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 dark:text-zinc-500 font-mono text-sm">Active cursor location</span>
            <motion.div 
              animate={{ opacity: [1, 0, 1] }} 
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="w-1.5 h-4 bg-primary"
            />
          </div>

          {/* Floating overlay pill */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-3 h-[48px] px-4.5 rounded-full bg-[#16161a] border border-white/10 shadow-lg"
          >
            <div className="flex items-center gap-0.5 h-4">
              {[6, 12, 8, 16, 10, 14, 7, 11, 5].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-[2.5px] rounded-full bg-gradient-to-t from-[#ff9d4d] to-[#ff6a3d]"
                  style={{ height: h }}
                  animate={{ height: [h, Math.max(4, Math.random() * 18 + 4), h] }}
                  transition={{ repeat: Infinity, duration: 1.0, delay: i * 0.08 }}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-white tracking-wide whitespace-nowrap">Listening...</span>
          </motion.div>
        </div>
      </div>
    )
  },
  {
    number: "02",
    badge: "Local Translation",
    title: "Malayalam → Fluent English",
    description: "Speak in spoken Malayalam or colloquial English dialects. Parayu's local brains process your voice on-device, automatically translating native Malayalam phrases and formatting spoken slang to clean, standard English.",
    icon: Languages,
    color: "#a02bb0",
    visual: (
      <div className="relative w-full h-[220px] bg-white dark:bg-zinc-900 rounded-2xl border border-[#e8e5df] dark:border-zinc-800 shadow-sm flex flex-col justify-center p-6 gap-4 overflow-hidden">
        {/* Malayalam Input Card */}
        <div className="flex items-start gap-2.5 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/10 rounded-xl p-3">
          <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">M</div>
          <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-350 italic">
            &quot;Innalathe meetingil njan paranja karyangal ormayundo? Project timeline lag aavan chance undu.&quot;
          </p>
        </div>

        {/* Translation Arrow indicator */}
        <div className="flex justify-center items-center gap-1.5 -my-2.5">
          <div className="h-[1px] bg-zinc-200 dark:bg-zinc-850 flex-grow" />
          <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-purple-500 fill-purple-500" />
          </div>
          <div className="h-[1px] bg-zinc-200 dark:bg-zinc-850 flex-grow" />
        </div>

        {/* English Output Card */}
        <div className="flex items-start gap-2.5 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl p-3">
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">E</div>
          <p className="text-[11px] font-bold text-[#1c1b19] dark:text-zinc-200">
            &quot;Hey, do you remember what I said in yesterday&apos;s sync? The project timeline might get delayed.&quot;
          </p>
        </div>
      </div>
    )
  },
  {
    number: "03",
    badge: "Keystroke Emulation",
    title: "Global Ingestion. Every App.",
    description: "Release the hotkey shortcut. Parayu instantly emulates native macOS keyboard keystrokes to type your formatted transcription directly into whichever app holds current window focus. No integration plugins needed.",
    icon: Monitor,
    color: "#1f6f63",
    visual: (
      <div className="relative w-full h-[220px] bg-white dark:bg-zinc-900 rounded-2xl border border-[#e8e5df] dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden p-6">
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {[
            { name: "Slack", icon: <MessageSquare className="w-4 h-4" />, color: "border-purple-500/20 bg-purple-500/5 text-purple-600" },
            { name: "VS Code", icon: <Code className="w-4 h-4" />, color: "border-blue-500/20 bg-blue-500/5 text-blue-600" },
            { name: "Notion", icon: <FileText className="w-4 h-4" />, color: "border-zinc-400/20 bg-zinc-500/5 text-zinc-700 dark:text-zinc-350" },
            { name: "Gmail", icon: <Mail className="w-4 h-4" />, color: "border-rose-500/20 bg-rose-500/5 text-rose-600" }
          ].map((app, i) => (
            <motion.div 
              key={app.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={cn("flex items-center gap-2.5 p-3 rounded-xl border font-bold text-xs shadow-sm bg-white dark:bg-zinc-950", app.color)}
            >
              {app.icon}
              <div className="flex-grow">
                <div>{app.name}</div>
                <div className="text-[9px] text-zinc-400 font-semibold mt-0.5">Keystroke Active</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  },
  {
    number: "04",
    badge: "Offline Metrics",
    title: "Local Analytics & Dictionary",
    description: "Review typing speed diagnostics (WPM), word counts, and daily streak heatmap counters locally. Customize your vocabulary dictionary for custom offline search-and-replace word replacements.",
    icon: Flame,
    color: "#ff8a1f",
    visual: (
      <div className="relative w-full h-[220px] bg-white dark:bg-zinc-900 rounded-2xl border border-[#e8e5df] dark:border-zinc-800 shadow-sm p-4 flex flex-col justify-between overflow-hidden">
        
        {/* Header inside mockup */}
        <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <span className="text-[10px] font-heading font-black text-[#1c1b19] dark:text-white flex items-center gap-0.5">
            <Flame className="w-3.5 h-3.5 text-primary fill-primary" />
            <span>2 day streak</span>
          </span>
          <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Target 120 wpm | 104 wpm avg</span>
        </div>

        {/* Heatmap mockup */}
        <div className="flex justify-center my-1.5">
          <div className="grid grid-cols-21 gap-[2px.5]">
            {Array.from({ length: 105 }).map((_, idx) => {
              let lvl = 0;
              if (idx === 103) lvl = 4;
              else if (idx === 102) lvl = 3;
              else if (idx > 90) lvl = [0, 1, 2, 0, 4, 3, 2, 1, 0][idx % 9];
              else if (idx > 60) lvl = [0, 1, 0, 2, 0, 1, 0, 0, 2][idx % 9];
              return (
                <div
                  key={idx}
                  className={cn(
                    "w-[5.5px] h-[5.5px] rounded-[1px]",
                    lvl === 0 && "bg-zinc-100 dark:bg-zinc-800",
                    lvl === 1 && "bg-primary/20",
                    lvl === 2 && "bg-primary/45",
                    lvl === 3 && "bg-primary/75",
                    lvl === 4 && "bg-primary"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl text-center border border-zinc-100 dark:border-zinc-850">
            <div className="text-[7px] font-bold text-zinc-450 uppercase">Words</div>
            <div className="text-[11px] font-heading font-black text-[#1c1b19] dark:text-white mt-0.5">1,648</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl text-center border border-zinc-100 dark:border-zinc-850">
            <div className="text-[7px] font-bold text-zinc-450 uppercase">Speed</div>
            <div className="text-[11px] font-heading font-black text-[#1c1b19] dark:text-white mt-0.5">104 wpm</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl text-center border border-zinc-100 dark:border-zinc-850">
            <div className="text-[7px] font-bold text-zinc-450 uppercase">Fixes</div>
            <div className="text-[11px] font-heading font-black text-[#1c1b19] dark:text-white mt-0.5">33</div>
          </div>
        </div>

      </div>
    )
  }
];

export function InteractiveVoiceDemo({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-5xl mx-auto px-4 space-y-16 py-4 select-none", className)}>
      
      {/* 4 Steps Showcase layout grid */}
      <div className="space-y-16">
        {walkthroughSteps.map((step, index) => {
          const isEven = index % 2 === 1;
          return (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              {/* Text Area (alternates) */}
              <div className={cn("space-y-4", isEven ? "md:order-last" : "")}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-heading font-black tracking-tight text-[#e01e41]/15 leading-none">
                    {step.number}
                  </span>
                  <div 
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" 
                    style={{ background: `${step.color}10`, color: step.color }}
                  >
                    <step.icon className="w-3 h-3" />
                    {step.badge}
                  </div>
                </div>
                
                <h3 className="text-xl md:text-2xl font-heading font-black text-foreground">
                  {step.title}
                </h3>
                
                <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Visual Card (alternates) */}
              <div className="w-full">
                {step.visual}
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
