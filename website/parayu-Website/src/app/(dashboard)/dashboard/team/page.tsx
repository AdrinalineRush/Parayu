"use client";

import { useState } from "react";
import { GradientText } from "@/components/shared/gradient-text";
import { Users, Plus, Mail, Shield, Check, X, UserMinus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending";
}

export default function TeamWorkspacePage() {
  const [members, setMembers] = useState<TeamMember[]>([
    { id: "1", name: "Amal Chand", email: "amal@parayu.ai", role: "owner", status: "active" },
    { id: "2", name: "Sarah Connor", email: "sarah@acme.org", role: "admin", status: "active" },
    { id: "3", name: "John Doe", email: "john@startup.io", role: "member", status: "active" },
    { id: "4", name: "David Jenkins", email: "david@cloud.com", role: "member", status: "pending" },
  ]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState("member");

  const handleInvite = () => {
    if (!emailInput.trim() || !emailInput.includes("@")) {
      toast.error("Please enter a valid email address!");
      return;
    }

    // Check if duplicate
    if (members.some((m) => m.email.toLowerCase() === emailInput.toLowerCase())) {
      toast.error("User already in team workspace!");
      return;
    }

    const newMember: TeamMember = {
      id: Math.random().toString(36).substring(7),
      name: emailInput.split("@")[0], // Mock name
      email: emailInput.trim(),
      role: roleInput,
      status: "pending",
    };

    setMembers([...members, newMember]);
    toast.success(`Invitation sent to ${emailInput}!`);
    setIsInviteOpen(false);
    setEmailInput("");
    setRoleInput("member");
  };

  const handleRemove = (id: string, name: string) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    toast.success(`Removed ${name} from team workspace.`);
  };

  const handleRoleChange = (id: string, newRole: string) => {
    const updated = members.map((m) => 
      m.id === id ? { ...m, role: newRole } : m
    );
    setMembers(updated);
    toast.success("Role updated successfully!");
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            <GradientText>Team Workspace</GradientText>
          </h1>
          <p className="text-zinc-400">Share custom dictionaries, templates, commands, and billing records across your organization.</p>
        </div>
        <Button 
          onClick={() => setIsInviteOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6 gap-2"
        >
          <Plus className="w-4 h-4" /> Invite Coworker
        </Button>
      </div>

      <div className="glass-card p-6 border-violet-500/10 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="font-bold text-white text-lg mb-1">Teams Subscription active</h3>
            <p className="text-zinc-400 text-sm max-w-md">You're currently using 4 out of 10 available seats. Invite more team members to collaborate.</p>
          </div>
          <Button variant="outline" className="border-white/10 hover:bg-white/5 text-xs">
            Manage Seats
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-white/5 bg-zinc-900/10">
          <h3 className="font-bold text-white">Active Members</h3>
        </div>
        <div className="divide-y divide-white/5">
          {members.map((member) => (
            <div key={member.id} className="p-4 sm:p-6 hover:bg-white/[0.01] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-primary font-bold">
                  {member.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{member.name}</span>
                    {member.status === "pending" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-medium">Pending Invite</span>
                    )}
                    {member.role === "owner" && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium">Owner</span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-xs font-mono">{member.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {member.role !== "owner" ? (
                  <>
                    <Select 
                      defaultValue={member.role}
                      onValueChange={(val) => handleRoleChange(member.id, val || "")}
                    >
                      <SelectTrigger className="w-28 bg-zinc-900 border-white/5 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-white/10 text-white">
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemove(member.id, member.name)}
                      className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-zinc-500 text-xs mr-8 italic">Super Admin privilege</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="bg-background border border-white/10 text-white rounded-2xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Invite a coworker to join your Parayu AI workspace. They will receive an email invitation to register.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Email Address</label>
              <Input 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g., coworker@company.com"
                className="bg-zinc-900/50 border-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Workspace Role</label>
              <Select 
                defaultValue={roleInput}
                onValueChange={(val) => setRoleInput(val || "")}
              >
                <SelectTrigger className="bg-zinc-900 border-white/5 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-white/10 text-white">
                  <SelectItem value="admin">Admin (Can edit styles, commands)</SelectItem>
                  <SelectItem value="member">Member (Can record & style own notes)</SelectItem>
                  <SelectItem value="guest">Guest (Read only history)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsInviteOpen(false)}
              className="border-white/10 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleInvite}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
