import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import {
  AlertCircle,
  Award,
  ChevronRight,
  Coins,
  Eye,
  Filter,
  Gift,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat2,
  Search,
  Trash2,
  UserRoundPlus,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  lifetimeValue: number;
  lastVisit: string | null;
  type: 'Returning' | 'New';
  loyaltyPoints: number;
  membershipActive: boolean;
};

type CustomerStats = {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  returning_rate: number;
  lifetime_value_idr: number;
};

type CustomerPurchase = {
  id: string;
  order_number: string;
  total_amount_idr: number;
  discount_amount_idr: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items: Array<{
    id: string;
    product_name: string;
    qty: number;
    unit_price_idr: number;
    subtotal_idr: number;
  }>;
};

type CustomerDetailResponse = {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    orders: number;
    lifetime_value_idr: number;
    last_visit: string | null;
    type: 'Returning' | 'New';
    loyalty_points: number;
    membership_active: boolean;
  };
  purchase_history: CustomerPurchase[];
  loyalty_point_logs: Array<{
    id: string;
    points_changed: number;
    type: string;
    created_at: string;
  }>;
};

type CustomerApiResponse = {
  data: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    orders: number;
    lifetime_value_idr: number;
    last_visit: string | null;
    type: 'Returning' | 'New';
    loyalty_points: number;
    membership_active: boolean;
  }>;
  total: number;
  stats: CustomerStats;
};

const emptyStats: CustomerStats = {
  total_customers: 0,
  new_customers: 0,
  returning_customers: 0,
  returning_rate: 0,
  lifetime_value_idr: 0,
};

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatLastVisit = (value: string | null) => {
  if (!value) return 'Belum ada kunjungan';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Belum ada kunjungan'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatPaymentStatus = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid': return 'Lunas';
    case 'refunded': return 'Dikembalikan';
    case 'pending': return 'Menunggu pembayaran';
    case 'failed': return 'Gagal';
    case 'cancelled':
    case 'canceled': return 'Dibatalkan';
    default: return status;
  }
};

const formatPaymentMethod = (method: string) => {
  switch (method.toLowerCase()) {
    case 'cash': return 'Tunai';
    case 'qris': return 'QRIS';
    case 'midtrans': return 'Midtrans';
    default: return method;
  }
};

export default function CustomersIndex() {
  const { id: branchId } = useParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>(emptyStats);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'returning' | 'new'>('all');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [actionMenuCustomerId, setActionMenuCustomerId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [membershipActive, setMembershipActive] = useState(true);
  const [pointsToAdjust, setPointsToAdjust] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [activeSection, setActiveSection] = useState<'customers' | 'loyalty'>('customers');

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    if (!branchId) return;

    const controller = new AbortController();
    const loadCustomers = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          type: customerFilter,
          page: String(currentPage),
          page_size: String(itemsPerPage),
        });
        const response = await fetch(`/api/branches/${branchId}/customers?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || 'Gagal memuat data pelanggan.');
        }

        const result = payload as CustomerApiResponse;
        setCustomers((result.data || []).map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          orders: customer.orders || 0,
          lifetimeValue: customer.lifetime_value_idr || 0,
          lastVisit: customer.last_visit,
          type: customer.type,
          loyaltyPoints: customer.loyalty_points || 0,
          membershipActive: customer.membership_active,
        })));
        setTotalItems(result.total || 0);
        setStats(result.stats || emptyStats);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Gagal memuat data pelanggan.';
        setErrorMessage(message);
        setCustomers([]);
        setTotalItems(0);
        setStats(emptyStats);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadCustomers();
    return () => controller.abort();
  }, [branchId, customerFilter, currentPage, itemsPerPage, reloadKey, searchQuery]);

  const handleSaveCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId) return;

    const isEditing = Boolean(editingCustomer);
    setIsSubmitting(true);
    setCreateError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const endpoint = editingCustomer
        ? `/api/branches/${branchId}/customers/${editingCustomer.id}`
        : `/api/branches/${branchId}/customers`;
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          membership_active: membershipActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || (isEditing ? 'Gagal memperbarui data pelanggan.' : 'Gagal menambahkan pelanggan.'));
      }

      setName('');
      setEmail('');
      setPhone('');
      if (!isEditing) {
        setSearchQuery('');
        setCustomerFilter('all');
        setCurrentPage(1);
      }
      setIsCreateOpen(false);
      setEditingCustomer(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : (isEditing ? 'Gagal memperbarui data pelanggan.' : 'Gagal menambahkan pelanggan.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
    setPhone('');
    setMembershipActive(true);
    setCreateError('');
    setIsCreateOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setMembershipActive(customer.membershipActive);
    setCreateError('');
    setIsCreateOpen(false);
    setActionMenuCustomerId(null);
  };

  const closeCustomerForm = () => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setEditingCustomer(null);
    setCreateError('');
  };

  const handleViewCustomer = async (customer: Customer) => {
    if (!branchId) return;
    setActionMenuCustomerId(null);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetail(null);
    setDetailError('');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/customers/${customer.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Gagal memuat detail pelanggan.');
      }
      setDetail(payload as CustomerDetailResponse);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Gagal memuat detail pelanggan.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleAdjustPoints = async (pointsDelta: number) => {
    if (!branchId || !detail || !Number.isInteger(pointsDelta) || pointsDelta === 0) return;
    setIsAdjustingPoints(true);
    setPointsError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/customers/${detail.customer.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ points_change: pointsDelta }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memperbarui poin pelanggan.');
      setPointsToAdjust('');
      setReloadKey((key) => key + 1);
      await handleViewCustomer({
        id: detail.customer.id,
        name: detail.customer.name,
        email: detail.customer.email || '',
        phone: detail.customer.phone || '',
        orders: detail.customer.orders,
        lifetimeValue: detail.customer.lifetime_value_idr,
        lastVisit: detail.customer.last_visit,
        type: detail.customer.type,
        loyaltyPoints: detail.customer.loyalty_points,
        membershipActive: detail.customer.membership_active,
      });
    } catch (error) {
      setPointsError(error instanceof Error ? error.message : 'Gagal memperbarui poin pelanggan.');
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  const handleArchiveCustomer = async () => {
    if (!branchId || !customerToArchive) return;
    setIsArchiving(true);
    setArchiveError('');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/customers/${customerToArchive.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Gagal mengarsipkan pelanggan.');
      }

      setCustomerToArchive(null);
      if (customers.length === 1 && currentPage > 1) setCurrentPage((page) => page - 1);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'Gagal mengarsipkan pelanggan.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Cabang</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-slate-700">Pelanggan</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pelanggan</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola profil pelanggan, keanggotaan, dan program loyalitas.</p>
        </div>
        {activeSection === 'customers' && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d9732]"
          >
            <Plus className="h-4 w-4" />
            Tambah pelanggan
          </button>
        )}
      </header>

      <nav className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1" aria-label="Bagian pelanggan">
        <button type="button" onClick={() => setActiveSection('customers')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeSection === 'customers' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}>
          Daftar pelanggan
        </button>
        <button type="button" onClick={() => setActiveSection('loyalty')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeSection === 'loyalty' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}>
          <Award className="h-4 w-4" /> Program loyalitas
        </button>
      </nav>

      {activeSection === 'customers' ? (
      <>
      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="shrink-0 font-semibold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      <section aria-label="Ringkasan pelanggan" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<UsersRound className="h-6 w-6" />}
          label="Total pelanggan"
          value={stats.total_customers.toLocaleString('id-ID')}
          tone="blue"
        />
        <MetricCard
          icon={<UserRoundPlus className="h-6 w-6" />}
          label="Pelanggan baru"
          value={stats.new_customers.toLocaleString('id-ID')}
          tone="green"
        />
        <MetricCard
          icon={<Repeat2 className="h-6 w-6" />}
          label="Tingkat pelanggan berulang"
          value={`${stats.returning_rate.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          tone="amber"
        />
        <MetricCard
          icon={<Wallet className="h-6 w-6" />}
          label="Total nilai belanja"
          value={formatRupiah(stats.lifetime_value_idr)}
          tone="violet"
        />
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau nomor telepon pelanggan..."
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="bg-transparent outline-none cursor-pointer"
                value={customerFilter}
                onChange={(event) => { setCustomerFilter(event.target.value as typeof customerFilter); setCurrentPage(1); }}
                aria-label="Filter pelanggan"
              >
                <option value="all">Semua pelanggan</option>
                <option value="returning">Pelanggan berulang</option>
                <option value="new">Pelanggan baru</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Pelanggan</th>
                <th className="px-6 py-4 font-semibold">Kontak</th>
                <th className="px-6 py-4 font-semibold">Transaksi</th>
                <th className="px-6 py-4 font-semibold">Total nilai belanja</th>
                <th className="px-6 py-4 font-semibold">Kunjungan terakhir</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Loyalitas & promo</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#21AC3A]" />
                      <p>Memuat data pelanggan...</p>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    {errorMessage ? 'Data pelanggan gagal dimuat.' : 'Pelanggan tidak ditemukan atau tidak sesuai dengan pencarian dan filter.'}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={customer.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {customer.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <p className="font-semibold text-slate-900">{customer.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      <p className="text-slate-700">{customer.phone || '—'}</p>
                      <p className="text-xs text-slate-500">{customer.email || 'Tidak ada email'}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{customer.orders.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{formatRupiah(customer.lifetimeValue)}</td>
                    <td className="px-6 py-4 text-slate-500">{formatLastVisit(customer.lastVisit)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${customer.type === 'Returning' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {customer.type === 'Returning' ? 'Pelanggan berulang' : 'Pelanggan baru'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${customer.membershipActive ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          <Award className="h-3.5 w-3.5" /> {customer.membershipActive ? `${customer.loyaltyPoints.toLocaleString('id-ID')} poin` : 'Non-member'}
                        </span>

                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          aria-label={`Tindakan lainnya untuk ${customer.name}`}
                          aria-expanded={actionMenuCustomerId === customer.id}
                          onClick={() => setActionMenuCustomerId((id) => id === customer.id ? null : customer.id)}
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {actionMenuCustomerId === customer.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                            <button type="button" onClick={() => void handleViewCustomer(customer)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Eye className="h-4 w-4" /> Lihat detail
                            </button>
                            <button type="button" onClick={() => openEditModal(customer)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Pencil className="h-4 w-4" /> Ubah data
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActionMenuCustomerId(null); setArchiveError(''); setCustomerToArchive(customer); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" /> Arsipkan
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(event) => {
                setItemsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#21AC3A]"
              aria-label="Jumlah pelanggan per halaman"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="whitespace-nowrap ml-2">
              Menampilkan {customers.length.toLocaleString('id-ID')} dari {totalItems.toLocaleString('id-ID')} pelanggan
            </span>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button type="button" className="px-3 py-1 bg-[#21AC3A] text-white rounded">{currentPage}</button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
        <LoyaltyPanel branchId={branchId} />
      )}

      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsDetailOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h2 id="customer-detail-title" className="text-xl font-bold text-slate-900">{detail?.customer.name || 'Detail pelanggan'}</h2>
                <p className="mt-1 text-sm text-slate-500">Profil dan riwayat pembelian pelanggan</p>
              </div>
              <button type="button" onClick={() => setIsDetailOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup detail">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {isDetailLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#21AC3A]" /> Memuat detail pelanggan...
                </div>
              ) : detailError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detailError}</div>
              ) : detail ? (
                <>
                  <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor telepon</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{detail.customer.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alamat email</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{detail.customer.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah transaksi</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{detail.customer.orders.toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total nilai belanja</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{formatRupiah(detail.customer.lifetime_value_idr)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keanggotaan</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{detail.customer.membership_active ? 'Anggota loyalitas' : 'Non-member'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Poin tersedia</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{detail.customer.loyalty_points.toLocaleString('id-ID')} poin</p>
                    </div>

                  </section>

                  {detail.customer.membership_active && (
                    <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900"><Coins className="h-4 w-4 text-amber-600" /> Kelola poin loyalitas</div>
                      <p className="mt-1 text-xs text-slate-500">Tambahkan poin atau catat penukaran poin pelanggan.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input type="number" min="1" step="1" value={pointsToAdjust} onChange={(event) => setPointsToAdjust(event.target.value)} aria-label="Jumlah poin" placeholder="Jumlah poin" className="min-w-32 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                        <button type="button" disabled={isAdjustingPoints || !Number.isInteger(Number(pointsToAdjust)) || Number(pointsToAdjust) <= 0} onClick={() => void handleAdjustPoints(Math.abs(Number(pointsToAdjust)))} className="rounded-lg bg-[#21AC3A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Tambah poin</button>
                        <button type="button" disabled={isAdjustingPoints || !Number.isInteger(Number(pointsToAdjust)) || Number(pointsToAdjust) <= 0 || detail.customer.loyalty_points < Number(pointsToAdjust)} onClick={() => void handleAdjustPoints(-Math.abs(Number(pointsToAdjust)))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Catat penukaran</button>
                      </div>
                      {pointsError && <p role="alert" className="mt-2 text-sm text-red-600">{pointsError}</p>}
                      <div className="mt-4 border-t border-amber-200 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aktivitas poin terbaru</p>
                        {detail.loyalty_point_logs.length === 0 ? <p className="text-sm text-slate-500">Belum ada aktivitas poin.</p> : (
                          <ul className="space-y-1.5">
                            {detail.loyalty_point_logs.slice(0, 5).map((log) => (
                              <li key={log.id} className="flex justify-between gap-3 text-sm text-slate-600"><span>{log.type === 'redeemed' ? 'Penukaran' : 'Poin ditambahkan'} · {formatDateTime(log.created_at)}</span><span className={log.points_changed < 0 ? 'text-red-600' : 'text-emerald-700'}>{log.points_changed > 0 ? '+' : ''}{log.points_changed}</span></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  )}

                  <section className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Riwayat pembelian</h3>
                      <span className="text-sm text-slate-500">{detail.purchase_history.length.toLocaleString('id-ID')} transaksi</span>
                    </div>
                    {detail.purchase_history.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Belum ada riwayat pembelian.</div>
                    ) : (
                      <div className="space-y-3">
                        {detail.purchase_history.map((purchase) => (
                          <article key={purchase.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{purchase.order_number}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatDateTime(purchase.created_at)} · {formatPaymentMethod(purchase.payment_method)}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${purchase.payment_status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {formatPaymentStatus(purchase.payment_status)}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                              {purchase.items.map((item) => (
                                <div key={item.id} className="flex justify-between gap-4 text-sm text-slate-600">
                                  <span>{item.product_name} <span className="text-slate-400">× {item.qty.toLocaleString('id-ID')}</span></span>
                                  <span className="shrink-0">{formatRupiah(item.subtotal_idr)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-bold text-slate-900">
                              <span>Total</span>
                              <span>{formatRupiah(purchase.total_amount_idr)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : null}
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5">
              <button type="button" onClick={() => setIsDetailOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tutup</button>
              {detail && !isDetailLoading && (
                <button
                  type="button"
                  onClick={() => {
                    const customer = detail.customer;
                    setIsDetailOpen(false);
                    openEditModal({ id: customer.id, name: customer.name, email: customer.email || '', phone: customer.phone || '', orders: customer.orders, lifetimeValue: customer.lifetime_value_idr, lastVisit: customer.last_visit, type: customer.type, loyaltyPoints: customer.loyalty_points, membershipActive: customer.membership_active });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#21AC3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d9732]"
                >
                  <Pencil className="h-4 w-4" /> Ubah data
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {customerToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isArchiving && setCustomerToArchive(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-customer-title"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <h2 id="archive-customer-title" className="text-lg font-bold text-slate-900">Arsipkan pelanggan?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Profil <span className="font-semibold text-slate-900">{customerToArchive.name}</span> akan diarsipkan dan tidak lagi muncul di daftar pelanggan. Riwayat transaksinya tetap tersimpan.
            </p>
            {archiveError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{archiveError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCustomerToArchive(null)} disabled={isArchiving} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
              <button type="button" onClick={() => void handleArchiveCustomer()} disabled={isArchiving} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70">
                {isArchiving && <Loader2 className="h-4 w-4 animate-spin" />} Arsipkan pelanggan
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {(isCreateOpen || editingCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeCustomerForm} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-customer-title"
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h2 id="create-customer-title" className="text-xl font-bold text-slate-900">{editingCustomer ? 'Ubah data pelanggan' : 'Tambah pelanggan'}</h2>
                <p className="mt-1 text-sm text-slate-500">{editingCustomer ? 'Perbarui informasi kontak pelanggan.' : 'Buat profil pelanggan untuk bisnis ini.'}</p>
              </div>
              <button
                type="button"
                onClick={closeCustomerForm}
                disabled={isSubmitting}
                className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {createError && (
                <div role="alert" className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              <form id="add-customer-form" onSubmit={handleSaveCustomer} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="customer-name" className="text-sm font-semibold text-slate-700">Nama</label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nama pelanggan"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 transition-all focus:border-[#21AC3A] focus:outline-none focus:ring-1 focus:ring-[#21AC3A]"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="customer-phone" className="text-sm font-semibold text-slate-700">Nomor telepon</label>
                  <input
                    id="customer-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+62 ..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 transition-all focus:border-[#21AC3A] focus:outline-none focus:ring-1 focus:ring-[#21AC3A]"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="customer-email" className="text-sm font-semibold text-slate-700">Alamat email</label>
                  <input
                    id="customer-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="pelanggan@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 transition-all focus:border-[#21AC3A] focus:outline-none focus:ring-1 focus:ring-[#21AC3A]"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" checked={membershipActive} onChange={(event) => setMembershipActive(event.target.checked)} className="mt-1 h-4 w-4 accent-[#21AC3A]" />
                  <span><span className="block text-sm font-semibold text-slate-800">Anggota program loyalitas</span><span className="mt-1 block text-xs text-slate-500">Pelanggan dapat mengumpulkan poin dan menukarkannya dengan hadiah.</span></span>
                </label>


              </form>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 p-6">
              <button
                type="button"
                onClick={closeCustomerForm}
                disabled={isSubmitting}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-customer-form"
                disabled={!branchId || isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-[#21AC3A] px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#21AC3A]/20 transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : editingCustomer ? 'Simpan perubahan' : 'Tambah pelanggan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

type LoyaltyReward = {
  id: string;
  name: string;
  points_required: number;
  discount_amount_idr: number;
  is_active: boolean;
};

function LoyaltyPanel({ branchId }: { branchId: string | undefined }) {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [discount, setDiscount] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/loyalty-rewards`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal memuat hadiah loyalitas.');
        setRewards(payload.data || []);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat hadiah loyalitas.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [branchId, reloadKey]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setPoints('');
    setDiscount('');
    setIsActive(true);
  };

  const saveReward = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/loyalty-rewards${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          points_required: Number(points),
          discount_amount_idr: Number(discount),
          is_active: isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan hadiah loyalitas.');
      resetForm();
      setReloadKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan hadiah loyalitas.');
    } finally {
      setSaving(false);
    }
  };

  const editReward = (reward: LoyaltyReward) => {
    setEditing(reward);
    setName(reward.name);
    setPoints(String(reward.points_required));
    setDiscount(String(reward.discount_amount_idr));
    setIsActive(reward.is_active);
  };

  const deleteReward = async (reward: LoyaltyReward) => {
    if (!branchId || !window.confirm(`Hapus hadiah "${reward.name}"?`)) return;
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/loyalty-rewards/${reward.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menghapus hadiah loyalitas.');
      if (editing?.id === reward.id) resetForm();
      setReloadKey((key) => key + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus hadiah loyalitas.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-linear-to-r from-emerald-50 to-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white p-3 text-emerald-700 shadow-sm"><Gift className="h-6 w-6" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Program poin & hadiah</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Buat hadiah diskon yang bisa ditukar menggunakan poin pelanggan. Atur poin melalui detail pelanggan; riwayat penambahan dan penukaran tercatat otomatis.</p>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <form onSubmit={saveReward} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="font-bold text-slate-900">{editing ? 'Ubah hadiah' : 'Tambah hadiah'}</h3>
            <p className="mt-1 text-sm text-slate-500">Tentukan jumlah poin dan diskon yang diterima.</p>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Nama hadiah
            <input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Diskon member Rp10.000" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Poin yang dibutuhkan
            <input required min="1" type="number" value={points} onChange={(event) => setPoints(event.target.value)} placeholder="500" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Nilai diskon (Rp)
            <input required min="1" type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="10000" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" />
          </label>
          {editing && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-[#21AC3A]" /> Hadiah aktif</label>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d9732] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? 'Simpan perubahan' : 'Tambah hadiah'}</button>
            {editing && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Batal</button>}
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div><h3 className="font-bold text-slate-900">Daftar hadiah</h3><p className="mt-1 text-sm text-slate-500">{rewards.length} hadiah terdaftar</p></div>
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#21AC3A]" /></div> : rewards.length === 0 ? (
            <div className="px-5 py-12 text-center"><Gift className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Belum ada hadiah</p><p className="mt-1 text-sm text-slate-500">Tambahkan hadiah untuk memulai program loyalitas.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rewards.map((reward) => (
                <article key={reward.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h4 className="font-semibold text-slate-900">{reward.name}</h4><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${reward.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{reward.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
                    <p className="mt-1 text-sm text-slate-500">{reward.points_required.toLocaleString('id-ID')} poin <span className="mx-1">·</span> Diskon {formatRupiah(reward.discount_amount_idr)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editReward(reward)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Ubah</button>
                    <button type="button" onClick={() => void deleteReward(reward)} className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">Hapus</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Catatan: hadiah dan poin tercatat di profil pelanggan; penerapan diskon hadiah pada POS perlu dihubungkan ke alur checkout.</p>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'violet' | 'amber';
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`shrink-0 rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <h3 className="mt-1 truncate text-2xl font-bold text-slate-900" title={value}>{value}</h3>
      </div>
    </div>
  );
}
