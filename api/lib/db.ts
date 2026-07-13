import fs from "fs";
import path from "path";
import { generateSeedData, DbSchema, User, Expedisi, Layanan, ScanRecord, LoginHistory, ActivityLog } from "../../src/db_seeder";

const DB_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "database");
const DB_FILE = path.join(DB_DIR, "db_store.json");

export function loadDb(): DbSchema {
  if (process.env.VERCEL) {
    if (!fs.existsSync(DB_FILE)) {
      try {
        const originalPath = path.join(process.cwd(), "database", "db_store.json");
        if (fs.existsSync(originalPath)) {
          const originalData = fs.readFileSync(originalPath, "utf-8");
          fs.writeFileSync(DB_FILE, originalData, "utf-8");
        } else {
          const seed = generateSeedData();
          fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
        }
      } catch (e) {
        const seed = generateSeedData();
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
    const seed = generateSeedData();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
    } catch (err) {}
    return seed;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    const seed = generateSeedData();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf-8");
    } catch (err) {}
    return seed;
  }
}

export function saveDb(db: DbSchema) {
  try {
    if (!process.env.VERCEL && !fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Gagal menyimpan database:", e);
  }
}

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

export function logActivity(db: DbSchema, userName: string, action: string) {
  const info = getWIBDateTimeString();
  const newLog: ActivityLog = {
    id: `AL${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userName,
    waktu: info.full,
    action
  };
  db.activityLog.unshift(newLog); // Tambahkan di paling atas
  saveDb(db);
}

export function pad3(num: number) {
  return num.toString().padStart(3, "0");
}
