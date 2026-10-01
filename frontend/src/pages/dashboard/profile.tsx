import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Save, LogOut } from 'lucide-react';
import { isValidIndonesianMobilePhone } from '../../utils/phone';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      navigate('/auth/login');
      return () => { isActive = false; };
    }

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat profil');
        if (!isActive) return;

        setProfile(data.user);
        setUsername(data.user.username || '');
        setEmail(data.user.email || '');
        setPhone(data.user.phone || '');
      } catch (err: unknown) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan';
        setErrorMessage(message);
        if (message.includes('token') || message.includes('auth')) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          navigate('/auth/login');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadProfile();
    return () => { isActive = false; };
  }, [navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (phone.trim() && !isValidIndonesianMobilePhone(phone)) {
      setErrorMessage('Masukkan nomor handphone Indonesia yang valid, misalnya 081234567890 atau +6281234567890.');
      return;
    }
    setIsSaving(true);
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, email, phone })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui profil');
      }
      
      setSuccessMessage('Profil berhasil diperbarui!');
      setProfile(data.user);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/auth/login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]" role="status">
        <div className="h-8 w-8 animate-spin border-2 border-[#21AC3A] border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Memuat profil</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-[#242424]">
      <header className="sticky top-0 z-50 h-14 border-b border-[#D1D1D1] bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/dashboard" className="flex shrink-0 items-center border-r border-[#D1D1D1] pr-3" aria-label="SIMPL dashboard">
              <img src="/simpl-logo-dark.png" alt="SIMPL" className="h-7 w-auto object-contain" />
            </Link>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <Link to="/dashboard" className="text-[#616161] transition-colors hover:text-[#21AC3A]">Dashboard</Link>
              <span className="text-[#A3A3A3]">/</span>
              <span className="font-semibold text-[#242424]">Profil</span>
            </div>
            <span className="truncate text-sm font-semibold text-[#242424] sm:hidden">Profil akun</span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-2 border border-[#D1D1D1] px-3 text-[13px] font-medium text-[#616161] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-6 border-b border-[#D1D1D1] pb-5 sm:mb-7">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#1B9331]">Pengaturan akun</p>
          <h1 className="text-[26px] font-semibold leading-9 text-[#242424] sm:text-[28px]">Profil Saya</h1>
          <p className="mt-1 text-[13px] text-[#616161]">Kelola informasi yang digunakan untuk akun SIMPL Anda.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
          <aside className="h-fit overflow-hidden border border-[#D1D1D1] bg-white">
            <div className="border-b border-[#D1D1D1] bg-[#F0F0F0] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#242424]">Ringkasan akun</h2>
              <p className="mt-1 text-xs text-[#616161]">Informasi pengguna saat ini</p>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#EAF7EC] text-base font-semibold uppercase text-[#16852B]">
                  {profile?.username?.slice(0, 2) || 'US'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#242424]">{profile?.username || 'Pengguna'}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#16852B]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#21AC3A]" /> Akun aktif
                  </span>
                </div>
              </div>
              <div className="mt-5 space-y-4 border-t border-[#E5E5E5] pt-4">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#8A8A8A]" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#8A8A8A]">Email terdaftar</p>
                    <p className="mt-0.5 break-all text-xs font-medium text-[#3D3D3D]">{profile?.email || 'Belum diatur'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#8A8A8A]" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#8A8A8A]">Nomor telepon</p>
                    <p className="mt-0.5 text-xs font-medium text-[#3D3D3D]">{profile?.phone || 'Belum diatur'}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0 border border-[#D1D1D1] bg-white">
            <div className="flex items-start gap-3 border-b border-[#D1D1D1] px-5 py-4 sm:px-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#EAF7EC] text-[#21AC3A]">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#242424]">Informasi pribadi</h2>
                <p className="mt-1 text-xs text-[#616161]">Perbarui nama pengguna, email, atau nomor telepon Anda.</p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700"
                >
                  {errorMessage}
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="mb-5 border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700"
                >
                  {successMessage}
                </motion.div>
              )}

              <form onSubmit={handleUpdate} className="max-w-2xl space-y-5">
                <div>
                  <label htmlFor="profile-username" className="mb-1.5 block text-[13px] font-semibold text-[#242424]">Username</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                    <input
                      id="profile-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-email" className="mb-1.5 block text-[13px] font-semibold text-[#242424]">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                    <input
                      id="profile-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-phone" className="mb-1.5 block text-[13px] font-semibold text-[#242424]">Nomor telepon</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                    <input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      className="h-10 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#8A8A8A]">Gunakan nomor aktif dengan kode negara Indonesia jika diperlukan.</p>
                </div>

                <div className="flex justify-end border-t border-[#D1D1D1] pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-10 items-center gap-2 bg-[#21AC3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1B9331] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <span className="h-4 w-4 animate-spin border-2 border-white border-t-transparent" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Simpan perubahan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
