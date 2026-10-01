import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

import {
  AlertCircle,
  Award,
  Coins,
  Eye,
  Filter,
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
    points_balance_after?: number | null;
    type: string;
    reason?: string;
    reward_id?: string | null;
    reward_name?: string;
    discount_type?: 'fixed' | 'percentage';
    discount_amount_idr?: number;
    discount_percentage?: number;
    max_discount_amount_idr?: number | null;
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

const formatRewardDiscount = (reward: LoyaltyReward) => reward.discount_type === 'percentage'
  ? `${reward.discount_percentage}%${reward.max_discount_amount_idr ? ` (maks. ${formatRupiah(reward.max_discount_amount_idr)})` : ''}`
  : formatRupiah(reward.discount_amount_idr);

const toDateTimeInputValue = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const getRewardUnavailableReason = (
  reward: LoyaltyReward,
  customerLogs: CustomerDetailResponse['loyalty_point_logs'] = [],
  customerID?: string,
) => {
  const now = Date.now();
  if (!reward.is_active) return 'Nonaktif';
  if (reward.starts_at && new Date(reward.starts_at).getTime() > now) return `Mulai ${formatDateTime(reward.starts_at)}`;
  if (reward.ends_at && new Date(reward.ends_at).getTime() <= now) return 'Masa berlaku berakhir';
  if (reward.usage_limit != null && reward.usage_count >= reward.usage_limit) return 'Kuota habis';
  if (reward.customer_ids.length > 0 && (!customerID || !reward.customer_ids.includes(customerID))) return 'Khusus pelanggan terpilih';
  if (reward.per_customer_limit != null) {
    const redemptions = customerLogs.filter((log) => log.type === 'redeemed' && log.reward_id === reward.id).length;
    if (redemptions >= reward.per_customer_limit) return 'Batas per pelanggan tercapai';
  }
  return '';
};

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
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number } | null>(null);
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
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentRequestID, setAdjustmentRequestID] = useState('');
  const [selectedRewardID, setSelectedRewardID] = useState('');
  const [redemptionRequestID, setRedemptionRequestID] = useState('');
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [rewardLoadError, setRewardLoadError] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [activeSection, setActiveSection] = useState<'customers' | 'loyalty'>('customers');

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    if (!actionMenuCustomerId) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-customer-action-menu], [data-customer-action-trigger]')) return;
      setActionMenuCustomerId(null);
      setActionMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionMenuCustomerId(null);
        setActionMenuPosition(null);
      }
    };
    const closeOnScroll = () => {
      setActionMenuCustomerId(null);
      setActionMenuPosition(null);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [actionMenuCustomerId]);

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    const loadRewards = async () => {
      setRewardLoadError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/loyalty-rewards`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal memuat pilihan hadiah.');
        setAvailableRewards((payload.data || []).filter((reward: LoyaltyReward) => reward.is_active));
      } catch (error) {
        if (!controller.signal.aborted) setRewardLoadError(error instanceof Error ? error.message : 'Gagal memuat pilihan hadiah.');
      }
    };
    void loadRewards();
    return () => controller.abort();
  }, [branchId, activeSection]);

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
    setActionMenuCustomerId(null);
    setActionMenuPosition(null);
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
    if (detail?.customer.id !== customer.id) {
      setPointsToAdjust('');
      setAdjustmentReason('');
      setAdjustmentRequestID('');
      setSelectedRewardID('');
      setRedemptionRequestID('');
      setPointsError('');
    }
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

  const refreshCustomerDetail = async () => {
    if (!detail) return;
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
  };

  const handleAdjustPoints = async () => {
    if (!branchId || !detail || !Number.isInteger(Number(pointsToAdjust)) || Number(pointsToAdjust) === 0 || !adjustmentReason.trim()) return;
    setIsAdjustingPoints(true);
    setPointsError('');
    const requestID = adjustmentRequestID || crypto.randomUUID();
    setAdjustmentRequestID(requestID);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/customers/${detail.customer.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ points_change: Number(pointsToAdjust), reason: adjustmentReason.trim(), request_id: requestID }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal mencatat penyesuaian poin.');
      setPointsToAdjust('');
      setAdjustmentReason('');
      setAdjustmentRequestID('');
      setReloadKey((key) => key + 1);
      await refreshCustomerDetail();
    } catch (error) {
      setPointsError(error instanceof Error ? error.message : 'Gagal mencatat penyesuaian poin.');
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  const handleRedeemReward = async () => {
    if (!branchId || !detail || !selectedRewardID) return;
    const selectedReward = availableRewards.find((reward) => reward.id === selectedRewardID);
    if (!selectedReward) return;
    const unavailableReason = getRewardUnavailableReason(selectedReward, detail.loyalty_point_logs, detail.customer.id);
    if (unavailableReason) {
      setPointsError(unavailableReason);
      return;
    }
    if (detail.customer.loyalty_points < selectedReward.points_required) {
      setPointsError('Saldo poin tidak cukup untuk menukar hadiah ini.');
      return;
    }
    setIsAdjustingPoints(true);
    setPointsError('');
    const requestID = redemptionRequestID || crypto.randomUUID();
    setRedemptionRequestID(requestID);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/customers/${detail.customer.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reward_id: selectedRewardID, request_id: requestID }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menukarkan hadiah.');
      setSelectedRewardID('');
      setRedemptionRequestID('');
      setReloadKey((key) => key + 1);
      await refreshCustomerDetail();
    } catch (error) {
      setPointsError(error instanceof Error ? error.message : 'Gagal menukarkan hadiah.');
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
      <header className="border-b border-slate-200 pb-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium text-[#21AC3A]">SIMPL</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Manajemen pelanggan</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Manajemen pelanggan</h1>
        <p className="mt-1 text-sm text-slate-500">Profil, segmen, dan riwayat pembelian pelanggan.</p>
      </header>

      <nav className="mb-4 flex items-center overflow-x-auto border border-slate-200 bg-white" aria-label="Bagian pelanggan" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'customers'}
          onClick={() => setActiveSection('customers')}
          className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeSection === 'customers' ? 'bg-green-50 text-[#21AC3A]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <UsersRound className="h-4 w-4" />
          Daftar pelanggan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'loyalty'}
          onClick={() => setActiveSection('loyalty')}
          className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeSection === 'loyalty' ? 'bg-green-50 text-[#21AC3A]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <Award className="h-4 w-4" />
          Program loyalitas
        </button>
      </nav>

      {activeSection === 'customers' ? (
      <>
      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="shrink-0 font-semibold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      <section aria-label="Ringkasan pelanggan" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<UsersRound className="h-4 w-4" />}
          label="Total pelanggan"
          value={stats.total_customers.toLocaleString('id-ID')}
          note="Profil terdaftar"
          tone="blue"
        />
        <MetricCard
          icon={<Repeat2 className="h-4 w-4" />}
          label="Tingkat pelanggan berulang"
          value={`${stats.returning_rate.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          note={`${stats.returning_customers.toLocaleString('id-ID')} pelanggan kembali`}
          tone="green"
        />
        <MetricCard
          icon={<Wallet className="h-4 w-4" />}
          label="Rata-rata belanja pelanggan"
          value={formatRupiah(stats.total_customers ? Math.round(stats.lifetime_value_idr / stats.total_customers) : 0)}
          note="Total nilai belanja per profil"
          tone="blue"
        />
        <MetricCard
          icon={<UserRoundPlus className="h-4 w-4" />}
          label="Pelanggan baru"
          value={stats.new_customers.toLocaleString('id-ID')}
          note="Belum lebih dari 1 transaksi lunas"
          tone="amber"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 overflow-hidden border border-slate-300 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-300 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Direktori pelanggan</h2>
            <p className="mt-0.5 text-xs text-slate-500">{stats.total_customers.toLocaleString('id-ID')} profil · Pelanggan baru dan berulang</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-10 items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732]"
          >
            <Plus className="h-4 w-4" />
            Tambah pelanggan
          </button>
        </div>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-300 px-3 py-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau nomor telepon pelanggan..."
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
              className="min-h-10 w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex min-h-10 items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="cursor-pointer bg-transparent outline-none"
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
            <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Pelanggan</th>
                <th className="px-3 py-3 font-semibold">Segmen</th>
                <th className="px-3 py-3 font-semibold">Pesanan</th>
                <th className="px-3 py-3 font-semibold">Belanja seumur hidup</th>
                <th className="px-3 py-3 font-semibold">Pesanan terakhir</th>
                <th className="px-3 py-3 font-semibold">Loyalitas</th>
                <th className="px-3 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#21AC3A]" />
                      <p>Memuat data pelanggan...</p>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
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
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-56 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-xs font-bold text-[#16852A]">
                          {customer.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{customer.name}</p>
                          <p className="truncate text-xs text-slate-500">{customer.phone || customer.email || 'Kontak belum tersedia'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${customer.type === 'Returning' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {customer.type === 'Returning' ? 'Berulang' : 'Baru'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{customer.orders.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{formatRupiah(customer.lifetimeValue)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatLastVisit(customer.lastVisit)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${customer.membershipActive ? 'text-amber-700' : 'text-slate-500'}`}>
                        <Award className="h-3.5 w-3.5" /> {customer.membershipActive ? `${customer.loyaltyPoints.toLocaleString('id-ID')} poin` : 'Non-member'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          aria-label={`Tindakan lainnya untuk ${customer.name}`}
                          aria-expanded={actionMenuCustomerId === customer.id}
                          data-customer-action-trigger
                          onClick={(event) => {
                            if (actionMenuCustomerId === customer.id) {
                              setActionMenuCustomerId(null);
                              setActionMenuPosition(null);
                              return;
                            }
                            const rect = event.currentTarget.getBoundingClientRect();
                            const menuHeight = 132;
                            const opensAbove = rect.bottom + menuHeight > window.innerHeight - 8;
                            setActionMenuPosition({
                              top: opensAbove ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
                              right: Math.max(8, window.innerWidth - rect.right),
                            });
                            setActionMenuCustomerId(customer.id);
                          }}
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {actionMenuCustomerId === customer.id && actionMenuPosition && createPortal(
                          <div
                            data-customer-action-menu
                            style={{ top: actionMenuPosition.top, right: actionMenuPosition.right }}
                            className="fixed z-100 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
                          >
                            <button type="button" onClick={() => void handleViewCustomer(customer)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Eye className="h-4 w-4" /> Lihat detail
                            </button>
                            <button type="button" onClick={() => openEditModal(customer)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <Pencil className="h-4 w-4" /> Ubah data
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuCustomerId(null);
                                setActionMenuPosition(null);
                                setArchiveError('');
                                setCustomerToArchive(customer);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" /> Arsipkan
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-300 px-3 py-3 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(event) => {
                setItemsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-300 bg-white px-2 py-1 outline-none focus:border-[#21AC3A]"
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
              className="border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button type="button" className="bg-[#21AC3A] px-3 py-1 text-white">{currentPage}</button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="border border-slate-300 bg-white">
          <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Wawasan pelanggan</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ringkasan aktivitas pembelian</p>
            </div>
            <Repeat2 className="h-4 w-4 text-[#21AC3A]" />
          </div>
          <div className="p-4">
            <p className="text-sm leading-6 text-slate-700">
              <span className="font-semibold">{stats.returning_rate.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span> pelanggan telah melakukan lebih dari satu transaksi lunas.
            </p>
            <div className="mt-4 border-l-2 border-[#0875d1] bg-blue-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#0875d1]">Saran tindakan</p>
              <p className="mt-1 text-sm text-slate-700">Tinjau pelanggan berulang untuk memahami kebiasaan belanja mereka.</p>
              <button
                type="button"
                onClick={() => { setCustomerFilter('returning'); setCurrentPage(1); }}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#21AC3A]"
              >
                Lihat pelanggan berulang <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>

        <section className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Segmen pelanggan</h2>
            <p className="mt-0.5 text-xs text-slate-500">Diperbarui dari transaksi lunas</p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => { setCustomerFilter('returning'); setCurrentPage(1); }}
              className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-slate-700"><span className="h-2 w-2 bg-green-700" />Pelanggan berulang</span>
              <span className="font-semibold text-slate-900">{stats.returning_customers.toLocaleString('id-ID')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setCustomerFilter('new'); setCurrentPage(1); }}
              className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-slate-700"><span className="h-2 w-2 bg-slate-500" />Pelanggan baru</span>
              <span className="font-semibold text-slate-900">{stats.new_customers.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </section>
      </aside>
      </div>
      </>
      ) : (
        <LoyaltyPanel branchId={branchId} />
      )}

      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setIsDetailOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-300 p-5">
              <div>
                <h2 id="customer-detail-title" className="text-lg font-semibold text-slate-900">{detail?.customer.name || 'Detail pelanggan'}</h2>
                <p className="mt-1 text-sm text-slate-500">Profil dan riwayat pembelian pelanggan</p>
              </div>
              <button type="button" onClick={() => setIsDetailOpen(false)} className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A]" aria-label="Tutup detail">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              {isDetailLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#21AC3A]" /> Memuat detail pelanggan...
                </div>
              ) : detailError ? (
                <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detailError}</div>
              ) : detail ? (
                <>
                  <section className="grid gap-4 border border-slate-300 bg-slate-50 p-4 sm:grid-cols-2">
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
                    <section className="mt-6 border border-amber-200 bg-amber-50/60 p-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900"><Coins className="h-4 w-4 text-amber-600" /> Kelola poin loyalitas</div>
                      <p className="mt-1 text-xs text-slate-500">Koreksi saldo wajib disertai alasan. Penukaran hanya bisa dilakukan lewat hadiah aktif dengan saldo poin yang mencukupi.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                        <input type="number" min="-1000000" max="1000000" step="1" value={pointsToAdjust} onChange={(event) => { setPointsToAdjust(event.target.value); setAdjustmentRequestID(''); }} aria-label="Jumlah poin koreksi" placeholder="+/- jumlah poin" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                        <input type="text" maxLength={255} value={adjustmentReason} onChange={(event) => { setAdjustmentReason(event.target.value); setAdjustmentRequestID(''); }} aria-label="Alasan penyesuaian poin" placeholder="Alasan, mis. bonus loyalitas" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                        <button type="button" disabled={isAdjustingPoints || !Number.isInteger(Number(pointsToAdjust)) || Number(pointsToAdjust) === 0 || Math.abs(Number(pointsToAdjust)) > 1000000 || !adjustmentReason.trim()} onClick={() => void handleAdjustPoints()} className="rounded-lg bg-[#21AC3A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan koreksi</button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <select value={selectedRewardID} onChange={(event) => { setSelectedRewardID(event.target.value); setRedemptionRequestID(''); }} aria-label="Pilih hadiah untuk ditukar" className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Pilih hadiah yang akan ditukar</option>
                          {availableRewards.map((reward) => {
                            const unavailableReason = getRewardUnavailableReason(reward, detail.loyalty_point_logs, detail.customer.id);
                            const lacksPoints = detail.customer.loyalty_points < reward.points_required;
                            return <option key={reward.id} value={reward.id} disabled={Boolean(unavailableReason) || lacksPoints}>{reward.name} — {reward.points_required.toLocaleString('id-ID')} poin · {formatRewardDiscount(reward)}{unavailableReason ? ` · ${unavailableReason}` : lacksPoints ? ' · poin tidak cukup' : ''}</option>;
                          })}
                        </select>
                        <button type="button" disabled={isAdjustingPoints || !selectedRewardID || !availableRewards.some((reward) => reward.id === selectedRewardID && !getRewardUnavailableReason(reward, detail.loyalty_point_logs, detail.customer.id) && detail.customer.loyalty_points >= reward.points_required)} onClick={() => void handleRedeemReward()} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Tukar hadiah</button>
                      </div>
                      {selectedRewardID && availableRewards.find((reward) => reward.id === selectedRewardID) && (() => {
                        const reward = availableRewards.find((item) => item.id === selectedRewardID)!;
                        const unavailableReason = getRewardUnavailableReason(reward, detail.loyalty_point_logs, detail.customer.id);
                        return <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-800">{formatRewardDiscount(reward)} · {reward.points_required.toLocaleString('id-ID')} poin</span>{unavailableReason && <span className="text-xs font-semibold text-amber-700">{unavailableReason}</span>}</div>
                          {reward.description && <p className="mt-1 text-slate-600">{reward.description}</p>}
                          {reward.terms_and_conditions && <p className="mt-1 text-xs text-slate-500">Syarat: {reward.terms_and_conditions}</p>}
                          {reward.usage_limit != null && <p className="mt-1 text-xs text-slate-500">Kuota: {reward.usage_count.toLocaleString('id-ID')} / {reward.usage_limit.toLocaleString('id-ID')} penukaran</p>}
                          {reward.per_customer_limit != null && <p className="mt-1 text-xs text-slate-500">Maksimal {reward.per_customer_limit.toLocaleString('id-ID')} kali per pelanggan</p>}
                          {(reward.starts_at || reward.ends_at) && <p className="mt-1 text-xs text-slate-500">Masa berlaku: {reward.starts_at ? formatDateTime(reward.starts_at) : 'sekarang'} – {reward.ends_at ? formatDateTime(reward.ends_at) : 'tanpa batas'}</p>}
                        </div>;
                      })()}
                      {rewardLoadError && <p role="alert" className="mt-2 text-sm text-red-600">{rewardLoadError}</p>}
                      {pointsError && <p role="alert" className="mt-2 text-sm text-red-600">{pointsError}</p>}
                      <div className="mt-4 border-t border-amber-200 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Buku besar poin terbaru</p>
                        {detail.loyalty_point_logs.length === 0 ? <p className="text-sm text-slate-500">Belum ada aktivitas poin.</p> : (
                          <ul className="space-y-2">
                            {detail.loyalty_point_logs.slice(0, 10).map((log) => (
                              <li key={log.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-slate-600">
                                <span>{log.reward_name ? `Penukaran: ${log.reward_name} (${log.discount_type === 'percentage' ? `${log.discount_percentage || 0}%${log.max_discount_amount_idr ? `, maks. ${formatRupiah(log.max_discount_amount_idr)}` : ''}` : formatRupiah(log.discount_amount_idr || 0)})` : log.reason || (log.type === 'redeemed' ? 'Penukaran poin' : 'Poin ditambahkan')} · {formatDateTime(log.created_at)}</span>
                                <span className="font-semibold"><span className={log.points_changed < 0 ? 'text-red-600' : 'text-emerald-700'}>{log.points_changed > 0 ? '+' : ''}{log.points_changed}</span>{log.points_balance_after != null && <span className="ml-2 text-xs font-normal text-slate-400">saldo {log.points_balance_after}</span>}</span>
                              </li>
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
                      <div className="border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Belum ada riwayat pembelian.</div>
                    ) : (
                      <div className="space-y-3">
                        {detail.purchase_history.map((purchase) => (
                          <article key={purchase.id} className="border border-slate-300 p-4">
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
            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-300 bg-slate-50 p-4">
              <button type="button" onClick={() => setIsDetailOpen(false)} className="min-h-10 border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">Tutup</button>
              {detail && !isDetailLoading && (
                <button
                  type="button"
                  onClick={() => {
                    const customer = detail.customer;
                    setIsDetailOpen(false);
                    openEditModal({ id: customer.id, name: customer.name, email: customer.email || '', phone: customer.phone || '', orders: customer.orders, lifetimeValue: customer.lifetime_value_idr, lastVisit: customer.last_visit, type: customer.type, loyaltyPoints: customer.loyalty_points, membershipActive: customer.membership_active });
                  }}
                  className="inline-flex min-h-10 items-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732]"
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
          <div className="absolute inset-0 bg-slate-950/40" onClick={closeCustomerForm} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-customer-title"
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-300 p-5">
              <div>
                <h2 id="create-customer-title" className="text-lg font-semibold text-slate-900">{editingCustomer ? 'Ubah data pelanggan' : 'Tambah pelanggan'}</h2>
                <p className="mt-1 text-sm text-slate-500">{editingCustomer ? 'Perbarui informasi kontak pelanggan.' : 'Buat profil pelanggan untuk bisnis ini.'}</p>
              </div>
              <button
                type="button"
                onClick={closeCustomerForm}
                disabled={isSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {createError && (
                <div role="alert" className="mb-5 flex items-center gap-2 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              <form id="add-customer-form" onSubmit={handleSaveCustomer} className="space-y-5">
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
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
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
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
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
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 border border-slate-300 bg-slate-50 p-4 transition-colors hover:bg-green-50">
                  <input type="checkbox" checked={membershipActive} onChange={(event) => setMembershipActive(event.target.checked)} className="mt-1 h-4 w-4 accent-[#21AC3A]" />
                  <span><span className="block text-sm font-semibold text-slate-800">Anggota program loyalitas</span><span className="mt-1 block text-xs text-slate-500">Pelanggan dapat mengumpulkan poin dan menukarkannya dengan hadiah.</span></span>
                </label>


              </form>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-300 bg-slate-50 p-4">
              <button
                type="button"
                onClick={closeCustomerForm}
                disabled={isSubmitting}
                className="min-h-10 cursor-pointer border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-customer-form"
                disabled={!branchId || isSubmitting}
                className="flex min-h-10 items-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-70"
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
  description: string;
  terms_and_conditions: string;
  points_required: number;
  discount_type: 'fixed' | 'percentage';
  discount_amount_idr: number;
  discount_percentage: number;
  max_discount_amount_idr: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  customer_ids: string[];
  is_active: boolean;
};

function LoyaltyPanel({ branchId }: { branchId: string | undefined }) {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rewardSearch, setRewardSearch] = useState('');
  const [rewardStatusFilter, setRewardStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [points, setPoints] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discount, setDiscount] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string; email: string; membership_active: boolean }>>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [targetSpecificCustomers, setTargetSpecificCustomers] = useState(false);
  const [targetCustomerIDs, setTargetCustomerIDs] = useState<string[]>([]);

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

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    const loadCustomers = async () => {
      setCustomersLoading(true);
      setCustomerLoadError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const allCustomers: Array<{ id: string; name: string; phone: string; email: string; membership_active: boolean }> = [];
        let total = Number.POSITIVE_INFINITY;
        let page = 1;
        while (allCustomers.length < total) {
          const params = new URLSearchParams({ page: String(page), page_size: '100', type: 'all' });
          const response = await fetch(`/api/branches/${branchId}/customers?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Gagal memuat daftar pelanggan untuk penargetan hadiah.');
          const pageCustomers = payload.data || [];
          allCustomers.push(...pageCustomers);
          total = Number(payload.total || 0);
          if (pageCustomers.length === 0) break;
          page += 1;
        }
        setCustomers(allCustomers);
      } catch (loadError) {
        if (!controller.signal.aborted) setCustomerLoadError(loadError instanceof Error ? loadError.message : 'Gagal memuat daftar pelanggan.');
      } finally {
        if (!controller.signal.aborted) setCustomersLoading(false);
      }
    };
    void loadCustomers();
    return () => controller.abort();
  }, [branchId]);

  const resetForm = () => {
    setEditing(null);
    setIsFormOpen(false);
    setName('');
    setDescription('');
    setTermsAndConditions('');
    setPoints('');
    setDiscountType('fixed');
    setDiscount('');
    setDiscountPercentage('');
    setMaxDiscount('');
    setUsageLimit('');
    setPerCustomerLimit('');
    setStartsAt('');
    setEndsAt('');
    setIsActive(true);
    setTargetSpecificCustomers(false);
    setTargetCustomerIDs([]);
    setCustomerSearch('');
  };

  const saveReward = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId) return;
    if (targetSpecificCustomers && targetCustomerIDs.length === 0) {
      setError('Pilih setidaknya satu pelanggan atau ubah target hadiah menjadi semua pelanggan.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/loyalty-rewards${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          terms_and_conditions: termsAndConditions.trim(),
          points_required: Number(points),
          discount_type: discountType,
          discount_amount_idr: discountType === 'fixed' ? Number(discount) : 0,
          discount_percentage: discountType === 'percentage' ? Number(discountPercentage) : 0,
          max_discount_amount_idr: discountType === 'percentage' && maxDiscount ? Number(maxDiscount) : null,
          usage_limit: usageLimit ? Number(usageLimit) : null,
          per_customer_limit: perCustomerLimit ? Number(perCustomerLimit) : null,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          customer_ids: targetSpecificCustomers ? targetCustomerIDs : [],
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
    setIsFormOpen(true);
    setName(reward.name);
    setDescription(reward.description || '');
    setTermsAndConditions(reward.terms_and_conditions || '');
    setPoints(String(reward.points_required));
    setDiscountType(reward.discount_type || 'fixed');
    setDiscount(String(reward.discount_amount_idr || ''));
    setDiscountPercentage(String(reward.discount_percentage || ''));
    setMaxDiscount(reward.max_discount_amount_idr == null ? '' : String(reward.max_discount_amount_idr));
    setUsageLimit(reward.usage_limit == null ? '' : String(reward.usage_limit));
    setPerCustomerLimit(reward.per_customer_limit == null ? '' : String(reward.per_customer_limit));
    setStartsAt(toDateTimeInputValue(reward.starts_at));
    setEndsAt(toDateTimeInputValue(reward.ends_at));
    const assignedCustomerIDs = reward.customer_ids || [];
    setTargetSpecificCustomers(assignedCustomerIDs.length > 0);
    setTargetCustomerIDs(assignedCustomerIDs);
    setCustomerSearch('');
    setIsActive(reward.is_active);
  };

  const filteredRewards = rewards.filter((reward) => {
    const matchesSearch = `${reward.name} ${reward.description} ${reward.terms_and_conditions}`.toLowerCase().includes(rewardSearch.trim().toLowerCase());
    const matchesStatus = rewardStatusFilter === 'all' || (rewardStatusFilter === 'active' ? reward.is_active : !reward.is_active);
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRewards.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const visibleRewards = filteredRewards.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const deleteReward = async (reward: LoyaltyReward) => {
    if (!branchId || !window.confirm(`Nonaktifkan hadiah "${reward.name}"? Hadiah tetap tersimpan di riwayat penukaran.`)) return;
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/branches/${branchId}/loyalty-rewards/${reward.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menonaktifkan hadiah loyalitas.');
      if (editing?.id === reward.id) resetForm();
      setReloadKey((key) => key + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Gagal menonaktifkan hadiah loyalitas.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Daftar hadiah loyalitas</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola hadiah, kuota, dan pelanggan yang dapat menukarkannya.</p>
        </div>
        <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732]">
          <Plus className="h-4 w-4" /> Tambah hadiah
        </button>
      </div>
      {error && <div role="alert" className=" border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col overflow-hidden border border-slate-300 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-300 px-3 py-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={rewardSearch} onChange={(event) => { setRewardSearch(event.target.value); setCurrentPage(1); }} placeholder="Cari nama atau deskripsi hadiah..." aria-label="Cari hadiah" className="min-h-10 w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </div>
          <div className="flex min-h-10 items-center gap-2 self-start border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:self-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select value={rewardStatusFilter} onChange={(event) => { setRewardStatusFilter(event.target.value as typeof rewardStatusFilter); setCurrentPage(1); }} aria-label="Filter status hadiah" className="cursor-pointer bg-transparent outline-none">
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Hadiah</th>
                <th className="px-3 py-2.5 font-semibold">Syarat penukaran</th>
                <th className="px-3 py-2.5 font-semibold">Kuota</th>
                <th className="px-3 py-2.5 font-semibold">Penerima</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-[#21AC3A]" />Memuat hadiah...</td></tr>
              ) : visibleRewards.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">{error ? 'Data hadiah gagal dimuat.' : rewards.length === 0 ? 'Belum ada hadiah. Tambahkan hadiah untuk memulai program loyalitas.' : 'Tidak ada hadiah yang sesuai dengan pencarian dan filter.'}</td></tr>
              ) : visibleRewards.map((reward) => (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={reward.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-900">{reward.name}</p>
                    {reward.description && <p className="mt-1 max-w-sm truncate text-xs text-slate-500">{reward.description}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    <p className="font-semibold text-slate-800">{reward.points_required.toLocaleString('id-ID')} poin</p>
                    <p className="mt-1 text-xs">Diskon {formatRewardDiscount(reward)}</p>
                    {reward.ends_at && <p className="mt-1 text-xs text-slate-400">Berakhir {formatDateTime(reward.ends_at)}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{reward.usage_limit == null ? 'Tanpa batas' : `${reward.usage_count.toLocaleString('id-ID')} / ${reward.usage_limit.toLocaleString('id-ID')}`}</td>
                  <td className="px-3 py-2.5 text-slate-600">{reward.customer_ids.length === 0 ? 'Semua pelanggan' : `${reward.customer_ids.length} pelanggan tertentu`}</td>
                  <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reward.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{reward.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" onClick={() => editReward(reward)} className=" border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Ubah</button>
                      <button type="button" disabled={!reward.is_active} onClick={() => void deleteReward(reward)} className=" border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Nonaktifkan</button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-300 px-3 py-3 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select value={itemsPerPage} onChange={(event) => { setItemsPerPage(Number(event.target.value)); setCurrentPage(1); }} aria-label="Jumlah hadiah per halaman" className=" border border-slate-300 bg-white px-2 py-1 outline-none focus:border-[#21AC3A]">
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
            <span className="whitespace-nowrap">Menampilkan {visibleRewards.length.toLocaleString('id-ID')} dari {filteredRewards.length.toLocaleString('id-ID')} hadiah</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className=" border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
            <span className="px-2">Halaman {page} / {totalPages}</span>
            <button type="button" onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className=" border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      </div>
      <p className="border-l-4 border-[#0875d1] bg-blue-50 px-3 py-3 text-sm text-slate-700">Catatan: koreksi dan penukaran poin tercatat di profil pelanggan. Poin otomatis dari transaksi dan penerapan diskon hadiah memerlukan integrasi POS.</p>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-modal="true" aria-labelledby="reward-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-slate-300 bg-white shadow-2xl">
            <form onSubmit={saveReward} className="space-y-4 p-5 sm:p-6">
          {error && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
            <div>
              <h3 id="reward-form-title" className="font-bold text-slate-900">{editing ? 'Ubah hadiah' : 'Tambah hadiah'}</h3>
              <p className="mt-1 text-sm text-slate-500">Atur nilai diskon, kuota, dan masa berlaku penukaran.</p>
            </div>
            <button type="button" onClick={resetForm} aria-label="Tutup formulir hadiah" className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A]"><X className="h-5 w-5" /></button>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Nama hadiah
            <input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Diskon member" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Deskripsi
            <textarea maxLength={1000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Jelaskan manfaat hadiah ini" className="w-full resize-y border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Poin yang dibutuhkan
            <input required min="1" max="1000000" type="number" value={points} onChange={(event) => setPoints(event.target.value)} placeholder="500" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Jenis diskon
            <select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'fixed' | 'percentage')} className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20">
              <option value="fixed">Nominal tetap</option>
              <option value="percentage">Persentase</option>
            </select>
          </label>
          {discountType === 'fixed' ? (
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Nilai diskon (Rp)
              <input required min="1" max="1000000000000" type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="10000" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Diskon (%)
                <input required min="0.01" max="100" step="0.01" type="number" value={discountPercentage} onChange={(event) => setDiscountPercentage(event.target.value)} placeholder="10" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Batas maksimal (Rp, opsional)
                <input min="1" max="1000000000000" type="number" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} placeholder="Tanpa batas" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
              </label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Kuota total (opsional)
              <input min="1" max="2147483647" type="number" value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} placeholder="Tanpa batas" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Maks. per pelanggan (opsional)
              <input min="1" max="2147483647" type="number" value={perCustomerLimit} onChange={(event) => setPerCustomerLimit(event.target.value)} placeholder="Tanpa batas" className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Mulai berlaku (opsional)
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Berakhir (opsional)
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} min={startsAt || undefined} className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Syarat dan ketentuan
            <textarea maxLength={2000} rows={3} value={termsAndConditions} onChange={(event) => setTermsAndConditions(event.target.value)} placeholder="Contoh: tidak dapat digabungkan dengan promo lain" className="w-full resize-y border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
          </label>
          <fieldset className="space-y-3 border border-slate-300 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-700">Penerima hadiah</legend>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="reward-audience" checked={!targetSpecificCustomers} onChange={() => { setTargetSpecificCustomers(false); setTargetCustomerIDs([]); }} className="mt-0.5 accent-[#21AC3A]" />
              <span><span className="block font-medium">Semua pelanggan</span><span className="text-xs text-slate-500">Hadiah bisa ditukar semua anggota program loyalitas.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="reward-audience" checked={targetSpecificCustomers} onChange={() => setTargetSpecificCustomers(true)} className="mt-0.5 accent-[#21AC3A]" />
              <span><span className="block font-medium">Pelanggan tertentu</span><span className="text-xs text-slate-500">Hanya pelanggan yang dipilih yang dapat menukar hadiah.</span></span>
            </label>
            {targetSpecificCustomers && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">{targetCustomerIDs.length} pelanggan dipilih</p>
                  <div className="flex gap-3 text-xs font-semibold">
                    <button type="button" disabled={customersLoading || customers.length === 0} onClick={() => setTargetCustomerIDs((selected) => Array.from(new Set([...selected, ...customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).map((customer) => customer.id)])))} className="text-emerald-700 disabled:opacity-50">Pilih hasil</button>
                    <button type="button" onClick={() => setTargetCustomerIDs([])} className="text-slate-500">Hapus pilihan</button>
                  </div>
                </div>
                <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Cari nama, email, atau telepon" aria-label="Cari pelanggan untuk target hadiah" className="min-h-10 w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
                {customerLoadError && <p role="alert" className="text-xs text-red-600">{customerLoadError}</p>}
                <div className="max-h-52 overflow-y-auto border border-slate-300">
                  {customersLoading ? <p className="p-3 text-sm text-slate-500">Memuat pelanggan...</p> : customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).length === 0 ? (
                    <p className="p-3 text-sm text-slate-500">Pelanggan tidak ditemukan.</p>
                  ) : customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).map((customer) => (
                    <label key={customer.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50">
                      <input type="checkbox" checked={targetCustomerIDs.includes(customer.id)} onChange={() => setTargetCustomerIDs((selected) => selected.includes(customer.id) ? selected.filter((id) => id !== customer.id) : [...selected, customer.id])} className="h-4 w-4 accent-[#21AC3A]" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{customer.name}</span><span className="block truncate text-xs text-slate-500">{customer.phone || customer.email || 'Tidak ada kontak'}</span></span>
                      <span className={`shrink-0 text-[10px] font-semibold ${customer.membership_active ? 'text-emerald-700' : 'text-slate-400'}`}>{customer.membership_active ? 'Member' : 'Non-member'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-[#21AC3A]" /> Hadiah aktif</label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? 'Simpan perubahan' : 'Tambah hadiah'}</button>
            {editing && <button type="button" onClick={resetForm} className="min-h-10 border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>}
          </div>
        </form>
          </motion.div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: 'green' | 'blue' | 'amber';
}) {
  const tones = {
    green: 'text-[#16852A]',
    blue: 'text-[#0875d1]',
    amber: 'text-amber-700',
  };

  return (
    <div className="flex min-h-24 flex-col justify-between border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{label}</span>
        <span className={tones[tone]}>{icon}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <h3 className="truncate text-2xl font-semibold tracking-tight text-slate-900" title={value}>{value}</h3>
        <span className="text-right text-xs text-slate-500">{note}</span>
      </div>
    </div>
  );
}
