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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      setErrorMessage('Silakan lengkapi semua field yang wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password harus terdiri dari minimal 6 karakter.');
      return;
    }

    if (!isValidIndonesianMobilePhone(phone)) {
      setErrorMessage(
        'Masukkan nomor handphone Indonesia yang valid, misalnya 081234567890 atau +6281234567890.',
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: name,
          email,
          phone,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Pendaftaran gagal. Silakan coba lagi.');
      }

      navigate(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
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
          <Link to="/auth/login" className="transition-colors hover:text-white">
            Masuk
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
              Mulai kelola bisnis lebih sederhana
            </p>
            <h1 className="max-w-md text-[32px] font-semibold leading-[1.18] tracking-tight text-[#242424]">
              Semua operasional bisnis, dalam satu konsol.
            </h1>
            <p className="max-w-md text-sm leading-normal text-[#616161]">
              Buat akun Simpl untuk mengelola stok, transaksi, dan pelanggan dengan lebih mudah.
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
            <div className="mb-5.5">
              <h2 className="text-2xl font-semibold text-[#242424]">Buat akun Simpl</h2>
              <p className="mt-1.5 text-[13px] text-[#616161]">
                Daftarkan akun Anda untuk mulai menggunakan Simpl.
              </p>
            </div>

            <div className="mb-5.5 flex h-9.5 border-b border-[#D1D1D1] text-[13px]">
              <Link
                to="/auth/login"
                className="flex flex-1 items-center justify-center text-[#616161] transition-colors hover:text-[#242424]"
              >
                Masuk
              </Link>
              <span className="flex flex-1 items-center justify-center border-b-2 border-[#21AC3A] font-semibold text-[#21AC3A]">
                Daftar
              </span>
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
              <div className="flex flex-col gap-1.25">
                <label htmlFor="name" className="text-[13px] font-semibold text-[#242424]">
                  Nama pengguna
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="username"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: John Doe"
                  className="h-9.5 w-full border border-[#A19F9D] bg-white px-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                />
              </div>

              <div className="flex flex-col gap-1.25">
                <label htmlFor="email" className="text-[13px] font-semibold text-[#242424]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="h-9.5 w-full border border-[#A19F9D] bg-white px-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                />
              </div>

              <div className="flex flex-col gap-1.25">
                <label htmlFor="phone" className="text-[13px] font-semibold text-[#242424]">
                  Nomor handphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="081234567890"
                  className="h-9.5 w-full border border-[#A19F9D] bg-white px-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                />
              </div>

              <div className="flex flex-col gap-1.25">
                <label htmlFor="password" className="text-[13px] font-semibold text-[#242424]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Buat password"
                    className="h-9.5 w-full border border-[#A19F9D] bg-white px-2.5 pr-10 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
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
                <p className="text-[11px] leading-[1.35] text-[#8A8886]">Minimal 6 karakter.</p>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="mt-1 flex h-9 w-full items-center justify-center border border-[#21AC3A] bg-[#21AC3A] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? 'Memproses...' : 'Buat akun'}
              </motion.button>
            </motion.form>

            <div className="mt-5 flex justify-center gap-1.5 text-[13px]">
              <span className="text-[#616161]">Sudah punya akun?</span>
              <Link to="/auth/login" className="font-semibold text-[#21AC3A] hover:underline">
                Masuk
              </Link>
            </div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
