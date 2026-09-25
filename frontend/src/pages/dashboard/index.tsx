import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import {
  Search,
  ChevronDown,
  Grid,
  List,
  Plus,
  MoreVertical,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Navigation,
  Edit2,
  Trash2,
  Lock
} from 'lucide-react';



export default function DashboardIndex() {
  const { activeOrg } = useOutletContext<{ activeOrg: any }>();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.200000, 106.816666]);
  const [mapZoom, setMapZoom] = useState(13);

  const isPending = activeOrg?.status === 'pending';

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
    const handleOutsideClick = () => {
      if (openMenuId) setOpenMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openMenuId]);

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
          address: newBranchAddress
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
    setIsModalOpen(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setNewBranchName(branch.name);
    setNewBranchAddress(branch.address || '');
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus cabang ini?')) return;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setBranches(prev => prev.filter(b => b.id !== branchId));
      } else {
        console.error("Failed to delete branch");
        alert("Gagal menghapus cabang.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menghapus cabang.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Cabang</h1>
        {isPending && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
            <Lock className="w-5 h-5 shrink-0 text-amber-600" />
            <span className="text-sm">Status langganan bisnis ini sedang <strong>tertunda</strong>. Harap lunasi pembayaran untuk melanjutkan.</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari cabang..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto cursor-pointer">
              <div className="flex items-center gap-1.5">
                <ChevronDown className="w-4 h-4 text-slate-400" />
                <span>Urutkan berdasarkan nama</span>
              </div>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={openCreateModal}
            disabled={isPending}
            title={isPending ? "Langganan tertunda" : ""}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${isPending
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-[#21AC3A] hover:bg-[#1d9732] text-white cursor-pointer'
              }`}
          >
            <Plus className="w-4 h-4" />
            <span>Cabang Baru</span>
          </button>
        </div>
      </div>

      {/* Branches Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500">Belum ada cabang. Silakan buat cabang baru.</p>
        </div>
      ) : (
        <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {branches.map((branch, idx) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => {
                if (!isPending) {
                  navigate(`/dashboard/branch/${branch.id}`);
                }
              }}
              className={`bg-white border border-slate-200 rounded-xl p-5 relative flex flex-col min-h-[160px] transition-all ${isPending ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'hover:shadow-md group cursor-pointer'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`font-bold text-lg text-slate-900 transition-colors ${!isPending && 'group-hover:text-[#21AC3A] cursor-pointer'}`}>
                    {branch.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Alamat: {branch.address || "Tidak tersedia"}</span>
                  </div>
                </div>
                <div className="relative">
                  <button
                    disabled={isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === branch.id ? null : branch.id);
                    }}
                    className={`p-1 rounded-md transition-colors ${isPending ? 'text-slate-300' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'}`}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {openMenuId === branch.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(branch);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 text-slate-400" />
                          <span>Edit Cabang</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleDeleteBranch(branch.id);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                          <span>Hapus Cabang</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-2">
                {isPending ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-semibold">Tertunda</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold">Cabang Aktif</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Branch Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-900">{editingBranch ? 'Edit Cabang' : 'Cabang Baru'}</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nama Cabang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Contoh: Cabang Jakarta Pusat"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">
                      Alamat Lengkap
                    </label>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isGettingLocation}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#21AC3A] hover:text-[#1d9732] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Navigation className={`w-3.5 h-3.5 ${isGettingLocation ? 'animate-pulse' : ''}`} />
                      <span>{isGettingLocation ? 'Mencari Lokasi...' : 'Gunakan Lokasi Saat Ini'}</span>
                    </button>
                  </div>
                  <textarea
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    placeholder="Masukkan alamat lengkap cabang atau klik pada peta di bawah"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all resize-none mb-3"
                  />

                  <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0 relative">
                    <Map
                      center={mapCenter}
                      zoom={mapZoom}
                      onBoundsChanged={({ center, zoom }) => {
                        setMapCenter(center);
                        setMapZoom(zoom);
                      }}
                      onClick={({ latLng }) => {
                        setMapCenter(latLng);
                        fetchAddressFromCoords(latLng[0], latLng[1]);
                      }}
                    >
                      <Marker width={40} anchor={mapCenter} color="#21AC3A" />
                    </Map>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newBranchName}
                    className="px-4 py-2 text-sm font-semibold bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isCreating ? 'Menyimpan...' : (editingBranch ? 'Update Cabang' : 'Simpan Cabang')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
