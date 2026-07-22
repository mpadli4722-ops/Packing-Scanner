import { Request, Response, NextFunction } from "express";
import express from "express";
import mysql from "mysql2/promise";
import alasql from "alasql";

const app = express();

// Request Logger with Execution Time
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[API REQUEST] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

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

// ---------------- IN-MEMORY SQL BACKEND FALLBACK ----------------
// Configured for local development or preview environments when MySQL env vars are not set.
alasql.options.casesensitive = false;

class InMemDbPool {
  private initialized = false;

  public async initSchema() {
    if (this.initialized) return;
    try {
      alasql(`
        CREATE TABLE IF NOT EXISTS users (
          id STRING PRIMARY KEY,
          name STRING,
          username STRING,
          email STRING,
          password STRING,
          role STRING,
          status STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS expedisi (
          id STRING PRIMARY KEY,
          name STRING,
          status STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS layanan (
          id STRING PRIMARY KEY,
          name STRING,
          status STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS scans (
          id STRING PRIMARY KEY,
          userId STRING,
          userName STRING,
          resi STRING,
          waktu STRING,
          layanan STRING,
          expedisi STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS login_history (
          id STRING PRIMARY KEY,
          userName STRING,
          ip STRING,
          browser STRING,
          waktu STRING,
          action STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id STRING PRIMARY KEY,
          userName STRING,
          waktu STRING,
          action STRING
        )
      `);
      alasql(`
        CREATE TABLE IF NOT EXISTS deleted_items (
          item_type STRING,
          item_id STRING,
          PRIMARY KEY (item_type, item_id)
        )
      `);

      // Seed default admin user
      const users: any[] = alasql("SELECT * FROM users");
      if (!users || users.length === 0) {
        alasql(
          "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)",
          ["U001", "Muhammad Padli (Admin)", "admin", "admin@logistik.com", "admin123", "Administrator", "Active"]
        );
      }

      // Seed default expedisi
      const exp: any[] = alasql("SELECT * FROM expedisi");
      if (!exp || exp.length === 0) {
        const defaultExpedisi = [
          ["E001", "JNE", "Active"],
          ["E002", "J&T", "Active"],
          ["E003", "SiCepat", "Active"],
          ["E004", "Anteraja", "Active"],
          ["E005", "Ninja", "Active"]
        ];
        for (const item of defaultExpedisi) {
          alasql("INSERT INTO expedisi VALUES (?, ?, ?)", item);
        }
      }

      // Seed default layanan
      const lay: any[] = alasql("SELECT * FROM layanan");
      if (!lay || lay.length === 0) {
        const defaultLayanan = [
          ["L001", "Regular", "Active"],
          ["L002", "Instan", "Active"],
          ["L003", "Cargo", "Active"]
        ];
        for (const item of defaultLayanan) {
          alasql("INSERT INTO layanan VALUES (?, ?, ?)", item);
        }
      }

      this.initialized = true;
      console.log("[IN-MEM DB] In-Memory database initialized successfully.");
    } catch (err) {
      console.error("[IN-MEM DB ERROR] Error initializing schema:", err);
    }
  }

  public async query(sql: string, params: any[] = []): Promise<[any, any]> {
    await this.initSchema();

    let cleanSql = sql.trim();

    // Check 1: SELECT 1
    if (cleanSql === "SELECT 1") {
      return [[{ 1: 1 }], []];
    }

    // Convert MySQL specific keywords
    if (cleanSql.includes("INSERT IGNORE INTO")) {
      cleanSql = cleanSql.replace(/INSERT IGNORE INTO/gi, "INSERT OR IGNORE INTO");
    }

    if (cleanSql.includes("ON DUPLICATE KEY UPDATE")) {
      const match = cleanSql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        cleanSql = `REPLACE INTO ${match[1]} (${match[2]}) VALUES (${match[3]})`;
      }
    }

    cleanSql = cleanSql.replace(/GROUP BY SUBSTRING\([^)]+\)/gi, (m) => {
      if (cleanSql.includes(" as tgl")) return "GROUP BY tgl";
      if (cleanSql.includes(" as m")) return "GROUP BY m";
      return m;
    });
    cleanSql = cleanSql.replace(/GROUP BY SUBSTR\([^)]+\)/gi, (m) => {
      if (cleanSql.includes(" as tgl")) return "GROUP BY tgl";
      if (cleanSql.includes(" as m")) return "GROUP BY m";
      return m;
    });

    cleanSql = cleanSql.replace(/SUBSTRING/gi, "SUBSTR");

    // Pre-substitute parameters into SQL string for AlaSQL execution to fix LIKE ? and parameter binding quirks
    let alasqlQuery = cleanSql;
    let alasqlParams = [...params];

    if (alasqlParams.length > 0 && alasqlQuery.includes("?")) {
      let pIdx = 0;
      alasqlQuery = alasqlQuery.replace(/\?/g, () => {
        if (pIdx < alasqlParams.length) {
          const val = alasqlParams[pIdx++];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "number" || typeof val === "boolean") return String(val);
          const safeStr = String(val).replace(/'/g, "''");
          return `'${safeStr}'`;
        }
        return "?";
      });
      alasqlParams = [];
    }

    try {
      const res = alasql(alasqlQuery, alasqlParams);
      if (typeof res === "number") {
        return [{ affectedRows: res }, []];
      }
      return [res, []];
    } catch (err: any) {
      if (cleanSql.toUpperCase().startsWith("SELECT")) {
        // Fallback JavaScript filtering for in-memory queries when AlaSQL syntax differs from MySQL
        try {
          if (cleanSql.includes("scans WHERE waktu >= ?")) {
            const allScans: any[] = alasql("SELECT * FROM scans");
            const minWaktu = params[0] || "";
            const filtered = allScans.filter(s => s.waktu >= minWaktu);
            const map: { [tgl: string]: number } = {};
            filtered.forEach(s => {
              const tgl = (s.waktu || "").substring(0, 10);
              map[tgl] = (map[tgl] || 0) + 1;
            });
            const res = Object.keys(map).map(tgl => ({ tgl, total: map[tgl] }));
            return [res, []];
          }
          if (cleanSql.includes("scans WHERE waktu LIKE ?")) {
            const allScans: any[] = alasql("SELECT * FROM scans");
            const pattern = (params[0] || "").replace("%", "");
            const filtered = allScans.filter(s => (s.waktu || "").startsWith(pattern));
            const map: { [m: string]: number } = {};
            filtered.forEach(s => {
              const m = (s.waktu || "").substring(5, 7);
              map[m] = (map[m] || 0) + 1;
            });
            const res = Object.keys(map).map(m => ({ m, total: map[m] }));
            return [res, []];
          }
        } catch (fbErr) {
          // Silent fallback
        }
        return [[], []];
      }
      return [{ affectedRows: 0 }, []];
    }
  }
}

// ---------------- MYSQL / IN-MEM POOL SELECTION ----------------
let mysqlPool: mysql.Pool | null = null;
let inMemPool: InMemDbPool | null = null;
let mysqlSchemaInitialized = false;

async function initializeMysqlSchema(p: mysql.Pool) {
  if (mysqlSchemaInitialized) return;
  try {
    await p.query(`
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
    await p.query(`
      CREATE TABLE IF NOT EXISTS expedisi (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        status VARCHAR(50)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS layanan (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        status VARCHAR(50)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50),
        userName VARCHAR(255),
        resi VARCHAR(100),
        waktu VARCHAR(100),
        layanan VARCHAR(100),
        expedisi VARCHAR(100)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id VARCHAR(50) PRIMARY KEY,
        userName VARCHAR(255),
        ip VARCHAR(100),
        browser VARCHAR(255),
        waktu VARCHAR(100),
        action VARCHAR(255)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id VARCHAR(50) PRIMARY KEY,
        userName VARCHAR(255),
        waktu VARCHAR(100),
        action VARCHAR(255)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS deleted_items (
        item_type VARCHAR(50),
        item_id VARCHAR(50),
        PRIMARY KEY (item_type, item_id)
      )
    `);

    // Seed default admin user if empty
    const [uRows]: any = await p.query("SELECT COUNT(*) as count FROM users");
    if (uRows && uRows[0]?.count === 0) {
      await p.query(
        "INSERT IGNORE INTO users (id, name, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["U001", "Muhammad Padli (Admin)", "admin", "admin@logistik.com", "admin123", "Administrator", "Active"]
      );
    }

    // Seed default expedisi if empty
    const [eRows]: any = await p.query("SELECT COUNT(*) as count FROM expedisi");
    if (eRows && eRows[0]?.count === 0) {
      const defaultExpedisi = [
        ["E001", "JNE", "Active"],
        ["E002", "J&T", "Active"],
        ["E003", "SiCepat", "Active"],
        ["E004", "Anteraja", "Active"],
        ["E005", "Ninja", "Active"]
      ];
      for (const exp of defaultExpedisi) {
        await p.query("INSERT IGNORE INTO expedisi (id, name, status) VALUES (?, ?, ?)", exp);
      }
    }

    // Seed default layanan if empty
    const [lRows]: any = await p.query("SELECT COUNT(*) as count FROM layanan");
    if (lRows && lRows[0]?.count === 0) {
      const defaultLayanan = [
        ["L001", "Regular", "Active"],
        ["L002", "Instan", "Active"],
        ["L003", "Cargo", "Active"]
      ];
      for (const lay of defaultLayanan) {
        await p.query("INSERT IGNORE INTO layanan (id, name, status) VALUES (?, ?, ?)", lay);
      }
    }

    mysqlSchemaInitialized = true;
    console.log("[MYSQL DB] MySQL Schema initialized successfully");
  } catch (err) {
    console.error("[MYSQL DB ERROR] Error initializing schema:", err);
  }
}

interface DbQueryErrorLog {
  timestamp: string;
  sql: string;
  params?: any;
  error: string;
}

const recentQueryErrors: DbQueryErrorLog[] = [];

export function recordQueryError(sql: string, params: any, err: any) {
  const errorMessage = err?.message || String(err);
  const info = getWIBDateTimeString();
  recentQueryErrors.unshift({
    timestamp: info.full,
    sql,
    params,
    error: errorMessage,
  });
  if (recentQueryErrors.length > 25) {
    recentQueryErrors.pop();
  }
}

function getPool(): { query: (sql: string, params?: any[]) => Promise<[any, any]> } {
  const host = process.env.MYSQL_HOST;
  const url = process.env.MYSQL_URL;

  let basePool: { query: (sql: string, params?: any[]) => Promise<[any, any]> } | null = null;

  // If MySQL credentials exist, use MySQL Pool
  if (host || url) {
    if (!mysqlPool) {
      try {
        if (url) {
          mysqlPool = mysql.createPool({
            uri: url,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000,
          });
        } else {
          mysqlPool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000,
          });
        }

        mysqlPool.query("SELECT 1")
          .then(() => {
            console.log("[MYSQL DB] Database Connected successfully");
            if (mysqlPool) initializeMysqlSchema(mysqlPool);
          })
          .catch((err) => {
            console.error("[MYSQL DB ERROR] Connection test failed:", err.message);
            recordQueryError("SELECT 1 (Connection test)", [], err);
          });
      } catch (err) {
        console.error("[MYSQL DB ERROR] Failed to initialize Pool:", err);
        recordQueryError("mysql.createPool", [], err);
      }
    }

    if (mysqlPool) {
      basePool = mysqlPool;
    }
  }

  // Fallback to In-Memory DB Pool for smooth local preview & testing
  if (!basePool) {
    if (!inMemPool) {
      inMemPool = new InMemDbPool();
      inMemPool.initSchema();
    }
    basePool = inMemPool;
  }

  return {
    query: async (sql: string, params: any[] = []): Promise<[any, any]> => {
      try {
        const result = await basePool!.query(sql, params);
        return result;
      } catch (err: any) {
        recordQueryError(sql, params, err);
        throw err;
      }
    }
  };
}

// Database Check Middleware
function checkDbConnection(req: Request, res: Response, next: NextFunction) {
  const p = getPool();
  if (!p) {
    return res.status(500).json({ message: "Database configuration is missing." });
  }
  next();
}

app.use("/api", checkDbConnection);

// WIB DateTime Helper
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

// Activity Logger Helper
async function logActivity(userName: string, action: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    const info = getWIBDateTimeString();
    const id = `AL${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await p.query(
      "INSERT INTO activity_log (id, userName, waktu, action) VALUES (?, ?, ?, ?)",
      [id, userName || "", info.full, action || ""]
    );
  } catch (err) {
    console.error("[DB ERROR] Failed logging activity:", err);
  }
}

// ---------------------- ENDPOINTS ----------------------

// 0a. GET /api/debug/db-health
app.get(["/api/debug/db-health", "/api/debug/db-health/"], async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const isMysql = !!(process.env.MYSQL_HOST || process.env.MYSQL_URL);
    
    let dbConnected = false;
    let testError: string | null = null;

    try {
      const [rows]: any = await p.query("SELECT 1");
      dbConnected = Array.isArray(rows) && rows.length > 0;
    } catch (err: any) {
      dbConnected = false;
      testError = err?.message || String(err);
      recordQueryError("SELECT 1 (db-health check)", [], err);
    }

    const poolState = {
      mode: isMysql ? "MySQL" : "In-Memory SQL (AlaSQL)",
      isMysqlConfigured: isMysql,
      mysqlHost: process.env.MYSQL_HOST || "Not Set",
      mysqlDatabase: process.env.MYSQL_DATABASE || "Not Set",
      mysqlUser: process.env.MYSQL_USER || "Not Set",
      mysqlPort: process.env.MYSQL_PORT || "3306 (default)",
      mysqlUrlConfigured: !!process.env.MYSQL_URL,
      mysqlPoolInitialized: !!mysqlPool,
      mysqlSchemaInitialized,
      connectionLimit: 10,
      queueLimit: 0,
      testQueryError: testError,
    };

    const healthResponse = {
      dbConnected,
      status: dbConnected ? "OK" : "ERROR",
      timestamp: getWIBDateTimeString().full,
      poolState,
      recentErrors: recentQueryErrors,
    };

    console.log("[DB HEALTH CHECK]", JSON.stringify(healthResponse));
    return res.status(dbConnected ? 200 : 500).json(healthResponse);
  } catch (err: any) {
    console.error("[DB HEALTH ERROR]", err);
    return res.status(500).json({
      dbConnected: false,
      status: "ERROR",
      error: err?.message || String(err),
      recentErrors: recentQueryErrors,
    });
  }
});

// 0b. GET /api/diagnostic and GET /api/health
app.get(["/api/diagnostic", "/api/health"], async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const isMysql = !!(process.env.MYSQL_HOST || process.env.MYSQL_URL);
    const mode = isMysql ? "MySQL" : "In-Memory SQL (AlaSQL)";
    
    // Check connection with a ping query
    let testResult = false;
    let dbError = null;
    try {
      const [ping]: any = await p.query("SELECT 1");
      testResult = !!ping;
    } catch (err: any) {
      dbError = err.message || String(err);
    }

    // Gather table counts
    let tableCounts: Record<string, number> = {};
    if (testResult) {
      try {
        const [uCount]: any = await p.query("SELECT COUNT(*) as c FROM users");
        const [eCount]: any = await p.query("SELECT COUNT(*) as c FROM expedisi");
        const [lCount]: any = await p.query("SELECT COUNT(*) as c FROM layanan");
        const [sCount]: any = await p.query("SELECT COUNT(*) as c FROM scans");
        const [lhCount]: any = await p.query("SELECT COUNT(*) as c FROM login_history");
        const [alCount]: any = await p.query("SELECT COUNT(*) as c FROM activity_log");

        tableCounts = {
          users: uCount[0]?.c ?? uCount[0]?.count ?? 0,
          expedisi: eCount[0]?.c ?? eCount[0]?.count ?? 0,
          layanan: lCount[0]?.c ?? lCount[0]?.count ?? 0,
          scans: sCount[0]?.c ?? sCount[0]?.count ?? 0,
          loginHistory: lhCount[0]?.c ?? lhCount[0]?.count ?? 0,
          activityLog: alCount[0]?.c ?? alCount[0]?.count ?? 0,
        };
      } catch (err: any) {
        console.error("[DIAGNOSTIC ERROR] Failed gathering table counts:", err);
      }
    }

    const diagnosticData = {
      status: testResult ? "OK" : "ERROR",
      timestamp: getWIBDateTimeString().full,
      dbMode: mode,
      dbConnected: testResult,
      dbError,
      envConfigured: {
        MYSQL_HOST: process.env.MYSQL_HOST ? "Configured" : "Not Set",
        MYSQL_DATABASE: process.env.MYSQL_DATABASE || "Not Set",
        MYSQL_USER: process.env.MYSQL_USER || "Not Set",
        MYSQL_PORT: process.env.MYSQL_PORT || "3306 (default)",
        MYSQL_URL: process.env.MYSQL_URL ? "Configured" : "Not Set",
      },
      tableCounts
    };

    console.log("[DIAGNOSTIC VERIFY] DB Status:", JSON.stringify(diagnosticData));
    return res.status(testResult ? 200 : 500).json(diagnosticData);
  } catch (err: any) {
    console.error("[DIAGNOSTIC ERROR] Diagnostic handler error:", err);
    return res.status(500).json({ status: "ERROR", error: err.message || String(err) });
  }
});

// 1. POST /api/auth/login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: "Username/Email dan Password wajib diisi!" });
    }

    const p = getPool();
    const [rows]: any = await p.query(
      "SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND password = ? LIMIT 1",
      [usernameOrEmail, usernameOrEmail, password]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: "Username/Email atau Password salah!" });
    }

    const user: User = rows[0];

    if (user.status === "Inactive") {
      return res.status(403).json({ message: "Akun Anda dinonaktifkan. Silakan hubungi Administrator!" });
    }

    const info = getWIBDateTimeString();
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    const newHistoryId = `LH${Date.now()}`;
    await p.query(
      "INSERT INTO login_history (id, userName, ip, browser, waktu, action) VALUES (?, ?, ?, ?, ?, ?)",
      [
        newHistoryId,
        user.username || "",
        ip || "",
        (req.headers["user-agent"] as string) || "Browser",
        info.full,
        "Login"
      ]
    );

    await logActivity(user.username, "Berhasil Login ke sistem");

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
  } catch (err: any) {
    console.error("[DB ERROR] Error in login endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 2. POST /api/auth/register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
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

    const p = getPool();
    const [existRows]: any = await p.query(
      "SELECT username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
      [username, email]
    );

    if (existRows && existRows.length > 0) {
      if (existRows[0].username && existRows[0].username.toLowerCase() === username.toLowerCase()) {
        return res.status(400).json({ message: "Username sudah digunakan!" });
      }
      return res.status(400).json({ message: "Email sudah digunakan!" });
    }

    const [countRows]: any = await p.query("SELECT COUNT(*) as count FROM users");
    let userSeq = (countRows[0]?.count || 0) + 1;
    let newId = `U${pad3(userSeq)}`;
    while (true) {
      const [chk]: any = await p.query("SELECT 1 FROM users WHERE id = ? LIMIT 1", [newId]);
      if (!chk || chk.length === 0) break;
      userSeq++;
      newId = `U${pad3(userSeq)}`;
    }

    const newUser: User = {
      id: newId,
      name,
      username,
      email,
      password,
      role: "Packing",
      status: "Active"
    };

    await p.query(
      "INSERT INTO users (id, name, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newUser.id, newUser.name || "", newUser.username || "", newUser.email || "", newUser.password || "", newUser.role || "Packing", newUser.status || "Active"]
    );

    await logActivity(username, `Mendaftar akun baru dengan Username: ${username}`);

    return res.status(201).json({ message: "Registrasi Berhasil! Silakan login." });
  } catch (err: any) {
    console.error("[DB ERROR] Error in register endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 3. POST /api/db/sync
app.post("/api/db/sync", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const { clientDb } = req.body;

    if (clientDb) {
      // Load deleted item sets from DB
      const [delUserRows]: any = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'user'");
      const [delExpRows]: any = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'expedisi'");
      const [delLayRows]: any = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'layanan'");
      const [delScanRows]: any = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'scan'");

      const delUsers = new Set((delUserRows as any[]).map(r => r.item_id));
      const delExp = new Set((delExpRows as any[]).map(r => r.item_id));
      const delLay = new Set((delLayRows as any[]).map(r => r.item_id));
      const delScans = new Set((delScanRows as any[]).map(r => r.item_id));

      // Sync Client Users
      if (Array.isArray(clientDb.users)) {
        for (const u of clientDb.users) {
          if (u && u.id && !delUsers.has(u.id)) {
            await p.query(
              `INSERT INTO users (id, name, username, email, password, role, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), username = VALUES(username), email = VALUES(email), password = VALUES(password), role = VALUES(role), status = VALUES(status)`,
              [u.id, u.name || "", u.username || "", u.email || "", u.password || "", u.role || "Packing", u.status || "Active"]
            );
          }
        }
      }

      // Sync Client Expedisi
      if (Array.isArray(clientDb.expedisi)) {
        for (const e of clientDb.expedisi) {
          if (e && e.id && !delExp.has(e.id)) {
            await p.query(
              `INSERT INTO expedisi (id, name, status)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
              [e.id, e.name || "", e.status || "Active"]
            );
          }
        }
      }

      // Sync Client Layanan
      if (Array.isArray(clientDb.layanan)) {
        for (const l of clientDb.layanan) {
          if (l && l.id && !delLay.has(l.id)) {
            await p.query(
              `INSERT INTO layanan (id, name, status)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
              [l.id, l.name || "", l.status || "Active"]
            );
          }
        }
      }

      // Sync Client Scans
      if (Array.isArray(clientDb.scans)) {
        for (const s of clientDb.scans) {
          if (s && s.id && !delScans.has(s.id)) {
            const resolvedName = (s.userName && s.userName.trim()) ? s.userName : "Muhammad Padli (Admin)";
            await p.query(
              `INSERT INTO scans (id, userId, userName, resi, waktu, layanan, expedisi)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE userId = VALUES(userId), userName = IF(VALUES(userName) != '', VALUES(userName), userName), resi = VALUES(resi), waktu = VALUES(waktu), layanan = VALUES(layanan), expedisi = VALUES(expedisi)`,
              [s.id, s.userId || "U001", resolvedName, s.resi || "", s.waktu || "", s.layanan || "", s.expedisi || ""]
            );
          }
        }
      }

      // Sync Client Login History
      if (Array.isArray(clientDb.loginHistory)) {
        for (const lh of clientDb.loginHistory) {
          if (lh && lh.id) {
            await p.query(
              `INSERT IGNORE INTO login_history (id, userName, ip, browser, waktu, action) VALUES (?, ?, ?, ?, ?, ?)`,
              [lh.id, lh.userName || "", lh.ip || "", lh.browser || "", lh.waktu || "", lh.action || "Login"]
            );
          }
        }
      }

      // Sync Client Activity Log
      if (Array.isArray(clientDb.activityLog)) {
        for (const al of clientDb.activityLog) {
          if (al && al.id) {
            await p.query(
              `INSERT IGNORE INTO activity_log (id, userName, waktu, action) VALUES (?, ?, ?, ?)`,
              [al.id, al.userName || "", al.waktu || "", al.action || ""]
            );
          }
        }
      }
    }

    // Read full merged DB
    const [users] = await p.query("SELECT * FROM users");
    const [expedisi] = await p.query("SELECT * FROM expedisi");
    const [layanan] = await p.query("SELECT * FROM layanan");
    const [scans] = await p.query("SELECT * FROM scans ORDER BY waktu ASC");
    const [loginHistory] = await p.query("SELECT * FROM login_history ORDER BY waktu DESC");
    const [activityLog] = await p.query("SELECT * FROM activity_log ORDER BY waktu DESC");

    const userMapSync: { [id: string]: string } = {};
    if (Array.isArray(users)) {
      (users as any[]).forEach(u => {
        const displayName = u.name || u.username;
        if (u.id) userMapSync[u.id] = displayName;
        if (u.username) userMapSync[u.username.toLowerCase()] = displayName;
        if (u.name) userMapSync[u.name.toLowerCase()] = displayName;
      });
    }

    const processedScans = ((scans as ScanRecord[]) || []).map(s => {
      let uName = s.userName;
      if (!uName || !uName.trim()) {
        uName = userMapSync[s.userId] || (s.userId && userMapSync[s.userId.toLowerCase()]) || s.userId || "Muhammad Padli (Admin)";
      }
      return {
        ...s,
        userName: uName
      };
    });

    const [delUsersRows] = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'user'");
    const [delExpRows] = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'expedisi'");
    const [delLayRows] = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'layanan'");
    const [delScansRows] = await p.query("SELECT item_id FROM deleted_items WHERE item_type = 'scan'");

    const serverDb: DbSchema = {
      users: users as User[],
      expedisi: expedisi as Expedisi[],
      layanan: layanan as Layanan[],
      scans: processedScans,
      loginHistory: loginHistory as LoginHistory[],
      activityLog: activityLog as ActivityLog[],
      deletedUsers: (delUsersRows as any[]).map(r => r.item_id),
      deletedExpedisi: (delExpRows as any[]).map(r => r.item_id),
      deletedLayanan: (delLayRows as any[]).map(r => r.item_id),
      deletedScans: (delScansRows as any[]).map(r => r.item_id)
    };

    return res.json({ db: serverDb });
  } catch (err: any) {
    console.error("[DB ERROR] Error in sync endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 4. GET /api/dashboard/stats
app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const info = getWIBDateTimeString();
    const todayYMD = info.ymd;
    const thisMonthYM = info.ym;

    console.log(`[API DASHBOARD STATS] Calculating stats for today: ${todayYMD}, month: ${thisMonthYM}`);

    // Safe query helper
    const safeQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
      try {
        const [rows]: any = await p.query(sql, params);
        return Array.isArray(rows) ? rows : [];
      } catch (err: any) {
        console.warn("[API DASHBOARD STATS WARN] Query execution error:", sql, err?.message || err);
        return [];
      }
    };

    // Fetch all records for memory aggregation to ensure 100% precision regardless of SQL engine differences
    const allScans = await safeQuery("SELECT * FROM scans");
    const allUsers = await safeQuery("SELECT * FROM users");
    const allExpedisi = await safeQuery("SELECT * FROM expedisi");

    const todayScans = allScans.filter(s => (s && s.waktu && String(s.waktu).startsWith(todayYMD)));
    const monthScans = allScans.filter(s => (s && s.waktu && String(s.waktu).startsWith(thisMonthYM)));

    const totalScanHariIni = todayScans.length;
    const totalScanBulanIni = monthScans.length;
    const totalUser = allUsers.length;
    const totalExpedisi = allExpedisi.length;

    const scansInstanHariIni = todayScans.filter(s => {
      const lay = (s.layanan || "").toString().toLowerCase().trim();
      return lay === "instan";
    }).length;

    const scansRegulerHariIni = todayScans.filter(s => {
      const lay = (s.layanan || "").toString().toLowerCase().trim();
      return lay === "regular" || lay === "reguler";
    }).length;

    const pointInstanHariIni = Math.floor(scansInstanHariIni / 3) + (scansInstanHariIni % 3 === 2 ? 1 : 0);
    const pointRegulerHariIni = scansRegulerHariIni * 1;

    // Scan Per Hari (last 7 days)
    const todayObj = new Date();
    const last7DaysMap: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const wibDay = new Date(todayObj.getTime() - (i * 24 * 60 * 60 * 1000));
      const dayInfo = getWIBDateTimeString(wibDay);
      last7DaysMap[dayInfo.ymd] = 0;
    }

    allScans.forEach(s => {
      if (s && s.waktu) {
        const dateStr = String(s.waktu).substring(0, 10);
        if (last7DaysMap[dateStr] !== undefined) {
          last7DaysMap[dateStr]++;
        }
      }
    });

    const chartScanPerHari = Object.keys(last7DaysMap).map(k => ({
      tanggal: k.substring(5), // MM-DD
      total: last7DaysMap[k]
    }));

    // Scan Per Bulan (current year)
    const currentYear = todayYMD.substring(0, 4);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const scanPerBulanMap: { [key: string]: number } = {
      "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0
    };

    allScans.forEach(s => {
      if (s && s.waktu && String(s.waktu).startsWith(currentYear)) {
        const monthStr = String(s.waktu).substring(5, 7);
        if (scanPerBulanMap[monthStr] !== undefined) {
          scanPerBulanMap[monthStr]++;
        }
      }
    });

    const chartScanPerBulan = Object.keys(scanPerBulanMap).map(k => ({
      bulan: monthNames[parseInt(k, 10) - 1],
      total: scanPerBulanMap[k]
    }));

    // Top Expedisi
    const expCountMap: { [key: string]: number } = {};
    const layCountMap: { [key: string]: number } = {};

    allScans.forEach(s => {
      if (s && s.expedisi && String(s.expedisi).trim()) {
        const expName = String(s.expedisi).trim();
        expCountMap[expName] = (expCountMap[expName] || 0) + 1;
      }
      if (s && s.layanan && String(s.layanan).trim()) {
        const layName = String(s.layanan).trim();
        layCountMap[layName] = (layCountMap[layName] || 0) + 1;
      }
    });

    const chartExpedisi = Object.keys(expCountMap)
      .map(k => ({ name: k, total: expCountMap[k] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const chartLayanan = Object.keys(layCountMap)
      .map(k => ({ name: k, total: layCountMap[k] }))
      .sort((a, b) => b.total - a.total);

    // Live Feed
    const userMapStats: { [key: string]: string } = {};
    if (Array.isArray(allUsers)) {
      allUsers.forEach((u: any) => {
        const displayName = u.name || u.username;
        if (u.id) userMapStats[u.id] = displayName;
        if (u.username) userMapStats[String(u.username).toLowerCase()] = displayName;
        if (u.name) userMapStats[String(u.name).toLowerCase()] = displayName;
      });
    }

    const sortedScans = [...allScans].sort((a, b) => {
      const timeA = String(a.waktu || "");
      const timeB = String(b.waktu || "");
      return timeB.localeCompare(timeA);
    }).slice(0, 10);

    const processedLiveFeed = sortedScans.map((s: any) => {
      let uName = s.userName;
      if (!uName || !String(uName).trim()) {
        uName = userMapStats[s.userId] || (s.userId && userMapStats[String(s.userId).toLowerCase()]) || s.userId || "Muhammad Padli (Admin)";
      }
      return {
        id: s.id,
        userId: s.userId,
        userName: uName,
        resi: s.resi,
        waktu: s.waktu,
        layanan: s.layanan,
        expedisi: s.expedisi
      };
    });

    console.log(`[API DASHBOARD STATS SUCCESS] Scans Today: ${totalScanHariIni} (Instan: ${scansInstanHariIni}, Reguler: ${scansRegulerHariIni}), Total Scans Month: ${totalScanBulanIni}`);

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
      liveFeed: processedLiveFeed
    });
  } catch (err: any) {
    console.error("[DB ERROR] Error in dashboard stats endpoint:", err);
    return res.json({
      totalScanHariIni: 0,
      totalScanBulanIni: 0,
      totalUser: 0,
      totalExpedisi: 0,
      scansInstanHariIni: 0,
      scansRegulerHariIni: 0,
      pointInstanHariIni: 0,
      pointRegulerHariIni: 0,
      charts: {
        scanPerHari: [],
        scanPerBulan: [],
        expedisi: [],
        layanan: []
      },
      liveFeed: []
    });
  }
});

// 5. GET /api/scans
app.get("/api/scans", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const id = (req.query.id || req.params.id) as string | undefined;

    if (id) {
      const [rows]: any = await p.query("SELECT * FROM scans WHERE id = ? LIMIT 1", [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Data scan tidak ditemukan!" });
      }
      return res.json(rows[0]);
    }

    const { range, username } = req.query;
    let sql = "SELECT * FROM scans WHERE 1=1";
    const params: any[] = [];

    if (username) {
      const target = (username as string).trim().toLowerCase();
      sql += " AND (LOWER(userName) = ? OR userId IN (SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(name) = ?))";
      params.push(target, target, target);
    }

    if (range === "latest24h") {
      const info = getWIBDateTimeString();
      sql += " AND waktu LIKE ?";
      params.push(`${info.ymd}%`);
    }

    sql += " ORDER BY waktu DESC, id DESC";

    const [rows]: any = await p.query(sql, params);

    // Build user map to resolve missing user names
    const userMap: { [key: string]: string } = {};
    const [allUsers]: any = await p.query("SELECT id, name, username FROM users");
    if (Array.isArray(allUsers)) {
      allUsers.forEach((u: any) => {
        const displayName = u.name || u.username;
        if (u.id) userMap[u.id] = displayName;
        if (u.username) userMap[u.username.toLowerCase()] = displayName;
        if (u.name) userMap[u.name.toLowerCase()] = displayName;
      });
    }

    const processedRows = (rows || []).map((s: any) => {
      let uName = s.userName || s.username;
      if (!uName || !uName.trim()) {
        uName = userMap[s.userId] || (s.userId && userMap[s.userId.toLowerCase()]) || s.userId || "Muhammad Padli (Admin)";
      }
      return {
        ...s,
        userName: uName
      };
    });

    return res.json(processedRows);
  } catch (err: any) {
    console.error("[DB ERROR] Error in get scans endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 6. POST /api/scans
app.post("/api/scans", async (req: Request, res: Response) => {
  try {
    const { resi, layanan, expedisi, userName, username, name, user: userField } = req.body;
    const finalExpedisi = (layanan === "Instan") ? (expedisi || "-") : (expedisi || "");
    const rawUserName = (userName || username || name || userField || "").trim();

    if (!resi || !layanan || !finalExpedisi) {
      return res.status(400).json({ message: "Resi, Layanan, dan Expedisi wajib diisi!" });
    }

    const p = getPool();
    const trimmedResi = resi.trim();

    // Validate duplicate resi
    const [dupRows]: any = await p.query(
      "SELECT 1 FROM scans WHERE LOWER(resi) = LOWER(?) LIMIT 1",
      [trimmedResi]
    );
    if (dupRows && dupRows.length > 0) {
      return res.status(400).json({ message: `Gagal! No Resi [${trimmedResi}] sudah pernah digunakan/discan sebelumnya!` });
    }

    // Lookup user ID & Name
    let userId = "U001";
    let resolvedUserName = rawUserName || "Muhammad Padli (Admin)";

    if (rawUserName) {
      const [userRows]: any = await p.query(
        "SELECT id, name, username FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(username) = LOWER(?) OR LOWER(id) = LOWER(?) LIMIT 1",
        [rawUserName, rawUserName, rawUserName]
      );
      if (userRows && userRows.length > 0) {
        userId = userRows[0].id || "U001";
        resolvedUserName = userRows[0].name || userRows[0].username || rawUserName;
      }
    } else {
      const [firstUserRows]: any = await p.query("SELECT id, name, username FROM users WHERE status = 'Active' LIMIT 1");
      if (firstUserRows && firstUserRows.length > 0) {
        userId = firstUserRows[0].id || "U001";
        resolvedUserName = firstUserRows[0].name || firstUserRows[0].username || "Muhammad Padli (Admin)";
      }
    }

    // Serial ID Generator: LOG-YYYYMMDD-XXXX
    const info = getWIBDateTimeString();
    const dateKey = info.dateKey;
    const todayYMD = info.ymd;

    const [scansCountRows]: any = await p.query(
      "SELECT COUNT(*) as count FROM scans WHERE waktu LIKE ?",
      [`${todayYMD}%`]
    );
    let dailySeq = (scansCountRows[0]?.count || 0) + 1;
    let serialId = `LOG-${dateKey}-${pad4(dailySeq)}`;
    while (true) {
      const [chk]: any = await p.query("SELECT 1 FROM scans WHERE id = ? LIMIT 1", [serialId]);
      if (!chk || chk.length === 0) break;
      dailySeq++;
      serialId = `LOG-${dateKey}-${pad4(dailySeq)}`;
    }

    const newScan: ScanRecord = {
      id: serialId,
      userId,
      userName: resolvedUserName,
      resi: trimmedResi.toUpperCase(),
      waktu: info.full,
      layanan,
      expedisi: finalExpedisi
    };

    console.log("[API SCAN INSERT] Processing new scan:", JSON.stringify(newScan));

    const [insertResult]: any = await p.query(
      "INSERT INTO scans (id, userId, userName, resi, waktu, layanan, expedisi) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newScan.id, newScan.userId || "", newScan.userName || "", newScan.resi || "", newScan.waktu || "", newScan.layanan || "", newScan.expedisi || ""]
    );

    console.log("[API SCAN INSERT SUCCESS] DB insert result:", JSON.stringify(insertResult));

    await logActivity(resolvedUserName, `Berhasil scan resi logistik [${newScan.resi}] via Web Scanner`);

    return res.status(201).json({
      message: "Scan Berhasil",
      scan: newScan
    });
  } catch (err: any) {
    console.error("[DB ERROR] Error in post scans endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 7. DELETE /api/scans/:id
app.delete("/api/scans/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID scan wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT resi, id FROM scans WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Data scan tidak ditemukan!" });
    }

    const scan = rows[0];
    await p.query("DELETE FROM scans WHERE id = ?", [id]);
    await p.query("INSERT INTO deleted_items (item_type, item_id) VALUES ('scan', ?)", [id]);

    await logActivity("admin", `Menghapus data scan resi: ${scan.resi} (Serial ID: ${scan.id})`);

    return res.json({ message: "Data scan berhasil dihapus!" });
  } catch (err: any) {
    console.error("[DB ERROR] Error in delete scan endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 8. GET /api/users
app.get("/api/users", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const id = (req.query.id || req.params.id) as string | undefined;

    if (id) {
      const [rows]: any = await p.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "User tidak ditemukan!" });
      }
      return res.json(rows[0]);
    }

    const [rows]: any = await p.query("SELECT * FROM users");
    return res.json(rows || []);
  } catch (err: any) {
    console.error("[DB ERROR] Error in get users endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 9. POST /api/users
app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { name, username, email, password, role, status } = req.body;
    if (!name || !username || !email || !password || !role) {
      return res.status(400).json({ message: "Nama, Username, Email, Password, dan Role wajib diisi!" });
    }

    const p = getPool();
    const [existRows]: any = await p.query(
      "SELECT 1 FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
      [username, email]
    );
    if (existRows && existRows.length > 0) {
      return res.status(400).json({ message: "Username atau Email sudah digunakan!" });
    }

    const [countRows]: any = await p.query("SELECT COUNT(*) as count FROM users");
    let userSeq = (countRows[0]?.count || 0) + 1;
    let newId = `U${pad3(userSeq)}`;
    while (true) {
      const [chk]: any = await p.query("SELECT 1 FROM users WHERE id = ? LIMIT 1", [newId]);
      if (!chk || chk.length === 0) break;
      userSeq++;
      newId = `U${pad3(userSeq)}`;
    }

    const newUser: User = {
      id: newId,
      name,
      username,
      email,
      password,
      role,
      status: status || "Active"
    };

    await p.query(
      "INSERT INTO users (id, name, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newUser.id, newUser.name || "", newUser.username || "", newUser.email || "", newUser.password || "", newUser.role || "Packing", newUser.status || "Active"]
    );

    await logActivity("admin", `Membuat user baru: ${username} (${role})`);

    return res.status(201).json(newUser);
  } catch (err: any) {
    console.error("[DB ERROR] Error in post users endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 10. PUT /api/users/:id
app.put("/api/users/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID User wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }

    const oldUser: User = rows[0];
    const { name, username, email, password, role, status } = req.body;

    const updatedUser: User = {
      id: oldUser.id,
      name: name ?? oldUser.name,
      username: username ?? oldUser.username,
      email: email ?? oldUser.email,
      password: password ?? oldUser.password,
      role: role ?? oldUser.role,
      status: status ?? oldUser.status
    };

    await p.query(
      "UPDATE users SET name = ?, username = ?, email = ?, password = ?, role = ?, status = ? WHERE id = ?",
      [updatedUser.name || "", updatedUser.username || "", updatedUser.email || "", updatedUser.password || "", updatedUser.role || "Packing", updatedUser.status || "Active", id]
    );

    await logActivity("admin", `Mengupdate profil/status user: ${updatedUser.username}`);

    return res.json(updatedUser);
  } catch (err: any) {
    console.error("[DB ERROR] Error in put user endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 11. DELETE /api/users/:id
app.delete("/api/users/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID User wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT username FROM users WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }

    const username = rows[0].username;
    await p.query("DELETE FROM users WHERE id = ?", [id]);
    await p.query("INSERT INTO deleted_items (item_type, item_id) VALUES ('user', ?)", [id]);

    await logActivity("admin", `Menghapus user: ${username}`);

    return res.json({ message: "User berhasil dihapus!" });
  } catch (err: any) {
    console.error("[DB ERROR] Error in delete user endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 12. GET /api/expedisi
app.get("/api/expedisi", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const id = (req.query.id || req.params.id) as string | undefined;

    if (id) {
      const [rows]: any = await p.query("SELECT * FROM expedisi WHERE id = ? LIMIT 1", [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Expedisi tidak ditemukan!" });
      }
      return res.json(rows[0]);
    }

    const [rows]: any = await p.query("SELECT * FROM expedisi");
    return res.json(rows || []);
  } catch (err: any) {
    console.error("[DB ERROR] Error in get expedisi endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 13. POST /api/expedisi
app.post("/api/expedisi", async (req: Request, res: Response) => {
  try {
    const { name, status } = req.body;
    if (!name) return res.status(400).json({ message: "Nama expedisi wajib diisi!" });

    const p = getPool();
    const [countRows]: any = await p.query("SELECT COUNT(*) as count FROM expedisi");
    let expSeq = (countRows[0]?.count || 0) + 1;
    let newId = `E${pad3(expSeq)}`;
    while (true) {
      const [chk]: any = await p.query("SELECT 1 FROM expedisi WHERE id = ? LIMIT 1", [newId]);
      if (!chk || chk.length === 0) break;
      expSeq++;
      newId = `E${pad3(expSeq)}`;
    }

    const newExp: Expedisi = {
      id: newId,
      name,
      status: status || "Active"
    };

    await p.query("INSERT INTO expedisi (id, name, status) VALUES (?, ?, ?)", [newExp.id, newExp.name || "", newExp.status || "Active"]);
    await logActivity("admin", `Membuat expedisi baru: ${name}`);

    return res.status(201).json(newExp);
  } catch (err: any) {
    console.error("[DB ERROR] Error in post expedisi endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 14. PUT /api/expedisi/:id
app.put("/api/expedisi/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID Expedisi wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT * FROM expedisi WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Expedisi tidak ditemukan!" });
    }

    const oldExp: Expedisi = rows[0];
    const { name, status } = req.body;

    const updatedExp: Expedisi = {
      id: oldExp.id,
      name: name ?? oldExp.name,
      status: status ?? oldExp.status
    };

    await p.query("UPDATE expedisi SET name = ?, status = ? WHERE id = ?", [updatedExp.name || "", updatedExp.status || "Active", id]);
    await logActivity("admin", `Mengupdate expedisi: ${updatedExp.name}`);

    return res.json(updatedExp);
  } catch (err: any) {
    console.error("[DB ERROR] Error in put expedisi endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 15. DELETE /api/expedisi/:id
app.delete("/api/expedisi/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID Expedisi wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT name FROM expedisi WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Expedisi tidak ditemukan!" });
    }

    const name = rows[0].name;
    await p.query("DELETE FROM expedisi WHERE id = ?", [id]);
    await p.query("INSERT INTO deleted_items (item_type, item_id) VALUES ('expedisi', ?)", [id]);

    await logActivity("admin", `Menghapus expedisi: ${name}`);

    return res.json({ message: "Expedisi berhasil dihapus" });
  } catch (err: any) {
    console.error("[DB ERROR] Error in delete expedisi endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 16. GET /api/layanan
app.get("/api/layanan", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const id = (req.query.id || req.params.id) as string | undefined;

    if (id) {
      const [rows]: any = await p.query("SELECT * FROM layanan WHERE id = ? LIMIT 1", [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Layanan tidak ditemukan!" });
      }
      return res.json(rows[0]);
    }

    const [rows]: any = await p.query("SELECT * FROM layanan");
    return res.json(rows || []);
  } catch (err: any) {
    console.error("[DB ERROR] Error in get layanan endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 17. POST /api/layanan
app.post("/api/layanan", async (req: Request, res: Response) => {
  try {
    const { name, status } = req.body;
    if (!name) return res.status(400).json({ message: "Nama layanan wajib diisi!" });

    const p = getPool();
    const [countRows]: any = await p.query("SELECT COUNT(*) as count FROM layanan");
    let laySeq = (countRows[0]?.count || 0) + 1;
    let newId = `L${pad3(laySeq)}`;
    while (true) {
      const [chk]: any = await p.query("SELECT 1 FROM layanan WHERE id = ? LIMIT 1", [newId]);
      if (!chk || chk.length === 0) break;
      laySeq++;
      newId = `L${pad3(laySeq)}`;
    }

    const newLay: Layanan = {
      id: newId,
      name,
      status: status || "Active"
    };

    await p.query("INSERT INTO layanan (id, name, status) VALUES (?, ?, ?)", [newLay.id, newLay.name || "", newLay.status || "Active"]);
    await logActivity("admin", `Membuat layanan baru: ${name}`);

    return res.status(201).json(newLay);
  } catch (err: any) {
    console.error("[DB ERROR] Error in post layanan endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 18. PUT /api/layanan/:id
app.put("/api/layanan/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID Layanan wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT * FROM layanan WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Layanan tidak ditemukan!" });
    }

    const oldLay: Layanan = rows[0];
    const { name, status } = req.body;

    const updatedLay: Layanan = {
      id: oldLay.id,
      name: name ?? oldLay.name,
      status: status ?? oldLay.status
    };

    await p.query("UPDATE layanan SET name = ?, status = ? WHERE id = ?", [updatedLay.name || "", updatedLay.status || "Active", id]);
    await logActivity("admin", `Mengupdate jenis layanan: ${updatedLay.name}`);

    return res.json(updatedLay);
  } catch (err: any) {
    console.error("[DB ERROR] Error in put layanan endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 19. DELETE /api/layanan/:id
app.delete("/api/layanan/:id?", async (req: Request, res: Response) => {
  try {
    const id = (req.query.id || req.params.id) as string | undefined;
    if (!id) return res.status(400).json({ message: "ID Layanan wajib diisi!" });

    const p = getPool();
    const [rows]: any = await p.query("SELECT name FROM layanan WHERE id = ? LIMIT 1", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Layanan tidak ditemukan!" });
    }

    const name = rows[0].name;
    await p.query("DELETE FROM layanan WHERE id = ?", [id]);
    await p.query("INSERT INTO deleted_items (item_type, item_id) VALUES ('layanan', ?)", [id]);

    await logActivity("admin", `Menghapus jenis layanan: ${name}`);

    return res.json({ message: "Layanan berhasil dihapus" });
  } catch (err: any) {
    console.error("[DB ERROR] Error in delete layanan endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 20. GET /api/logs/login_history
app.get("/api/logs/login_history", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const [rows]: any = await p.query("SELECT * FROM login_history ORDER BY waktu DESC LIMIT 500");
    return res.json(rows || []);
  } catch (err: any) {
    console.error("[DB ERROR] Error in login_history endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 21. GET /api/logs/activity_log
app.get("/api/logs/activity_log", async (req: Request, res: Response) => {
  try {
    const p = getPool();
    const [rows]: any = await p.query("SELECT * FROM activity_log ORDER BY waktu DESC LIMIT 500");
    return res.json(rows || []);
  } catch (err: any) {
    console.error("[DB ERROR] Error in activity_log endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// 22. POST /api/logs/activity
app.post("/api/logs/activity", async (req: Request, res: Response) => {
  try {
    const { userName, action } = req.body;
    if (!userName || !action) {
      return res.status(400).json({ message: "Username dan Action wajib diisi" });
    }
    await logActivity(userName, action);
    return res.json({ status: "success" });
  } catch (err: any) {
    console.error("[DB ERROR] Error in activity endpoint:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Global Fallback/Unmatched routes for API
app.all("/api/*", (req: Request, res: Response) => {
  res.status(404).json({ message: `Path ${req.method} ${req.path} tidak ditemukan di Monolith API.` });
});

export default app;
