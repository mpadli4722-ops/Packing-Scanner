import { useState, useEffect } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  RefreshCw, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Trash2,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { ScanRecord, UserRole } from "../types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface HistoryViewProps {
  range: "latest24h" | "all";
  currentUser: {
    name: string;
    username: string;
    role: UserRole;
  };
}

export default function HistoryView({ range, currentUser }: HistoryViewProps) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLayanan, setSelectedLayanan] = useState("Semua");
  const [selectedExpedisi, setSelectedExpedisi] = useState("Semua");
  const [selectedUser, setSelectedUser] = useState("Semua");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sorting States
  const [sortField, setSortField] = useState<keyof ScanRecord>("waktu");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Notifications
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Delete action states
  const [scanToDelete, setScanToDelete] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = currentUser.role && (currentUser.role.toLowerCase() === "administrator" || currentUser.role.toLowerCase() === "admin");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteScan = (scan: ScanRecord) => {
    if (!isAdmin) return;
    setScanToDelete(scan);
  };

  const confirmDeleteScan = async () => {
    if (!scanToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(getApiUrl(`/api/scans/${scanToDelete.id}`), { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Data scan berhasil dihapus secara permanen!");
        fetchScans(true);
      } else {
        const data = await res.json();
        showToast("error", data.message || "Gagal menghapus data scan!");
      }
    } catch (err) {
      showToast("error", "Terjadi kesalahan server!");
    } finally {
      setDeleting(false);
      setScanToDelete(null);
    }
  };

  const fetchScans = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // If role is Packing, limit records to their own scans only
      const isPacking = currentUser.role && currentUser.role.toLowerCase() === "packing";
      const userFilter = isPacking ? `&username=${currentUser.name}` : "";
      const res = await fetch(getApiUrl(`/api/scans?range=${range}${userFilter}`));
      if (res.ok) {
        const data = await res.json();
        setScans(data);
        setCurrentPage(1); // Reset page on refresh
      }
    } catch (e) {
      // Silent catch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [range, currentUser]);

  // Handle manual list refresh
  const handleRefresh = () => {
    fetchScans(true);
  };

  // Get unique packers, layanan, and expeditions for filter dropdowns (only if Admin/Supervisor)
  const uniquePackers = Array.from(new Set(scans.map(s => s.userName)));
  const uniqueLayanan = Array.from(new Set(scans.map(s => s.layanan)));
  const uniqueExpedisi = Array.from(new Set(scans.map(s => s.expedisi)));

  // Sorting logic
  const handleSort = (field: keyof ScanRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Log export activity to backend
  const logExportAction = async (format: "Excel" | "PDF") => {
    try {
      await fetch(getApiUrl("/api/logs/activity"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: currentUser.username,
          action: `Melakukan Export data Riwayat Scan (${range === "latest24h" ? "24 Jam" : "Terdahulu"}) ke format ${format}`
        })
      });
    } catch (e) {
      // Silent catch
    }
  };

  // Real Excel .xlsx Export (SheetJS generation)
  const handleExportExcel = () => {
    if (currentUser.role && currentUser.role.toLowerCase() === "packing") return;
    logExportAction("Excel");
    
    // Header
    const headers = ["No", "Serial ID", "Nama User", "No Resi", "Waktu", "Layanan", "Expedisi"];
    
    // Rows (Formatting date beautifully)
    const rows = filteredScans.map((scan, index) => [
      index + 1,
      scan.id,
      scan.userName,
      scan.resi,
      new Date(scan.waktu).toLocaleString("id-ID"),
      scan.layanan,
      scan.expedisi
    ]);

    // Points Summary Footer rows
    const footerRows = [
      [],
      ["RINGKASAN POIN FILTERED DATA", "", "", "", "", "", ""],
      ["Total Scan Instan", stats.instanCount, "", "", "", "", ""],
      ["Total Scan Reguler", stats.regulerCount, "", "", "", "", ""],
      ["Total Poin Instan", stats.instanPoints, "", "", "", "", ""],
      ["Total Poin Reguler", stats.regulerPoints, "", "", "", "", ""],
      ["Grand Total Poin", stats.instanPoints + stats.regulerPoints, "", "", "", "", ""]
    ];

    // Combine all to dynamic sheet data
    const worksheetData = [headers, ...rows, ...footerRows];
    
    try {
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Auto-fit column widths
      const maxColWidths = headers.map((h, i) => {
        let maxLen = h.length;
        worksheetData.forEach(row => {
          const val = row[i];
          if (val !== undefined && val !== null) {
            maxLen = Math.max(maxLen, String(val).length);
          }
        });
        return { wch: maxLen + 3 };
      });
      worksheet["!cols"] = maxColWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Scan");
      
      XLSX.writeFile(workbook, `Laporan_Scan_Logistik_${range === "latest24h" ? "Hari_Ini" : "Semua"}_${Date.now()}.xlsx`);
      
      setExportNotice("Laporan Scan berhasil di-export ke Excel (.xlsx)!");
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err) {
      showToast("error", "Gagal memproses file Excel!");
    }
  };

  // Print friendly layout (PDF generator)
  const handleExportPDF = () => {
    if (currentUser.role && currentUser.role.toLowerCase() === "packing") return;
    logExportAction("PDF");

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Define some style colors
      const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
      const accentColor: [number, number, number] = [37, 99, 235]; // Blue 600

      // Add Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("LAPORAN DATA RIWAYAT SCAN LOGISTIK", 14, 18);

      // Add a line separator
      doc.setDrawColor(226, 232, 240); // border slate-200
      doc.setLineWidth(0.5);
      doc.line(14, 22, 196, 22);

      // Metadata information
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      
      const printDate = new Date().toLocaleString("id-ID");
      const filterRangeText = range === "latest24h" ? "Hari Ini (24 Jam)" : "Semua Riwayat";
      
      doc.text(`Dicetak oleh: ${currentUser.name}`, 14, 28);
      doc.text(`Tanggal Cetak: ${printDate}`, 14, 33);
      doc.text(`Periode Laporan: ${filterRangeText}`, 14, 38);

      // Calculate stats summary to be displayed at the top of the PDF
      const dynamicStats = calculateFooterStats();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("RINGKASAN POIN & SCAN:", 120, 28);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(`Total Scan Instan: ${dynamicStats.instanCount} resi`, 120, 33);
      doc.text(`Total Scan Reguler: ${dynamicStats.regulerCount} resi`, 120, 38);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Grand Total Poin: ${dynamicStats.instanPoints + dynamicStats.regulerPoints} Pts`, 120, 43);

      // Separator before table
      doc.line(14, 48, 196, 48);

      // Generate table rows
      const tableRows = sortedScans.map((scan, index) => [
        index + 1,
        scan.id,
        new Date(scan.waktu).toLocaleString("id-ID"),
        scan.resi,
        scan.userName,
        scan.layanan,
        scan.expedisi
      ]);

      // Generate AutoTable
      autoTable(doc, {
        startY: 52,
        head: [["No", "ID Scan", "Waktu", "Nomor Resi", "Packer", "Layanan", "Ekspedisi"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          halign: "left"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85] // Slate 700
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 25 }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate 50
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Footer with Page Numbers
          const pageCount = doc.getNumberOfPages();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // Slate 400
          doc.text(
            `Halaman ${data.pageNumber} dari ${pageCount}`,
            14,
            doc.internal.pageSize.height - 10
          );
          doc.text(
            "LogistikScan Pro - Laporan Otomatis",
            doc.internal.pageSize.width - 65,
            doc.internal.pageSize.height - 10
          );
        }
      });

      // Save PDF
      doc.save(`Laporan_Scan_Logistik_${range === "latest24h" ? "Hari_Ini" : "Semua"}_${Date.now()}.pdf`);

      showToast("success", "Laporan PDF berhasil didownload!");
    } catch (error) {
      showToast("error", "Gagal memproses dan membuat file PDF!");
    }
  };

  // Filters + Search Query Processing
  const filteredScans = scans.filter((scan) => {
    const matchesSearch = 
      scan.resi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.expedisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.layanan.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLayanan = selectedLayanan === "Semua" || scan.layanan === selectedLayanan;
    const matchesExpedisi = selectedExpedisi === "Semua" || scan.expedisi === selectedExpedisi;
    const matchesUser = selectedUser === "Semua" || scan.userName === selectedUser;

    return matchesSearch && matchesLayanan && matchesExpedisi && matchesUser;
  });

  // Apply Sorting
  const sortedScans = [...filteredScans].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "waktu") {
      const getMs = (dateStr: string) => {
        try {
          if (!dateStr) return 0;
          const parts = dateStr.split(" ");
          if (parts.length < 2) return 0;
          // Replace space with 'T' for ISO conformity
          const iso = `${parts[0]}T${parts[1]}`;
          const parsed = new Date(iso).getTime();
          return isNaN(parsed) ? 0 : parsed;
        } catch {
          return 0;
        }
      };
      return sortOrder === "asc" 
        ? getMs(aVal as string) - getMs(bVal as string)
        : getMs(bVal as string) - getMs(aVal as string);
    }

    if (sortOrder === "asc") {
      return (aVal as string).localeCompare(bVal as string);
    } else {
      return (bVal as string).localeCompare(aVal as string);
    }
  });

  // Calculate stats for the currently filtered scans list (dynamic footer calculation)
  const calculateFooterStats = () => {
    const instanCount = filteredScans.filter(s => s.layanan === "Instan").length;
    const regulerCount = filteredScans.filter(s => s.layanan === "Regular").length;
    
    // Instan: 3 resi = 1 point, sisa 2 resi = 1 point
    const instanPoints = Math.floor(instanCount / 3) + (instanCount % 3 === 2 ? 1 : 0);
    // Regular: 1 resi = 1 point
    const regulerPoints = regulerCount * 1;

    return {
      instanCount,
      regulerCount,
      instanPoints,
      regulerPoints
    };
  };

  const stats = calculateFooterStats();

  // Pagination slices
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedScans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedScans.length / itemsPerPage);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Toast Notice */}
      {exportNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl shadow-lg animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold">{exportNotice}</span>
        </div>
      )}

      {/* Toast alert */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-bounce ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
          id="history-toast"
        >
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800" id="hist-title-h1">
            {range === "latest24h" ? "Riwayat Scan Terbaru (24 Jam)" : "Riwayat Scan Terdahulu (Semua Waktu)"}
          </h1>
          <p className="text-slate-500 text-xs">
            {range === "latest24h" 
              ? "Menampilkan data hasil scan paket resi logistik masuk hari ini." 
              : "Menampilkan rekaman seluruh transaksi data scan resi logistik yang tersimpan."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Refresh List"
            disabled={refreshing}
            id="btn-refresh-history"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Export options for Administrator and Supervisor */}
          {currentUser.role && currentUser.role.toLowerCase() !== "packing" && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Export ke Excel"
                id="btn-export-excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Cetak PDF / Print"
                id="btn-export-pdf"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4 text-center">
        <h1 className="text-lg font-bold uppercase tracking-wide">LAPORAN DATA RIWAYAT SCAN LOGISTIK</h1>
        <p className="text-xs text-slate-500 mt-1">Dicetak oleh: {currentUser.name} | Tanggal: {new Date().toLocaleString("id-ID")}</p>
        <p className="text-xs font-semibold text-blue-600 mt-1">Periode: {range === "latest24h" ? "Hari Ini (24 Jam)" : "Semua Riwayat"}</p>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Data</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Resi, ID, User..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-400"
              id="input-search-history"
            />
          </div>

          {/* User Filter (Admin/Spv only) */}
          <div className="space-y-1">
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
              disabled={currentUser.role && currentUser.role.toLowerCase() === "packing"}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:outline-none focus:border-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
              id="filter-packer"
            >
              <option value="Semua">Semua Packer</option>
              {uniquePackers.map((u, i) => (
                <option key={i} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Layanan Filter */}
          <div className="space-y-1">
            <select
              value={selectedLayanan}
              onChange={(e) => { setSelectedLayanan(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
              id="filter-layanan"
            >
              <option value="Semua">Semua Layanan</option>
              {uniqueLayanan.map((l, i) => (
                <option key={i} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Expedisi Filter */}
          <div className="space-y-1">
            <select
              value={selectedExpedisi}
              onChange={(e) => { setSelectedExpedisi(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
              id="filter-expedisi"
            >
              <option value="Semua">Semua Expedisi</option>
              {uniqueExpedisi.map((exp, i) => (
                <option key={i} value={exp}>{exp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop View Table */}
        <div className="overflow-x-auto w-full hidden sm:block">
          <table className="w-full border-collapse text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-bold w-12">No</th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center gap-1">
                    <span>Serial ID</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("userName")}
                >
                  <div className="flex items-center gap-1">
                    <span>Nama User</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("resi")}
                >
                  <div className="flex items-center gap-1">
                    <span>No Resi</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("waktu")}
                >
                  <div className="flex items-center gap-1">
                    <span>Waktu</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("layanan")}
                >
                  <div className="flex items-center gap-1">
                    <span>Layanan</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3.5 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("expedisi")}
                >
                  <div className="flex items-center gap-1">
                    <span>Expedisi</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                {isAdmin && <th className="px-5 py-3.5 font-bold text-center w-20 print:hidden">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memproses database...
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((scan, idx) => (
                  <tr key={scan.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-500">
                      {indexOfFirstItem + idx + 1}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 select-all">
                      {scan.id}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700">
                      {scan.userName}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-600 select-all bg-blue-50/10 rounded px-1.5 py-0.5 border border-blue-100/30">
                      {scan.resi}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {scan.waktu}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        scan.layanan === "Instan" 
                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {scan.layanan}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-600">
                      {scan.expedisi}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-center print:hidden">
                        <button
                          onClick={() => handleDeleteScan(scan)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Hapus Record Scan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-400">
                    Tidak ada rekaman data scan resi logistik yang cocok dengan kriteria filter.
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* STRICT REQUIRED: Summary Footers in tfoot */}
            <tfoot className="bg-slate-900 text-slate-100 border-t-2 border-slate-800">
              <tr>
                <td colSpan={3} className="px-5 py-4 font-bold text-slate-400 uppercase tracking-wider border-r border-slate-800 text-[10px]">
                  Poin & Ringkasan Riwayat Scan (Filtered)
                </td>
                <td colSpan={2} className="px-5 py-4 border-r border-slate-800">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-medium">Total Scan Instan: <strong className="text-amber-400 font-mono text-sm pl-1">{stats.instanCount}</strong> resi</span>
                    <span className="text-slate-400 font-medium">Total Scan Reguler: <strong className="text-blue-400 font-mono text-sm pl-1">{stats.regulerCount}</strong> resi</span>
                  </div>
                </td>
                <td colSpan={isAdmin ? 3 : 2} className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-medium">Poin Instan (3 Resi = 1 Poin, sisa 2 = 1 Poin): <strong className="text-amber-400 font-mono text-sm pl-1">{stats.instanPoints} Pts</strong></span>
                    <span className="text-slate-400 font-medium">Poin Reguler (1 Resi = 1 Poin): <strong className="text-emerald-400 font-mono text-sm pl-1">{stats.regulerPoints} Pts</strong></span>
                    <div className="border-t border-slate-800 mt-1 pt-1 text-xs text-white font-bold">
                      Grand Total Poin: <span className="text-emerald-400 text-sm font-mono">{stats.instanPoints + stats.regulerPoints} Pts</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="block sm:hidden divide-y divide-slate-100 bg-white">
          {loading ? (
            <div className="text-center py-10 text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Memproses database...
            </div>
          ) : currentItems.length > 0 ? (
            currentItems.map((scan, idx) => (
              <div key={scan.id} className="p-4 space-y-3 hover:bg-slate-50/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{indexOfFirstItem + idx + 1}
                    </span>
                    <span className="font-mono font-extrabold text-xs text-slate-900 select-all">
                      {scan.id}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                    scan.layanan === "Instan" 
                      ? "bg-amber-50 text-amber-700 border-amber-200" 
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {scan.layanan}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">No Resi:</span>
                    <span className="font-mono font-extrabold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded select-all border border-blue-100/30">
                      {scan.resi}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Packer:</span>
                    <span className="font-bold text-slate-700">{scan.userName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Expedisi:</span>
                    <span className="font-extrabold text-slate-700">{scan.expedisi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Waktu:</span>
                    <span className="font-mono text-[10px] text-slate-500">{scan.waktu}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-2 border-t border-slate-100/50">
                    <button
                      onClick={() => handleDeleteScan(scan)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs px-4">
              Tidak ada rekaman data scan resi logistik yang cocok dengan kriteria filter.
            </div>
          )}

          {/* Mobile Footer Stats Summary Card */}
          <div className="bg-slate-900 text-slate-100 p-4 space-y-3.5 border-t border-slate-800">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Poin & Ringkasan Riwayat Scan (Filtered)
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Scan Instan</span>
                <strong className="text-amber-400 font-mono text-sm">{stats.instanCount}</strong> <span className="text-slate-400">resi</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Scan Reguler</span>
                <strong className="text-blue-400 font-mono text-sm">{stats.regulerCount}</strong> <span className="text-slate-400">resi</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Poin Instan</span>
                <strong className="text-amber-400 font-mono text-sm">{stats.instanPoints} Pts</strong>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Poin Reguler</span>
                <strong className="text-emerald-400 font-mono text-sm">{stats.regulerPoints} Pts</strong>
              </div>
            </div>
            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs">
              <span className="text-white font-bold">Grand Total Poin:</span>
              <span className="text-emerald-400 text-sm font-extrabold font-mono bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/30">
                {stats.instanPoints + stats.regulerPoints} Pts
              </span>
            </div>
          </div>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 bg-white border-t border-slate-100 print:hidden text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan <strong className="text-slate-800 font-bold">{indexOfFirstItem + 1}</strong> hingga{" "}
              <strong className="text-slate-800 font-bold">
                {Math.min(indexOfLastItem, sortedScans.length)}
              </strong>{" "}
              dari <strong className="text-slate-800 font-bold">{sortedScans.length}</strong> data scan
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isSelected = currentPage === pageNum;
                return (
                  <button
                    key={i}
                    onClick={() => paginate(pageNum)}
                    className={`w-7 h-7 font-bold rounded-lg border text-xs transition-colors ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Delete Scan Confirmation Modal */}
      {scanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Konfirmasi Hapus Record Scan</h3>
              <p className="text-xs text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus data scan resi <span className="font-bold text-slate-700">[{scanToDelete.resi}]</span> secara permanen? Tindakan ini akan mempengaruhi poin packer.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setScanToDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-55"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteScan}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-rose-500/10 transition-colors cursor-pointer disabled:opacity-55 flex items-center gap-1.5"
                >
                  {deleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
