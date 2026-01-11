/// <reference types="vite/client" />
// Admin Dashboard App
import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AdsManagementPage } from './pages/AdsManagementPage';
import { Sidebar, UserRole } from './components/Sidebar';
import { KiosksPage } from './pages/KiosksPage';
import { KioskDetailPage } from './pages/KioskDetailPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { UsersPage } from './pages/UsersPage';
import { QuestionsPage } from './pages/QuestionsPage';

export interface User {
  email: string;
  name?: string;
  role: UserRole;
}

export type Page = 'dashboard' | 'kiosks' | 'kiosk-detail' | 'campaigns' | 'analytics' | 'users' | 'config' | 'questions' | 'ads';

// Parse hash to get page and optional ID
interface ParsedHash {
  page: Page;
  id?: string;
}

const parseHash = (): ParsedHash => {
  const hash = window.location.hash.replace('#', '');
  const [page, id] = hash.split('/');
  const validPages: Page[] = ['dashboard', 'kiosks', 'kiosk-detail', 'campaigns', 'analytics', 'users', 'config', 'questions', 'ads'];
  return {
    page: validPages.includes(page as Page) ? (page as Page) : 'dashboard',
    id,
  };
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(() => parseHash().page);
  const [selectedKioskId, setSelectedKioskId] = useState<string | undefined>(() => parseHash().id);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const { page, id } = parseHash();
      setCurrentPage(page);
      setSelectedKioskId(id);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogin = async (email: string, _password: string) => {
    // TODO: Implement actual authentication with Convex
    // For MVP, simulate login
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate basic auth check
    if (email && _password) {
      // Determine role based on email domain/pattern for demo purposes
      let role: UserRole = 'chain_hq';
      if (email.includes('regional')) {
        role = 'regional_manager';
      } else if (email.includes('store')) {
        role = 'store_owner';
      } else if (email.includes('brand') || email.includes('advertiser')) {
        role = 'brand_advertiser';
      }

      setUser({
        email,
        name: email.split('@')[0],
        role,
      });
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
    setSelectedKioskId(undefined);
    // Clear hash on logout
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleNavigate = useCallback((page: string, id?: string) => {
    const newPage = page as Page;
    setCurrentPage(newPage);
    setSelectedKioskId(id);
    // Push to browser history for back button support
    const hash = id ? `#${newPage}/${id}` : `#${newPage}`;
    window.history.pushState({ page: newPage, id }, '', hash);
  }, []);

  const handleNavigateToKiosk = useCallback((kioskId: string) => {
    handleNavigate('kiosk-detail', kioskId);
  }, [handleNavigate]);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Render page content based on current page
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage user={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
      case 'kiosks':
        return <KiosksPage onNavigateToKiosk={handleNavigateToKiosk} />;
      case 'kiosk-detail':
        return (
          <KioskDetailPage
            kioskId={selectedKioskId || ''}
            onBack={() => handleNavigate('kiosks')}
          />
        );
      case 'campaigns':
        return <CampaignsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'users':
        return <UsersPage />;
      case 'config':
        return <ConfigurationPage onBack={() => handleNavigate('dashboard')} />;
      case 'questions':
        return <QuestionsPage />;
      case 'ads':
        return <AdsManagementPage onBack={() => handleNavigate('dashboard')} />;
      default:
        return <DashboardPage user={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
    }
  };

  // Determine which sidebar page to highlight (kiosk-detail should highlight kiosks)
  const sidebarPage = currentPage === 'kiosk-detail' ? 'kiosks' : currentPage;

  return (
    <div className="dashboard-layout">
      <Sidebar
        user={user}
        currentPage={sidebarPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      <main className="dashboard-main">
        {renderPageContent()}
      </main>
    </div>
  );
}

export default App;
