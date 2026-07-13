import { useState, useEffect, FormEvent } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Power, 
  Key, 
  Edit2, 
  Trash2, 
  Plus, 
  X, 
  CheckCircle, 
  AlertTriangle,
  Mail,
  UserCheck
} from "lucide-react";
import { User, UserRole, UserStatus } from "../types";

interface UserManagementProps {
  currentUser: {
    username: string;
    role: UserRole;
  };
}

export default function UserManagementView({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Packing");
  const [status, setStatus] = useState<UserStatus>("Active");

  // Notifications
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Custom delete confirmation
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const isAdmin = currentUser.role && (currentUser.role.toLowerCase() === "administrator" || currentUser.role.toLowerCase() === "admin");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/users"));
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      // Silent catch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const openAddModal = () => {
    if (!isAdmin) return;
    setModalMode("add");
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("Packing");
    setStatus("Active");
    setSelectedUser(null);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    if (!isAdmin) return;
    setModalMode("edit");
    setSelectedUser(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setPassword(user.password || "");
    setRole(user.role);
    setStatus(user.status);
    setShowModal(true);
  };

  // Submit Add or Edit User
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!name || !username || !email || !password || !role) {
      showToast("error", "Semua field wajib diisi!");
      return;
    }

    if (password.length < 8) {
      showToast("error", "Password minimal harus 8 karakter!");
      return;
    }

    const payload = { name, username, email, password, role, status };

    try {
      if (modalMode === "add") {
        const res = await fetch(getApiUrl("/api/users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
          showToast("success", "User baru berhasil ditambahkan!");
          setShowModal(false);
          fetchUsers();
        } else {
          showToast("error", data.message || "Gagal membuat user baru!");
        }
      } else {
        // Edit
        const res = await fetch(getApiUrl(`/api/users/${selectedUser?.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
          showToast("success", "Profil user berhasil diperbarui!");
          setShowModal(false);
          fetchUsers();
        } else {
          showToast("error", data.message || "Gagal memperbarui user!");
        }
      }
    } catch (err) {
      showToast("error", "Kesalahan sistem backend!");
    }
  };

  // Toggle user status
  const toggleUserStatus = async (user: User) => {
    if (!isAdmin) return;
    const nextStatus: UserStatus = user.status === "Active" ? "Inactive" : "Active";
    
    try {
      const res = await fetch(getApiUrl(`/api/users/${user.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast("success", `Status user ${user.username} diubah menjadi ${nextStatus}`);
        fetchUsers();
      }
    } catch (err) {
      showToast("error", "Gagal merubah status user");
    }
  };

  // Delete User
  const handleDeleteUser = (user: User) => {
    if (!isAdmin) return;
    if (user.username === currentUser.username) {
      showToast("error", "Gagal! Anda tidak bisa menghapus akun login Anda sendiri.");
      return;
    }
    if (user.username === "admin") {
      showToast("error", "Gagal! Akun root admin tidak diperbolehkan dihapus.");
      return;
    }
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(getApiUrl(`/api/users/${userToDelete.id}`), { method: "DELETE" });
      if (res.ok) {
        showToast("success", "User berhasil dihapus secara permanen!");
        fetchUsers();
      } else {
        showToast("error", "Gagal menghapus user!");
      }
    } catch (err) {
      showToast("error", "Terjadi kesalahan server!");
    } finally {
      setUserToDelete(null);
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
          id="user-mgmt-toast"
        >
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800" id="user-title-h1">Management User</h1>
          <p className="text-slate-500 text-xs">Kelola data seluruh pengguna sistem, hak akses, peranan role, dan status aktifasi akun.</p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
            id="btn-add-user"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>
        )}
      </div>

      {/* Warning for Supervisor / non-admins */}
      {!isAdmin && (
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-3 text-xs text-purple-800 font-semibold select-none">
          <Shield className="w-4.5 h-4.5 text-purple-600" />
          <span>Status Akses: Supervisor (Hanya Laporan & Monitoring. Edit/Hapus/Tambah dikunci oleh Administrator).</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-bold w-12">No</th>
                <th className="px-5 py-3.5 font-bold">Nama Lengkap</th>
                <th className="px-5 py-3.5 font-bold">Username</th>
                <th className="px-5 py-3.5 font-bold">Email</th>
                <th className="px-5 py-3.5 font-bold">Password (Plain Text)</th>
                <th className="px-5 py-3.5 font-bold">Role</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                {isAdmin && <th className="px-5 py-3.5 font-bold text-center w-28">Aksi</th>}
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
              ) : users.length > 0 ? (
                users.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {user.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 font-bold select-all">
                      {user.username}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 select-all font-medium">
                      {user.email}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-500 select-all">
                      {user.password}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        user.role && (user.role.toLowerCase() === "administrator" || user.role.toLowerCase() === "admin")
                          ? "bg-red-50 text-red-700 border-red-200" 
                          : user.role && user.role.toLowerCase() === "supervisor" 
                          ? "bg-purple-50 text-purple-700 border-purple-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleUserStatus(user)}
                        disabled={!isAdmin || user.username === "admin"}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border flex items-center gap-1 transition-colors ${
                          user.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60"
                        } disabled:opacity-80 disabled:hover:bg-transparent`}
                        title={isAdmin ? "Klik untuk mengubah status" : undefined}
                      >
                        <Power className="w-2.5 h-2.5" />
                        <span>{user.status}</span>
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                            id={`btn-edit-user-${user.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.username === "admin" || user.username === currentUser.username}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg disabled:opacity-40 transition-colors"
                            title="Hapus User"
                            id={`btn-delete-user-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-400">
                    Tidak ada user terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD User Modal (Add / Edit) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-800">
                {modalMode === "add" ? <UserPlus className="w-5 h-5 text-blue-600" /> : <Edit2 className="w-5 h-5 text-blue-600" />}
                <h3 className="text-sm font-bold">{modalMode === "add" ? "Tambah User Baru" : "Edit Profil / Password User"}</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Nama */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masukkan nama lengkap..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                    id="modal-input-name"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "edit"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="Masukkan username unik..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                    id="modal-input-username"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@company.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                    id="modal-input-email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-3 h-3 text-slate-400" />
                    Password (Plain Text)
                  </label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                    id="modal-input-password"
                  />
                </div>

                {/* Role */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role / Hak Akses</label>
                    <select
                      value={role}
                      disabled={selectedUser?.username === "admin"}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700 cursor-pointer"
                      id="modal-select-role"
                    >
                      <option value="Packing">Packing (Packer)</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Administrator">Administrator</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status User</label>
                    <select
                      value={status}
                      disabled={selectedUser?.username === "admin"}
                      onChange={(e) => setStatus(e.target.value as UserStatus)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-700 cursor-pointer"
                      id="modal-select-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  id="modal-btn-submit"
                >
                  {modalMode === "add" ? "Tambah" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Konfirmasi Hapus Pengguna</h3>
              <p className="text-xs text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus user <span className="font-bold text-slate-700">[{userToDelete.username}]</span> secara permanen? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteUser}
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
