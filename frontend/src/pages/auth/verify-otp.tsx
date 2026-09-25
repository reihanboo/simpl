import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/auth/login');
    }
  }, [email, navigate]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!otpCode || otpCode.length !== 6) {
      setErrorMessage('Masukkan 6 digit kode OTP yang valid.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email,
          otp_code: otpCode 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verifikasi gagal. Pastikan kode OTP benar.');
      }

      // Automatically login user using the returned token
      localStorage.setItem('token', data.token);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengirim ulang OTP.');
      }

      setSuccessMessage('Kode OTP baru telah dikirim ke email Anda.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden font-sans text-slate-900">
      <div className="absolute top-0 left-0 w-full h-1 bg-[#21AC3A]" />
      <div className="absolute top-12 left-10 w-96 h-96 bg-[#21AC3A]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl -z-10 pointer-events-none" />

      <header className="p-6 max-w-7xl w-full mx-auto flex justify-between items-center">
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#21AC3A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Login</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src="/simpl-logo-dark.png" alt="SIMPL Logo" className="h-6 object-contain" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 my-4">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden p-8 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Verifikasi Email</h1>
              <p className="text-slate-500 text-sm">
                Kami telah mengirimkan 6-digit kode OTP ke <strong>{email}</strong>.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold text-center">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 text-center">
                  Kode Verifikasi (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] text-2xl py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full bg-[#21AC3A] hover:bg-[#1b8c2f] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex justify-center items-center h-[52px]"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <span>Verifikasi & Masuk</span>
                )}
              </button>
              
              <div className="mt-6 text-center text-sm text-slate-500">
                Belum menerima kode?{' '}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="font-bold text-[#21AC3A] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Mengirim ulang...' : 'Kirim Ulang OTP'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} SIMPL — Scalable Integrated Management System.
      </footer>
    </div>
  );
}
