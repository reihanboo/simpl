import { useState } from 'react';
import { motion } from 'framer-motion';
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
  BoxSelect
} from 'lucide-react';

export default function BranchInventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStock, setFilterStock] = useState('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'movement'>('inventory');

  const products = [
    { id: '1', sku: 'SKU-001', name: 'Indomie Goreng Special', price: 3500, stock: 150, threshold: 20, status: 'Aman' },
    { id: '2', sku: 'SKU-002', name: 'Kopi Kenangan Mantan 250ml', price: 15000, stock: 12, threshold: 20, status: 'Menipis' },
    { id: '3', sku: 'SKU-003', name: 'Aqua Botol 600ml', price: 4000, stock: 0, threshold: 50, status: 'Habis' },
    { id: '4', sku: 'SKU-004', name: 'Chitato Sapi Panggang 68g', price: 11500, stock: 45, threshold: 15, status: 'Aman' },
    { id: '5', sku: 'SKU-005', name: 'Beras Pandan Wangi 5kg', price: 85000, stock: 8, threshold: 10, status: 'Menipis' },
  ];

  const stockMovements = [
    { id: '1', date: '25 Sep 2026, 14:30', sku: 'SKU-001', name: 'Indomie Goreng Special', type: 'in', qty: 50, reason: 'Restock Bulanan', user: 'Admin Gudang' },
    { id: '2', date: '25 Sep 2026, 12:15', sku: 'SKU-003', name: 'Aqua Botol 600ml', type: 'out', qty: 2, reason: 'Penjualan POS', user: 'Kasir 1' },
    { id: '3', date: '24 Sep 2026, 09:00', sku: 'SKU-005', name: 'Beras Pandan Wangi 5kg', type: 'out', qty: 5, reason: 'Penjualan POS', user: 'Kasir 2' },
    { id: '4', date: '23 Sep 2026, 16:45', sku: 'SKU-002', name: 'Kopi Kenangan Mantan 250ml', type: 'adj', qty: -1, reason: 'Barang Rusak', user: 'Admin Gudang' },
  ];

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
          <button className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
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
            <h3 className="text-2xl font-bold text-slate-900">324</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Aman</p>
            <h3 className="text-2xl font-bold text-slate-900">289</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Menipis</p>
            <h3 className="text-2xl font-bold text-slate-900">31</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <PackageOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Stok Habis</p>
            <h3 className="text-2xl font-bold text-slate-900">4</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'inventory' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          Inventori Saat Ini
          {activeTab === 'inventory' && (
            <motion.div layoutId="inventory-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('movement')}
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
                {products.map((product) => (
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
                      Rp {product.price.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{product.stock}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {product.threshold}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        product.status === 'Aman' ? 'bg-emerald-100 text-emerald-700' :
                        product.status === 'Menipis' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Catat Barang Masuk">
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Catat Barang Keluar">
                          <ArrowUpFromLine className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors" title="Lebih banyak">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
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
                {stockMovements.map((movement) => (
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
                      <div className={`inline-flex items-center gap-1.5 font-bold ${
                        movement.type === 'in' ? 'text-emerald-600' :
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
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <p>Menampilkan 1 hingga {activeTab === 'inventory' ? '5' : '4'} data</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">Sebelumnya</button>
            <button className="px-3 py-1 bg-[#21AC3A] text-white rounded">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">2</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">3</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">Selanjutnya</button>
          </div>
        </div>
      </div>
    </>
  );
}
