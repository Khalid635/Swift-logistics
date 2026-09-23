import React, { useState, useEffect, useCallback } from 'react';
import API from '../api/axios';
import '../styles/users.css';

const PAGE_SIZE = 8;

const STATUS_LABELS = {
  pending: 'Waiting for approval',
  active: 'Approved',
  blocked: 'Blocked',
};

const EMPTY_STATS = { total: 0, pending: 0, active: 0, blocked: 0 };

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getErrorMessage(err, fallback) {
  if (!err.response) return 'Cannot reach the server. Check that the backend is running.';
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}

export default function UsersPanel({ showToast, onPendingChange }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get('/api/users/stats');
      setStats(res.data);
      if (onPendingChange) onPendingChange(res.data.pending);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load user summary'), 'error');
    }
  }, [onPendingChange, showToast]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/api/users', {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter === 'All' ? undefined : statusFilter,
          page,
          limit: PAGE_SIZE,
        },
      });
      setUsers(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.pages);
      if (page > res.data.pages) setPage(res.data.pages);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load users'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshAll = () => {
    fetchUsers();
    fetchStats();
  };

  const changeStatus = async (user, newStatus, message) => {
    setBusyId(user.id);
    try {
      await API.patch(`/api/users/${user.id}/status`, { status: newStatus });
      showToast(message);
      refreshAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the user'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    try {
      await API.delete(`/api/users/${target.id}`);
      showToast(`Removed ${target.email}`);
      refreshAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not remove the user'), 'error');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const applyStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const isFiltering = searchTerm.trim() !== '' || statusFilter !== 'All';

  const filterCards = [
    { key: 'All', label: 'All users', count: stats.total },
    { key: 'pending', label: 'Waiting', count: stats.pending },
    { key: 'active', label: 'Approved', count: stats.active },
    { key: 'blocked', label: 'Blocked', count: stats.blocked },
  ];

  return (
    <>
      <section className="summary-grid" aria-label="User summary">
        {filterCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`summary-card ${statusFilter === card.key ? 'active' : ''}`}
            onClick={() => applyStatusFilter(card.key)}
          >
            <span className="summary-count">{card.count}</span>
            <span className="summary-label">{card.label}</span>
          </button>
        ))}
      </section>

      <section className="filter-section">
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <input
          id="user-search"
          type="search"
          placeholder="Search by email"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="search-input"
        />
        {isFiltering && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchTerm('');
              setDebouncedSearch('');
              setStatusFilter('All');
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
      </section>

      <section className="table-section">
        <div className="table-header">
          <div className="table-title">
            <h2>Users</h2>
            <span className="badge badge-info">
              {total} of {stats.total}
            </span>
          </div>
        </div>

        {isLoading && users.length === 0 ? (
          <div className="empty-state">
            <p>Loading users...</p>
          </div>
        ) : total === 0 ? (
          <div className="empty-state">
            {stats.total === 0 ? (
              <>
                <p>No users yet</p>
                <span>New sign-ups will appear here for you to approve.</span>
              </>
            ) : (
              <>
                <p>No users match your search</p>
                <span>Try a different email, or clear the filters.</span>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="parcels-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Account</th>
                    <th>Parcels</th>
                    <th>Signed up</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const busy = busyId === user.id;
                    return (
                      <tr key={user.id}>
                        <td className="tracking-id">{user.email}</td>
                        <td>
                          <span className={`user-status user-status-${user.status}`}>
                            {STATUS_LABELS[user.status] || user.status}
                          </span>
                        </td>
                        <td>{user.parcel_count}</td>
                        <td className="date-col">{formatDate(user.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            {user.status === 'pending' && (
                              <button
                                type="button"
                                className="row-btn"
                                disabled={busy}
                                onClick={() => changeStatus(user, 'active', `Approved ${user.email}`)}
                              >
                                Approve
                              </button>
                            )}
                            {user.status === 'active' && (
                              <button
                                type="button"
                                className="row-btn"
                                disabled={busy}
                                onClick={() => changeStatus(user, 'blocked', `Blocked ${user.email}`)}
                              >
                                Block
                              </button>
                            )}
                            {user.status === 'blocked' && (
                              <button
                                type="button"
                                className="row-btn"
                                disabled={busy}
                                onClick={() => changeStatus(user, 'active', `Unblocked ${user.email}`)}
                              >
                                Unblock
                              </button>
                            )}
                            <button
                              type="button"
                              className="row-btn row-btn-danger"
                              disabled={busy}
                              onClick={() => setDeleteTarget(user)}
                            >
                              {user.status === 'pending' ? 'Reject' : 'Remove'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + PAGE_SIZE, total)} of {total}
              </span>
              <div className="page-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="remove-user-title">
              {deleteTarget.status === 'pending' ? 'Reject this sign-up?' : 'Remove this user?'}
            </h3>
            <p>
              {deleteTarget.email} will lose access and the account will be deleted.
              {deleteTarget.parcel_count > 0
                ? ` Their ${deleteTarget.parcel_count} parcel(s) stay in the system and only you can see them.`
                : ''}{' '}
              This can't be undone. To stop someone without deleting the account, use Block instead.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                autoFocus
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                {deleteTarget.status === 'pending' ? 'Reject sign-up' : 'Remove user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
