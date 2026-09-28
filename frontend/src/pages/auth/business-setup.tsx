import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Info,
  Locate,
  LogOut,
  MapPin,
  ShieldCheck,
  Store,
  Zap,
} from 'lucide-react';
import { Map, Marker } from 'pigeon-maps';

type SetupStep = 'business' | 'plan';
type Plan = 'UMKM' | 'Enterprise';

const plans: { id: Plan; price: number; description: string; features: string[] }[] = [
  {
    id: 'UMKM',
    price: 29000,
    description: 'Untuk usaha kecil yang ingin merapikan operasional.',
    features: ['Kasir dan transaksi digital', 'Manajemen stok real-time', 'Laporan penjualan'],
  },
  {
    id: 'Enterprise',
    price: 149000,
    description: 'Untuk bisnis yang berkembang dan mengelola banyak tim.',
    features: ['Semua fitur UMKM', 'Manajemen pelanggan dan loyalitas', 'Manajemen karyawan'],
  },
];

const subscriptionDurations = [
  { label: '1 bulan', months: 1 },
  { label: '3 bulan', months: 3 },
  { label: '6 bulan', months: 6 },
  { label: '1 tahun', months: 12 },
  { label: '2 tahun', months: 24 },
];

const formatIDR = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

async function fetchUserBusinesses(): Promise<unknown[]> {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const response = await fetch('/api/business', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Data bisnis belum dapat diperiksa.');
  }

  return Array.isArray(data.businesses) ? data.businesses : [];
}

function SetupHeader() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/auth/login', { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-[#252525] px-6 text-white">
      <Link to="/onboarding" className="flex items-center gap-3" aria-label="Simpl beranda">
        <img src="/simpl-logo-light.png" alt="Simpl" className="h-7 w-auto object-contain" />
        <span className="hidden border-l border-white/20 pl-3 text-[13px] text-[#B8B8B8] sm:inline">
          Pengaturan bisnis
        </span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 text-[13px] text-[#D1D1D1] transition-colors hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Keluar
      </button>
    </header>
  );
}

function SetupProgress({ step }: { step: SetupStep }) {
  const activeStep = step === 'business' ? 2 : 3;
  const steps = ['Akun', 'Bisnis', 'Paket', 'Siap'];

  return (
    <ol className="flex w-full items-center" aria-label="Tahapan pengaturan">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = number < activeStep;
        const active = number === activeStep;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                complete || active
                  ? 'bg-[#21AC3A] text-white'
                  : 'border border-[#D1D1D1] bg-white text-[#616161]'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : number}
            </span>
            <span
              className={`hidden truncate text-[13px] sm:inline ${
                active ? 'font-semibold text-[#242424]' : complete ? 'text-[#616161]' : 'text-[#8A8886]'
              }`}
            >
              {label}
            </span>
            {index < steps.length - 1 && (
              <span className={`h-px min-w-3 flex-1 ${complete ? 'bg-[#21AC3A]' : 'bg-[#D1D1D1]'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SetupGuidance({ step }: { step: SetupStep }) {
  const checks = [
    { label: 'Akun terverifikasi', complete: true },
    { label: 'Detail bisnis', complete: step === 'plan' },
    { label: 'Pilih paket layanan', complete: false, active: step === 'plan' },
    { label: 'Mulai gunakan Simpl', complete: false },
  ];
  const completedCount = step === 'plan' ? 2 : 1;

  return (
    <aside className="flex flex-col gap-3.5">
      <section className="border border-[#D1D1D1] bg-white p-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.07)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#242424]">Kesiapan pengaturan</h2>
          <span className="bg-[#EAF7EC] px-2 py-0.5 text-[11px] font-semibold text-[#176B2A]">
            {completedCount} dari 4
          </span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden bg-[#F0F0F0]">
          <motion.div
            className="h-full bg-[#21AC3A]"
            initial={{ width: '0%' }}
            animate={{ width: `${completedCount * 25}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
        <ul className="space-y-3">
          {checks.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-[13px]">
              {item.complete ? (
                <Check className="h-4 w-4 text-[#21AC3A]" />
              ) : item.active ? (
                <span className="h-4 w-4 rounded-full border-2 border-[#21AC3A]" />
              ) : (
                <Circle className="h-4 w-4 text-[#A19F9D]" />
              )}
              <span className={item.complete || item.active ? 'text-[#242424]' : 'text-[#8A8886]'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default function BusinessSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>('business');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [isLocating, setIsLocating] = useState(false);
  const [mapError, setMapError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan>('UMKM');
  const [durationMonths, setDurationMonths] = useState(1);
  const [isCheckingBusinesses, setIsCheckingBusinesses] = useState(true);
  const [businessCheckError, setBusinessCheckError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const checkExistingBusinesses = async () => {
      try {
        const businesses = await fetchUserBusinesses();
        if (isActive && businesses.length > 0) {
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        if (isActive) {
          setBusinessCheckError(
            error instanceof Error ? error.message : 'Data bisnis belum dapat diperiksa.',
          );
        }
      } finally {
        if (isActive) {
          setIsCheckingBusinesses(false);
        }
      }
    };

    void checkExistingBusinesses();
    return () => {
      isActive = false;
    };
  }, [navigate]);

  const handleRetryBusinessCheck = async () => {
    setIsCheckingBusinesses(true);
    setBusinessCheckError('');

    try {
      const businesses = await fetchUserBusinesses();
      if (businesses.length > 0) {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setBusinessCheckError(
        error instanceof Error ? error.message : 'Data bisnis belum dapat diperiksa.',
      );
    } finally {
      setIsCheckingBusinesses(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    );
    if (!response.ok) {
      throw new Error('Alamat untuk titik tersebut tidak dapat ditemukan.');
    }
    const data: { display_name?: string } = await response.json();
    if (data.display_name) {
      setAddress(data.display_name);
    }
  };

  const handleMapClick = async ({ latLng }: { latLng: [number, number] }) => {
    setMapPosition(latLng);
    setMapError('');
    try {
      await reverseGeocode(latLng[0], latLng[1]);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Alamat tidak dapat ditemukan.');
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError('Browser Anda tidak mendukung layanan lokasi. Klik peta untuk memilih pin.');
      return;
    }

    setIsLocating(true);
    setMapError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.latitude, coords.longitude];
        setMapPosition(position);
        setMapCenter(position);
        void reverseGeocode(position[0], position[1])
          .catch((error: unknown) => {
            setMapError(error instanceof Error ? error.message : 'Alamat tidak dapat ditemukan.');
          })
          .finally(() => setIsLocating(false));
      },
      () => {
        setMapError('Lokasi tidak tersedia. Aktifkan izin lokasi atau klik peta untuk memilih pin.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleContinueToPlan = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (!businessName.trim()) {
      setErrorMessage('Nama bisnis wajib diisi.');
      return;
    }
    setStep('plan');
  };

  const handleCreateBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        navigate('/auth/login', { replace: true });
        return;
      }

      const response = await fetch('/api/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: businessName.trim(),
          address: address.trim(),
          plan: selectedPlan,
          duration_months: durationMonths,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bisnis belum dapat dibuat. Silakan coba lagi.');
      }

      if (data.snap_token && window.snap) {
        window.snap.pay(data.snap_token, {
          onSuccess: () => navigate('/dashboard', { replace: true }),
          onPending: () => navigate('/dashboard', { replace: true }),
          onError: () => navigate('/dashboard', { replace: true }),
          onClose: () => navigate('/dashboard', { replace: true }),
        });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlanDetails = plans.find((plan) => plan.id === selectedPlan)!;
  const selectedDuration = subscriptionDurations.find((duration) => duration.months === durationMonths)!;

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5] font-sans text-[#242424]">
      <SetupHeader />

      {isCheckingBusinesses ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex items-center gap-3 text-sm text-[#616161]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#D1D1D1] border-t-[#21AC3A]" />
            Memeriksa bisnis pada akun Anda...
          </div>
        </main>
      ) : businessCheckError ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <section className="w-full max-w-md border border-[#D1D1D1] bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Belum dapat memeriksa bisnis</h1>
            <p className="mt-2 text-sm text-[#616161]">{businessCheckError}</p>
            <button
              type="button"
              onClick={() => {
                void handleRetryBusinessCheck();
              }}
              className="mt-5 bg-[#21AC3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d9732]"
            >
              Coba lagi
            </button>
          </section>
        </main>
      ) : (
        <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1080px] flex-col items-center gap-7">
            <SetupProgress step={step} />

            <AnimatePresence mode="wait">
              {step === 'business' ? (
                <motion.div
                  key="business-step"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="grid w-full gap-5 lg:grid-cols-[minmax(0,720px)_minmax(260px,1fr)]"
                >
                  <section className="flex flex-col border border-[#D1D1D1] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.07)]">
                    <div className="border-b border-[#D1D1D1] p-5 sm:p-[22px]">
                      <h1 className="text-2xl font-semibold">Buat bisnis Anda</h1>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#616161]">
                        Informasi ini akan tampil pada struk dan laporan. Anda bisa mengubahnya nanti.
                      </p>
                    </div>

                    <form onSubmit={handleContinueToPlan} className="flex flex-1 flex-col">
                      <div className="flex-1 space-y-5 p-5 sm:p-[22px]">
                        {errorMessage && (
                          <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {errorMessage}
                          </p>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="business-name" className="text-[13px] font-semibold">
                            Nama bisnis <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="business-name"
                            type="text"
                            required
                            autoComplete="organization"
                            value={businessName}
                            onChange={(event) => setBusinessName(event.target.value)}
                            placeholder="Contoh: Toko Sumber Makmur"
                            className="h-9 w-full border border-[#A19F9D] px-2.5 text-[13px] outline-none placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="business-address" className="text-[13px] font-semibold">
                            Alamat cabang utama
                          </label>
                          <textarea
                            id="business-address"
                            rows={3}
                            autoComplete="street-address"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="Masukkan alamat toko atau kantor Anda"
                            className="w-full resize-y border border-[#A19F9D] px-2.5 py-2 text-[13px] outline-none placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                          />
                          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-[#616161]">Klik peta untuk menempatkan pin cabang utama.</p>
                            <button
                              type="button"
                              onClick={handleUseCurrentLocation}
                              disabled={isLocating}
                              className="flex h-8 items-center justify-center gap-2 border border-[#D1D1D1] px-3 text-xs font-semibold text-[#242424] transition-colors hover:border-[#21AC3A] hover:text-[#21AC3A] disabled:cursor-wait disabled:opacity-60"
                            >
                              {isLocating ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#D1D1D1] border-t-[#21AC3A]" />
                              ) : (
                                <Locate className="h-4 w-4" />
                              )}
                              Gunakan lokasi saya
                            </button>
                          </div>
                          <div className="relative z-0 mt-3 h-64 w-full overflow-hidden border border-[#D1D1D1]">
                            <Map height={256} center={mapCenter} defaultZoom={13} onClick={handleMapClick}>
                              {mapPosition && <Marker width={40} anchor={mapPosition} />}
                            </Map>
                          </div>
                          {mapPosition && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-[#616161]">
                              <MapPin className="h-3.5 w-3.5 text-[#21AC3A]" />
                              Pin cabang utama telah dipilih.
                            </p>
                          )}
                          {mapError && (
                            <p role="status" className="mt-2 text-xs text-amber-700">{mapError}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-2.5 border-l-[3px] border-[#21AC3A] bg-[#EAF7EC] p-3 text-[13px] leading-relaxed">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#21AC3A]" />
                          <span>
                            Mata uang akan menggunakan Rupiah (IDR). Cabang utama dibuat otomatis saat bisnis disimpan.
                          </span>
                        </div>
                      </div>

                      <div className="flex h-[58px] items-center justify-between border-t border-[#D1D1D1] px-5 sm:px-[22px]">
                        <span className="text-xs text-[#616161]">Langkah 1 dari 2</span>
                        <button
                          type="submit"
                          className="flex h-9 items-center gap-2 bg-[#21AC3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d9732]"
                        >
                          Lanjutkan
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  </section>

                  <SetupGuidance step={step} />
                </motion.div>
              ) : (
                <motion.div
                  key="plan-step"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="w-full max-w-[1080px]"
                >
                  <div className="mb-5 text-center">
                    <h1 className="text-2xl font-semibold">Pilih paket layanan</h1>
                    <p className="mt-1.5 text-[13px] text-[#616161]">
                      Kasir dan manajemen stok sudah termasuk di semua paket. Anda bisa mengubah paket nanti.
                    </p>
                  </div>

                  <fieldset className="mb-4">
                    <legend className="mb-2 text-center text-[13px] font-semibold text-[#242424]">
                      Masa berlangganan
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {subscriptionDurations.map((duration) => {
                        const selected = durationMonths === duration.months;
                        return (
                          <button
                            key={duration.months}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setDurationMonths(duration.months)}
                            className={`border px-3 py-2 text-[13px] transition-colors ${
                              selected
                                ? 'border-[#21AC3A] bg-[#EAF7EC] font-semibold text-[#176B2A]'
                                : 'border-[#D1D1D1] bg-white text-[#616161] hover:border-[#21AC3A]'
                            }`}
                          >
                            {duration.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <form onSubmit={handleCreateBusiness}>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-[18px]">
                      {plans.map((plan) => {
                        const selected = selectedPlan === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlan(plan.id)}
                            aria-pressed={selected}
                            className={`relative flex min-h-[340px] flex-col border bg-white p-5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.07)] transition-colors sm:p-6 ${
                              selected ? 'border-2 border-[#21AC3A]' : 'border-[#D1D1D1] hover:border-[#A19F9D]'
                            }`}
                          >
                            {selected && (
                              <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#21AC3A] text-white">
                                <Check className="h-4 w-4" />
                              </span>
                            )}
                            <span className="mb-4 flex h-9 w-9 items-center justify-center rounded bg-[#EAF7EC] text-[#21AC3A]">
                              {plan.id === 'UMKM' ? <Store className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                            </span>
                            <span className="text-lg font-semibold">{plan.id}</span>
                            <span className="mt-1 min-h-10 text-[13px] leading-relaxed text-[#616161]">
                              {plan.description}
                            </span>
                            <span className="mt-5 text-2xl font-semibold">
                              {formatIDR(plan.price)}
                              <span className="ml-1 text-[13px] font-normal text-[#616161]">/ bulan</span>
                            </span>
                            <span className="mt-1 text-[11px] text-[#616161]">
                              Masa berlangganan: {selectedDuration.label}
                            </span>
                            <span className="my-5 h-px w-full bg-[#D1D1D1]" />
                            <span className="mb-3 text-[13px] font-semibold">Fitur paket</span>
                            <span className="flex flex-col gap-3">
                              {plan.features.map((feature) => (
                                <span key={feature} className="flex items-start gap-2 text-[13px] text-[#616161]">
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#21AC3A]" />
                                  <span>{feature}</span>
                                </span>
                              ))}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-col gap-4 border-t border-[#D1D1D1] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div>
                        <p className="text-[11px] text-[#616161]">{businessName}</p>
                        <p className="text-sm text-[#616161]">
                          Total untuk {selectedDuration.label}
                        </p>
                        <p className="text-xl font-semibold text-[#21AC3A]">
                          {formatIDR(selectedPlanDetails.price * durationMonths)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage('');
                            setStep('business');
                          }}
                          className="flex h-9 items-center gap-1.5 border border-[#A19F9D] bg-white px-3 text-[13px] font-semibold text-[#242424] hover:bg-[#F5F5F5]"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Kembali
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex h-9 items-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 text-[13px] font-semibold text-white hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmitting ? 'Memproses...' : 'Lanjut ke pembayaran'}
                          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {errorMessage && (
                      <p role="alert" className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {errorMessage}
                      </p>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      )}

      <footer className="flex items-center justify-center gap-2 border-t border-[#D1D1D1] bg-white px-5 py-4 text-[11px] text-[#616161]">
        <ShieldCheck className="h-4 w-4 text-[#21AC3A]" />
        Pembayaran aman · Harga dalam Rupiah (IDR)
      </footer>
    </div>
  );
}
