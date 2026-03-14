'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Plane,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  PlusCircle,
} from 'lucide-react';
import { CustomerAuthProvider, useCustomerAuth } from '@/contexts/customer-auth-context';

const navItems = [
  { href: '/portal', label: 'My Shipments', icon: Plane },
  { href: '/portal/quotations/new', label: 'Request Quote', icon: PlusCircle },
  { href: '/portal/profile', label: 'My Profile', icon: User },
];

// ============ SIDEBAR ============
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useCustomerAuth();

  const initials = profile?.company
    ? profile.company.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : profile?.full_name
      ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      : '?';

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <Link href="/portal" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="OMGEXP" className="h-10 w-auto" />
          </Link>
          <div className="flex-1" />
          <button className="lg:hidden p-1 rounded hover:bg-gray-100" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = item.href === '/portal'
              ? pathname === '/portal' || pathname.startsWith('/portal/shipments')
              : item.href === '/portal/quotations/new'
                ? pathname === '/portal/quotations/new'
                : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-50 text-[#215497] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-[#215497]' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-[#215497] font-semibold text-sm" suppressHydrationWarning>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate" suppressHydrationWarning>{profile?.company || profile?.full_name || 'Customer'}</div>
              <div className="text-xs text-gray-500 truncate" suppressHydrationWarning>{profile?.email || ''}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 w-full mt-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// ============ HEADER ============
function PortalHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const { profile } = useCustomerAuth();

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Customer';
  const initials = profile?.company
    ? profile.company.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100" onClick={onMenuClick}>
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-gray-400">Welcome back,</h1>
          <p className="text-base font-bold text-gray-900 -mt-0.5" suppressHydrationWarning>{displayName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 relative"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <Bell className="w-5 h-5 text-gray-600" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
              </div>
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-[#215497] font-semibold text-sm ml-1" suppressHydrationWarning>
          {initials}
        </div>
      </div>
    </header>
  );
}

// ============ AUTH REDIRECT (handles redirect only, no loading spinner) ============
function AuthRedirect() {
  const { isLoading, user, profile } = useCustomerAuth();

  useEffect(() => {
    if (isLoading) return; // ยังโหลดอยู่ รอก่อน

    // ไม่มี session → ไป login
    if (!user) {
      window.location.href = '/site/login';
      return;
    }

    // login แล้วแต่ไม่ใช่ customer → ไป internal
    if (profile && profile.role !== 'customer') {
      window.location.href = '/quotations';
      return;
    }
  }, [isLoading, user, profile]);

  return null;
}

// ============ INNER LAYOUT (always renders sidebar + header) ============
function CustomerLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthRedirect />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <PortalHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// ============ LAYOUT (wraps with CustomerAuthProvider) ============
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CustomerLayoutInner>{children}</CustomerLayoutInner>
    </CustomerAuthProvider>
  );
}
