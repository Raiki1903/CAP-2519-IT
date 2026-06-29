import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Shield } from "lucide-react";
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

function NetworkNode({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={24} fill="#005A36" fillOpacity={0.15} />
      <circle cx={x} cy={y} r={18} fill="#005A36" fillOpacity={0.25} />
      <circle cx={x} cy={y} r={10} fill="#005A36" fillOpacity={0.6} />
      <text x={x} y={y + 4} textAnchor="middle" fill="#34D399" fontSize={14} fontWeight={700}>◈</text>
      <text x={x} y={y + 38} textAnchor="middle" fill="#10B981" fontSize={9} fontWeight={600} letterSpacing={0.5}>{label}</text>
    </g>
  );
}

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

  const nodes = [
    { x: 180, y: 120, label: "COMPUTING ARRAY" },
    { x: 340, y: 80,  label: "ROBOTICS NODE" },
    { x: 460, y: 180, label: "SENSOR HUB" },
    { x: 100, y: 260, label: "MOBILE INFRA" },
    { x: 300, y: 240, label: "STORAGE ARRAY" },
    { x: 420, y: 320, label: "EDGE NODE" },
    { x: 200, y: 370, label: "TELEMETRY" },
    { x: 500, y: 100, label: "CLUSTER A" },
    { x: 80,  y: 170, label: "LAB ROUTER" },
  ];

  const edges = [
    [0,1],[1,2],[0,4],[1,4],[2,5],[3,4],[4,5],[4,6],[0,8],[1,7],[2,7],[3,6],[5,6],
  ];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Left panel — network visualization */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden" style={{ background: "#0A1F14" }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, #005A36 0%, transparent 50%)" }} />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary">
              <Shield size={18} className="text-primary-foreground" />
            </div>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>DLSU LABORATORY INFRASTRUCTURE</span>
          </div>
          <p style={{ color: "#34D399", fontSize: 11, letterSpacing: 3, fontWeight: 600 }}>EQUIPMENT MANAGEMENT SYSTEM · v4.2.1</p>
        </div>

        <div className="flex-1 flex items-center justify-center relative z-10 px-8">
          <svg viewBox="0 0 580 460" width="100%" height="100%" style={{ maxHeight: 480 }}>
            {nodes.map((n, i) => (
              <circle key={`p-${i}`} cx={n.x} cy={n.y} r={30} fill="none" stroke="#10B981" strokeWidth={0.5} opacity={0.2} />
            ))}
            {edges.map(([a, b], i) => (
              <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
                stroke="#10B981" strokeWidth={0.8} strokeOpacity={0.35} strokeDasharray="4 6" />
            ))}
            {nodes.map((n, i) => <NetworkNode key={i} x={n.x} y={n.y} label={n.label} />)}
            <circle r={3} fill="#34D399"><animateMotion dur="3s" repeatCount="indefinite" path={`M${nodes[0].x},${nodes[0].y} L${nodes[1].x},${nodes[1].y}`} /></circle>
            <circle r={3} fill="#34D399"><animateMotion dur="4s" repeatCount="indefinite" path={`M${nodes[4].x},${nodes[4].y} L${nodes[2].x},${nodes[2].y}`} /></circle>
            <circle r={2.5} fill="#10B981"><animateMotion dur="5s" repeatCount="indefinite" path={`M${nodes[3].x},${nodes[3].y} L${nodes[6].x},${nodes[6].y}`} /></circle>
          </svg>
        </div>

        <div className="relative z-10 p-10 grid grid-cols-3 gap-4">
          {[{ label: "ASSETS TRACKED", val: "1,248" }, { label: "CAMPUSES", val: "2" }, { label: "ACTIVE LABS", val: "11" }].map(({ label, val }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: "rgba(0,90,54,0.3)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ color: "#34D399", fontSize: 20, fontWeight: 800 }}>{val}</div>
              <div style={{ color: "#6EE7B7", fontSize: 9, letterSpacing: 2, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-[480px] flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary">
              <Shield size={20} className="text-primary-foreground" />
            </div>
            <div>
              <div className="text-primary font-extrabold text-sm tracking-wide">EquipmentMS</div>
              <div className="text-muted-foreground text-[10px] tracking-widest font-semibold">DLSU RESEARCH LABS</div>
            </div>
          </div>

          <h1 className="text-foreground mb-1">Secure Sign-In</h1>
          <p className="text-muted-foreground text-sm mb-7">Institutional access only · @dlsu.edu.ph accounts</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Institutional Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="username@dlsu.edu.ph"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Session Context
              </Label>
              <Select value={selectedRole} onValueChange={v => setSelectedRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access level…" />
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
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="mt-2 tracking-wide" size="lg">
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Authenticating…
                </>
              ) : "Authenticate & Enter System"}
            </Button>
          </form>

          <div className="mt-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-[10px] text-emerald-800 leading-relaxed m-0 tracking-wide">
              <strong>SECURITY NOTICE:</strong> Restricted to authorized DLSU personnel. All access attempts are logged and monitored.
            </p>
          </div>

          <p className="mt-5 text-[11px] text-muted-foreground text-center">
            DLSU Laboratory Infrastructure · EquipmentMS v4.2.1
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
