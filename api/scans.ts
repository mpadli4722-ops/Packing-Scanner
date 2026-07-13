import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity, getWIBDateTimeString } from "./lib/db";
import { ScanRecord } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const { range, username } = req.query;
    const db = loadDb();
    let filtered = [...db.scans];

    // Filter user khusus role packing
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

    // Filter 24 Jam
    if (range === "latest24h") {
      const info = getWIBDateTimeString();
      filtered = filtered.filter(s => s.waktu.startsWith(info.ymd));
    }

    filtered.reverse();
    return res.json(filtered);
  }

  if (req.method === "POST") {
    const { resi, layanan, expedisi, userName } = req.body;
    const finalExpedisi = (layanan === "Instan") ? (expedisi || "-") : expedisi;

    if (!resi || !layanan || !finalExpedisi || !userName) {
      return res.status(400).json({ message: "Resi, Layanan, Expedisi, dan User Name wajib diisi!" });
    }

    const db = loadDb();

    // Validasi duplicate scan
    const isDuplicate = db.scans.some(s => s.resi.trim().toLowerCase() === resi.trim().toLowerCase());
    if (isDuplicate) {
      return res.status(400).json({ message: `Gagal! No Resi [${resi}] sudah pernah digunakan/discan sebelumnya!` });
    }

    // Cari user id
    const user = db.users.find(u => u.name === userName || u.username === userName);
    const userId = user ? user.id : "U000";

    // Generate Serial ID
    const pad4 = (n: number) => n.toString().padStart(4, "0");
    const info = getWIBDateTimeString();
    const dateKey = info.dateKey;
    const todayYMD = info.ymd;
    
    const scansHariIni = db.scans.filter(s => s.waktu.startsWith(todayYMD));
    const dailySeq = scansHariIni.length + 1;
    const serialId = `LOG-${dateKey}-${pad4(dailySeq)}`;

    const waktu = info.full;

    const newScan: ScanRecord = {
      id: serialId,
      userId,
      userName: user ? user.name : userName,
      resi: resi.trim().toUpperCase(),
      waktu,
      layanan,
      expedisi: finalExpedisi
    };

    db.scans.push(newScan);
    saveDb(db);

    logActivity(db, user ? user.username : userName, `Berhasil scan resi logistik [${newScan.resi}] via Web Scanner`);

    return res.status(201).json({
      message: "Scan Berhasil",
      scan: newScan
    });
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
