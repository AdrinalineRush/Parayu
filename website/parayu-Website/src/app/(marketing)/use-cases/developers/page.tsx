import { Section } from "@/components/shared/section";
import { BentoGrid, BentoGridItem } from "@/components/marketing/bento-grid";
import { Code2, GitPullRequest, TerminalSquare, BookOpen, Bug, Sparkles } from "lucide-react";

export default function DevelopersUseCasePage() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Section className="pt-32 pb-16 text-center relative z-10" size="lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-6">
          <Code2 className="w-3.5 h-3.5" /> For Developers
        </div>
        <h1 className="text-5xl md:text-7xl font-heading font-black text-[#1c1b19] mb-6 tracking-tight leading-[1.1]">
          Write code. <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">Dictate everything else.</span>
        </h1>
        <p className="text-xl text-[#706b61] max-w-2xl mx-auto mb-16 leading-relaxed font-medium">
          Stop context switching. Use your voice to write pull request descriptions, terminal commands, and API documentation—all local and offline.
        </p>
        
        <div className="max-w-4xl mx-auto w-full mb-32">
          {/* Simulated Developer Demo */}
          <div className="relative rounded-3xl bg-white border border-[#e8e5df] shadow-xl overflow-hidden max-w-3xl mx-auto text-left">
            <div className="h-10 border-b border-[#e8e5df] flex items-center px-4 gap-2 bg-[#f6f4f0]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="ml-4 text-xs text-[#706b61] font-mono font-medium">pull_request.md</span>
            </div>
            <div className="p-8 font-mono text-sm text-zinc-700 leading-relaxed min-h-[300px]">
              <span className="text-emerald-600 font-bold">##</span> Background<br/><br/>
              <span className="text-zinc-400">{"<!-- Dictated via Parayu -->"}</span><br/>
              This PR introduces the new animated BentoGrid components to the marketing site. It replaces the old static grids and uses framer-motion for micro-interactions.<br/><br/>
              <span className="text-emerald-600 font-bold">##</span> Changes<br/>
              - Added <span className="text-amber-600 font-bold">`BentoGrid`</span> and <span className="text-amber-600 font-bold">`BentoGridItem`</span> components.<br/>
              - Integrated with existing <span className="text-amber-600 font-bold">`Section`</span> wrapper.<br/>
              - Fixed minor hydration issues on layout.<br/><br/>
              <div className="inline-flex items-center gap-2 px-2.5 py-1.5 mt-4 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs border border-emerald-500/20 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Listening...
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pb-32 relative z-10" size="lg">
        <BentoGrid className="max-w-5xl mx-auto">
          <BentoGridItem
            title="PR Descriptions"
            description="Explain complex architectural changes simply by speaking. Parayu formats it into clean markdown in your active browser window."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 font-mono text-xs text-[#706b61] shadow-inner">
                <span>git commit -m "feat: bento grid layout updates"</span>
              </div>
            }
            icon={<GitPullRequest className="h-5 w-5 text-emerald-600" />}
            className="md:col-span-2"
          />
          <BentoGridItem
            title="CLI Commands"
            description="Say 'rebase interactively with main' or tell Parayu what git command you need, and let it paste it."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 font-mono text-xs text-[#1c1b19] shadow-inner font-semibold">
                <span className="text-emerald-600 font-bold">$</span> git rebase -i main
              </div>
            }
            icon={<TerminalSquare className="h-5 w-5 text-teal-600" />}
            className="md:col-span-1"
          />
          <BentoGridItem
            title="Bug Reports"
            description="Dictate steps to reproduce a bug on screen directly into GitHub Issues, Linear, or Jira. Parayu types it instantly."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 font-mono text-xs text-[#706b61] shadow-inner">
                <span className="text-red-600 font-bold">Bug:</span> hydration mismatch on landing page hero.
              </div>
            }
            icon={<Bug className="h-5 w-5 text-rose-600" />}
            className="md:col-span-1"
          />
          <BentoGridItem
            title="Code Documentation"
            description="Write READMEs, JSDocs, and API documentation faster. Parayu understands programming jargon like 'JSON', 'GraphQL', 'OAuth', 'UUID' and matches custom dictionary items."
            header={
              <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-[#f6f4f0]/50 border border-[#e8e5df] p-4 font-mono text-xs text-[#1c1b19] shadow-inner">
                <span className="text-blue-600">/**</span><br/>
                <span> * @param {"{"}string{"}"} id - Unique identifier</span><br/>
                <span className="text-blue-400"> */</span>
              </div>
            }
            icon={<BookOpen className="h-5 w-5 text-blue-600" />}
            className="md:col-span-2"
          />
        </BentoGrid>
      </Section>
    </div>
  );
}
