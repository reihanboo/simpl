import { useState } from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Zap, Shield, Crown, TrendingUp, Package, Users, BarChart3, Database, Check, X, Calculator, PiggyBank, Plus, Minus, Store } from 'lucide-react';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import ForgotPasswordPage from './pages/auth/forgot-password';
import ResetPasswordPage from './pages/auth/reset-password';
import ProfilePage from './pages/dashboard/profile';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardIndex from './pages/dashboard/index';
import NewBusinessPage from './pages/dashboard/business/new';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import VerifyOtpPage from './pages/auth/verify-otp';
import BranchDashboard from './pages/dashboard/branch/index';
import BranchLayout from './pages/dashboard/branch/layout';
import BranchInventory from './pages/dashboard/branch/inventory/index';
import './App.css';

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#21AC3A]/20 selection:text-[#21AC3A]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <img src="/simpl-logo-dark.png" alt="SIMPL Logo" className="h-8 object-contain" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6"
          >
            <a href="#perbandingan" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden md:block cursor-pointer">Perbandingan</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden md:block cursor-pointer">Harga</a>
            <Link
              to="/auth/login"
              className="text-sm font-semibold px-5 py-2.5 rounded-lg text-white bg-[#21AC3A] hover:bg-[#1d9732] transition-colors active:scale-95 cursor-pointer inline-block"
            >
              Masuk
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="max-w-4xl mx-auto text-center relative z-10 mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-tight">
              Satu Platform, <br className="hidden md:block" />
              <span className="text-[#21AC3A]">
                Seluruh Bisnis Anda Terkelola
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Berhenti pakai banyak aplikasi. Kasir, stok, laporan keuangan, dan manajemen tim, semua ada dalam satu layar. Mulai dari Rp 29.000/bulan.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl text-white font-semibold text-lg bg-[#21AC3A] hover:bg-[#1d9732] transition-colors flex items-center justify-center gap-2 group active:scale-95 cursor-pointer">
                Coba Gratis 14 Hari
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl text-slate-700 font-semibold text-lg bg-white border border-slate-300 hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer">
                Tonton Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section id="perbandingan" className="py-20 px-6 relative z-10 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#21AC3A] font-bold text-sm uppercase tracking-wider block mb-2">
              Kenapa SIMPL?
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-3 mb-3">
              Fitur Lebih Lengkap, Harga 5x Lebih Hemat
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-base">
              Bandingkan sendiri. SIMPL memberikan semua yang bisnis Anda butuhkan tanpa biaya tersembunyi atau modul tambahan.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70">
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
      <section id="pricing" className="py-24 px-6 relative z-10 bg-white border-t border-slate-200">
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
              className="bg-white rounded-3xl p-8 lg:p-10 border-2 border-[#21AC3A] transition-colors duration-200 relative group"
            >
              {/* Recommended Badge */}
              <div className="absolute top-0 right-8 transform -translate-y-1/2">
                <span className="bg-[#21AC3A] text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Recommended
                </span>
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Paket UMKM</h3>
                <p className="text-slate-500 mb-6 min-h-[48px]">Semua yang UMKM butuhkan untuk jualan lebih rapi dan stok selalu terkontrol. Cukup satu aplikasi.</p>
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

              <button className="w-full py-4 rounded-xl font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732] transition-colors active:scale-95 duration-200 cursor-pointer">
                Mulai Gratis 14 Hari
              </button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-3xl p-8 lg:p-10 border border-slate-200 hover:border-slate-300 transition-colors duration-200 relative group"
            >
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Paket Enterprise</h3>
                <p className="text-slate-500 mb-6 min-h-[48px]">Untuk bisnis yang siap naik level. Kelola pelanggan, bangun loyalitas, dan atur tim dalam satu tempat.</p>
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

              <button className="w-full py-4 rounded-xl font-bold text-[#21AC3A] bg-[#21AC3A]/10 hover:bg-[#21AC3A]/20 transition-colors active:scale-95 duration-200 cursor-pointer">
                Tingkatkan Bisnis Anda
              </button>
            </motion.div>
          </div>

          {/* Simulation Money Spend Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-20 max-w-5xl mx-auto bg-slate-50 rounded-2xl p-8 lg:p-12 border border-slate-200"
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
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 md:p-8 flex flex-col justify-between">
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
      <footer className="border-t border-slate-200 bg-slate-50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 grayscale opacity-70">
            <img src="/simpl-logo-dark.png" alt="SIMPL Logo" className="h-6 object-contain" />
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Scalable Integrated Management System. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardIndex />} />
          <Route path="business/new" element={<NewBusinessPage />} />
          <Route path="branch/:id" element={<BranchLayout />}>
            <Route index element={<BranchDashboard />} />
            <Route path="inventory" element={<BranchInventory />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

