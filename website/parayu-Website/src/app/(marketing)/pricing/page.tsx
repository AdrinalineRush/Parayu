"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Crown, Sparkles, Zap, Laptop, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/section";
import { UpgradeButton } from "@/components/marketing/upgrade-button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LaunchSoonButton } from "@/components/marketing/launch-soon-button";

// Premium Cursor Glow & Shine Card wrapper
function PremiumCard({
  children,
  className,
  glowColor = "rgba(224, 30, 65, 0.07)",
  glowRadius = 300,
  hasShine = false,
  isRecommended = false,
  recommendColor = "rgba(16, 185, 129, 0.3)",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  glowRadius?: number;
  hasShine?: boolean;
  isRecommended?: boolean;
  recommendColor?: string;
  [key: string]: any;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden transition-all duration-300 ${className} ${
        isRecommended ? "ring-4" : ""
      }`}
      style={{
        outline: "none",
        boxShadow: isHovered
          ? isRecommended
            ? `0 20px 40px -15px ${recommendColor}, 0 0 0 4px ${recommendColor}`
            : "0 20px 40px -15px rgba(0,0,0,0.06)"
          : isRecommended
          ? `0 0 0 4px ${recommendColor}`
          : "none",
      }}
      {...props}
    >
      {/* Dynamic Cursor Glow Overlay */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(${glowRadius}px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 80%)`,
          }}
        />
      )}

      {/* Shine reflex sweep on hover */}
      {hasShine && isHovered && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-shine absolute -inset-y-12 -inset-x-20 w-32 bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-white/5 transform rotate-45" />
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  const [useInr, setUseInr] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIndia = tz === "Asia/Kolkata" || tz === "Asia/Calcutta" || navigator.language === "en-IN";
      setUseInr(isIndia);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Recommendations:
  const recommended: string = isAnnual ? "lifetime" : "pro";

  const freeCard = (
    <PremiumCard
      glowColor="rgba(16, 185, 129, 0.05)"
      recommendColor="rgba(16, 185, 129, 0.2)"
      isRecommended={recommended === "free"}
      className="bg-card p-8 rounded-3xl border border-border flex flex-col hover:border-zinc-400 dark:hover:border-zinc-700 hover:-translate-y-1.5 transition-all duration-300 h-full min-h-[510px]"
    >
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center mb-5">
        <Zap className="w-5 h-5" />
      </div>
      <h3 className="text-xl font-heading font-extrabold text-foreground mb-1">Free Plan</h3>
      <p className="text-muted-foreground text-xs mb-6 min-h-[36px] font-semibold leading-relaxed">Essential local dictation features to test performance.</p>
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-5xl font-black text-foreground">{useInr ? "₹0" : "$0"}</span>
        <span className="text-muted-foreground font-bold text-sm ml-1">/month</span>
      </div>
      <Link href="/sign-up" className="w-full mb-8">
        <Button className="w-full h-12 rounded-xl bg-card hover:bg-secondary border border-border text-foreground font-bold shadow-sm transition-all cursor-pointer">
          Get Started
        </Button>
      </Link>
      <ul className="space-y-4 text-sm mt-auto border-t border-border pt-6">
        {[
          { bold: "2,500 words", normal: "English dictation / mo" },
          { bold: "LOW English Brain (0.07B parameters)", normal: "runs locally" },
          { bold: "System-wide paste", normal: "⌥ Space hotkey" },
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-muted-foreground text-xs font-semibold leading-relaxed">
              <strong className="text-foreground font-bold">{item.bold}</strong> {item.normal}
            </span>
          </li>
        ))}
      </ul>
    </PremiumCard>
  );

  const baseCard = (
    <PremiumCard
      glowColor="rgba(217, 119, 6, 0.05)"
      recommendColor="rgba(217, 119, 6, 0.2)"
      isRecommended={recommended === "base"}
      className="bg-card p-8 rounded-3xl border border-border flex flex-col hover:border-zinc-400 dark:hover:border-zinc-700 hover:-translate-y-1.5 transition-all duration-300 h-full min-h-[510px]"
    >
      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center mb-5">
        <Laptop className="w-5 h-5" />
      </div>
      <h3 className="text-xl font-heading font-extrabold text-foreground mb-1">Base Plan</h3>
      <p className="text-muted-foreground text-xs mb-6 min-h-[36px] font-semibold leading-relaxed">Essential offline dictation with expanded word limits.</p>
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-5xl font-black text-foreground">{useInr ? (isAnnual ? "₹83" : "₹99") : (isAnnual ? "$0.83" : "$1")}</span>
        <span className="text-muted-foreground font-bold text-sm ml-1">/month</span>
      </div>
      <UpgradeButton plan="base" cycle={isAnnual ? "annual" : "monthly"} className="w-full mb-8 h-12 rounded-xl bg-card hover:bg-secondary border border-border text-foreground font-bold shadow-sm transition-all cursor-pointer">
        Subscribe Now
      </UpgradeButton>
      <ul className="space-y-4 text-sm mt-auto border-t border-border pt-6">
        {[
          { bold: "5,000 + 5,000 words", normal: "English & Fluid Malayalam Vocal Support / mo" },
          { bold: "2 speech brains (up to 0.24B parameters)", normal: "excludes Medium & Large brains" },
          { bold: "Custom dictionary", normal: "abbreviation shortcuts" },
          { bold: "System-wide paste", normal: "⌥ Space hotkey" },
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground text-xs font-semibold leading-relaxed">
              <strong className="text-foreground font-bold">{item.bold}</strong> {item.normal}
            </span>
          </li>
        ))}
      </ul>
    </PremiumCard>
  );

  const proCard = (
    <PremiumCard
      glowColor="rgba(224, 30, 65, 0.1)"
      recommendColor="rgba(224, 30, 65, 0.2)"
      isRecommended={recommended === "pro"}
      hasShine={true}
      className="bg-gradient-to-b from-[#e01e41]/5 dark:from-[#e01e41]/10 to-card p-8 rounded-3xl border-2 border-[#e01e41] flex flex-col relative shadow-[0_12px_40px_rgba(224,30,65,0.08)] hover:-translate-y-2 transition-all duration-300 h-full min-h-[510px]"
    >
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#e01e41] text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
        <Sparkles className="w-3 h-3 fill-white" /> Popular
      </div>
      <div className="w-12 h-12 rounded-2xl bg-[#e01e41]/10 text-[#e01e41] border border-[#e01e41]/20 flex items-center justify-center mb-5">
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>
      <h3 className="text-xl font-heading font-extrabold text-foreground mb-1">Pro Plan</h3>
      <p className="text-muted-foreground text-xs mb-6 min-h-[36px] font-semibold leading-relaxed">Uncapped dictation, Fluid Malayalam Vocal Support, and advanced AI cleanup tools.</p>
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-5xl font-black text-foreground">{useInr ? (isAnnual ? "₹329" : "₹399") : (isAnnual ? "$3.99" : "$5")}</span>
        <span className="text-muted-foreground font-bold text-sm ml-1">/month</span>
      </div>
      <UpgradeButton plan="pro" cycle={isAnnual ? "annual" : "monthly"} className="w-full mb-8 h-12 rounded-xl bg-gradient-to-r from-[#e01e41] to-[#d81d54] hover:opacity-95 text-white font-bold shadow-md shadow-[0_4px_14px_rgba(224,30,65,0.2)] transition-all cursor-pointer">
        Subscribe Now
      </UpgradeButton>
      <ul className="space-y-4 text-sm mt-auto border-t border-[#e01e41]/25 pt-6">
        {[
          { bold: "Unlimited dictation", normal: "in English, Malayalam, & 90+ languages" },
          { bold: "All speech brains (up to 1.55B parameters)", normal: "includes Base, Small, Medium, and Large v3 (Q5 & Unquantized)" },
          { bold: "Fluid Malayalam Vocal Support", normal: "built-in conversational intelligence" },
          { bold: "Premium AI cleanup", normal: "corrects grammar & pauses" },
          { bold: "AI tone styling", normal: "professional, casual, etc." },
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-4 h-4 text-[#e01e41] shrink-0 mt-0.5" />
            <span className="text-foreground text-xs font-semibold leading-relaxed">
              <strong className="text-foreground font-bold">{item.bold}</strong> {item.normal}
            </span>
          </li>
        ))}
      </ul>
    </PremiumCard>
  );

  const lifetimeCard = (
    <PremiumCard
      glowColor="rgba(168, 85, 247, 0.1)"
      recommendColor="rgba(168, 85, 247, 0.25)"
      isRecommended={recommended === "lifetime"}
      hasShine={true}
      className="bg-card p-8 rounded-3xl border border-border flex flex-col hover:border-zinc-400 dark:hover:border-zinc-700 hover:-translate-y-1.5 transition-all duration-300 h-full min-h-[510px] relative"
    >
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#a855f7] to-[#d81d54] text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
        <Crown className="w-3 h-3 fill-white" /> Best Value
      </div>
      <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center mb-5">
        <Crown className="w-5 h-5" />
      </div>
      <h3 className="text-xl font-heading font-extrabold text-foreground mb-1">Pro Lifetime</h3>
      <p className="text-muted-foreground text-xs mb-6 min-h-[36px] font-semibold leading-relaxed">One-time payment, own it forever. All Pro features + lifetime updates.</p>
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-5xl font-black text-foreground">{useInr ? "₹4,999" : "$99"}</span>
        <span className="text-muted-foreground font-bold text-sm ml-1">/one-time</span>
      </div>
      <UpgradeButton plan="pro" cycle="lifetime" className="w-full mb-8 h-12 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#d81d54] hover:opacity-90 text-white font-bold shadow-md shadow-[0_4px_14px_rgba(168,85,247,0.2)] transition-all cursor-pointer">
        Get Lifetime License
      </UpgradeButton>
      <ul className="space-y-4 text-sm mt-auto border-t border-border pt-6">
        {[
          { bold: "Pay once", normal: "own the product forever" },
          { bold: "Lifetime updates", normal: "included at no extra cost" },
          { bold: "No recurring fees", normal: "no subscriptions ever" },
          { bold: "Everything in Pro Plan", normal: "all premium features" },
          { bold: "Priority Support", normal: "first-in-line customer assistance" },
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <span className="text-muted-foreground text-xs font-semibold leading-relaxed">
              <strong className="text-muted-foreground font-bold">{item.bold}</strong> {item.normal}
            </span>
          </li>
        ))}
      </ul>
    </PremiumCard>
  );

  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen selection:bg-[#faeef0] selection:text-[#e01e41]">
      <style>{`
        @keyframes shine {
          0% { transform: translate(-100%, -100%) rotate(45deg); }
          100% { transform: translate(250%, 250%) rotate(45deg); }
        }
        .animate-shine {
          animation: shine 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Hero */}
      <Section className="pt-32 pb-12 text-center relative overflow-hidden" size="lg">
        {/* Glow spots */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-[#e01e41]/5 via-[#a855f7]/2 to-transparent blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-[10%] right-[-10%] w-[350px] h-[350px] bg-[#a855f7]/3 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <span className="text-[#e01e41] font-bold text-xs uppercase tracking-widest bg-[#faeef0] dark:bg-red-500/10 px-3 py-1 rounded-full">Pricing</span>
          <h1 className="text-4xl md:text-6xl font-heading font-black text-foreground mb-4 mt-4 tracking-tight leading-[1.05]">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 font-semibold leading-relaxed">
            Choose the plan that fits your dictation workload. All paid features run completely on-device for total privacy.
          </p>



          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-2 bg-card p-1.5 rounded-full border border-border w-max mx-auto shadow-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer ${!isAnnual ? 'bg-[#e01e41] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${isAnnual ? 'bg-[#e01e41] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Yearly <span className={`text-xs ${isAnnual ? 'bg-white/20 text-white border border-white/30' : 'bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'} px-2 py-0.5 rounded-full font-bold`}>Save 20%</span>
            </button>
          </div>
        </div>
      </Section>

      {/* Pricing Cards */}
      <Section className="pb-20 pt-4" size="lg">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 items-stretch relative">
          <AnimatePresence mode="popLayout">
            {/* Column 1: Base Plan (Yearly) or Free Plan (Monthly) */}
            {isAnnual ? (
              <motion.div
                key="base-yearly"
                layoutId="card-base"
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full order-1"
              >
                {baseCard}
              </motion.div>
            ) : (
              <motion.div
                key="free-monthly"
                layoutId="card-free"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-full order-1"
              >
                {freeCard}
              </motion.div>
            )}

            {/* Column 2: Pro Plan (Center / Always Shown) */}
            <motion.div
              key="pro"
              layoutId="card-pro"
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="h-full order-2"
            >
              {proCard}
            </motion.div>

            {/* Column 3: Pro Lifetime (Yearly) or Base Plan (Monthly) */}
            {isAnnual ? (
              <motion.div
                key="lifetime-yearly"
                layoutId="card-lifetime"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="h-full order-3"
              >
                {lifetimeCard}
              </motion.div>
            ) : (
              <motion.div
                key="base-monthly"
                layoutId="card-base"
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full order-3"
              >
                {baseCard}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trust note */}
        <div className="text-center mt-12 text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5 max-w-lg mx-auto">
          <span className="text-emerald-500">✓</span>
          <span>All plans run 100% on your device. Your voice data never leaves your computer.</span>
        </div>

        {/* Compare Matrix Toggle Button */}
        <div className="text-center mt-16">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-xs font-bold text-foreground bg-card hover:bg-secondary shadow-sm transition-all cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700"
          >
            {showMatrix ? "Hide Detailed Comparison" : "Compare All Features in Detail"}
          </button>
        </div>

        {/* Collapsible Comparison Table */}
        <AnimatePresence>
          {showMatrix && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="max-w-4xl mx-auto mt-12 overflow-hidden px-4"
            >
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary border-b border-border text-foreground">
                      <th className="p-4 font-extrabold">Feature / Benefit</th>
                      <th className="p-4 font-extrabold text-emerald-600 dark:text-emerald-400">Free</th>
                      <th className="p-4 font-extrabold text-amber-600 dark:text-amber-400">Base</th>
                      <th className="p-4 font-extrabold text-[#e01e41] dark:text-rose-400">Pro</th>
                      <th className="p-4 font-extrabold text-purple-600 dark:text-purple-400">Pro Lifetime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="p-4 font-bold text-foreground">Monthly Words Quota</td>
                      <td className="p-4 font-semibold">2,500 words</td>
                      <td className="p-4 font-semibold">5,000 words</td>
                      <td className="p-4 font-extrabold text-[#e01e41] dark:text-rose-400">Unlimited</td>
                      <td className="p-4 font-extrabold text-purple-600 dark:text-purple-400">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">Malayalam Access Limit</td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4 font-semibold">5,000 words</td>
                      <td className="p-4 font-extrabold text-[#e01e41] dark:text-rose-400">Unlimited</td>
                      <td className="p-4 font-extrabold text-purple-600 dark:text-purple-400">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">Off-line Speech Brains</td>
                      <td className="p-4">LOW (0.07B parameters)</td>
                      <td className="p-4">2 Brains (up to 0.24B)</td>
                      <td className="p-4">All Brains (up to 1.55B)</td>
                      <td className="p-4">All Brains (up to 1.55B)</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">Fluid Malayalam Vocal Support</td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4 font-semibold">✓ Up to 5,000 words</td>
                      <td className="p-4 font-semibold">✓ Unlimited</td>
                      <td className="p-4 font-semibold">✓ Unlimited</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">AI Audio Formatting & Grammar</td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4 font-semibold">✓ Premium AI</td>
                      <td className="p-4 font-semibold">✓ Premium AI</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">AI Tone Styling (Casual/Pro)</td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4 font-semibold">✓ Fully Supported</td>
                      <td className="p-4 font-semibold">✓ Fully Supported</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">Custom dictionary & paste shortcuts</td>
                      <td className="p-4"><Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-700" /></td>
                      <td className="p-4 font-semibold">✓ Custom Dictionary</td>
                      <td className="p-4 font-semibold">✓ Custom Dictionary</td>
                      <td className="p-4 font-semibold">✓ Custom Dictionary</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">License Type</td>
                      <td className="p-4 font-semibold">Free Forever</td>
                      <td className="p-4 font-semibold">Monthly/Yearly Sub</td>
                      <td className="p-4 font-semibold">Monthly/Yearly Sub</td>
                      <td className="p-4 font-extrabold text-purple-600 dark:text-purple-400">One-Time Buy</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-foreground">Updates & Support</td>
                      <td className="p-4">Standard Updates</td>
                      <td className="p-4">Standard Updates</td>
                      <td className="p-4">Standard Updates</td>
                      <td className="p-4 font-extrabold text-purple-600 dark:text-purple-400">Priority + Lifetime Updates</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* FAQ Section */}
      <Section className="py-20 bg-secondary border-t border-border" size="lg">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-black text-foreground">
              Frequently asked questions
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Can I try before I buy?</h3>
              <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                Absolutely. The Free plan gives you 2,500 words of English dictation.
                Upgrade to Base or Pro when you need higher word limits, Malayalam access, or AI tone styling.
              </p>
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">What happens after I pay for Lifetime?</h3>
              <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                You get instant access to all Pro features — forever. No recurring charges, no renewal emails.
                All future updates are included at no extra cost.
              </p>
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-[#1c1b19] dark:text-white mb-2">Can I switch from Monthly to Lifetime?</h3>
              <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                Yes! Cancel your monthly subscription and purchase the Lifetime license from the pricing page.
                Your Pro features stay active immediately.
              </p>
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground mb-2">Is there a refund policy?</h3>
              <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                We offer a 7-day refund window for all purchases. If it&apos;s not for you,
                just email us and we&apos;ll process a full refund.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Bottom CTA */}
      <Section className="py-24 relative overflow-hidden bg-card border-t border-border" size="lg">
        <div className="absolute inset-0 bg-secondary/50 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-t from-[#e01e41]/5 via-[#a02bb0]/3 to-transparent blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center flex flex-col items-center max-w-3xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-heading font-black text-foreground mb-4 tracking-tight leading-[1.1]">
            Start typing with your voice today
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-10 max-w-xl leading-relaxed font-semibold">
            Join developers, designers, and bilingual professionals who dictate 3x faster than writing.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <LaunchSoonButton className="h-14 px-8 text-base rounded-xl bg-[#e01e41] text-white hover:bg-[#d81d54] shadow-[0_8px_30px_rgba(224,30,65,0.15)] transition-all cursor-pointer font-bold inline-flex items-center justify-center">
              Download Free
            </LaunchSoonButton>
            <Link href="/sign-up?plan=pro_lifetime">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border text-foreground hover:bg-secondary bg-transparent cursor-pointer font-bold">
                Get Lifetime License — {useInr ? "₹4,999" : "$99"}
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
