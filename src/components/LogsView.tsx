import { useState, useEffect } from "react";
import { getApiUrl } from "../lib/api";
import { 
  ShieldAlert, 
  FileText, 
  Search, 
  RefreshCw, 
  Terminal, 
  Globe, 
  Clock, 
  User as UserIcon,
  Sparkles
} from "lucide-react";
import { LoginHistory, ActivityLog } from "../types";

export default function LogsView() {
  const [activeTab, setActiveTab] = useState<"login" | "activity">("login");
  const [loginLogs, setLoginLogs] = useState<LoginHistory[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      if (activeTab === "login") {
        const res = await fetch(getApiUrl("/api/logs/login_history"));
        if (res.ok) {
          const data = await res.json();
          setLoginLogs(data);
        }
      } else {
        const res = await fetch(getApiUrl("/api/logs/activity_log"));
        if (res.ok) {
          const data = await res.json();
          setActivityLogs(data);
        }
      }
    } catch (e) {
      // Silent catch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const handleRefresh = () => {
    fetchLogs(true);
  };

  // Filter login logs based on search
  const filteredLoginLogs = loginLogs.filter(log => 
    (log.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.ip || "").includes(searchTerm) ||
    (log.browser || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.action || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter activity logs based on search
  const filteredActivityLogs = activityLogs.filter(log => 
    (log.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.action || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.waktu || "").includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800" id="logs-title-h1">Audit Log Sistem</h1>
          <p className="text-slate-500 text-xs">Log audit keamanan login pengguna dan aktivitas perubahan basis data (CRUD).</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Refresh logs"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab("login"); setSearchTerm(""); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              activeTab === "login"
                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            id="tab-btn-login-hist"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>History Login Session</span>
          </button>

          <button
            onClick={() => { setActiveTab("activity"); setSearchTerm(""); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              activeTab === "activity"
                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            id="tab-btn-activity-log"
          >
            <FileText className="w-4 h-4" />
            <span>Log Aktivitas (Audit Trail)</span>
          </button>
        </div>

        {/* Search inside logs */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari log..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs rounded-lg focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-400"
            id="input-search-logs"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === "login" ? (
          /* LOGIN HISTORIES TABLE */
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-bold w-12">No</th>
                  <th className="px-5 py-3.5 font-bold">Username</th>
                  <th className="px-5 py-3.5 font-bold">IP Address</th>
                  <th className="px-5 py-3.5 font-bold">Browser / OS Agent</th>
                  <th className="px-5 py-3.5 font-bold">Waktu</th>
                  <th className="px-5 py-3.5 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Memproses database...
                    </td>
                  </tr>
                ) : filteredLoginLogs.length > 0 ? (
                  filteredLoginLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 select-all flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 shrink-0">
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <span>{log.userName}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 select-all font-semibold flex items-center gap-1.5 mt-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {log.ip}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 truncate max-w-xs" title={log.browser}>
                        {log.browser}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {log.waktu}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          log.action === "Login" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      Tidak ada history login yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SYSTEM ACTIVITY AUDIT TRAIL TABLE */
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-bold w-12">No</th>
                  <th className="px-5 py-3.5 font-bold w-40">User Operator</th>
                  <th className="px-5 py-3.5 font-bold w-48">Waktu Kejadian</th>
                  <th className="px-5 py-3.5 font-bold">Catatan Aktivitas / Mutasi Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Memproses database...
                    </td>
                  </tr>
                ) : filteredActivityLogs.length > 0 ? (
                  filteredActivityLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 shrink-0">
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="select-all">{log.userName}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {log.waktu}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-semibold">{log.action}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400">
                      Tidak ada catatan aktivitas yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
