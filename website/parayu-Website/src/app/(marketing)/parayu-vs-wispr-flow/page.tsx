"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  X, 
  ShieldCheck, 
  WifiOff, 
  Wallet, 
  Cpu, 
  Lock, 
  Languages, 
  DollarSign, 
  TrendingDown,
  ChevronDown,
  Gift,
  Sparkles
} from "lucide-react";

const PAGE_URL = "https://parayu.online/parayu-vs-wispr-flow";

const faqs = [
  {
    q: "Is Parayu a good alternative to Wispr Flow?",
    a: "Yes. Parayu is built for people who want voice dictation that runs entirely on their own device. Where Wispr Flow processes your speech in the cloud, Parayu runs its AI fully offline — so your audio never leaves your computer, it works without internet, and there is no subscription.",
  },
  {
    q: "Does Parayu work without internet?",
    a: "Completely. Parayu uses on-device AI (local Whisper models running on your CPU or GPU), so transcription and translation work on a plane, in low-connectivity areas, or with your Wi-Fi switched off.",
  },
  {
    q: "Is Parayu more private than a cloud dictation app?",
    a: "By design. Because all processing happens locally, your voice recordings are never uploaded to any server. Audio is transcribed on your machine and deleted immediately after — nothing touches the cloud.",
  },
  {
    q: "How much does Parayu cost compared to Wispr Flow?",
    a: "Parayu offers a free tier (2,500 words/week) with budget-friendly subscription plans (₹399/mo or approx. $5/mo) to unlock unlimited dictation, all AI models, and native Malayalam support offline. Wispr Flow is a subscription-based cloud service costing $15/month.",
  },
  {
    q: "Can Parayu handle Malayalam?",
    a: "Yes — and this is a standout feature. Parayu can take spoken Malayalam or English slang and turn it into clean, native script directly, fully offline. iOS and Android apps are also in active development.",
  },
];

const comparisonTabs = [
  { id: "privacy", label: "Data Privacy", icon: Lock },
  { id: "offline", label: "Offline Reliability", icon: WifiOff },
  { id: "pricing", label: "Subscription Cost", icon: DollarSign },
  { id: "indic", label: "Indic Language Optimizations", icon: Languages }
];

export default function ParayuVsWisprFlowPage() {
  const [activeTab, setActiveTab] = useState("privacy");
  const [teamSize, setTeamSize] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState(12); // months
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [currency, setCurrency] = useState<"INR" | "USD">("USD");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIN = 
        tz.includes("Kolkata") || 
        tz.includes("Calcutta") || 
        navigator.language.includes("IN") || 
        (navigator.languages && navigator.languages.some(l => l.includes("IN")));
      if (isIN) {
        setCurrency("INR");
      }
    } catch (e) {}
  }, []);

  const wisprRate = currency === "INR" ? 1250 : 15;
  const parayuRate = currency === "INR" ? 399 : 5;

  const wisprCost = teamSize * wisprRate * billingPeriod;
  const parayuCost = teamSize * parayuRate * billingPeriod;
  const savings = wisprCost - parayuCost;

  const currentTab = comparisonTabs.find(t => t.id === activeTab) || comparisonTabs[0];

  // Dynamic content based on active tab and currency
  let parayuTitle = "";
  let parayuDesc = "";
  let wisprTitle = "";
  let wisprDesc = "";

  if (activeTab === "privacy") {
    parayuTitle = "100% Sandboxed";
    parayuDesc = "All voice data is processed locally in RAM and immediately destroyed. Zero telemetry, zero uploads, zero screen capturing.";
    wisprTitle = "Cloud Hops";
    wisprDesc = "Audio is sent to external API servers for processing. The client optional screenshots capture active window contents to provide context.";
  } else if (activeTab === "offline") {
    parayuTitle = "No Connection Needed";
    parayuDesc = "Runs on device-native CPUs and GPUs. Write code, compose emails, and dictate notes on a flight, in the wilderness, or with disabled Wi-Fi.";
    wisprTitle = "Requires Internet";
    wisprDesc = "Completely dependent on cloud reachability. Any packet drop, public Wi-Fi registration failure, or network lag halts transcription.";
  } else if (activeTab === "pricing") {
    parayuTitle = currency === "INR" ? "Free Tier + ₹399/mo Pro" : "Free Tier + $5/mo Pro";
    parayuDesc = currency === "INR" 
      ? "Get started for free with 2,500 words/week (100% offline). Unlock unlimited offline dictation, Malayalam support, and all AI models for ₹399/month."
      : "Get started for free with 2,500 words/week (100% offline). Unlock unlimited offline dictation, Malayalam support, and all AI models for $5/month.";
    wisprTitle = currency === "INR" ? "Free Tier + ₹1,250/mo Pro" : "Free Tier + $15/mo Pro";
    wisprDesc = currency === "INR"
      ? "Offers a capped cloud free tier (2,000 words/week). Unlimited cloud processing is available via their Pro subscription at approx. ₹1,250/month ($15/mo)."
      : "Offers a capped cloud free tier (2,000 words/week). Unlimited cloud processing is available via their Pro subscription at $15/month.";
  } else {
    parayuTitle = "Malayalam Script Native";
    parayuDesc = "Bypasses standard Whisper translation rules to write native Malayalam text offline. Optimized for local terminology.";
    wisprTitle = "English Centric";
    wisprDesc = "Primarily optimized for English. Struggles with mixed regional Indian accents, slang, and direct native script output offline.";
  }

  const matrixRows = [
    { feature: "Where the AI runs", icon: Cpu, parayuVal: "On your device (offline)", parayuDesc: "100% private & local", parayuYes: true, wisprVal: "In the cloud", wisprDesc: "Your data leaves your device", wisprYes: false, isCloudIcon: true },
    { feature: "Works without internet", icon: WifiOff, parayuVal: "Yes", parayuDesc: "Works anytime, anywhere", parayuYes: true, wisprVal: "No — needs a connection", wisprDesc: "Internet required at all times", wisprYes: false },
    { feature: "Window & Screen Capturing", icon: Lock, parayuVal: "None (Zero screen captures)", parayuDesc: "Your screen stays private", parayuYes: true, wisprVal: "Optionally captures", wisprDesc: "Screenshots & window titles", wisprYes: false },
    { feature: "AI Voice Commands", icon: Sparkles, parayuVal: "Built-in offline commands", parayuDesc: "Fast, private & on-device", parayuYes: true, wisprVal: "Cloud-based", wisprDesc: "AI Commands", wisprYes: true, isCloudIcon: true },
    { feature: "Native Malayalam Script", icon: Languages, parayuVal: "Yes (Optimized offline)", parayuDesc: "Built for Malayalam users", parayuYes: true, wisprVal: "Translates to English", wisprDesc: "Cloud only", wisprYes: false },
    { feature: "Personal Offline Dictionary", icon: Wallet, parayuVal: "Yes", parayuDesc: "Stays on your device", parayuYes: true, wisprVal: "No", wisprDesc: "Cloud synced", wisprYes: false },
    { feature: "Free Tier Available", icon: Gift, parayuVal: "Yes (2,500 words/week)", parayuDesc: "Completely offline", parayuYes: true, wisprVal: "Yes (2,000 words/week)", wisprDesc: "Cloud based", wisprYes: true, isCloudIcon: true },
    { feature: "Pro Plan Price", icon: DollarSign, parayuVal: currency === "INR" ? "₹399/mo" : "$5/mo", parayuDesc: "Affordable & powerful", parayuYes: true, wisprVal: currency === "INR" ? "₹1,250/mo" : "$15/mo", wisprDesc: "More expensive", wisprYes: false }
  ];

  const reasons = [
    { icon: Lock, title: "Total privacy by design", body: "Your voice recordings are processed locally in volatile system RAM and deleted right after. No audio recordings ever leave your computer." },
    { icon: WifiOff, title: "Works anywhere, anytime", body: "On a flight, working remote in a cabin, or protecting data offline by choice — Parayu keeps dictating without internet connection." },
    { 
      icon: Wallet, 
      title: "65% More Affordable", 
      body: currency === "INR"
        ? "Get started for free or unlock unlimited dictation and all speech models for ₹399/month — saving you over 65% compared to cloud tools." 
        : "Get started for free or unlock unlimited dictation and all speech models for $5/month — saving you over 65% compared to cloud tools." 
    },
    { icon: Languages, title: "Malayalam phonetic sorting", body: "Speak Malayalam or local slang and get native script layout automatically. Optimized dictionaries ensure highly accurate spelling mappings." },
  ];

  return (
    <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen relative overflow-hidden transition-colors duration-300">

      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 dark:bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero */}
      <Section className="pt-32 pb-12 text-center relative z-10" size="md">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-6">
          <ShieldCheck className="w-3.5 h-3.5" /> Wispr Flow Alternative
        </div>
        
        <h1 className="text-4xl md:text-6xl font-heading font-black mb-6 tracking-tight leading-[1.1]">
          <span className="text-[#e01e41]">Parayu</span> <span className="text-zinc-400 dark:text-zinc-600 font-bold">vs.</span> <span className="text-zinc-800 dark:text-zinc-200">Wispr Flow</span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-800 dark:text-zinc-200 max-w-3xl mx-auto mb-10 leading-relaxed font-black">
          Built for <span className="text-[#e01e41]">Privacy</span>. Designed for <span className="text-emerald-600 dark:text-emerald-400">Freedom</span>. Made to Work — Even Offline.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="bg-[#e01e41] hover:bg-[#c21835] text-white rounded-2xl shadow-lg shadow-[#e01e41]/10 px-8 py-6 text-base font-bold">
              Get Started for Free
            </Button>
          </Link>
          <Link href="/features">
            <Button size="lg" variant="outline" className="border-zinc-200 dark:border-zinc-800 rounded-2xl px-8 py-6 text-base font-bold">
              See all features
            </Button>
          </Link>
        </div>
      </Section>

      {/* Interactive Tabs Section */}
      <Section className="pb-16 relative z-10" size="md">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-850 p-6 md:p-10 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-heading font-black text-zinc-950 dark:text-white">
              Deep Architecture Comparison
            </h2>
            
            {/* Currency Toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currency === "USD" 
                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
                }`}
              >
                🌐 USD ($)
              </button>
              <button
                onClick={() => setCurrency("INR")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currency === "INR" 
                    ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
                }`}
              >
                🇮🇳 INR (₹)
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center mb-8 border-b border-zinc-150 dark:border-zinc-800 pb-6">
            {comparisonTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md"
                    : "text-zinc-500 dark:text-zinc-450 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-white"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch mt-4">
            {/* Parayu Card */}
            <div className="flex flex-col justify-between bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-emerald-600">
                <Check className="w-8 h-8 opacity-40" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400">On-Device AI</span>
                <h3 className="text-2xl font-heading font-black text-zinc-950 dark:text-white mt-2 mb-4">Parayu</h3>
                <h4 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mb-2">{parayuTitle}</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                  {parayuDesc}
                </p>
              </div>
            </div>

            {/* Wispr Flow Card */}
            <div className="flex flex-col justify-between bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-zinc-400">
                <X className="w-8 h-8 opacity-45" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Cloud Service</span>
                <h3 className="text-2xl font-heading font-black text-zinc-500 mt-2 mb-4">Wispr Flow</h3>
                <h4 className="text-lg font-bold text-zinc-700 dark:text-zinc-350 mb-2">{wisprTitle}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  {wisprDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Comparison table */}
      <Section className="pb-16 relative z-10" size="md">
        <h2 className="text-2xl md:text-3xl font-heading font-black text-center mb-10">
          Feature-by-Feature Matrix
        </h2>
        
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xl overflow-hidden max-w-5xl mx-auto">
          {/* Header Row */}
          <div className="hidden md:grid grid-cols-[1.1fr_1.45fr_1.45fr] items-stretch border-b border-zinc-150 dark:border-zinc-800 relative">
            {/* Column 1 Header */}
            <div className="bg-zinc-950 dark:bg-zinc-950 text-white flex items-center gap-3 px-8 py-6">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="font-heading font-black text-xs uppercase tracking-wider">Features</span>
            </div>

            {/* Column 2 Header (Parayu) */}
            <div className="bg-[#e01e41]/5 dark:bg-[#e01e41]/10 px-8 py-6 border-r border-zinc-150 dark:border-zinc-800 flex flex-col justify-center relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e01e41] flex items-center justify-center text-white font-black text-base shadow-sm">
                  P
                </div>
                <div>
                  <h4 className="font-heading font-black text-[#e01e41] text-lg leading-tight">Parayu</h4>
                  <span className="text-[10px] font-bold text-[#e01e41]/80 uppercase tracking-wider">Offline. Private. Powerful.</span>
                </div>
              </div>
            </div>

            {/* Floating VS Badge */}
            <div className="absolute top-1/2 left-[61.5%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-900 dark:text-white shadow-md z-20">
              VS
            </div>

            {/* Column 3 Header (Wispr Flow) */}
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 px-8 py-6 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-zinc-700 dark:text-zinc-350 text-lg leading-tight">Wispr Flow</h4>
                  <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">Cloud-Based.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Matrix Rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-850">
            {matrixRows.map((row, idx) => {
              const Icon = row.icon;
              return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1.1fr_1.45fr_1.45fr] items-stretch hover:bg-zinc-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                  {/* Feature title */}
                  <div className="flex items-center gap-3.5 px-6 md:px-8 py-4 bg-zinc-50/20 dark:bg-zinc-900/10 border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                    <div className="w-8 h-8 rounded-full bg-[#e01e41]/10 text-[#e01e41] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-zinc-950 dark:text-white leading-tight">{row.feature}</span>
                  </div>

                  {/* Parayu answer */}
                  <div className="bg-[#e01e41]/[0.01] dark:bg-[#e01e41]/[0.02] border-r border-zinc-100 dark:border-zinc-800 px-6 md:px-8 py-4 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{row.parayuVal}</div>
                      <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">{row.parayuDesc}</div>
                    </div>
                  </div>

                  {/* Wispr Flow answer */}
                  <div className="px-6 md:px-8 py-4 flex items-start gap-3 bg-zinc-50/10 dark:bg-zinc-900/5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      row.wisprYes 
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-450" 
                        : "bg-zinc-100 dark:bg-zinc-850 text-zinc-400 dark:text-zinc-600"
                    }`}>
                      {row.wisprYes 
                        ? (row.isCloudIcon ? <Cpu className="w-3 h-3" /> : <Check className="w-3 h-3 stroke-[2.5]" />)
                        : <X className="w-3 h-3 stroke-[2.5]" />
                      }
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-500 dark:text-zinc-450">{row.wisprVal}</div>
                      <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">{row.wisprDesc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-850">
            {/* Left Badge */}
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-[10px] uppercase text-rose-600 tracking-wider">Your Data. Your Device. Your Choice.</div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-semibold">Parayu keeps you in control — offline, private, and always ready.</p>
              </div>
            </div>

            {/* Right Badge */}
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-[10px] uppercase text-emerald-600 tracking-wider">Built for professionals</div>
                <p className="text-[11px] text-zinc-650 dark:text-zinc-400 mt-0.5 leading-relaxed font-semibold">Designed for high-trust environments valuing Privacy. Speed. Freedom.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-400/85 mt-6 text-center max-w-2xl mx-auto font-medium">
          Comparison based on publicly available information as of 2026. Wispr Flow is a trademark of its
          respective owner. The contrast above reflects each tool's core design — cloud-based vs. fully on-device.
        </p>
      </Section>

      {/* Dynamic Savings Calculator */}
      <Section className="pb-16 relative z-10" size="md">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl border border-zinc-800 p-6 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                <TrendingDown className="w-3.5 h-3.5" /> Cost Calculator
              </div>
              <h2 className="text-3xl font-heading font-black tracking-tight mb-4">
                Save up to 65% on licensing fees
              </h2>
              <p className="text-sm md:text-base text-zinc-400 leading-relaxed mb-6 font-medium">
                Cloud tools charge high fees to offset expensive GPU hosting. Because Parayu runs models offline on your device, we pass the compute savings to you, offering unlimited pro features at just {currency === "INR" ? "₹399/mo" : "$5/mo"} — a fraction of the cost of cloud-based services.
              </p>

              {/* Sliders */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-zinc-300">Team Size / Seats</span>
                    <span className="text-emerald-400">{teamSize} {teamSize === 1 ? "user" : "users"}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={teamSize}
                    onChange={(e) => setTeamSize(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-zinc-300">Billing Period</span>
                    <span className="text-emerald-400">{billingPeriod} months</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="36"
                    value={billingPeriod}
                    onChange={(e) => setBillingPeriod(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Savings Output */}
            <div className="bg-zinc-850 border border-zinc-800 rounded-2xl p-6 md:p-8 flex flex-col justify-between items-center text-center shadow-lg relative">
              <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">Total Savings</span>
              <div className="text-5xl md:text-6xl font-heading font-black text-emerald-400 my-4 tracking-tight">
                {currency === "INR" ? "₹" : "$"}{savings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-zinc-400 leading-relaxed font-medium mb-4">
                Wispr Flow Pro Cost: <span className="text-zinc-200 font-bold">{currency === "INR" ? "₹" : "$"}{wisprCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> <br />
                Parayu Pro Cost: <span className="text-emerald-400 font-bold">{currency === "INR" ? "₹" : "$"}{parayuCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <Link href="/sign-up" className="w-full">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-xl py-6 font-black text-sm shadow-md transition-all">
                  Get Started with Parayu
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Why Parayu */}
      <Section className="pb-16 relative z-10" size="md">
        <h2 className="text-2xl md:text-3xl font-heading font-black text-center mb-10">
          Why people switch to Parayu
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {reasons.map((r) => (
            <div key={r.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 p-6 flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0 mt-1">
                <r.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white">{r.title}</h3>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQs */}
      <Section className="pb-20 relative z-10" size="sm">
        <h2 className="text-2xl md:text-3xl font-heading font-black text-center mb-10">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((f, index) => (
            <div 
              key={f.q} 
              className="rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 overflow-hidden transition-all duration-200"
            >
              <button 
                onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left font-bold text-sm md:text-base text-zinc-900 dark:text-white outline-none"
              >
                <span>{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-250 ${faqOpen === index ? 'rotate-180' : ''}`} />
              </button>
              
              {faqOpen === index && (
                <div className="px-5 pb-5 text-sm text-zinc-650 dark:text-zinc-450 leading-relaxed font-medium border-t border-zinc-100 dark:border-zinc-850/50 pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="pb-24 text-center relative z-10" size="md">
        <h2 className="text-3xl md:text-5xl font-heading font-black mb-4">
          Your voice. Your words. <span className="text-emerald-600">Your machine.</span>
        </h2>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8 font-medium">
          Start dictating offline for free. Unlock unlimited usage, advanced brains, and Malayalam support when you need them.
        </p>
        <Link href="/sign-up">
          <Button size="lg" className="bg-[#e01e41] hover:bg-[#c21835] text-white rounded-2xl shadow-lg px-8 py-6 text-base font-bold">
            Get Started for Free
          </Button>
        </Link>
      </Section>
    </div>
  );
}
