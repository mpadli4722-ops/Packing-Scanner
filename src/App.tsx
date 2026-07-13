import { useState, useEffect } from "react";
import Header from "./components/Header";
import { getApiUrl } from "./lib/api";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import ScanView from "./components/ScanView";
import HistoryView from "./components/HistoryView";
import UserManagementView from "./components/UserManagementView";
import ExpedisiLayananView from "./components/ExpedisiLayananView";
import LogsView from "./components/LogsView";
import AuthPages from "./components/AuthPages";
import GoogleSheetsView from "./components/GoogleSheetsView";
import { UserRole } from "./types";
import { 
  LayoutDashboard, 
  Scan, 
  History, 
  Menu, 
  X, 
  Users, 
  Truck, 
  Settings2, 
  ShieldAlert, 
  FileText, 
  LogOut,
  ChevronRight,
  Database,
  FileSpreadsheet
} from "lucide-react";

interface LoggedUser {
  name: string;
  username: string;
  role: UserRole;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Synchronize client-side local database with server database to prevent data loss on ephemeral server recycles
  const syncDatabase = async (isInitial = false) => {
    try {
      const localDbStr = localStorage.getItem("logistik_db_v1");
      let clientDb = null;
      
      // Send clientDb ONLY on the very first sync after boot to restore state.
      // For all subsequent syncs, do not send clientDb so we do not overwrite deletions.
      if (isInitial && localDbStr) {
        try {
          clientDb = JSON.parse(localDbStr);
        } catch (e) {
          // ignore parsing error
        }
      }

      const res = await fetch(getApiUrl("/api/db/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientDb })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.db) {
          localStorage.setItem("logistik_db_v1", JSON.stringify(data.db));
        }
      }
    } catch (e) {
      // offline or server down, fail silently to prevent app crash
    }
  };

  // Run database synchronization on startup and periodically (every 5 seconds)
  useEffect(() => {
    // Initial sync sends clientDb to restore server state if recycled
    syncDatabase(true);

    const interval = setInterval(() => {
      // Periodic syncs DO NOT send clientDb, they just fetch latest server state
      syncDatabase(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Check persistent session in localStorage on boot
  useEffect(() => {
    const savedUser = localStorage.getItem("logistik_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("logistik_user");
      }
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = (user: LoggedUser) => {
    setCurrentUser(user);
    localStorage.setItem("logistik_user", JSON.stringify(user));
    setCurrentTab("dashboard");
  };

  // Handle logout
  const handleLogout = async () => {
    if (currentUser) {
      try {
        // Log logout event in background
        await fetch(getApiUrl("/api/logs/activity"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: currentUser.username,
            action: "Melakukan Logout dari sistem"
          })
        });
      } catch (e) {
        // Silent catch to avoid console noise
      }
    }
    
    setCurrentUser(null);
    localStorage.removeItem("logistik_user");
    setCurrentTab("dashboard");
    setIsMoreOpen(false);
  };

  // Helper check for authorization
  const hasRole = (allowedRoles: string[]) => {
    if (!currentUser?.role) return false;
    const normUser = currentUser.role.toLowerCase();
    return allowedRoles.some(r => {
      const normAllowed = r.toLowerCase();
      if (normAllowed === "administrator" || normAllowed === "admin") {
        return normUser === "administrator" || normUser === "admin";
      }
      return normAllowed === normUser;
    });
  };

  // If user is not authenticated, render Login/Register Pages
  if (!currentUser) {
    return <AuthPages onLoginSuccess={handleLoginSuccess} />;
  }

  // Render sub-views based on active tab state
  const renderTabContent = () => {
    switch (currentTab) {
      case "dashboard":
        return <DashboardView onScanClick={() => setCurrentTab("scan")} />;
      case "scan":
        return <ScanView currentUser={currentUser} onScanSuccess={syncDatabase} />;
      case "riwayat_24h":
        return <HistoryView range="latest24h" currentUser={currentUser} />;
      case "riwayat_all":
        return <HistoryView range="all" currentUser={currentUser} />;
      case "google_sheets":
        return <GoogleSheetsView />;
      case "management_users":
        return <UserManagementView currentUser={currentUser} />;
      case "management_expedisi":
      case "management_layanan":
        return <ExpedisiLayananView currentUser={currentUser} />;
      case "login_history":
      case "activity_log":
        return <LogsView />;
      default:
        return <DashboardView onScanClick={() => setCurrentTab("scan")} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
      {/* LEFT SIDEBAR: Desktop Only (lg and up) */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar 
          currentUser={currentUser} 
          currentTab={currentTab} 
          setTab={(tab) => {
            setCurrentTab(tab);
          }} 
          onLogout={handleLogout} 
        />
      </div>

      {/* RIGHT MAIN FRAME: Full width on mobile, fluid with Sidebar on desktop */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative">
        {/* Top Header */}
        <Header 
          currentUser={currentUser} 
          onLogout={handleLogout} 
        />

        {/* Dynamic Inner Stage */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8 animate-in fade-in duration-200 overflow-y-auto">
          {renderTabContent()}
        </main>

        {/* ANDROID-STYLE BOTTOM NAVIGATION BAR: Mobile/Tablet Only */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 lg:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => {
              setCurrentTab("dashboard");
              setIsMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-colors cursor-pointer ${
              currentTab === "dashboard" ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Home</span>
          </button>

          <button
            onClick={() => {
              setCurrentTab("scan");
              setIsMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-colors cursor-pointer ${
              currentTab === "scan" ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Scan className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Scan</span>
          </button>

          <button
            onClick={() => {
              setCurrentTab("riwayat_24h");
              setIsMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-colors cursor-pointer ${
              currentTab === "riwayat_24h" || currentTab === "riwayat_all" ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Riwayat</span>
          </button>

          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-colors cursor-pointer ${
              isMoreOpen || (currentTab !== "dashboard" && currentTab !== "scan" && currentTab !== "riwayat_24h" && currentTab !== "riwayat_all") 
                ? "text-blue-600 font-bold" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Lainnya</span>
          </button>
        </div>

        {/* ANDROID-STYLE SLIDE-UP BOTTOM SHEET DRAWER: Mobile/Tablet Only */}
        {isMoreOpen && (
          <>
            {/* Dark blur backdrop */}
            <div 
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200 animate-in fade-in"
              onClick={() => setIsMoreOpen(false)}
            />

            {/* Bottom Sheet Card container */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-5 lg:hidden animate-in slide-in-from-bottom duration-250 border-t border-slate-100 max-h-[80vh] overflow-y-auto pb-10">
              {/* Drag Handle indicator */}
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

              {/* Title & Profile section */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 mb-5">
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md ring-4 ring-blue-50">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 leading-tight">{currentUser.name}</h4>
                  <p className="text-slate-500 font-mono text-[10px] font-bold tracking-wider uppercase mt-0.5">Role: {currentUser.role}</p>
                </div>
              </div>

              {/* Grouped Lists */}
              <div className="space-y-5">
                {/* Section: Riwayat Details */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block px-1">Pilihan Riwayat</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setCurrentTab("riwayat_24h");
                        setIsMoreOpen(false);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        currentTab === "riwayat_24h"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                      }`}
                    >
                      <History className="w-4.5 h-4.5 text-slate-500" />
                      <span>Riwayat (24 Jam)</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab("riwayat_all");
                        setIsMoreOpen(false);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        currentTab === "riwayat_all"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                      }`}
                    >
                      <Database className="w-4.5 h-4.5 text-slate-500" />
                      <span>Riwayat Terdahulu</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab("google_sheets");
                        setIsMoreOpen(false);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        currentTab === "google_sheets"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                      }`}
                    >
                      <FileSpreadsheet className="w-4.5 h-4.5 text-slate-500" />
                      <span>Google Sheets</span>
                    </button>
                  </div>
                </div>

                {/* Section: Management (Admin/Supervisor only) */}
                {hasRole(["Administrator", "Supervisor"]) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block px-1">Management Kontrol</span>
                    <div className="flex flex-col gap-1.5">
                      {hasRole(["Administrator"]) && (
                        <button
                          onClick={() => {
                            setCurrentTab("management_users");
                            setIsMoreOpen(false);
                          }}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-bold transition-all ${
                            currentTab === "management_users"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Users className="w-4.5 h-4.5 text-slate-500" />
                            <span>User Management (Pegawai)</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setCurrentTab("management_expedisi");
                          setIsMoreOpen(false);
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-bold transition-all ${
                          currentTab === "management_expedisi"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Truck className="w-4.5 h-4.5 text-slate-500" />
                          <span>Daftar Expedisi</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>

                      <button
                        onClick={() => {
                          setCurrentTab("management_layanan");
                          setIsMoreOpen(false);
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-bold transition-all ${
                          currentTab === "management_layanan"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Settings2 className="w-4.5 h-4.5 text-slate-500" />
                          <span>Jenis Layanan Paket</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Section: Logs Audit (Admin/Supervisor only) */}
                {hasRole(["Administrator", "Supervisor"]) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block px-1">Audit Sistem & Keamanan</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setCurrentTab("login_history");
                          setIsMoreOpen(false);
                        }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                          currentTab === "login_history"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                        }`}
                      >
                        <ShieldAlert className="w-4.5 h-4.5 text-slate-500" />
                        <span>History Login</span>
                      </button>
                      <button
                        onClick={() => {
                          setCurrentTab("activity_log");
                          setIsMoreOpen(false);
                        }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                          currentTab === "activity_log"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                        }`}
                      >
                        <FileText className="w-4.5 h-4.5 text-slate-500" />
                        <span>Log Aktivitas</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action: Log Out */}
              <div className="mt-7 pt-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  <span>Logout / Keluar Akun</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
