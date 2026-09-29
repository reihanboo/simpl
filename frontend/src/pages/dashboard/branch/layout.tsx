import { Outlet, useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function BranchLayout() {
  const { id } = useParams();
  const location = useLocation();
  const isPos = location.pathname.endsWith('/pos');

  return (
    <div className="flex min-h-full">
      {id && <Sidebar branchId={id} />}
      
      <div className={`min-w-0 flex-1 bg-slate-50/50 relative flex flex-col ${isPos ? 'h-full overflow-y-auto' : ''}`}>
        {isPos ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-8 lg:p-8">
            <Outlet />
          </div>
        )}
      </div>
    </div>
  );
}
