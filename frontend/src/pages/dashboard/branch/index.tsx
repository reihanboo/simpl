import { useState, useEffect, useRef, type ReactNode } from 'react';
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
  BarChart3,
  Search,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardMetrics {
  revenue_today: number;
  revenue_yesterday: number;
  orders_today: number;
  orders_yesterday: number;
  items_sold_today: number;
  items_sold_yesterday: number;
  customers_total: number;
  low_stock_count: number;
  out_of_stock_count: number;
  products_total: number;
}

interface SalesPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  created_at: string;
  total_amount_idr: number;
  items_count: number;
  payment_method: string;
  payment_status: string;
}

interface DashboardData {
  branch: { id: string; name: string; address: string };
  period_days: number;
  metrics: DashboardMetrics;
  sales_series: SalesPoint[];
  recent_orders: RecentOrder[];
}

interface ForecastItem {
  product_id: string;
  name: string;
  sku: string;
  predicted_demand: number;
  recommended_reorder_qty: number;
  days_of_cover: number | null;
  priority: string;
}

interface ForecastSeriesPoint {
  date: string;
  label: string;
  actual: number | null;
  projected: number | null;
  phase: 'history' | 'today' | 'forecast';
}

interface ForecastSeries {
  product: {
    product_id: string;
    name: string;
    sku: string;
    current_stock: number;
    low_stock_threshold: number;
  };
  smoothed_daily_demand: number;
  days_of_cover: number | null;
  estimated_stockout_date: string | null;
  points: ForecastSeriesPoint[];
}

interface StatCard {
  title: string;
  value: string;
  icon: ReactNode;
  color: string;
  trend?: string;
  isPositive?: boolean;
  note?: string;
}

const formatIDR = (num: number) => 'Rp ' + Math.round(num).toLocaleString('id-ID');

const formatCompactIDR = (num: number) => {
  if (num >= 1_000_000) return 'Rp ' + (num / 1_000_000).toFixed(1).replace('.', ',') + 'jt';
  if (num >= 1_000) return 'Rp ' + Math.round(num / 1_000) + 'rb';
  return 'Rp ' + Math.round(num);
};

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const buildTrend = (current: number, previous: number) => {
  if (previous === 0) {
    return { trend: current > 0 ? 'Baru' : '0%', isPositive: true };
  }
  const pct = ((current - previous) / previous) * 100;
  return { trend: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, isPositive: pct >= 0 };
};

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
};

export default function BranchDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [periodDays, setPeriodDays] = useState(7);

  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([]);
  const [forecastHorizon, setForecastHorizon] = useState(14);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [seriesData, setSeriesData] = useState<ForecastSeries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${id}/dashboard?days=${periodDays}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchForecast = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${id}/forecast?days=${forecastHorizon}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        const items: ForecastItem[] = result.items || [];
        setForecastItems(items);
        setSelectedProductId((current) => current || items[0]?.product_id || '');
      }
    } catch (err) {
      console.error('Failed to fetch forecast', err);
    }
  };

  const fetchSeries = async () => {
    if (!selectedProductId) {
      setSeriesData(null);
      return;
    }
    setSeriesLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(
        `/api/branches/${id}/forecast/series?product_id=${selectedProductId}&days=${forecastHorizon}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        setSeriesData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch forecast series', err);
    } finally {
      setSeriesLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDashboard();
  }, [id, periodDays]);

  useEffect(() => {
    if (id) fetchForecast();
  }, [id, forecastHorizon]);

  useEffect(() => {
    if (id && selectedProductId) fetchSeries();
  }, [id, selectedProductId, forecastHorizon]);

  useEffect(() => {
    const selected = forecastItems.find((item) => item.product_id === selectedProductId);
    if (selected) setProductQuery(selected.name);
  }, [selectedProductId, forecastItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProductOptions = forecastItems.filter((item) =>
    item.name.toLowerCase().includes(productQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(productQuery.toLowerCase())
  );

  const metrics = data?.metrics;

  const stats: StatCard[] = [
    {
      title: 'Total Penjualan',
      value: formatIDR(metrics?.revenue_today ?? 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-emerald-50 text-emerald-600',
      ...buildTrend(metrics?.revenue_today ?? 0, metrics?.revenue_yesterday ?? 0),
    },
    {
      title: 'Pesanan Hari Ini',
      value: String(metrics?.orders_today ?? 0),
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'bg-blue-50 text-blue-600',
      ...buildTrend(metrics?.orders_today ?? 0, metrics?.orders_yesterday ?? 0),
    },
    {
      title: 'Total Pelanggan',
      value: String(metrics?.customers_total ?? 0),
      icon: <Users className="w-5 h-5" />,
      color: 'bg-amber-50 text-amber-600',
      note: 'Belum tersedia',
    },
    {
      title: 'Stok Menipis',
      value: String(metrics?.low_stock_count ?? 0),
      icon: <Package className="w-5 h-5" />,
      color: 'bg-red-50 text-red-600',
      note: `${metrics?.out_of_stock_count ?? 0} stok habis`,
    },
  ];

  const salesSeries = data?.sales_series ?? [];

  const chartData = (seriesData?.points ?? []).map((point) => ({
    label: point.label,
    actual: point.actual,
    projected: point.projected,
  }));

  const todayLabel = seriesData?.points.find((point) => point.phase === 'today')?.label;

  const recentTransactions = data?.recent_orders ?? [];

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Memuat data cabang...</p>
      </div>
    );
  }

  return (
    <>
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
            {data?.branch.name || 'Cabang'}
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg uppercase tracking-wider">Aktif</span>
          </h1>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-2">
            <MapPin className="w-4 h-4" />
            <span>{data?.branch.address || 'Alamat belum tersedia'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <span>Hari Ini, {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => navigate(`/dashboard/branch/${id}/pos`)}
            className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
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
              {stat.trend ? (
                <div className={`flex items-center gap-1 text-sm font-semibold ${stat.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{stat.trend}</span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-slate-400">{stat.note}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 group-hover:text-[#21AC3A] transition-colors">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Grafik Penjualan</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pendapatan harian cabang</p>
            </div>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#21AC3A] cursor-pointer"
            >
              <option value={7}>7 Hari Terakhir</option>
              <option value={30}>30 Hari Terakhir</option>
            </select>
          </div>
          <div className="flex-1 min-h-[260px]">
            {salesSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Belum ada data penjualan</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#21AC3A" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#21AC3A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(value) => formatCompactIDR(Number(value))}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value) => [formatIDR(Number(value)), 'Pendapatan']}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#21AC3A" strokeWidth={2} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Transaksi Terakhir</h3>
            <button
              onClick={() => navigate(`/dashboard/branch/${id}/reports`)}
              className="text-[#21AC3A] hover:text-[#1d9732] text-sm font-semibold transition-colors cursor-pointer"
            >
              Lihat Laporan
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <CreditCard className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">Belum ada transaksi</p>
              </div>
            ) : (
              recentTransactions.map((trx) => {
                const paid = trx.payment_status === 'paid';
                return (
                  <div key={trx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${paid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 font-mono">{trx.order_number}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatClock(trx.created_at)}</span>
                          <span>•</span>
                          <span>{trx.items_count} item</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatIDR(trx.total_amount_idr)}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${paid ? 'text-emerald-500' : 'text-red-500'}`}>
                        {paid ? 'Selesai' : 'Refund'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Proyeksi Permintaan</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Proyeksi permintaan {forecastHorizon} hari ke depan
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={productDropdownRef}>
              <input
                type="text"
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setIsProductDropdownOpen(true);
                }}
                onFocus={() => setIsProductDropdownOpen(true)}
                placeholder="Cari produk..."
                className="text-sm bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-9 py-1.5 outline-none focus:border-[#21AC3A] w-[220px]"
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              {isProductDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {filteredProductOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">Tidak ada produk</div>
                  ) : (
                    filteredProductOptions.map((item) => (
                      <button
                        key={item.product_id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(item.product_id);
                          setProductQuery(item.name);
                          setIsProductDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${item.product_id === selectedProductId ? 'text-[#21AC3A] font-semibold' : 'text-slate-700'}`}
                      >
                        {item.name}
                        <span className="block text-xs text-slate-400">{item.sku}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(Number(e.target.value))}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#21AC3A] cursor-pointer"
            >
              <option value={7}>7 Hari</option>
              <option value={14}>14 Hari</option>
              <option value={30}>30 Hari</option>
            </select>
          </div>
        </div>

        {seriesData && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#21AC3A]" /> Aktual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" /> Proyeksi
            </span>
          </div>
        )}

        {seriesLoading || chartData.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            {seriesLoading ? (
              <div className="w-8 h-8 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <BarChart3 className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">Belum ada data proyeksi permintaan</p>
              </>
            )}
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value, name) => [`${value} unit`, name]}
                  contentStyle={TOOLTIP_STYLE}
                />
                {todayLabel && (
                  <ReferenceLine
                    x={todayLabel}
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                    label={{ value: 'Hari ini', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Aktual"
                  stroke="#21AC3A"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Proyeksi"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
