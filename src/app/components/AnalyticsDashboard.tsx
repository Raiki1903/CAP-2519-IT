import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  Treemap
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Users,
  Wrench,
  PackageCheck,
  PackageX,
  MapPin,
  Clock,
  ShieldCheck,
  Activity,
  UserCheck
} from "lucide-react";

interface OverviewMetric {
  name: string;
  value: number;
}

interface OverdueLoan {
  id: number;
  assetTag: string;
  assetName: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerType: string;
  dueDate: string;
  overdueDays: number;
}

interface LabUtilization {
  name: string;
  Student: number;
  Faculty: number;
}

interface TimeSeriesPoint {
  date: string;
  [key: string]: any;
}

interface DashboardData {
  fundingDistribution: OverviewMetric[];
  lifecycleStatus: OverviewMetric[];
  overdueLoans: OverdueLoan[];
  campusDistribution: OverviewMetric[];
  labUtilization: LabUtilization[];
  custodialHierarchy: OverviewMetric[];
  degradationTrend: TimeSeriesPoint[];
  repairFrequency: TimeSeriesPoint[];
  disposalVolume: TimeSeriesPoint[];
}

const COLORS = ["#005A36", "#10B981", "#3B82F6", "#F59E0B", "#6366F1", "#EC4899", "#8B5CF6", "#94A3B8"];

const fetchDashboardData = async (): Promise<DashboardData> => {
  const res = await fetch("http://localhost:4000/api/analytics/dashboard");
  if (!res.ok) {
    throw new Error("Failed to fetch dashboard data");
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch dashboard data");
  }
  return json.data;
};

// Custom Tooltip component for Recharts to achieve premium styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 border border-slate-700/50 backdrop-blur-md rounded-xl p-3 shadow-xl text-xs text-slate-100 font-sans leading-relaxed">
        {label && <p className="font-bold border-b border-slate-700/50 pb-1 mb-1.5 uppercase text-[9px] tracking-wider text-slate-400">{label}</p>}
        {payload.map((pld: any) => (
          <p key={pld.name} className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.fill || pld.stroke || "#10B981" }} />
            <span>{pld.name}:</span>
            <strong className="text-[#10B981] font-bold">{pld.value.toLocaleString()}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsDashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["analyticsDashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 15000 // refetch every 15s to keep dashboard reactive
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 font-sans">
        <div className="relative flex items-center justify-center">
          <Activity size={36} className="text-[#005A36] animate-pulse" />
          <span className="absolute w-12 h-12 border-2 border-t-[#005A36] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-foreground tracking-widest uppercase">Aggregating Institutional Metrics</p>
          <p className="text-[10px] text-muted-foreground">Running live SQL counts across DLSU AdRIC databases...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 border border-dashed border-red-200 bg-red-50/50 rounded-2xl p-6 font-sans">
        <AlertTriangle size={32} className="text-red-600" />
        <h4 className="text-sm font-bold text-red-950 uppercase tracking-wider">Failed to Load Executive Overwatch Data</h4>
        <p className="text-xs text-red-700/80 max-w-md">{(error as Error)?.message || "A secure connection to the database could not be established."}</p>
      </div>
    );
  }

  const getStatusCount = (statusName: string) => {
    return data.lifecycleStatus.find(s => s.name === statusName)?.value || 0;
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Step 3.1: Scorecards/KPIs (Asset Lifecycle Status) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden group hover:border-[#005A36]/40 transition-all duration-300 hover:shadow-md border border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Procured / Available</p>
              <h3 className="text-3xl font-extrabold text-foreground group-hover:text-[#005A36] transition-colors">{getStatusCount("Procured")}</h3>
              <p className="text-[9px] text-muted-foreground/80 font-medium">Ready in laboratory storage</p>
            </div>
            <div className="p-3 bg-[#005A36]/5 rounded-xl border border-[#005A36]/10 text-[#005A36]">
              <PackageCheck size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300 hover:shadow-md border border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Deployed / Loaned</p>
              <h3 className="text-3xl font-extrabold text-foreground group-hover:text-blue-600 transition-colors">{getStatusCount("Deployed")}</h3>
              <p className="text-[9px] text-muted-foreground/80 font-medium">Currently in active possession</p>
            </div>
            <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-blue-600">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300 hover:shadow-md border border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">In Maintenance</p>
              <h3 className="text-3xl font-extrabold text-foreground group-hover:text-amber-600 transition-colors">{getStatusCount("In-Repair")}</h3>
              <p className="text-[9px] text-muted-foreground/80 font-medium">Awaiting service / repair logs</p>
            </div>
            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 text-amber-600">
              <Wrench size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:border-red-500/40 transition-all duration-300 hover:shadow-md border border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Retired / Disposed</p>
              <h3 className="text-3xl font-extrabold text-foreground group-hover:text-red-600 transition-colors">{getStatusCount("Disposed")}</h3>
              <p className="text-[9px] text-muted-foreground/80 font-medium">Permanently decommissioned</p>
            </div>
            <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-red-650">
              <PackageX size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 3.2: Donut Chart - Funding Source Distribution */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
              <span>Funding Source Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[260px]">
            {data.fundingDistribution.length > 0 ? (
              <div className="w-full h-full flex flex-col md:flex-row items-center justify-center">
                <div className="w-1/2 h-[180px] min-w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.fundingDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.fundingDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center space-y-1.5 w-1/2 px-2 text-[10px] font-semibold text-muted-foreground max-h-[180px] overflow-y-auto">
                  {data.fundingDistribution.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between border-b border-border/40 pb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="truncate text-foreground font-bold">{entry.name}</span>
                      </div>
                      <span className="font-mono font-bold text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground italic">No funding sources registered in inventory.</div>
            )}
          </CardContent>
        </Card>

        {/* Step 3.4: Comparative Bar Chart - Cross-Campus Distribution */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Cross-Campus Resource Balance</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.campusDistribution} barSize={40}>
                <defs>
                  <linearGradient id="manilaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#005A36" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#005A36" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="lagunaEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0/60" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.campusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "url(#manilaGreen)" : "url(#lagunaEmerald)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Step 3.6: Treemap - Custodial Hierarchy */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Custodial Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] pt-4">
            {data.custodialHierarchy.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={data.custodialHierarchy.map(c => ({ name: c.name.replace(/_STAFF/g, " Staff").replace(/_DIRECTOR/g, " Director").replace(/_SECRETARY/g, " Sec"), value: c.value }))}
                  dataKey="value"
                  stroke="#fff"
                  fill="#005A36"
                  content={({ root, depth, x, y, width, height, index, colors, name, value }: any) => {
                    const bg = COLORS[index % COLORS.length];
                    if (width < 30 || height < 20) return null;
                    return (
                      <g>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          style={{
                            fill: bg,
                            stroke: '#fff',
                            strokeWidth: 1.5,
                            fillOpacity: 0.9,
                          }}
                        />
                        <text
                          x={x + width / 2}
                          y={y + height / 2 - 2}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={9}
                          fontWeight="bold"
                        >
                          {name}
                        </text>
                        <text
                          x={x + width / 2}
                          y={y + height / 2 + 10}
                          textAnchor="middle"
                          fill="#ffffffcc"
                          fontSize={8}
                          fontFamily="monospace"
                        >
                          {value} assets
                        </text>
                      </g>
                    );
                  }}
                />
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-muted-foreground italic py-20">No custodians assigned.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 3.5: Stacked Bar Chart - Lab-Specific Utilization */}
        <Card className="lg:col-span-2 shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Lab-Specific Utilization (Borrowing frequency)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.labUtilization} margin={{ bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0/60" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} tick={{ fontWeight: "bold" }} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                <Legend verticalAlign="top" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                <Bar dataKey="Student" stackId="a" fill="#005A36" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Faculty" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Step 3.7: Time-Series Line Graph - Baseline Degradation */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Baseline Degradation (Asset condition trend)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.degradationTrend} margin={{ right: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0/60" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} domain={[0, 105]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                <Line type="monotone" dataKey="condition" name="Avg Condition (%)" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="baseline" name="Original Baseline" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 3.8: Histogram/Bar Chart - Repair Request Frequency */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Repair Request Frequency (Incoming volume)</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.repairFrequency} barSize={25}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0/60" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                <Bar dataKey="repairs" name="Repair Tickets" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Step 3.9: Cumulative Area Chart - Disposal Volume */}
        <Card className="shadow-sm border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Cumulative Decommissioning Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.disposalVolume} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="disposalRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0/60" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="disposals" name="Retired Equipment" stroke="#EF4444" fillOpacity={1} fill="url(#disposalRed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Step 3.3: Red-Flagged Data Table (Uncleared Accountability) */}
      <Card className="border-l-4 border-l-red-600 shadow-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/40 mb-2">
          <div>
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-red-655 flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              Delinquent Custodians &amp; Overdue Accountability
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">Departing or current affiliates holding hardware past return deadlines.</p>
          </div>
          <Badge className="bg-red-50 hover:bg-red-100 text-red-750 text-[9px] uppercase font-bold border border-red-200">
            {data.overdueLoans.length} Red Flags
          </Badge>
        </CardHeader>
        <CardContent className="pt-2">
          {data.overdueLoans.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-slate-500">Borrower Details</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-slate-500 text-center">User Type</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-slate-500">Asset Information</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-slate-500 text-center">Due Return Date</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-slate-500 text-right">Delinquency Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueLoans.map(loan => (
                    <TableRow key={loan.id} className="hover:bg-red-50/20 transition-colors">
                      <TableCell className="text-xs py-3.5">
                        <p className="font-bold text-foreground">{loan.borrowerName}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold font-mono">{loan.borrowerEmail}</p>
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <Badge className={loan.borrowerType === "STUDENT" ? "bg-blue-50 text-blue-700 text-[9px] border-blue-200" : "bg-purple-50 text-purple-700 text-[9px] border-purple-200"}>
                          {loan.borrowerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-3.5">
                        <p className="font-bold text-foreground">{loan.assetName}</p>
                        <p className="text-[10px] text-[#005A36] font-bold font-mono">Tag ID: {loan.assetTag}</p>
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono text-slate-700 font-bold py-3.5">
                        {new Date(loan.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right text-xs py-3.5 font-bold">
                        <span className="text-red-655 bg-red-50 px-2 py-1 rounded-md border border-red-200/50">
                          {loan.overdueDays} Days Overdue
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed border-emerald-200/50 bg-emerald-50/10 rounded-xl">
              <UserCheck className="text-[#005A36] size-8 animate-bounce" />
              <p className="text-xs font-bold text-[#005A36] tracking-wide uppercase">All Accounts Fully Cleared</p>
              <p className="text-[10px] text-muted-foreground">There are currently no overdue asset returns flagged in the system database.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
