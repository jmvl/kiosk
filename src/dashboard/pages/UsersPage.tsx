// Admin Dashboard - Users Management Page
import { useState, useEffect } from 'react';

type UserRole = 'chain_hq' | 'regional_manager' | 'store_owner' | 'brand_advertiser';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  lastLogin: Date | null;
}

const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    chain_hq: 'Chain HQ Admin',
    regional_manager: 'Regional Manager',
    store_owner: 'Store Owner',
    brand_advertiser: 'Brand Advertiser',
  };
  return roleNames[role];
};

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      setUsers([
        {
          id: 'USR-001',
          email: 'admin@chain.be',
          name: 'Jean Admin',
          role: 'chain_hq',
          active: true,
          createdAt: new Date('2024-01-15'),
          lastLogin: new Date(),
        },
        {
          id: 'USR-002',
          email: 'regional@chain.be',
          name: 'Marie Manager',
          role: 'regional_manager',
          active: true,
          createdAt: new Date('2024-02-01'),
          lastLogin: new Date(Date.now() - 86400000),
        },
        {
          id: 'USR-003',
          email: 'store@shop.be',
          name: 'Pierre Owner',
          role: 'store_owner',
          active: true,
          createdAt: new Date('2024-03-10'),
          lastLogin: new Date(Date.now() - 172800000),
        },
        {
          id: 'USR-004',
          email: 'marketing@brand.be',
          name: 'Sophie Advertiser',
          role: 'brand_advertiser',
          active: true,
          createdAt: new Date('2024-04-01'),
          lastLogin: null,
        },
        {
          id: 'USR-005',
          email: 'old@chain.be',
          name: 'Old User',
          role: 'regional_manager',
          active: false,
          createdAt: new Date('2023-06-01'),
          lastLogin: new Date('2024-06-01'),
        },
      ]);

      setIsLoading(false);
    };

    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage admin users and permissions</p>
      </div>

      <div className="page-actions">
        <button className="primary-button">+ Add User</button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Roles</option>
          <option value="chain_hq">Chain HQ Admin</option>
          <option value="regional_manager">Regional Manager</option>
          <option value="store_owner">Store Owner</option>
          <option value="brand_advertiser">Brand Advertiser</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{getRoleDisplayName(user.role)}</td>
                <td>
                  <span className={`status-badge ${user.active ? 'online' : 'offline'}`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.createdAt.toLocaleDateString()}</td>
                <td>{user.lastLogin?.toLocaleDateString() || 'Never'}</td>
                <td>
                  <button className="action-button small">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
