import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Bell,
  Search,
  Building2,
  ChevronsUpDown,
  Check,
  Plus,
  Settings,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout() {
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth/login');
  };

  const handleSettings = () => {
    setIsProfileDropdownOpen(false);
    navigate('/profile');
  };

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
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
      } catch (error) {
        console.error('Error fetching user data from backend:', error);
      }
    };
    fetchUser();
  }, []);

  const organizations = [
    { id: '1', name: "Sate Padang Dodi", plan: 'UMKM' },
    { id: '2', name: 'Supermarket Jaya', plan: 'Enterprise' },
  ];
  const [activeOrg, setActiveOrg] = useState(organizations[0]);

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    return paths.map((path, index) => {
      const isLast = index === paths.length - 1;
      const formattedName = path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
      return (
        <React.Fragment key={path}>
          <span className={isLast ? "text-slate-900 font-semibold" : "text-slate-500"}>
            {formattedName}
          </span>
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center text-sm">
              {getBreadcrumbs()}
            </div>

            {/* Organization Selector */}
            <div className="relative ml-4 border-l border-slate-200 pl-4">
              <button
                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                className="flex items-center gap-2 hover:bg-slate-100 p-1.5 pr-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <div className="w-6 h-6 rounded bg-[#21AC3A] text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-sm text-slate-900">{activeOrg.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-300 text-slate-500 uppercase tracking-wider bg-slate-50">
                  {activeOrg.plan}
                </span>
                <ChevronsUpDown className="w-4 h-4 text-slate-400 ml-1" />
              </button>

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
                        <button className="w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
                          Semua Bisnis
                        </button>
                      </div>
                      <div className="border-t border-slate-100 p-1">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
                          <Plus className="w-4 h-4 text-slate-400" />
                          <span>Bisnis Baru</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari apapun..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 focus:border-[#21AC3A] transition-all w-64"
              />
            </div>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#21AC3A] to-emerald-400 text-white flex items-center justify-center font-bold text-sm cursor-pointer border-2 border-white shadow-sm ring-1 ring-slate-200"
              >
                {user ? user.name.charAt(0).toUpperCase() : ''}
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
                        <p className="text-sm font-medium text-slate-900">{user?.name || 'Loading...'}</p>
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
