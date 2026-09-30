import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Silakan masukkan Email Anda.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengirim link. Silakan coba lagi.');
      }

      setSuccessMessage(data.message || 'Tautan reset password telah dikirim ke email Anda.');
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
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1B9331]">Pemulihan akun</p>
              <h1 className="text-2xl font-semibold leading-tight text-[#242424]">Lupa password?</h1>
            </div>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-[#616161]">
            Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang password.
          </p>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage}
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
              <label htmlFor="recovery-email" className="text-[13px] font-semibold text-[#242424]">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.com"
                  required
                  className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !!successMessage}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:border-[#D1D1D1] disabled:bg-[#E5E5E5] disabled:text-[#8A8886]"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin border-2 border-white/40 border-t-white" />
                  <span>Memproses...</span>
                </>
              ) : (
                'Kirim tautan reset'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-[#E5E5E5] pt-4 text-center text-xs text-[#616161]">
            Ingat password Anda? <Link to="/auth/login" className="font-semibold text-[#21AC3A] hover:underline">Masuk</Link>
          </div>
        </motion.section>
      </main>

      <footer className="flex w-full max-w-110 flex-col items-center gap-2 pt-6 text-center text-xs text-[#605E5C]">
        <div className="flex items-center gap-1.5 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-[#21AC3A]" /> SIMPL</div>
        <span>© {new Date().getFullYear()} SIMPL. Hak cipta dilindungi.</span>
      </footer>
    </div>
  );
}
