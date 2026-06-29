"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/use-user";
import { GradientText } from "@/components/shared/gradient-text";
import { FileCode2, Plus, Trash2, Edit2, Search, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Snippet {
  id: string;
  trigger_word: string;
  content: string;
  description: string;
}

export default function SnippetsPage() {
  const { user } = useUser();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Fields
  const [triggerInput, setTriggerInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const SEED_SNIPPETS: Snippet[] = [
    { id: "1", trigger_word: "support-signoff", content: "If you have any further questions or run into any issues, please don't hesitate to reach out to our team at support@parayu.com. We're always here to help!\n\nBest regards,\nParayu Support Team", description: "Standard sign-off for customer service emails" },
    { id: "2", trigger_word: "zoom-link", content: "Let's hop on a call to hash out the details. Here is my personal zoom link: https://zoom.us/j/9827419247 (Password: parayu123). Talk soon!", description: "Personal meeting link template" },
    { id: "3", trigger_word: "pr-description", content: "### Description\nThis PR implements the requested voice engine enhancements and connects Supabase schema synchronization modules.\n\n### Changes\n- Created database utilities\n- Updated client hooks\n- Added LocalStorage backup", description: "PR template outline" },
  ];

  useEffect(() => {
    if (!user) return;
    const localSnippets = localStorage.getItem(`parayu_snippets_${user.id}`);
    if (localSnippets) {
      setSnippets(JSON.parse(localSnippets));
    } else {
      setSnippets(SEED_SNIPPETS);
      localStorage.setItem(`parayu_snippets_${user.id}`, JSON.stringify(SEED_SNIPPETS));
    }
  }, [user]);

  const handleAdd = () => {
    if (!triggerInput.trim() || !contentInput.trim()) {
      toast.error("Trigger word and content are required!");
      return;
    }

    const newSnippet: Snippet = {
      id: Math.random().toString(36).substring(7),
      trigger_word: triggerInput.trim(),
      content: contentInput.trim(),
      description: descInput.trim(),
    };

    const updated = [newSnippet, ...snippets];
    setSnippets(updated);
    if (user) {
      localStorage.setItem(`parayu_snippets_${user.id}`, JSON.stringify(updated));
    }

    toast.success(`Created snippet: /${triggerInput}`);
    setIsAddOpen(false);
    resetForm();
  };

  const openEdit = (snip: Snippet) => {
    setSelectedSnippet(snip);
    setTriggerInput(snip.trigger_word);
    setContentInput(snip.content);
    setDescInput(snip.description);
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedSnippet) return;
    if (!triggerInput.trim() || !contentInput.trim()) {
      toast.error("Trigger word and content are required!");
      return;
    }

    const updatedList = snippets.map((s) => 
      s.id === selectedSnippet.id 
        ? { ...s, trigger_word: triggerInput.trim(), content: contentInput.trim(), description: descInput.trim() }
        : s
    );

    setSnippets(updatedList);
    if (user) {
      localStorage.setItem(`parayu_snippets_${user.id}`, JSON.stringify(updatedList));
    }
    toast.success("Snippet updated successfully!");
    setIsEditOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    if (user) {
      localStorage.setItem(`parayu_snippets_${user.id}`, JSON.stringify(updated));
    }
    toast.success("Snippet deleted successfully!");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Snippet content copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetForm = () => {
    setTriggerInput("");
    setContentInput("");
    setDescInput("");
    setSelectedSnippet(null);
  };

  const filteredSnippets = snippets.filter((s) => 
    s.trigger_word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto text-[#1c1b19]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black mb-2 text-[#1c1b19]">
            Text Snippets
          </h1>
          <p className="text-sm text-[#706b61] font-semibold">Save boilerplate responses, links, and templates. Insert them instantly using voice cues.</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="bg-[#e01e41] hover:bg-[#d81d54] text-white rounded-xl px-6 gap-2 font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Snippet
        </Button>
      </div>

      <div className="bg-[#f6f4f0] border border-[#e8e5df] p-4 mb-6 flex items-center gap-3 rounded-2xl">
        <Search className="w-5 h-5 text-[#706b61]" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search snippets by keyword, name, or content..." 
          className="bg-transparent border-none outline-none text-[#1c1b19] w-full placeholder-[#706b61]/60 focus:ring-0 font-semibold"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {filteredSnippets.length > 0 ? (
          filteredSnippets.map((snip) => (
            <div key={snip.id} className="bg-white border border-[#e8e5df] rounded-3xl p-6 flex flex-col justify-between group shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f6f4f0] border border-[#e8e5df] text-xs font-mono text-[#e01e41] font-bold">
                    <FileCode2 className="w-3.5 h-3.5" /> /{snip.trigger_word}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openEdit(snip)}
                      className="h-8 w-8 text-[#706b61] hover:text-[#e01e41] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(snip.id)}
                      className="h-8 w-8 text-[#706b61] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {snip.description && (
                  <h3 className="font-bold text-[#1c1b19] mb-2 text-sm">{snip.description}</h3>
                )}
                <div className="p-3 bg-[#f6f4f0] rounded-xl border border-[#e8e5df] text-[#706b61] text-xs font-mono max-h-[120px] overflow-y-auto whitespace-pre-wrap leading-relaxed font-semibold">
                  {snip.content}
                </div>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-[#e8e5df]">
                <Button 
                  onClick={() => copyToClipboard(snip.content, snip.id)}
                  className="bg-white border border-[#e8e5df] hover:bg-[#faeef0] hover:text-[#e01e41] text-[#1c1b19] text-xs gap-1.5 font-bold cursor-pointer"
                >
                  {copiedId === snip.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === snip.id ? "Copied" : "Copy Content"}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 bg-white border border-[#e8e5df] rounded-3xl p-12 text-center text-[#706b61] space-y-4 shadow-sm">
            <FileCode2 className="w-12 h-12 text-[#e8e5df] mx-auto" />
            <p className="text-lg font-bold text-[#1c1b19]">No snippets found</p>
            <p className="text-sm text-[#706b61] font-semibold max-w-sm mx-auto">
              Save templates for text fragments that you use repeatedly.
            </p>
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-white border border-[#e8e5df] text-[#1c1b19] rounded-3xl p-6 max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#1c1b19]">
              Create Custom Snippet
            </DialogTitle>
            <DialogDescription className="text-[#706b61] text-xs font-semibold">
              Save standard text snippets to copy/paste or paste instantly with shortcuts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Trigger Word / Shortcut</label>
              <Input 
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                placeholder="e.g., meeting-sig, help-url"
                className="bg-[#f6f4f0] border-[#e8e5df] text-[#1c1b19]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Description</label>
              <Input 
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="e.g., Standard Zoom link outline"
                className="bg-[#f6f4f0] border-[#e8e5df] text-[#1c1b19]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Snippet Content</label>
              <textarea 
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder="Type or paste the snippet content here..."
                className="w-full h-32 bg-[#f6f4f0] border border-[#e8e5df] rounded-xl p-3 text-[#1c1b19] text-sm focus:outline-none focus:border-[#e01e41] font-semibold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsAddOpen(false)}
              className="border-[#e8e5df] hover:bg-[#f6f4f0] text-[#1c1b19] font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              className="bg-[#e01e41] hover:bg-[#d81d54] text-white font-bold cursor-pointer"
            >
              Save Snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white border border-[#e8e5df] text-[#1c1b19] rounded-3xl p-6 max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#1c1b19]">
              Edit Snippet
            </DialogTitle>
            <DialogDescription className="text-[#706b61] text-xs font-semibold">
              Modify trigger shortcuts or template content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Trigger Word</label>
              <Input 
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                placeholder="e.g., meeting-sig"
                className="bg-[#f6f4f0] border-[#e8e5df] text-[#1c1b19]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Description</label>
              <Input 
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="e.g., Standard email template sign-off"
                className="bg-[#f6f4f0] border-[#e8e5df] text-[#1c1b19]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#706b61] font-bold">Snippet Content</label>
              <textarea 
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder="Type or paste the snippet content here..."
                className="w-full h-32 bg-[#f6f4f0] border border-[#e8e5df] rounded-xl p-3 text-[#1c1b19] text-sm focus:outline-none focus:border-[#e01e41] font-semibold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditOpen(false)}
              className="border-[#e8e5df] hover:bg-[#f6f4f0] text-[#1c1b19] font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              className="bg-[#e01e41] hover:bg-[#d81d54] text-white font-bold cursor-pointer"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
