/**
 * Loan flow chart: a Sankey of the loans handed over, from the campus of the asset's home lab, to its home lab, to the
 * borrower's lab (the lab the borrower picked on the request). A ribbon is as wide as its number of loans. Read-only.
 * Layer: feature component. Called by DirectorAnalyticsView. Calls shared/constants/campuses and recharts.
 * Used by: AdRIC Director. The rows come from GET /api/analytics/director (loanFlowData).
 * The home lab and the borrower's lab are separate columns, so one lab can appear in both as two nodes.
 */
import type { ReactNode } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { SankeyLinkProps, SankeyNodeProps } from "recharts";
import { CAMPUSES, CAMPUS_LABELS } from "@shared/constants/campuses";
import type { DirectorAnalyticsData } from "@shared/types/analytics";

/** One row of the loan flow: the loans of one home lab lent to one borrower's lab. */
export type LoanFlowRow = DirectorAnalyticsData["loanFlowData"][number];

/** The column a node sits in: the campus, the home lab, or the borrower's lab. */
type Column = 0 | 1 | 2;

/** A node as Recharts keeps it: `name` is its label, and the other fields are read by the node, link, and tooltip drawing. */
interface FlowNode {
  name: string;
  column: Column;
  color: string;
}

/** What the tooltip says before a node's name, for the two lab columns. The campus column has none. */
const COLUMN_PREFIX: Record<Column, string> = { 0: "", 1: "Home lab ", 2: "Borrower's lab " };

/** What a loan with no borrower's lab (an old loan) is called in the chart. */
const NO_LAB_LABEL = "No lab given";

/** The chart is never drawn narrower than this, so lab names stay readable; a narrower screen scrolls sideways. */
const MIN_CHART_WIDTH_PX = 520;

/** The height of the chart for its tallest column, never less than this. */
const MIN_CHART_HEIGHT_PX = 288;

/** The height each node of the tallest column needs. */
const HEIGHT_PER_NODE_PX = 30;

/** Width of a node, in pixels. */
const NODE_WIDTH_PX = 10;

/** Turns the server's rows into the Recharts nodes and links. The colors come from `colors` (the campuses take the first ones, the borrower's labs the next). */
function buildGraph(rows: LoanFlowRow[], colors: readonly string[]) {
  const nodes: FlowNode[] = [];
  const indexOf = new Map<string, number>();
  const nodeIndex = (key: string, node: FlowNode): number => {
    let index = indexOf.get(key);
    if (index === undefined) {
      index = nodes.push(node) - 1;
      indexOf.set(key, index);
    }
    return index;
  };
  const colorOfCampus = (campus: LoanFlowRow["campus"]) => colors[CAMPUSES.indexOf(campus) % colors.length];
  const destinationColor = colors[CAMPUSES.length % colors.length];

  const links: { source: number; target: number; value: number }[] = [];
  const campusToHome = new Map<string, { source: number; target: number; value: number }>();
  for (const row of rows) {
    const campus = nodeIndex(`campus:${row.campus}`, { name: CAMPUS_LABELS[row.campus], column: 0, color: colorOfCampus(row.campus) });
    const home = nodeIndex(`home:${row.homeLab}`, { name: row.homeLab, column: 1, color: colorOfCampus(row.campus) });
    const destination = nodeIndex(`destination:${row.destinationLab ?? ""}`, {
      name: row.destinationLab ?? NO_LAB_LABEL,
      column: 2,
      color: destinationColor,
    });

    const campusLink = campusToHome.get(`${campus}:${home}`);
    if (campusLink) campusLink.value += row.loans;
    else {
      const created = { source: campus, target: home, value: row.loans };
      campusToHome.set(`${campus}:${home}`, created);
      links.push(created);
    }
    links.push({ source: home, target: destination, value: row.loans });
  }
  return { nodes, links };
}

/** "1 loan", "3 loans". */
const loansText = (count: number) => `${count} ${count === 1 ? "loan" : "loans"}`;

/** The hover box of a ribbon or a node: where it goes from and to, and its loans. */
function FlowTooltip({ active, payload }: { active?: boolean; payload?: { payload: any }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const label = (node: FlowNode) => `${COLUMN_PREFIX[node.column]}${node.name}`;
  const title = item.source && item.target ? `${label(item.source)} → ${label(item.target)}` : label(item);
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs shadow-sm">
      <p className="font-bold text-foreground">{title}</p>
      <p className="text-muted-foreground">{loansText(item.value)}</p>
    </div>
  );
}

/** A node: a bar in its color, with its label to the right of the bar, or to its left in the last column. */
function FlowNodeShape({ x, y, width, height, payload }: SankeyNodeProps): ReactNode {
  const node = payload as unknown as FlowNode;
  const labelOnLeft = node.column === 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={node.color} rx={2} />
      <text
        x={labelOnLeft ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={labelOnLeft ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
        stroke="var(--card)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {node.name}
      </text>
    </g>
  );
}

/** A ribbon in the color of the node it starts from. */
function FlowLinkShape({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }: SankeyLinkProps) {
  const source = payload.source as unknown as FlowNode;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={source.color}
      strokeWidth={linkWidth}
      strokeOpacity={0.35}
    />
  );
}

interface LoanFlowSankeyProps {
  /** The server's loan flow rows. */
  rows: LoanFlowRow[];
  /** The chart colors: the first one for each campus (in the order of CAMPUSES), the next for the borrower's labs. */
  colors: readonly string[];
}

/**
 * Draws the loan flow, or says no loan was handed over when there are no rows.
 *
 * @param rows the loan flow rows of GET /api/analytics/director
 * @param colors the chart palette
 */
export function LoanFlowSankey({ rows, colors }: LoanFlowSankeyProps) {
  if (rows.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-xs text-muted-foreground">
        No loans were handed over in this range.
      </div>
    );
  }

  const { nodes, links } = buildGraph(rows, colors);
  const tallestColumn = Math.max(...([0, 1, 2] as Column[]).map(column => nodes.filter(node => node.column === column).length));
  const height = Math.max(MIN_CHART_HEIGHT_PX, tallestColumn * HEIGHT_PER_NODE_PX);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: MIN_CHART_WIDTH_PX, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={{ nodes, links }}
            node={FlowNodeShape}
            link={FlowLinkShape}
            nodeWidth={NODE_WIDTH_PX}
            nodePadding={14}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Tooltip content={<FlowTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
