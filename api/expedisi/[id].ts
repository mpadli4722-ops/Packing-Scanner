import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: "ID wajib disertakan!" });
  }

  if (req.method === "PUT") {
    const { name, status } = req.body;
    const db = loadDb();

    const idx = db.expedisi.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

    db.expedisi[idx] = {
      ...db.expedisi[idx],
      name: name ?? db.expedisi[idx].name,
      status: status ?? db.expedisi[idx].status
    };
    saveDb(db);

    logActivity(db, "admin", `Mengupdate expedisi: ${db.expedisi[idx].name}`);
    return res.json(db.expedisi[idx]);
  }

  if (req.method === "DELETE") {
    const db = loadDb();
    const exp = db.expedisi.find(e => e.id === id);
    if (!exp) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

    db.expedisi = db.expedisi.filter(e => e.id !== id);
    if (!db.deletedExpedisi) db.deletedExpedisi = [];
    if (!db.deletedExpedisi.includes(id as string)) {
      db.deletedExpedisi.push(id as string);
    }
    saveDb(db);

    logActivity(db, "admin", `Menghapus expedisi: ${exp.name}`);
    return res.json({ message: "Expedisi berhasil dihapus" });
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
