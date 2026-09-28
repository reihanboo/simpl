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
          <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 w-full">
            <Outlet />
          </div>
        )}
      </div>
    </div>
  );
}
