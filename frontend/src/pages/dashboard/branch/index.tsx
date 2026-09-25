import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Calendar,
  Clock,
  Activity,
  CreditCard,
  BarChart3
} from 'lucide-react';
import Sidebar from './Sidebar';

export default function BranchDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // In a real scenario, you'd fetch the specific branch data and its analytics
  // For the mockup, we simulate a loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [id]);

  const stats = [
    {
      title: "Total Penjualan",
      value: "Rp 12.450.000",
      trend: "+15.2%",
      isPositive: true,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      title: "Pesanan Hari Ini",
      value: "142",
      trend: "+5.4%",
      isPositive: true,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Total Pelanggan",
      value: "89",
      trend: "-2.1%",
      isPositive: false,
      icon: <Users className="w-5 h-5" />,
      color: "bg-amber-50 text-amber-600"
    },
    {
      title: "Stok Menipis",
      value: "12",
      trend: "Produk",
      isPositive: false,
      icon: <Package className="w-5 h-5" />,
      color: "bg-red-50 text-red-600"
    }
  ];

  const recentTransactions = [
    { id: "TRX-001", time: "10:24 AM", items: 3, total: "Rp 150.000", status: "Selesai", method: "QRIS" },
    { id: "TRX-002", time: "10:15 AM", items: 1, total: "Rp 45.000", status: "Selesai", method: "Tunai" },
    { id: "TRX-003", time: "09:45 AM", items: 5, total: "Rp 320.000", status: "Selesai", method: "Kartu Kredit" },
    { id: "TRX-004", time: "09:30 AM", items: 2, total: "Rp 85.000", status: "Selesai", method: "QRIS" },
    { id: "TRX-005", time: "09:12 AM", items: 4, total: "Rp 210.000", status: "Dibatalkan", method: "Tunai" },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Memuat data cabang...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8">
      {id && <Sidebar branchId={id} />}

      <div className="flex-1 max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm font-medium text-slate-500 hover:text-[#21AC3A] transition-colors"
              >
                Semua Cabang
              </button>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-900">Detail Cabang</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              Cabang Jakarta Pusat
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg uppercase tracking-wider">Aktif</span>
            </h1>
            <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-2">
              <MapPin className="w-4 h-4" />
              <span>Jl. Sudirman No. 123, Jakarta Pusat</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <span>Hari Ini, 25 Sep 2026</span>
            </div>
            <button className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Buka Kasir (POS)
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 pt-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#21AC3A]/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  {stat.icon}
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${stat.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{stat.trend}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-[#21AC3A] transition-colors">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          {/* Main Chart Area Mockup */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Grafik Penjualan</h3>
              <select className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#21AC3A]">
                <option>7 Hari Terakhir</option>
                <option>30 Hari Terakhir</option>
                <option>Tahun Ini</option>
              </select>
            </div>
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Grafik akan ditampilkan di sini</p>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Transaksi Terakhir</h3>
              <button className="text-[#21AC3A] hover:text-[#1d9732] text-sm font-semibold transition-colors">
                Lihat Semua
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {recentTransactions.map((trx, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${trx.status === 'Selesai' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{trx.id}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{trx.time}</span>
                        <span>•</span>
                        <span>{trx.items} item</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{trx.total}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${trx.status === 'Selesai' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {trx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
