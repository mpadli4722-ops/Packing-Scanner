import { useState, useEffect } from "react";
import { getApiUrl } from "../lib/api";
import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken, 
  initAuth 
} from "../lib/firebaseAuth";
import { 
  createLogistikSpreadsheet, 
  exportAllScansToSheet, 
  getSheetRowCount,
  appendScanRowToSheet
} from "../lib/googleSheets";
import { 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Link, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Settings2, 
  Check, 
  Lock,
  History
} from "lucide-react";
import { ScanRecord } from "../types";

export default function GoogleSheetsView() {
  // Auth state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string>("");
  const [spreadsheetName, setSpreadsheetName] = useState<string>("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");
  const [autoSync, setAutoSync] = useState<boolean>(false);
  
  // Local inputs
  const [customSheetName, setCustomSheetName] = useState<string>("Sistem Scan Logistik - Database");
  const [existingUrlOrId, setExistingUrlOrId] = useState<string>("");
  
  // Status states
  const [isCreating, setIsCreating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [sheetRowCount, setSheetRowCount] = useState<number>(0);
  
  // Notification alert state
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Auto dismiss alert helper
  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("sheets_spreadsheet_id");
    const savedName = localStorage.getItem("sheets_spreadsheet_name");
    const savedUrl = localStorage.getItem("sheets_spreadsheet_url");
    const savedAuto = localStorage.getItem("sheets_auto_sync") === "true";
    const savedLast = localStorage.getItem("sheets_last_sync_time");

    if (savedId) setSpreadsheetId(savedId);
    if (savedName) setSpreadsheetName(savedName);
    if (savedUrl) setSpreadsheetUrl(savedUrl);
    setAutoSync(savedAuto);
    if (savedLast) setLastSyncTime(savedLast);

    // Initialize Firebase Auth listener
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setIsInitializing(false);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setIsInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch row count when spreadsheet is active and authenticated
  useEffect(() => {
    if (accessToken && spreadsheetId) {
      updateRowCount();
    }
  }, [accessToken, spreadsheetId]);

  const updateRowCount = async () => {
    if (!accessToken || !spreadsheetId) return;
    try {
      const count = await getSheetRowCount(accessToken, spreadsheetId);
      setSheetRowCount(count);
    } catch (e) {
      // fail silently
    }
  };

  // Handle Sign In with Google
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setNotification(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        showNotification("success", `Berhasil masuk sebagai ${result.user.email}`);
      }
    } catch (error: any) {
      showNotification("error", `Gagal masuk Google: ${error.message || error}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memutuskan koneksi akun Google?")) {
      return;
    }
    try {
      await googleSignOut();
      setGoogleUser(null);
      setAccessToken(null);
      showNotification("info", "Koneksi akun Google berhasil diputuskan.");
    } catch (e: any) {
      showNotification("error", `Gagal memutuskan koneksi: ${e.message}`);
    }
  };

  // Create new Spreadsheet
  const handleCreateSpreadsheet = async () => {
    if (!accessToken) {
      showNotification("error", "Silakan hubungkan akun Google terlebih dahulu!");
      return;
    }
    setIsCreating(true);
    setNotification(null);
    try {
      const { spreadsheetId: newId, spreadsheetUrl: newUrl } = await createLogistikSpreadsheet(
        accessToken,
        customSheetName
      );

      setSpreadsheetId(newId);
      setSpreadsheetName(customSheetName);
      setSpreadsheetUrl(newUrl);

      localStorage.setItem("sheets_spreadsheet_id", newId);
      localStorage.setItem("sheets_spreadsheet_name", customSheetName);
      localStorage.setItem("sheets_spreadsheet_url", newUrl);

      showNotification("success", `Berhasil membuat spreadsheet: "${customSheetName}"`);
      updateRowCount();
    } catch (error: any) {
      showNotification("error", error.message || "Gagal membuat spreadsheet.");
    } finally {
      setIsCreating(false);
    }
  };

  // Link existing spreadsheet by URL or ID
  const handleLinkExisting = async () => {
    if (!accessToken) {
      showNotification("error", "Silakan hubungkan akun Google terlebih dahulu!");
      return;
    }
    if (!existingUrlOrId.trim()) {
      showNotification("error", "Masukkan ID Spreadsheet atau URL yang valid!");
      return;
    }

    setIsLinking(true);
    setNotification(null);

    // Extract ID if a full URL is provided
    let targetId = existingUrlOrId.trim();
    const urlMatch = targetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      targetId = urlMatch[1];
    }

    try {
      // Validate sheet accessibility by fetching row count
      const testCount = await getSheetRowCount(accessToken, targetId);
      
      const title = "Spreadsheet Terhubung";
      const fullUrl = `https://docs.google.com/spreadsheets/d/${targetId}/edit`;

      setSpreadsheetId(targetId);
      setSpreadsheetName(title);
      setSpreadsheetUrl(fullUrl);
      setSheetRowCount(testCount);

      localStorage.setItem("sheets_spreadsheet_id", targetId);
      localStorage.setItem("sheets_spreadsheet_name", title);
      localStorage.setItem("sheets_spreadsheet_url", fullUrl);

      showNotification("success", "Koneksi ke spreadsheet berhasil dibuat!");
      setExistingUrlOrId("");
    } catch (error: any) {
      showNotification("error", "ID Spreadsheet tidak valid atau Anda tidak memiliki hak akses.");
    } finally {
      setIsLinking(false);
    }
  };

  // Unlink the current spreadsheet
  const handleUnlinkSpreadsheet = () => {
    if (!window.confirm("Apakah Anda yakin ingin memutuskan hubungan spreadsheet aktif? Pengaturan sinkronisasi akan dihapus dari browser ini.")) {
      return;
    }

    setSpreadsheetId("");
    setSpreadsheetName("");
    setSpreadsheetUrl("");
    setAutoSync(false);

    localStorage.removeItem("sheets_spreadsheet_id");
    localStorage.removeItem("sheets_spreadsheet_name");
    localStorage.removeItem("sheets_spreadsheet_url");
    localStorage.removeItem("sheets_auto_sync");

    showNotification("info", "Hubungan ke spreadsheet aktif telah diputuskan.");
  };

  // Toggle Auto Sync setting
  const handleToggleAutoSync = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);
    localStorage.setItem("sheets_auto_sync", newValue ? "true" : "false");
    showNotification(
      "success", 
      newValue 
        ? "Auto-Sync AKTIF! Setiap scan resi baru akan langsung otomatis diunggah ke Google Sheets." 
        : "Auto-Sync DINAKTIFKAN."
    );
  };

  // Batch Export all scans to Sheets
  const handleBatchExport = async () => {
    if (!accessToken || !spreadsheetId) {
      showNotification("error", "Spreadsheet belum dihubungkan!");
      return;
    }

    if (!window.confirm("Apakah Anda yakin ingin melakukan ekspor data? Ini akan memperbarui data di spreadsheet dan menimpa baris yang ada.")) {
      return;
    }

    setIsExporting(true);
    setNotification(null);

    try {
      // Load current scans from database API
      const res = await fetch(getApiUrl("/api/scans"));
      if (!res.ok) throw new Error("Gagal mengambil data scan logistik dari server.");
      const scans: ScanRecord[] = await res.json();

      if (scans.length === 0) {
        showNotification("info", "Tidak ada data scan logistik untuk diekspor.");
        setIsExporting(false);
        return;
      }

      const success = await exportAllScansToSheet(accessToken, spreadsheetId, scans);
      
      if (success) {
        const nowStr = new Date().toLocaleString("id-ID");
        setLastSyncTime(nowStr);
        localStorage.setItem("sheets_last_sync_time", nowStr);
        showNotification("success", `Berhasil mengekspor ${scans.length} data scan ke Google Sheets!`);
        updateRowCount();
      } else {
        throw new Error("Proses ekspor gagal.");
      }
    } catch (error: any) {
      showNotification("error", error.message || "Gagal melakukan ekspor data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            Integrasi Google Sheets
          </h2>
          <p className="text-sm text-slate-500">
            Hubungkan dan sinkronisasikan data scan resi logistik Anda dengan Google Sheets secara instan dan realtime.
          </p>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-md animate-fade-in ${
          notification.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : notification.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : notification.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-semibold leading-relaxed">
            {notification.message}
          </div>
        </div>
      )}

      {/* Firebase Initialization Loader */}
      {isInitializing ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Memuat konfigurasi integrasi...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          
          {/* Step 1: Connect Account */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">Langkah 1</span>
                <h3 className="text-base font-bold text-slate-900">Hubungkan Akun Google</h3>
              </div>
              {googleUser ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Terhubung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  Belum Terhubung
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3">
                  {googleUser.photoURL ? (
                    <img 
                      src={googleUser.photoURL} 
                      alt="Google Profile" 
                      className="w-10 h-10 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {googleUser.email ? googleUser.email[0].toUpperCase() : "G"}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{googleUser.displayName || "Google User"}</h4>
                    <p className="text-[11px] text-slate-500">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-lg transition-colors cursor-pointer"
                >
                  Putuskan Koneksi
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 px-4 space-y-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs font-bold text-slate-800">Akses Terenkripsi & Aman</h4>
                  <p className="text-[11px] text-slate-500">
                    Sistem membutuhkan izin untuk mengakses Google Drive & Google Sheets Anda untuk membuat file log secara otomatis.
                  </p>
                </div>

                {/* Styled GSI Button */}
                <button 
                  onClick={handleSignIn}
                  disabled={isAuthenticating}
                  className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-wait"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Menghubungkan Google...</span>
                    </>
                  ) : (
                    <>
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      <span>Masuk dengan Google</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Spreadsheet Selection / Configuration */}
          {googleUser && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">Langkah 2</span>
                  <h3 className="text-base font-bold text-slate-900">Pengaturan Spreadsheet Google</h3>
                </div>
                {spreadsheetId ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    <Check className="w-3.5 h-3.5" /> Spreadsheet Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    Menunggu Sambungan
                  </span>
                )}
              </div>

              {spreadsheetId ? (
                /* Spreadsheet Info Card */
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg mt-0.5">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800">{spreadsheetName}</h4>
                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-md">ID: {spreadsheetId}</p>
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-white border border-slate-100 rounded px-1.5 py-0.5 shadow-xs">
                            Total baris terdeteksi: <strong>{sheetRowCount}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <a 
                        href={spreadsheetUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Buka Sheet</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={handleUnlinkSpreadsheet}
                        className="p-2 bg-white text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Putuskan Hubungan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sync Settings and Manual Trigger Panel */}
                  <div className="border border-slate-100 rounded-xl p-5 space-y-5 bg-white shadow-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Settings2 className="w-4 h-4 text-slate-400" />
                          Otomatisasi Sinkronisasi (Auto-Sync)
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">
                          Saat aktif, setiap kali petugas menyelesaikan scan resi di halaman "Scan Resi", data akan langsung diunggah ke baris baru Google Sheets secara realtime.
                        </p>
                      </div>
                      
                      <button
                        onClick={handleToggleAutoSync}
                        className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer outline-hidden shrink-0 ${
                          autoSync ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 bg-white w-5.5 h-5.5 rounded-full transition-transform shadow-xs ${
                          autoSync ? "translate-x-5.5" : "translate-x-0"
                        }`} />
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-5 space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <History className="w-4 h-4 text-slate-400" />
                          Batch Sinkronisasi Manual
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Anda dapat menyinkronkan seluruh riwayat scan yang tersimpan di sistem ke Google Sheet ini sekaligus. Ini akan membersihkan file Sheet1 Anda dan mengisi ulang dari awal sesuai database logistik.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={handleBatchExport}
                          disabled={isExporting}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Mengekspor data...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 text-white" />
                              <span>Ekspor Seluruh Database ke Sheet</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={updateRowCount}
                          className="px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                          <span>Perbarui Status</span>
                        </button>
                      </div>

                      {lastSyncTime && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          Terakhir sinkronisasi manual: <span className="text-slate-600 font-semibold">{lastSyncTime}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* No linked spreadsheet */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Option A: Create New Spreadsheet */}
                  <div className="p-5 border border-slate-200 hover:border-blue-200 bg-white hover:bg-slate-50/30 rounded-xl flex flex-col justify-between space-y-4 transition-all">
                    <div className="space-y-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit">
                        <Plus className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">Buat Spreadsheet Baru</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Sistem akan membuat file spreadsheet baru secara otomatis di Google Drive Anda lengkap dengan baris header kolom.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nama Spreadsheet</label>
                        <input
                          type="text"
                          value={customSheetName}
                          onChange={(e) => setCustomSheetName(e.target.value)}
                          placeholder="Masukkan nama spreadsheet..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 focus:border-blue-500 rounded-lg outline-hidden text-slate-700"
                        />
                      </div>

                      <button
                        onClick={handleCreateSpreadsheet}
                        disabled={isCreating}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Membuat Sheet...</span>
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                            <span>Buat Spreadsheet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Option B: Link Existing Spreadsheet */}
                  <div className="p-5 border border-slate-200 hover:border-emerald-200 bg-white hover:bg-slate-50/30 rounded-xl flex flex-col justify-between space-y-4 transition-all">
                    <div className="space-y-2">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit">
                        <Link className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">Hubungkan Spreadsheet yang Ada</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Hubungkan spreadsheet yang sudah Anda miliki. Pastikan Anda memiliki akses pengeditan ke spreadsheet tersebut.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">URL atau ID Spreadsheet</label>
                        <input
                          type="text"
                          value={existingUrlOrId}
                          onChange={(e) => setExistingUrlOrId(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 focus:border-emerald-500 rounded-lg outline-hidden text-slate-700"
                        />
                      </div>

                      <button
                        onClick={handleLinkExisting}
                        disabled={isLinking}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isLinking ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Menyambungkan...</span>
                          </>
                        ) : (
                          <>
                            <Link className="w-4 h-4 text-white" />
                            <span>Hubungkan Spreadsheet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
