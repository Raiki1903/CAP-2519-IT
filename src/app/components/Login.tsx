import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Shield, Lock } from "lucide-react";
import { useApp, roleToSlug, type Role } from "../context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function Login() {
  const navigate = useNavigate();
  const { setRole } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedRole) {
      setError("Please fill in all fields and select a session context.");
      return;
    }
    if (!email.endsWith("@dlsu.edu.ph")) {
      setError("Only @dlsu.edu.ph institutional accounts are permitted.");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const role = selectedRole as Role;
      setRole(role);
      navigate(`/${roleToSlug[role]}`);
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden transition-all">
        {/* Top green accent strip */}
        <div className="h-2 bg-[#005A36]" />
        
        <div className="p-8 sm:p-10">
          {/* Logo / Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#005A36] mb-4 shadow-md shadow-emerald-950/10">
              <Shield size={24} className="text-white" />
            </div>
            <h2 className="text-lg font-extrabold text-[#005A36] tracking-wider uppercase">EquipmentMS</h2>
            <p className="text-[10px] text-muted-foreground tracking-[2px] font-bold uppercase mt-1">
              DLSU Laboratory Infrastructure
            </p>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800">Secure Institutional Sign-In</h1>
            <p className="text-xs text-muted-foreground mt-1">Authorized access via @dlsu.edu.ph credentials</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                Institutional Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="username@dlsu.edu.ph"
                  className="bg-slate-50/50 border-slate-200 focus-visible:ring-emerald-600 focus-visible:border-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                Institutional Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="pr-10 bg-slate-50/50 border-slate-200 focus-visible:ring-emerald-600 focus-visible:border-emerald-600"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                Session Access Context
              </Label>
              <Select value={selectedRole} onValueChange={v => setSelectedRole(v as Role)}>
                <SelectTrigger className="bg-slate-50/50 border-slate-200 focus-visible:ring-emerald-600 focus-visible:border-emerald-600">
                  <SelectValue placeholder="Select context role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ITS">Information Technology Services (ITS)</SelectItem>
                  <SelectItem value="TSG">Technical Support Group (TSG)</SelectItem>
                  <SelectItem value="LabHead">Lab Head / Project Leader</SelectItem>
                  <SelectItem value="Custodian">Active Custodian / Borrower</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
                <span className="font-bold">Error:</span> {error}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full mt-2 bg-[#005A36] hover:bg-[#004225] text-white transition-colors"
              size="lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Authenticating Context...</span>
                </div>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <Lock size={15} /> Authenticate &amp; Enter System
                </span>
              )}
            </Button>
          </form>

          {/* Institutional bottom branding */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              De La Salle University
            </p>
            <p className="text-[9px] text-slate-400 mt-1">
              AdRIC Laboratory Networks · System Integrity v4.2.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
