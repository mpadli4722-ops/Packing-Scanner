import { useState, useEffect } from "react";
import { 
  Bell, 
  Trash2, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  ShieldAlert,
  X,
  PackageCheck,
  Terminal
} from "lucide-react";
import { UserRole } from "../types";

interface HeaderProps {
  currentUser: {
    name: string;
    username: string;
    role: UserRole;
  };
  onLogout: () => void;
}

export default function Header({ currentUser, onLogout }: HeaderProps) {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false); // Notifications dropdown
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Digital Clock in Asia/Jakarta (WIB) HH:mm:ss
      const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      setTime(timeStr);

      // Indonesian Date in Asia/Jakarta (WIB)
      const dateStr = now.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      setDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Seed & Load Notifications
  useEffect(() => {
    const defaultNotifs = [
      {
        id: "sys-warn-storage",
        title: "[WARNING] Kapasitas Penyimpanan",
        message: "Penyimpanan database JSON lokal hampir mencapai batas optimal (92%).",
        time: "10 menit yang lalu",
        read: false,
        type: "warning"
      },
      {
        id: "sys-warn-dup",
        title: "[WARNING] Deteksi Scan Ganda",
        message: "Sistem mendeteksi percobaan input nomor resi duplikat dari terminal Packer.",
        time: "30 menit yang lalu",
        read: false,
        type: "warning"
      },
      {
        id: "sys-db-seed",
        title: "[DEBUG] Database Seeder Loaded",
        message: "Initial database state loaded successfully in 14ms.",
        time: "Baru saja",
        read: true,
        type: "debug"
      },
      {
        id: "sys-hmr",
        title: "[DEBUG] Client HMR Connection",
        message: "Hot Module Replacement safely bypassed by platform control plane.",
        time: "Baru saja",
        read: true,
        type: "debug"
      },
      {
        id: "sys-auth-verify",
        title: "[LOG] Session Authenticated",
        message: `Kredensial pengguna ${currentUser.name} berhasil diverifikasi di server.`,
        time: "1 menit yang lalu",
        read: true,
        type: "log"
      },
      {
        id: "sys-backup",
        title: "[LOG] Auto-backup Routine",
        message: "Pencadangan data lokal berhasil ditulis ke direktori ./database/db_store.json.",
        time: "5 menit yang lalu",
        read: true,
        type: "log"
      },
      {
        id: "sys-poll-status",
        title: "[DEBUG] Dashboard Poller Active",
        message: "Background thread poller stats merespons dengan status 200 OK.",
        time: "12 menit yang lalu",
        read: true,
        type: "debug"
      },
      {
        id: "sys-timezone-sync",
        title: "[LOG] WIB Timezone Synchronized",
        message: "Waktu clock tersinkronisasi otomatis dengan zona Asia/Jakarta (WIB).",
        time: "1 jam yang lalu",
        read: true,
        type: "log"
      }
    ];

    const stored = localStorage.getItem(`notifs_${currentUser.username}`);
    let initialNotifs = stored ? JSON.parse(stored) : defaultNotifs;
    setNotifications(initialNotifs);
  }, [currentUser]);

  // Click Outside to Close Notifications Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = document.getElementById("notification-dropdown-container");
      if (container && !container.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem(`notifs_${currentUser.username}`, JSON.stringify(updated));
  };

  const handleRemoveNotif = (id: string, e: any) => {
    e.stopPropagation(); // Prevent dropdown from closing
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem(`notifs_${currentUser.username}`, JSON.stringify(updated));
  };

  const handleClearAll = () => {
    setNotifications([]);
    localStorage.setItem(`notifs_${currentUser.username}`, JSON.stringify([]));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case "error":
        return <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />;
      case "debug":
        return <Terminal className="w-4 h-4 text-slate-400 flex-shrink-0 font-mono" />;
      case "log":
        return <Terminal className="w-4 h-4 text-blue-500 flex-shrink-0 font-mono" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  return (
    <header className="h-16 bg-[#0F172A] lg:bg-white text-white lg:text-slate-800 border-b border-slate-800 lg:border-slate-200 flex items-center justify-between px-4 sm:px-6 w-full shrink-0 shadow-sm">
      {/* Left Area: Title / Brand Logo on Mobile, dynamic welcome greeting on Desktop */}
      <div className="flex items-center gap-3">
        {/* Mobile-only logo */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <PackageCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-extrabold tracking-tight text-sm sm:text-base font-sans select-none">
            Logistik<span className="text-blue-500">Scan</span>
          </span>
        </div>

        {/* Desktop-only simple greeting */}
        <div className="hidden lg:block text-sm font-medium text-slate-500">
          Selamat datang kembali, <strong className="text-slate-900 font-bold">{currentUser.name}</strong>
        </div>
      </div>

      {/* Right Area: Time, Notifications, Profile */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Desktop Clock & Date */}
        <div className="hidden xl:flex items-center text-xs font-semibold text-slate-400 space-x-1 border-r border-slate-200 pr-4">
          <span className="text-slate-400 mr-1 text-[10px] uppercase font-bold tracking-wider">Clock:</span>
          <span className="text-slate-600 font-medium">{date}</span>
          <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{time}</span>
        </div>

        {/* Compact Mobile/Tablet Clock */}
        <div className="hidden sm:flex xl:hidden items-center gap-1 text-[11px] font-mono font-bold text-blue-400 lg:text-blue-600 bg-slate-950 lg:bg-blue-50 px-2 py-0.5 rounded border border-slate-800 lg:border-blue-100">
          <span>{time}</span>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative" id="notification-dropdown-container">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 text-slate-400 lg:text-slate-500 hover:text-white lg:hover:text-slate-800 hover:bg-slate-800 lg:hover:bg-slate-100 rounded-lg transition-all focus:outline-none cursor-pointer flex items-center justify-center"
            id="btn-bell-notification"
            title="Notifikasi"
          >
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] flex items-center justify-center rounded-full border-2 border-[#0F172A] lg:border-white font-extrabold animate-pulse">
                {unreadCount}
              </span>
            )}
            <Bell className={`w-4.5 h-4.5 ${unreadCount > 0 ? "animate-bounce" : ""}`} />
          </button>

          {/* Notification Menu Panel */}
          {isOpen && (
            <div className="fixed sm:absolute right-4 left-4 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-3 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-3 duration-200">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 text-sm">Notifikasi</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                      {unreadCount} baru
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
                      title="Tandai semua dibaca"
                    >
                      Tandai dibaca
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Tidak ada notifikasi baru</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3.5 flex gap-3 transition-colors hover:bg-slate-50 relative ${
                        !notif.read ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {!notif.read && (
                        <span className="absolute top-4 right-4 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      )}

                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <p className={`text-xs text-slate-800 leading-tight ${!notif.read ? "font-bold" : "font-medium"}`}>
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">
                          {notif.time}
                        </span>
                      </div>

                      <div className="flex flex-col justify-start">
                        <button
                          onClick={(e) => handleRemoveNotif(notif.id, e)}
                          className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer p-0.5 rounded-md hover:bg-slate-100"
                          title="Hapus"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Menampilkan {notifications.length} notifikasi
                  </span>
                  <button
                    onClick={handleClearAll}
                    className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Semua
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Info Avatar / Profile (Direct action trigger or visual element) */}
        <div className="flex items-center space-x-2.5 border-l border-slate-800 lg:border-slate-200 pl-3 sm:pl-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-xs shadow-sm">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-white lg:text-slate-900 line-clamp-1 leading-none">{currentUser.name}</p>
            <span className="text-[9px] text-slate-400 lg:text-slate-500 font-bold font-mono tracking-wider">{currentUser.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
