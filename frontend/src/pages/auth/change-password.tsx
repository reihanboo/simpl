import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getAuthenticatedDestination } from '../../utils/auth-routing';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('must_change_password');
    sessionStorage.removeItem('must_change_password');
    navigate('/auth/login', { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    if (newPassword.length < 8) {
      setErrorMessage('Kata sandi baru harus memiliki minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      navigate('/auth/login', { replace: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Kata sandi belum dapat diperbarui.');

      localStorage.removeItem('must_change_password');
      sessionStorage.removeItem('must_change_password');
      navigate(await getAuthenticatedDestination(token), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-900">
      <main className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="text-sm font-bold tracking-wide text-[#16852B]">SIMPL</span>
        <div className="mt-6 flex h-12 w-12 items-center justify-center bg-emerald-50 text-emerald-700">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Buat kata sandi baru</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Untuk keamanan akun pegawai, ganti kata sandi awal sebelum melanjutkan.
        </p>

        {errorMessage && <p role="alert" className="mt-5 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Kata sandi awal
            <input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 min-h-11 w-full border border-slate-300 px-3 py-2 outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Kata sandi baru
            <input required minLength={8} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 min-h-11 w-full border border-slate-300 px-3 py-2 outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Konfirmasi kata sandi baru
            <input required minLength={8} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 min-h-11 w-full border border-slate-300 px-3 py-2 outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan kata sandi baru'}
          </button>
        </form>
        <button type="button" onClick={handleLogout} className="mt-4 w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
          Keluar dari akun ini
        </button>
      </main>
    </div>
  );
}
