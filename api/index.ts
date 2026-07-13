import { Request, Response, NextFunction } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const app = express();

// Enable JSON bodies and CORS
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Interfaces
export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
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
  id: string;
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

// MySQL Pool Configuration (Dynamic check for credentials)
let pool: mysql.Pool | null = null;
if (process.env.MYSQL_HOST || process.env.MYSQL_URL) {
  try {
    pool = mysql.createPool(
      process.env.MYSQL_URL 
        ? { uri: process.env.MYSQL_URL }
        : {
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
          }
    );
  } catch (err) {
    console.error("Failed to initialize MySQL Connection Pool, falling back to local JSON:", err);
  }
}

// JSON Database Fallback configuration
const DB_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "database");
const DB_FILE = path.join(DB_DIR, "db_store.json");

function generateDefaultSeed(): DbSchema {
  return {
    users: [
      { id: "U001", name: "Muhammad Padli (Admin)", username: "admin", email: "admin@logistik.com", password: "admin123", role: "Administrator", status: "Active" }
    ],
    expedisi: [],
    layanan: [],
    scans: [],
    loginHistory: [],
    activityLog: [],
    deletedUsers: [],
    deletedExpedisi: [],
    deletedLayanan: [],
    deletedScans: []
  };
}

function loadJsonDb(): DbSchema {
  if (process.env.VERCEL) {
    if (!fs.existsSync(DB_FILE)) {
      try {
        const originalPath = path.join(process.cwd(), "database", "db_store.json");
        if (fs.existsSync(originalPath)) {
          const originalData = fs.readFileSync(originalPath, "utf-8");
          fs.writeFileSync(DB_FILE, originalData, "utf-8");
        } else {
          const seed = generateDefaultSeed();
          fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
        }
      } catch (e) {
        const seed = generateDefaultSeed();
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
        } catch (err) {}
        return seed;
      }
    }
  } else {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  if (!fs.existsSync(DB_FILE)) {
    const seed = generateDefaultSeed();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
    } catch (err) {}
    return seed;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    const seed = generateDefaultSeed();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
    } catch (err) {}
    return seed;
  }
}

function saveJsonDb(db: DbSchema) {
  try {
    if (!process.env.VERCEL && !fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed saving local JSON database:", e);
  }
}

// Schema Initializer for MySQL
let mysqlSchemaInitialized = false;
async function ensureMySQLSchema() {
  if (!pool || mysqlSchemaInitialized) return;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255),
          username VARCHAR(255) UNIQUE,
          email VARCHAR(255) UNIQUE,
          password VARCHAR(255),
          role VARCHAR(50),
          status VARCHAR(50)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS expedisi (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255),
          status VARCHAR(50)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS layanan (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255),
          status VARCHAR(50)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS scans (
          id VARCHAR(50) PRIMARY KEY,
          userId VARCHAR(50),
          userName VARCHAR(255),
          resi VARCHAR(100) UNIQUE,
          waktu VARCHAR(100),
          layanan VARCHAR(100),
          expedisi VARCHAR(100)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS login_history (
          id VARCHAR(50) PRIMARY KEY,
          userName VARCHAR(255),
          ip VARCHAR(100),
          browser VARCHAR(255),
          waktu VARCHAR(100),
          action VARCHAR(255)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id VARCHAR(50) PRIMARY KEY,
          userName VARCHAR(255),
          waktu VARCHAR(100),
          action VARCHAR(255)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS deleted_items (
          item_type VARCHAR(50),
          item_id VARCHAR(50),
          PRIMARY KEY (item_type, item_id)
        )
      `);

      // Seed if empty
      const [rows] = await connection.query("SELECT COUNT(*) as count FROM users");
      if ((rows as any)[0].count === 0) {
        await connection.query(
          "INSERT INTO users (id, name, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ["U001", "Muhammad Padli (Admin)", "admin", "admin@logistik.com", "admin123", "Administrator", "Active"]
        );
        console.log("Seeded MySQL default administrator user.");
      }
      mysqlSchemaInitialized = true;
      console.log("MySQL Schema initialized successfully.");
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Failed to initialize MySQL Schema, falling back to local storage:", err);
  }
}

// DateTime formatting helpers (WIB timezone)
export function getWIBDateTimeString(dateObj: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  const ymd = `${map.year}-${map.month}-${map.day}`;
  const full = `${ymd} ${map.hour === "24" ? "00" : map.hour}:${map.minute}:${map.second}`;
  const dateKey = `${map.year}${map.month}${map.day}`;
  const ym = `${map.year}-${map.month}`;
  
  return { ymd, full, dateKey, ym };
}

function pad3(num: number) {
  return num.toString().padStart(3, "0");
}
function pad4(num: number) {
  return num.toString().padStart(4, "0");
}

// Unified Database Service (MySQL & Local JSON Hybrid)
const dbService = {
  async loadAll(): Promise<DbSchema> {
    if (pool) {
      await ensureMySQLSchema();
      try {
        const [users] = await pool.query("SELECT * FROM users");
        const [expedisi] = await pool.query("SELECT * FROM expedisi");
        const [layanan] = await pool.query("SELECT * FROM layanan");
        const [scans] = await pool.query("SELECT * FROM scans");
        const [loginHistory] = await pool.query("SELECT * FROM login_history ORDER BY waktu DESC");
        const [activityLog] = await pool.query("SELECT * FROM activity_log ORDER BY waktu DESC");
        
        const [delUsersRows] = await pool.query("SELECT item_id FROM deleted_items WHERE item_type = 'user'");
        const [delExpRows] = await pool.query("SELECT item_id FROM deleted_items WHERE item_type = 'expedisi'");
        const [delLayRows] = await pool.query("SELECT item_id FROM deleted_items WHERE item_type = 'layanan'");
        const [delScansRows] = await pool.query("SELECT item_id FROM deleted_items WHERE item_type = 'scan'");

        return {
          users: users as User[],
          expedisi: expedisi as Expedisi[],
          layanan: layanan as Layanan[],
          scans: scans as ScanRecord[],
          loginHistory: loginHistory as LoginHistory[],
          activityLog: activityLog as ActivityLog[],
          deletedUsers: (delUsersRows as any[]).map(r => r.item_id),
          deletedExpedisi: (delExpRows as any[]).map(r => r.item_id),
          deletedLayanan: (delLayRows as any[]).map(r => r.item_id),
          deletedScans: (delScansRows as any[]).map(r => r.item_id)
        };
      } catch (err) {
        console.error("Failed to query MySQL, using JSON fallback:", err);
      }
    }
    return loadJsonDb();
  },

  async saveAll(db: DbSchema): Promise<void> {
    if (pool) {
      await ensureMySQLSchema();
      try {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          // 1. Users sync/upsert
          for (const u of db.users) {
            await connection.query(
              `INSERT INTO users (id, name, username, email, password, role, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?) 
               ON DUPLICATE KEY UPDATE name = VALUES(name), username = VALUES(username), email = VALUES(email), password = VALUES(password), role = VALUES(role), status = VALUES(status)`,
              [u.id, u.name, u.username, u.email, u.password, u.role, u.status]
            );
          }
          if (db.deletedUsers && db.deletedUsers.length > 0) {
            await connection.query("DELETE FROM users WHERE id IN (?)", [db.deletedUsers]);
            for (const id of db.deletedUsers) {
              await connection.query("INSERT IGNORE INTO deleted_items (item_type, item_id) VALUES ('user', ?)", [id]);
            }
          }

          // 2. Expedisi sync/upsert
          for (const e of db.expedisi) {
            await connection.query(
              `INSERT INTO expedisi (id, name, status) 
               VALUES (?, ?, ?) 
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
              [e.id, e.name, e.status]
            );
          }
          if (db.deletedExpedisi && db.deletedExpedisi.length > 0) {
            await connection.query("DELETE FROM expedisi WHERE id IN (?)", [db.deletedExpedisi]);
            for (const id of db.deletedExpedisi) {
              await connection.query("INSERT IGNORE INTO deleted_items (item_type, item_id) VALUES ('expedisi', ?)", [id]);
            }
          }

          // 3. Layanan sync/upsert
          for (const l of db.layanan) {
            await connection.query(
              `INSERT INTO layanan (id, name, status) 
               VALUES (?, ?, ?) 
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
              [l.id, l.name, l.status]
            );
          }
          if (db.deletedLayanan && db.deletedLayanan.length > 0) {
            await connection.query("DELETE FROM layanan WHERE id IN (?)", [db.deletedLayanan]);
            for (const id of db.deletedLayanan) {
              await connection.query("INSERT IGNORE INTO deleted_items (item_type, item_id) VALUES ('layanan', ?)", [id]);
            }
          }

          // 4. Scans sync/upsert
          for (const s of db.scans) {
            await connection.query(
              `INSERT INTO scans (id, userId, userName, resi, waktu, layanan, expedisi) 
               VALUES (?, ?, ?, ?, ?, ?, ?) 
               ON DUPLICATE KEY UPDATE userId = VALUES(userId), userName = VALUES(userName), resi = VALUES(resi), waktu = VALUES(waktu), layanan = VALUES(layanan), expedisi = VALUES(expedisi)`,
              [s.id, s.userId, s.userName, s.resi, s.waktu, s.layanan, s.expedisi]
            );
          }
          if (db.deletedScans && db.deletedScans.length > 0) {
            await connection.query("DELETE FROM scans WHERE id IN (?)", [db.deletedScans]);
            for (const id of db.deletedScans) {
              await connection.query("INSERT IGNORE INTO deleted_items (item_type, item_id) VALUES ('scan', ?)", [id]);
            }
          }

          // 5. Append logs
          for (const lh of db.loginHistory) {
            await connection.query(
              `INSERT IGNORE INTO login_history (id, userName, ip, browser, waktu, action) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [lh.id, lh.userName, lh.ip, lh.browser, lh.waktu, lh.action]
            );
          }
          for (const al of db.activityLog) {
            await connection.query(
              `INSERT IGNORE INTO activity_log (id, userName, waktu, action) 
               VALUES (?, ?, ?, ?)`,
              [al.id, al.userName, al.waktu, al.action]
            );
          }

          await connection.commit();
          return;
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      } catch (err) {
        console.error("Failed saving to MySQL database, fallback to JSON save:", err);
      }
    }
    saveJsonDb(db);
  },

  async logActivity(userName: string, action: string): Promise<void> {
    const db = await this.loadAll();
    const info = getWIBDateTimeString();
    const newLog: ActivityLog = {
      id: `AL${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userName,
      waktu: info.full,
      action
    };
    db.activityLog.unshift(newLog);
    await this.saveAll(db);
  }
};

// ---------------------- ENDPOINTS ----------------------

// 1. POST /api/auth/login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: "Username/Email dan Password wajib diisi!" });
  }

  const db = await dbService.loadAll();
  const user = db.users.find(
    u => (u.username === usernameOrEmail || u.email === usernameOrEmail) && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Username/Email atau Password salah!" });
  }

  if (user.status === "Inactive") {
    return res.status(403).json({ message: "Akun Anda dinonaktifkan. Silakan hubungi Administrator!" });
  }

  const info = getWIBDateTimeString();
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

  const newHistory: LoginHistory = {
    id: `LH${Date.now()}`,
    userName: user.username,
    ip,
    browser: req.headers["user-agent"] || "Chrome/Firefox/Safari",
    waktu: info.full,
    action: "Login"
  };
  db.loginHistory.unshift(newHistory);
  
  await dbService.saveAll(db);
  await dbService.logActivity(user.username, `Berhasil Login ke sistem`);

  return res.json({
    message: "Login Berhasil",
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
});

// 2. POST /api/auth/register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { name, username, email, password, confirmPassword } = req.body;
  
  if (!name || !username || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: "Semua kolom wajib diisi!" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Konfirmasi password tidak cocok!" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password minimal harus 8 karakter!" });
  }

  const db = await dbService.loadAll();

  // Validate uniqueness
  const existUsername = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
  const existEmail = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());

  if (existUsername) {
    return res.status(400).json({ message: "Username sudah digunakan!" });
  }
  if (existEmail) {
    return res.status(400).json({ message: "Email sudah digunakan!" });
  }

  const newUser: User = {
    id: `U${pad3(db.users.length + 1)}`,
    name,
    username,
    email,
    password, // Plain text as requested
    role: "Packing", // Default role
    status: "Active"
  };

  db.users.push(newUser);
  await dbService.saveAll(db);
  await dbService.logActivity(username, `Mendaftar akun baru dengan Username: ${username}`);

  return res.status(201).json({ message: "Registrasi Berhasil! Silakan login." });
});

// 3. POST /api/db/sync
app.post("/api/db/sync", async (req: Request, res: Response) => {
  const { clientDb } = req.body;
  const serverDb = await dbService.loadAll();

  if (!clientDb) {
    return res.json({ db: serverDb });
  }

  // Merge client logic with server authorities
  const delScans = serverDb.deletedScans || [];
  const delUsers = serverDb.deletedUsers || [];
  const delExp = serverDb.deletedExpedisi || [];
  const delLay = serverDb.deletedLayanan || [];

  // Scans Union
  const scanMap = new Map<string, ScanRecord>();
  serverDb.scans.forEach(s => {
    if (s && s.id) scanMap.set(s.id, s);
  });
  if (clientDb.scans && Array.isArray(clientDb.scans)) {
    clientDb.scans.forEach((s: ScanRecord) => {
      if (s && s.id && !delScans.includes(s.id)) scanMap.set(s.id, s);
    });
  }
  const mergedScans = Array.from(scanMap.values()).sort((a, b) => a.waktu.localeCompare(b.waktu));

  // Users Union
  const userMap = new Map<string, User>();
  if (clientDb.users && Array.isArray(clientDb.users)) {
    clientDb.users.forEach((u: User) => {
      if (u && u.username && u.id && !delUsers.includes(u.id)) {
        userMap.set(u.username.toLowerCase(), u);
      }
    });
  }
  serverDb.users.forEach(u => {
    if (u && u.username) userMap.set(u.username.toLowerCase(), u);
  });
  const mergedUsers = Array.from(userMap.values());

  // Expedisi Union
  const expedisiMap = new Map<string, Expedisi>();
  if (clientDb.expedisi && Array.isArray(clientDb.expedisi)) {
    clientDb.expedisi.forEach((e: Expedisi) => {
      if (e && e.id && !delExp.includes(e.id)) expedisiMap.set(e.id, e);
    });
  }
  serverDb.expedisi.forEach(e => {
    if (e && e.id) expedisiMap.set(e.id, e);
  });
  const mergedExpedisi = Array.from(expedisiMap.values());

  // Layanan Union
  const layananMap = new Map<string, Layanan>();
  if (clientDb.layanan && Array.isArray(clientDb.layanan)) {
    clientDb.layanan.forEach((l: Layanan) => {
      if (l && l.id && !delLay.includes(l.id)) layananMap.set(l.id, l);
    });
  }
  serverDb.layanan.forEach(l => {
    if (l && l.id) layananMap.set(l.id, l);
  });
  const mergedLayanan = Array.from(layananMap.values());

  // Login History
  const loginHistoryMap = new Map<string, LoginHistory>();
  if (clientDb.loginHistory && Array.isArray(clientDb.loginHistory)) {
    clientDb.loginHistory.forEach((lh: LoginHistory) => {
      if (lh && lh.id) loginHistoryMap.set(lh.id, lh);
    });
  }
  serverDb.loginHistory.forEach(lh => {
    if (lh && lh.id) loginHistoryMap.set(lh.id, lh);
  });
  const mergedLoginHistory = Array.from(loginHistoryMap.values()).sort((a, b) => b.waktu.localeCompare(a.waktu));

  // Activity Log
  const activityLogMap = new Map<string, ActivityLog>();
  if (clientDb.activityLog && Array.isArray(clientDb.activityLog)) {
    clientDb.activityLog.forEach((al: ActivityLog) => {
      if (al && al.id) activityLogMap.set(al.id, al);
    });
  }
  serverDb.activityLog.forEach(al => {
    if (al && al.id) activityLogMap.set(al.id, al);
  });
  const mergedActivityLog = Array.from(activityLogMap.values()).sort((a, b) => b.waktu.localeCompare(a.waktu));

  const mergedDb: DbSchema = {
    users: mergedUsers,
    expedisi: mergedExpedisi,
    layanan: mergedLayanan,
    scans: mergedScans,
    loginHistory: mergedLoginHistory,
    activityLog: mergedActivityLog,
    deletedUsers: serverDb.deletedUsers || [],
    deletedExpedisi: serverDb.deletedExpedisi || [],
    deletedLayanan: serverDb.deletedLayanan || [],
    deletedScans: serverDb.deletedScans || []
  };

  await dbService.saveAll(mergedDb);
  return res.json({ db: mergedDb });
});

// 4. GET /api/dashboard/stats
app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
  const db = await dbService.loadAll();
  const info = getWIBDateTimeString();
  const todayYMD = info.ymd;
  const thisMonthYM = info.ym;

  const scansHariIni = db.scans.filter(s => s.waktu.startsWith(todayYMD));
  const scansBulanIni = db.scans.filter(s => s.waktu.startsWith(thisMonthYM));

  const totalScanHariIni = scansHariIni.length;
  const totalScanBulanIni = scansBulanIni.length;
  const totalUser = db.users.length;
  const totalExpedisi = db.expedisi.length;

  const scansInstanHariIni = scansHariIni.filter(s => s.layanan === "Instan").length;
  const scansRegulerHariIni = scansHariIni.filter(s => s.layanan === "Regular").length;

  // Formula Point otomatis:
  // Instan: 2 atau 3 resi = 1 point
  const pointInstanHariIni = Math.floor(scansInstanHariIni / 3) + (scansInstanHariIni % 3 === 2 ? 1 : 0);
  const pointRegulerHariIni = scansRegulerHariIni * 1;

  // Scan Per Hari (last 7 days)
  const scanPerHari: { [key: string]: number } = {};
  const todayObj = new Date();
  for (let i = 6; i >= 0; i--) {
    const wibDay = new Date(todayObj.getTime() - (i * 24 * 60 * 60 * 1000));
    const dayInfo = getWIBDateTimeString(wibDay);
    scanPerHari[dayInfo.ymd] = 0;
  }
  db.scans.forEach(s => {
    const sDate = s.waktu.split(" ")[0];
    if (scanPerHari[sDate] !== undefined) {
      scanPerHari[sDate]++;
    }
  });
  const chartScanPerHari = Object.keys(scanPerHari).map(k => ({
    tanggal: k.substring(5), // MM-DD
    total: scanPerHari[k]
  }));

  // Scan Per Bulan (2026)
  const scanPerBulan: { [key: string]: number } = {
    "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0
  };
  db.scans.forEach(s => {
    const parts = s.waktu.split("-");
    if (parts[0] === "2026") {
      const m = parts[1];
      if (scanPerBulan[m] !== undefined) {
        scanPerBulan[m]++;
      }
    }
  });
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const chartScanPerBulan = Object.keys(scanPerBulan).map(k => ({
    bulan: monthNames[parseInt(k) - 1],
    total: scanPerBulan[k]
  }));

  // Expedisi counts
  const expedisiCount: { [key: string]: number } = {};
  db.scans.forEach(s => {
    expedisiCount[s.expedisi] = (expedisiCount[s.expedisi] || 0) + 1;
  });
  const chartExpedisi = Object.keys(expedisiCount).map(k => ({
    name: k,
    total: expedisiCount[k]
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  // Layanan counts
  const layananCount: { [key: string]: number } = {};
  db.scans.forEach(s => {
    layananCount[s.layanan] = (layananCount[s.layanan] || 0) + 1;
  });
  const chartLayanan = Object.keys(layananCount).map(k => ({
    name: k,
    total: layananCount[k]
  })).sort((a, b) => b.total - a.total);

  const liveFeed = db.scans.slice(-10).reverse();

  return res.json({
    totalScanHariIni,
    totalScanBulanIni,
    totalUser,
    totalExpedisi,
    scansInstanHariIni,
    scansRegulerHariIni,
    pointInstanHariIni,
    pointRegulerHariIni,
    charts: {
      scanPerHari: chartScanPerHari,
      scanPerBulan: chartScanPerBulan,
      expedisi: chartExpedisi,
      layanan: chartLayanan
    },
    liveFeed
  });
});

// 5. GET /api/scans
app.get("/api/scans", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  const db = await dbService.loadAll();

  if (id) {
    const scan = db.scans.find(s => s.id === id);
    if (!scan) return res.status(404).json({ message: "Data scan tidak ditemukan!" });
    return res.json(scan);
  }

  const { range, username } = req.query;
  let filtered = [...db.scans];

  if (username) {
    const target = (username as string).trim().toLowerCase();
    filtered = filtered.filter(s => {
      const matchName = s.userName.trim().toLowerCase() === target;
      const u = db.users.find(usr => 
        usr.name.trim().toLowerCase() === s.userName.trim().toLowerCase() || 
        usr.username.trim().toLowerCase() === s.userName.trim().toLowerCase()
      );
      const matchUsername = u && (
        u.username.trim().toLowerCase() === target || 
        u.name.trim().toLowerCase() === target
      );
      return matchName || matchUsername;
    });
  }

  if (range === "latest24h") {
    const info = getWIBDateTimeString();
    filtered = filtered.filter(s => s.waktu.startsWith(info.ymd));
  }

  filtered.reverse();
  return res.json(filtered);
});

// 6. POST /api/scans
app.post("/api/scans", async (req: Request, res: Response) => {
  const { resi, layanan, expedisi, userName } = req.body;
  const finalExpedisi = (layanan === "Instan") ? (expedisi || "-") : expedisi;

  if (!resi || !layanan || !finalExpedisi || !userName) {
    return res.status(400).json({ message: "Resi, Layanan, Expedisi, dan User Name wajib diisi!" });
  }

  const db = await dbService.loadAll();

  // Validate duplicate resi
  const isDuplicate = db.scans.some(s => s.resi.trim().toLowerCase() === resi.trim().toLowerCase());
  if (isDuplicate) {
    return res.status(400).json({ message: `Gagal! No Resi [${resi}] sudah pernah digunakan/discan sebelumnya!` });
  }

  const user = db.users.find(u => u.name === userName || u.username === userName);
  const userId = user ? user.id : "U000";

  // Serial ID Generator: LOG-YYYYMMDD-XXXX
  const info = getWIBDateTimeString();
  const dateKey = info.dateKey;
  const todayYMD = info.ymd;
  
  const scansHariIni = db.scans.filter(s => s.waktu.startsWith(todayYMD));
  const dailySeq = scansHariIni.length + 1;
  const serialId = `LOG-${dateKey}-${pad4(dailySeq)}`;

  const newScan: ScanRecord = {
    id: serialId,
    userId,
    userName: user ? user.name : userName,
    resi: resi.trim().toUpperCase(),
    waktu: info.full,
    layanan,
    expedisi: finalExpedisi
  };

  db.scans.push(newScan);
  await dbService.saveAll(db);
  await dbService.logActivity(user ? user.username : userName, `Berhasil scan resi logistik [${newScan.resi}] via Web Scanner`);

  return res.status(201).json({
    message: "Scan Berhasil",
    scan: newScan
  });
});

// 7. DELETE /api/scans/:id
app.delete("/api/scans/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID scan wajib diisi!" });

  const db = await dbService.loadAll();
  const scanIndex = db.scans.findIndex(s => s.id === id);
  if (scanIndex === -1) {
    return res.status(404).json({ message: "Data scan tidak ditemukan!" });
  }

  const scan = db.scans[scanIndex];
  db.scans.splice(scanIndex, 1);
  if (!db.deletedScans) db.deletedScans = [];
  if (!db.deletedScans.includes(id)) {
    db.deletedScans.push(id);
  }
  
  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Menghapus data scan resi: ${scan.resi} (Serial ID: ${scan.id})`);

  return res.json({ message: "Data scan berhasil dihapus!" });
});

// 8. GET /api/users
app.get("/api/users", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  const db = await dbService.loadAll();

  if (id) {
    const user = db.users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan!" });
    return res.json(user);
  }

  return res.json(db.users);
});

// 9. POST /api/users
app.post("/api/users", async (req: Request, res: Response) => {
  const { name, username, email, password, role, status } = req.body;
  if (!name || !username || !email || !password || !role) {
    return res.status(400).json({ message: "Nama, Username, Email, Password, dan Role wajib diisi!" });
  }

  const db = await dbService.loadAll();

  // Validate uniqueness
  const existsUser = db.users.some(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
  if (existsUser) {
    return res.status(400).json({ message: "Username atau Email sudah digunakan!" });
  }

  const newUser: User = {
    id: `U${pad3(db.users.length + 1)}`,
    name,
    username,
    email,
    password, // Plain text as requested
    role,
    status: status || "Active"
  };

  db.users.push(newUser);
  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Membuat user baru: ${username} (${role})`);

  return res.status(201).json(newUser);
});

// 10. PUT /api/users/:id
app.put("/api/users/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID User wajib diisi!" });

  const { name, username, email, password, role, status } = req.body;
  const db = await dbService.loadAll();

  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ message: "User tidak ditemukan!" });
  }

  const oldUser = db.users[userIndex];
  db.users[userIndex] = {
    ...oldUser,
    name: name ?? oldUser.name,
    username: username ?? oldUser.username,
    email: email ?? oldUser.email,
    password: password ?? oldUser.password,
    role: role ?? oldUser.role,
    status: status ?? oldUser.status
  };

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Mengupdate profil/status user: ${db.users[userIndex].username}`);

  return res.json(db.users[userIndex]);
});

// 11. DELETE /api/users/:id
app.delete("/api/users/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID User wajib diisi!" });

  const db = await dbService.loadAll();
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ message: "User tidak ditemukan!" });

  db.users = db.users.filter(u => u.id !== id);
  if (!db.deletedUsers) db.deletedUsers = [];
  if (!db.deletedUsers.includes(id)) {
    db.deletedUsers.push(id);
  }

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Menghapus user: ${user.username}`);

  return res.json({ message: "User berhasil dihapus!" });
});

// 12. GET /api/expedisi
app.get("/api/expedisi", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  const db = await dbService.loadAll();

  if (id) {
    const exp = db.expedisi.find(e => e.id === id);
    if (!exp) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });
    return res.json(exp);
  }

  return res.json(db.expedisi);
});

// 13. POST /api/expedisi
app.post("/api/expedisi", async (req: Request, res: Response) => {
  const { name, status } = req.body;
  if (!name) return res.status(400).json({ message: "Nama expedisi wajib diisi!" });

  const db = await dbService.loadAll();
  const newExp: Expedisi = {
    id: `E${pad3(db.expedisi.length + 1)}`,
    name,
    status: status || "Active"
  };

  db.expedisi.push(newExp);
  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Membuat expedisi baru: ${name}`);

  return res.status(201).json(newExp);
});

// 14. PUT /api/expedisi/:id
app.put("/api/expedisi/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID Expedisi wajib diisi!" });

  const { name, status } = req.body;
  const db = await dbService.loadAll();

  const idx = db.expedisi.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

  db.expedisi[idx] = {
    ...db.expedisi[idx],
    name: name ?? db.expedisi[idx].name,
    status: status ?? db.expedisi[idx].status
  };

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Mengupdate expedisi: ${db.expedisi[idx].name}`);

  return res.json(db.expedisi[idx]);
});

// 15. DELETE /api/expedisi/:id
app.delete("/api/expedisi/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID Expedisi wajib diisi!" });

  const db = await dbService.loadAll();
  const exp = db.expedisi.find(e => e.id === id);
  if (!exp) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

  db.expedisi = db.expedisi.filter(e => e.id !== id);
  if (!db.deletedExpedisi) db.deletedExpedisi = [];
  if (!db.deletedExpedisi.includes(id)) {
    db.deletedExpedisi.push(id);
  }

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Menghapus expedisi: ${exp.name}`);

  return res.json({ message: "Expedisi berhasil dihapus" });
});

// 16. GET /api/layanan
app.get("/api/layanan", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  const db = await dbService.loadAll();

  if (id) {
    const lay = db.layanan.find(l => l.id === id);
    if (!lay) return res.status(404).json({ message: "Layanan tidak ditemukan!" });
    return res.json(lay);
  }

  return res.json(db.layanan);
});

// 17. POST /api/layanan
app.post("/api/layanan", async (req: Request, res: Response) => {
  const { name, status } = req.body;
  if (!name) return res.status(400).json({ message: "Nama layanan wajib diisi!" });

  const db = await dbService.loadAll();
  const newLay: Layanan = {
    id: `L${pad3(db.layanan.length + 1)}`,
    name,
    status: status || "Active"
  };

  db.layanan.push(newLay);
  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Membuat layanan baru: ${name}`);

  return res.status(201).json(newLay);
});

// 18. PUT /api/layanan/:id
app.put("/api/layanan/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID Layanan wajib diisi!" });

  const { name, status } = req.body;
  const db = await dbService.loadAll();

  const idx = db.layanan.findIndex(l => l.id === id);
  if (idx === -1) return res.status(404).json({ message: "Layanan tidak ditemukan!" });

  db.layanan[idx] = {
    ...db.layanan[idx],
    name: name ?? db.layanan[idx].name,
    status: status ?? db.layanan[idx].status
  };

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Mengupdate jenis layanan: ${db.layanan[idx].name}`);

  return res.json(db.layanan[idx]);
});

// 19. DELETE /api/layanan/:id
app.delete("/api/layanan/:id?", async (req: Request, res: Response) => {
  const id = (req.query.id || req.params.id) as string | undefined;
  if (!id) return res.status(400).json({ message: "ID Layanan wajib diisi!" });

  const db = await dbService.loadAll();
  const lay = db.layanan.find(l => l.id === id);
  if (!lay) return res.status(404).json({ message: "Layanan tidak ditemukan!" });

  db.layanan = db.layanan.filter(l => l.id !== id);
  if (!db.deletedLayanan) db.deletedLayanan = [];
  if (!db.deletedLayanan.includes(id)) {
    db.deletedLayanan.push(id);
  }

  await dbService.saveAll(db);
  await dbService.logActivity("admin", `Menghapus jenis layanan: ${lay.name}`);

  return res.json({ message: "Layanan berhasil dihapus" });
});

// 20. GET /api/logs/login_history
app.get("/api/logs/login_history", async (req: Request, res: Response) => {
  const db = await dbService.loadAll();
  return res.json(db.loginHistory);
});

// 21. GET /api/logs/activity_log
app.get("/api/logs/activity_log", async (req: Request, res: Response) => {
  const db = await dbService.loadAll();
  return res.json(db.activityLog);
});

// 22. POST /api/logs/activity
app.post("/api/logs/activity", async (req: Request, res: Response) => {
  const { userName, action } = req.body;
  if (!userName || !action) {
    return res.status(400).json({ message: "Username dan Action wajib diisi" });
  }
  await dbService.logActivity(userName, action);
  return res.json({ status: "success" });
});

// Global Fallback/Unmatched routes for API
app.all("/api/*", (req: Request, res: Response) => {
  res.status(404).json({ message: `Path ${req.method} ${req.path} tidak ditemukan di Monolith API.` });
});

export default app;
