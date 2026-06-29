import { Section } from "@/components/shared/section";
import { Terminal, Copy, Sparkles } from "lucide-react";

export default function CommandsPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-20 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local Voice Commands</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1c1b19] mb-6">
          AI Commands Library
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto font-medium">
          Control your text without lifting a finger. Speak a formatting command at the end of your dictation, and watch Parayu rewrite it instantly.
        </p>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <div className="max-w-4xl mx-auto space-y-4">
          {[
            { cmd: "/translate", desc: "Translates spoken Malayalam or slang to clean, standard English." },
            { cmd: "/polish", desc: "Corrects grammatical errors, punctuation, and improves overall sentence flow." },
            { cmd: "/summarize", desc: "Condenses dictated thoughts into 3-5 concise bullet points." },
            { cmd: "/code", desc: "Recognizes coding syntax and formats the output into clean markdown code blocks." },
            { cmd: "/email", desc: "Formats your verbal statement into a professionally structured email." }
          ].map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] hover:border-[#e01e41]/20 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 bg-[#f6f4f0] border border-[#e8e5df] text-[#1c1b19] px-4 py-2 rounded-lg font-mono text-sm shrink-0 w-full sm:w-48 justify-center sm:justify-start">
                <Terminal className="w-4 h-4 text-[#e01e41]" /> {item.cmd}
              </div>
              <p className="text-[#706b61] flex-1 text-center sm:text-left text-sm md:text-base font-semibold">{item.desc}</p>
              <button className="p-2 text-[#706b61] hover:text-[#e01e41] transition-colors cursor-pointer">
                <Copy className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
