/**
 * Reference Data: TSG and the Secretary keep the lists the forms offer: asset categories, labs, and funding sources.
 * Layer: page. Called by app/routes.tsx at /staff/reference-data.
 * Calls: features/reference/CategoriesSection.tsx, LabsSection.tsx, and FundingSourcesSection.tsx.
 * Used by: TSG and the Secretary (the Staff view). The server refuses every other role (403).
 */
import { useState } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { CategoriesSection } from "@web/features/reference/CategoriesSection";
import { LabsSection } from "@web/features/reference/LabsSection";
import { FundingSourcesSection } from "@web/features/reference/FundingSourcesSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs";

/** The page's three tabs. */
type Section = "categories" | "labs" | "funding";

const SECTIONS: { key: Section; label: string; about: string }[] = [
  { key: "categories", label: "Categories", about: "Asset categories, their useful life for the present value, and whether new assets may use them." },
  { key: "labs", label: "Labs", about: "Research labs, their campus, and the short code their asset tags start with." },
  { key: "funding", label: "Funding Sources", about: "Where an asset's or a project's money came from." },
];

/**
 * Three tabs, each a table with Add and Edit dialogs. A save shows a plain sentence at the top; a refusal shows the
 * server's sentence in the dialog. Takes no props.
 */
export function ReferenceDataPage() {
  const [section, setSection] = useState<Section>("categories");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.referenceData}</h1>
        <p className="text-muted-foreground text-sm">{SECTIONS.find(s => s.key === section)!.about}</p>
      </div>

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold ml-4 cursor-pointer hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <Tabs value={section} onValueChange={value => { setSection(value as Section); setNotice(null); }}>
        <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
          {SECTIONS.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="categories"><CategoriesSection onNotice={setNotice} /></TabsContent>
        <TabsContent value="labs"><LabsSection onNotice={setNotice} /></TabsContent>
        <TabsContent value="funding"><FundingSourcesSection onNotice={setNotice} /></TabsContent>
      </Tabs>
    </div>
  );
}
