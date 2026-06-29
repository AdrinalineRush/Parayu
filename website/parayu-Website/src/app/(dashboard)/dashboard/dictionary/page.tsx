import { BookOpen, Plus, Search } from "lucide-react";

export default function DictionaryPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8 text-[#1c1b19]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-[#1c1b19] mb-2">Personal Dictionary</h1>
          <p className="text-sm text-[#706b61] font-semibold">Teach Parayu your specific jargon, names, and acronyms.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#e01e41] hover:bg-[#d81d54] text-white rounded-xl transition-colors font-bold shadow-sm cursor-pointer">
          <Plus className="w-4 h-4" /> Add Word
        </button>
      </div>

      <div className="bg-white border border-[#e8e5df] rounded-3xl p-6 shadow-sm">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#706b61]" />
          <input 
            type="text" 
            placeholder="Search dictionary..." 
            className="w-full pl-10 pr-4 py-2 bg-[#f6f4f0] border border-[#e8e5df] rounded-xl text-[#1c1b19] placeholder-[#706b61]/60 focus:outline-none focus:border-[#e01e41] text-sm font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["ReactJS", "Next.js", "Parayu", "Amal", "Vercel", "Supabase", "Razorpay", "Tailwind"].map((word, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] transition-colors shadow-sm font-bold text-sm text-[#1c1b19]">
              <span>{word}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
