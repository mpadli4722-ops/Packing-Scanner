import { 
  LayoutDashboard, 
  Scan, 
  History, 
  Database, 
  Users, 
  Truck, 
  Settings2, 
  ShieldAlert, 
  FileText, 
  LogOut, 
  PackageCheck,
  FileSpreadsheet
} from "lucide-react";
import { UserRole } from "../types";

interface SidebarProps {
  currentUser: {
    name: string;
    username: string;
    role: UserRole;
  };
  currentTab: string;
  setTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentUser, currentTab, setTab, onLogout }: SidebarProps) {
  // Helper to check user permission
  const hasRole = (allowedRoles: string[]) => {
    if (!currentUser.role) return false;
    const normUser = currentUser.role.toLowerCase();
    return allowedRoles.some(r => {
      const normAllowed = r.toLowerCase();
      if (normAllowed === "administrator" || normAllowed === "admin") {
        return normUser === "administrator" || normUser === "admin";
      }
      return normAllowed === normUser;
    });
  };

  const menuItems = [
    {
      category: "Utama",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Administrator", "Supervisor", "Packing"] },
        { id: "scan", label: "Scan Resi", icon: Scan, roles: ["Administrator", "Supervisor", "Packing"] },
      ]
    },
    {
      category: "Riwayat Scan",
      items: [
        { id: "riwayat_24h", label: "Riwayat (24 Jam)", icon: History, roles: ["Administrator", "Supervisor", "Packing"] },
        { id: "riwayat_all", label: "Riwayat Terdahulu", icon: Database, roles: ["Administrator", "Supervisor", "Packing"] },
        { id: "google_sheets", label: "Google Sheets", icon: FileSpreadsheet, roles: ["Administrator", "Supervisor", "Packing"] },
      ]
    },
    {
      category: "Management",
      roles: ["Administrator", "Supervisor"],
      items: [
        { id: "management_users", label: "User Management", icon: Users, roles: ["Administrator"] },
        { id: "management_expedisi", label: "Expedisi", icon: Truck, roles: ["Administrator", "Supervisor"] },
        { id: "management_layanan", label: "Jenis Layanan", icon: Settings2, roles: ["Administrator", "Supervisor"] },
      ]
    },
    {
      category: "Log Sistem",
      roles: ["Administrator", "Supervisor"],
      items: [
        { id: "login_history", label: "History Login", icon: ShieldAlert, roles: ["Administrator", "Supervisor"] },
        { id: "activity_log", label: "Log Aktivitas", icon: FileText, roles: ["Administrator", "Supervisor"] },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-100 flex flex-col justify-between border-r border-slate-800 shrink-0 min-h-screen">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-md">
            <PackageCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-extrabold tracking-wider text-sm font-sans uppercase">
            Scan Logistik
          </span>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-4 py-6 space-y-6">
          {menuItems.map((section, idx) => {
            if (section.roles && !hasRole(section.roles)) return null;

            // Filter items in section based on user role
            const allowedItems = section.items.filter(item => hasRole(item.roles));
            if (allowedItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3">
                  {section.category}
                </span>
                <div className="space-y-0.5">
                  {allowedItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer Section */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-colors cursor-pointer text-left"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Keluar / Logout</span>
        </button>
      </div>
    </aside>
  );
}
