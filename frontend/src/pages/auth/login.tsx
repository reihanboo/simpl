import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Zap } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const savedIdentity = localStorage.getItem('remembered_identity');
    if (savedIdentity) {
      setIdentity(savedIdentity);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!identity.trim()) {
      setErrorMessage('Silakan masukkan Email atau Username Anda.');
      return;
    }

    if (!password) {
      setErrorMessage('Silakan masukkan Password Anda.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal. Silakan coba lagi.');
      }

      if (rememberMe) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('remembered_identity', identity);
      } else {
        sessionStorage.setItem('token', data.token);
        localStorage.removeItem('remembered_identity');
      }
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden font-sans text-slate-900">
      {/* Background Decorative Accent Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[#21AC3A]" />
      <div className="absolute top-12 left-10 w-96 h-96 bg-[#21AC3A]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="p-6 max-w-7xl w-full mx-auto flex justify-between items-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#21AC3A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src="/simpl-logo-dark.png" alt="SIMPL Logo" className="h-6 object-contain" />
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="flex-1 flex items-center justify-center p-6 my-4">
        <div className="w-full max-w-4xl grid md:grid-cols-12 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Left Column: Brand Highlight & Features (hidden on mobile, visible on tablet/desktop) */}
          <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-emerald-50/80 via-slate-50 to-emerald-50/40 p-8 lg:p-10 text-slate-800 flex-col justify-between relative border-r border-slate-200/80">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-4 leading-tight text-slate-900">
                Kelola Seluruh Bisnis dalam Satu Layar
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-8">
                Akses Point of Sales, persediaan stok real-time, manajemen tim, dan analisis berbasis AI.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-200/80 pt-6">
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Keamanan Data Terenkripsi</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <Zap className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Prediksi Stok Cerdas Berbasis Algoritma</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Dukungan Multi-Cabang Real-Time</span>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Form */}
          <div className="col-span-12 md:col-span-7 p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Selamat Datang Kembali</h1>
              <p className="text-slate-500 text-sm">
                Masukkan kredensial akun SIMPL Anda untuk melanjutkan.
              </p>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
              >
                {errorMessage}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email or Username Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Email atau Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="nama@perusahaan.com atau username"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#21AC3A] rounded border-slate-300 cursor-pointer"
                  />
                  <span>Ingat Saya</span>
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="font-semibold text-[#21AC3A] hover:underline cursor-pointer"
                >
                  Lupa Password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732] active:scale-[0.99] transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Masuk ke SIMPL</span>
                )}
              </button>
            </form>

            {/* Bottom Register Prompt */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
              Belum memiliki akun bisnis?{' '}
              <Link
                to="/auth/register"
                className="font-bold text-[#21AC3A] hover:underline cursor-pointer"
              >
                Pilih Paket & Daftar Sekarang
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} SIMPL — Scalable Integrated Management System.
      </footer>
    </div>
  );
}
