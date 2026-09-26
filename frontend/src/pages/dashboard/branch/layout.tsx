import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function BranchLayout() {
  const { id } = useParams();

  return (
    <div className="flex h-full -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8">
      {id && <Sidebar branchId={id} />}
      
      <div className="flex-1 overflow-y-auto bg-slate-50/50 relative">
        <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
