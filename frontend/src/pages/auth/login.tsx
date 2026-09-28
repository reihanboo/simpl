import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  PackageCheck,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(() => localStorage.getItem('remembered_identity') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('remembered_identity') !== null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
        if (response.status === 403 && data.email) {
          navigate(`/auth/verify-otp?email=${encodeURIComponent(data.email)}`);
          return;
        }
        throw new Error(data.error || 'Login gagal. Silakan coba lagi.');
      }

      if (rememberMe) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('remembered_identity', identity);
      } else {
        sessionStorage.setItem('token', data.token);
        localStorage.removeItem('remembered_identity');
      }

      navigate('/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5] font-sans text-[#242424]">
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#252525] px-6 text-white">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Simpl beranda">
          <img src="/simpl-logo-light.png" alt="Simpl" className="h-7 w-auto object-contain" />
        </Link>
        <nav className="flex items-center gap-4 text-xs text-[#D1D1D1] sm:gap-6 sm:text-[13px]">
          <Link to="/auth/register" className="transition-colors hover:text-white">
            Daftar
          </Link>
          <span className="text-white">Indonesia · ID</span>
        </nav>
      </header>

      <main className="flex flex-1 items-stretch">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="hidden w-[36.1%] shrink-0 flex-col justify-between border-r border-[#D1D1D1] bg-[#F0F0F0] p-10 lg:flex xl:p-14"
        >
          <div className="flex flex-col gap-4.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#21AC3A]">
              Operasional stok, lebih sederhana
            </p>
            <h1 className="max-w-md text-[32px] font-semibold leading-[1.18] tracking-tight text-[#242424]">
              Kelola stok, penjualan, dan pelanggan dari satu konsol.
            </h1>
            <p className="max-w-md text-sm leading-normal text-[#616161]">
              Dibuat untuk bisnis Indonesia yang membutuhkan visibilitas stok andal tanpa
              kerumitan spreadsheet.
            </p>

            <div className="mt-2 flex flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#EAF7EC] text-[#21AC3A]">
                  <PackageCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Buku stok real-time</p>
                  <p className="mt-0.5 text-[13px] leading-[1.4] text-[#616161]">
                    Setiap perubahan stok tercatat dan dapat ditelusuri.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#EAF7EC] text-[#21AC3A]">
                  <ScanBarcode className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Kasir lebih cepat</p>
                  <p className="mt-0.5 text-[13px] leading-[1.4] text-[#616161]">
                    Catat transaksi dan perbarui stok secara instan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#EAF7EC] text-[#21AC3A]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Asisten operasional AI</p>
                  <p className="mt-0.5 text-[13px] leading-[1.4] text-[#616161]">
                    Tanyakan kebutuhan bisnis dalam Bahasa Indonesia.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#616161]">
            <ShieldCheck className="h-3.75 w-3.75 text-[#21AC3A]" />
            <span>Data terenkripsi · Dicadangkan setiap hari</span>
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-12"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
            className="w-full max-w-120 border border-[#D1D1D1] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.13)] sm:p-8"
          >
            <div className="mb-[22px]">
              <h2 className="text-2xl font-semibold text-[#242424]">Selamat datang di Simpl</h2>
              <p className="mt-1.5 text-[13px] text-[#616161]">
                Masuk untuk melanjutkan, atau buat akun untuk bisnis baru.
              </p>
            </div>

            <div className="mb-[22px] flex h-[38px] border-b border-[#D1D1D1] text-[13px]">
              <span className="flex flex-1 items-center justify-center border-b-2 border-[#21AC3A] font-semibold text-[#21AC3A]">
                Masuk
              </span>
              <Link
                to="/auth/register"
                className="flex flex-1 items-center justify-center text-[#616161] transition-colors hover:text-[#242424]"
              >
                Daftar
              </Link>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mb-4 border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {errorMessage}
              </motion.div>
            )}

            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
              className="flex flex-col gap-3.5"
            >
              <div className="flex flex-col gap-[5px]">
                <label htmlFor="identity" className="text-[13px] font-semibold text-[#242424]">
                  Email atau username
                </label>
                <input
                  id="identity"
                  type="text"
                  autoComplete="username"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="nama@perusahaan.com"
                  className="h-[38px] w-full border border-[#A19F9D] bg-white px-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                />
              </div>

              <div className="flex flex-col gap-[5px]">
                <label htmlFor="password" className="text-[13px] font-semibold text-[#242424]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="h-[38px] w-full border border-[#A19F9D] bg-white px-2.5 pr-10 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[#616161] hover:text-[#242424]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] leading-[1.35] text-[#8A8886]">
                  Gunakan minimal 8 karakter.
                </p>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-[7px] text-[#242424]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-[14px] w-[14px] accent-[#21AC3A]"
                  />
                  <span>Ingat saya</span>
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-[#21AC3A] hover:underline"
                >
                  Lupa password?
                </Link>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="flex h-9 w-full items-center justify-center border border-[#21AC3A] bg-[#21AC3A] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? 'Memproses...' : 'Masuk'}
              </motion.button>
            </motion.form>

            <div className="mt-5 flex justify-center gap-1.5 text-[13px]">
              <span className="text-[#616161]">Belum punya akun Simpl?</span>
              <Link to="/auth/register" className="font-semibold text-[#21AC3A] hover:underline">
                Buat akun
              </Link>
            </div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
