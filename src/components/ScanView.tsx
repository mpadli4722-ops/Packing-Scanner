import { useState, useEffect, useRef, FormEvent } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Scan, 
  User as UserIcon, 
  Clock, 
  Barcode, 
  Camera, 
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  X,
  Sparkles
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { getAccessToken } from "../lib/firebaseAuth";
import { appendScanRowToSheet } from "../lib/googleSheets";

interface ScanViewProps {
  currentUser: {
    name: string;
    username: string;
  };
  onScanSuccess: () => void;
}

interface Expedisi {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

interface Layanan {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

export default function ScanView({ currentUser, onScanSuccess }: ScanViewProps) {
  const [serialId, setSerialId] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [resi, setResi] = useState("");
  
  // Dynamic collections from backend
  const [expedisiList, setExpedisiList] = useState<Expedisi[]>([]);
  const [layananList, setLayananList] = useState<Layanan[]>([]);
  const [selectedExpedisi, setSelectedExpedisi] = useState("");
  const [selectedLayanan, setSelectedLayanan] = useState("");

  // Scanner UI states
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // Feedbacks
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "camera-scanner-view";

  // Fetch configs & update current state
  const loadConfig = async () => {
    try {
      // Fetch active expeditions
      const resExp = await fetch(getApiUrl("/api/expedisi"));
      if (resExp.ok) {
        const data = await resExp.json();
        const active = data.filter((e: Expedisi) => e.status === "Active");
        setExpedisiList(active);
        if (active.length > 0) setSelectedExpedisi(active[0].name);
      }

      // Fetch active services
      const resLay = await fetch(getApiUrl("/api/layanan"));
      if (resLay.ok) {
        const data = await resLay.json();
        const active = data.filter((l: Layanan) => l.status === "Active");
        setLayananList(active);
        if (active.length > 0) setSelectedLayanan(active[0].name);
      }

      // Fetch today's scans count to build Serial ID
      const resScans = await fetch(getApiUrl("/api/scans?range=latest24h"));
      if (resScans.ok) {
        const scans = await resScans.json();
        const pad4 = (n: number) => n.toString().padStart(4, "0");
        const now = new Date();
        
        // Use Asia/Jakarta (WIB) timezone for pre-calculated Serial ID dateKey
        const year = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", year: "numeric" });
        const month = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", month: "2-digit" });
        const day = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", day: "2-digit" });
        const dateKey = `${year}${month}${day}`;
        
        const countToday = scans.length + 1;
        setSerialId(`LOG-${dateKey}-${pad4(countToday)}`);
      }
    } catch (e) {
      // Silent catch
    }
  };

  useEffect(() => {
    loadConfig();

    // Set interactive clock in Asia/Jakarta (WIB) timezone
    const interval = setInterval(() => {
      const now = new Date();
      
      const timePart = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      
      const datePart = now.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      
      setCurrentTime(`${datePart}, ${timePart}`);
    }, 1000);

    return () => {
      clearInterval(interval);
      stopScanner();
    };
  }, []);

  // Show customized Toast alerts
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Start the physical camera using html5-qrcode
  const startScanner = async () => {
    setIsScanning(true);
    setScannerError(null);
    setResi("");

    setTimeout(() => {
      try {
        const html5QrcodeScanner = new Html5Qrcode(scannerId, false);
        qrReaderRef.current = html5QrcodeScanner;

        html5QrcodeScanner.start(
           { facingMode: "environment" }, // Kamera belakang HP
           {
             fps: 25, // FPS lebih tinggi untuk deteksi super instan di HP
             qrbox: (width, height) => {
               // Bidikan barcode persegi panjang mendatar (dimensi rasio resi standar)
               const minDim = Math.min(width, height);
               const boxWidth = Math.round(minDim * 0.85);
               const boxHeight = Math.round(minDim * 0.4);
               return { width: boxWidth, height: boxHeight };
             }
           },
          (decodedText) => {
            // Success Scan
            setResi(decodedText);
            showToast("success", `Resi Berhasil di-Scan: ${decodedText}`);
            stopScanner();
          },
          (errorMessage) => {
            // Keep looking silently, error here fires on every tick without barcode
          }
        ).catch((err) => {
          setScannerError("Izin kamera ditolak atau kamera tidak ditemukan. Gunakan panel simulator di bawah.");
        });
      } catch (e) {
        setScannerError("Gagal memuat scanner kamera.");
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (qrReaderRef.current && qrReaderRef.current.isScanning) {
      try {
        await qrReaderRef.current.stop();
      } catch (e) {
        // Silent catch
      }
    }
    setIsScanning(false);
  };

  // Simulate Barcode reading (for iframe testing in AI Studio preview)
  const simulateScan = (simulatedResi: string) => {
    setResi(simulatedResi);
    showToast("success", `Simulator: Resi Berhasil Terbaca [${simulatedResi}]`);
    stopScanner();
  };

  // Handle Form Submission
  const handleSubmitScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!resi) {
      showToast("error", "Nomor Resi kosong! Silakan scan resi terlebih dahulu.");
      return;
    }
    if (selectedLayanan !== "Instan" && !selectedExpedisi) {
      showToast("error", "Pilih Expedisi terlebih dahulu!");
      return;
    }
    if (!selectedLayanan) {
      showToast("error", "Pilih Jenis Layanan terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/scans"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resi: resi.trim().toUpperCase(),
          layanan: selectedLayanan,
          expedisi: selectedLayanan === "Instan" ? "-" : selectedExpedisi,
          userName: currentUser.name
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        showToast("success", "Scan Berhasil Disimpan Realtime!");

        // Google Sheets Auto-Sync Integration
        const spreadsheetId = localStorage.getItem("sheets_spreadsheet_id");
        const autoSync = localStorage.getItem("sheets_auto_sync") === "true";
        if (spreadsheetId && autoSync) {
          try {
            const token = await getAccessToken();
            if (token) {
              const currentCountRes = await fetch(getApiUrl("/api/scans"));
              let totalScansCount = 1;
              if (currentCountRes.ok) {
                const allScansList = await currentCountRes.json();
                totalScansCount = allScansList.length;
              }
              const sheetSuccess = await appendScanRowToSheet(token, spreadsheetId, data.scan, totalScansCount);
              if (sheetSuccess) {
                showToast("success", "Scan Disimpan & Disinkronisasi ke Google Sheets!");
              } else {
                console.warn("Gagal otomatis sinkronisasi ke Google Sheets.");
              }
            }
          } catch (e) {
            console.error("Gagal melakukan auto-sync ke Google Sheets:", e);
          }
        }

        setResi("");
        loadConfig(); // Refresh Serial ID dan sequence
        onScanSuccess(); // Notify parent to reload sidebar/dashboard feed
      } else {
        showToast("error", data.message || "Gagal menyimpan scan!");
      }
    } catch (err) {
      showToast("error", "Terjadi kesalahan server!");
    } finally {
      setLoading(false);
    }
  };

  // Test Barcodes for quick simulation clicking
  const testBarcodes = [
    { label: "JNE Regular", value: `JN${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    { label: "J&T Express", value: `JT${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    { label: "SiCepat Cargo", value: `SP${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    { label: "Anteraja Instan", value: `AN${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    { label: "Ninja SameDay", value: `NX${Math.floor(1000000000 + Math.random() * 9000000000)}` }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-bounce ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
          id="scan-toast-alert"
        >
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-800" id="scan-title-h1">Scanner Logistik</h1>
        <p className="text-slate-500 text-xs">Gunakan kamera HP atau emulator scan di bawah untuk mendaftarkan barcode paket logistik.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Main Form Fields (Col: 3) */}
        <div className="md:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <form onSubmit={handleSubmitScan} className="space-y-5">
            {/* Metadata (Readonly fields) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Serial ID (Sistem)
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 font-mono text-xs font-bold rounded-lg select-none">
                  {serialId || "Memuat..."}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                  Nama Packer (User)
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-xs rounded-lg truncate">
                  {currentUser.name}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Waktu Scan Logistik
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 font-mono text-xs rounded-lg">
                {currentTime || "Menghitung waktu..."}
              </div>
            </div>

            {/* No Resi (The scan output) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-blue-500" />
                No Resi (Barcode Logistik)
              </label>
              
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={resi}
                    readOnly
                    placeholder="Wajib men-scan Barcode paket resi..."
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-mono text-sm font-semibold rounded-lg focus:outline-none placeholder:text-slate-400 select-all"
                    id="input-no-resi"
                  />
                  {resi && (
                    <button
                      type="button"
                      onClick={() => setResi("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={startScanner}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                  id="btn-scan-camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera</span>
                </button>
              </div>
            </div>

            {/* Jenis Expedisi Selection Buttons */}
            {selectedLayanan !== "Instan" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pilih Mitra Expedisi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {expedisiList.map((exp) => {
                    const isSelected = selectedExpedisi === exp.name;
                    return (
                      <button
                        type="button"
                        key={exp.id}
                        onClick={() => setSelectedExpedisi(exp.name)}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-all duration-150 cursor-pointer ${
                          isSelected 
                            ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm font-bold" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50/60"
                        }`}
                        id={`btn-expedisi-choice-${exp.id}`}
                      >
                        {exp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl text-center">
                <span className="text-xs font-semibold text-amber-700 flex items-center justify-center gap-1.5">
                  ⚡ Layanan Instan tidak memerlukan pemilihan Mitra Ekspedisi
                </span>
              </div>
            )}

            {/* Jenis Layanan Selection Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Pilih Jenis Layanan Paket
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {layananList.map((lay) => {
                  const isSelected = selectedLayanan === lay.name;
                  return (
                    <button
                      type="button"
                      key={lay.id}
                      onClick={() => setSelectedLayanan(lay.name)}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm font-bold" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50/60"
                      }`}
                      id={`btn-layanan-choice-${lay.id}`}
                    >
                      {lay.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading || !resi}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-lg shadow disabled:shadow-none transition-all duration-150 cursor-pointer"
                id="btn-save-scan"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Simpan Scan Logistik</span>
              </button>
            </div>
          </form>
        </div>

        {/* Barcode Emulator Sidebar (Col: 2) */}
        <div className="md:col-span-2 space-y-6">
          {/* Real Barcode Instructions */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold tracking-wider uppercase">Info Barcode HP</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan barcode menggunakan kamera smartphone, webcam PC, atau emulator di bawah ini. Pastikan barcode berada tepat di area garis bidik merah scanner.
              </p>
            </div>
          </div>

          {/* Barcode Emulator Simulator */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Scan Simulator (Iframe)</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Jika browser memblokir izin kamera Anda di dalam iframe, klik salah satu tombol sampel barcode di bawah ini untuk mensimulasikan hasil scan:
            </p>

            <div className="space-y-1.5">
              {testBarcodes.map((bar, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => simulateScan(bar.value)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-left font-mono text-xs text-slate-600 transition-colors cursor-pointer"
                  id={`btn-simulate-barcode-${i}`}
                >
                  <span className="font-semibold">{bar.label}</span>
                  <span className="font-bold">{bar.value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HTML5 Camera Scanner Modal Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <Camera className="w-5 h-5 text-blue-600 animate-pulse" />
                <h3 className="text-sm font-bold">Kamera Barcode Scanner</h3>
              </div>
              <button
                onClick={stopScanner}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scanner Area */}
            <div className="p-4 sm:p-6 space-y-4">
              <div className="relative aspect-square w-full max-w-xs sm:max-w-sm mx-auto bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                <div id={scannerId} className="w-full h-full"></div>
                
                {scannerError && (
                  <div className="absolute inset-0 z-20 p-4 bg-slate-950/95 text-center flex flex-col items-center justify-center text-slate-300 gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-full text-amber-500">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-xs leading-relaxed font-medium">{scannerError}</span>
                  </div>
                )}
              </div>

              {/* Simulation panel inside modal */}
              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-center space-y-2">
                <p className="text-[10px] text-amber-800 font-semibold leading-normal">
                  Tips: Jika kamera diblokir di iframe atau bermasalah, Anda dapat langsung mengeklik simulasi barcode di bawah ini untuk menguji sistem:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <button
                    onClick={() => simulateScan(`JN${Math.floor(1000000000 + Math.random() * 9000000000)}`)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-amber-300 rounded font-mono text-[9px] font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
                  >
                    Simulasi JNE
                  </button>
                  <button
                    onClick={() => simulateScan(`JT${Math.floor(1000000000 + Math.random() * 9000000000)}`)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-amber-300 rounded font-mono text-[9px] font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
                  >
                    Simulasi J&T
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={stopScanner}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
