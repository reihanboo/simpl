import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  MoreVertical,
  AlertCircle,
  PackageCheck,
  PackageOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  BoxSelect,
  X,
  Loader2
} from 'lucide-react';
import { useParams } from 'react-router-dom';

export default function BranchInventory() {
  const { id } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStock, setFilterStock] = useState('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'movement'>('inventory');

  // Data State
  const [products, setProducts] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProductsAndMovements = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const [productsRes, movementsRes] = await Promise.all([
        fetch(`/api/branches/${id}/products`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/branches/${id}/movements`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || []);
      }
      
      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setStockMovements(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndMovements();
  }, [id]);

  // Modal State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    cost_price_idr: 0,
    selling_price_idr: 0,
    low_stock_threshold: 10,
    initial_stock: 0,
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${id}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsAddProductOpen(false);
        setFormData({ name: '', sku: '', cost_price_idr: 0, selling_price_idr: 0, low_stock_threshold: 10, initial_stock: 0 });
        fetchProductsAndMovements(); // Refresh data
        toast.success('Produk berhasil ditambahkan!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menambahkan produk');
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Movement Modal State
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<any>(null);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [movementForm, setMovementForm] = useState({
    qty_change: 1,
    reason: 'restock' // default
  });

  const handleOpenMovementModal = (product: any, type: 'in' | 'out') => {
    setMovementProduct(product);
    setMovementType(type);
    setMovementForm({
      qty_change: 1,
      reason: type === 'in' ? 'restock' : 'sale'
    });
    setIsMovementModalOpen(true);
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct) return;
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      // For type 'out', quantity change should be negative
      const qty = movementType === 'in' ? Math.abs(movementForm.qty_change) : -Math.abs(movementForm.qty_change);
      
      const payload = {
        qty_change: qty,
        reason: movementForm.reason
      };

      const res = await fetch(`/api/branches/${id}/products/${movementProduct.product_id}/movement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsMovementModalOpen(false);
        fetchProductsAndMovements(); // Refresh products to get updated stock
        toast.success('Pergerakan stok berhasil dicatat!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal mencatat pergerakan stok');
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };


  // Derived state for pagination and filtering
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStock === 'all' ? true :
      filterStock === 'safe' ? p.status === 'Aman' :
        filterStock === 'low' ? p.status === 'Menipis' :
          p.status === 'Habis';
    return matchesSearch && matchesStatus;
  });

  const totalItems = activeTab === 'inventory' ? filteredProducts.length : stockMovements.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedMovements = stockMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const safeCount = products.filter(p => p.status === 'Aman').length;
  const lowCount = products.filter(p => p.status === 'Menipis').length;
  const outCount = products.filter(p => p.status === 'Habis').length;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventori & Stok</h1>
          <p className="text-slate-500">Kelola produk, pantau ketersediaan stok, dan histori barang masuk/keluar.</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            Penyesuaian Stok
          </button>
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BoxSelect className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Produk (SKU)</p>
            <h3 className="text-2xl font-bold text-slate-900">{products.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Aman</p>
            <h3 className="text-2xl font-bold text-slate-900">{safeCount}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Menipis</p>
            <h3 className="text-2xl font-bold text-slate-900">{lowCount}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Habis</p>
            <h3 className="text-2xl font-bold text-slate-900">{outCount}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
        <button
          onClick={() => { setActiveTab('inventory'); setCurrentPage(1); }}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'inventory' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          Inventori Saat Ini
          {activeTab === 'inventory' && (
            <motion.div layoutId="inventory-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => { setActiveTab('movement'); setCurrentPage(1); }}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'movement' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          Pergerakan Stok
          {activeTab === 'movement' && (
            <motion.div layoutId="inventory-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama produk atau SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="bg-transparent outline-none cursor-pointer"
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="safe">Aman</option>
                <option value="low">Menipis</option>
                <option value="out">Habis</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'inventory' ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Produk</th>
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold">Harga Jual</th>
                  <th className="px-6 py-4 font-semibold">Sisa Stok</th>
                  <th className="px-6 py-4 font-semibold">Batas Minimum</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Memuat data inventori...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Belum ada data produk atau tidak ada yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={product.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{product.name}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        Rp {product.selling_price_idr?.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{product.current_stock}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {product.low_stock_threshold}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${product.status === 'Aman' ? 'bg-emerald-100 text-emerald-700' :
                            product.status === 'Menipis' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                          }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenMovementModal(product, 'in')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Catat Barang Masuk">
                            <ArrowDownToLine className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleOpenMovementModal(product, 'out')} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Catat Barang Keluar">
                            <ArrowUpFromLine className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors" title="Lebih banyak">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-semibold">Produk</th>
                  <th className="px-6 py-4 font-semibold">Pergerakan</th>
                  <th className="px-6 py-4 font-semibold">Keterangan</th>
                  <th className="px-6 py-4 font-semibold">Dibuat Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMovements.map((movement) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={movement.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {movement.date}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{movement.name}</p>
                      <p className="text-xs text-slate-500">{movement.sku}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 font-bold ${movement.type === 'in' ? 'text-emerald-600' :
                          movement.type === 'out' ? 'text-amber-600' :
                            'text-red-600'
                        }`}>
                        {movement.type === 'in' ? <ArrowDownToLine className="w-4 h-4" /> :
                          movement.type === 'out' ? <ArrowUpFromLine className="w-4 h-4" /> :
                            <ArrowUpDown className="w-4 h-4" />}
                        <span>{movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}{Math.abs(movement.qty)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {movement.reason}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {movement.user}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset page on limit change
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#21AC3A]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="whitespace-nowrap ml-2">
              Menampilkan {activeTab === 'inventory' ? paginatedProducts.length : paginatedMovements.length} dari {totalItems} data
            </span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button className="px-3 py-1 bg-[#21AC3A] text-white rounded">{currentPage}</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isSubmitting && setIsAddProductOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Tambah Produk Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Tambahkan produk ke dalam katalog master dan set stok awal cabang.</p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsAddProductOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="add-product-form" onSubmit={handleAddProduct} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Nama Produk</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="Contoh: Indomie Goreng Special"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">SKU (Stock Keeping Unit)</label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="Contoh: SKU-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Stok Awal Cabang</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initial_stock || ''}
                      onChange={(e) => setFormData({ ...formData, initial_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Harga Modal (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.cost_price_idr || ''}
                      onChange={(e) => setFormData({ ...formData, cost_price_idr: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="3000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Harga Jual (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.selling_price_idr || ''}
                      onChange={(e) => setFormData({ ...formData, selling_price_idr: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="3500"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      Batas Minimum Stok (Peringatan Stok Menipis)
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.low_stock_threshold || ''}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                      placeholder="10"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-product-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732] rounded-xl transition-colors shadow-sm shadow-[#21AC3A]/20 flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Produk'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {isMovementModalOpen && movementProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isSubmitting && setIsMovementModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {movementType === 'in' ? 'Catat Barang Masuk' : 'Catat Barang Keluar'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Produk: <span className="font-semibold text-slate-800">{movementProduct.name} ({movementProduct.sku})</span>
                </p>
                <p className="text-sm text-slate-500">
                  Sisa Stok Saat Ini: <span className="font-semibold text-slate-800">{movementProduct.current_stock}</span>
                </p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsMovementModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="movement-form" onSubmit={handleMovementSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    max={movementType === 'out' ? movementProduct.current_stock : undefined}
                    required
                    value={movementForm.qty_change || ''}
                    onChange={(e) => setMovementForm({ ...movementForm, qty_change: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                    placeholder="Contoh: 10"
                  />
                  {movementType === 'out' && (
                    <p className="text-xs text-amber-600">
                      Jumlah maksimum yang dapat dikeluarkan adalah {movementProduct.current_stock}.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Alasan / Keterangan</label>
                  <select
                    required
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                  >
                    {movementType === 'in' ? (
                      <>
                        <option value="restock">Restock / Pembelian</option>
                        <option value="return">Retur dari Pelanggan</option>
                        <option value="adjustment">Penyesuaian Stok (Plus)</option>
                      </>
                    ) : (
                      <>
                        <option value="sale">Penjualan</option>
                        <option value="return">Retur ke Supplier</option>
                        <option value="adjustment">Barang Rusak / Hilang (Minus)</option>
                      </>
                    )}
                  </select>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="movement-form"
                disabled={isSubmitting || movementForm.qty_change <= 0 || (movementType === 'out' && movementForm.qty_change > movementProduct.current_stock)}
                className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-70 ${
                  movementType === 'in' ? 'bg-[#21AC3A] hover:bg-[#1d9732] shadow-[#21AC3A]/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  movementType === 'in' ? 'Tambah Stok' : 'Kurangi Stok'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
