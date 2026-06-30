import { useState } from "react";
import { Plus, Search, Download, CheckCircle, Clock, Package, DollarSign, ChevronRight, LayoutGrid, Table2, MapPin, Calendar, Tag } from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";

const MINT = "#10B981";
const fundingSources = ["DOST", "USAID", "CHED", "Internal Grants", "World Bank", "PCAARRD"];

const mockInventory = [
  { id: "EQ-2024-001", name: "Dell PowerEdge R740 Server", serial: "SN-DPE-740-001", manufacturer: "Dell Technologies", category: "Computing Array", funding: "DOST", procured: "2024-01-15", warranty: "2027-01-15", location: "Manila", lab: "CITe4D", status: "Active", condition: 96 },
  { id: "EQ-2024-002", name: "NVIDIA DGX A100 Workstation", serial: "SN-DGX-A100-02", manufacturer: "NVIDIA Corporation", category: "Computing Array", funding: "USAID", procured: "2024-02-20", warranty: "2026-02-20", location: "Laguna", lab: "CAR", status: "On Loan", condition: 82 },
  { id: "EQ-2024-003", name: "UR10e Collaborative Robot", serial: "SN-UR10e-0034", manufacturer: "Universal Robots", category: "Robotic Node", funding: "CHED", procured: "2024-03-10", warranty: "2026-03-10", location: "Manila", lab: "CeHCI", status: "Active", condition: 91 },
  { id: "EQ-2024-004", name: "Boston Dynamics Spot Robot", serial: "SN-SPOT-0178", manufacturer: "Boston Dynamics", category: "Robotic Node", funding: "Internal Grants", procured: "2023-11-05", warranty: "2025-11-05", location: "Laguna", lab: "HXIL", status: "Maintenance", condition: 67 },
  { id: "EQ-2024-005", name: "Leica BLK360 3D Scanner", serial: "SN-LBK-360-09", manufacturer: "Leica Geosystems", category: "Sensor Array", funding: "DOST", procured: "2024-04-01", warranty: "2027-04-01", location: "Manila", lab: "CITe4D", status: "Active", condition: 99 },
  { id: "EQ-2024-006", name: "Surface Pro 9 i7 (Bundle×12)", serial: "SN-SP9-BNDL-03", manufacturer: "Microsoft", category: "Mobile Infrastructure", funding: "CHED", procured: "2024-05-22", warranty: "2026-05-22", location: "Manila", lab: "GAME", status: "Partially Deployed", condition: 88 },
  { id: "EQ-2024-007", name: "Raspberry Pi 4 Cluster (×32)", serial: "SN-RPI4-CLU-07", manufacturer: "Raspberry Pi Ltd", category: "Computing Array", funding: "USAID", procured: "2024-06-01", warranty: "2026-06-01", location: "Laguna", lab: "CeLT", status: "Active", condition: 94 },
  { id: "EQ-2024-008", name: "Phantom VEO4K Ultra-HSC", serial: "SN-PH-VEO-4K-01", manufacturer: "Vision Research", category: "Sensor Array", funding: "DOST", procured: "2024-01-28", warranty: "2027-01-28", location: "Manila", lab: "Bio", status: "Reserved", condition: 100 },
  { id: "EQ-2024-009", name: "Cisco Catalyst 9300 Switch", serial: "FCW2549L0GR", manufacturer: "Cisco Systems", category: "Networking", funding: "CHED", procured: "2024-06-09", warranty: "2027-06-09", location: "Manila", lab: "CITe4D", status: "Active", condition: 100 },
  { id: "EQ-2024-010", name: "Vuzix M400 Smart Glasses ×4", serial: "VX-M400-DLSU", manufacturer: "Vuzix", category: "Peripheral", funding: "Internal Grants", procured: "2024-06-06", warranty: "2026-06-06", location: "Laguna", lab: "CAR", status: "Active", condition: 90 },
];

const statusBadgeClass: Record<string, string> = {
  "Active":             "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance":        "bg-amber-50  text-amber-700  border-amber-200",
  "Reserved":           "bg-violet-50 text-violet-700 border-violet-200",
  "Partially Deployed": "bg-orange-50 text-orange-700 border-orange-200",
};

interface IntakeForm {
  name: string; serial: string; manufacturer: string; category: string;
  funding: string; procured: string; warranty: string; location: string; lab: string; notes: string;
}
const emptyForm: IntakeForm = { name:"", serial:"", manufacturer:"", category:"", funding:"", procured:"", warranty:"", location:"", lab:"", notes:"" };

function ConditionBar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-emerald-400" : value >= 70 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden mt-1">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

function AssetGalleryCard({ eq }: { eq: typeof mockInventory[0] }) {
  return (
    <Card className="overflow-hidden p-0 gap-0 hover:shadow-md transition-shadow">
      <div className="relative">
        <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" />
        <Badge className={cn("absolute top-2 right-2 text-[9px]", statusBadgeClass[eq.status] ?? statusBadgeClass["Active"])}>
          {eq.status}
        </Badge>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
          <div className={cn("h-full", eq.condition >= 90 ? "bg-emerald-400" : eq.condition >= 70 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${eq.condition}%` }} />
        </div>
      </div>
      <CardContent className="px-3.5 py-3">
        <p className="text-[10px] font-bold text-primary tracking-wide mb-1">{eq.id}</p>
        <p className="text-sm font-bold text-foreground leading-snug mb-2">{eq.name}</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Tag size={9} />{eq.manufacturer}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin size={9} />{eq.location} · {eq.lab}</span>
        </div>
        <div className="flex justify-between items-center">
          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">{eq.funding}</Badge>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={9} />{eq.procured}</p>
            <p className={cn("text-[11px] font-bold", eq.condition >= 90 ? "text-emerald-700" : eq.condition >= 70 ? "text-amber-700" : "text-red-700")}>{eq.condition}% health</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ITSDashboard({ activeTab }: { activeTab: string }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [filterFunding, setFilterFunding] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<"table"|"gallery">("gallery");

  const filtered = mockInventory.filter(eq => {
    const matchSearch = eq.name.toLowerCase().includes(search.toLowerCase()) || eq.serial.toLowerCase().includes(search.toLowerCase());
    const matchFunding = filterFunding === "All" || eq.funding === filterFunding;
    const matchLoc = filterLoc === "All" || eq.location === filterLoc;
    return matchSearch && matchFunding && matchLoc;
  });

  const handleSubmit = () => { setSubmitted(true); setTimeout(() => { setShowModal(false); setForm(emptyForm); setStep(1); setSubmitted(false); }, 1800); };

  // ── Overview ──────────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">ITS System Overview</h1>
          <p className="text-muted-foreground text-sm">Procurement intake management and database modeling console.</p>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Assets Registered", value: "1,248", sub: "+12 this mo.", icon: Package,      color: "text-primary" },
            { label: "Active Funding Sources",   value: "6",     sub: "4 programs",  icon: DollarSign,  color: "text-blue-600" },
            { label: "Assets Under Warranty",    value: "94%",   sub: "1,173 units", icon: CheckCircle, color: "text-emerald-600" },
            { label: "Pending Validation",       value: "7",     sub: "Requires action", icon: Clock,   color: "text-amber-600" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Icon size={18} className={color} />
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{sub}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-extrabold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Funding Origin Distribution</CardTitle></CardHeader>
            <CardContent>
              {[{ src:"DOST",pct:31,count:387},{src:"CHED",pct:25,count:312},{src:"USAID",pct:22,count:274},{src:"Internal Grants",pct:14,count:175},{src:"World Bank",pct:5,count:62},{src:"PCAARRD",pct:3,count:38}].map(({src,pct,count}) => (
                <div key={src} className="mb-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-foreground font-medium">{src}</span><span className="text-muted-foreground">{count} · {pct}%</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{width:`${pct}%`}} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent Intake Activity</CardTitle></CardHeader>
            <CardContent className="px-6">
              {[{date:"Jun 10, 2026",item:"Surface Pro 9 Bundle",qty:12,src:"CHED",status:"Validated"},{date:"Jun 08, 2026",item:"UR10e Cobot Arm",qty:1,src:"DOST",status:"Pending"},{date:"Jun 05, 2026",item:"Leica BLK360 Scanner",qty:2,src:"DOST",status:"Validated"},{date:"May 29, 2026",item:"RPi 4 Cluster Kit",qty:32,src:"USAID",status:"Validated"},{date:"May 22, 2026",item:"Phantom VEO4K Camera",qty:1,src:"Internal",status:"Validated"}].map(({date,item,qty,src,status}) => (
                <div key={item} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item} <span className="font-normal text-muted-foreground">×{qty}</span></p>
                    <p className="text-[11px] text-muted-foreground">{date} · {src}</p>
                  </div>
                  <Badge className={status === "Validated" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>{status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Register ──────────────────────────────────────────────────────────────
  if (activeTab === "register") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-foreground mb-1">Register New Procurement Intake</h1>
            <p className="text-muted-foreground text-sm">Initiate hardware serial validation and database entry wizard.</p>
          </div>
          <Button onClick={() => setShowModal(true)}><Plus size={15} /> New Intake</Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[{step:"01",label:"Hardware Identification",desc:"Serial number, manufacturer specs, and category classification."},{step:"02",label:"Procurement Details",desc:"Acquisition date, warranty expiry, and funding origin matrix."},{step:"03",label:"Lab Assignment",desc:"Location routing, lab group allocation, and custodian assignment."}].map(({step,label,desc}) => (
            <Card key={step}>
              <CardContent className="pt-5">
                <p className="text-4xl font-extrabold text-muted/60 mb-2">{step}</p>
                <p className="text-sm font-bold text-foreground mb-1">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Pending Validation Queue</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            {[{id:"INT-2026-0041",name:"Cisco Catalyst 9300 Switch",serial:"FCW2549L0GR",src:"CHED",submitted:"Jun 09, 2026",validator:"Pending Assignment"},{id:"INT-2026-0040",name:"UR10e Cobot — Unit 3",serial:"20220344829",src:"DOST",submitted:"Jun 08, 2026",validator:"J. Reyes"},{id:"INT-2026-0039",name:"Vuzix M400 Smart Glasses ×4",serial:"VX-M400-DLSU",src:"Internal Grants",submitted:"Jun 06, 2026",validator:"M. Santos"}].map(({id,name,serial,src,submitted,validator}) => (
              <div key={id} className="flex items-center justify-between px-6 py-3.5 border-b border-border last:border-0">
                <div><p className="text-sm font-semibold text-foreground">{name}</p><p className="text-xs text-muted-foreground">{id} · {serial} · {src}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">{submitted}</p><p className="text-xs text-emerald-600 font-semibold">Validator: {validator}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Intake Wizard Dialog */}
        <Dialog open={showModal} onOpenChange={open => { if (!open) { setShowModal(false); setStep(1); setForm(emptyForm); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hardware Serial Validation Wizard</DialogTitle>
              <DialogDescription>Step {step} of 3 — complete all sections to register the asset.</DialogDescription>
            </DialogHeader>

            {/* Progress */}
            <div className="flex gap-1.5 px-1">
              {[1,2,3].map(s => <div key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />)}
            </div>

            {submitted ? (
              <div className="flex flex-col items-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle size={28} className="text-emerald-500" /></div>
                <h3 className="text-foreground">Intake Registered</h3>
                <p className="text-sm text-muted-foreground">Asset queued for validation. QR tag generated after TSG review.</p>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <div className="flex flex-col gap-3">
                    <h4 className="font-semibold text-foreground text-sm">Hardware Identification</h4>
                    {[{key:"name",label:"Asset / Device Name",placeholder:"e.g. Dell PowerEdge R740"},{key:"serial",label:"Manufacturer Serial Number",placeholder:"e.g. SN-DPE-740-001"},{key:"manufacturer",label:"Manufacturer",placeholder:"e.g. Dell Technologies"}].map(({key,label,placeholder}) => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</Label>
                        <Input value={form[key as keyof IntakeForm]} onChange={e => setForm({...form,[key]:e.target.value})} placeholder={placeholder} />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Category</Label>
                      <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                        <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                        <SelectContent>{["Computing Array","Robotic Node","Mobile Infrastructure","Sensor Array","Networking","Peripheral"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="flex flex-col gap-3">
                    <h4 className="font-semibold text-foreground text-sm">Procurement & Funding Details</h4>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Funding Origin Matrix</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {fundingSources.map(src => (
                          <Button key={src} type="button" variant={form.funding === src ? "default" : "outline"} size="sm" onClick={() => setForm({...form, funding:src})} className="text-xs h-8">{src}</Button>
                        ))}
                      </div>
                    </div>
                    {[{key:"procured",label:"Procurement Date",type:"date"},{key:"warranty",label:"Warranty Expiry Date",type:"date"}].map(({key,label,type}) => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</Label>
                        <Input type={type} value={form[key as keyof IntakeForm]} onChange={e => setForm({...form,[key]:e.target.value})} />
                      </div>
                    ))}
                  </div>
                )}
                {step === 3 && (
                  <div className="flex flex-col gap-3">
                    <h4 className="font-semibold text-foreground text-sm">Lab Assignment</h4>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Campus Location</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Manila","Laguna"].map(loc => <Button key={loc} type="button" variant={form.location === loc ? "default" : "outline"} onClick={() => setForm({...form,location:loc})} className="text-sm">{loc} Campus</Button>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Research Lab</Label>
                      <Select value={form.lab} onValueChange={v => setForm({...form,lab:v})}>
                        <SelectTrigger><SelectValue placeholder="Select lab…" /></SelectTrigger>
                        <SelectContent>{["CITe4D","CAR","CeLT","CeHCI","Bio","HXIL","GAME","CIVI"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Additional Notes</Label>
                      <textarea value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Special handling instructions…" rows={3}
                        className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y" />
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-2">
                  <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => Math.max(1,s-1))}>Back</Button>
                  {step < 3
                    ? <Button onClick={() => setStep(s => s+1)}>Next <ChevronRight size={14} /></Button>
                    : <Button onClick={handleSubmit}><CheckCircle size={14} /> Submit Intake</Button>
                  }
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground mb-1">Asset Inventory</h1>
          <p className="text-muted-foreground text-sm">Complete hardware registry · {mockInventory.length} assets across 2 campuses</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Dual view toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
          </div>
          <Button variant="outline" size="sm"><Download size={13} />Export</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial…" className="pl-8" />
        </div>
        <Select value={filterFunding} onValueChange={setFilterFunding}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Funding</SelectItem>
            {fundingSources.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
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
      </div>

      {/* Gallery */}
      {viewMode === "gallery" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))" }}>
          {filtered.map(eq => <AssetGalleryCard key={eq.id} eq={eq} />)}
        </div>
      )}

      {/* Table */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12" />
                <TableHead>Asset ID</TableHead>
                <TableHead>Name / Serial</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Funding</TableHead>
                <TableHead>Location / Lab</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cond.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(eq => (
                <TableRow key={eq.id}>
                  <TableCell>
                    <div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" /></div>
                  </TableCell>
                  <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold text-foreground">{eq.name}</p>
                    <p className="text-[10px] text-muted-foreground">{eq.serial}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge></TableCell>
                  <TableCell>
                    <p className="text-xs text-foreground">{eq.location}</p>
                    <p className="text-[10px] text-muted-foreground">{eq.lab}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.warranty}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", statusBadgeClass[eq.status] ?? statusBadgeClass["Active"])}>{eq.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className={cn("text-xs font-bold", eq.condition >= 90 ? "text-emerald-700" : eq.condition >= 70 ? "text-amber-700" : "text-red-700")}>{eq.condition}%</p>
                    <ConditionBar value={eq.condition} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
