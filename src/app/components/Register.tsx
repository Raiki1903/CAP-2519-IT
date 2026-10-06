import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Shield, Lock, User, Upload, Camera, CheckCircle, ArrowLeft, Building2, CreditCard, Mail } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { DLSU_LABS } from "@shared/constants/labs";
import { useServerData } from "@web/state/serverData";
import * as authApi from "@web/api/auth.api";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150",
];

export function Register() {
  const navigate = useNavigate();
  const { addPendingRegistration } = useServerData();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [userType, setUserType] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const requestedRole = "Custodian";
  const [labAffiliation, setLabAffiliation] = useState<string>("Center for ICT for Development (CITE4D)");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your full first and last name.");
      return;
    }
    if (!email.trim() || !email.toLowerCase().endsWith("@dlsu.edu.ph")) {
      setError("Please enter a valid institutional @dlsu.edu.ph email address.");
      return;
    }
    if (!idNumber.trim() || !/^\d{8}$/.test(idNumber.trim())) {
      setError("Please enter a valid 8-digit DLSU ID number.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your password entry.");
      return;
    }

    setLoading(true);

    try {
      const regData = {
        id: `REG-${Date.now()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        idNumber: parseInt(idNumber.trim(), 10),
        userType,
        requestedRole,
        labAffiliation,
        password,
        avatarUrl: avatar,
        submittedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        status: "PENDING" as const,
      };

      // Send to server endpoint
      let res: Response;
      try {
        res = await authApi.requestRegistrationRaw(regData);
      } catch (networkErr: any) {
        throw new Error("Unable to connect to registration server. Please check if the Express backend is running on port 4000.");
      }

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned HTML response instead of JSON (Status ${res.status}). Error: ${text.slice(0, 100)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit registration request.");
      }

      if (addPendingRegistration) {
        addPendingRegistration(regData);
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      console.error("Registration request error:", err);
      setError(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  if (submittedSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="h-2 bg-[#005A36]" />
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#005A36] mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle size={36} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Registration Submitted for Approval</h1>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Your account registration request for <strong className="text-[#005A36]">{email}</strong> has been received!
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2 text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-semibold text-slate-500">Applicant:</span>
                <span className="font-bold">{firstName} {lastName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-semibold text-slate-500">ID Number:</span>
                <span className="font-mono font-bold">{idNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-semibold text-slate-500">Requested Role:</span>
                <span className="font-bold text-[#005A36]">{requestedRole}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Lab Affiliation:</span>
                <span className="font-bold">{labAffiliation}</span>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 text-left flex items-start gap-2.5">
              <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Approval Flow Required:</strong> Per DLSU AdRIC security policies, your designated Lab Head must approve your registration request before your account is activated and written to the database.
              </p>
            </div>

            <Button
              onClick={() => navigate("/login")}
              className="w-full bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs h-10"
            >
              Return to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-8" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="w-full max-w-[580px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header Green Strip */}
        <div className="h-2.5 bg-[#005A36]" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#005A36] flex items-center justify-center text-white shadow-sm">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Institutional Account Registration</h1>
                <p className="text-[11px] text-slate-500">DLSU AdRIC Laboratory Management Infrastructure</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
              className="text-xs text-[#005A36] hover:bg-emerald-50 gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Login
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
              <div className="relative w-16 h-16 rounded-full border-2 border-[#005A36] overflow-hidden flex-shrink-0 shadow-sm">
                <img src={avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  title="Upload avatar"
                >
                  <Camera size={16} />
                </button>
              </div>
              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Profile Picture Avatar</Label>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatar(p)}
                      className={`w-7 h-7 rounded-full overflow-hidden border cursor-pointer transition-all ${avatar === p ? "border-[#005A36] ring-2 ring-[#005A36]/30 scale-110" : "border-slate-200 opacity-70 hover:opacity-100"}`}
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-7 h-7 rounded-full bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
                    title="Upload photo"
                  >
                    <Upload size={12} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="regFirstName" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                  <User size={12} className="text-[#005A36]" /> First Name
                </Label>
                <Input
                  id="regFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Maria Clara"
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regLastName" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                  <User size={12} className="text-[#005A36]" /> Last Name
                </Label>
                <Input
                  id="regLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>
            </div>

            {/* Email & ID Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="regEmail" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                  <Mail size={12} className="text-[#005A36]" /> DLSU Email Address
                </Label>
                <Input
                  id="regEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dlsu.edu.ph"
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regIdNumber" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                  <CreditCard size={12} className="text-[#005A36]" /> DLSU ID Number
                </Label>
                <Input
                  id="regIdNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="12345678"
                  maxLength={8}
                  className="h-9 text-xs font-mono border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>
            </div>

            {/* User Type & Requested Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">User Classification</Label>
                <Select value={userType} onValueChange={(val: any) => setUserType(val)}>
                  <SelectTrigger className="h-9 text-xs border-slate-200">
                    <SelectValue placeholder="Select User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT" className="text-xs">Student Researcher</SelectItem>
                    <SelectItem value="FACULTY" className="text-xs">Faculty Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Requested System Role</Label>
                <div className="relative">
                  <Input
                    value="Equipment Custodian"
                    disabled
                    className="h-9 text-xs bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed pr-8"
                  />
                  <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Lab Affiliation Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                <Building2 size={12} className="text-[#005A36]" /> Institutional Lab Affiliation
              </Label>
              <Select value={labAffiliation} onValueChange={setLabAffiliation}>
                <SelectTrigger className="h-9 text-xs border-slate-200 focus:ring-[#005A36] focus:border-[#005A36]">
                  <SelectValue placeholder="Select Lab Affiliation" />
                </SelectTrigger>
                <SelectContent>
                  {DLSU_LABS.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id} className="text-xs">
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="regPassword" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Security Password</Label>
                <div className="relative">
                  <Input
                    id="regPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="h-9 text-xs border-slate-200 pr-8 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regConfirmPassword" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Confirm Password</Label>
                <Input
                  id="regConfirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-9 text-xs border-slate-200 focus-visible:ring-[#005A36] focus-visible:border-[#005A36]"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                <span className="font-bold">Registration Error:</span> {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs h-10 shadow-sm transition-colors mt-2"
            >
              {loading ? "Submitting Registration Request..." : "Submit Registration Request for Approval"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}