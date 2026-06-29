import { Section } from "@/components/shared/section";
import { Sparkles } from "lucide-react";

export default function LanguagesPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local Whisper Models</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          Supported Languages
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Parayu is finely tuned for <strong className="text-[#e01e41] font-bold">Malayalam and English</strong> translation out of the box. By switching local Whisper models, it supports offline dictation in over 99 languages.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          {[
            "Malayalam ➜ English",
            "Malayalam (മലയാളം)",
            "English (US / UK)",
            "Spanish (Español)",
            "French (Français)",
            "German (Deutsch)",
            "Hindi (हिन्दी)",
            "Tamil (தமிழ்)",
            "Arabic (العربية)",
            "Chinese (中文)",
            "Japanese (日本語)",
            "Korean (한국어)",
            "Italian (Italiano)",
            "Portuguese (Português)",
            "Russian (Русский)",
            "Dutch (Nederlands)"
          ].map((lang, i) => (
            <div key={i} className="p-4 rounded-2xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] hover:border-[#e01e41]/20 font-semibold text-[#1c1b19] shadow-sm hover:shadow transition-colors">
              {lang}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
