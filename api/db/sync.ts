import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb } from "../lib/db";
import { DbSchema, ScanRecord, User, Expedisi, Layanan, LoginHistory, ActivityLog } from "../../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { clientDb } = req.body;
  const serverDb = loadDb();

  if (!clientDb) {
    return res.json({ db: serverDb });
  }

  // Merging client and server records to prevent data loss on container reset
  const delScans = serverDb.deletedScans || [];
  const delUsers = serverDb.deletedUsers || [];
  const delExp = serverDb.deletedExpedisi || [];
  const delLay = serverDb.deletedLayanan || [];

  // 1. Scans: Union by ID
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

  // 2. Users: Union by username, server authority on admin / existing users
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

  // 3. Expedisi: Union by ID
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

  // 4. Layanan: Union by ID
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

  // 5. Login History: Union by ID, reverse sorted by time
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

  // 6. Activity Log: Union by ID, reverse sorted by time
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

  saveDb(mergedDb);
  return res.json({ db: mergedDb });
}
