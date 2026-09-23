import React, { useState, useEffect, useCallback, useRef } from 'react';
import API from '../api/axios';
import UsersPanel from '../components/UsersPanel';
import '../styles/dashboard.css';

const BD_LOCATION_DATA = {
  "Dhaka": {
    "Dhaka Sadar": ["Gulshan", "Banani", "Dhanmondi", "Mirpur", "Uttara", "Motijheel", "Mohakhali", "Tejgaon", "Malibag", "Rampura", "Khilgaon", "Badda", "Ramna", "Paltan", "Lalbagh", "Hazaribagh", "Kotwali", "Sutrapur", "Wari", "Shahbagh"],
    "Demra": ["Demra Sadar", "Sarulia", "Dogair", "Matuail", "Konapara"],
    "Savar": ["Savar Sadar", "Ashulia", "Hemayetpur", "EPZ", "Nabinagar"],
    "Keraniganj": ["Zinzira", "Shubhadya", "Aganagar", "Taranagar", "Bhabanipur"],
  },
  "Chittagong": {
    "Chittagong Sadar": ["Kotwali", "Pahartali", "Double Mooring", "Khulshi", "Halishahar", "Bakalia"],
    "Hathazari": ["Hathazari Sadar", "Fatehabad", "Madrasha", "Chowdhury Hat"],
    "Mirsharai": ["Mirsharai Sadar", "Durgapur", "Hinguli", "Katachhara"],
  },
  "Sylhet": {
    "Sylhet Sadar": ["Zindabazar", "Ambarkhana", "Shibganj", "Uposhohor", "Subhanighat"],
    "Balaganj": ["Balaganj Sadar", "Bala", "Deorail", "Gahar"],
    "Beanibazar": ["Beanibazar Sadar", "Mathura", "Chararkhai", "Alipur"],
  },
  "Rajshahi": {
    "Rajshahi Sadar": ["Boalia", "Motihar", "Rajpara", "Shah Makdum"],
    "Bagha": ["Bagha Sadar", "Bajha", "Garipur", "Monigram"],
  },
};

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Processing', label: 'Processing' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Delivered', label: 'Delivered' },
];

const PAGE_SIZE = 8;
const FORM_FIELDS = ['title', 'sender', 'receiver', 'weight', 'district', 'subDistrict', 'thana'];

const EMPTY_FORM = {
  title: '',
  sender: '',
  receiver: '',
  weight: '',
  district: '',
  subDistrict: '',
  thana: '',
  status: 'Pending',
};

const EMPTY_STATS = { total: 0, pending: 0, processing: 0, in_transit: 0, delivered: 0 };

/* ---------- Helpers ---------- */

const statusClass = (status) => String(status || '').toLowerCase().replace(/\s+/g, '-');

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
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : '';
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  return fallback;
}

function validateField(name, value) {
  const v = String(value ?? '').trim();
  switch (name) {
    case 'title':
      if (!v) return 'Enter a parcel title';
      if (v.length > 100) return 'Title must be 100 characters or fewer';
      return '';
    case 'sender':
      if (!v) return 'Enter the sender name';
      if (v.length < 3) return 'Name must be at least 3 characters';
      return '';
    case 'receiver':
      if (!v) return 'Enter the receiver name';
      if (v.length < 3) return 'Name must be at least 3 characters';
      return '';
    case 'weight': {
      if (!v) return 'Enter the weight';
      const w = parseFloat(v);
      if (isNaN(w) || w < 0.1 || w > 100) return 'Weight must be between 0.1 and 100 kg';
      return '';
    }
    case 'district':
      return v ? '' : 'Select a district';
    case 'subDistrict':
      return v ? '' : 'Select a sub-district';
    case 'thana':
      return v ? '' : 'Select a thana or area';
    default:
      return '';
  }
}

/* ---------- Small components ---------- */

function SortHeader({ label, column, sortKey, sortDir, onSort }) {
  const active = sortKey === column;
  return (
    <th aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`sort-btn ${active ? 'active' : ''}`}
        onClick={() => onSort(column)}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

/* ---------- Main component ---------- */

export default function Dashboard({ adminData, onLogout }) {
  const isAdmin = adminData?.role === 'admin';
  const [activeTab, setActiveTab] = useState('parcels');
  const [pendingUsers, setPendingUsers] = useState(0);
  // Admin can change any parcel; a normal user only while it is still Pending
  const canModify = (parcel) => isAdmin || parcel.status === 'Pending';

  // Data from the backend
  const [parcels, setParcels] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Form
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingParcel, setEditingParcel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search, filter, sort, pagination (sent to the backend)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const formRef = useRef(null);
  const toastTimer = useRef(null);

  /* Toast */
  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* Wait 300ms after typing before searching */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  /* ---------- Load data from the backend ---------- */

  const fetchParcels = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await API.get('/api/parcels', {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter === 'All' ? undefined : statusFilter,
          sort_by: sortKey,
          order: sortDir,
          page,
          limit: PAGE_SIZE,
        },
      });
      setParcels(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.pages);
      // If the last item on a page was deleted, go back one page
      if (page > res.data.pages) setPage(res.data.pages);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load parcels'), 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [debouncedSearch, statusFilter, sortKey, sortDir, page, showToast]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get('/api/parcels/stats');
      setStats(res.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load summary'), 'error');
    }
  }, [showToast]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /* Admin only: how many new accounts are waiting for approval */
  useEffect(() => {
    if (!isAdmin) return;
    API.get('/api/users/stats')
      .then((res) => setPendingUsers(res.data.pending))
      .catch(() => {});
  }, [isAdmin]);

  const refreshAll = () => {
    fetchParcels();
    fetchStats();
  };

  /* Close the delete dialog with Escape */
  useEffect(() => {
    if (!deleteTarget) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  /* ---------- Form handlers ---------- */

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'district') {
        next.subDistrict = '';
        next.thana = '';
      }
      if (name === 'subDistrict') {
        next.thana = '';
      }
      return next;
    });

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      if (name === 'district') {
        delete next.subDistrict;
        delete next.thana;
      }
      if (name === 'subDistrict') delete next.thana;
      return next;
    });
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    const message = validateField(name, value);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setEditingParcel(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    FORM_FIELDS.forEach((field) => {
      const message = validateField(field, formData[field]);
      if (message) errors[field] = message;
    });
    setFormErrors(errors);

    const firstInvalid = FORM_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      showToast('Fix the highlighted fields', 'error');
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    // Field names match the backend (snake_case)
    const payload = {
      title: formData.title.trim(),
      sender_name: formData.sender.trim(),
      receiver_name: formData.receiver.trim(),
      weight: parseFloat(formData.weight),
      district: formData.district,
      sub_district: formData.subDistrict,
      thana: formData.thana,
      // Only the admin decides the shipping status
      ...(isAdmin ? { status: formData.status } : {}),
    };

    setIsSubmitting(true);
    try {
      if (editingParcel) {
        await API.put(`/api/parcels/${editingParcel.id}`, payload);
        showToast(`Saved changes to ${editingParcel.tracking_id}`);
      } else {
        const res = await API.post('/api/parcels', payload);
        setSortKey('created_at');
        setSortDir('desc');
        setPage(1);
        showToast(`Added parcel ${res.data.tracking_id}`);
      }
      resetForm();
      refreshAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not save the parcel'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (parcel) => {
    setEditingParcel(parcel);
    setFormData({
      title: parcel.title,
      sender: parcel.sender_name,
      receiver: parcel.receiver_name,
      weight: String(parcel.weight),
      district: parcel.district,
      subDistrict: parcel.sub_district,
      thana: parcel.thana,
      status: parcel.status,
    });
    setFormErrors({});
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await API.delete(`/api/parcels/${target.id}`);
      if (editingParcel?.id === target.id) resetForm();
      showToast(`Deleted parcel ${target.tracking_id}`);
      refreshAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not delete the parcel'), 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleStatusChange = async (parcel, newStatus) => {
    try {
      await API.put(`/api/parcels/${parcel.id}`, { status: newStatus });
      showToast(`${parcel.tracking_id} is now ${newStatus}`);
      refreshAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update the status'), 'error');
    }
  };

  /* ---------- Search, filter, sort ---------- */

  const applyStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('All');
    setPage(1);
  };

  const handleSort = (column) => {
    if (sortKey === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column);
      setSortDir(column === 'created_at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const counts = {
    All: stats.total,
    Pending: stats.pending,
    Processing: stats.processing,
    'In Transit': stats.in_transit,
    Delivered: stats.delivered,
  };

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const isFiltering = searchTerm.trim() !== '' || statusFilter !== 'All';

  /* ---------- CSV export (current search and filter, up to 100 rows) ---------- */

  const exportCsv = async () => {
    try {
      const res = await API.get('/api/parcels', {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter === 'All' ? undefined : statusFilter,
          sort_by: sortKey,
          order: sortDir,
          page: 1,
          limit: 100,
        },
      });
      const rowsData = res.data.data;
      const header = [
        'Tracking ID', 'Title', 'Weight (kg)', 'Sender', 'Receiver',
        'District', 'Sub-district', 'Thana', 'Status', 'Created',
      ];
      const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = rowsData.map((p) => [
        p.tracking_id, p.title, p.weight, p.sender_name, p.receiver_name,
        p.district, p.sub_district, p.thana, p.status, formatDate(p.created_at),
      ]);
      const csv = [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `parcels-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${rowsData.length} parcels to CSV`);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not export parcels'), 'error');
    }
  };

  /* ---------- Derived data for the form ---------- */

  const districts = Object.keys(BD_LOCATION_DATA);
  const subDistricts = formData.district ? Object.keys(BD_LOCATION_DATA[formData.district] || {}) : [];
  const thanas =
    formData.district && formData.subDistrict
      ? (BD_LOCATION_DATA[formData.district] || {})[formData.subDistrict] || []
      : [];

  const inputClass = (name) => `form-input ${formErrors[name] ? 'error' : ''}`;
  const ariaFor = (name) => ({
    'aria-invalid': formErrors[name] ? 'true' : 'false',
    'aria-describedby': formErrors[name] ? `${name}-error` : undefined,
  });

  /* ---------- Render ---------- */

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">S</div>
          <div>
            <h1>SwiftLogistics {isAdmin ? 'Admin Panel' : 'Dashboard'}</h1>
            <p className="header-subtitle">Shipment and parcel management</p>
          </div>
        </div>
        <div className="header-right">
          {adminData && (
            <span className="admin-info">
              {adminData.email} ({isAdmin ? 'admin' : 'user'})
            </span>
          )}
          <button type="button" className="btn-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          <span className="toast-icon" aria-hidden="true">
            {toast.type === 'success' ? '✓' : '!'}
          </span>
          {toast.message}
        </div>
      )}

      <main className="dashboard-main">
        {isAdmin && (
          <nav className="dash-tabs" aria-label="Dashboard sections">
            <button
              type="button"
              className={`dash-tab ${activeTab === 'parcels' ? 'active' : ''}`}
              onClick={() => setActiveTab('parcels')}
            >
              Parcels
            </button>
            <button
              type="button"
              className={`dash-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users
              {pendingUsers > 0 && <span className="tab-badge">{pendingUsers}</span>}
            </button>
          </nav>
        )}

        {isAdmin && activeTab === 'users' ? (
          <UsersPanel showToast={showToast} onPendingChange={setPendingUsers} />
        ) : (
          <>
        {/* Summary */}
        <section className="summary-grid" aria-label="Shipment summary">
          <button
            type="button"
            className={`summary-card summary-all ${statusFilter === 'All' ? 'active' : ''}`}
            onClick={() => applyStatusFilter('All')}
          >
            <span className="summary-count">{counts.All}</span>
            <span className="summary-label">All parcels</span>
          </button>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`summary-card summary-${statusClass(opt.value)} ${
                statusFilter === opt.value ? 'active' : ''
              }`}
              onClick={() => applyStatusFilter(opt.value)}
            >
              <span className="summary-count">{counts[opt.value]}</span>
              <span className="summary-label">{opt.label}</span>
            </button>
          ))}
        </section>

        {/* Form (add and edit) */}
        <section className={`form-section ${editingParcel ? 'is-editing' : ''}`} ref={formRef}>
          <div className="section-header">
            <h2>{editingParcel ? `Edit parcel ${editingParcel.tracking_id}` : 'Add a new parcel'}</h2>
            <p>
              {editingParcel
                ? 'Update the details below, then save your changes.'
                : 'Choose the destination and set the starting status.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="parcel-form" noValidate>
            <div className="form-group-full">
              <Field id="title" label="Parcel title" error={formErrors.title}>
                <input
                  id="title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  placeholder="Electronics, documents, clothing"
                  className={inputClass('title')}
                  disabled={isSubmitting}
                  {...ariaFor('title')}
                />
              </Field>
            </div>

            <div className="form-row">
              <Field id="sender" label="Sender name" error={formErrors.sender}>
                <input
                  id="sender"
                  type="text"
                  name="sender"
                  value={formData.sender}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  placeholder="Full name"
                  className={inputClass('sender')}
                  disabled={isSubmitting}
                  {...ariaFor('sender')}
                />
              </Field>

              <Field id="receiver" label="Receiver name" error={formErrors.receiver}>
                <input
                  id="receiver"
                  type="text"
                  name="receiver"
                  value={formData.receiver}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  placeholder="Full name"
                  className={inputClass('receiver')}
                  disabled={isSubmitting}
                  {...ariaFor('receiver')}
                />
              </Field>

              <Field id="weight" label="Weight (kg)" error={formErrors.weight}>
                <input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  name="weight"
                  value={formData.weight}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  placeholder="0.0"
                  className={inputClass('weight')}
                  disabled={isSubmitting}
                  {...ariaFor('weight')}
                />
              </Field>
            </div>

            <div className="form-row">
              <Field id="district" label="District" error={formErrors.district}>
                <select
                  id="district"
                  name="district"
                  value={formData.district}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  className={inputClass('district')}
                  disabled={isSubmitting}
                  {...ariaFor('district')}
                >
                  <option value="">Select district</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>

              <Field id="subDistrict" label="Sub-district / Upazila" error={formErrors.subDistrict}>
                <select
                  id="subDistrict"
                  name="subDistrict"
                  value={formData.subDistrict}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  className={inputClass('subDistrict')}
                  disabled={!formData.district || isSubmitting}
                  {...ariaFor('subDistrict')}
                >
                  <option value="">Select sub-district</option>
                  {subDistricts.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field id="thana" label="Thana / Area" error={formErrors.thana}>
                <select
                  id="thana"
                  name="thana"
                  value={formData.thana}
                  onChange={handleFormChange}
                  onBlur={handleFieldBlur}
                  className={inputClass('thana')}
                  disabled={!formData.subDistrict || isSubmitting}
                  {...ariaFor('thana')}
                >
                  <option value="">Select thana or area</option>
                  {thanas.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>

            {isAdmin && (
            <div className="form-group-full">
              <Field id="status" label={editingParcel ? 'Shipment status' : 'Starting status'}>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="form-input"
                  disabled={isSubmitting}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-small" />
                    Saving...
                  </>
                ) : editingParcel ? (
                  'Save changes'
                ) : (
                  'Add parcel'
                )}
              </button>
              {editingParcel && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Search and filter */}
        <section className="filter-section">
          <label htmlFor="search" className="sr-only">Search parcels</label>
          <input
            id="search"
            type="search"
            placeholder="Search by ID, title, sender, receiver or place"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="search-input"
          />
          <div className="filter-group">
            <label htmlFor="statusFilter">Status</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => applyStatusFilter(e.target.value)}
              className="form-input filter-select"
            >
              <option value="All">All statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {isFiltering && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </section>

        {/* Table */}
        <section className="table-section">
          <div className="table-header">
            <div className="table-title">
              <h2>Shipments</h2>
              <span className="badge badge-info">
                {total} of {stats.total}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={exportCsv}
              disabled={total === 0}
            >
              Export CSV
            </button>
          </div>

          {isLoadingList && parcels.length === 0 ? (
            <div className="empty-state">
              <p>Loading parcels...</p>
            </div>
          ) : total === 0 ? (
            <div className="empty-state">
              {stats.total === 0 ? (
                <>
                  <p>No parcels yet</p>
                  <span>Use the form above to add your first parcel.</span>
                </>
              ) : (
                <>
                  <p>No parcels match your search</p>
                  <span>Try a different keyword, or clear the filters.</span>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="parcels-table">
                  <thead>
                    <tr>
                      <SortHeader label="Tracking ID" column="tracking_id" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Parcel" column="title" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Sender / receiver" column="receiver_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Destination" column="district" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Created" column="created_at" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      {isAdmin && <th>Owner</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((parcel) => (
                      <tr key={parcel.id} className={editingParcel?.id === parcel.id ? 'row-editing' : ''}>
                        <td className="tracking-id">{parcel.tracking_id}</td>
                        <td>
                          <div className="title-col">{parcel.title}</div>
                          <div className="weight-col">{parcel.weight} kg</div>
                        </td>
                        <td>
                          <div className="sender-col">From <strong>{parcel.sender_name}</strong></div>
                          <div className="receiver-col">To <strong>{parcel.receiver_name}</strong></div>
                        </td>
                        <td>
                          <div className="district-col">{parcel.district}</div>
                          <div className="location-col">{parcel.sub_district}, {parcel.thana}</div>
                        </td>
                        <td>
                          {isAdmin ? (
                            <select
                              value={parcel.status}
                              onChange={(e) => handleStatusChange(parcel, e.target.value)}
                              className={`status-select status-${statusClass(parcel.status)}`}
                              aria-label={`Status for ${parcel.tracking_id}`}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`status-select status-${statusClass(parcel.status)}`}>
                              {parcel.status}
                            </span>
                          )}
                        </td>
                        <td className="date-col">{formatDate(parcel.created_at)}</td>
                        {isAdmin && (
                          <td className="date-col">{parcel.created_by_email || 'Deleted user'}</td>
                        )}
                        <td>
                          {canModify(parcel) ? (
                            <div className="row-actions">
                              <button type="button" className="row-btn" onClick={() => startEdit(parcel)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="row-btn row-btn-danger"
                                onClick={() => setDeleteTarget(parcel)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="weight-col" title="Only the admin can change a parcel after it has been processed">Locked</span>
                          )}
                        </td>
                      </tr>
                    ))}
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
          </>
        )}
      </main>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-title">Delete this parcel?</h3>
            <p>
              {deleteTarget.tracking_id} ({deleteTarget.title}) will be removed from the system.
              This can't be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                autoFocus
              >
                Keep parcel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                Delete parcel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
