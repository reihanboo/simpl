import { Outlet, useParams, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useEffect } from 'react';
import { LockKeyhole } from 'lucide-react';
import Sidebar from './Sidebar';
import ABAIChatWidget from '../../../components/ABAIChatWidget';
import { normalizeEmployeeRole } from '../../../utils/employee-role';

export default function BranchLayout() {
  const { id } = useParams();
  const location = useLocation();
  const { activeOrg } = useOutletContext<{ activeOrg: { plan?: string; status?: string; role?: string; employeeRole?: string; branchId?: string; branchName?: string } | null }>();
  const navigate = useNavigate();
  const isPos = location.pathname.endsWith('/pos');
  const normalizedPlan = activeOrg?.plan?.trim().toLowerCase() || '';
  const hasEnterprisePlan = (normalizedPlan === 'enterprise' || normalizedPlan.startsWith('enterprise_')) && activeOrg?.status?.toLowerCase() === 'active';
  const isEnterpriseOnlyRoute = ['/customers', '/employees', '/attendance'].some((path) =>
    location.pathname.endsWith(path)
  );
  const isLocked = Boolean(activeOrg && isEnterpriseOnlyRoute && !hasEnterprisePlan);
  const employeeRole = activeOrg?.role === 'employee' ? normalizeEmployeeRole(activeOrg.employeeRole) : undefined;
  const employeeRouteAllowed = !employeeRole || (
    employeeRole === 'cashier' ? location.pathname.endsWith('/pos') :
      employeeRole === 'warehouse_staff' ? location.pathname.endsWith('/inventory') :
        employeeRole === 'manager' && ['/customers', '/employees', '/attendance'].some((path) => location.pathname.endsWith(path))
  );

  useEffect(() => {
    if (!employeeRole || employeeRouteAllowed || !id) return;
    const landing = employeeRole === 'cashier' ? 'pos' : employeeRole === 'warehouse_staff' ? 'inventory' : 'employees';
    navigate(`/dashboard/branch/${id}/${landing}`, { replace: true });
  }, [employeeRole, employeeRouteAllowed, id, navigate]);

  return (
    <div className="flex min-h-full">
      {id && <Sidebar branchId={id} plan={activeOrg?.plan} status={activeOrg?.status} employeeRole={employeeRole} branchName={activeOrg?.branchName} />}
      
      <div className={`min-w-0 flex-1 bg-slate-50/50 relative flex flex-col ${isPos ? 'h-full overflow-y-auto' : ''}`}>
        {!employeeRouteAllowed ? (
          <div className="flex min-h-[60vh] items-center justify-center p-6" role="status">
            <p className="border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">Mengalihkan ke fitur yang tersedia untuk peran Anda…</p>
          </div>
        ) : isLocked ? (
          <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="relative w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-slate-900/5" />
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center bg-slate-900/10 text-slate-700">
                <LockKeyhole className="h-8 w-8" />
              </div>
              <h1 className="relative mt-5 text-xl font-bold text-slate-900">Fitur terkunci</h1>
              <p className="relative mt-2 text-sm leading-6 text-slate-600">
                {location.pathname.endsWith('/customers')
                  ? 'Kelola pelanggan tersedia di paket Enterprise.'
                  : location.pathname.endsWith('/employees')
                    ? 'Manajemen pegawai tersedia di paket Enterprise.'
                    : 'Presensi tersedia di paket Enterprise.'}
              </p>
              <span className="relative mt-5 inline-flex items-center border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Paket UMKM
              </span>
            </div>
          </div>
        ) : isPos ? (
          <Outlet context={{ activeOrg }} />
        ) : (
          <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-8 lg:p-8">
            <Outlet context={{ activeOrg }} />
          </div>
        )}
      </div>
      {id && activeOrg?.role !== 'employee' && <ABAIChatWidget key={id} branchId={id} />}
    </div>
  );
}
