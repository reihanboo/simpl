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
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const ACTIVE_BUSINESS_STORAGE_KEY = 'activeBusinessId';

declare global {
  interface Window {
    snap: any;
  }
}

export default function DashboardLayout() {
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [pendingPaymentOrgs, setPendingPaymentOrgs] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboardHome = location.pathname === '/dashboard';
  const branchId = location.pathname.match(/^\/dashboard\/branch\/([^/]+)/)?.[1];
  const isBranchRoute = Boolean(branchId);

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY);
    navigate('/auth/login');
  };

  const handleSettings = () => {
    setIsProfileDropdownOpen(false);
    navigate('/profile');
  };

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

        const resBusinesses = await fetch('/api/business', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (resBusinesses.ok) {
          const dataBiz = await resBusinesses.json();
          if (Array.isArray(dataBiz.businesses) && dataBiz.businesses.length > 0) {
            const orgs = dataBiz.businesses.map((b: any) => ({
              id: b.id,
              name: b.name,
              plan: b.subscription?.plan_id || 'Unknown',
              status: b.subscription?.status,
              snapToken: b.subscription?.snap_token_midtrans
            }));
            setOrganizations(orgs);
            const savedBusinessId = localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY);
            const selectedOrg = orgs.find((org: any) => org.id === savedBusinessId) || orgs[0];
            setActiveOrg(selectedOrg);
            localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, selectedOrg.id);

            // Check if there is any pending payment
            const pendings = orgs.filter((o: any) => o.status === 'pending' && o.snapToken);
            setPendingPaymentOrgs(pendings);
          } else {
            navigate('/onboarding', { replace: true });
          }
        }
      } catch (error) {
        console.error('Error fetching data from backend:', error);
      }
    };
    fetchUser();
  }, [navigate]);

  React.useEffect(() => {
    if (!branchId || organizations.length === 0) return;

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
  }, [branchId, organizations]);

  const handlePayNow = (snapToken: string) => {
    if (window.snap) {
      window.snap.pay(snapToken, {
        onSuccess: function (result: any) {
          console.log('Payment success:', result);
          window.location.reload();
        },
        onPending: function (result: any) {
          console.log('Payment pending:', result);
        },
        onError: function (result: any) {
          console.log('Payment error:', result);
        },
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
    <div className="flex h-screen bg-slate-50 font-sans">
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
            {!location.pathname.startsWith('/dashboard/business/new') && !location.pathname.startsWith('/dashboard/branch/') && (
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
                              <span className={activeOrg.id === org.id ? "font-semibold text-slate-900" : ""}>
                                {org.name}
                              </span>
                              {activeOrg.id === org.id && <Check className="w-4 h-4 text-[#21AC3A]" />}
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
            <div className={`relative ${isDashboardHome ? 'hidden' : 'hidden md:block'}`}>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari apapun..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all w-64"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                aria-label={pendingPaymentOrgs.length > 0 ? `Notifikasi pembayaran, ${pendingPaymentOrgs.length} belum dibayar` : 'Notifikasi pembayaran'}
                aria-expanded={isNotificationDropdownOpen}
                className={`relative p-2 transition-colors cursor-pointer ${isDashboardHome ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-100'} ${isNotificationDropdownOpen ? 'bg-slate-100' : ''}`}
              >
                <Bell className="h-5 w-5" />
                {pendingPaymentOrgs.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border-2 border-white bg-red-600 px-0.5 text-[9px] font-bold leading-none text-white">
                    {pendingPaymentOrgs.length > 9 ? '9+' : pendingPaymentOrgs.length}
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
                        {pendingPaymentOrgs.length > 0 && (
                          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {pendingPaymentOrgs.length} Baru
                          </span>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1 p-2">
                        {pendingPaymentOrgs.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-sm">
                            Tidak ada notifikasi baru
                          </div>
                        ) : (
                          pendingPaymentOrgs.map(org => (
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
                                      handlePayNow(org.snapToken);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors cursor-pointer"
                                  >
                                    Bayar Sekarang
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
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
        <main className={`flex-1 overflow-y-auto ${isDashboardHome ? 'bg-[#F5F5F5]' : isBranchRoute ? 'bg-slate-50/50' : 'bg-slate-50/50 p-4 sm:p-6 lg:p-8'}`}>
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
