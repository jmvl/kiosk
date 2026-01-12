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
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<AdminUser & { password: string }>>({
    email: '',
    name: '',
    role: 'store_owner',
    active: true,
    password: '',
  });

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

  const handleEdit = (user: AdminUser) => {
    setEditingUser({ ...user });
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === editingUser.id ? editingUser : u))
    );
    setEditingUser(null);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  // Create new user
  const handleCreateUser = () => {
    if (!newUser.email || !newUser.name || !newUser.password) {
      alert('Please fill in all required fields (name, email, and password)');
      return;
    }

    // Check if email already exists
    if (users.some((u) => u.email.toLowerCase() === newUser.email?.toLowerCase())) {
      alert('A user with this email already exists');
      return;
    }

    const user: AdminUser = {
      id: `USR-${String(users.length + 1).padStart(3, '0')}`,
      email: newUser.email || '',
      name: newUser.name || '',
      role: newUser.role || 'store_owner',
      active: newUser.active ?? true,
      createdAt: new Date(),
      lastLogin: null,
    };

    setUsers((prev) => [...prev, user]);
    setShowCreateModal(false);
    setNewUser({
      email: '',
      name: '',
      role: 'store_owner',
      active: true,
      password: '',
    });

    // In production, this would create the user in Convex
    // Password would be hashed and stored server-side
    console.log(`[UsersPage] Created new user: ${user.email} with role ${user.role}`);
  };

  // Delete user
  const handleDeleteUser = (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    // TODO: Delete from Convex
  };

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
        <button className="primary-button" onClick={() => setShowCreateModal(true)}>
          + Add User
        </button>
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
                  <div className="action-buttons">
                    <button
                      className="action-button small"
                      onClick={() => handleEdit(user)}
                      data-testid={`edit-user-${user.id}`}
                    >
                      Edit
                    </button>
                    <button
                      className="action-button small delete"
                      onClick={() => handleDeleteUser(user.id)}
                      data-testid={`delete-user-${user.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="modal-overlay" data-testid="edit-modal">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="close-button" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>User ID</label>
                <input type="text" value={editingUser.id} disabled />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    data-testid="edit-user-name"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    data-testid="edit-user-email"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                    }
                    data-testid="edit-user-role"
                  >
                    <option value="chain_hq">Chain HQ Admin</option>
                    <option value="regional_manager">Regional Manager</option>
                    <option value="store_owner">Store Owner</option>
                    <option value="brand_advertiser">Brand Advertiser</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingUser.active ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, active: e.target.value === 'active' })
                    }
                    data-testid="edit-user-status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="primary-button" onClick={handleSaveEdit} data-testid="save-edit">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" data-testid="create-modal">
          <div className="modal">
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={newUser.name || ''}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter full name"
                    data-testid="create-user-name"
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newUser.email || ''}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email address"
                    data-testid="create-user-email"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={newUser.password || ''}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                  data-testid="create-user-password"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={newUser.role || 'store_owner'}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    data-testid="create-user-role"
                  >
                    <option value="chain_hq">Chain HQ Admin</option>
                    <option value="regional_manager">Regional Manager</option>
                    <option value="store_owner">Store Owner</option>
                    <option value="brand_advertiser">Brand Advertiser</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newUser.active ? 'active' : 'inactive'}
                    onChange={(e) => setNewUser({ ...newUser, active: e.target.value === 'active' })}
                    data-testid="create-user-status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="primary-button" onClick={handleCreateUser} data-testid="create-user-submit">
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
