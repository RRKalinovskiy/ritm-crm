import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/app/Sidebar';
import { Topbar } from '@/app/Topbar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-7 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
