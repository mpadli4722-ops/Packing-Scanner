import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "./lib/db";
import { Layanan } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const db = loadDb();
    return res.json(db.layanan);
  }

  if (req.method === "POST") {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Nama Layanan wajib diisi!" });

    const db = loadDb();
    const newLay: Layanan = {
      id: `L${(db.layanan.length + 1).toString().padStart(3, "0")}`,
      name,
      status: "Active"
    };
    db.layanan.push(newLay);
    saveDb(db);

    logActivity(db, "admin", `Menambahkan jenis layanan baru: ${name}`);
    return res.status(201).json(newLay);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
