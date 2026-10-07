import { useState } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { AssetGalleryCard } from "@web/features/assets/AssetGalleryCard";
import { AssetImagePlaceholder } from "@web/features/assets/AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "@web/features/assets/AssetDetailModal";
import { EditAssetDialog } from "@web/features/assets/EditAssetDialog";
import { DeleteAssetDialog } from "@web/features/assets/DeleteAssetDialog";
import { statusBadgeClass, ConditionState } from "@web/features/assets/assetBadges";
import { fundingSources } from "@web/features/assets/assetFields";
import { DisposalFormDialog } from "@web/features/disposals/DisposalFormDialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { Search, LayoutGrid, Table2, Pencil, Archive, Trash2 } from "lucide-react";

export function InventoryPage() {
  const { currentUser } = useSession();
  const { syncFromDb } = useServerData();
  const { displayedAssets, fetchDbAssets } = useStaffAssets();

  const [search, setSearch] = useState("");
  const [filterFunding, setFilterFunding] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("gallery");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "category" | "procured">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [disposalAsset, setDisposalAsset] = useState<any | null>(null);
  const [inventorySubTab, setInventorySubTab] = useState<"active" | "disposed">("active");

  const openAsset = (eq: any): AssetDetail => ({
    id: eq.id, name: eq.name, serial: eq.serial, manufacturer: eq.manufacturer,
    category: eq.category, funding: eq.funding, procured: eq.procured,
    warranty: eq.warranty, location: eq.location, currentLocation: eq.currentLocation, lab: eq.lab,
    status: eq.status, condition: eq.condition, assetCondition: eq.assetCondition, custodian: eq.custodian,
    description: eq.description || eq.remarks || "No additional TSG/ITS remarks recorded.",
    image: eq.image || eq.image_url,
    disposalId: eq.disposalId,
    disposalDetails: eq.disposalDetails
  });

  const filtered = displayedAssets.filter(eq => {
    const matchSearch = eq.name.toLowerCase().includes(search.toLowerCase()) || eq.serial.toLowerCase().includes(search.toLowerCase());
    const matchFunding = filterFunding === "All" || eq.funding === filterFunding;
    const matchLoc = filterLoc === "All" || eq.location === filterLoc;

    // Decommissioned subtab filtering
    const matchSubTab = inventorySubTab === "disposed"
      ? eq.status === "Disposed"
      : eq.status !== "Disposed";

    return matchSearch && matchFunding && matchLoc && matchSubTab;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground mb-1">Asset Inventory</h1>
          <p className="text-muted-foreground text-sm">Complete hardware registry · {displayedAssets.filter(a => a.status !== "Disposed").length} active assets across 2 campuses</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
          </div>
        </div>
      </div>

      {/* Sub-tab selection bar */}
      <div className="flex border-b border-border mb-5 gap-4">
        <button
          onClick={() => setInventorySubTab("active")}
          className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "active" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
        >
          Active Registry ({displayedAssets.filter(a => a.status !== "Disposed").length})
        </button>
        <button
          onClick={() => setInventorySubTab("disposed")}
          className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "disposed" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
        >
          Decommissioned Archive ({displayedAssets.filter(a => a.status === "Disposed").length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
          <Input className="pl-8" placeholder="Search by name or serial..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterFunding} onChange={e => setFilterFunding(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="All">All Funding Origins</option>
          {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="All">All Campuses</option>
          <option value="Manila">Manila</option>
          <option value="Laguna">Laguna</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
          <option value="procured">Sort by Procurement Date</option>
        </select>
        <Button variant="outline" onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")} className="h-10 text-xs font-bold">
          {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
        </Button>
      </div>

      {(() => {
        const sortedAssets = [...filtered].sort((a, b) => {
          let comp = 0;
          if (sortBy === "category") {
            comp = (a.category || "").localeCompare(b.category || "");
          } else if (sortBy === "procured") {
            const dateA = a.procured ? new Date(a.procured).getTime() : 0;
            const dateB = b.procured ? new Date(b.procured).getTime() : 0;
            comp = dateA - dateB;
          } else {
            comp = (a.name || "").localeCompare(b.name || "");
          }
          return sortOrder === "asc" ? comp : -comp;
        });

        return sortedAssets.length === 0 ? (
          <Card className="text-center py-10 text-muted-foreground">No assets matched your active filters</Card>
        ) : viewMode === "gallery" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {sortedAssets.map(eq => (
              <AssetGalleryCard
                key={eq.id}
                eq={eq}
                onSelect={() => setSelectedAsset(openAsset(eq))}
                onDelete={inventorySubTab === "active" ? () => setAssetToDelete(eq.id) : undefined}
                onEdit={inventorySubTab === "active" ? () => setEditingAsset(eq) : undefined}
                onDecommission={inventorySubTab === "active" ? () => setDisposalAsset(eq) : undefined}
              />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["", "Asset ID", "Name", "Category", "Status", "Custodian", "Location", "Cond.", "Funding", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssets.map(eq => (
                  <TableRow key={eq.id} className={cn("cursor-pointer transition-colors", eq.status === "Disposed" ? "opacity-50 grayscale bg-muted/10 hover:bg-muted/20" : "")} onClick={() => setSelectedAsset(openAsset(eq))}>
                    <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || eq.image_url} /></div></TableCell>
                    <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{eq.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                    <TableCell><Badge className={cn("text-[10px]", statusBadgeClass[eq.status])}>{eq.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.custodian || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.currentLocation || eq.location}</TableCell>
                    <TableCell><ConditionState value={eq.assetCondition} /></TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {inventorySubTab === "active" ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => setEditingAsset(eq)}
                            title="Edit Asset"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                            onClick={() => setDisposalAsset(eq)}
                            title="Decommission Asset"
                          >
                            <Archive size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setAssetToDelete(eq.id)}
                            title="Remove Asset"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Decommissioned</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      })()}

      <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

      {/* Edit Asset Dialog */}
      {editingAsset && (
        <EditAssetDialog
          key={editingAsset.id}
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={() => {
            syncFromDb();
            fetchDbAssets();
          }}
        />
      )}

      {/* Disposal Form Dialog */}
      {disposalAsset && (
        <DisposalFormDialog
          key={disposalAsset.id}
          asset={disposalAsset}
          onClose={() => setDisposalAsset(null)}
          requestedBy={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "ITS Staff"}
          onSubmitted={() => fetchDbAssets()}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteAssetDialog assetToDelete={assetToDelete} onClose={() => setAssetToDelete(null)} onDeleted={fetchDbAssets} />
    </div>
  );
}
