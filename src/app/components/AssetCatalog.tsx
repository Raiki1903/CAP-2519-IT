import { useState } from "react";
import { motion } from "motion/react";
import {
  Search, MapPin, Tag, Calendar, CheckCircle,
  Clock, Loader, Package,
} from "lucide-react";
import { useApp } from "../context";

export interface BorrowRequest {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  assetSerial: string;
  assetLocation: string;
  assetLab: string;
  requestedBy: string;
  purpose: string;
  returnDate: string;
  submittedAt: string;
  status: string;
}
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Textarea } from "./ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { cn } from "./ui/utils";
// ── Shared equipment registry ────────────────────────────────────────────────
// ── Equipment Registry ──────────────────────────────────────────────────
export const allEquipment: any[] = [];

const statusConfig: Record<string, { label: string; className: string; canRequest: boolean }> = {
  Available:   { label: "Available",   className: "bg-emerald-50 text-emerald-700 border-emerald-200", canRequest: true  },
  "On Loan":   { label: "On Loan",     className: "bg-blue-50   text-blue-700   border-blue-200",     canRequest: false },
  Reserved:    { label: "Reserved",    className: "bg-violet-50 text-violet-700 border-violet-200",   canRequest: false },
  Maintenance: { label: "Maintenance", className: "bg-amber-50  text-amber-700  border-amber-200",    canRequest: false },
};

const categories = ["All Categories", "Computing Array", "Robotic Node", "Mobile Infrastructure", "Sensor Array", "Networking", "Peripheral"];

export function AssetCatalog() {
  const { assets } = useApp();
  const [dbAssets, setDbAssets] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:4000/api/assets")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.assets)) {
          setDbAssets(data.assets);
        }
      })
      .catch(err => console.error("AssetCatalog DB fetch error:", err));
  }, []);

  const currentEquipment = dbAssets.length > 0 ? dbAssets : assets;

  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const addBorrowRequest = (req: BorrowRequest) => {
    setBorrowRequests(prev => [...prev, req]);
  };

  const [search, setSearch]             = useState("");
  const [filterCat, setFilterCat]       = useState("All Categories");
  const [filterLoc, setFilterLoc]       = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [purpose, setPurpose]             = useState("");
  const [returnDate, setReturnDate]       = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  // Map assetId → borrow status from current user's requests
  const myRequestMap = Object.fromEntries(
    borrowRequests.map(r => [r.assetId, r.status])
  );

  const filtered = currentEquipment.filter(eq => {
    const s = search.toLowerCase();
    const name = eq.name || eq.assetName || "";
    const id = eq.id || eq.asset_tag || "";
    const lab = eq.lab || "";
    const category = eq.category || eq.assetType || "";
    const location = eq.location || "";
    const status = eq.status || "Available";
    const serial = eq.serial || eq.serial_number || "";
    const manufacturer = eq.manufacturer || "";
    const description = eq.description || "";
    const funding = eq.fundingOrganization || eq.funding || "";
    const project = eq.projectTitle || eq.projectName || "";

    return (
      (name.toLowerCase().includes(s) ||
       id.toLowerCase().includes(s) ||
       lab.toLowerCase().includes(s) ||
       serial.toLowerCase().includes(s) ||
       manufacturer.toLowerCase().includes(s) ||
       description.toLowerCase().includes(s) ||
       funding.toLowerCase().includes(s) ||
       project.toLowerCase().includes(s) ||
       location.toLowerCase().includes(s)) &&
      (filterCat === "All Categories" || category === filterCat) &&
      (filterLoc === "All" || location === filterLoc) &&
      (filterStatus === "All" || status === filterStatus)
    );
  });

  const openDialog = (eq: any) => {
    setSelectedAsset(eq);
    setPurpose("");
    setReturnDate("");
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!selectedAsset || !purpose || !returnDate) return;
    setSubmitting(true);
    setTimeout(() => {
      const req: BorrowRequest = {
        id: `BRW-${Date.now()}`,
        assetId: selectedAsset.id || selectedAsset.asset_tag,
        assetName: selectedAsset.name || selectedAsset.assetName,
        assetCategory: selectedAsset.category || selectedAsset.assetType,
        assetSerial: selectedAsset.serial || selectedAsset.serial_number || "",
        assetLocation: selectedAsset.location || "",
        assetLab: selectedAsset.lab || "",
        requestedBy: "A. Dela Cruz",
        purpose,
        returnDate,
        submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        status: "Pending",
      };
      addBorrowRequest(req);
      setSubmitting(false);
      setSubmitted(true);
    }, 1400);
  };

  const statusSummary = [
    { label: "Available",   count: currentEquipment.filter(e => e.status === "Available" || e.status === "Active").length,   color: "text-emerald-700" },
    { label: "On Loan",     count: currentEquipment.filter(e => e.status === "On Loan").length,     color: "text-blue-700"   },
    { label: "Maintenance", count: currentEquipment.filter(e => e.status === "Maintenance").length, color: "text-amber-700"  },
    { label: "Reserved",    count: currentEquipment.filter(e => e.status === "Reserved").length,    color: "text-violet-700" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 style={{ fontFamily: "'Montserrat', sans-serif" }} className="text-foreground mb-1">Equipment Catalog</h1>
        <p className="text-muted-foreground text-sm">Browse all laboratory assets and submit borrow requests for available equipment.</p>
      </div>

      {/* Status summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {statusSummary.map(({ label, count, color }) => (
          <motion.div
            key={label}
            whileHover={{ scale: 1.02 }}
            onClick={() => setFilterStatus(filterStatus === label ? "All" : label)}
            className={cn("cursor-pointer select-none")}
          >
            <Card className={cn("border-2 transition-colors", filterStatus === label ? "border-primary" : "border-border")}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className={cn("text-2xl font-extrabold", color)} style={{ fontFamily: "'Montserrat', sans-serif" }}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID, or lab…"
            className="pl-8"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLoc} onValueChange={setFilterLoc}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Campuses</SelectItem>
            <SelectItem value="Manila">Manila</SelectItem>
            <SelectItem value="Laguna">Laguna</SelectItem>
          </SelectContent>
        </Select>
        {filterStatus !== "All" && (
          <Button variant="outline" size="sm" onClick={() => setFilterStatus("All")} className="text-xs gap-1">
            Showing: {filterStatus} ×
          </Button>
        )}
        <p className="self-center text-xs text-muted-foreground ml-auto">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Asset grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {filtered.map((eq, i) => {
          const sc = statusConfig[eq.status] ?? statusConfig["Available"];
          const myStatus = myRequestMap[eq.id];

          return (
            <motion.div
              key={eq.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.22 }}
            >
              <Card className="overflow-hidden p-0 gap-0 h-full flex flex-col">
                {/* Image */}
                <div className="relative">
                  <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || eq.image_url} />
                  <Badge className={cn("absolute top-2 right-2 text-[9px]", sc.className)}>
                    {sc.label}
                  </Badge>
                  {/* condition bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                    <div
                      className={cn("h-full", eq.condition >= 90 ? "bg-emerald-400" : eq.condition >= 70 ? "bg-amber-400" : "bg-red-400")}
                      style={{ width: `${eq.condition}%` }}
                    />
                  </div>
                </div>

                {/* Info */}
                <CardContent className="px-4 py-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="text-[10px] font-bold text-primary tracking-wide">{eq.id}</p>
                    {eq.status === "Disposed" && eq.disposalId && (
                      <span className="text-[9px] font-mono font-extrabold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        {eq.disposalId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground leading-snug mb-1.5">{eq.name}</p>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Tag size={9} />{eq.manufacturer}</span>
                    <span className="flex items-center gap-1"><MapPin size={9} />{eq.location} · {eq.lab}</span>
                    <span className="flex items-center gap-1"><Calendar size={9} />Proc. {eq.procured}</span>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge>
                    <span className={cn("text-[11px] font-bold", eq.condition >= 90 ? "text-emerald-700" : "text-amber-700")}>{eq.condition}%</span>
                  </div>

                  {/* Request button */}
                  <div className="mt-3">
                    {myStatus === "Pending" && (
                      <div className="flex items-center justify-center gap-1.5 w-full rounded-lg py-1.5 bg-amber-50 border border-amber-200">
                        <Clock size={12} className="text-amber-600" />
                        <span className="text-[11px] font-semibold text-amber-700">Request Pending</span>
                      </div>
                    )}
                    {myStatus === "Approved" && (
                      <div className="flex items-center justify-center gap-1.5 w-full rounded-lg py-1.5 bg-emerald-50 border border-emerald-200">
                        <CheckCircle size={12} className="text-emerald-600" />
                        <span className="text-[11px] font-semibold text-emerald-700">Request Approved</span>
                      </div>
                    )}
                    {myStatus === "Denied" && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openDialog(eq)}>
                        Re-submit Request
                      </Button>
                    )}
                    {!myStatus && sc.canRequest && (
                      <Button size="sm" className="w-full text-xs" onClick={() => openDialog(eq)}>
                        <Package size={12} /> Request to Borrow
                      </Button>
                    )}
                    {!myStatus && !sc.canRequest && (
                      <Button size="sm" variant="outline" className="w-full text-xs" disabled>
                        {eq.status === "On Loan" ? "Currently On Loan" : eq.status === "Maintenance" ? "Under Maintenance" : "Reserved"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No assets match your filters</p>
          <p className="text-xs mt-1">Try clearing the category or status filter</p>
        </div>
      )}

      {/* ── Borrow Request Dialog ──────────────────────────────────────── */}
      <Dialog open={!!selectedAsset} onOpenChange={open => { if (!open) setSelectedAsset(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request to Borrow Equipment</DialogTitle>
            <DialogDescription>
              Your request will be sent to your Lab Head for approval.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <p className="text-base font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Request Submitted</p>
              <p className="text-sm text-muted-foreground">
                Your borrow request for <strong>{selectedAsset?.name}</strong> has been sent to your Lab Head for review.
              </p>
              <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium">
                <Clock size={11} className="inline mr-1" />
                Status: Pending Lab Head approval
              </div>
              <Button size="sm" onClick={() => setSelectedAsset(null)} className="mt-1">Done</Button>
            </motion.div>
          ) : (
            <>
              {/* Asset preview */}
              {selectedAsset && (
                <div className="flex gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                  <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <AssetImagePlaceholder category={selectedAsset.category} aspectRatio="4/3" imageUrl={selectedAsset.image} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary">{selectedAsset.id}</p>
                    <p className="text-sm font-semibold text-foreground leading-snug">{selectedAsset.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedAsset.lab} · {selectedAsset.location}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                    Purpose / Reason for Borrowing
                  </Label>
                  <Textarea
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="Describe the research project, activity, or use-case requiring this equipment…"
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                    Expected Return Date
                  </Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAsset(null)}>Cancel</Button>
                <Button
                  disabled={!purpose || !returnDate || submitting}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? <><Loader size={13} className="animate-spin" />Submitting…</>
                    : <><Package size={13} />Submit Request</>
                  }
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
