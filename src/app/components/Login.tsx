import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Shield, Lock } from "lucide-react";
import { useApp, roleToSlug, type Role, setCookie } from "../context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { prisma } from "../prismaClient";

export function Login() {
  const navigate = useNavigate();
  const { setRole } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Input validation first: Email address domain check
    if (!email) {
      setError("Please enter your institutional email address.");
      return;
    }
    if (!email.toLowerCase().endsWith("@dlsu.edu.ph")) {
      setError("Only @dlsu.edu.ph institutional accounts are permitted.");
      return;
    }
    if (!password) {
      setError("Please enter your security password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 2. Fetch user from DB using Prisma ORM simulation
      const user = await prisma.user.findFirst({
        where: {
          email: email.trim(),
          password: password
        },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user) {
        setLoading(false);
        setError("Invalid institutional email address or password.");
        return;
      }

      // 3. Assume userroles from user record in the database
      const roles = user.userRoles || [];
      let determinedRole: Role = "Custodian";
      
      if (roles.some(ur => ur.role?.roleName === "ADMIN" || ur.role?.roleName === "ADRIC_DIRECTOR" || ur.role?.roleName === "ADRIC_SECRETARY")) {
        determinedRole = "ITS";
      } else if (roles.some(ur => ur.role?.roleName === "TSG_STAFF")) {
        determinedRole = "TSG";
      } else if (roles.some(ur => ur.role?.roleName === "LAB_HEAD")) {
        determinedRole = "LabHead";
      }

      // 4. Session Handling and Cookies (Set session details)
      setCookie("session_user_email", user.email, 30);
      const now = String(Date.now());
      setCookie("session_last_activity", now, 1);
      setCookie("session_created", now, 30);

      setTimeout(() => {
        setRole(determinedRole);
        navigate(`/${roleToSlug[determinedRole]}`);
      }, 1000);

    } catch (err) {
      setLoading(false);
      setError("An error occurred during authentication. Please try again.");
    }
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
                  <span>Authenticating Credentials...</span>
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
