import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, ShieldCheck } from 'lucide-react';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [otpCode, setOtpCode] = useState('');
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [localPart, domain] = email.split('@');
  const maskedEmail = domain
    ? `${localPart.slice(0, 1)}${'*'.repeat(Math.max(3, Math.min(localPart.length - 1, 5)))}@${domain}`
    : email;

  useEffect(() => {
    if (!email) {
      navigate('/auth/login');
    }
  }, [email, navigate]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!/^\d{6}$/.test(otpCode)) {
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
          otp_code: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verifikasi gagal. Pastikan kode OTP benar.');
      }

      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
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

      setOtpCode('');
      setSuccessMessage('Kode OTP baru telah dikirim ke email Anda.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#F3F5F7] px-5 py-15 font-sans text-[#242424]">
      <main className="my-auto flex w-full flex-1 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-110 rounded border border-[#E0E0E0] bg-white p-7 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sm:p-11"
        >
          <div className="mb-7 flex items-center gap-2">
            <img src="/simpl-logo-dark.png" alt="Simpl" className="h-6 w-auto object-contain" />
          </div>

          <div className="mb-7 flex flex-col gap-3">
            <h1 className="text-2xl font-semibold leading-tight text-[#242424]">
              Verifikasi identitas
            </h1>
            <p className="text-sm leading-normal text-[#605E5C]">
              Untuk mengamankan akun Simpl Anda, masukkan kode 6 digit yang kami kirim ke{' '}
              <strong className="font-semibold text-[#242424]">{maskedEmail}</strong>.
            </p>
          </div>

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

          <form onSubmit={handleVerifyOtp}>
            <div className="mb-7 flex flex-col gap-2">
              <label htmlFor="otp-code" className="text-[13px] font-semibold text-[#242424]">
                Kode verifikasi
              </label>
              <div className="relative flex w-full justify-center gap-2 sm:gap-2.5" onClick={() => otpInputRef.current?.focus()}>
                <input
                  ref={otpInputRef}
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrorMessage('');
                  }}
                  onFocus={() => setIsOtpFocused(true)}
                  onBlur={() => setIsOtpFocused(false)}
                  aria-label="Kode verifikasi 6 digit"
                  className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                />
                {Array.from({ length: 6 }, (_, index) => {
                  const isActive = isOtpFocused && index === Math.min(otpCode.length, 5);
                  return (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`relative flex h-13 min-w-0 max-w-11.5 flex-1 items-center justify-center rounded-sm border bg-white text-xl font-semibold text-[#242424] ${
                        isActive ? 'border-2 border-[#21AC3A]' : 'border-[#D2D0CE]'
                      }`}
                    >
                      {otpCode[index] || ''}
                      {isActive && otpCode.length < 6 && (
                        <span className="absolute h-4.5 w-px animate-pulse bg-[#21AC3A]" />
                      )}
                    </span>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#605E5C]">
                Kode berlaku selama 10 menit. Periksa folder spam jika belum diterima.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <motion.button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                whileHover={otpCode.length === 6 && !isLoading ? { y: -1 } : undefined}
                whileTap={otpCode.length === 6 && !isLoading ? { scale: 0.99 } : undefined}
                className="flex h-10 w-full items-center justify-center rounded-sm border border-[#21AC3A] bg-[#21AC3A] text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:border-[#D1D1D1] disabled:bg-[#E5E5E5] disabled:text-[#8A8886]"
              >
                {isLoading ? (
                  <motion.span
                    aria-label="Memverifikasi"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="h-5 w-5 border-2 border-white/40 border-t-white"
                  />
                ) : (
                  'Verifikasi'
                )}
              </motion.button>

              <div className="flex items-center justify-between gap-3 text-[13px]">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-left text-[#21AC3A] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending ? 'Mengirim ulang...' : 'Kirim ulang kode'}
                </button>
                <Link to="/auth/login" className="text-right text-[#605E5C] hover:text-[#242424]">
                  Kembali ke login
                </Link>
              </div>
            </div>
          </form>

          <div className="mt-7 flex items-start gap-2 rounded bg-[#F3F5F7] p-3 text-xs leading-relaxed text-[#605E5C]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#21AC3A]" />
            <span>Jangan bagikan kode ini kepada siapa pun. Simpl tidak akan pernah memintanya.</span>
          </div>
        </motion.div>
      </main>

      <footer className="flex w-full max-w-110 flex-col items-center gap-2 pt-6 text-center text-xs text-[#605E5C]">
        <div className="flex items-center gap-1.5 font-semibold">
          <Package className="h-3.5 w-3.5 text-[#21AC3A]" />
          <span>Simpl</span>
        </div>
        <span>© {new Date().getFullYear()} Simpl. Hak cipta dilindungi.</span>
        <div className="flex gap-4 pt-1">
          <span>Ketentuan penggunaan</span>
          <span>Privasi</span>
        </div>
      </footer>
    </div>
  );
}
