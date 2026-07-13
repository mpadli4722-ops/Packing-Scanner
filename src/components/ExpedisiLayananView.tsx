import { useState, useEffect, FormEvent } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Truck, 
  Settings2, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  AlertTriangle, 
  Power,
  Shield,
  X
} from "lucide-react";
import { UserRole } from "../types";

interface ExpedisiLayananProps {
  currentUser: {
    role: UserRole;
  };
}

interface Item {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

export default function ExpedisiLayananView({ currentUser }: ExpedisiLayananProps) {
  const [expedisi, setExpedisi] = useState<Item[]>([]);
  const [layanan, setLayanan] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [expName, setExpName] = useState("");
  const [layName, setLayName] = useState("");

  const [editExpId, setEditExpId] = useState<string | null>(null);
  const [editExpName, setEditExpName] = useState("");

  const [editLayId, setEditLayId] = useState<string | null>(null);
  const [editLayName, setEditLayName] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [expedisiToDelete, setExpedisiToDelete] = useState<Item | null>(null);
  const [layananToDelete, setLayananToDelete] = useState<Item | null>(null);

  const isAdmin = currentUser.role && (currentUser.role.toLowerCase() === "administrator" || currentUser.role.toLowerCase() === "admin");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resExp = await fetch(getApiUrl("/api/expedisi"));
      if (resExp.ok) {
        const data = await resExp.json();
        setExpedisi(data);
      }

      const resLay = await fetch(getApiUrl("/api/layanan"));
      if (resLay.ok) {
        const data = await resLay.json();
        setLayanan(data);
      }
    } catch (e) {
      // Silent catch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ===== EXPEDISI CRUD =====
  const handleAddExpedisi = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !expName.trim()) return;

    try {
      const res = await fetch(getApiUrl("/api/expedisi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: expName.trim() })
      });
      if (res.ok) {
        showToast("success", "Expedisi baru berhasil ditambahkan!");
        setExpName("");
        fetchData();
      } else {
        showToast("error", "Gagal menambahkan expedisi");
      }
    } catch (err) {
      showToast("error", "Gagal menyimpan data");
    }
  };

  const handleUpdateExpedisiStatus = async (item: Item) => {
    if (!isAdmin) return;
    const nextStatus = item.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await fetch(getApiUrl(`/api/expedisi/${item.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast("success", `Status expedisi ${item.name} diubah!`);
        fetchData();
      }
    } catch (err) {
      showToast("error", "Gagal mengubah status");
    }
  };

  const handleSaveEditExpedisi = async (id: string) => {
    if (!isAdmin || !editExpName.trim()) return;
    try {
      const res = await fetch(getApiUrl(`/api/expedisi/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editExpName.trim() })
      });
      if (res.ok) {
        showToast("success", "Nama expedisi berhasil diperbarui!");
        setEditExpId(null);
        fetchData();
      }
    } catch (err) {
      showToast("error", "Gagal menyimpan nama");
    }
  };

  const handleDeleteExpedisi = (item: Item) => {
    if (!isAdmin) return;
    setExpedisiToDelete(item);
  };

  const confirmDeleteExpedisi = async () => {
    if (!expedisiToDelete) return;
    try {
      const res = await fetch(getApiUrl(`/api/expedisi/${expedisiToDelete.id}`), { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Expedisi berhasil dihapus!");
        fetchData();
      } else {
        showToast("error", "Gagal menghapus expedisi");
      }
    } catch (err) {
      showToast("error", "Gagal menghapus");
    } finally {
      setExpedisiToDelete(null);
    }
  };

  // ===== LAYANAN CRUD =====
  const handleAddLayanan = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !layName.trim()) return;

    try {
      const res = await fetch(getApiUrl("/api/layanan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: layName.trim() })
      });
      if (res.ok) {
        showToast("success", "Jenis layanan baru berhasil ditambahkan!");
        setLayName("");
        fetchData();
      } else {
        showToast("error", "Gagal menambahkan layanan");
      }
    } catch (err) {
      showToast("error", "Gagal menyimpan data");
    }
  };

  const handleUpdateLayananStatus = async (item: Item) => {
    if (!isAdmin) return;
    const nextStatus = item.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await fetch(getApiUrl(`/api/layanan/${item.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast("success", `Status layanan ${item.name} diubah!`);
        fetchData();
      }
    } catch (err) {
      showToast("error", "Gagal mengubah status");
    }
  };

  const handleSaveEditLayanan = async (id: string) => {
    if (!isAdmin || !editLayName.trim()) return;
    try {
      const res = await fetch(getApiUrl(`/api/layanan/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editLayName.trim() })
      });
      if (res.ok) {
        showToast("success", "Nama layanan berhasil diperbarui!");
        setEditLayId(null);
        fetchData();
      }
    } catch (err) {
      showToast("error", "Gagal menyimpan nama");
    }
  };

  const handleDeleteLayanan = (item: Item) => {
    if (!isAdmin) return;
    setLayananToDelete(item);
  };

  const confirmDeleteLayanan = async () => {
    if (!layananToDelete) return;
    try {
      const res = await fetch(getApiUrl(`/api/layanan/${layananToDelete.id}`), { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Layanan berhasil dihapus!");
        fetchData();
      } else {
        showToast("error", "Gagal menghapus layanan");
      }
    } catch (err) {
      showToast("error", "Gagal menghapus");
    } finally {
      setLayananToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-bounce ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
          id="config-toast-alert"
        >
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800" id="el-title-h1">Management Config</h1>
        <p className="text-slate-500 text-xs">Kelola data list mitra kurir logistik dan jenis layanan logistik aktif pada formulir scan.</p>
      </div>

      {/* Access alert */}
      {!isAdmin && (
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-3 text-xs text-purple-800 font-semibold select-none">
          <Shield className="w-4.5 h-4.5 text-purple-600" />
          <span>Status Akses: Supervisor (Hanya Laporan & Monitoring. Edit/Hapus/Tambah dikunci oleh Administrator).</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EXPEDISI PANEL */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[50vh]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Daftar Mitra Expedisi</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full">
                {expedisi.length} Items
              </span>
            </div>

            {/* Quick Add Form */}
            {isAdmin && (
              <form onSubmit={handleAddExpedisi} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tambah Expedisi (e.g. JNE, SiCepat)"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                  id="input-add-expedisi"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer"
                  id="btn-submit-add-exp"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>
            )}

            {/* Expedisi List */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 pt-1">
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-xs">Memuat data...</div>
              ) : expedisi.length > 0 ? (
                expedisi.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                    {editExpId === item.id ? (
                      <div className="flex-1 flex gap-1.5 mr-4">
                        <input
                          type="text"
                          value={editExpName}
                          onChange={(e) => setEditExpName(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        />
                        <button
                          onClick={() => handleSaveEditExpedisi(item.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditExpId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-400 shrink-0">{item.id}</span>
                        <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                      </div>
                    )}

                    {editExpId !== item.id && (
                      <div className="flex items-center gap-2">
                        {/* Status Switcher */}
                        <button
                          onClick={() => handleUpdateExpedisiStatus(item)}
                          disabled={!isAdmin}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border flex items-center gap-1 transition-colors cursor-pointer ${
                            item.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60"
                          }`}
                        >
                          <Power className="w-2.5 h-2.5" />
                          <span>{item.status}</span>
                        </button>

                        {/* Actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                            <button
                              onClick={() => { setEditExpId(item.id); setEditExpName(item.name); }}
                              className="p-1 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpedisi(item)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Belum ada expedisi terdaftar.</div>
              )}
            </div>
          </div>
        </div>

        {/* LAYANAN PANEL */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[50vh]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Daftar Jenis Layanan</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full">
                {layanan.length} Items
              </span>
            </div>

            {/* Quick Add Form */}
            {isAdmin && (
              <form onSubmit={handleAddLayanan} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tambah Layanan (e.g. Same Day, Cargo)"
                  value={layName}
                  onChange={(e) => setLayName(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                  id="input-add-layanan"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer"
                  id="btn-submit-add-lay"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>
            )}

            {/* Layanan List */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 pt-1">
              {loading ? (
                <div className="text-center py-8 text-slate-400 text-xs">Memuat data...</div>
              ) : layanan.length > 0 ? (
                layanan.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                    {editLayId === item.id ? (
                      <div className="flex-1 flex gap-1.5 mr-4">
                        <input
                          type="text"
                          value={editLayName}
                          onChange={(e) => setEditLayName(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        />
                        <button
                          onClick={() => handleSaveEditLayanan(item.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditLayId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-400 shrink-0">{item.id}</span>
                        <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                      </div>
                    )}

                    {editLayId !== item.id && (
                      <div className="flex items-center gap-2">
                        {/* Status Switcher */}
                        <button
                          onClick={() => handleUpdateLayananStatus(item)}
                          disabled={!isAdmin}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border flex items-center gap-1 transition-colors cursor-pointer ${
                            item.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60"
                          }`}
                        >
                          <Power className="w-2.5 h-2.5" />
                          <span>{item.status}</span>
                        </button>

                        {/* Actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                            <button
                              onClick={() => { setEditLayId(item.id); setEditLayName(item.name); }}
                              className="p-1 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLayanan(item)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Belum ada jenis layanan terdaftar.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Delete Expedisi Modal */}
      {expedisiToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Hapus Ekspedisi</h3>
              <p className="text-xs text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus mitra ekspedisi <span className="font-bold text-slate-700">[{expedisiToDelete.name}]</span> secara permanen?
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setExpedisiToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteExpedisi}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-rose-500/10 transition-colors cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Layanan Modal */}
      {layananToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Hapus Jenis Layanan</h3>
              <p className="text-xs text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus jenis layanan <span className="font-bold text-slate-700">[{layananToDelete.name}]</span> secara permanen?
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setLayananToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteLayanan}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-rose-500/10 transition-colors cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
