import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  UserCog,
  Clock3,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LockKeyhole,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sidebar({ branchId, plan, status }: { branchId: string; plan?: string; status?: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const fetchBranchName = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/branches/${branchId}/dashboard?days=1`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: { branch?: { name?: string } } = await response.json();
        if (data.branch?.name) setBranchName(data.branch.name);
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch branch name', error);
      }
    };

    fetchBranchName();
    return () => controller.abort();
  }, [branchId]);
  const normalizedPlan = plan?.trim().toLowerCase() || '';
  const hasEnterprisePlan = (normalizedPlan === 'enterprise' || normalizedPlan.startsWith('enterprise_')) && status?.toLowerCase() === 'active';
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: `/dashboard/branch/${branchId}` },
    { name: 'Point of Sales (POS)', icon: <ShoppingCart className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/pos` },
    { name: 'Inventori & Stok', icon: <Package className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/inventory` },
    { name: 'Pelanggan (CRS)', icon: <Users className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/customers`, enterpriseOnly: true },
    { name: 'Pegawai (EMS)', icon: <UserCog className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/employees`, enterpriseOnly: true },
    { name: 'Presensi', icon: <Clock3 className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/attendance`, enterpriseOnly: true },
    { name: 'Laporan', icon: <TrendingUp className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/reports` },
    { name: 'Pengaturan', icon: <Settings className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/settings` },
  ];
  const mobilePrimaryItems = navItems.filter((item) =>
    ['Dashboard', 'Point of Sales (POS)', 'Inventori & Stok', 'Laporan'].includes(item.name)
  );
  const mobileMoreItems = navItems.filter((item) => !mobilePrimaryItems.includes(item));
  const mobileLabels: Record<string, string> = {
    Dashboard: 'Ringkasan',
    'Point of Sales (POS)': 'Kasir',
    'Inventori & Stok': 'Stok',
    Laporan: 'Laporan',
  };
  const isMoreActive = mobileMoreItems.some((item) => location.pathname === item.path);

  return (
    <>
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 56 : 232 }}
      className="sticky top-0 z-20 hidden h-[calc(100dvh-4rem)] min-h-0 shrink-0 self-start flex-col border-r border-slate-200 bg-white md:flex"
    >
      <div className={`flex min-h-16 shrink-0 items-center border-b border-slate-200 ${isCollapsed ? 'justify-center px-1' : 'px-4 py-3'}`}>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Cabang aktif</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={branchName || undefined}>
              {branchName || 'Memuat nama cabang…'}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        aria-label={isCollapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
        title={isCollapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
        className="absolute right-0 top-12 z-30 flex h-6 w-6 translate-x-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors hover:border-[#21AC3A] hover:text-[#21AC3A]"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <nav aria-label="Navigasi cabang" className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        {!isCollapsed && (
          <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Menu</p>
        )}
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isLocked = Boolean(item.enterpriseOnly && !hasEnterprisePlan);
            const className = `relative flex items-center border-l-2 py-2.5 text-sm transition-colors ${
              isLocked
                ? 'group/locked cursor-not-allowed border-transparent bg-slate-100/70 font-medium text-slate-500'
                : 'overflow-hidden border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`;

            if (isLocked) {
              return (
                <button
                  key={item.path}
                  type="button"
                  aria-label={`${item.name}, terkunci di paket UMKM. Buka pengaturan untuk upgrade ke Enterprise.`}
                  onClick={() => navigate(`/dashboard/branch/${branchId}/settings?upgrade=1`)}
                  className={className}
                >
                  <span className="text-slate-400">{item.icon}</span>
                  {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
                  <span className="pointer-events-none absolute inset-0 bg-slate-900/10" />
                  <LockKeyhole className="absolute right-2 z-10 h-4 w-4 text-slate-700" />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-56 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-white shadow-xl group-hover/locked:block group-focus/locked:block"
                  >
                    <span className="block font-semibold">Upgrade ke Enterprise</span>
                    <span className="block text-slate-300">Upgrade langganan untuk membuka fitur {item.name}.</span>
                  </span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/dashboard/branch/${branchId}`}
                title={isCollapsed ? item.name : undefined}
                aria-label={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `relative flex items-center overflow-hidden border-l-2 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'border-[#21AC3A] bg-green-50 font-semibold text-[#16852B]'
                      : 'border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-[#21AC3A]' : 'text-slate-400'}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

    </motion.aside>

    {isMobileMenuOpen && (
      <>
        <button
          type="button"
          aria-label="Tutup menu lainnya"
          className="fixed inset-0 z-40 bg-slate-900/20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div role="dialog" aria-label="Menu cabang lainnya" className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 border-t border-slate-200 bg-white p-3 shadow-lg md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {mobileMoreItems.map((item) => {
              const isLocked = Boolean(item.enterpriseOnly && !hasEnterprisePlan);
              const className = `relative flex min-h-12 items-center gap-3 border px-3 text-sm font-medium ${isLocked ? 'group/locked cursor-not-allowed border-slate-200 bg-slate-100/70 text-slate-500' : 'overflow-hidden border-slate-200 text-slate-700 hover:bg-slate-50'}`;

              if (isLocked) {
                return (
                  <button
                    key={item.path}
                    type="button"
                    aria-label={`${item.name}, terkunci di paket UMKM. Buka pengaturan untuk upgrade ke Enterprise.`}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      navigate(`/dashboard/branch/${branchId}/settings?upgrade=1`);
                    }}
                    className={className}
                  >
                    <span className="text-slate-400">{item.icon}</span>
                    <span>{item.name}</span>
                    <span className="pointer-events-none absolute inset-0 bg-slate-900/10" />
                    <LockKeyhole className="absolute right-2 z-10 h-4 w-4 text-slate-700" />
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-56 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-white shadow-xl group-hover/locked:block group-focus/locked:block"
                    >
                      <span className="block font-semibold">Upgrade ke Enterprise</span>
                      <span className="block text-slate-300">Upgrade langganan untuk membuka fitur {item.name}.</span>
                    </span>
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `${className} ${isActive ? 'border-green-200 bg-green-50 text-[#16852B]' : ''}`}
                >
                  <span className="text-slate-500">{item.icon}</span>
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </>
    )}

    <nav aria-label="Navigasi mobile cabang" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {mobilePrimaryItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.name === 'Dashboard'}
          className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${isActive ? 'text-[#16852B]' : 'text-slate-500'}`}
        >
          {item.icon}
          <span className="max-w-full truncate">{mobileLabels[item.name]}</span>
        </NavLink>
      ))}
      <button
        type="button"
        aria-expanded={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${isMobileMenuOpen || isMoreActive ? 'text-[#16852B]' : 'text-slate-500'}`}
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>Lainnya</span>
      </button>
    </nav>
    </>
  );
}
