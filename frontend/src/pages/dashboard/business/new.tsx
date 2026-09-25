import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Store, Crown, Check, ArrowLeft, MapPin, Locate } from 'lucide-react';
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <h1 className="text-3xl font-bold text-slate-900">Buat Bisnis Baru</h1>
        <p className="text-slate-500 mt-2">Tambahkan bisnis baru ke dalam akun Anda untuk mulai mengelola cabang dan produk.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Nama Bisnis</label>
            <p className="text-sm text-slate-500 mb-3">Masukkan nama resmi atau nama toko bisnis Anda.</p>
            <input
              type="text"
              required
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="Contoh: Supermarket Jaya"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Lokasi Cabang Utama</label>
            <p className="text-sm text-slate-500 mb-3">Masukkan alamat cabang atau gunakan GPS untuk melacak posisi Anda saat ini.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MapPin className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Sudirman No. 1, Jakarta"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLoadingLocation}
                className="px-4 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#21AC3A] hover:border-[#21AC3A] rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoadingLocation ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-[#21AC3A] rounded-full animate-spin"></div>
                ) : (
                  <Locate className="w-5 h-5" />
                )}
                <span>Lacak Lokasi</span>
              </button>
            </div>
            
            <div className="mt-4 h-64 w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
              <Map 
                height={256} 
                center={mapCenter} 
                defaultZoom={13} 
                onClick={handleMapClick}
              >
                {mapPosition && <Marker width={40} anchor={mapPosition} />}
              </Map>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Pilih Paket</label>
            <p className="text-sm text-slate-500 mb-4">Pilih paket langganan yang sesuai dengan kebutuhan skala bisnis Anda.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div
                onClick={() => setNewBusinessPlan('UMKM')}
                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${newBusinessPlan === 'UMKM' ? 'border-[#21AC3A] bg-[#21AC3A]/5' : 'border-slate-100 bg-white hover:border-slate-200'}`}
              >
                {newBusinessPlan === 'UMKM' && (
                  <div className="absolute top-4 right-4 text-[#21AC3A]">
                    <Check className="w-5 h-5" />
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <Store className="w-6 h-6" />
                </div>
                <div className="font-bold text-lg text-slate-900 mb-1">UMKM</div>
                <div className="text-sm text-slate-500 font-medium mb-4">Mulai dari Rp 29.000/bln</div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Point of Sales (POS)</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Manajemen Stok Dasar</span>
                  </li>
                </ul>
              </div>

              <div
                onClick={() => setNewBusinessPlan('Enterprise')}
                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${newBusinessPlan === 'Enterprise' ? 'border-[#21AC3A] bg-[#21AC3A]/5' : 'border-slate-100 bg-white hover:border-slate-200'}`}
              >
                {newBusinessPlan === 'Enterprise' && (
                  <div className="absolute top-4 right-4 text-[#21AC3A]">
                    <Check className="w-5 h-5" />
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  <Crown className="w-6 h-6" />
                </div>
                <div className="font-bold text-lg text-slate-900 mb-1">Enterprise</div>
                <div className="text-sm text-slate-500 font-medium mb-4">Mulai dari Rp 149.000/bln</div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Semua fitur UMKM</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Customer Management (CRM)</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Employee Management (HR)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Durasi Langganan</label>
            <p className="text-sm text-slate-500 mb-4">Pilih berapa lama Anda ingin berlangganan (bayar di muka).</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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
                  onClick={() => setDurationMonths(opt.value)}
                  className={`py-2 px-1 text-center rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                    durationMonths === opt.value
                      ? 'border-[#21AC3A] bg-[#21AC3A] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-[#21AC3A]">
                Rp {((newBusinessPlan === 'UMKM' ? 29000 : 149000) * durationMonths).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newBusinessName.trim() || !address.trim() || isSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#21AC3A] hover:bg-[#1d9732] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shadow-sm shadow-[#21AC3A]/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Buat Bisnis</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
