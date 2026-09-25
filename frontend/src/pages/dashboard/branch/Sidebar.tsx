import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  History,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar({ branchId }: { branchId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: `/dashboard/branch/${branchId}` },
    { name: 'Point of Sales (POS)', icon: <ShoppingCart className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/pos` },
    { name: 'Inventori & Stok', icon: <Package className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/inventory` },
    { name: 'Pelanggan (CRM)', icon: <Users className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/crm` },
    { name: 'Laporan Penjualan', icon: <TrendingUp className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/reports` },
    { name: 'Riwayat Transaksi', icon: <History className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/transactions` },
    { name: 'Pengaturan', icon: <Settings className="w-5 h-5" />, path: `/dashboard/branch/${branchId}/settings` },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 88 : 256 }}
      className="bg-white border-r border-slate-200 flex-shrink-0 hidden md:flex flex-col h-full h-min-screen relative z-20"
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:text-[#21AC3A] z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="p-4 flex flex-col h-full gap-2 overflow-y-auto overflow-x-hidden mt-4">
        {navItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            end={item.path === `/dashboard/branch/${branchId}`}
            title={isCollapsed ? item.name : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 py-3 rounded-xl transition-all font-semibold text-sm whitespace-nowrap overflow-hidden relative ${isActive
                ? 'bg-[#21AC3A]/10 text-[#21AC3A]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              } ${isCollapsed ? 'justify-center px-0' : 'px-4'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={isActive ? "text-[#21AC3A]" : "text-slate-400"}>
                  {item.icon}
                </div>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-8 bg-[#21AC3A] rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.aside>
  );
}
