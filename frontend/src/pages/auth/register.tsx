import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Zap, Mail, Phone } from 'lucide-react';
import { isValidIndonesianMobilePhone } from '../../utils/phone';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // (Removed inline OTP states, now using dedicated verify-otp page)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      setErrorMessage('Silakan lengkapi semua field yang wajib diisi.');
      return;
    }
    if (!isValidIndonesianMobilePhone(phone)) {
      setErrorMessage('Masukkan nomor handphone Indonesia yang valid, misalnya 081234567890 atau +6281234567890.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Match the backend RegisterInput struct
        body: JSON.stringify({ 
          username: name,
          email, 
          phone, 
          password 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Pendaftaran gagal. Silakan coba lagi.');
      }

      // Move to separate OTP step
      navigate(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
      setErrorMessage('');
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

      {/* Main Register Card Section */}
      <main className="flex-1 flex items-center justify-center p-6 my-4">
        <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Left Column: Brand Highlight & Features (hidden on mobile, visible on tablet/desktop) */}
          <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-emerald-50/80 via-slate-50 to-emerald-50/40 p-8 lg:p-10 text-slate-800 flex-col justify-between relative border-r border-slate-200/80">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-4 leading-tight text-slate-900">
                Langkah Pertama Menuju Bisnis yang Lebih Efisien
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-8">
                Bergabunglah dengan ribuan UMKM dan Enterprise yang telah mempercayakan operasional bisnisnya pada SIMPL.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-200/80 pt-6">
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Gratis uji coba 14 hari, tanpa kartu kredit</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <Zap className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Setup mudah dalam hitungan menit</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#21AC3A] shrink-0" />
                <span>Dukungan tim ahli siap membantu</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Form (Registration or OTP) */}
          <div className="col-span-12 md:col-span-7 p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
              {/* --- REGISTRATION STEP --- */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full"
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Daftar Akun Baru</h1>
                  <p className="text-slate-500 text-sm">
                    Isi data di bawah ini untuk membuat akun SIMPL Anda. Bisnis dapat dibuat nanti melalui dashboard.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Nama Lengkap
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Nama Anda"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                        />
                      </div>
                    </div>

                    {/* Email Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@perusahaan.com"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        No. Handphone
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          required
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                        />
                      </div>
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
                    placeholder="Buat password yang kuat"
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 mt-2 rounded-xl font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732] active:scale-[0.99] transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Daftar Sekarang</span>
                )}
              </button>
            </form>

            {/* Bottom Login Prompt */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
              Sudah memiliki akun?{' '}
              <Link
                to="/auth/login"
                className="font-bold text-[#21AC3A] hover:underline cursor-pointer"
              >
                Masuk di sini
              </Link>
            </div>
            </motion.div>
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
