/**
 * Staff Import page: bulk CSV check and import for projects and assets.
 * Layer: page. Called by app/routes.tsx at /staff/import.
 * Calls: api/imports.api.ts, features/lookups/useLookups.ts, state/serverData.tsx, state/session.tsx.
 * Used by: TSG Staff (Projects and Assets tabs) and the AdRIC Secretary (Projects tab only).
 */
import { useState, type ChangeEvent } from "react";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABELS,
} from "@shared/enums/assetCondition";
import {
  ASSET_IMPORT_COLUMNS,
  ASSET_IMPORT_REQUIRED_COLUMNS,
  PROJECT_IMPORT_COLUMNS,
  PROJECT_IMPORT_REQUIRED_COLUMNS,
} from "@shared/constants/importColumns";
import type { ImportRowError } from "@shared/types/imports";
import * as importsApi from "@web/api/imports.api";
import {
  forgetFormLookups,
  useFormLookups,
} from "@web/features/lookups/useLookups";
import { useServerData } from "@web/state/serverData";
import { useSession } from "@web/state/session";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@web/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@web/components/ui/tabs";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

type ImportTab = "projects" | "assets";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_DISPLAY_PREVIEW_ROWS = 50;

interface ColumnSpec {
  name: string;
  required: boolean;
  rule: string;
}

const PROJECT_REQUIRED_SET = new Set<string>(PROJECT_IMPORT_REQUIRED_COLUMNS);
const ASSET_REQUIRED_SET = new Set<string>(ASSET_IMPORT_REQUIRED_COLUMNS);

const PROJECT_COLUMN_RULES: Record<
  (typeof PROJECT_IMPORT_COLUMNS)[number],
  string
> = {
  project_code:
    "The project's code, up to 255 characters. It must not already be used, in this file or in the system.",
  project_name: "The project's name, up to 255 characters.",
  project_leader: "The project leader's name, up to 255 characters.",
  lab: "The lab's short code, for example CITe4D (see Allowed values). Capital letters don't matter.",
  start_date: "A date: yyyy-mm-dd or m/d/yyyy.",
  funding_source: "Optional. One of the funding sources in Allowed values.",
  end_date: "Optional. A date, on or after the start date.",
};

const ASSET_COLUMN_RULES: Record<
  (typeof ASSET_IMPORT_COLUMNS)[number],
  string
> = {
  lab: "The lab's short code, for example CITe4D (see Allowed values). Capital letters don't matter.",
  name: "The asset's name, up to 255 characters.",
  category: "One of the categories in Allowed values.",
  condition: "One of the conditions in Allowed values.",
  health_score:
    "Optional. A whole number from 0 to 100. Left empty, it gets the usual score for the condition.",
  serial_number:
    "Optional, up to 255 characters. It must not already be used, in this file or in the system (Retired assets too).",
  manufacturer: "Optional, up to 255 characters.",
  home_room: "Optional, up to 100 characters.",
  project_code:
    "Optional. A project code already in the system (see Allowed values).",
  funding_source: "Optional. One of the funding sources in Allowed values.",
  acquisition_value:
    "Optional. An amount from 0 to 99,999,999.99. PHP, ₱ and commas are fine.",
  procurement_date: "Optional. A date: yyyy-mm-dd or m/d/yyyy.",
  warranty_expiry: "Optional. A date: yyyy-mm-dd or m/d/yyyy.",
  accessories: "Optional, up to 500 characters.",
  its_property_tag:
    "Optional, up to 100 characters. It must not already be used, in this file or in the system (Retired assets too).",
  tsg_tag:
    "Optional, up to 100 characters. It must not already be used, in this file or in the system (Retired assets too).",
  missing_accessories:
    "Optional, up to 255 characters. Saved on the asset's first inspection.",
  inspection_remarks:
    "Optional, up to 255 characters. Saved on the asset's first inspection.",
};

const PROJECT_COLUMN_SPECS: ColumnSpec[] = PROJECT_IMPORT_COLUMNS.map(name => ({
  name,
  required: PROJECT_REQUIRED_SET.has(name),
  rule: PROJECT_COLUMN_RULES[name],
}));

const ASSET_COLUMN_SPECS: ColumnSpec[] = ASSET_IMPORT_COLUMNS.map(name => ({
  name,
  required: ASSET_REQUIRED_SET.has(name),
  rule: ASSET_COLUMN_RULES[name],
}));

/** Triggers a browser download of a header-only CSV template file. */
function downloadCsvTemplate(filename: string, columns: readonly string[]): void {
  const csvContent = `${columns.join(",")}\n`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Collapsible list of live allowed values from GET /api/lookups and shared condition labels.
 * Keyed by `lookupRevision` in the parent so a projects import reloads the project codes immediately.
 */
function AllowedValuesPanel({ mode }: { mode: ImportTab }) {
  const { lookups, failed } = useFormLookups();
  const [open, setOpen] = useState(false);

  const labCodes = lookups?.labs.map(l => l.code) ?? [];
  const fundingNames = lookups?.fundingSources.map(f => f.name) ?? [];
  const categoryLabels = lookups?.categories.map(c => c.label) ?? [];
  const conditionLabels = ASSET_CONDITIONS.map(c => ASSET_CONDITION_LABELS[c]);
  const projectCodes = lookups?.projects.map(p => p.code) ?? [];

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-bold text-foreground cursor-pointer"
      >
        <span>Allowed values</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 text-xs text-muted-foreground border-t border-border pt-3">
          {failed && (
            <p className="text-destructive">
              Could not load the lookup values. Refresh the page to try again.
            </p>
          )}
          {!lookups && !failed && <p>Loading allowed values...</p>}
          {lookups && (
            <>
              <div>
                <span className="font-semibold text-foreground">
                  Lab short codes:{" "}
                </span>
                <span>
                  {labCodes.length > 0 ? labCodes.join(", ") : "None"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-foreground">
                  Funding source names:{" "}
                </span>
                <span>
                  {fundingNames.length > 0 ? fundingNames.join(", ") : "None"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-foreground">
                  Categories:{" "}
                </span>
                <span>
                  {categoryLabels.length > 0
                    ? categoryLabels.join(", ")
                    : "None"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-foreground">
                  Conditions:{" "}
                </span>
                <span>{conditionLabels.join(", ")}</span>
              </div>
              {mode === "assets" && (
                <div>
                  <span className="font-semibold text-foreground">
                    Project codes:{" "}
                  </span>
                  <span>
                    {projectCodes.length > 0
                      ? projectCodes.join(", ")
                      : "None"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * One tab of the Import page (Projects or Assets), holding its own file selection, check result, and save state.
 */
function ImportTabPanel({
  mode,
  lookupRevision,
  onProjectsImported,
  onAssetsImported,
}: {
  mode: ImportTab;
  lookupRevision: number;
  onProjectsImported: () => void;
  onAssetsImported: () => Promise<void>;
}) {
  const isAssets = mode === "assets";
  const templateFilename = isAssets
    ? "assets-template.csv"
    : "projects-template.csv";
  const columns = isAssets ? ASSET_IMPORT_COLUMNS : PROJECT_IMPORT_COLUMNS;
  const columnSpecs = isAssets ? ASSET_COLUMN_SPECS : PROJECT_COLUMN_SPECS;

  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);

  const [rowErrors, setRowErrors] = useState<ImportRowError[] | null>(null);
  const [readyRowCount, setReadyRowCount] = useState<number | null>(null);
  const [previewRows, setPreviewRows] = useState<
    Record<string, string | number | null>[]
  >([]);
  const [createdItems, setCreatedItems] = useState<
    { row: number; key: string }[] | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const busy = checking || importing;
  const canCheck = csvText !== null && !fileError && !busy;
  const canImport =
    csvText !== null &&
    !fileError &&
    readyRowCount !== null &&
    readyRowCount > 0 &&
    (rowErrors === null || rowErrors.length === 0) &&
    !busy;

  const clearResults = () => {
    setRowErrors(null);
    setReadyRowCount(null);
    setPreviewRows([]);
    setCreatedItems(null);
    setServerError(null);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    clearResults();
    setFileError(null);
    setCsvText(null);

    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFileName("");
      return;
    }

    setSelectedFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Only .csv files can be imported. Choose a .csv file.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError("The file is larger than 1 MB. Choose a file up to 1 MB.");
      return;
    }

    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setFileError("Could not read the selected file. Choose it again.");
    }
  };

  const handleCheck = async () => {
    if (csvText === null || busy) return;
    clearResults();
    setChecking(true);
    try {
      const res = isAssets
        ? await importsApi.checkAssets(csvText)
        : await importsApi.checkProjects(csvText);

      if (Array.isArray(res.errors) && res.errors.length > 0) {
        setRowErrors(res.errors);
      } else if (res.success && Array.isArray(res.errors)) {
        setReadyRowCount(res.rowCount ?? 0);
        setPreviewRows((res.preview ?? []).slice(0, MAX_DISPLAY_PREVIEW_ROWS));
      } else {
        setServerError(
          res.error || "Could not check the file. Try again.",
        );
      }
    } catch {
      setServerError("Could not reach the server. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    if (!canImport || csvText === null) return;
    setServerError(null);
    setCreatedItems(null);
    setImporting(true);
    try {
      const res = isAssets
        ? await importsApi.saveAssets(csvText)
        : await importsApi.saveProjects(csvText);

      if (res.success && Array.isArray(res.created)) {
        setCreatedItems(res.created);
        setReadyRowCount(null);
        setPreviewRows([]);
        setRowErrors(null);
        if (isAssets) {
          await onAssetsImported();
        } else {
          onProjectsImported();
        }
      } else if (Array.isArray(res.errors) && res.errors.length > 0) {
        setRowErrors(res.errors);
        setReadyRowCount(null);
        setPreviewRows([]);
      } else {
        setServerError(
          res.error || "Could not complete the import. Try again.",
        );
      }
    } catch {
      setServerError("Could not reach the server. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const previewColumns: { key: string; label: string }[] = isAssets
    ? [
        { key: "expectedTag", label: "Tag (expected)" },
        ...ASSET_IMPORT_COLUMNS.map(col => ({ key: col, label: col })),
      ]
    : PROJECT_IMPORT_COLUMNS.map(col => ({ key: col, label: col }));

  return (
    <div className="space-y-5">
      {/* 1. Template */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">1. Template</h2>
            <p className="text-xs text-muted-foreground">
              Download the CSV header template and fill in up to 500 rows.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCsvTemplate(templateFilename, columns)}
            className="text-xs gap-1.5"
          >
            <Download size={14} />
            Download template
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                  Column
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                  Required
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                  What goes in it
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columnSpecs.map(col => (
                <TableRow key={col.name}>
                  <TableCell className="font-mono text-xs font-semibold text-foreground">
                    {col.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {col.required ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-normal">
                    {col.rule}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 2. Allowed values */}
      <AllowedValuesPanel key={lookupRevision} mode={mode} />

      {/* 3. File & 4-5. Check and Import */}
      <Card className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-foreground mb-1">
            2. Choose and check your CSV file
          </h2>
          <p className="text-xs text-muted-foreground">
            Select a .csv file (at most 1 MB), check it for problems, then
            import.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={handleFileChange}
            aria-label={isAssets ? "Assets CSV file" : "Projects CSV file"}
            className="block text-xs text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted cursor-pointer"
          />
          {selectedFileName && (
            <span className="text-xs text-muted-foreground">
              {selectedFileName}
            </span>
          )}
        </div>

        {fileError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            {fileError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCheck}
            onClick={handleCheck}
            className="text-xs"
          >
            {checking ? "Checking..." : "Check file"}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!canImport}
            onClick={handleImport}
            className="text-xs"
          >
            {importing
              ? "Importing..."
              : `Import ${readyRowCount ?? 0} rows`}
          </Button>
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            {serverError}
          </div>
        )}

        {/* Validation errors table (from check or 400 save) */}
        {rowErrors && rowErrors.length > 0 && (
          <div className="space-y-3 pt-2">
            <p
              role="alert"
              className="text-xs font-semibold text-destructive"
            >
              {rowErrors.length} problems found. Fix them in the file and choose
              it again.
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Row
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Column
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Problem
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowErrors.map((err, idx) => (
                    <TableRow key={`${err.row}-${err.column ?? "file"}-${idx}`}>
                      <TableCell className="font-mono text-xs">
                        {err.row === 0 ? "-" : err.row}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {err.column ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-destructive whitespace-normal">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Ready preview table */}
        {readyRowCount !== null &&
          (rowErrors === null || rowErrors.length === 0) && (
            <div className="space-y-3 pt-2">
              <p
                role="status"
                className="text-xs font-semibold text-emerald-700"
              >
                All {readyRowCount} rows are ready.
              </p>
              {previewRows.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {previewColumns.map(col => (
                          <TableHead
                            key={col.key}
                            className="text-[10px] font-bold tracking-wider whitespace-nowrap"
                          >
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={row.row ? String(row.row) : idx}>
                          {previewColumns.map(col => (
                            <TableCell
                              key={col.key}
                              className="text-xs whitespace-nowrap"
                            >
                              {row[col.key] !== null &&
                              row[col.key] !== undefined &&
                              row[col.key] !== ""
                                ? String(row[col.key])
                                : "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

        {/* Created items list (201) */}
        {createdItems && (
          <div className="space-y-3 pt-2">
            <p role="status" className="text-xs font-semibold text-emerald-700">
              {createdItems.length} {isAssets ? "assets" : "projects"} imported.
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Row
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      {isAssets ? "Asset tag" : "Project code"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdItems.map(item => (
                    <TableRow key={`${item.row}-${item.key}`}>
                      <TableCell className="font-mono text-xs">
                        {item.row}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {item.key}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Staff CSV Import screen with Projects and Assets tabs.
 * Takes no props. Calls imports.api.ts, forgetFormLookups(), and useServerData().
 */
export function ImportPage() {
  const { currentUser } = useSession();
  const { syncFromDb, refreshSharedLists } = useServerData();
  const isTsg = currentUser?.staffUnit === "TSG";

  const [tab, setTab] = useState<ImportTab>("projects");
  const [lookupRevision, setLookupRevision] = useState(0);

  const activeTab: ImportTab = !isTsg ? "projects" : tab;

  const handleProjectsImported = () => {
    forgetFormLookups();
    setLookupRevision(r => r + 1);
  };

  const handleAssetsImported = async () => {
    // syncFromDb updates the shared asset list even if login or another screen synced in the last 5 seconds.
    await syncFromDb();
    await refreshSharedLists();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Import</h1>
        <p className="text-muted-foreground text-sm">
          Load existing projects and equipment from a CSV file. Import projects
          first, then the assets that name them.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={value => setTab(value as ImportTab)}
      >
        <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
          <TabsTrigger
            value="projects"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Projects
          </TabsTrigger>
          {isTsg && (
            <TabsTrigger
              value="assets"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              Assets
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects">
          <ImportTabPanel
            mode="projects"
            lookupRevision={lookupRevision}
            onProjectsImported={handleProjectsImported}
            onAssetsImported={handleAssetsImported}
          />
        </TabsContent>

        {isTsg && (
          <TabsContent value="assets">
            <ImportTabPanel
              mode="assets"
              lookupRevision={lookupRevision}
              onProjectsImported={handleProjectsImported}
              onAssetsImported={handleAssetsImported}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
