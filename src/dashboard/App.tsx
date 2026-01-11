/// <reference types="vite/client" />
// Admin Dashboard App
import { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AdsManagementPage } from './pages/AdsManagementPage';

interface User {
  email: string;
  role: 'admin' | 'manager' | 'viewer';
}

type Page = 'dashboard' | 'config' | 'ads' | 'questions';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const handleLogin = async (email: string, _password: string) => {
    // TODO: Implement actual authentication with Convex
    // For MVP, simulate login
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate basic auth check
    if (email && _password) {
      setUser({
        email,
        role: 'admin',
      });
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Render current page
  switch (currentPage) {
    case 'config':
      return <ConfigurationPage onBack={() => setCurrentPage('dashboard')} />;
    case 'ads':
      return <AdsManagementPage onBack={() => setCurrentPage('dashboard')} />;
    case 'dashboard':
    default:
      return (
        <DashboardPage
          user={user}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      );
  }
}

export default App;
