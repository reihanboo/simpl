import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Markdown } from '../../../components/Markdown';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Calendar,
  Activity,
  CreditCard,
  BarChart3,
  Search,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Send,
  Info,
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
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
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
  borderRadius: 2,
  border: '1px solid #d1d5db',
  fontSize: 12,
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
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
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
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
      title: 'Penjualan hari ini',
      value: formatCompactIDR(metrics?.revenue_today ?? 0),
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-[#21AC3A]',
      ...buildTrend(metrics?.revenue_today ?? 0, metrics?.revenue_yesterday ?? 0),
    },
    {
      title: 'Transaksi',
      value: String(metrics?.orders_today ?? 0),
      icon: <ShoppingCart className="w-4 h-4" />,
      color: 'text-[#21AC3A]',
      ...buildTrend(metrics?.orders_today ?? 0, metrics?.orders_yesterday ?? 0),
    },
    {
      title: 'Stok menipis',
      value: String(metrics?.low_stock_count ?? 0),
      icon: <Package className="w-4 h-4" />,
      color: 'text-amber-600',
      note: `${metrics?.out_of_stock_count ?? 0} stok habis`,
    },
    {
      title: 'Pelanggan',
      value: String(metrics?.customers_total ?? 0),
      icon: <Users className="w-4 h-4" />,
      color: 'text-[#21AC3A]',
      note: 'Total terdaftar',
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

  const sendChatMessage = async (message = chatInput.trim()) => {
    const content = message.trim();
    if (!content || isChatSending) return;

    const history = chatMessages.slice(-10);
    setChatMessages((messages) => [...messages, { role: 'user', content }]);
    setChatInput('');
    setIsChatSending(true);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, history }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'ABAI tidak dapat menjawab saat ini.');
      }

      const result = await res.json();
      setChatMessages((messages) => [...messages, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      const fallback = 'Maaf, ABAI sedang tidak dapat dihubungi. Coba lagi sebentar.';
      setChatMessages((messages) => [
        ...messages,
        { role: 'assistant', content: err instanceof Error ? err.message : fallback },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Memuat data cabang...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <button onClick={() => navigate('/dashboard')} className="font-medium text-[#21AC3A] hover:underline cursor-pointer">Semua cabang</button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">Ringkasan</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ringkasan</h1>
          <p className="mt-1.5 text-base text-slate-600">Aktivitas operasional untuk {data?.branch.name || 'cabang'}.</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{data?.branch.address || 'Alamat belum tersedia'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <Calendar className="mr-2 h-4 w-4 text-slate-400" />
            <span>Hari ini, {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => navigate(`/dashboard/branch/${id}/pos`)}
            className="inline-flex items-center gap-2 bg-[#21AC3A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d9732] transition-colors cursor-pointer"
          >
            <Activity className="h-4 w-4" />
            Buka kasir
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="min-w-0 border border-slate-200 bg-white p-4 sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="text-sm text-slate-600">{stat.title}</p>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
              <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{stat.value}</h2>
              {stat.trend ? (
                <span className={`inline-flex items-center text-xs font-medium ${stat.isPositive ? 'text-[#16852A]' : 'text-red-600'}`}>
                  {stat.isPositive ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                  {stat.trend}
                </span>
              ) : (
                <span className="text-xs text-slate-500">{stat.note}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex min-h-[400px] flex-col border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-semibold">Aktivitas penjualan</h2>
              <p className="mt-1 text-sm text-slate-500">Pendapatan kotor, berdasarkan periode</p>
            </div>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              aria-label="Periode aktivitas penjualan"
              className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#21AC3A] cursor-pointer"
            >
              <option value={7}>7 hari</option>
              <option value={30}>30 hari</option>
            </select>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{formatCompactIDR(metrics?.revenue_today ?? 0)}</p>
              <p className="text-xs text-slate-500">Penjualan hari ini</p>
            </div>
            <span className="text-xs text-slate-500">{periodDays} hari terakhir</span>
          </div>
          <div className="min-h-[280px] flex-1">
            {salesSeries.length === 0 ? (
              <div className="flex h-full min-h-[280px] items-center justify-center border border-slate-200 bg-slate-50">
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-500">Belum ada data penjualan</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#21AC3A" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#21AC3A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(value) => formatCompactIDR(Number(value))}
                    tick={{ fontSize: 12, fill: '#737373' }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                  />
                  <Tooltip formatter={(value) => [formatIDR(Number(value)), 'Pendapatan']} contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="revenue" stroke="#21AC3A" strokeWidth={2} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <aside className="flex h-[70vh] min-h-[400px] max-h-[calc(100vh_-_8px)] flex-col overflow-hidden border border-slate-200 bg-white lg:h-[760px] lg:row-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <div>
              <h2 className="text-lg font-semibold">ABAI assistant</h2>
              <p className="mt-0.5 text-xs text-slate-500">Asisten operasional AI</p>
            </div>
            <span className="border border-[#21AC3A]/30 bg-[#21AC3A]/10 px-2.5 py-1 text-xs font-medium text-[#16852A]">Aktif</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
              <div className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#21AC3A] text-white"><Sparkles className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1 bg-slate-100 p-3 text-xs leading-5 text-slate-700">
                  <p className="mb-1 font-semibold text-slate-800">ABAI</p>
                  <p>Selamat pagi! Penjualan hari ini {formatCompactIDR(metrics?.revenue_today ?? 0)} dari {metrics?.orders_today ?? 0} transaksi. Ada {metrics?.low_stock_count ?? 0} produk dengan stok menipis yang perlu diperiksa.</p>
                </div>
              </div>
              {chatMessages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#21AC3A] text-white"><Sparkles className="h-4 w-4" /></span>
                  )}
                  <div className={`max-w-[85%] p-3 text-xs leading-5 ${message.role === 'user' ? 'bg-[#21AC3A] text-white' : 'min-w-0 flex-1 bg-slate-100 text-slate-700'}`}>
                    {message.role === 'user' ? message.content : <Markdown content={message.content} />}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="flex gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#21AC3A] text-white"><Sparkles className="h-4 w-4" /></span>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 bg-slate-100 p-3 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="ml-1">ABAI sedang menyiapkan jawaban...</span>
                  </div>
                </div>
              )}
            </div>
            {chatMessages.length === 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Pertanyaan yang disarankan</p>
                <div className="space-y-2">
                  {['Apa yang perlu saya pesan ulang?', 'Ringkas penjualan hari ini', 'Produk apa yang paling laris?'].map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendChatMessage(question)}
                      className="flex w-full items-center justify-between gap-2 border border-slate-200 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:border-[#21AC3A] hover:bg-[#21AC3A]/5"
                    >
                      <span>{question}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#21AC3A]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form
              className="mt-auto flex shrink-0 items-center gap-2 border border-slate-300 px-3 py-2 focus-within:border-[#21AC3A]"
              onSubmit={(event) => {
                event.preventDefault();
                sendChatMessage();
              }}
            >
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                aria-label="Tanya ABAI"
                placeholder="Tanya ABAI tentang bisnis Anda..."
                className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                aria-label="Kirim pesan"
                disabled={!chatInput.trim() || isChatSending}
                className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#21AC3A] text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] leading-5 text-slate-400">Ditenagai DeepSeek · Data cabang diakses lewat MCP (baca-saja)</p>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              Sistem AI dapat menghasilkan fakta yang salah, Selalu verifikasi jawaban ABAI sebelum mengambil keputusan bisnis.
            </div>
          </div>
        </aside>

        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
          <section className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold">Perlu perhatian</h2>
                <p className="mt-0.5 text-xs text-slate-500">Ringkasan kondisi stok</p>
              </div>
              <button
                onClick={() => navigate(`/dashboard/branch/${id}/inventory`)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#21AC3A] hover:underline cursor-pointer"
              >
                Buka stok <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              <div className="flex items-center justify-between gap-3 px-4 py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Package className="h-5 w-5 shrink-0 text-slate-500" />
                  <div><p className="text-sm font-medium">Stok menipis</p><p className="mt-1 text-xs text-slate-500">Periksa batas minimum stok</p></div>
                </div>
                <span className="bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{metrics?.low_stock_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                  <div><p className="text-sm font-medium">Stok habis</p><p className="mt-1 text-xs text-slate-500">Produk yang memerlukan pengisian</p></div>
                </div>
                <span className="bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{metrics?.out_of_stock_count ?? 0}</span>
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold">Transaksi terakhir</h2>
                <p className="mt-0.5 text-xs text-slate-500">Aktivitas terbaru di cabang ini</p>
              </div>
              <button
                onClick={() => navigate(`/dashboard/branch/${id}/reports`)}
                className="shrink-0 text-xs font-medium text-[#21AC3A] hover:underline cursor-pointer"
              >
                Lihat laporan
              </button>
            </div>
            <div className="max-h-72 flex-1 divide-y divide-slate-200 overflow-y-auto">
              {recentTransactions.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center text-center p-4">
                  <CreditCard className="mb-3 h-9 w-9 text-slate-300" />
                  <p className="text-sm text-slate-500">Belum ada transaksi</p>
                </div>
              ) : (
                recentTransactions.map((trx) => {
                  const paid = trx.payment_status === 'paid';
                  return (
                    <div key={trx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">{trx.order_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatClock(trx.created_at)} · {trx.items_count} item</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatCompactIDR(trx.total_amount_idr)}</p>
                        <p className={`mt-1 text-[11px] font-medium uppercase ${paid ? 'text-[#16852A]' : 'text-red-600'}`}>{paid ? 'Selesai' : 'Refund'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Forecast Chart */}
      <section className="border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Proyeksi permintaan</h2>
            <p className="mt-1 text-sm text-slate-500">
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
                className="w-full border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm outline-none focus:border-[#21AC3A] sm:w-[260px]"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              {isProductDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
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
                        className={`w-full px-3 py-3 text-left text-sm hover:bg-slate-50 transition-colors ${item.product_id === selectedProductId ? 'text-[#21AC3A] font-semibold' : 'text-slate-700'}`}
                      >
                        {item.name}
                        <span className="mt-0.5 block text-xs text-slate-400">{item.sku}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(Number(e.target.value))}
              className="border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#21AC3A] cursor-pointer"
            >
              <option value={7}>7 Hari</option>
              <option value={14}>14 Hari</option>
              <option value={30}>30 Hari</option>
            </select>
          </div>
        </div>

        {seriesData && (
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#21AC3A]" /> Aktual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-amber-500" /> Proyeksi
            </span>
          </div>
        )}

        {seriesLoading || chartData.length === 0 ? (
          <div className="flex h-[320px] flex-col items-center justify-center border border-slate-200 bg-slate-50">
            {seriesLoading ? (
              <div className="w-8 h-8 border-4 border-[#21AC3A] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <BarChart3 className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-base font-medium text-slate-500">Belum ada data proyeksi permintaan</p>
              </>
            )}
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#737373' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#737373' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
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
                    label={{ value: 'Hari ini', position: 'insideTopRight', fontSize: 12, fill: '#737373' }}
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
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
