import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sidebar({ branchId }: { branchId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branchName, setBranchName] = useState('');

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
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: `/dashboard/branch/${branchId}` },
    { name: 'Point of Sales (POS)', icon: <ShoppingCart className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/pos` },
    { name: 'Inventori & Stok', icon: <Package className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/inventory` },
    { name: 'Pelanggan (CRS)', icon: <Users className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/customers` },
    { name: 'Pegawai (EMS)', icon: <UserCog className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/employees` },
    { name: 'Presensi', icon: <Clock3 className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/attendance` },
    { name: 'Laporan', icon: <TrendingUp className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/reports` },
    { name: 'Pengaturan', icon: <Settings className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/settings` },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 56 : 232 }}
      className="sticky top-0 z-20 hidden h-[calc(100vh-4rem)] min-h-0 shrink-0 self-start flex-col border-r border-slate-200 bg-white md:flex"
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
          {navItems.map((item) => (
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
          ))}
        </div>
      </nav>

    </motion.aside>
  );
}
