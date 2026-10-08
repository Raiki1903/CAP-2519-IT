/**
 * Asset gallery card: one asset as a picture card in the Staff inventory's gallery view.
 * Layer: feature component. Called by pages/staff/InventoryPage.tsx.
 * Calls: features/assets/AssetImagePlaceholder.tsx and assetBadges.tsx. No API.
 * Used by: Staff inventory.
 */
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { statusBadgeClass, CONDITION_DOT_CLASS, ConditionState } from "./assetBadges";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import { cn } from "@web/components/ui/utils";
import { Pencil, Archive, Trash2 } from "lucide-react";

/**
 * Shows an asset's picture, status, id, name, custodian, and condition. A disposed asset is
 * drawn dashed and red with its disposal id, and gets no action buttons. Each button stops the
 * click from also opening the asset.
 *
 * @param eq the asset row from the inventory list
 * @param onSelect opens the asset's detail modal
 * @param onDelete, onEdit, onDecommission optional; each shows its button only when given
 */
export function AssetGalleryCard({ eq, onSelect, onDelete, onEdit, onDecommission }: { eq: any; onSelect: () => void; onDelete?: () => void; onEdit?: () => void; onDecommission?: () => void }) {
  const isDisposed = eq.status === "Disposed";
  return (
    <Card onClick={onSelect} className={cn("overflow-hidden p-0 gap-0 transition-all relative cursor-pointer", isDisposed ? "opacity-85 bg-red-50/20 border-dashed border-red-200 shadow-none hover:opacity-100" : "hover:shadow-md")}>
      <div className="relative">
        <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || eq.image_url} />
        <Badge className={cn("absolute top-2.5 right-2.5 text-[9px] border font-bold uppercase tracking-wider", statusBadgeClass[eq.status])}>{eq.status}</Badge>
        {
          isDisposed && eq.disposalId && (
            <Badge className="absolute top-2.5 left-2.5 text-[9px] font-mono font-extrabold bg-red-100 text-red-800 border-red-300 shadow-sm">
              {eq.disposalId}
            </Badge>
          )
        }
        {
          !isDisposed && (
            <div className="absolute top-2.5 left-2.5 flex gap-1 z-10">
              {onEdit && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-md bg-white hover:bg-blue-50 text-blue-600 border-blue-200 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  title="Edit Asset"
                >
                  <Pencil size={11} />
                </Button>
              )}
              {onDecommission && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-md bg-white hover:bg-amber-50 text-amber-600 border-amber-200 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onDecommission(); }}
                  title="Decommission Asset"
                >
                  <Archive size={11} />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-red-600 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Remove Asset"
                >
                  <Trash2 size={11} />
                </Button>
              )}
            </div>
          )
        }
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
          <div className={cn("h-full w-full", CONDITION_DOT_CLASS[eq.assetCondition] ?? "bg-emerald-400")} />
        </div>
      </div >
      <CardContent className="px-4 py-3.5 flex flex-col justify-between h-[115px]">
        <div>
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className="text-[10px] font-bold text-primary tracking-wide uppercase">{eq.id}</p>
            {isDisposed && eq.disposalId && (
              <span className="text-[10px] font-mono font-extrabold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                {eq.disposalId}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-foreground leading-snug line-clamp-1">{eq.name}</p>
        </div>
        {isDisposed ? (
          <div className="flex items-center justify-between text-[10px] text-red-700 pt-2 border-t border-red-100 font-mono mt-1">
            <span>By: {eq.disposalDetails?.decommissionedBy || "AdRIC Director"}</span>
            <span className="font-bold">{eq.disposalDetails?.decommissionDate || "Disposed"}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border mt-1">
            <span>{eq.custodian || "No custodian"}</span>
            <ConditionState value={eq.assetCondition} />
          </div>
        )}
      </CardContent>
    </Card >
  );
}
