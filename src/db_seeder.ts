/**
 * Seeder data untuk database JSON local.
 * Menghasilkan 10 User default dan 500+ Data Scan realistis dari Maret 2026 hingga Juli 2026.
 */

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string; // Plain text sesuai permintaan
  role: "Administrator" | "Supervisor" | "Packing";
  status: "Active" | "Inactive";
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
  id: string; // Serial ID: LOG-YYYYMMDD-XXXX
  userId: string;
  userName: string;
  resi: string;
  waktu: string; // Format YYYY-MM-DD HH:mm:ss
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

export interface DbSchema {
  users: User[];
  expedisi: Expedisi[];
  layanan: Layanan[];
  scans: ScanRecord[];
  loginHistory: LoginHistory[];
  activityLog: ActivityLog[];
  deletedUsers?: string[];
  deletedExpedisi?: string[];
  deletedLayanan?: string[];
  deletedScans?: string[];
}

export function generateSeedData(): DbSchema {
  // 1. Buat 1 User Default (Hanya 1 Admin)
  const users: User[] = [
    { id: "U001", name: "Muhammad Padli (Admin)", username: "admin", email: "admin@logistik.com", password: "admin123", role: "Administrator", status: "Active" }
  ];

  // 2. Expedisi Default
  const expedisi: Expedisi[] = [];

  // 3. Jenis Layanan Default
  const layanan: Layanan[] = [];

  // 4. Generate Scan records (Mulai kosong / Bersih)
  const scans: ScanRecord[] = [];

  // 5. Buat Dummy Log History (Mulai kosong / Bersih)
  const loginHistory: LoginHistory[] = [];

  // 6. Buat Dummy Activity Log (Mulai kosong / Bersih)
  const activityLog: ActivityLog[] = [];

  return {
    users,
    expedisi,
    layanan,
    scans,
    loginHistory,
    activityLog
  };
}
