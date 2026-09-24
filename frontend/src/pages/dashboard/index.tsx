import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  ChevronDown,
  Grid,
  List,
  Plus,
  MoreVertical,
  MapPin,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

const mockBranches = [
  {
    id: 'BR-001',
    name: 'Cabang Utama Sudirman',
    location: 'Jakarta Pusat, DKI Jakarta',
    lowStockCount: 3,
  },
  {
    id: 'BR-002',
    name: 'Cabang Blok M',
    location: 'Jakarta Selatan, DKI Jakarta',
    lowStockCount: 0,
  },
  {
    id: 'BR-003',
    name: 'Gudang Logistik Timur',
    location: 'Bekasi, Jawa Barat',
    lowStockCount: 12,
  },
];

export default function DashboardIndex() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Cabang</h1>
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
            <button className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto">
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
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button className="flex items-center gap-1.5 bg-[#21AC3A] hover:bg-[#1d9732] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Cabang Baru</span>
          </button>
        </div>
      </div>

      {/* Branches Grid */}
      <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {mockBranches.map((branch, idx) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow relative group flex flex-col min-h-[160px]"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 group-hover:text-[#21AC3A] transition-colors cursor-pointer">
                  {branch.name}
                </h3>
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{branch.location}</span>
                </div>
              </div>
              <button className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-2">
              {branch.lowStockCount > 0 ? (
                <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">{branch.lowStockCount} barang stok menipis</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-semibold">Stok barang aman</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
