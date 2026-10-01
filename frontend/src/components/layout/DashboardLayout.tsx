import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  Bell,
  Search,
  Building2,
  ChevronsUpDown,
  Check,
  Plus,
  Settings,
  ShieldCheck,
  LogOut,
  MailCheck,
  UserRoundPlus,
  X,
  ArrowRight,
  BarChart3,
  Clock3,

  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Package,
  ShoppingCart,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { normalizeEmployeeRole } from '../../utils/employee-role';

const ACTIVE_BUSINESS_STORAGE_KEY = 'activeBusinessId';

type Organization = {
  id: string;
  name: string;
  plan: string;
  role: string;
  status?: string;
  currentPeriodEnd?: string;
  snapToken?: string;
  branchId?: string;
  branchName?: string;
  employeeRole?: string;
};

type BusinessApiResponse = {
  id: string;
  name: string;
  role?: string;
  branch_id?: string;
  branch_name?: string;
  employee_role?: string;
  subscription?: {
    plan_id?: string;
    status?: string;
    current_period_end?: string;
    snap_token_midtrans?: string;
  };
};

type BusinessInvitation = {
  id: string;
  business_id: string;
  business_name: string;
  invited_by_name: string;
  invited_by_email: string;
  created_at: string;
};

type DashboardSearchPage = {
  id: 'dashboard' | 'branch-dashboard' | 'pos' | 'inventory' | 'customers' | 'employees' | 'attendance' | 'reports' | 'settings' | 'profile';
  label: string;
  description: string;
  keywords: string;
  path?: string;
  enterpriseOnly?: boolean;
  employeeRoles?: string[];
};

const DASHBOARD_SEARCH_PAGES: DashboardSearchPage[] = [
  { id: 'dashboard', label: 'Daftar cabang', description: 'Pilih dan kelola cabang bisnis', keywords: 'dashboard bisnis cabang outlet', path: '/dashboard' },
  { id: 'branch-dashboard', label: 'Dashboard cabang', description: 'Lihat ringkasan performa cabang', keywords: 'overview ringkasan omzet performa' },
  { id: 'pos', label: 'Kasir / POS', description: 'Buka halaman transaksi penjualan', keywords: 'point of sale kasir cashier transaksi', employeeRoles: ['cashier'] },
  { id: 'inventory', label: 'Inventori & stok', description: 'Kelola persediaan dan pergerakan stok', keywords: 'inventory stock warehouse gudang produk', employeeRoles: ['warehouse_staff'] },
  { id: 'customers', label: 'Pelanggan / CRS', description: 'Kelola profil dan loyalitas pelanggan', keywords: 'customer customers pelanggan crm crs loyalitas', enterpriseOnly: true, employeeRoles: ['manager'] },
  { id: 'employees', label: 'Pegawai / EMS', description: 'Kelola pegawai dan akses peran', keywords: 'employee employees pegawai karyawan ems staff', enterpriseOnly: true, employeeRoles: ['manager'] },
  { id: 'attendance', label: 'Presensi', description: 'Pantau kehadiran dan jam kerja pegawai', keywords: 'attendance absensi presence clock in clock out', enterpriseOnly: true, employeeRoles: ['manager'] },
  { id: 'reports', label: 'Laporan', description: 'Lihat laporan penjualan dan inventori', keywords: 'report reports laporan analitik', employeeRoles: [] },
  { id: 'settings', label: 'Pengaturan cabang', description: 'Atur detail dan preferensi cabang', keywords: 'settings setting pengaturan konfigurasi', employeeRoles: [] },
  { id: 'profile', label: 'Profil akun', description: 'Ubah informasi akun Anda', keywords: 'profile profil akun email username', path: '/profile', employeeRoles: ['cashier', 'warehouse_staff', 'manager'] },
];

export default function DashboardLayout() {
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [pendingPaymentOrgs, setPendingPaymentOrgs] = useState<Organization[]>([]);
  const [businessInvitations, setBusinessInvitations] = useState<BusinessInvitation[]>([]);
  const [invitationActionMessage, setInvitationActionMessage] = useState('');
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);
  const [headerSearch, setHeaderSearch] = useState('');
  const [isHeaderSearchOpen, setIsHeaderSearchOpen] = useState(false);
  const [activeSearchResult, setActiveSearchResult] = useState(0);
  const [isSearchNavigating, setIsSearchNavigating] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboardHome = location.pathname === '/dashboard';
  const branchId = location.pathname.match(/^\/dashboard\/branch\/([^/]+)/)?.[1];
  const isBranchRoute = Boolean(branchId);
  const isEmployeeAccount = activeOrg?.role === 'employee';
  const employeeSearchRole = isEmployeeAccount ? activeOrg.employeeRole || '' : '';
  const searchablePages = DASHBOARD_SEARCH_PAGES.filter((page) =>
    !isEmployeeAccount || Boolean(employeeSearchRole && page.employeeRoles?.includes(employeeSearchRole))
  );
  const normalizedSearch = headerSearch.trim().toLocaleLowerCase();
  const headerSearchResults = normalizedSearch
    ? searchablePages.filter((page) => `${page.label} ${page.description} ${page.keywords}`.toLocaleLowerCase().includes(normalizedSearch))
    : [];
  const normalizedPlan = activeOrg?.plan.trim().toLocaleLowerCase() || '';
  const hasEnterprisePlan = (normalizedPlan === 'enterprise' || normalizedPlan.startsWith('enterprise_')) && activeOrg?.status?.toLocaleLowerCase() === 'active';

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('must_change_password');
    sessionStorage.removeItem('must_change_password');
    localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY);
    navigate('/auth/login');
  };

  const handleSettings = () => {
    setIsProfileDropdownOpen(false);
    navigate('/profile');
  };

  const handleSearchPageSelect = async (page: DashboardSearchPage) => {
    if (page.path) {
      navigate(page.path);
      setHeaderSearch('');
      setIsHeaderSearchOpen(false);
      setSearchMessage('');
      return;
    }

    const isEnterpriseLocked = Boolean(page.enterpriseOnly && activeOrg && !hasEnterprisePlan);
    if (isEnterpriseLocked && employeeSearchRole) {
      setSearchMessage('Hubungi pemilik bisnis untuk meng-upgrade paket ke Enterprise.');
      return;
    }

    setIsSearchNavigating(true);
    setSearchMessage('');
    try {
      let targetBranchId = branchId || activeOrg?.branchId;
      if (!targetBranchId && activeOrg?.id) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches?business_id=${encodeURIComponent(activeOrg.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload: { branches?: { id: string }[]; error?: string } = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Cabang tidak dapat dimuat.');
        targetBranchId = payload.branches?.[0]?.id;
      }

      if (!targetBranchId) {
        setSearchMessage('Tambahkan cabang terlebih dahulu untuk membuka halaman ini.');
        return;
      }

      const route = isEnterpriseLocked ? 'settings?upgrade=1' : page.id === 'branch-dashboard' ? '' : page.id;
      navigate(`/dashboard/branch/${targetBranchId}${route ? `/${route}` : ''}`);
      setHeaderSearch('');
      setIsHeaderSearchOpen(false);
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : 'Halaman tidak dapat dibuka.');
    } finally {
      setIsSearchNavigating(false);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsHeaderSearchOpen(false);
      return;
    }
    if (!headerSearchResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchResult((index) => (index + 1) % headerSearchResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchResult((index) => (index - 1 + headerSearchResults.length) % headerSearchResults.length);
    } else if (event.key === 'Enter') {
      const selectedPage = headerSearchResults[activeSearchResult];
      if (!selectedPage) return;
      event.preventDefault();
      void handleSearchPageSelect(selectedPage);
    }
  };

  const getSearchPageIcon = (page: DashboardSearchPage) => {
    const className = 'h-4 w-4';
    switch (page.id) {
      case 'dashboard':
      case 'branch-dashboard': return <LayoutDashboard className={className} />;
      case 'pos': return <ShoppingCart className={className} />;
      case 'inventory': return <Package className={className} />;
      case 'customers': return <UsersRound className={className} />;
      case 'employees': return <UserCog className={className} />;
      case 'attendance': return <Clock3 className={className} />;
      case 'reports': return <BarChart3 className={className} />;
      case 'settings': return <Settings className={className} />;
      case 'profile': return <ShieldCheck className={className} />;
    }
  };

  React.useEffect(() => {
    if (!isHeaderSearchOpen) return;
    const closeSearchOnOutsideClick = (event: PointerEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsHeaderSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeSearchOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeSearchOnOutsideClick);
  }, [isHeaderSearchOpen]);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser({ name: data.user.username, email: data.user.email });
        } else {
          console.error('Failed to fetch user:', res.statusText);
        }

        let hasBusinesses = false;
        let businessesLoaded = false;
        const resBusinesses = await fetch('/api/business', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (resBusinesses.ok) {
          businessesLoaded = true;
          const dataBiz: { businesses?: BusinessApiResponse[] } = await resBusinesses.json();
          const businesses = Array.isArray(dataBiz.businesses) ? dataBiz.businesses : [];
          hasBusinesses = businesses.length > 0;
          if (businesses.length > 0) {
            const orgs = businesses.map((b) => ({
              id: b.id,
              name: b.name,
              plan: b.subscription?.plan_id || 'Unknown',
              role: b.role || 'owner',
              status: b.subscription?.status,
              currentPeriodEnd: b.subscription?.current_period_end,
              snapToken: b.subscription?.snap_token_midtrans,
              branchId: b.branch_id,
              branchName: b.branch_name,
              employeeRole: normalizeEmployeeRole(b.employee_role),
            }));
            setOrganizations(orgs);
            const savedBusinessId = localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY);
            const selectedOrg = orgs.find((org) => org.id === savedBusinessId) || orgs[0];
            setActiveOrg(selectedOrg);
            localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, selectedOrg.id);

            // Check if there is any pending payment
            const pendings = orgs.filter((org) => org.status === 'pending' && org.snapToken);
            setPendingPaymentOrgs(pendings);
          }
        }

        const resInvitations = await fetch('/api/business/invitations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        let invitations: BusinessInvitation[] = [];
        if (resInvitations.ok) {
          const dataInvitations = await resInvitations.json();
          invitations = Array.isArray(dataInvitations.invitations) ? dataInvitations.invitations : [];
          setBusinessInvitations(invitations);
        }

        if (businessesLoaded && !hasBusinesses && invitations.length === 0) {
          navigate('/onboarding', { replace: true });
        }
      } catch (error) {
        console.error('Error fetching data from backend:', error);
      }
    };
    fetchUser();
  }, [navigate]);

  const respondToInvitation = async (invitationId: string, response: 'accept' | 'decline') => {
    setRespondingInvitationId(invitationId);
    setInvitationActionMessage('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const result = await fetch(`/api/business/invitations/${invitationId}/${response}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Undangan belum dapat diproses.');
      setBusinessInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      if (response === 'accept') {
        window.location.assign('/dashboard');
      }
    } catch (error) {
      setInvitationActionMessage(error instanceof Error ? error.message : 'Undangan belum dapat diproses.');
    } finally {
      setRespondingInvitationId(null);
    }
  };

  React.useEffect(() => {
    if (organizations.length === 0) return;
    const employeeOrg = organizations.find((org) => org.role === 'employee');
    if (employeeOrg) {
      if (employeeOrg.branchId && branchId !== employeeOrg.branchId) {
        const employeeLanding = employeeOrg.employeeRole === 'cashier'
          ? 'pos'
          : employeeOrg.employeeRole === 'warehouse_staff'
            ? 'inventory'
            : 'employees';
        const requestedModule = location.pathname.split('/').filter(Boolean)[3];
        const allowedModules = employeeOrg.employeeRole === 'cashier'
          ? ['pos']
          : employeeOrg.employeeRole === 'warehouse_staff'
            ? ['inventory']
            : ['customers', 'employees', 'attendance'];
        const destination = requestedModule && allowedModules.includes(requestedModule)
          ? requestedModule
          : employeeLanding;
        navigate(`/dashboard/branch/${employeeOrg.branchId}/${destination}`, { replace: true });
      }
      return;
    }
    if (!branchId) return;

    const controller = new AbortController();
    const fetchBranchBusiness = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/dashboard?days=1`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data: { branch?: { business_id?: string } } = await response.json();
        const branchBusinessId = data.branch?.business_id;
        const branchOrg = organizations.find((org) => org.id === branchBusinessId);
        if (branchOrg) {
          setActiveOrg(branchOrg);
          localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, branchOrg.id);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to resolve branch business', error);
        }
      }
    };

    void fetchBranchBusiness();
    return () => controller.abort();
  }, [branchId, organizations, navigate, location.pathname]);

  const handlePayNow = (snapToken: string) => {
    if (window.snap) {
      window.snap.pay(snapToken, {
        onSuccess: function () {
          window.location.reload();
        },
        onPending: function () {},
        onError: function () {},
        onClose: function () {
          console.log('Payment popup closed');
        }
      });
    }
  };

  const getBreadcrumbs = () => {
    const rawPaths = location.pathname.split('/').filter(Boolean);
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    const breadcrumbs: { name: string, path: string }[] = [];
    let currentPath = '';

    rawPaths.forEach((pathSegment) => {
      currentPath += `/${pathSegment}`;
      if (!uuidRegex.test(pathSegment)) {
        breadcrumbs.push({
          name: pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1).replace('-', ' '),
          path: currentPath
        });
      } else if (breadcrumbs.length > 0) {
        breadcrumbs[breadcrumbs.length - 1].path = currentPath;
      }
    });

    return breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      return (
        <React.Fragment key={crumb.path}>
          {isLast ? (
            <span className="text-slate-900 font-semibold">
              {crumb.name}
            </span>
          ) : (
            <Link to={crumb.path} className="text-slate-500 hover:text-[#21AC3A] transition-colors">
              {crumb.name}
            </Link>
          )}
          {!isLast && <ChevronRight className="w-4 h-4 text-slate-400 mx-1" />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex h-dvh bg-slate-50 font-sans">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className={`relative z-50 flex shrink-0 items-center justify-between px-3 sm:px-6 ${isDashboardHome ? 'h-14 border-b border-[#D1D1D1] bg-white' : 'h-16 border-b border-slate-200 bg-white'}`}>
          <div className="flex min-w-0 items-center gap-3">
            {isDashboardHome ? (
              <div className="flex shrink-0 items-center border-r border-[#D1D1D1] pr-3">
                <img src="/simpl-logo-dark.png" alt="SIMPL" className="h-7 w-auto object-contain" />
              </div>
            ) : (
              <div className="hidden sm:flex items-center text-sm">
                {getBreadcrumbs()}
              </div>
            )}

            {/* Organization Selector */}
            {activeOrg?.role !== 'employee' && !location.pathname.startsWith('/dashboard/business/new') && !location.pathname.startsWith('/dashboard/branch/') && (
              <div className={`relative ${isDashboardHome ? 'ml-0' : 'ml-4 border-l border-slate-200 pl-4'}`}>
                {activeOrg ? (
                  <button
                    onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${isDashboardHome ? 'bg-transparent px-3 py-1.5 text-slate-900 hover:bg-slate-100' : 'rounded-md border border-transparent p-1.5 pr-2 hover:border-slate-200 hover:bg-slate-100'}`}
                  >
                    {!isDashboardHome && (
                      <div className="w-6 h-6 rounded bg-[#21AC3A] text-white flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className={`truncate text-sm font-semibold ${isDashboardHome ? 'max-w-48 text-slate-900' : 'text-slate-900'}`}>{activeOrg.name}</span>
                    {!isDashboardHome && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-300 text-slate-500 uppercase tracking-wider bg-slate-50">
                      {activeOrg.plan}
                    </span>}
                    {!isDashboardHome && activeOrg.status === 'pending' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300 text-amber-600 bg-amber-50">
                        Tertunda
                      </span>
                    )}
                    <ChevronsUpDown className={`ml-1 h-4 w-4 ${isDashboardHome ? 'text-slate-400' : 'text-slate-400'}`} />
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/dashboard/business/new')}
                    className={`flex items-center gap-2 rounded-md p-1.5 pr-2 text-sm font-semibold transition-colors ${isDashboardHome ? 'text-slate-900 hover:bg-slate-100' : 'text-slate-900 hover:bg-slate-100'}`}
                  >
                    <Plus className="w-4 h-4 text-[#21AC3A]" />
                    <span>Buat Bisnis Baru</span>
                  </button>
                )}

                <AnimatePresence>
                  {isOrgDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsOrgDropdownOpen(false)}></div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 z-50 overflow-hidden"
                      >
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Cari Bisnis..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all"
                            />
                          </div>
                        </div>

                        <div className="p-1 max-h-48 overflow-y-auto">
                          {organizations.map((org) => (
                            <button
                              key={org.id}
                              onClick={() => {
                                setActiveOrg(org);
                                localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, org.id);
                                setIsOrgDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left"
                            >
                              <span className={activeOrg?.id === org.id ? "font-semibold text-slate-900" : ""}>
                                {org.name}
                              </span>
                              {activeOrg?.id === org.id && <Check className="w-4 h-4 text-[#21AC3A]" />}
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-slate-100 p-1">
                          <button
                            onClick={() => {
                              setIsOrgDropdownOpen(false);
                              navigate('/dashboard/business/new');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-slate-400" />
                            <span>Bisnis Baru</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className={`flex items-center ${isDashboardHome ? 'gap-2' : 'gap-4'}`}>
            <div ref={searchContainerRef} className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                role="combobox"
                aria-label="Cari halaman"
                aria-autocomplete="list"
                aria-expanded={isHeaderSearchOpen && normalizedSearch.length > 0}
                aria-controls="dashboard-page-search-results"
                aria-activedescendant={headerSearchResults[activeSearchResult] ? `dashboard-search-${headerSearchResults[activeSearchResult].id}` : undefined}
                placeholder="Cari halaman..."
                value={headerSearch}
                onChange={(event) => {
                  setHeaderSearch(event.target.value);
                  setActiveSearchResult(0);
                  setSearchMessage('');
                  setIsHeaderSearchOpen(true);
                }}
                onFocus={() => setIsHeaderSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                className="w-44 border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm transition-all focus:border-[#21AC3A] focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/30 lg:w-64"
              />
              <AnimatePresence>
                {isHeaderSearchOpen && normalizedSearch && (
                  <motion.div
                    id="dashboard-page-search-results"
                    role="listbox"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full z-60 mt-1 w-80 overflow-hidden border border-slate-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.13)]"
                  >
                    {headerSearchResults.length ? (
                      <div className="max-h-80 overflow-y-auto p-1">
                        {headerSearchResults.map((page, index) => {
                          const isLocked = Boolean(page.enterpriseOnly && activeOrg && !hasEnterprisePlan);
                          const lockedForEmployee = isLocked && Boolean(employeeSearchRole);
                          return (
                            <button
                              key={page.id}
                              id={`dashboard-search-${page.id}`}
                              type="button"
                              role="option"
                              aria-selected={activeSearchResult === index}
                              aria-disabled={lockedForEmployee}
                              disabled={isSearchNavigating || lockedForEmployee}
                              onMouseEnter={() => setActiveSearchResult(index)}
                              onClick={() => void handleSearchPageSelect(page)}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${activeSearchResult === index ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${isLocked ? 'bg-slate-100 text-slate-500' : 'bg-[#EAF7EC] text-[#21AC3A]'}`}>
                                {getSearchPageIcon(page)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-800">{page.label}</span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {lockedForEmployee ? 'Hubungi pemilik untuk upgrade Enterprise' : page.description}
                                </span>
                              </span>
                              {isLocked ? <LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-sm text-slate-500">Tidak ada halaman yang cocok.</p>
                    )}
                    {searchMessage && <p role="status" className="border-t border-slate-100 px-4 py-2.5 text-xs text-amber-700">{searchMessage}</p>}
                    {isSearchNavigating && (
                      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Membuka halaman...
                      </div>
                    )}
                    <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">Gunakan ↑ ↓ untuk memilih · Enter untuk membuka</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                aria-label={`Notifikasi${pendingPaymentOrgs.length + businessInvitations.length > 0 ? `, ${pendingPaymentOrgs.length + businessInvitations.length} belum dibaca` : ''}`}
                aria-expanded={isNotificationDropdownOpen}
                className={`relative p-2 transition-colors cursor-pointer ${isDashboardHome ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-100'} ${isNotificationDropdownOpen ? 'bg-slate-100' : ''}`}
              >
                <Bell className="h-5 w-5" />
                {pendingPaymentOrgs.length + businessInvitations.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border-2 border-white bg-red-600 px-0.5 text-[9px] font-bold leading-none text-white">
                    {pendingPaymentOrgs.length + businessInvitations.length > 9 ? '9+' : pendingPaymentOrgs.length + businessInvitations.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationDropdownOpen(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 z-50 overflow-hidden flex flex-col max-h-96"
                    >
                      <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <span className="font-semibold text-slate-900 text-sm">Notifikasi</span>
                        {pendingPaymentOrgs.length + businessInvitations.length > 0 && (
                          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {pendingPaymentOrgs.length + businessInvitations.length} Baru
                          </span>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1 p-2">
                        {businessInvitations.length === 0 && pendingPaymentOrgs.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-sm">
                            Tidak ada notifikasi baru
                          </div>
                        ) : (
                          <>
                            {businessInvitations.map((invitation) => (
                              <div key={invitation.id} className="mb-2 border border-blue-100 bg-blue-50 p-3">
                                <div className="flex gap-3">
                                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-bold text-slate-900">Undangan co-owner</h4>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                      <strong>{invitation.invited_by_name}</strong> mengundang Anda untuk mengelola <strong>{invitation.business_name}</strong>.
                                    </p>
                                    {invitationActionMessage && <p role="alert" className="mt-2 text-xs text-red-600">{invitationActionMessage}</p>}
                                    <div className="mt-3 flex gap-2">
                                      <button type="button" disabled={respondingInvitationId === invitation.id} onClick={() => void respondToInvitation(invitation.id, 'accept')} className="inline-flex items-center gap-1 bg-[#21AC3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d9732] disabled:opacity-60">
                                        <UserRoundPlus className="h-3.5 w-3.5" /> Terima
                                      </button>
                                      <button type="button" disabled={respondingInvitationId === invitation.id} onClick={() => void respondToInvitation(invitation.id, 'decline')} className="inline-flex items-center gap-1 border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">
                                        <X className="h-3.5 w-3.5" /> Tolak
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {pendingPaymentOrgs.map(org => (
                            <div key={org.id} className="p-3 mb-2 bg-amber-50 rounded-lg border border-amber-100 relative">
                              <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <h4 className="text-sm font-bold text-amber-900">Pembayaran Tertunda</h4>
                                  <p className="text-xs text-amber-700 mt-1 mb-3 line-clamp-2">
                                    Bisnis <strong>{org.name}</strong> belum menyelesaikan pembayaran paket {org.plan}.
                                  </p>
                                  <button
                                    onClick={() => {
                                      setIsNotificationDropdownOpen(false);
                                      if (org.snapToken) handlePayNow(org.snapToken);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors cursor-pointer"
                                  >
                                    Bayar Sekarang
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          </>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className={`flex items-center transition-colors ${isDashboardHome ? 'gap-2 px-3 py-1.5 text-slate-900 hover:bg-slate-100' : 'h-8 w-8 justify-center rounded-full border-2 border-white bg-gradient-to-tr from-[#21AC3A] to-emerald-400 p-0 font-bold text-white ring-1 ring-slate-200'}`}
              >
                {isDashboardHome ? (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {user ? user.name.charAt(0).toUpperCase() : ''}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-36 truncate text-xs font-semibold leading-4">{user?.name || 'Memuat...'}</span>
                      <span className="block max-w-36 truncate text-[10px] leading-3 text-slate-500">{user?.email || 'Akun'}</span>
                    </span>
                  </>
                ) : user ? user.name.charAt(0).toUpperCase() : ''}
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-900">{user?.name || 'Memuat...'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={handleSettings}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          <span>Pengaturan</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 p-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-red-400" />
                          <span>Keluar</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className={`min-h-0 flex-1 overflow-y-auto ${isDashboardHome ? 'bg-[#F5F5F5]' : isBranchRoute ? 'bg-slate-50/50' : 'bg-slate-50/50 p-4 sm:p-6 lg:p-8'}`}>
          <Outlet context={{ activeOrg }} />
        </main>
        {isDashboardHome && (
          <footer className="flex h-9 shrink-0 items-center justify-between border-t border-[#D1D1D1] bg-[#F5F5F5] px-4 text-[10px] text-[#616161] sm:px-8">
            <span>© {new Date().getFullYear()} SIMPL. Hak cipta dilindungi.</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Lingkungan cloud aman
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
