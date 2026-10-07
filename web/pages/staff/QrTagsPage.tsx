import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, QrCode, Printer } from "lucide-react";

export function QrTagsPage() {
  const { displayedAssets } = useStaffAssets();
  const [selectedQR, setSelectedQR] = useState<string[]>([]);

  const qrAssets = displayedAssets.filter(a => a.status !== "Disposed");

  const toggleQR = (id: string) => setSelectedQR(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handlePrintTags = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tagsHtml = selectedQR.map(id => {
      const a = qrAssets.find(x => x.id === id);
      if (!a) return "";

      const svgElement = document.getElementById(`qr-svg-${id}`);
      const svgMarkup = svgElement ? svgElement.outerHTML : "";

      return `
        <div class="tag-card">
          <div class="tag-body">
            <div class="qr-container">
              ${svgMarkup}
            </div>
            <div class="text-container">
              <div class="tag-title">${a.name}</div>
              <div class="tag-meta">ID: ${a.id}</div>
              <div class="tag-meta">Lab: ${a.lab} &middot; ${a.location}</div>
              <div class="tag-link">adric.dlsu.edu.ph/assets/${a.id}</div>
            </div>
          </div>
          <div class="tag-footer">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Assets QR Codes</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 20px;
              background: #ffffff;
            }
            .tags-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .tag-card {
              border: 2px solid #111111;
              border-radius: 8px;
              padding: 12px;
              background: #ffffff;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .tag-body {
              display: flex;
              gap: 12px;
              align-items: center;
            }
            .qr-container {
              width: 64px;
              height: 64px;
              padding: 4px;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              background: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .qr-container svg {
              width: 100% !important;
              height: 100% !important;
            }
            .text-container {
              flex: 1;
              min-width: 0;
            }
            .tag-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 10px;
              font-weight: 800;
              color: #111827;
              margin-bottom: 3px;
              line-height: 1.2;
              text-transform: uppercase;
            }
            .tag-meta {
              font-size: 8px;
              color: #4b5563;
              margin-bottom: 2px;
              font-weight: 600;
            }
            .tag-link {
              font-size: 7px;
              color: #005a36;
              font-family: monospace;
              font-weight: 700;
              margin-top: 4px;
            }
            .tag-footer {
              text-align: center;
              font-size: 7px;
              color: #9ca3af;
              margin-top: 10px;
              padding-top: 6px;
              border-top: 1px solid #f3f4f6;
              font-weight: 700;
              letter-spacing: 0.05em;
            }
            @media print {
              body {
                padding: 0;
              }
              .tag-card {
                border-color: #000000;
              }
            }
          </style>
        </head>
        <body>
          <div class="tags-grid">
            ${tagsHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">QR Tag Layout Wizard</h1>
        <p className="text-muted-foreground text-sm">Generate and export printable physical tracking barcodes for laboratory assets.</p>
      </div>
      <div className="flex gap-4">
        <Card className="flex-1 overflow-hidden p-0">
          <CardHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Select Assets</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setSelectedQR(qrAssets.map(a => a.id))}>Select All</Button>
          </CardHeader>
          {qrAssets.map(asset => (
            <div key={asset.id} onClick={() => toggleQR(asset.id)}
              className={cn("flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-border last:border-0 transition-colors", selectedQR.includes(asset.id) ? "bg-emerald-50" : "hover:bg-muted/30")}>
              <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", selectedQR.includes(asset.id) ? "border-primary bg-primary" : "border-border bg-background")}>
                {selectedQR.includes(asset.id) && <CheckCircle size={10} className="text-white" />}
              </div>
              <div className="flex-1"><p className="text-xs font-semibold text-foreground">{asset.name}</p><p className="text-[10px] text-muted-foreground">{asset.id} · {asset.lab} · {asset.location}</p></div>
              <QrCode size={14} className="text-muted-foreground" />
            </div>
          ))}
        </Card>

        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <Card className="flex-1">
            <CardHeader><CardTitle className="text-sm">Tag Preview</CardTitle></CardHeader>
            <CardContent>
              {selectedQR.length === 0
                ? <div className="flex flex-col items-center py-8 text-muted-foreground gap-2"><QrCode size={36} /><p className="text-xs">Select assets to preview</p></div>
                : <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
                  {selectedQR.map(id => {
                    const a = qrAssets.find(x => x.id === id)!;
                    return (
                      <div key={id} className="border-2 border-foreground rounded-lg p-2.5">
                        <div className="flex gap-2">
                          <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 p-1 border border-border">
                            <QRCodeSVG
                              id={`qr-svg-${a.id}`}
                              value={`https://adric.dlsu.edu.ph/assets/${a.id}`}
                              size={48}
                              bgColor={"#ffffff"}
                              fgColor={"#111111"}
                              level={"M"}
                            />
                          </div>
                          <div>
                            <p className="text-[9px] font-extrabold text-foreground leading-snug">{a.name}</p>
                            <p className="text-[8px] text-muted-foreground">{a.id}</p>
                            <p className="text-[8px] text-muted-foreground">{a.lab} · {a.location}</p>
                            <p className="text-[7px] text-primary/70 font-mono mt-0.5 select-all">adric.dlsu.edu.ph/assets/{a.id}</p>
                          </div>
                        </div>
                        <p className="text-center text-[7px] text-muted-foreground tracking-wide mt-2 pt-1.5 border-t border-border">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</p>
                      </div>
                    );
                  })}
                </div>
              }
            </CardContent>
          </Card>
          <Button disabled={!selectedQR.length} onClick={handlePrintTags} className="w-full gap-2 bg-[#005A36] hover:bg-[#004225] text-white"><Printer size={13} />Print {selectedQR.length > 0 ? `${selectedQR.length} Tag${selectedQR.length > 1 ? "s" : ""}` : "Tags"}</Button>
        </div>
      </div>
    </div>
  );
}
