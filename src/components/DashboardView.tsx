import { useState, useEffect } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Scan, 
  Calendar, 
  Users, 
  Truck, 
  Zap, 
  Layers, 
  Award, 
  RefreshCw,
  Clock,
  ArrowRight
} from "lucide-react";
import { DashboardStats } from "../types";

interface DashboardViewProps {
  onScanClick: () => void;
}

export default function DashboardView({ onScanClick }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await fetch(getApiUrl("/api/dashboard/stats"));
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      // Silent catch to prevent developer panel warnings
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll stats every 2 seconds for real-time live feed updates!
    const interval = setInterval(() => fetchStats(true), 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Memuat statistik realtime...</p>
      </div>
    );
  }

  const cardData = [
    { title: "Scan Hari Ini", value: stats?.totalScanHariIni ?? 0, icon: Scan, desc: "Paket discan hari ini", colorClass: "bg-blue-100 text-blue-600" },
    { title: "Scan Bulan Ini", value: stats?.totalScanBulanIni ?? 0, icon: Calendar, desc: "Paket discan bulan ini", colorClass: "bg-emerald-100 text-emerald-600" },
    { title: "Total User", value: stats?.totalUser ?? 0, icon: Users, desc: "Pengguna terdaftar", colorClass: "bg-indigo-100 text-indigo-600" },
    { title: "Total Expedisi", value: stats?.totalExpedisi ?? 0, icon: Truck, desc: "Mitra kurir logistik", colorClass: "bg-orange-100 text-orange-600" },
    
    { title: "Scan Instan", value: stats?.scansInstanHariIni ?? 0, icon: Zap, desc: "Layanan Instan", colorClass: "bg-amber-100 text-amber-600" },
    { title: "Scan Reguler", value: stats?.scansRegulerHariIni ?? 0, icon: Layers, desc: "Layanan Regular", colorClass: "bg-teal-100 text-teal-600" },
    { title: "Point Instan", value: `${stats?.pointInstanHariIni ?? 0} Pts`, icon: Award, desc: "3 Resi = 1 Pt (Sisa 2 = 1 Pt)", colorClass: "bg-rose-100 text-rose-600" },
    { title: "Point Reguler", value: `${stats?.pointRegulerHariIni ?? 0} Pts`, icon: Award, desc: "1 Resi = 1 Point", colorClass: "bg-purple-100 text-purple-600" },
  ];

  // Helper values for custom SVG charts
  const maxScanHari = Math.max(...(stats?.charts.scanPerHari.map(d => d.total) || [10]), 5);
  const maxScanBulan = Math.max(...(stats?.charts.scanPerBulan.map(d => d.total) || [100]), 10);
  const maxExpedisi = Math.max(...(stats?.charts.expedisi.map(e => e.total) || [50]), 5);

  return (
    <div className="space-y-6">
      {/* Dashboard Title & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800" id="db-title-h1">Dashboard Logistik</h1>
          <p className="text-slate-500 text-xs">Monitoring aktivitas scan resi dan perolehan poin packer secara real-time.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors"
            title="Refresh Data"
            disabled={refreshing}
            id="btn-refresh-stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={onScanClick}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md shadow-blue-600/10 transition-all duration-150"
            id="btn-quick-scan"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Mulai Scan Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Grid - Sleek Interface Style */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cardData.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center transition-all duration-200 hover:shadow-md"
            >
              <div className={`w-10 h-10 rounded-lg ${card.colorClass} flex items-center justify-center mr-4 shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate" title={card.title}>
                  {card.title}
                </p>
                <p className="text-lg font-bold text-slate-800 mt-0.5 tracking-tight">
                  {card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts & Feed Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Scan Activity (SVG Chart) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-800">Aktivitas Scan (7 Hari Terakhir)</h2>
              <p className="text-xs text-slate-500">Volume resi logistik masuk harian</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Live Chart</span>
            </div>
          </div>

          <div className="relative h-64 w-full flex items-end justify-between px-2 pt-6">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 text-[10px] font-semibold text-slate-400 font-mono">
              <div className="border-b border-dashed border-slate-100 w-full pt-1"><span>{maxScanHari}</span></div>
              <div className="border-b border-dashed border-slate-100 w-full"><span>{Math.round(maxScanHari * 0.67)}</span></div>
              <div className="border-b border-dashed border-slate-100 w-full"><span>{Math.round(maxScanHari * 0.33)}</span></div>
              <div className="border-b border-dashed border-slate-100 w-full"><span>0</span></div>
            </div>

            {/* Bars */}
            {stats?.charts.scanPerHari.map((day, i) => {
              const barHeightPercent = Math.max(8, (day.total / maxScanHari) * 80);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group z-10">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20 pointer-events-none">
                      {day.total} Paket
                    </div>
                    {/* Visual Bar */}
                    <div 
                      className="w-1/2 sm:w-1/3 bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400 rounded-t-lg transition-all duration-500 shadow-md shadow-blue-500/10 cursor-pointer"
                      style={{ height: `${barHeightPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-tight">
                    {day.tanggal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Scan Feed Activity */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[23.5rem]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Live Scan Feed</h2>
              <p className="text-xs text-slate-500">Scan resi masuk secara realtime</p>
            </div>
            <span className="flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected"></span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {stats?.liveFeed && stats.liveFeed.length > 0 ? (
              stats.liveFeed.map((scan, idx) => (
                <div 
                  key={scan.id} 
                  className={`p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 ${
                    idx === 0 ? "bg-blue-50/30 border-blue-100/70 scan-flash" : "bg-white"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{scan.resi}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                        scan.layanan === "Instan" 
                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {scan.layanan}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      Scanned by <strong className="text-slate-700">{scan.userName.split(" ")[0]}</strong>
                    </p>
                  </div>
                  
                  <div className="text-right flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {scan.waktu.split(" ")[1]}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 font-mono mt-0.5">
                      {scan.expedisi}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <Scan className="w-8 h-8 text-slate-300 animate-pulse-slow" />
                <span className="text-xs">Belum ada aktivitas scan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row: Monthly Activity & Expedition Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Trend Area Chart (SVG Chart) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-1">Tren Volume Bulanan</h2>
          <p className="text-xs text-slate-500 mb-6">Total scan paket per bulan (Tahun 2026)</p>

          <div className="relative h-48 w-full flex items-end justify-between px-2 pt-6">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[9px] font-semibold text-slate-400 font-mono">
              <div className="border-b border-dashed border-slate-100 w-full"><span>{maxScanBulan}</span></div>
              <div className="border-b border-dashed border-slate-100 w-full"><span>{Math.round(maxScanBulan * 0.5)}</span></div>
              <div className="border-b border-dashed border-slate-100 w-full"><span>0</span></div>
            </div>

            {/* Monthly Trend Blocks */}
            {stats?.charts.scanPerBulan.map((mon, i) => {
              const active = mon.total > 0;
              const hPercent = active ? (mon.total / maxScanBulan) * 75 : 8;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group z-10">
                  <div className="relative w-full flex justify-center">
                    <div className="absolute bottom-full mb-1 bg-slate-950 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-20 pointer-events-none">
                      {mon.total} Resi
                    </div>
                    <div 
                      className={`w-4/5 rounded-t transition-all duration-500 ${
                        active 
                          ? "bg-emerald-500/80 group-hover:bg-emerald-400" 
                          : "bg-slate-100"
                      }`}
                      style={{ height: `${hPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 font-mono">
                    {mon.bulan}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expedition Share (Progress bars style) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-1">Distribusi Expedisi Terbanyak</h2>
          <p className="text-xs text-slate-500 mb-6">Pangsa mitra kurir logistik dari seluruh scan</p>

          <div className="space-y-4">
            {stats?.charts.expedisi && stats.charts.expedisi.length > 0 ? (
              stats.charts.expedisi.map((exp, idx) => {
                const percentage = Math.round((exp.total / maxExpedisi) * 100);
                const colors = [
                  "bg-blue-500",
                  "bg-orange-500",
                  "bg-purple-500",
                  "bg-teal-500",
                  "bg-rose-500"
                ];
                const colorClass = colors[idx % colors.length];

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{exp.name}</span>
                      <span className="font-mono text-slate-500 font-bold">
                        {exp.total} Resi ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colorClass} rounded-full transition-all duration-700`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-36 text-slate-400 text-xs">
                Belum ada data distribusi expedisi
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
