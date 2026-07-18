import { useState, useRef, useEffect } from "react";
import { useApp } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { User, Shield, Lock, Camera, Upload, Check, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150", // original Joel
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150",
];

export function AccountDetailsPage() {
  const { currentUser, role, updateProfile } = useApp();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [avatar, setAvatar] = useState(currentUser?.profilePicture || AVATAR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync form fields when currentUser loads asynchronously
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName);
      setLastName(currentUser.lastName);
      setAvatar(currentUser.profilePicture || AVATAR_PRESETS[0]);
    }
  }, [currentUser]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatar(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setSuccess(false);

    try {
      await updateProfile(firstName.trim(), lastName.trim(), avatar);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "AdRICDirector": return "AdRIC Director";
      case "Custodian": return "Active Custodian";
      case "ITS": return "ITS Admin";
      case "TSG": return "TSG Staff";
      case "LabHead": return "Lab Head";
      default: return "User";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-8 w-8 text-[#005A36] hover:bg-emerald-50 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-none">Account Settings</h1>
          <p className="text-xs text-muted-foreground mt-1.5">Manage your active profile credentials and session state</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="h-1.5 bg-[#005A36]" />
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-[#005A36]" />
              Personal Credentials Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar management */}
            <div className="flex flex-col sm:flex-row gap-5 items-center pb-4 border-b border-slate-100">
              <div className="relative w-20 h-20 rounded-full border-2 border-[#005A36] overflow-hidden flex-shrink-0 shadow-sm">
                <img src={avatar} alt="Profile preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  title="Upload profile picture"
                >
                  <Camera size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-2.5">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Profile Picture</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatar(p)}
                      className={`w-9 h-9 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${avatar === p ? "border-[#005A36] scale-110" : "border-slate-200 opacity-70 hover:opacity-100"}`}
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Upload custom image"
                  >
                    <Upload size={14} />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-[10px] text-muted-foreground">Select from presets or upload a custom institutional avatar photo.</p>
              </div>
            </div>

            {/* Editing fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Joel P."
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Balanay II"
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Email Address (Read-only)</Label>
              <Input
                value={currentUser?.email || "joel.balanay@dlsu.edu.ph"}
                disabled
                className="h-9 text-xs bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
              />
            </div>
          </CardContent>
        </Card>

        {/* Locked Administrative settings */}
        <Card className="border border-slate-200 shadow-sm bg-slate-50/50 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Shield size={16} className="text-slate-400" />
              Administrative Bounds &amp; Security Roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Assigned Security Role</Label>
                <div className="relative">
                  <Input
                    value={getRoleLabel()}
                    disabled
                    className="h-9 text-xs bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed pr-8"
                  />
                  <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Institutional ID Number</Label>
                <div className="relative">
                  <Input
                    value={currentUser?.idNumber || "12345678"}
                    disabled
                    className="h-9 text-xs bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed pr-8"
                  />
                  <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 text-slate-500 text-[10.5px] leading-relaxed flex items-start gap-2 mt-2">
              <Shield size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Security Lockout:</strong> Under DLSU Laboratory Infrastructure Policy, you are barred from changing your system role, user type, or ID number. Contact your AdRIC Director or IT Services for authorization overrides.
              </p>
            </div>
          </CardContent>
        </Card>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <Check size={14} className="text-emerald-600" />
            <span>Profile successfully updated! Changes are synchronized across your active session block.</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || !firstName.trim() || !lastName.trim()}
            className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs h-9 cursor-pointer"
          >
            {saving ? "Saving Changes..." : "Save Credentials"}
          </Button>
        </div>
      </form>
    </div>
  );
}
