import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import {
  Search,
  Plus,
  MapPin,
  X,
  Navigation,
  Edit2,
  Trash2,
  Lock
} from 'lucide-react';


interface BranchRecord {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number;
  timezone?: string;
}

interface DashboardOrganization {
  id: string;
  status?: string;
}

const formatPlanName = (plan?: string) => {
  if (!plan || plan === 'Unknown') return 'Tidak tersedia';

  const planName = plan.replace(/_monthly$/i, '').replace(/[_-]+/g, ' ').trim();
  if (planName.toLowerCase() === 'umkm') return 'UMKM';
  return planName.replace(/\b\w/g, (character) => character.toUpperCase());
};

export default function DashboardIndex() {
  const { activeOrg } = useOutletContext<{ activeOrg: DashboardOrganization }>();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchToDelete, setBranchToDelete] = useState<any>(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [sidebarWidth, setSidebarWidth] = useState(560);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.200000, 106.816666]);
  const [mapZoom, setMapZoom] = useState(13);
  const [hasBranchLocation, setHasBranchLocation] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [branchTimezone, setBranchTimezone] = useState('Asia/Jakarta');

  const isPending = activeOrg?.status === 'pending';
  const filteredBranches = branches.filter((branch) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || `${branch.name} ${branch.address || ''}`.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!activeOrg?.id) return;

    const fetchBranches = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`/api/branches?business_id=${activeOrg.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setBranches(data.branches || []);
        } else {
          console.error("Failed to fetch branches");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, [activeOrg?.id]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const resizeSidebar = (event: PointerEvent) => {
      const maxWidth = Math.min(960, window.innerWidth);
      const minWidth = Math.min(360, maxWidth);
      const nextWidth = window.innerWidth - event.clientX;
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    };
    const stopResizing = () => setIsResizingSidebar(false);

    window.addEventListener('pointermove', resizeSidebar);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);
    return () => {
      window.removeEventListener('pointermove', resizeSidebar);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isResizingSidebar]);

  const fetchAddressFromCoords = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setNewBranchAddress(data.display_name);
        }
      }
    } catch (err) {
      console.error("Gagal mendapatkan alamat:", err);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung geolokasi.");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setMapCenter([lat, lon]);
        setHasBranchLocation(true);
        setMapZoom(16);
        await fetchAddressFromCoords(lat, lon);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Gagal mendapatkan lokasi:", error);
        alert("Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !activeOrg?.id) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const isEdit = !!editingBranch;
      const url = isEdit ? `/api/branches/${editingBranch.id}` : '/api/branches';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_id: activeOrg.id,
          name: newBranchName,
          address: newBranchAddress,
          latitude: hasBranchLocation ? mapCenter[0] : null,
          longitude: hasBranchLocation ? mapCenter[1] : null,
          geofence_radius_m: geofenceRadius,
          timezone: branchTimezone
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (isEdit) {
          setBranches(prev => prev.map(b => b.id === editingBranch.id ? data.branch : b));
        } else {
          setBranches(prev => [...prev, data.branch]);
        }
        setIsModalOpen(false);
        setNewBranchName('');
        setNewBranchAddress('');
        setBranchTimezone('Asia/Jakarta');
        setEditingBranch(null);
      } else {
        console.error("Failed to save branch");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setNewBranchName('');
    setNewBranchAddress('');
    setBranchTimezone('Asia/Jakarta');
    setHasBranchLocation(false);
    setGeofenceRadius(100);
    setIsModalOpen(true);
  };

  const openEditModal = (branch: BranchRecord) => {
    setEditingBranch(branch);
    setNewBranchName(branch.name);
    setNewBranchAddress(branch.address || '');
    setBranchTimezone(branch.timezone || 'Asia/Jakarta');
    const hasLocation = branch.latitude != null && branch.longitude != null;
    setHasBranchLocation(hasLocation);
    if (branch.latitude != null && branch.longitude != null) {
      setMapCenter([branch.latitude, branch.longitude]);
      setMapZoom(16);
    }
    setGeofenceRadius(branch.geofence_radius_m || 100);
    setIsModalOpen(true);
  };

  const handleDeleteBranch = async () => {
    if (!branchToDelete || isDeletingBranch) return;

    setIsDeletingBranch(true);
    setDeleteError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${branchToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setBranches(prev => prev.filter(branch => branch.id !== branchToDelete.id));
        setBranchToDelete(null);
      } else {
        console.error("Failed to delete branch");
        setDeleteError('Cabang gagal dihapus. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setDeleteError('Terjadi kesalahan saat menghapus cabang. Silakan coba lagi.');
    } finally {
      setIsDeletingBranch(false);
    }
  };

  return (
    <div className="mx-auto w-[84%] max-w-[1200px] space-y-5 py-8 max-[640px]:w-full max-[640px]:px-4">
      <div>
        <h1 className="text-[28px] font-bold leading-9 text-[#242424]">Cabang</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-[#616161]">{branches.length} cabang</p>
          <span className="inline-flex items-center bg-[#EAF7EC] px-2.5 py-1 text-xs font-medium text-[#177d2c]">
            Paket langganan: {formatPlanName(activeOrg?.plan)}
          </span>
        </div>
        {isPending && (
          <div className="mt-4 flex items-center gap-2.5 border border-amber-200 bg-amber-50 p-4 text-amber-700">
            <Lock className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="text-sm">Langganan bisnis ini tertunda. Selesaikan pembayaran untuk melanjutkan.</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-[380px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari cabang berdasarkan nama atau lokasi..."
            aria-label="Cari cabang berdasarkan nama atau lokasi"
            className="h-9.5 w-full border border-[#A19F9D] bg-white pl-10 pr-3 text-[13px] text-[#242424] placeholder:text-[#8A8886] outline-none transition-colors focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
          />
        </div>
        <button
          onClick={openCreateModal}
          disabled={isPending}
          title={isPending ? 'Langganan tertunda' : ''}
          className="flex h-9.5 shrink-0 items-center gap-2 bg-[#21AC3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1B9331] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Cabang</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#21AC3A] border-t-transparent"></div>
        </div>
      ) : branches.length === 0 ? (
        <div className="border border-[#D1D1D1] bg-white p-10 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <p className="text-base text-[#616161]">Belum ada cabang. Tambahkan cabang untuk memulai.</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="border border-[#D1D1D1] bg-white p-10 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <p className="text-base text-[#616161]">Tidak ada cabang yang cocok dengan “{searchQuery}”.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-[#D1D1D1] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-[#F0F0F0]">
                <tr className="border-b border-[#D1D1D1]">
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#616161]">Cabang</th>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#616161]">Lokasi</th>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-[#616161]">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[#616161]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredBranches.map((branch, idx) => (
                  <motion.tr
                    key={branch.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    tabIndex={isPending ? -1 : 0}
                    aria-label={`Buka dasbor cabang ${branch.name}`}
                    aria-disabled={isPending}
                    onClick={() => {
                      if (!isPending) navigate(`/dashboard/branch/${branch.id}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || isPending) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/dashboard/branch/${branch.id}`);
                      }
                    }}
                    className={`transition-colors ${isPending ? 'opacity-60' : 'cursor-pointer hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#21AC3A]'}`}
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/dashboard/branch/${branch.id}`);
                        }}
                        className="text-left text-sm font-semibold text-[#242424] transition-colors hover:text-[#1B9331] disabled:cursor-not-allowed"
                      >
                        {branch.name}
                      </button>
                    </td>
                    <td className="max-w-[420px] px-5 py-4 text-sm text-[#616161]">
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-[#8A8886]" />
                        <span className="truncate">{branch.address || 'Lokasi belum tersedia'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ${isPending ? 'bg-amber-50 text-amber-700' : 'bg-[#EAF7EC] text-[#177d2c]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-[#21AC3A]'}`} />
                        {isPending ? 'Tertunda' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(branch);
                          }}
                          className="inline-flex items-center gap-1.5 border border-[#A19F9D] px-3 py-1.5 text-xs font-medium text-[#242424] transition-colors hover:border-[#21AC3A] hover:text-[#1B9331] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Ubah
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={`Hapus ${branch.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteError('');
                            setBranchToDelete(branch);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Branch Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className={`fixed inset-0 z-50 flex ${editingBranch ? 'justify-end' : 'items-center justify-center px-4 py-6'}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50"
            />
            <motion.div
              initial={editingBranch ? { opacity: 0, x: 32 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={editingBranch ? { opacity: 0, x: 32 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-modal-title"
              style={editingBranch ? { width: sidebarWidth, maxWidth: '100vw' } : undefined}
              className={`relative z-10 flex w-full flex-col overflow-hidden border border-[#D1D1D1] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.13)] ${editingBranch ? 'h-full max-h-screen' : 'max-h-[92vh] max-w-3xl'}`}
            >
              {editingBranch && (
                <div
                  role="separator"
                  aria-label="Ubah ukuran panel edit cabang"
                  aria-orientation="vertical"
                  tabIndex={0}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setIsResizingSidebar(true);
                  }}
                  onKeyDown={(event) => {
                    const maxWidth = Math.min(960, window.innerWidth);
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      setSidebarWidth((width) => Math.min(maxWidth, width + 24));
                    } else if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      setSidebarWidth((width) => Math.max(Math.min(360, maxWidth), width - 24));
                    }
                  }}
                  className="group absolute inset-y-0 left-0 z-20 hidden w-2 touch-none cursor-col-resize outline-none sm:block"
                >
                  <span className="absolute inset-y-0 left-1/2 w-px bg-transparent transition-colors group-hover:bg-[#21AC3A] group-focus:bg-[#21AC3A]" />
                </div>
              )}
              <div className="flex items-start justify-between gap-4 border-b border-[#D1D1D1] px-6 py-5 sm:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#EAF7EC] text-[#21AC3A]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1B9331]">Detail cabang</p>
                    <h3 id="branch-modal-title" className="mt-1 text-xl font-semibold text-[#242424] sm:text-2xl">
                      {editingBranch ? 'Edit cabang' : 'Tambah cabang'}
                    </h3>
                    <p className="mt-1.5 text-[13px] text-[#616161]">{editingBranch ? 'Perbarui informasi cabang ini.' : 'Tambahkan nama dan lokasi untuk cabang bisnis ini.'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Tutup dialog"
                  className="flex h-9 w-9 shrink-0 items-center justify-center text-[#616161] transition-colors hover:bg-[#F0F0F0] hover:text-[#242424]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
                  <div>
                    <label htmlFor="branch-name" className="mb-2 block text-[13px] font-semibold text-[#242424]">
                      Nama cabang <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="branch-name"
                      type="text"
                      required
                      autoFocus
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Contoh: Toko Jakarta Pusat"
                      className="h-9.5 w-full border border-[#A19F9D] bg-white px-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="branch-address" className="block text-[13px] font-semibold text-[#242424]">
                        Alamat
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isGettingLocation}
                        className="inline-flex items-center gap-2 border border-[#21AC3A]/40 bg-[#EAF7EC] px-3 py-2 text-xs font-semibold text-[#1B9331] transition-colors hover:bg-[#DDF2E0] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Navigation className={`h-3.5 w-3.5 ${isGettingLocation ? 'animate-pulse' : ''}`} />
                        <span>{isGettingLocation ? 'Mencari lokasi...' : 'Gunakan lokasi saat ini'}</span>
                      </button>
                    </div>
                    <textarea
                      id="branch-address"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      placeholder="Masukkan alamat lengkap cabang"
                      rows={2}
                      className="w-full resize-none border border-[#A19F9D] bg-white px-2.5 py-2.5 text-[13px] text-[#242424] outline-none transition-colors placeholder:text-[#8A8886] focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A]"
                    />
                    <p className="mt-2 text-xs text-[#616161]">Atau pilih titik pada peta untuk mengisi alamat.</p>
                  </div>

                  <div className="h-56 overflow-hidden border border-[#D1D1D1] bg-[#F0F0F0] sm:h-64">
                    <Map
                      center={mapCenter}
                      zoom={mapZoom}
                      onBoundsChanged={({ center, zoom }) => {
                        setMapCenter(center);
                        setMapZoom(zoom);
                      }}
                      onClick={({ latLng }) => {
                        setMapCenter(latLng);
                        setHasBranchLocation(true);
                        fetchAddressFromCoords(latLng[0], latLng[1]);
                      }}
                    >
                      {hasBranchLocation && <Marker width={40} anchor={mapCenter} color="#21AC3A" />}
                    </Map>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {hasBranchLocation
                      ? `Titik presensi: ${mapCenter[0].toFixed(6)}, ${mapCenter[1].toFixed(6)}`
                      : 'Pilih titik pada peta atau gunakan lokasi saat ini untuk mengaktifkan presensi berbasis lokasi.'}
                  </p>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">
                    Radius presensi (meter)
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={10}
                      value={geofenceRadius}
                      onChange={(event) => setGeofenceRadius(Number(event.target.value) || 100)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    />
                  </label>
                  <label htmlFor="branch-timezone" className="mt-4 block text-sm font-semibold text-slate-700">
                    Zona waktu cabang
                    <select
                      id="branch-timezone"
                      value={branchTimezone}
                      onChange={(event) => setBranchTimezone(event.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    >
                      <option value="Asia/Jakarta">WIB — Asia/Jakarta (UTC+7)</option>
                      <option value="Asia/Makassar">WITA — Asia/Makassar (UTC+8)</option>
                      <option value="Asia/Jayapura">WIT — Asia/Jayapura (UTC+9)</option>
                    </select>
                    <span className="mt-1.5 block text-xs font-normal text-slate-500">Dipakai untuk tanggal presensi, status keterlambatan, dan tampilan jam.</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#D1D1D1] bg-[#F5F5F5] px-6 py-4 sm:px-8">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9.5 border border-[#A19F9D] bg-white px-4 text-[13px] font-semibold text-[#616161] transition-colors hover:bg-[#F0F0F0] hover:text-[#242424]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newBranchName.trim()}
                    className="inline-flex h-9.5 min-w-32 items-center justify-center bg-[#21AC3A] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1B9331] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? 'Menyimpan...' : (editingBranch ? 'Simpan perubahan' : 'Tambah cabang')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {branchToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
            <button
              type="button"
              aria-label="Tutup dialog konfirmasi"
              disabled={isDeletingBranch}
              onClick={() => setBranchToDelete(null)}
              className="absolute inset-0 bg-slate-950/50 disabled:cursor-wait"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-branch-title"
              aria-describedby="delete-branch-description"
              className="relative z-10 w-full max-w-md overflow-hidden border border-[#D1D1D1] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.13)]"
            >
              <div className="flex gap-4 p-6 sm:p-8">
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 id="delete-branch-title" className="text-2xl font-semibold text-[#242424]">Hapus cabang?</h3>
                  <p id="delete-branch-description" className="mt-1.5 text-[13px] leading-normal text-[#616161]">
                    Apakah Anda yakin ingin menghapus cabang <strong className="font-semibold text-[#242424]">{branchToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>
              {deleteError && (
                <p role="alert" className="mx-6 mb-4 border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:mx-8">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-[#D1D1D1] bg-[#F5F5F5] px-6 py-4 sm:px-8">
                <button
                  type="button"
                  disabled={isDeletingBranch}
                  onClick={() => setBranchToDelete(null)}
                  className="h-9.5 border border-[#A19F9D] bg-white px-4 text-[13px] font-semibold text-[#616161] transition-colors hover:bg-[#F5F5F5] hover:text-[#242424] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingBranch}
                  onClick={handleDeleteBranch}
                  className="inline-flex h-9.5 min-w-32 items-center justify-center gap-2 bg-red-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeletingBranch ? 'Menghapus...' : 'Hapus cabang'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
