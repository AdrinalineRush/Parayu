"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/use-user";
import { GradientText } from "@/components/shared/gradient-text";
import { Paintbrush, Plus, Trash2, Edit2, Check, Sparkles, Scale, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface WritingStyle {
  id: string;
  name: string;
  description: string;
  rules: string[];
  is_active: boolean;
}

export default function WritingStylesPage() {
  const { user } = useUser();
  const [styles, setStyles] = useState<WritingStyle[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle | null>(null);

  // Form Fields
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [rulesInput, setRulesInput] = useState(""); // Comma separated rules

  const SEED_STYLES: WritingStyle[] = [
    { id: "1", name: "Professional", description: "Polished, formal and concise business communications", rules: ["Remove verbal fillers", "Use active voice", "Include greetings and sign-offs"], is_active: true },
    { id: "2", name: "Casual", description: "Friendly, direct, and conversational tone", rules: ["Use contractions", "Add appropriate emojis", "Keep sentences short"], is_active: true },
    { id: "3", name: "Technical", description: "Detailed, exact and structured documentations", rules: ["Format code blocks in Markdown", "Use bulleted lists for specs", "Specify component hierarchies"], is_active: true },
    { id: "4", name: "Action-Oriented", description: "Highly actionable summaries focused on key items", rules: ["Lead with core takeaways", "Create checklist action items", "Omit fluff/introductions"], is_active: true },
  ];

  useEffect(() => {
    if (!user) return;
    const localStyles = localStorage.getItem(`parayu_styles_${user.id}`);
    if (localStyles) {
      setStyles(JSON.parse(localStyles));
    } else {
      setStyles(SEED_STYLES);
      localStorage.setItem(`parayu_styles_${user.id}`, JSON.stringify(SEED_STYLES));
    }
  }, [user]);

  const handleAdd = () => {
    if (!nameInput.trim() || !descInput.trim()) {
      toast.error("Name and description are required!");
      return;
    }

    const rulesArray = rulesInput
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const newStyle: WritingStyle = {
      id: Math.random().toString(36).substring(7),
      name: nameInput.trim(),
      description: descInput.trim(),
      rules: rulesArray.length > 0 ? rulesArray : ["Style as requested"],
      is_active: true,
    };

    const updated = [...styles, newStyle];
    setStyles(updated);
    if (user) {
      localStorage.setItem(`parayu_styles_${user.id}`, JSON.stringify(updated));
    }

    toast.success(`Created writing style: ${nameInput}`);
    setIsAddOpen(false);
    resetForm();
  };

  const openEdit = (style: WritingStyle) => {
    setSelectedStyle(style);
    setNameInput(style.name);
    setDescInput(style.description);
    setRulesInput(style.rules.join(", "));
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedStyle) return;
    if (!nameInput.trim() || !descInput.trim()) {
      toast.error("Name and description are required!");
      return;
    }

    const rulesArray = rulesInput
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const updatedList = styles.map((s) => 
      s.id === selectedStyle.id 
        ? { ...s, name: nameInput.trim(), description: descInput.trim(), rules: rulesArray.length > 0 ? rulesArray : ["Style as requested"] }
        : s
    );

    setStyles(updatedList);
    if (user) {
      localStorage.setItem(`parayu_styles_${user.id}`, JSON.stringify(updatedList));
    }
    toast.success("Writing style updated!");
    setIsEditOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = styles.filter((s) => s.id !== id);
    setStyles(updated);
    if (user) {
      localStorage.setItem(`parayu_styles_${user.id}`, JSON.stringify(updated));
    }
    toast.success("Writing style deleted!");
  };

  const toggleActive = (id: string) => {
    const updated = styles.map((s) => 
      s.id === id ? { ...s, is_active: !s.is_active } : s
    );
    setStyles(updated);
    if (user) {
      localStorage.setItem(`parayu_styles_${user.id}`, JSON.stringify(updated));
    }
  };

  const resetForm = () => {
    setNameInput("");
    setDescInput("");
    setRulesInput("");
    setSelectedStyle(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            <GradientText>Writing Styles</GradientText>
          </h1>
          <p className="text-zinc-400">Configure default profiles to control the voice, vocabulary, formatting constraints, and tone of your generated texts.</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6 gap-2"
        >
          <Plus className="w-4 h-4" /> New Tone Style
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {styles.map((style) => (
          <div key={style.id} className="glass-card p-6 flex flex-col justify-between group relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                  <Paintbrush className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => openEdit(style)}
                    className="h-8 w-8 text-zinc-500 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(style.id)}
                    className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <h3 className="font-bold text-white mb-1.5 text-lg">{style.name}</h3>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{style.description}</p>
              
              <div className="space-y-1.5 mb-6">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 flex items-center gap-1">
                  <Scale className="w-3 h-3" /> Formatting Constraints:
                </span>
                <ul className="space-y-1">
                  {style.rules.map((rule, idx) => (
                    <li key={idx} className="text-xs text-zinc-500 flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Pre-built Model Profile</span>
              <button 
                onClick={() => toggleActive(style.id)}
                className={`px-3 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                  style.is_active 
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-zinc-900 border-white/5 text-zinc-500"
                }`}
              >
                {style.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-background border border-white/10 text-white rounded-2xl p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Create Tone Style Profile
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Configure how the AI should rewrite your dictated transcripts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Style Name</label>
              <Input 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g., Marketing Copy, Funny Pitch, Academic Review"
                className="bg-zinc-900/50 border-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Description</label>
              <Input 
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="e.g., Short, witty sentences with active calls-to-action"
                className="bg-zinc-900/50 border-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Constraints / Rules (Comma separated)</label>
              <textarea 
                value={rulesInput}
                onChange={(e) => setRulesInput(e.target.value)}
                placeholder="e.g., use emojis, remove verbal fillers, keep technical terms intact, write in first person"
                className="w-full h-24 bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsAddOpen(false)}
              className="border-white/10 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Create Style
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-background border border-white/10 text-white rounded-2xl p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Edit Tone Style Profile
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Modify style parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Style Name</label>
              <Input 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g., Professional"
                className="bg-zinc-900/50 border-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Description</label>
              <Input 
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="e.g., Formal business summaries"
                className="bg-zinc-900/50 border-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Constraints / Rules (Comma separated)</label>
              <textarea 
                value={rulesInput}
                onChange={(e) => setRulesInput(e.target.value)}
                placeholder="e.g., remove verbal fillers, use active voice"
                className="w-full h-24 bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditOpen(false)}
              className="border-white/10 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
