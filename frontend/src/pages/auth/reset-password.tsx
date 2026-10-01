import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!token) {
      setErrorMessage('Token reset password tidak valid.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password harus memiliki minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mereset password.');
      }

      setSuccessMessage(data.message || 'Password berhasil direset! Mengarahkan ke halaman login...');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/auth/login');
      }, 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#F3F5F7] px-5 py-10 font-sans text-[#242424] sm:py-12">
      <main className="my-auto flex w-full flex-1 items-center justify-center py-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-110 border border-[#D1D1D1] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:p-10"
        >
          <div className="mb-7 flex items-center justify-between gap-3">
            <img src="/simpl-logo-dark.png" alt="SIMPL" className="h-6 w-auto object-contain" />
            <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#616161] transition-colors hover:text-[#21AC3A]">
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke login
            </Link>
          </div>

          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#EAF7EC] text-[#21AC3A]">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1B9331]">Keamanan akun</p>
              <h1 className="text-2xl font-semibold leading-tight text-[#242424]">Atur ulang password</h1>
            </div>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-[#616161]">Buat password baru untuk mengamankan akun SIMPL Anda.</p>

          {(errorMessage || !token) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage || 'Token reset password tidak valid atau tidak ditemukan.'}
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="mb-5 border border-[#B7E2BF] bg-[#EAF7EC] p-3 text-sm text-[#176B2A]"
            >
              {successMessage}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="new-password" className="text-[13px] font-semibold text-[#242424]">Password baru</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                  className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-11 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                  disabled={!token || !!successMessage}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-[#8A8A8A] transition-colors hover:text-[#242424] disabled:cursor-not-allowed"
                  disabled={!token || !!successMessage}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#8A8A8A]">Gunakan setidaknya 6 karakter.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-password" className="text-[13px] font-semibold text-[#242424]">Konfirmasi password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  minLength={6}
                  className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                  disabled={!token || !!successMessage}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token || !!successMessage}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:border-[#D1D1D1] disabled:bg-[#E5E5E5] disabled:text-[#8A8886]"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin border-2 border-white/40 border-t-white" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                'Simpan password baru'
              )}
            </button>
          </form>
        </motion.section>
      </main>

      <footer className="flex w-full max-w-110 flex-col items-center gap-2 pt-6 text-center text-xs text-[#605E5C]">
        <div className="flex items-center gap-1.5 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-[#21AC3A]" /> SIMPL</div>
        <span>© {new Date().getFullYear()} SIMPL. Hak cipta dilindungi.</span>
      </footer>
    </div>
  );
}
