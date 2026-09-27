import { Outlet, useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function BranchLayout() {
  const { id } = useParams();
  const location = useLocation();
  const isPos = location.pathname.endsWith('/pos');

  return (
    <div className="flex h-full -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8">
      {id && <Sidebar branchId={id} />}
      
      <div className="flex-1 overflow-y-auto bg-slate-50/50 relative flex flex-col h-full">
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
