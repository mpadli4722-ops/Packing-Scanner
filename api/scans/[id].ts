import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: "ID wajib disertakan!" });
  }

  const db = loadDb();
  
  const scanIndex = db.scans.findIndex(s => s.id === id);
  if (scanIndex === -1) {
    return res.status(404).json({ message: "Data scan tidak ditemukan!" });
  }

  const scan = db.scans[scanIndex];
  db.scans.splice(scanIndex, 1);
  if (!db.deletedScans) db.deletedScans = [];
  if (!db.deletedScans.includes(id as string)) {
    db.deletedScans.push(id as string);
  }
  saveDb(db);

  logActivity(db, "admin", `Menghapus data scan resi: ${scan.resi} (Serial ID: ${scan.id})`);
  return res.json({ message: "Data scan berhasil dihapus!" });
}
