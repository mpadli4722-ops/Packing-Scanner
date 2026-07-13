import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "./lib/db";
import { Expedisi } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const db = loadDb();
    return res.json(db.expedisi);
  }

  if (req.method === "POST") {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Nama Expedisi wajib diisi!" });

    const db = loadDb();
    const newExp: Expedisi = {
      id: `E${(db.expedisi.length + 1).toString().padStart(3, "0")}`,
      name,
      status: "Active"
    };
    db.expedisi.push(newExp);
    saveDb(db);

    logActivity(db, "admin", `Menambahkan expedisi baru: ${name}`);
    return res.status(201).json(newExp);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
