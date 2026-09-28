import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Store, Crown, Check, ArrowLeft, MapPin, Locate, Building2, CreditCard, Info, ShieldCheck } from 'lucide-react';
import { Map, Marker } from 'pigeon-maps';

declare global {
  interface Window {
    snap: any;
  }
}

export default function NewBusinessPage() {
  const navigate = useNavigate();
  const [newBusinessName, setNewBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [newBusinessPlan, setNewBusinessPlan] = useState('UMKM');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMapClick = async ({ latLng }: { latLng: [number, number] }) => {
    setMapPosition(latLng);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`);
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung layanan geolokasi.");
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setMapPosition([latitude, longitude]);
          setMapCenter([latitude, longitude]);
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          }
        } catch (error) {
          console.error("Error fetching address:", error);
          alert("Gagal mengambil alamat dari OpenStreetMap.");
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLoadingLocation(false);
        alert("Gagal mendapatkan lokasi Anda. Pastikan izin lokasi diberikan di browser Anda.");
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newBusinessName,
          address: address,
          plan: newBusinessPlan,
          duration_months: durationMonths
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create business');
      }

      if (data.snap_token) {
        window.snap.pay(data.snap_token, {
          onSuccess: function (result: any) {
            console.log('Payment success:', result);
            navigate('/dashboard');
          },
          onPending: function (result: any) {
            console.log('Payment pending:', result);
            navigate('/dashboard');
          },
          onError: function (result: any) {
            console.error('Payment error:', result);
            alert('Pembayaran gagal atau terjadi kesalahan.');
          },
          onClose: function () {
            console.log('Payment popup closed without finishing');
            // We can still navigate them back or show a warning
            navigate('/dashboard');
          }
        });
      } else {
        // Fallback if no snap token
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error creating business:', error);
      alert('Gagal membuat bisnis: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthlyPrice = newBusinessPlan === 'UMKM' ? 29000 : 149000;
  const totalPrice = monthlyPrice * durationMonths;

  return (
    <div className="mx-auto w-full max-w-[1440px] text-slate-900">
      <div className="mb-6 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#21AC3A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke dashboard</span>
        </button>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#21AC3A]/10 text-[#21AC3A]">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Manajemen bisnis / Pengaturan</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Buat bisnis baru</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Atur identitas, lokasi cabang utama, dan paket langganan untuk bisnis Anda.</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid items-start gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 xl:gap-6"
      >
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)]">
            <nav aria-label="Langkah pembuatan bisnis" className="h-fit border border-slate-200 bg-white p-4 xl:sticky xl:top-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Konfigurasi</p>
              <ol className="space-y-1">
                {[
                  { number: '01', label: 'Informasi bisnis', href: '#informasi-bisnis', active: true },
                  { number: '02', label: 'Lokasi utama', href: '#lokasi-utama', active: Boolean(address) },
                  { number: '03', label: 'Paket langganan', href: '#paket-langganan', active: true },
                  { number: '04', label: 'Durasi & pembayaran', href: '#durasi-langganan', active: true },
                ].map((step) => (
                  <li key={step.number}>
                    <button
                      type="button"
                      onClick={() => document.getElementById(step.href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-[#21AC3A] cursor-pointer"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[11px] font-semibold ${step.active ? 'border-[#21AC3A] bg-[#21AC3A] text-white' : 'border-slate-300 bg-white text-slate-500'}`}>
                        {step.number}
                      </span>
                      <span>{step.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                Informasi ini dapat diperbarui nanti melalui pengaturan bisnis.
              </div>
            </nav>

            <div className="min-w-0 space-y-5">
              <section id="informasi-bisnis" className="scroll-mt-4 border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-[#21AC3A]/10 text-xs font-bold text-[#21AC3A]">01</span>
                    <div>
                      <h2 className="font-semibold">Informasi bisnis</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Masukkan nama resmi atau nama toko bisnis Anda.</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <label htmlFor="business-name" className="mb-2 block text-sm font-medium text-slate-800">Nama bisnis <span className="text-red-600">*</span></label>
                  <input
                    id="business-name"
                    type="text"
                    required
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="Contoh: Supermarket Jaya"
                    className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#21AC3A] focus:outline-none focus:ring-1 focus:ring-[#21AC3A]"
                  />
                  <p className="mt-2 text-xs text-slate-500">Nama ini akan ditampilkan di dashboard dan laporan bisnis.</p>
                </div>
              </section>

              <section id="lokasi-utama" className="scroll-mt-4 border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-[#21AC3A]/10 text-xs font-bold text-[#21AC3A]">02</span>
                    <div>
                      <h2 className="font-semibold">Lokasi cabang utama</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Tentukan alamat awal bisnis. Anda dapat menambah cabang lain nanti.</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <label htmlFor="business-address" className="mb-2 block text-sm font-medium text-slate-800">Alamat <span className="text-red-600">*</span></label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="business-address"
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Contoh: Jl. Sudirman No. 1, Jakarta"
                        className="w-full border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#21AC3A] focus:outline-none focus:ring-1 focus:ring-[#21AC3A]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isLoadingLocation}
                      className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#21AC3A] hover:text-[#21AC3A] disabled:opacity-50 cursor-pointer"
                    >
                      {isLoadingLocation ? (
                        <span className="h-4 w-4 animate-spin border-2 border-slate-300 border-t-[#21AC3A]" />
                      ) : (
                        <Locate className="h-4 w-4" />
                      )}
                      <span>Gunakan lokasi saya</span>
                    </button>
                  </div>
                  <div className="relative z-0 mt-4 h-56 w-full overflow-hidden border border-slate-200 sm:h-64">
                    <Map height={256} center={mapCenter} defaultZoom={13} onClick={handleMapClick}>
                      {mapPosition && <Marker width={40} anchor={mapPosition} />}
                    </Map>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Pilih titik pada peta untuk mengisi alamat secara otomatis.</p>
                </div>
              </section>

              <section id="paket-langganan" className="scroll-mt-4 border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-[#21AC3A]/10 text-xs font-bold text-[#21AC3A]">03</span>
                    <div>
                      <h2 className="font-semibold">Paket langganan</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Pilih paket sesuai skala dan kebutuhan bisnis Anda.</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                  <button
                    type="button"
                    aria-pressed={newBusinessPlan === 'UMKM'}
                    onClick={() => setNewBusinessPlan('UMKM')}
                    className={`relative border p-4 text-left transition-colors cursor-pointer ${newBusinessPlan === 'UMKM' ? 'border-[#21AC3A] bg-[#21AC3A]/5 ring-1 ring-[#21AC3A]' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                  >
                    {newBusinessPlan === 'UMKM' && <Check className="absolute right-3 top-3 h-4 w-4 text-[#21AC3A]" />}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center bg-[#21AC3A]/10 text-[#21AC3A]"><Store className="h-5 w-5" /></span>
                      <div>
                        <div className="font-semibold">UMKM</div>
                        <div className="text-xs text-slate-500">Rp 29.000 / bulan</div>
                      </div>
                    </div>
                    <ul className="space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#21AC3A]" />Point of Sales (POS)</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#21AC3A]" />Manajemen stok dasar</li>
                    </ul>
                  </button>
                  <button
                    type="button"
                    aria-pressed={newBusinessPlan === 'Enterprise'}
                    onClick={() => setNewBusinessPlan('Enterprise')}
                    className={`relative border p-4 text-left transition-colors cursor-pointer ${newBusinessPlan === 'Enterprise' ? 'border-[#21AC3A] bg-[#21AC3A]/5 ring-1 ring-[#21AC3A]' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                  >
                    {newBusinessPlan === 'Enterprise' && <Check className="absolute right-3 top-3 h-4 w-4 text-[#21AC3A]" />}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center bg-[#21AC3A]/10 text-[#21AC3A]"><Crown className="h-5 w-5" /></span>
                      <div>
                        <div className="font-semibold">Enterprise</div>
                        <div className="text-xs text-slate-500">Rp 149.000 / bulan</div>
                      </div>
                    </div>
                    <ul className="space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#21AC3A]" />Semua fitur UMKM</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#21AC3A]" />Customer Management (CRM)</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#21AC3A]" />Employee Management (HR)</li>
                    </ul>
                  </button>
                </div>
              </section>

              <section id="durasi-langganan" className="scroll-mt-4 border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-[#21AC3A]/10 text-xs font-bold text-[#21AC3A]">04</span>
                    <div>
                      <h2 className="font-semibold">Durasi langganan</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Pilih durasi pembayaran di muka.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-5 sm:p-6">
                  {[
                    { label: '1 Bulan', value: 1 },
                    { label: '3 Bulan', value: 3 },
                    { label: '6 Bulan', value: 6 },
                    { label: '1 Tahun', value: 12 },
                    { label: '2 Tahun', value: 24 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={durationMonths === opt.value}
                      onClick={() => setDurationMonths(opt.value)}
                      className={`border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${durationMonths === opt.value ? 'border-[#21AC3A] bg-[#21AC3A] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#21AC3A]'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex flex-col-reverse justify-between gap-3 border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:px-6">
                <p className="text-xs text-slate-500"><span className="text-red-600">*</span> Wajib diisi</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => navigate('/dashboard')} className="border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">Batal</button>
                  <button
                    type="submit"
                    disabled={!newBusinessName.trim() || !address.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-2 bg-[#21AC3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? <><span className="h-4 w-4 animate-spin border-2 border-white/40 border-t-white" /><span>Memproses...</span></> : <span>Buat bisnis</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="border border-slate-200 border-t-2 border-t-[#21AC3A] bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <CreditCard className="h-4 w-4 text-[#21AC3A]" />
              <h2 className="text-sm font-semibold">Ringkasan pesanan</h2>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs text-slate-500">Nama bisnis</p>
                <p className="mt-1 break-words text-sm font-medium">{newBusinessName.trim() || 'Belum diisi'}</p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500">Paket terpilih</p>
                <p className="mt-1 text-sm font-semibold">{newBusinessPlan}</p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500">Durasi langganan</p>
                <p className="mt-1 text-sm font-medium">{durationMonths} bulan</p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-semibold text-[#21AC3A]">Rp {totalPrice.toLocaleString('id-ID')}</span>
                </div>
                <p className="mt-1 text-right text-xs text-slate-500">Pembayaran di muka</p>
              </div>
            </div>
          </section>
          <section className="border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#21AC3A]" />
              <div>
                <h3 className="text-sm font-semibold">Tentang paket</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Pilih paket yang sesuai. Detail paket dan durasi dapat ditinjau sebelum pembayaran.</p>
              </div>
            </div>
          </section>
          <div className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#21AC3A]" />
            Informasi bisnis Anda tersimpan dengan aman.
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
