export type UserRole = "Administrator" | "Supervisor" | "Packing";
export type UserStatus = "Active" | "Inactive";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
}

export interface Expedisi {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

export interface Layanan {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

export interface ScanRecord {
  id: string; // Serial ID
  userId: string;
  userName: string;
  resi: string;
  waktu: string;
  layanan: string;
  expedisi: string;
}

export interface LoginHistory {
  id: string;
  userName: string;
  ip: string;
  browser: string;
  waktu: string;
  action: "Login" | "Logout";
}

export interface ActivityLog {
  id: string;
  userName: string;
  waktu: string;
  action: string;
}

export interface DashboardStats {
  totalScanHariIni: number;
  totalScanBulanIni: number;
  totalUser: number;
  totalExpedisi: number;
  scansInstanHariIni: number;
  scansRegulerHariIni: number;
  pointInstanHariIni: number;
  pointRegulerHariIni: number;
  charts: {
    scanPerHari: { tanggal: string; total: number }[];
    scanPerBulan: { bulan: string; total: number }[];
    expedisi: { name: string; total: number }[];
    layanan: { name: string; total: number }[];
  };
  liveFeed: ScanRecord[];
}
