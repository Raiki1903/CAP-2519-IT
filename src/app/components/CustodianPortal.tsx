import { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import { QrCode, Camera, Package, Calendar, CheckCircle, AlertTriangle, Upload, X, Send, Loader, ClipboardCheck, RefreshCw, Zap, LayoutGrid, List } from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "./AssetDetailModal";
import { useApp } from "../context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";

const MINT = "#10B981";

const myAssets = [
  { id:"EQ-2024-051", name:"MacBook Pro M2 Max",  serial:"C02Z4K01Q6LR", category:"Mobile Infrastructure", lab:"CITe4D", borrowedOn:"Jun 01, 2026", dueDate:"Jun 30, 2026", daysLeft:19,  status:"Active"  },
  { id:"EQ-2024-055", name:"Raspberry Pi 4 Kit ×3", serial:"RPI4-DLSU-009", category:"Computing Array",    lab:"CeLT",   borrowedOn:"May 20, 2026", dueDate:"Jun 20, 2026", daysLeft:-1,  status:"Overdue" },
  { id:"EQ-2024-012", name:"Vuzix M400 Smart Glass", serial:"VX-M400-007", category:"Peripheral",          lab:"CAR",    borrowedOn:"Jun 05, 2026", dueDate:"Jul 05, 2026", daysLeft:24,  status:"Active"  },
];

const statusBadgeClass: Record<string, string> = {
  "Active":             "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance":        "bg-amber-50  text-amber-700  border-amber-200",
  "Disposed":           "bg-red-50    text-red-700    border-red-200",
};

const statusPills = [
  { label:"Perfect",              severity:"healthy",  ring:"ring-emerald-400", bg:"bg-emerald-50",  text:"text-emerald-700"  },
  { label:"Operational",          severity:"healthy",  ring:"ring-blue-400",    bg:"bg-blue-50",     text:"text-blue-700"     },
  { label:"Minor Drift",          severity:"warn",     ring:"ring-amber-400",   bg:"bg-amber-50",    text:"text-amber-700"    },
  { label:"Degraded Performance", severity:"alert",    ring:"ring-orange-400",  bg:"bg-orange-50",   text:"text-orange-700"   },
  { label:"Critical Failure",     severity:"critical", ring:"ring-red-500",     bg:"bg-red-50",      text:"text-red-700"      },
];

export function CustodianPortal({ activeTab }: { activeTab: string }) {
  const { cycleMode, addRepairRequest: onRepairRequest, assets, addInspectionReport } = useApp();

  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const [reportAsset, setReportAsset] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportImages, setReportImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<null|"healthy"|"repair">(null);
  const [requestImmediate, setRequestImmediate] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states for Available Equipment
  const [search, setSearch]                   = useState("");
  const [filterCategory, setFilterCategory]   = useState("All");
  const [filterLoc, setFilterLoc]             = useState("All");
  const [filterLab, setFilterLab]             = useState("All");
  const [viewMode, setViewMode]               = useState<"list"|"grid">("list");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  const handleScanSuccess = (scannedText: string) => {
    let assetId = scannedText.trim();
    if (assetId.includes("/")) {
      const parts = assetId.split("/");
      assetId = parts[parts.length - 1];
    }
    const matched = assets.find(
      a => a.id.toLowerCase() === assetId.toLowerCase() || a.name.toLowerCase().includes(assetId.toLowerCase())
    );
    if (matched) {
      setSelectedAsset(matched);
      setScanResult(matched.id);
    } else {
      alert(`Asset tag "${assetId}" was decoded but not found in the DLSU AdRIC database. Please register the asset or verify.`);
    }
    setScanActive(false);
  };

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true);
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          setScanLoading(false);
          if (code) {
            handleScanSuccess(code.data);
          } else {
            alert("No QR code found in the image. Please upload a clear image of a QR code.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) {
            handleScanSuccess(code.data);
            return;
          }
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (scanActive && !scanLoading && !scanResult) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play();
            requestRef.current = requestAnimationFrame(tick);
          }
        })
        .catch(err => {
          console.error("Camera access error:", err);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [scanActive, scanLoading, scanResult]);

  const simulateScan = () => {
    setScanLoading(true); setScanResult(null);
    setTimeout(() => {
      setScanLoading(false);
      const active = assets.filter(a => a.status !== "Disposed");
      const newestAsset = active.find(a => a.id.startsWith("EQ-2026-")) || active[0] || { id: "EQ-2024-051" };
      const matched = assets.find(a => a.id === newestAsset.id) || newestAsset;
      setSelectedAsset(matched as any);
      setScanResult(newestAsset.id);
      setScanActive(false);
    }, 2000);
  };

  const custodianAssets = assets.filter(a => a.custodian === "A. Dela Cruz (Active Custodian)");

  const selectedPill = statusPills.find(p => p.label === reportStatus);
  const isAlert   = selectedPill && (selectedPill.severity === "alert"   || selectedPill.severity === "critical");
  const isWarn    = selectedPill?.severity === "warn";
  const isHealthy = selectedPill && (selectedPill.severity === "healthy");
  const descHasFault = /fail|broken|damage|crack|overheat|error|malfunction|defect|fault|not work/i.test(reportDesc);
  const triggerRepair = isAlert || (isWarn && descHasFault) || requestImmediate;

  const containerBorderClass =
    submitResult === "healthy" ? "border-emerald-400 ring-1 ring-emerald-200"
    : submitResult === "repair" || triggerRepair ? "border-red-400 ring-1 ring-red-200"
    : isWarn ? "border-amber-400"
    : isHealthy ? "border-emerald-400"
    : "border-border";

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 5 - reportImages.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => { if (ev.target?.result) setReportImages(p => [...p, ev.target!.result as string]); };
      reader.readAsDataURL(f);
    });
  };

  const handleSubmitReport = () => {
    if (!reportAsset || !reportStatus) return;
    setSubmitting(true);
    setTimeout(() => {
      const ref = `HLT-2026-${String(Math.floor(Math.random()*900+100))}`;
      setSubmittedRef(ref);
      const asset = assets.find(a => a.id === reportAsset)!;

      // Log the health inspection report inside the central context
      addInspectionReport({
        id: ref,
        assetId: reportAsset,
        assetName: asset.name,
        custodian: "A. Dela Cruz (Active Custodian)",
        status: reportStatus,
        description: reportDesc || "Regular check-in evaluation.",
        images: reportImages,
        submittedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        cycleType: cycleMode
      });

      if (triggerRepair) {
        onRepairRequest({ id:ref, assetId:reportAsset, assetName:asset.name, custodian:"A. Dela Cruz (Active Custodian)",
          statusLabel:reportStatus, description:reportDesc||"No description.", imageUrl:reportImages[0],
          submittedAt:new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}),
          priority:requestImmediate ? "Critical" : (selectedPill?.severity==="critical"?"Critical":"High"), acknowledged:false });
        setSubmitResult("repair");
      } else { setSubmitResult("healthy"); }
      setSubmitting(false);
    }, 1600);
  };

  const resetReport = () => { setReportAsset(""); setReportStatus(""); setReportDesc(""); setReportImages([]); setSubmitResult(null); setSubmittedRef(""); setRequestImmediate(false); };

  // ── My Assets ─────────────────────────────────────────────────────────────
  if (activeTab === "myassets") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-foreground mb-1">My Borrowed Assets</h1>
            <p className="text-muted-foreground text-sm">Assets currently under your custody.</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode==="list"?"default":"ghost"} size="sm" onClick={()=>setViewMode("list")} className="rounded-none text-xs gap-1.5"><List size={13} />List</Button>
            <Button variant={viewMode==="grid"?"default":"ghost"} size="sm" onClick={()=>setViewMode("grid")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Grid</Button>
          </div>
        </div>
        {custodianAssets.some(a => a.status === "Overdue") && (
          <div className="rounded-xl p-3.5 mb-4 flex items-center gap-3 bg-red-50 border border-red-200">
            <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700"><strong>Overdue Return:</strong> Overdue asset detected. Return immediately or contact your Lab Head.</p>
          </div>
        )}
        
        {custodianAssets.length === 0 ? (
          <Card className="text-center p-8 text-muted-foreground">No borrowed assets under your custody.</Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {custodianAssets.map(asset => (
              <Card key={asset.id}
                className={cn("overflow-hidden border-t-4 p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow flex flex-col", asset.status==="Overdue"?"border-t-red-500":(asset.daysLeft !== undefined && asset.daysLeft<=5)?"border-t-amber-500":"border-t-primary")}
                style={{borderTopWidth:4, borderLeftWidth:0}}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="w-full h-28 overflow-hidden flex-shrink-0"><AssetImagePlaceholder category={asset.category} aspectRatio="16/9" /></div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-primary">{asset.id}</span>
                      <Badge className={cn("text-[9px] px-1.5 py-0.5", statusBadgeClass[asset.status] ?? "bg-muted text-muted-foreground")}>{asset.status}</Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground mb-1 line-clamp-1">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{asset.serial} · {asset.lab}</p>
                  </div>
                  {asset.daysLeft !== undefined && (
                    <div className="flex justify-between items-center text-[10px] border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Due: {asset.dueDate}</span>
                      <span className={cn("font-bold", asset.daysLeft<0?"text-red-700":asset.daysLeft<=5?"text-amber-700":"text-emerald-700")}>{Math.abs(asset.daysLeft)}d left</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {custodianAssets.map(asset => (
              <Card key={asset.id}
                className={cn("overflow-hidden border-l-4 p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow", asset.status==="Overdue"?"border-l-red-500":(asset.daysLeft !== undefined && asset.daysLeft<=5)?"border-l-amber-500":"border-l-primary")}
                style={{borderLeftWidth:4}}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="flex">
                  <div className="w-28 flex-shrink-0"><AssetImagePlaceholder category={asset.category} aspectRatio="4/3" /></div>
                  <div className="flex-1 px-4 py-3 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-primary">{asset.id}</span>
                        <Badge className={cn("text-[10px]", statusBadgeClass[asset.status] ?? "bg-muted text-muted-foreground")}>{asset.status}</Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground mb-2">{asset.name}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{asset.serial}</span>
                        <span className="flex items-center gap-1"><Package size={10} />{asset.lab}</span>
                        {asset.dueDate && <span className="flex items-center gap-1"><Calendar size={10} />Due: {asset.dueDate}</span>}
                      </div>
                    </div>
                    {asset.daysLeft !== undefined && (
                      <div className="text-right flex-shrink-0">
                        <p className={cn("text-2xl font-extrabold", asset.daysLeft<0?"text-red-700":asset.daysLeft<=5?"text-amber-700":"text-emerald-700")}>{Math.abs(asset.daysLeft)}d</p>
                        <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{asset.daysLeft<0?"OVERDUE":"REMAINING"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    );
  }

  // ── Available Equipment ───────────────────────────────────────────────────
  if (activeTab === "available") {
    const availableAssets = assets.filter(a =>
      a.status === "Active" &&
      (filterCategory === "All" || a.category === filterCategory) &&
      (filterLoc === "All" || a.location === filterLoc) &&
      (filterLab === "All" || a.lab === filterLab) &&
      (a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()))
    );

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-foreground mb-1">Available Equipment</h1>
            <p className="text-muted-foreground text-sm">Browse and select available assets from AdRIC research branches.</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode==="list"?"default":"ghost"} size="sm" onClick={()=>setViewMode("list")} className="rounded-none text-xs gap-1.5"><List size={13} />List</Button>
            <Button variant={viewMode==="grid"?"default":"ghost"} size="sm" onClick={()=>setViewMode("grid")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Grid</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <div className="relative col-span-1 md:col-span-1">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID…" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {["Computing Array", "Robotic Node", "Mobile Infrastructure", "Sensor Array", "Networking", "Peripheral"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLoc} onValueChange={setFilterLoc}>
            <SelectTrigger><SelectValue placeholder="All Campuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Campuses</SelectItem>
              <SelectItem value="Manila">Manila</SelectItem>
              <SelectItem value="Laguna">Laguna</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLab} onValueChange={setFilterLab}>
            <SelectTrigger><SelectValue placeholder="All Labs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Labs</SelectItem>
              {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {availableAssets.length === 0 ? (
          <Card className="text-center p-8 text-muted-foreground">No available assets match the active filters.</Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {availableAssets.map(asset => (
              <Card key={asset.id}
                className="overflow-hidden border-t-4 p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow flex flex-col border-t-primary"
                style={{borderTopWidth:4, borderLeftWidth:0}}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="w-full h-28 overflow-hidden flex-shrink-0"><AssetImagePlaceholder category={asset.category} aspectRatio="16/9" /></div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-primary">{asset.id}</span>
                      <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">{asset.status}</Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground mb-1 line-clamp-1">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{asset.serial} · {asset.lab}</p>
                  </div>
                  <div className="flex justify-between items-center text-[10px] border-t pt-2 mt-2">
                    <span className="text-muted-foreground">{asset.location}</span>
                    <span className="text-emerald-700 font-semibold">{asset.condition}% cond.</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {availableAssets.map(asset => (
              <Card key={asset.id}
                className="overflow-hidden border-l-4 p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow border-l-primary"
                style={{borderLeftWidth:4}}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="flex">
                  <div className="w-28 flex-shrink-0"><AssetImagePlaceholder category={asset.category} aspectRatio="4/3" /></div>
                  <div className="flex-1 px-4 py-3 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-primary">{asset.id}</span>
                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{asset.status}</Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground mb-2">{asset.name}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{asset.serial}</span>
                        <span className="flex items-center gap-1"><Package size={10} />{asset.lab} · {asset.location}</span>
                        <span className="text-emerald-700 font-semibold">{asset.condition}% condition</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    );
  }

  // ── QR Scan ───────────────────────────────────────────────────────────────
  if (activeTab === "scan") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">QR Code Scanner</h1>
          <p className="text-muted-foreground text-sm">Scan any lab asset's QR tag to retrieve its information.</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className={cn("w-full max-w-sm aspect-square rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border-2 transition-colors", scanActive ? "bg-[#0A1F14] border-emerald-500" : "bg-muted border-border")}>
            {!scanActive && !scanResult && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera size={44} /><p className="text-sm">Camera viewport inactive</p>
              </div>
            )}
            {scanActive && !scanLoading && !scanResult && (
              <div className="absolute inset-0 bg-[#0A1F14]">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((s,i) => (
                  <div key={i} className="absolute w-8 h-8 border-[3px] border-emerald-400" style={{...s,borderTopWidth:s.top!==undefined?3:0,borderBottomWidth:s.bottom!==undefined?3:0,borderLeftWidth:s.left!==undefined?3:0,borderRightWidth:s.right!==undefined?3:0}} />
                ))}
                <div className="absolute left-[10%] right-[10%] h-0.5 bg-emerald-400 opacity-80" style={{ animation:"scanline 1.5s ease-in-out infinite alternate", top:"50%" }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-emerald-400 text-xs font-bold tracking-widest text-center bg-black/50 px-4 py-2 rounded-xl">SCANNING…<br /><span className="opacity-70 text-[10px]">Align QR code within frame</span></p>
                </div>
              </div>
            )}
            {scanLoading && <div className="flex flex-col items-center gap-2"><Loader size={28} className="text-emerald-400 animate-spin" /><p className="text-sm text-emerald-400">Reading QR code…</p></div>}
            {scanResult && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle size={28} className="text-emerald-500" /></div>
                <p className="text-sm font-bold text-foreground">Asset Identified</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 w-full">
                  <p className="text-xs font-semibold text-emerald-800">EQ-2024-051 · MacBook Pro M2 Max</p>
                  <p className="text-[11px] text-emerald-700">Status: Active · CITe4D · Manila</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            {!scanActive && !scanResult && (
              <div className="flex flex-col gap-2 w-full">
                <Button className="w-full" size="lg" onClick={() => setScanActive(true)}><Camera size={16} />Activate Scanner</Button>
                <Label htmlFor="qr-upload-input" className="cursor-pointer">
                  <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground hover:bg-muted font-bold transition-colors">
                    <Upload size={14} className="mr-2 inline" />Upload QR Image
                  </div>
                </Label>
                <input
                  id="qr-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleQRUpload}
                  className="hidden"
                />
              </div>
            )}
            {scanActive && !scanLoading && !scanResult && (
              <>
                <Button className="flex-1" onClick={simulateScan}>
                  <QrCode size={14} />
                  Simulate Mock Scan ({
                    assets.filter(a => a.status !== "Disposed").find(a => a.id.startsWith("EQ-2026-"))?.id || 
                    assets.filter(a => a.status !== "Disposed")[0]?.id || "EQ-2024-051"
                  })
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setScanActive(false)}><X size={14} />Cancel</Button>
              </>
            )}
            {scanResult && <Button variant="outline" className="flex-1" onClick={() => { setScanResult(null); setScanActive(false); }}>Scan Another</Button>}
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <style>{`@keyframes scanline{from{top:20%}to{top:80%}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    );
  }

  // ── Health Report ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl">
      {/* Inspection cycle context header */}
      <div className={cn("rounded-xl p-4 mb-5 flex items-center justify-between border", cycleMode==="Trimestral"?"bg-emerald-50 border-emerald-200":"bg-blue-50 border-blue-200")}>
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", cycleMode==="Trimestral"?"bg-emerald-100":"bg-blue-100")}>
            {cycleMode==="Trimestral" ? <RefreshCw size={16} className="text-emerald-700" /> : <ClipboardCheck size={16} className="text-blue-700" />}
          </div>
          <div>
            <p className={cn("text-[10px] font-extrabold tracking-widest", cycleMode==="Trimestral"?"text-emerald-700":"text-blue-700")}>ACTIVE INSPECTION CYCLE</p>
            <p className="text-sm font-bold text-foreground">{cycleMode==="Trimestral" ? "Termly (Trimestral) Inspection" : "Annual Inspection Baseline Check"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground tracking-wide">SCHEDULED BY TSG</p>
          <p className={cn("text-xs font-semibold", cycleMode==="Trimestral"?"text-emerald-700":"text-blue-700")}>{cycleMode==="Trimestral"?"Every Trimester":"Once Per Year"}</p>
        </div>
      </div>

      <div className="mb-5">
        <h1 className="text-foreground mb-1">Custodian Health Report</h1>
        <p className="text-muted-foreground text-sm">Submit your asset condition log for this inspection cycle. Critical reports route to TSG.</p>
      </div>

      {/* Submit result */}
      {submitResult && (
        <Card className={cn("mb-5 border-2 text-center", submitResult==="healthy"?"border-emerald-400 bg-emerald-50":"border-red-400 bg-red-50")}>
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", submitResult==="healthy"?"bg-emerald-100":"bg-red-100")}>
              {submitResult==="healthy" ? <CheckCircle size={28} className="text-emerald-500" /> : <Zap size={28} className="text-red-500" />}
            </div>
            <p className={cn("text-base font-extrabold", submitResult==="healthy"?"text-emerald-800":"text-red-800")}>
              {submitResult==="healthy" ? "Report Archived — Asset Healthy" : "Repair Request Triggered"}
            </p>
            <p className={cn("text-xs", submitResult==="healthy"?"text-emerald-700":"text-red-700")}>
              {submitResult==="healthy" ? "Logged in the archival timeline. Asset card updated with green status indicator." : <>Report routed to TSG as high-priority On-Demand Repair Request. Ref: <strong>{submittedRef}</strong></>}
            </p>
            {submitResult==="repair" && (
              <div className="w-full rounded-lg bg-red-100 border border-red-200 p-3 text-left">
                <p className="text-[10px] font-bold text-red-700 tracking-widest mb-1">TSG ALERT DISPATCHED</p>
                <p className="text-xs text-red-700">Status: <strong>{reportStatus}</strong></p>
                {reportDesc && <p className="text-xs text-red-700 mt-0.5">"{reportDesc.slice(0,80)}{reportDesc.length>80?"…":""}"</p>}
              </div>
            )}
            <Button onClick={resetReport} className={submitResult==="repair" ? "bg-red-700 hover:bg-red-800 text-white" : ""} size="sm">Submit Another Report</Button>
          </CardContent>
        </Card>
      )}

      {!submitResult && (
        <>
          {/* Asset selector */}
          <div className="mb-4">
            <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-2 block">Select Asset Under Inspection</Label>
            <div className="flex flex-col gap-2">
              {custodianAssets.map(asset => (
                <button key={asset.id} onClick={() => setReportAsset(asset.id)}
                  className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer text-left transition-all w-full", reportAsset===asset.id?"border-primary bg-emerald-50":"border-border hover:border-primary/40 bg-white")}>
                  <div className="w-12 h-9 rounded overflow-hidden flex-shrink-0"><AssetImagePlaceholder category={asset.category} aspectRatio="4/3" /></div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground">{asset.id} · {asset.lab}</p>
                  </div>
                  {reportAsset===asset.id && <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Report form container — border changes based on state */}
          <div className={cn("rounded-xl border-2 p-5 bg-white transition-all", containerBorderClass)}>
            {/* State banner */}
            {selectedPill && (
              <div className={cn("flex items-center gap-2 p-2.5 rounded-lg mb-4 text-xs font-semibold border", isAlert?"bg-red-50 border-red-200 text-red-700":isWarn&&descHasFault?"bg-orange-50 border-orange-200 text-orange-700":isWarn?"bg-amber-50 border-amber-200 text-amber-700":"bg-emerald-50 border-emerald-200 text-emerald-700")}>
                {isAlert ? <Zap size={12} /> : isWarn ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                {isAlert ? "REPAIR ENGINE WILL BE TRIGGERED — TSG alert on submit"
                  : isWarn && descHasFault ? "FAULT DETECTED IN DESCRIPTION — TSG alert on submit"
                  : isWarn ? "Monitor status — describe issue to determine if escalation is needed"
                  : "Healthy state — will archive to timeline log"}
              </div>
            )}

            {/* Component 1: Image upload */}
            <div className="mb-5">
              <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-2 block">Asset Photo Upload</Label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleImageFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={cn("border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors", dragging ? "border-primary bg-emerald-50" : "border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50")}
              >
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center"><Upload size={18} className="text-emerald-600" /></div>
                <p className="text-sm font-bold text-foreground text-center">Take or upload a current physical picture of the asset</p>
                <p className="text-xs text-muted-foreground text-center">to confirm status and check-in presence</p>
                <p className="text-[11px] text-muted-foreground">PNG, JPG, HEIC · up to 5 photos · 10MB each</p>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={e => handleImageFiles(e.target.files)} className="hidden" />
              {reportImages.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {reportImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-16 h-12 object-cover rounded-lg border-2 border-emerald-400" />
                      <Button size="icon" variant="destructive" className="absolute -top-1.5 -right-1.5 size-4 rounded-full p-0" onClick={() => setReportImages(p => p.filter((_,j) => j !== i))}><X size={8} /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Component 2a: Status pills */}
            <div className="mb-5">
              <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-2 block">Operational Status — Preset Selection</Label>
              <div className="flex flex-wrap gap-2">
                {statusPills.map(pill => (
                  <button key={pill.label} onClick={() => setReportStatus(pill.label)}
                    className={cn("px-3.5 py-1.5 rounded-full border-2 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer", reportStatus===pill.label ? `${pill.bg} ${pill.text} ${pill.ring} ring-2 font-bold` : "bg-white text-muted-foreground border-border hover:border-primary/40")}>
                    {reportStatus===pill.label && <CheckCircle size={10} />}
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Component 2b: Manual description */}
            <div className="mb-5">
              <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-2 block">Manual Diagnostic Encoding</Label>
              <Textarea
                value={reportDesc}
                onChange={e => setReportDesc(e.target.value)}
                placeholder="Manually describe the operational behavior, physical defects, or specific diagnostic anomalies observed during runtime tests…"
                rows={4}
                className={cn("resize-y", triggerRepair && reportDesc ? "border-red-400 focus-visible:ring-red-300" : "")}
              />
              {triggerRepair && reportDesc && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} />Fault keywords detected — TSG repair request auto-generated</p>
              )}
            </div>

            {/* Component 3: Request Immediate Technical Inspection Toggle */}
            <div className="mb-5 flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-slate-50/50">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="immediate-inspection" className="text-xs font-bold text-foreground cursor-pointer">
                    Request Immediate Technical Inspection
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Bypass standard trimestral evaluation for critical defects
                  </p>
                </div>
                <Switch
                  id="immediate-inspection"
                  checked={requestImmediate}
                  onCheckedChange={setRequestImmediate}
                  className="data-[state=checked]:bg-red-600"
                />
              </div>
              {requestImmediate && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs leading-relaxed font-semibold">
                  WARNING: This will bypass the regular trimestral cycle and route an immediate high-priority repair request to the TSG.
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmitReport}
              disabled={!reportAsset || !reportStatus || submitting}
              className={cn("w-full", triggerRepair ? "bg-red-700 hover:bg-red-800 text-white" : "")}
              size="lg"
            >
              {submitting
                ? <><Loader size={14} className="animate-spin" />Processing Report…</>
                : triggerRepair
                  ? <><Zap size={14} />Submit & Trigger TSG Repair Request</>
                  : <><Send size={14} />Submit Health Report</>
              }
            </Button>
          </div>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
