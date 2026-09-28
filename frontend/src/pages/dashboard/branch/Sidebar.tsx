import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  UserCog,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Sidebar({ branchId }: { branchId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, path: `/dashboard/branch/${branchId}` },
    { name: 'Point of Sales (POS)', icon: <ShoppingCart className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/pos` },
    { name: 'Inventori & Stok', icon: <Package className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/inventory` },
    { name: 'Pelanggan (CRS)', icon: <Users className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/customers` },
    { name: 'Pegawai (EMS)', icon: <UserCog className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/employees` },
    { name: 'Laporan', icon: <TrendingUp className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/reports` },
    { name: 'Pengaturan', icon: <Settings className="h-5 w-5" />, path: `/dashboard/branch/${branchId}/settings` },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 232 }}
      className="relative z-20 hidden h-full min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
    >

      <div className={`border-b border-slate-200 py-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {!isCollapsed ? (
          <>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">Operasional cabang</p>
            <p className="mt-0.5 text-xs text-slate-500">Penjualan dan inventori</p>
          </>
        ) : (
          <div className="flex justify-center" title="Operasional cabang">
            <LayoutDashboard className="h-5 w-5 text-slate-500" />
          </div>
        )}
      </div>

      <nav aria-label="Navigasi cabang" className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
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
              className={({ isActive }) =>
                `relative flex items-center gap-3 overflow-hidden border-l-2 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-[#21AC3A] bg-green-50 font-semibold text-[#16852B]'
                    : 'border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[#21AC3A]' : 'text-slate-400'}>{item.icon}</span>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="truncate whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <button
        type="button"
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        aria-label={isCollapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
        className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-slate-200 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" />Ciutkan menu</>}
      </button>
    </motion.aside>
  );
}
