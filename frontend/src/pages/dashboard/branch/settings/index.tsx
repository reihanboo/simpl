import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, Check, CreditCard, Crown, LoaderCircle, Mail, ShieldCheck, Trash2, UserRoundPlus, Users } from 'lucide-react';

interface MidtransSnap {
  pay: (token: string, callbacks: {
    onSuccess: () => void;
    onPending: () => void;
    onError: () => void;
    onClose: () => void;
  }) => void;
}

interface ActiveOrganization {
  id: string;
  name?: string;
  plan?: string;
  status?: string;
  currentPeriodEnd?: string | null;
  role?: string;
}

type BusinessMember = {
  user_id: string;
  email: string;
  username: string;
  role: string;
  is_owner: boolean;
};

type BusinessInvitation = {
  id: string;
  email: string;
  created_at: string;
};

interface UpgradeQuote {
  umkm_monthly_price: number;
  enterprise_monthly_price: number;
  upgrade_difference: number;
  amount_due: number;
  current_period_end: string;
  remaining_days: number;
  expiry_is_estimate: boolean;
}

const enterpriseFeatures = [
  'Kelola data dan riwayat pelanggan',
  'Kelola data dan akses pegawai',
  'Atur jadwal dan pantau presensi',
  'Semua fitur yang tersedia di paket UMKM',
];

export default function BranchSettings() {
  const { activeOrg } = useOutletContext<{ activeOrg: ActiveOrganization | null }>();
  const { id: branchId } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<UpgradeQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [invitations, setInvitations] = useState<BusinessInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberNotice, setMemberNotice] = useState('');

  const currentPlan = activeOrg?.plan?.trim() || 'Tidak diketahui';
  const isEnterpriseActive = currentPlan.toLowerCase().startsWith('enterprise') && activeOrg?.status?.toLowerCase() === 'active';
  const isBusinessOwner = activeOrg?.role !== 'co_owner';
  const formatIDR = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;
  const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));

  useEffect(() => {
    if (!activeOrg?.id) return;
    const controller = new AbortController();
    const fetchBusinessAccess = async () => {
      setIsLoadingMembers(true);
      setMemberError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [membersResponse, invitationsResponse] = await Promise.all([
          fetch(`/api/business/${activeOrg.id}/members`, { headers, signal: controller.signal }),
          fetch(`/api/business/${activeOrg.id}/invitations`, { headers, signal: controller.signal }),
        ]);
        const membersData = await membersResponse.json();
        const invitationsData = await invitationsResponse.json();
        if (!membersResponse.ok) throw new Error(membersData.error || 'Daftar pemilik belum dapat dimuat.');
        if (!invitationsResponse.ok) throw new Error(invitationsData.error || 'Undangan belum dapat dimuat.');
        setMembers(Array.isArray(membersData.members) ? membersData.members : []);
        setInvitations(Array.isArray(invitationsData.invitations) ? invitationsData.invitations : []);
      } catch (error) {
        if (!controller.signal.aborted) setMemberError(error instanceof Error ? error.message : 'Data bisnis belum dapat dimuat.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingMembers(false);
      }
    };
    void fetchBusinessAccess();
    return () => controller.abort();
  }, [activeOrg?.id]);

  useEffect(() => {
    if (!activeOrg?.id || isEnterpriseActive || !isBusinessOwner) return;

    const controller = new AbortController();
    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setErrorMessage('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/business/${activeOrg.id}/subscription/upgrade/quote`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Informasi langganan belum dapat dimuat.');
        setQuote(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Informasi langganan belum dapat dimuat.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingQuote(false);
      }
    };

    void fetchQuote();
    return () => controller.abort();
  }, [activeOrg?.id, isEnterpriseActive, isBusinessOwner]);

  const sendInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrg) return;
    setIsSubmittingInvite(true);
    setMemberError('');
    setMemberNotice('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/business/${activeOrg.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Undangan belum dapat dikirim.');
      setInvitations((current) => [data.invitation, ...current]);
      setInviteEmail('');
      setMemberNotice('Undangan terkirim. Pengguna tersebut baru mendapat akses setelah menerimanya.');
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : 'Undangan belum dapat dikirim.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!activeOrg) return;
    setMemberError('');
    setMemberNotice('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/business/${activeOrg.id}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Undangan belum dapat dicabut.');
      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      setMemberNotice('Undangan telah dicabut.');
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : 'Undangan belum dapat dicabut.');
    }
  };

  const confirmPayment = async (subscriptionId: string) => {
    if (!activeOrg) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setNotice('Memverifikasi pembayaran…');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/business/${activeOrg.id}/subscription/upgrade/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      const data = await response.json();

      if (response.status === 202 && data.status === 'pending') {
        setNotice('Pembayaran masih diproses. Silakan cek kembali beberapa saat lagi.');
        setPendingSubscriptionId(subscriptionId);
        return;
      }
      if (!response.ok || data.status !== 'active') {
        throw new Error(data.error || 'Pembayaran belum dapat diverifikasi.');
      }

      setPendingSubscriptionId(null);
      setNotice('Paket Enterprise aktif. Memuat ulang bisnis Anda…');
      window.location.assign(`/dashboard/branch/${branchId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Pembayaran belum dapat diverifikasi.');
      setPendingSubscriptionId(subscriptionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgrade = async () => {
    const snap = (window as Window & { snap?: MidtransSnap }).snap;
    if (!activeOrg || !snap) {
      setErrorMessage('Pembayaran belum tersedia. Silakan muat ulang halaman dan coba lagi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setNotice('Menyiapkan pembayaran…');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`/api/business/${activeOrg.id}/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pembayaran belum dapat dibuat.');

      setPendingSubscriptionId(data.subscription_id);
         if (quote && data.amount_due) setQuote({ ...quote, amount_due: data.amount_due });
      setNotice('Selesaikan pembayaran pada jendela yang terbuka.');
      snap.pay(data.snap_token, {
        onSuccess: () => void confirmPayment(data.subscription_id),
        onPending: () => {
          setIsSubmitting(false);
          setNotice('Pembayaran sedang diproses. Anda dapat mengecek statusnya kembali di sini.');
        },
        onError: () => {
          setIsSubmitting(false);
          setErrorMessage('Pembayaran gagal. Silakan coba lagi.');
        },
        onClose: () => {
          setIsSubmitting(false);
          setNotice('Pembayaran belum dikonfirmasi. Jika sudah membayar, cek status transaksi di bawah.');
        },
      });
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(error instanceof Error ? error.message : 'Pembayaran belum dapat dibuat.');
      setNotice('');
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pengaturan bisnis</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Langganan</h1>
          <p className="mt-1 text-sm text-slate-600">Kelola paket untuk {activeOrg?.name || 'bisnis ini'}.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
          <ShieldCheck className="h-4 w-4 text-[#21AC3A]" />
          Paket saat ini: {currentPlan}
        </span>
      </div>

      {!isBusinessOwner ? (
        <section className="border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-bold">Paket bisnis</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Anda mengelola bisnis ini sebagai co-owner. Perubahan langganan hanya tersedia untuk pemilik utama.</p>
          <p className="mt-3 text-sm text-slate-700">Paket saat ini: <strong>{currentPlan}</strong></p>
          <p className="mt-1 text-sm text-slate-700">Masa langganan berakhir: <strong>{activeOrg?.currentPeriodEnd ? formatDate(activeOrg.currentPeriodEnd) : 'Tanggal belum tercatat'}</strong></p>
        </section>
      ) : isEnterpriseActive ? (
        <section className="border border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-green-100 text-[#16852B]">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Paket Enterprise sudah aktif</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Bisnis ini sudah memiliki akses ke CRS, EMS, dan Presensi.</p>
              <p className="mt-3 text-sm text-slate-700">
                Masa langganan berakhir: <strong>{activeOrg?.currentPeriodEnd ? formatDate(activeOrg.currentPeriodEnd) : 'Tanggal belum tercatat'}</strong>
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <section className="border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center bg-[#21AC3A]/10 text-[#16852B]">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#16852B]">Upgrade paket</p>
                <h2 className="text-xl font-bold">Enterprise</h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              Upgrade hanya menagihkan selisih harga paket untuk sisa masa langganan UMKM Anda.
            </p>
            <div className="mt-6 space-y-3">
              {enterpriseFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#21AC3A]" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <p className="mt-7 border-t border-slate-100 pt-5 text-sm text-slate-500">
              Harga Enterprise {formatIDR(quote?.enterprise_monthly_price ?? 149000)}/bulan dikurangi UMKM {formatIDR(quote?.umkm_monthly_price ?? 29000)}/bulan.
            </p>
          </section>

          <section className="border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-bold">Ringkasan upgrade</h2>
            <p className="mt-1 text-sm text-slate-500">Masa berlangganan berakhir pada tanggal yang sama setelah upgrade.</p>

            {isLoadingQuote ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Menghitung selisih langganan…
              </div>
            ) : quote ? (
              <>
                <div className="mt-5 space-y-4 border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-slate-600">Selisih harga per bulan</span>
                    <strong className="text-slate-900">{formatIDR(quote.upgrade_difference)}</strong>
                  </div>
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-slate-600">Sisa masa langganan</span>
                    <strong className="text-right text-slate-900">{quote.remaining_days} hari</strong>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-t border-slate-200 pt-4 text-sm">
                    <span className="text-slate-600">{quote.expiry_is_estimate ? 'Perkiraan masa berakhir' : 'Masa langganan berakhir'}</span>
                    <strong className="text-right text-slate-900">{formatDate(quote.current_period_end)}</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-4">
                    <span className="text-sm text-slate-600">Total yang perlu dibayar</span>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{formatIDR(quote.amount_due)}</p>
                    <p className="mt-1 text-xs text-slate-500">Dihitung proporsional berdasarkan sisa masa paket UMKM.</p>
                  </div>
                </div>

                {pendingSubscriptionId && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void confirmPayment(pendingSubscriptionId)}
                    className="mt-3 w-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cek status pembayaran
                  </button>
                )}
              </>
            ) : null}

            {errorMessage && (
              <div role="alert" className="mt-4 flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {notice && <p role="status" className="mt-4 text-sm text-slate-600">{notice}</p>}

            <button
              type="button"
              disabled={isSubmitting || isLoadingQuote || !quote}
              onClick={() => void handleUpgrade()}
              className="mt-5 flex w-full items-center justify-center gap-2 bg-[#21AC3A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {isSubmitting ? 'Memproses…' : 'Bayar selisih dan upgrade'}
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">Pembayaran diproses dengan aman melalui Midtrans.</p>
          </section>
        </div>
      )}

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#16852B]">Akses bisnis</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-slate-500" /> Pemilik & co-owner</h2>
            <p className="mt-1 text-sm text-slate-600">Undang orang lain menggunakan alamat email. Akses baru aktif setelah undangan diterima.</p>
          </div>
        </div>

        <form onSubmit={sendInvitation} className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email co-owner</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nama@perusahaan.com" className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20" />
              </span>
            </label>
            <button type="submit" disabled={isSubmittingInvite || !inviteEmail.trim()} className="mt-auto inline-flex h-11 items-center justify-center gap-2 bg-[#21AC3A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmittingInvite ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
              Kirim undangan
            </button>
        </form>

        {memberError && <p role="alert" className="mx-5 mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">{memberError}</p>}
        {memberNotice && <p role="status" className="mx-5 mt-4 border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:mx-6">{memberNotice}</p>}

        <div className="divide-y divide-slate-100">
          {isLoadingMembers ? (
            <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat daftar akses…</div>
          ) : members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{member.username}</p>
                <p className="truncate text-xs text-slate-500">{member.email}</p>
              </div>
              <span className="shrink-0 border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{member.is_owner ? 'Pemilik' : 'Co-owner'}</span>
            </div>
          ))}
          {!isLoadingMembers && members.length === 0 && <p className="p-5 text-sm text-slate-500">Belum ada pemilik bisnis yang terdaftar.</p>}
        </div>

        {invitations.length > 0 && (
          <div className="border-t border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-5 py-3 sm:px-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Undangan menunggu</h3>
              <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{invitations.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{invitation.email}</p>
                    <p className="mt-0.5 text-xs text-amber-700">Menunggu penerimaan</p>
                  </div>
                  <button type="button" onClick={() => void revokeInvitation(invitation.id)} aria-label={`Cabut undangan untuk ${invitation.email}`} className="inline-flex shrink-0 items-center gap-1.5 border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /> Cabut</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <button type="button" onClick={() => navigate(`/dashboard/branch/${branchId}`)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
        Kembali ke dashboard
      </button>
    </div>
  );
}
