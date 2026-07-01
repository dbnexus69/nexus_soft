import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b11] text-slate-800 dark:text-slate-200 transition-colors duration-300 relative overflow-hidden font-body">
      {/* Background Decorative Glowing Blobs (Dark Mode Only) */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 dark:bg-accent/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar isMobileOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
      
      <div className="pl-0 md:pl-0 md:pt-24 transition-all duration-300 relative z-10">
        <div className="md:hidden">
          <Header onMenuToggle={() => setIsMobileOpen(true)} />
        </div>
        <main className="p-4 md:p-6 min-h-[calc(100vh-90px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}