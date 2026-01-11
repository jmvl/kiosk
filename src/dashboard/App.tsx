/// <reference types="vite/client" />
// Admin Dashboard App
import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AdsManagementPage } from './pages/AdsManagementPage';
import { Sidebar, UserRole } from './components/Sidebar';
import { KiosksPage } from './pages/KiosksPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { UsersPage } from './pages/UsersPage';
import { QuestionsPage } from './pages/QuestionsPage';

export interface User {
  email: string;
  name?: string;
  role: UserRole;
}

export type Page = 'dashboard' | 'kiosks' | 'campaigns' | 'analytics' | 'users' | 'config' | 'questions' | 'ads';

// Helper to get page from URL hash
const getPageFromHash = (): Page => {
  const hash = window.location.hash.replace('#', '');
  const validPages: Page[] = ['dashboard', 'kiosks', 'campaigns', 'analytics', 'users', 'config', 'questions', 'ads'];
  return validPages.includes(hash as Page) ? (hash as Page) : 'dashboard';
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(getPageFromHash);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromHash());
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
    // Clear hash on logout
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleNavigate = useCallback((page: string) => {
    const newPage = page as Page;
    setCurrentPage(newPage);
    // Push to browser history for back button support
    window.history.pushState({ page: newPage }, '', `#${newPage}`);
  }, []);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Render page content based on current page
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage user={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
      case 'kiosks':
        return <KiosksPage />;
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

  return (
    <div className="dashboard-layout">
      <Sidebar
        user={user}
        currentPage={currentPage}
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
