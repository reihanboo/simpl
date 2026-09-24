import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Point of Sales', path: '/dashboard/pos', icon: ShoppingCart },
  {
    name: 'Inventory',
    icon: Package,
    subItems: [
      { name: 'Products', path: '/dashboard/inventory/products' },
      { name: 'Stock Movement', path: '/dashboard/inventory/movements' },
      { name: 'Forecasting', path: '/dashboard/inventory/forecast' }
    ]
  },
  {
    name: 'HR & CMS',
    icon: Users,
    subItems: [
      { name: 'Customers', path: '/dashboard/customers' },
      { name: 'Employees', path: '/dashboard/employees' },
      { name: 'Schedules', path: '/dashboard/schedules' }
    ]
  },
  { name: 'Settings', path: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  isSidebarOpen: boolean;
}

export default function Sidebar({ isSidebarOpen }: SidebarProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Inventory');
  const location = useLocation();

  const toggleSubMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 260 : 72 }}
      className="bg-white border-r border-slate-200 flex flex-col relative z-20 overflow-hidden"
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-200">
        {isSidebarOpen ? (
          <img src="/simpl-logo-dark.png" alt="SIMPL Logo" className="h-6 object-contain" />
        ) : (
          <div className="w-8 h-8 bg-[#21AC3A] rounded-lg flex items-center justify-center text-white font-bold text-xl ml-1">
            S
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.subItems && item.subItems.some(sub => location.pathname.startsWith(sub.path)));
          const isExpanded = expandedMenu === item.name;

          return (
            <div key={item.name}>
              {item.subItems ? (
                <button
                  onClick={() => toggleSubMenu(item.name)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors group ${isActive ? 'bg-[#21AC3A]/10 text-[#21AC3A]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#21AC3A]' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <AnimatePresence>
                    {isSidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="ml-3 font-medium flex-1 text-left whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isSidebarOpen && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </button>
              ) : (
                <Link
                  to={item.path!}
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors group ${isActive ? 'bg-[#21AC3A] text-white shadow-md shadow-[#21AC3A]/20' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <AnimatePresence>
                    {isSidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="ml-3 font-medium whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              )}

              {/* Submenu */}
              <AnimatePresence>
                {isSidebarOpen && item.subItems && isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden ml-9 mt-1 space-y-1"
                  >
                    {item.subItems.map((subItem) => (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === subItem.path
                            ? 'text-[#21AC3A] bg-[#21AC3A]/5'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        {subItem.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-200">
        <button className="flex items-center w-full px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-red-600 rounded-lg transition-colors group">
          <LogOut className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-red-600" />
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3 font-medium whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
