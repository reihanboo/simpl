import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ArrowRight, ArrowUpRight, LayoutDashboard, ShoppingCart, Zap, Shield, Crown, TrendingUp, Package, Users, BarChart3, Database, Check, X, Calculator, PiggyBank, Plus, Minus, Store } from 'lucide-react';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import './App.css';

const LoginPage = lazy(() => import('./pages/auth/login'));
const RegisterPage = lazy(() => import('./pages/auth/register'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/forgot-password'));
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password'));
const ChangePasswordPage = lazy(() => import('./pages/auth/change-password'));
const VerifyOtpPage = lazy(() => import('./pages/auth/verify-otp'));
const ProfilePage = lazy(() => import('./pages/dashboard/profile'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const DashboardIndex = lazy(() => import('./pages/dashboard/index'));
const NewBusinessPage = lazy(() => import('./pages/dashboard/business/new'));
const BusinessSetupPage = lazy(() => import('./pages/auth/business-setup'));
const BranchDashboard = lazy(() => import('./pages/dashboard/branch/index'));
const BranchLayout = lazy(() => import('./pages/dashboard/branch/layout'));
const BranchInventory = lazy(() => import('./pages/dashboard/branch/inventory/index'));
const BranchPOS = lazy(() => import('./pages/dashboard/branch/pos/index'));
const BranchReports = lazy(() => import('./pages/dashboard/branch/reports/index'));
const CustomersIndex = lazy(() => import('./pages/dashboard/branch/customers/index'));
const EmployeesIndex = lazy(() => import('./pages/dashboard/branch/employees/index'));
const AttendanceIndex = lazy(() => import('./pages/dashboard/branch/attendance'));
const BranchSettings = lazy(() => import('./pages/dashboard/branch/settings'));

function LandingPage() {
  const [calcPlan, setCalcPlan] = useState<'umkm' | 'enterprise'>('umkm');
  const [calcOutlets, setCalcOutlets] = useState<number>(1);
  const [calcDuration, setCalcDuration] = useState<number>(12);
  const [competitorMonthlyCost, setCompetitorMonthlyCost] = useState<number>(249000);

  const simplPricePerOutlet = calcPlan === 'umkm' ? 29000 : 149000;
  const totalOtherCost = competitorMonthlyCost * calcOutlets * calcDuration;
  const totalSimplCost = simplPricePerOutlet * calcOutlets * calcDuration;
  const totalSavings = Math.max(0, totalOtherCost - totalSimplCost);
  const savingsPercent = totalOtherCost > 0 ? Math.round((totalSavings / totalOtherCost) * 100) : 0;

  const formatIDR = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const umkmFeatures = [
    { icon: <Package className="w-5 h-5 text-[#21AC3A]" />, text: "Kasir Digital: Transaksi Instan, Stok Otomatis Terpotong" },
    { icon: <Database className="w-5 h-5 text-[#21AC3A]" />, text: "Stok Real-Time: Tahu Persediaan Tanpa Hitung Manual" },
    { icon: <BarChart3 className="w-5 h-5 text-[#21AC3A]" />, text: "Laporan Cerdas: Omzet, Laba & Tren dalam Sekali Klik" },
    { icon: <TrendingUp className="w-5 h-5 text-[#21AC3A]" />, text: "Prediksi Stok: Tahu Kapan Harus Restock Sebelum Habis" },
    { icon: <Zap className="w-5 h-5 text-[#21AC3A]" />, text: "Alert Stok Menipis: Notifikasi Sebelum Kehabisan Barang" },
  ];

  const enterpriseFeatures = [
    { icon: <CheckCircle2 className="w-5 h-5 text-[#21AC3A]" />, text: "Semua Fitur UMKM: Sudah Termasuk, Tanpa Biaya Tambahan" },
    { icon: <Users className="w-5 h-5 text-[#21AC3A]" />, text: "Kelola Pelanggan: Riwayat Belanja & Data Profil Lengkap" },
    { icon: <Crown className="w-5 h-5 text-[#21AC3A]" />, text: "Promo & Loyalitas: Diskon VIP, Poin Reward Otomatis" },
    { icon: <Shield className="w-5 h-5 text-[#21AC3A]" />, text: "Manajemen Tim: Data Karyawan & Hak Akses Terpusat" },
    { icon: <BarChart3 className="w-5 h-5 text-[#21AC3A]" />, text: "Jadwal & Presensi: Atur Shift, Pantau Kehadiran" },
  ];

  const comparisons = [
    {
      feature: "Biaya Langganan",
      simpl: "Mulai Rp 29.000 / bulan",
      others: "Rata-rata > Rp 150.000 / bulan",
      othersNegative: false,
    },
    {
      feature: "Prediksi Kebutuhan Stok Otomatis",
      simpl: "AI-Powered, Akurat & Real-Time",
      others: "Tidak ada atau hitung manual",
      othersNegative: true,
    },
    {
      feature: "Notifikasi Stok Menipis",
      simpl: "Bisa diatur per produk (fleksibel)",
      others: "Batas tetap, tidak bisa dikustom",
      othersNegative: true,
    },
    {
      feature: "Kasir + Stok Terhubung Langsung",
      simpl: "Otomatis sinkron saat transaksi",
      others: "Terpisah, perlu modul tambahan",
      othersNegative: true,
    },
    {
      feature: "Kelola Karyawan & Jadwal Shift",
      simpl: "Sudah termasuk di dashboard",
      others: "Butuh aplikasi pihak ketiga",
      othersNegative: true,
    },
    {
      feature: "Program Loyalitas & Promo Pelanggan",
      simpl: "Poin reward, diskon VIP, otomatis",
      others: "Fitur tambahan berbayar",
      othersNegative: true,
    },
    {
      feature: "Asisten AI untuk Analisis Bisnis",
      simpl: "Tanya data lewat chatbot, langsung",
      others: "Belum tersedia",
      othersNegative: true,
    },
    {
      feature: "Kelola Banyak Cabang",
      simpl: "Satu akun untuk semua cabang",
      others: "Bayar ekstra per cabang",
      othersNegative: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-[#242424] selection:bg-[#21AC3A]/20 selection:text-[#16852B]">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 h-14 w-full border-b border-[#3A3A3A] bg-[#252525] text-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SIMPL beranda">
            <img src="/simpl-logo-light.png" alt="SIMPL" className="h-7 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-3 text-xs sm:gap-6 sm:text-[13px]">
            <a href="#perbandingan" className="hidden text-[#D1D1D1] transition-colors hover:text-white sm:block">Fitur</a>
            <a href="#pricing" className="hidden text-[#D1D1D1] transition-colors hover:text-white sm:block">Harga</a>
            <Link to="/auth/login" className="text-[#D1D1D1] transition-colors hover:text-white">Masuk</Link>
            <Link to="/auth/register" className="rounded bg-[#21AC3A] px-3.5 py-2 font-semibold text-white transition-colors hover:bg-[#1B9331] sm:px-4">
              Mulai sekarang
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="border-b border-[#D1D1D1] bg-[#F0F0F0] px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:pb-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <h1 className="max-w-xl text-[38px] font-semibold leading-[1.08] tracking-tight text-[#242424] sm:text-5xl xl:text-[58px]">
              Semua urusan bisnis, <span className="text-[#21AC3A]">satu tempat.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#616161] sm:text-base sm:leading-7">
              Kelola kasir, stok, laporan, pelanggan, dan tim dari satu dashboard yang dirancang untuk bisnis Indonesia. Mulai dari Rp 29.000/bulan.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#21AC3A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1B9331]">
                Gabung sekarang <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#perbandingan" className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#D1D1D1] bg-white px-5 text-sm font-semibold text-[#3D3D3D] transition-colors hover:bg-[#F7F7F7]">
                Jelajahi fitur <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#616161]">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#21AC3A]" /> Tanpa biaya tersembunyi</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#21AC3A]" /> Mulai dalam hitungan menit</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="min-w-0"
            role="img"
            aria-label="Pratinjau dashboard SIMPL"
          >
            <div className="overflow-hidden rounded-md border border-[#D1D1D1] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.10)]">
              <div className="flex h-10 items-center justify-between border-b border-[#E5E5E5] px-3 sm:px-4">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-[#D1D1D1]" />
                  <span className="h-2 w-2 rounded-full bg-[#D1D1D1]" />
                  <span className="h-2 w-2 rounded-full bg-[#D1D1D1]" />
                </div>
                <span className="text-[10px] font-medium text-[#8A8A8A]">SIMPL · Dashboard</span>
                <span className="h-2 w-2 rounded-full bg-[#21AC3A]" />
              </div>
              <div className="flex min-h-75 sm:min-h-87.5">
                <aside className="hidden w-40 shrink-0 border-r border-[#E5E5E5] bg-[#FAFAFA] p-3 sm:block">
                  <div className="mb-5 flex items-center gap-2 border-b border-[#E5E5E5] pb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-[#21AC3A] text-white"><Store className="h-3.5 w-3.5" /></span>
                    <span className="truncate text-[10px] font-semibold text-[#3D3D3D]">Kedai Nusantara</span>
                  </div>
                  <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Menu utama</p>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-2 rounded bg-[#EAF7EC] px-2 py-2 font-semibold text-[#16852B]"><LayoutDashboard className="h-3.5 w-3.5" /> Dashboard</div>
                    <div className="flex items-center gap-2 px-2 py-2 text-[#616161]"><ShoppingCart className="h-3.5 w-3.5" /> Kasir / POS</div>
                    <div className="flex items-center gap-2 px-2 py-2 text-[#616161]"><Package className="h-3.5 w-3.5" /> Inventori & stok</div>
                    <div className="flex items-center gap-2 px-2 py-2 text-[#616161]"><Users className="h-3.5 w-3.5" /> Pelanggan & tim</div>
                  </div>
                </aside>
                <div className="min-w-0 flex-1 p-3 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[9px] text-[#8A8A8A]">Ringkasan cabang / Hari ini</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#242424] sm:text-base">Selamat pagi 👋</p>
                    </div>
                    <span className="rounded border border-[#E5E5E5] px-2 py-1 text-[9px] text-[#616161]">Hari ini⌄</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="rounded border border-[#E5E5E5] p-2.5 sm:p-3">
                      <div className="flex items-center justify-between text-[9px] text-[#777] sm:text-[10px]">Omzet hari ini <ArrowUpRight className="h-3.5 w-3.5 text-[#21AC3A]" /></div>
                      <p className="mt-2 text-sm font-semibold text-[#242424] sm:text-lg">Rp 4,82 jt</p>
                      <p className="mt-1 text-[9px] font-medium text-[#21AC3A]">+12,8% dari kemarin</p>
                    </div>
                    <div className="rounded border border-[#E5E5E5] p-2.5 sm:p-3">
                      <div className="flex items-center justify-between text-[9px] text-[#777] sm:text-[10px]">Transaksi <ShoppingCart className="h-3.5 w-3.5 text-[#21AC3A]" /></div>
                      <p className="mt-2 text-sm font-semibold text-[#242424] sm:text-lg">128</p>
                      <p className="mt-1 text-[9px] text-[#777]">Pesanan hari ini</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded border border-[#E5E5E5] p-3 sm:mt-4 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div><p className="text-[10px] font-semibold text-[#3D3D3D] sm:text-xs">Ringkasan penjualan</p><p className="mt-0.5 text-[9px] text-[#8A8A8A]">Performa tokomu minggu ini</p></div>
                      <span className="text-[9px] text-[#777]">7 hari</span>
                    </div>
                    <div className="flex h-20 items-end gap-2 border-b border-[#E5E5E5] px-1 sm:h-24 sm:gap-3" aria-hidden="true">
                      {[34, 52, 43, 72, 58, 84, 68, 100, 76, 90, 64, 82].map((height, index) => (
                        <div key={index} className="flex-1 rounded-t-sm bg-[#21AC3A]/80" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[8px] text-[#9A9A9A]"><span>Sen</span><span>Rab</span><span>Jum</span><span>Min</span></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5 sm:mt-4">
                    <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded bg-[#EAF7EC] text-[#21AC3A]"><Package className="h-3.5 w-3.5" /></span><div><p className="text-[9px] font-semibold text-[#3D3D3D] sm:text-[10px]">Stok perlu diperhatikan</p><p className="text-[8px] text-[#888] sm:text-[9px]">Pantau persediaan sebelum habis</p></div></div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#777]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section id="perbandingan" className="scroll-mt-16 border-t border-[#D1D1D1] bg-[#F7F7F7] px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#21AC3A]">
              Kenapa SIMPL?
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-3 mb-3">
              Fitur Lebih Lengkap, Harga 5x Lebih Hemat
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-base">
              Bandingkan sendiri. SIMPL memberikan semua yang bisnis Anda butuhkan tanpa biaya tersembunyi atau modul tambahan.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border border-[#D1D1D1] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D1D1D1] bg-[#F0F0F0]">
                    <th className="py-4 px-6 text-sm font-bold text-slate-700 w-2/5">Fitur & Layanan</th>
                    <th className="py-4 px-6 text-sm font-bold text-[#21AC3A] bg-[#21AC3A]/5 border-x border-slate-200 text-center w-[30%]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base font-extrabold tracking-tight">SIMPL</span>
                      </div>
                    </th>
                    <th className="py-4 px-6 text-sm font-bold text-slate-500 text-center w-[30%]">Platform EMS Lain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {comparisons.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 text-slate-800 font-medium">{item.feature}</td>
                      <td className="py-4 px-6 bg-[#21AC3A]/5 border-x border-slate-200 text-center">
                        <div className="inline-flex items-center gap-1.5 text-[#21AC3A] font-semibold">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{item.simpl}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {item.othersNegative && (
                            <X className="w-4 h-4 shrink-0 text-slate-400" />
                          )}
                          <span>{item.others}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-16 border-t border-[#D1D1D1] bg-white px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
              Investasi Kecil, Dampak Besar
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Tanpa kontrak tahunan. Tanpa biaya tersembunyi. Upgrade atau downgrade kapan saja, bisnis Anda yang menentukan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* UMKM Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-md border border-[#21AC3A] bg-white p-6 transition-colors duration-200 sm:p-8 lg:p-9"
            >
              {/* Recommended Badge */}
              <div className="absolute top-0 right-8 transform -translate-y-1/2">
                <span className="bg-[#21AC3A] text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Recommended
                </span>
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Paket UMKM</h3>
                <p className="text-slate-500 mb-6 min-h-12">Semua yang UMKM butuhkan untuk jualan lebih rapi dan stok selalu terkontrol. Cukup satu aplikasi.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-900">Rp 29rb</span>
                  <span className="text-slate-500 font-medium">/ bulan</span>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                {umkmFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="mt-0.5">{feature.icon}</div>
                    <span className="text-slate-700 font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>

              <Link to="/auth/register" className="flex w-full items-center justify-center gap-2 rounded bg-[#21AC3A] py-3.5 font-semibold text-white transition-colors hover:bg-[#1B9331]">
                Gabung sekarang <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-md border border-[#D1D1D1] bg-white p-6 transition-colors duration-200 hover:border-[#A3A3A3] sm:p-8 lg:p-9"
            >
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Paket Enterprise</h3>
                <p className="text-slate-500 mb-6 min-h-12">Untuk bisnis yang siap naik level. Kelola pelanggan, bangun loyalitas, dan atur tim dalam satu tempat.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-900">Rp 149rb</span>
                  <span className="text-slate-500 font-medium">/ bulan</span>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                {enterpriseFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="mt-0.5">{feature.icon}</div>
                    <span className="text-slate-700 font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>

              <Link to="/auth/register" className="flex w-full items-center justify-center gap-2 rounded border border-[#BFDCC4] bg-[#EAF7EC] py-3.5 font-semibold text-[#16852B] transition-colors hover:bg-[#DDF1E0]">
                Tingkatkan Bisnis Anda <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {/* Simulation Money Spend Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mx-auto mt-16 max-w-5xl rounded-md border border-[#D1D1D1] bg-[#F7F7F7] p-5 sm:mt-20 sm:p-8 lg:p-10"
          >
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="flex items-center justify-center gap-2 text-[#21AC3A] font-bold text-sm tracking-wider uppercase mb-2">
                <Calculator className="w-4 h-4" />
                <span>Kalkulator Simulasi Biaya</span>
              </div>
              <h3 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                Hitung Penghematan Sesuai Skala Bisnis Anda
              </h3>
              <p className="text-slate-600 text-sm md:text-base">
                Atur jumlah cabang dan durasi langganan untuk melihat seberapa besar efisiensi anggaran bisnis Anda bersama SIMPL.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column: Interactive Inputs */}
              <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
                {/* 1. Outlets Configuration */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#21AC3A]" />
                      Jumlah Outlet / Cabang:
                    </label>
                    <span className="text-sm font-bold text-[#21AC3A] bg-[#21AC3A]/10 px-3 py-1 rounded-lg">
                      {calcOutlets} Cabang
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCalcOutlets((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={calcOutlets}
                      onChange={(e) => setCalcOutlets(Number(e.target.value))}
                      className="w-full accent-[#21AC3A] cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCalcOutlets((prev) => Math.min(20, prev + 1))}
                      className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                    <span>1 Cabang</span>
                    <span>10 Cabang</span>
                    <span>20 Cabang</span>
                  </div>
                </div>

                {/* 2. Select SIMPL Package */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Pilih Paket SIMPL:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCalcPlan('umkm')}
                      className={`py-3 px-4 rounded-lg border text-sm font-bold transition-all cursor-pointer flex items-center justify-between ${calcPlan === 'umkm'
                        ? 'border-[#21AC3A] bg-[#21AC3A]/10 text-[#21AC3A]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <span>Paket UMKM</span>
                      <span className="text-xs font-normal text-slate-500">Rp 29rb/bln</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalcPlan('enterprise')}
                      className={`py-3 px-4 rounded-lg border text-sm font-bold transition-all cursor-pointer flex items-center justify-between ${calcPlan === 'enterprise'
                        ? 'border-[#21AC3A] bg-[#21AC3A]/10 text-[#21AC3A]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <span>Enterprise</span>
                      <span className="text-xs font-normal text-slate-500">Rp 149rb/bln</span>
                    </button>
                  </div>
                </div>

                {/* 3. Competitor Price Config */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Rata-rata Biaya Competitor / Outlet:
                    </label>
                    <span className="text-sm font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {formatIDR(competitorMonthlyCost)} / bln
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100000}
                    max={1000000}
                    step={10000}
                    value={competitorMonthlyCost}
                    onChange={(e) => setCompetitorMonthlyCost(Number(e.target.value))}
                    className="w-full accent-[#21AC3A] cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Rp 100rb</span>
                    <span>Rp 249rb (Standar)</span>
                    <span>Rp 1jt</span>
                  </div>
                </div>

                {/* 4. Duration Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Durasi Langganan:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { months: 1, label: '1 Bulan' },
                      { months: 6, label: '6 Bulan' },
                      { months: 12, label: '1 Tahun' },
                      { months: 24, label: '2 Tahun' },
                    ].map((d) => (
                      <button
                        key={d.months}
                        type="button"
                        onClick={() => setCalcDuration(d.months)}
                        className={`py-2.5 px-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center ${calcDuration === d.months
                          ? 'border-[#21AC3A] bg-[#21AC3A] text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Comparison Result */}
              <div className="flex flex-col justify-between rounded-md border border-[#D1D1D1] bg-white p-5 sm:p-6 md:p-8 lg:col-span-6">
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Estimasi Total Pengeluaran
                    </h4>
                    <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                      {calcOutlets} Cabang × {calcDuration >= 12 ? `${calcDuration / 12} Tahun` : `${calcDuration} Bulan`}
                    </span>
                  </div>

                  {/* Other Platform Spend */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600 font-medium">Competitor / Platform Lain</span>
                      <span className="font-bold text-slate-900">{formatIDR(totalOtherCost)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-lg overflow-hidden">
                      <div className="bg-slate-400 h-full rounded-lg w-full"></div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      ({formatIDR(competitorMonthlyCost)} / cabang / bulan)
                    </span>
                  </div>

                  {/* SIMPL Spend */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[#21AC3A] font-bold">
                        SIMPL ({calcPlan === 'umkm' ? 'Paket UMKM' : 'Paket Enterprise'})
                      </span>
                      <span className="font-bold text-[#21AC3A]">{formatIDR(totalSimplCost)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-lg overflow-hidden">
                      <div
                        className="bg-[#21AC3A] h-full rounded-lg transition-all duration-300"
                        style={{
                          width: `${Math.max(4, Math.min(100, (totalSimplCost / totalOtherCost) * 100))}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      ({formatIDR(simplPricePerOutlet)} / cabang / bulan)
                    </span>
                  </div>
                </div>

                {/* Savings Highlight Box */}
                <div className="mt-8 pt-6 border-t border-slate-100 bg-[#21AC3A]/5 -mx-6 -mb-6 p-6 rounded-b-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-[#21AC3A] text-white flex items-center justify-center shrink-0">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Penghematan Anda</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-extrabold text-[#21AC3A]">
                          {formatIDR(totalSavings)}
                        </span>
                        {savingsPercent > 0 && (
                          <span className="bg-[#21AC3A] text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                            Hemat {savingsPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Hemat {formatIDR(totalSavings)} untuk {calcOutlets} cabang selama {calcDuration >= 12 ? `${calcDuration / 12} tahun` : `${calcDuration} bulan`}.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3A3A3A] bg-[#252525] px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 opacity-90">
            <img src="/simpl-logo-light.png" alt="SIMPL" className="h-6 object-contain" />
          </div>
          <p className="text-xs text-[#D1D1D1] sm:text-sm">
            © {new Date().getFullYear()} Scalable Integrated Management System. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
            Memuat...
          </div>
        }
      >
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/auth/change-password" element={<ChangePasswordPage />} />
            <Route path="/onboarding" element={<BusinessSetupPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardIndex />} />
              <Route path="business/new" element={<NewBusinessPage />} />
              <Route path="branch/:id" element={<BranchLayout />}>
                <Route index element={<BranchDashboard />} />
                <Route path="inventory" element={<BranchInventory />} />
                <Route path="pos" element={<BranchPOS />} />
                <Route path="reports" element={<BranchReports />} />
                <Route path="customers" element={<CustomersIndex />} />
                <Route path="employees" element={<EmployeesIndex />} />
                <Route path="attendance" element={<AttendanceIndex />} />
                <Route path="settings" element={<BranchSettings />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
