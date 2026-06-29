import { Section } from "@/components/shared/section";
import { Code2, GitMerge, FileText, Terminal, Sparkles } from "lucide-react";
import Link from "next/link";

export default function UseCasesHubPage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e01e41]/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e01e41]/10 border border-[#e01e41]/20 text-[#e01e41] text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Workflows</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight">
          Built for every <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e81f3a] via-[#d81d54] to-[#a02bb0]">workflow</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          See how professionals use Parayu to dictate naturally, bypass repetitive typing, and stay 100% private.
        </p>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Link href="/use-cases/developers">
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-[#e8e5df] p-8 hover:border-[#e01e41]/30 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e01e41]/5 to-[#a02bb0]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-[#e01e41]/10 border border-[#e01e41]/20 flex items-center justify-center mb-6">
                <Code2 className="w-8 h-8 text-[#e01e41]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1c1b19] mb-3">For Developers</h2>
              <p className="text-[#706b61] leading-relaxed mb-6 font-medium">
                Dictate PR descriptions, commit messages, and documentation directly inside VS Code or Terminal. Customize terms with local dictionary mapping.
              </p>
              <span className="text-[#e01e41] font-bold group-hover:text-[#d81d54] transition-colors">Explore Developer workflow &rarr;</span>
            </div>
          </Link>

          <Link href="/use-cases/content-creators">
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-[#e8e5df] p-8 hover:border-[#a02bb0]/30 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-[#a02bb0]/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-[#a02bb0]/10 border border-[#a02bb0]/20 flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-[#a02bb0]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1c1b19] mb-3">For Content Creators</h2>
              <p className="text-[#706b61] leading-relaxed mb-6 font-medium">
                Overcome writer's block. Dictate in Malayalam or colloquial phrasing and translate voice instantly into polished scripts or social copy.
              </p>
              <span className="text-[#a02bb0] font-bold group-hover:text-[#8b2399] transition-colors">Explore Creator workflow &rarr;</span>
            </div>
          </Link>

          <Link href="/use-cases/founders">
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-[#e8e5df] p-8 hover:border-[#e01e41]/30 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e01e41]/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-[#e01e41]/10 border border-[#e01e41]/20 flex items-center justify-center mb-6">
                <Terminal className="w-8 h-8 text-[#e01e41]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1c1b19] mb-3">For Founders & Execs</h2>
              <p className="text-[#706b61] leading-relaxed mb-6 font-medium">
                Draft emails, reports, and slack updates offline. Paste text directly into active windows using system-wide hotkeys.
              </p>
              <span className="text-[#e01e41] font-bold group-hover:text-[#d81d54] transition-colors">Explore Founder workflow &rarr;</span>
            </div>
          </Link>

          <Link href="/use-cases/students">
            <div className="group relative overflow-hidden rounded-3xl bg-white border border-[#e8e5df] p-8 hover:border-[#e01e41]/30 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e01e41]/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-[#e01e41]/10 border border-[#e01e41]/20 flex items-center justify-center mb-6">
                <GitMerge className="w-8 h-8 text-[#e01e41]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1c1b19] mb-3">For Students & Academics</h2>
              <p className="text-[#706b61] leading-relaxed mb-6 font-medium">
                Take lecture notes, outline studies, and dictate essays without requiring an active internet connection or draining battery.
              </p>
              <span className="text-[#e01e41] font-bold group-hover:text-[#d81d54] transition-colors">Explore Student workflow &rarr;</span>
            </div>
          </Link>
        </div>
      </Section>
    </div>
  );
}
