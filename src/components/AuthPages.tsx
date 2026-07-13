import { useState, FormEvent } from "react";
import { getApiUrl } from "../lib/api";
import { 
  Lock, 
  User as UserIcon, 
  Mail, 
  Key, 
  AlertCircle, 
  CheckCircle,
  PackageCheck,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { UserRole } from "../types";

interface AuthPagesProps {
  onLoginSuccess: (user: { name: string; username: string; role: UserRole }) => void;
}

export default function AuthPages({ onLoginSuccess }: AuthPagesProps) {
  const [isLogin, setIsLogin] = useState(true);

  // Form Fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccess(null);
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username / Email dan Password wajib diisi!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: username.trim(),
          password: password
        })
      });

      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || "Gagal Login! Silakan periksa kembali akun Anda.");
      }
    } catch (err) {
      setError("Koneksi server terputus. Silakan coba sesaat lagi!");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password || !confirmPassword) {
      setError("Seluruh kolom pendaftaran wajib diisi!");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password Anda tidak cocok!");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal harus 8 karakter!");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase().replace(/\s/g, ""),
          email: email.trim(),
          password: password,
          confirmPassword: confirmPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Pendaftaran Berhasil! Silakan masuk ke akun Anda.");
        setName("");
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        // Auto transition to login page after 2 seconds
        setTimeout(() => {
          setIsLogin(true);
          setSuccess(null);
        }, 2000);
      } else {
        setError(data.message || "Gagal mendaftar akun baru!");
      }
    } catch (err) {
      setError("Koneksi server gagal!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      {/* Branding Logo */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex items-center justify-center p-2.5 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/15">
          <PackageCheck className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-lg tracking-wider text-slate-900 uppercase">SCAN LOGISTIK</span>
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Web Management System</span>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isLogin ? "Selamat Datang Kembali" : "Pendaftaran Packer Baru"}
          </h2>
          <p className="text-slate-400 text-xs font-semibold leading-relaxed">
            {isLogin 
              ? "Silakan masuk menggunakan akun logistik Anda yang terdaftar." 
              : "Isi form di bawah untuk mendaftarkan akun packer logistik Anda."}
          </p>
        </div>

        {/* Warning alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 font-semibold animate-shake" id="auth-error-alert">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success alerts */}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold" id="auth-success-alert">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {isLogin ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username/Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-3 h-3 text-slate-400" />
                Username atau Email
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username atau email..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold focus:outline-none text-slate-700 transition-colors"
                id="input-login-identity"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Password (Plain Text)
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-mono font-bold focus:outline-none text-slate-700 transition-colors"
                id="input-login-password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              id="btn-login-submit"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Masuk Sekarang</span>
            </button>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold focus:outline-none text-slate-700 transition-colors"
                id="input-register-name"
              />
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="Buat username unik..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-mono font-bold focus:outline-none text-slate-700 transition-colors"
                id="input-register-username"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-400" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="packer@company.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold focus:outline-none text-slate-700 transition-colors"
                id="input-register-email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3 h-3 text-slate-400" />
                Password (Plain Text)
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-mono font-bold focus:outline-none text-slate-700 transition-colors"
                id="input-register-password"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Konfirmasi Password</label>
              <input
                type="text"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-mono font-bold focus:outline-none text-slate-700 transition-colors"
                id="input-register-conf-password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              id="btn-register-submit"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Daftar Packer Baru</span>
            </button>
          </form>
        )}

        {/* Footer links */}
        <div className="text-center pt-2 border-t border-slate-100">
          <button
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            id="btn-auth-toggle"
          >
            <span>{isLogin ? "Belum punya akun? Registrasi Packer" : "Sudah punya akun? Masuk Sistem"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
