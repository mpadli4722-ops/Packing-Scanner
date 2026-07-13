import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, getWIBDateTimeString } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const db = loadDb();
  
  // Ambil tanggal hari ini (waktu WIB)
  const info = getWIBDateTimeString();
  const todayYMD = info.ymd;
  const thisMonthYM = info.ym;

  // Filter scan hari ini & bulan ini
  const scansHariIni = db.scans.filter(s => s.waktu.startsWith(todayYMD));
  const scansBulanIni = db.scans.filter(s => s.waktu.startsWith(thisMonthYM));

  const totalScanHariIni = scansHariIni.length;
  const totalScanBulanIni = scansBulanIni.length;
  const totalUser = db.users.length;
  const totalExpedisi = db.expedisi.length;

  // Detail Scan Hari Ini
  const scansInstanHariIni = scansHariIni.filter(s => s.layanan === "Instan").length;
  const scansRegulerHariIni = scansHariIni.filter(s => s.layanan === "Regular").length;

  // Perhitungan Point (Reset otomatis tiap 24 jam / hari ini)
  const pointInstanHariIni = Math.floor(scansInstanHariIni / 3) + (scansInstanHariIni % 3 === 2 ? 1 : 0);
  const pointRegulerHariIni = scansRegulerHariIni * 1;

  // Hitung Data Chart
  // 1. Scan Per Hari (7 Hari Terakhir dalam WIB)
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
    tanggal: k.substring(5), // ambil MM-DD
    total: scanPerHari[k]
  }));

  // 2. Scan Per Bulan (Tahun 2026)
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

  // 3. Expedisi Terbanyak
  const expedisiCount: { [key: string]: number } = {};
  db.scans.forEach(s => {
    expedisiCount[s.expedisi] = (expedisiCount[s.expedisi] || 0) + 1;
  });
  const chartExpedisi = Object.keys(expedisiCount).map(k => ({
    name: k,
    total: expedisiCount[k]
  })).sort((a, b) => b.total - a.total).slice(0, 5); // Ambil top 5

  // 4. Jenis Layanan Terbanyak
  const layananCount: { [key: string]: number } = {};
  db.scans.forEach(s => {
    layananCount[s.layanan] = (layananCount[s.layanan] || 0) + 1;
  });
  const chartLayanan = Object.keys(layananCount).map(k => ({
    name: k,
    total: layananCount[k]
  })).sort((a, b) => b.total - a.total);

  // Live Feed Scan Terbaru
  const liveFeed = db.scans.slice(-10).reverse(); // 10 scan terakhir

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
}
