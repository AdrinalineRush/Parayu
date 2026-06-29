import { Clock, Search, Filter, MoreHorizontal, FileText, Play } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8 text-[#1c1b19]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-[#1c1b19] mb-2">
            Voice History
          </h1>
          <p className="text-sm text-[#706b61] font-semibold">View, search, and manage your past voice notes and generated text.</p>
        </div>
      </div>

      <div className="bg-white border border-[#e8e5df] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#706b61]" />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="w-full pl-10 pr-4 py-2.5 bg-[#f6f4f0] border border-[#e8e5df] rounded-xl text-[#1c1b19] placeholder-[#706b61]/60 focus:outline-none focus:border-[#e01e41] text-sm font-semibold"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#f6f4f0] border border-[#e8e5df] rounded-xl text-[#1c1b19] text-sm font-bold hover:bg-[#faeef0] transition-colors w-full md:w-auto cursor-pointer">
            <Filter className="w-4 h-4 text-[#706b61]" /> Filter
          </button>
        </div>

        <div className="space-y-3">
          {[
            { title: "Project Launch Email", date: "Today, 10:45 AM", duration: "01:12", type: "Email", words: 145 },
            { title: "Weekly Sync Notes", date: "Yesterday, 2:30 PM", duration: "05:40", type: "Meeting", words: 420 },
            { title: "Dashboard Requirements", date: "Oct 24, 11:20 AM", duration: "03:15", type: "Document", words: 310 },
            { title: "Idea for new feature", date: "Oct 22, 9:00 AM", duration: "00:45", type: "Note", words: 85 },
            { title: "Bug report for login", date: "Oct 21, 4:15 PM", duration: "01:30", type: "Technical", words: 120 }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-[#e8e5df] bg-white hover:bg-[#f6f4f0] transition-colors group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#faeef0] flex items-center justify-center border border-[#e01e41]/10 shrink-0">
                  <FileText className="w-5 h-5 text-[#e01e41]" />
                </div>
                <div>
                  <h3 className="text-[#1c1b19] font-bold text-sm md:text-base">{item.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#706b61] font-semibold">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#706b61]" /> {item.date}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#f6f4f0]">{item.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-[#1c1b19] text-sm font-mono font-bold">{item.duration}</div>
                  <div className="text-[#706b61] text-xs font-semibold">{item.words} words</div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 hover:bg-[#faeef0] rounded-lg text-[#706b61] hover:text-[#e01e41] transition-colors cursor-pointer">
                    <Play className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-[#faeef0] rounded-lg text-[#706b61] hover:text-[#e01e41] transition-colors cursor-pointer">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex justify-center">
          <button className="text-sm font-bold text-[#e01e41] hover:text-[#d81d54] transition-colors cursor-pointer">Load More</button>
        </div>
      </div>
    </div>
  );
}
