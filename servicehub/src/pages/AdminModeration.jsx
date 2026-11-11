import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../api/client';
import Icon from '../components/Icon';
import './AdminModeration.css';

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const AdminModeration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('services');
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [reportStatus, setReportStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [services, setServices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportNotes, setReportNotes] = useState({});
  const [savingReportId, setSavingReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.userType !== 'admin') return undefined;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (tab === 'services') {
          const params = new URLSearchParams({ page: String(page), limit: '50' });
          if (search.trim()) params.set('q', search.trim());
          const data = await apiRequest(`/admin/moderation/services?${params}`);
          if (!cancelled) {
            setServices(data.services ?? []);
            setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
          }
        } else if (tab === 'accounts') {
          const params = new URLSearchParams({ page: String(page), limit: '50' });
          if (search.trim()) params.set('q', search.trim());
          if (accountType) params.set('type', accountType);
          if (accountStatus) params.set('status', accountStatus);
          const data = await apiRequest(`/admin/moderation/accounts?${params}`);
          if (!cancelled) {
            setAccounts(data.accounts ?? []);
            setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
          }
        } else if (tab === 'reports') {
          const params = new URLSearchParams({ page: String(page), limit: '50' });
          if (search.trim()) params.set('q', search.trim());
          if (reportStatus) params.set('status', reportStatus);
          const data = await apiRequest(`/admin/reports?${params}`);
          if (!cancelled) {
            setReports(data.reports ?? []);
            setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
          }
        } else {
          const data = await apiRequest('/admin/moderation/audit');
          if (!cancelled) setAudit(data.audit ?? []);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Could not load moderation data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, tab, search, accountType, accountStatus, reportStatus, page]);

  const reviewReport = async (event, report, status) => {
    event.preventDefault();
    if (savingReportId !== null) return;
    setSavingReportId(report.id);
    try {
      const data = await apiRequest(`/admin/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        body: { status, adminNote: reportNotes[report.id] || '' }
      });
      if (reportStatus && reportStatus !== data.report.status) {
        setReports((current) => current.filter((item) => item.id !== report.id));
        setPagination((current) => ({
          ...current,
          total: Math.max(0, current.total - 1),
          pages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / (current.limit || 50)))
        }));
      } else {
        setReports((current) => current.map((item) => item.id === report.id
          ? { ...item, ...data.report, reviewerName: user.name } : item));
      }
      toast.success(status === 'reviewed' ? 'Report marked as reviewed' : 'Report dismissed');
    } catch (requestError) {
      setError(requestError.message || 'Could not update the report');
    } finally {
      setSavingReportId(null);
    }
  };

  const startAction = (nextAction) => {
    setAction(nextAction);
    setReason('');
    setError('');
  };

  const closeAction = () => {
    if (saving) return;
    setAction(null);
    setReason('');
  };

  const confirmAction = async (event) => {
    event.preventDefault();
    if (!action || reason.trim().length < 3 || saving) return;
    setSaving(true);
    try {
      if (action.kind === 'service') {
        await apiRequest(`/admin/moderation/services/${action.item.id}`, {
          method: 'DELETE', body: { reason: reason.trim() }
        });
        setServices((current) => current.filter((service) => service.id !== action.item.id));
        setPagination((current) => {
          const total = Math.max(0, current.total - 1);
          return { ...current, total, pages: Math.max(1, Math.ceil(total / (current.limit || 50))) };
        });
        toast.success('Service removed from the marketplace');
      } else {
        const data = await apiRequest(`/admin/moderation/accounts/${action.item.id}/status`, {
          method: 'PATCH', body: { isActive: action.isActive, reason: reason.trim() }
        });
        setAccounts((current) => current.map((account) => (
          account.id === data.account.id ? { ...account, isActive: data.account.isActive } : account
        )).filter((account) => accountStatus === 'active' ? account.isActive : accountStatus === 'suspended' ? !account.isActive : true));
        if ((accountStatus === 'active' && !action.isActive) || (accountStatus === 'suspended' && action.isActive)) {
          setPagination((current) => {
            const total = Math.max(0, current.total - 1);
            return { ...current, total, pages: Math.max(1, Math.ceil(total / (current.limit || 50))) };
          });
        }
        toast.success(action.isActive ? 'Account restored' : 'Account suspended and sessions revoked');
      }
      setAction(null);
      setReason('');
      // Refresh the moderation history after a successful action.
      const auditData = await apiRequest('/admin/moderation/audit');
      setAudit(auditData.audit ?? []);
    } catch (requestError) {
      setError(requestError.message || 'Moderation action failed');
    } finally {
      setSaving(false);
    }
  };

  if (user?.userType !== 'admin') {
    return <div className="admin-moderation-page"><div className="container"><div className="admin-forbidden"><h2>Access denied</h2><p>Only administrators can moderate the marketplace.</p></div></div></div>;
  }

  const actionTitle = action?.kind === 'service'
    ? 'Remove service'
    : action?.isActive ? 'Restore account' : 'Suspend account';

  return (
    <div className="admin-moderation-page">
      <div className="container">
        <header className="moderation-heading">
          <div><span>ADMINISTRATION</span><h1>Marketplace moderation</h1><p>Review listings and accounts, take action, and keep a reasoned audit trail.</p></div>
        </header>

        <div className="moderation-tabs" role="tablist" aria-label="Moderation sections">
          <button type="button" role="tab" aria-selected={tab === 'services'} className={tab === 'services' ? 'active' : ''} onClick={() => { setTab('services'); setPage(1); }}><Icon name="package" size={16} />Services</button>
          <button type="button" role="tab" aria-selected={tab === 'accounts'} className={tab === 'accounts' ? 'active' : ''} onClick={() => { setTab('accounts'); setPage(1); }}><Icon name="users" size={16} />Accounts</button>
          <button type="button" role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? 'active' : ''} onClick={() => { setTab('reports'); setPage(1); }}><Icon name="flag" size={16} />Reports</button>
          <button type="button" role="tab" aria-selected={tab === 'audit'} className={tab === 'audit' ? 'active' : ''} onClick={() => { setTab('audit'); setPage(1); }}><Icon name="shield" size={16} />Action history</button>
        </div>

        {tab !== 'audit' && (
          <div className="moderation-filters">
            <input aria-label="Search moderation records" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={tab === 'services' ? 'Search services or providers…' : tab === 'reports' ? 'Search reporter, reported user, or report text…' : 'Search name or email…'} />
            {tab === 'accounts' && <>
              <select aria-label="Account type" value={accountType} onChange={(event) => { setAccountType(event.target.value); setPage(1); }}><option value="">All account types</option><option value="customer">Customers</option><option value="provider">Providers</option></select>
              <select aria-label="Account status" value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value); setPage(1); }}><option value="active">Active</option><option value="suspended">Suspended</option><option value="">All statuses</option></select>
            </>}
            {tab === 'reports' && <select aria-label="Report status" value={reportStatus} onChange={(event) => { setReportStatus(event.target.value); setPage(1); }}><option value="pending">Pending review</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option><option value="">All reports</option></select>}
          </div>
        )}

        {error && <div className="moderation-error" role="alert">{error}</div>}
        {loading ? <div className="spinner" /> : tab === 'services' ? (
          <section className="moderation-panel" aria-label="Service listings">
            {services.length === 0 ? <div className="moderation-empty"><Icon name="package" size={28} /><h2>No services found</h2><p>Try another search.</p></div> : <div className="moderation-table-wrap"><table className="moderation-table"><thead><tr><th>Service</th><th>Provider</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {services.map((service) => <tr key={service.id}>
                <td><strong>{service.name}</strong><small>{service.category} · #{service.id}</small></td>
                <td>{service.ownerName || service.provider || '—'}{service.ownerEmail && <small>{service.ownerEmail}</small>}</td>
                <td>BDT{service.price} / {service.unit}</td>
                <td><span className={`moderation-status ${service.isActive && service.ownerIsActive !== false ? 'active' : 'suspended'}`}>{service.isActive && service.ownerIsActive !== false ? 'Live' : 'Hidden'}</span></td>
                <td><button className="moderation-danger-btn" type="button" onClick={() => startAction({ kind: 'service', item: service })}><Icon name="trash" size={15} />Remove</button></td>
              </tr>)}
            </tbody></table></div>}
          </section>
        ) : tab === 'accounts' ? (
          <section className="moderation-panel" aria-label="Customer and provider accounts">
            {accounts.length === 0 ? <div className="moderation-empty"><Icon name="users" size={28} /><h2>No accounts found</h2><p>Try another search or status.</p></div> : <div className="moderation-table-wrap"><table className="moderation-table"><thead><tr><th>Account</th><th>Type</th><th>Activity</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {accounts.map((account) => <tr key={account.id}>
                <td><strong>{account.name}</strong><small>{account.email}</small></td>
                <td className="moderation-type">{account.userType}</td>
                <td>{account.userType === 'provider' ? `${account.serviceCount} services` : `${account.bookingCount} bookings`}<small>Joined {formatDate(account.createdAt)}</small></td>
                <td><span className={`moderation-status ${account.isActive ? 'active' : 'suspended'}`}>{account.isActive ? 'Active' : 'Suspended'}</span></td>
                <td><button className={account.isActive ? 'moderation-danger-btn' : 'moderation-restore-btn'} type="button" onClick={() => startAction({ kind: 'account', item: account, isActive: !account.isActive })}><Icon name={account.isActive ? 'lock' : 'check'} size={15} />{account.isActive ? 'Suspend' : 'Restore'}</button></td>
              </tr>)}
            </tbody></table></div>}
          </section>
        ) : tab === 'reports' ? (
          <section className="moderation-panel" aria-label="User reports">
            {reports.length === 0 ? <div className="moderation-empty"><Icon name="flag" size={28} /><h2>No reports found</h2><p>New user and provider reports will appear here for review.</p></div> : <div className="moderation-table-wrap"><table className="moderation-table moderation-reports-table"><thead><tr><th>Reported by</th><th>Reported user</th><th>Reason and details</th><th>Submitted</th><th>Status and review</th></tr></thead><tbody>
              {reports.map((report) => <tr key={report.id}>
                <td><strong>{report.reporter.name}</strong><small>{report.reporter.userType} · {report.reporter.email}</small></td>
                <td><strong>{report.reportedUser.name}</strong><small>{report.reportedUser.userType} · {report.reportedUser.email}</small></td>
                <td className="moderation-report-details"><span className="moderation-action-label">{report.reason.replaceAll('_', ' ')}</span><small>{report.serviceName}</small><p>{report.description}</p><small>Conversation {report.conversationId}</small></td>
                <td>{formatDate(report.createdAt)}</td>
                <td className="moderation-report-review"><span className={`moderation-status ${report.status === 'pending' ? 'suspended' : 'active'}`}>{report.status}</span>{report.reviewedAt && <small>Reviewed by {report.reviewerName || 'admin'} · {formatDate(report.reviewedAt)}</small>}
                  <form onSubmit={(event) => reviewReport(event, report, 'reviewed')}><label className="sr-only" htmlFor={`report-note-${report.id}`}>Admin review note</label><textarea id={`report-note-${report.id}`} value={reportNotes[report.id] ?? report.adminNote ?? ''} onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Optional review note" /><div><button type="submit" className="moderation-restore-btn" disabled={savingReportId !== null}>{savingReportId === report.id ? 'Saving…' : 'Mark reviewed'}</button><button type="button" className="moderation-danger-btn" disabled={savingReportId !== null} onClick={(event) => reviewReport(event, report, 'dismissed')}>Dismiss</button></div></form>
                </td>
              </tr>)}
            </tbody></table></div>}
          </section>
        ) : (
          <section className="moderation-panel" aria-label="Moderation audit history">
            {audit.length === 0 ? <div className="moderation-empty"><Icon name="shield" size={28} /><h2>No moderation actions yet</h2><p>Admin actions will be recorded here.</p></div> : <div className="moderation-table-wrap"><table className="moderation-table"><thead><tr><th>Action</th><th>Target</th><th>Reason</th><th>Administrator</th><th>Date</th></tr></thead><tbody>
              {audit.map((entry) => <tr key={entry.id}><td><span className="moderation-action-label">{entry.action.replaceAll('_', ' ')}</span></td><td>{entry.targetName}<small>{entry.targetType} · {entry.targetId}</small></td><td className="moderation-reason-cell">{entry.reason}</td><td>{entry.actorName}</td><td>{formatDate(entry.createdAt)}</td></tr>)}
            </tbody></table></div>}
          </section>
        )}

        {tab !== 'audit' && !loading && pagination.pages > 1 && (
          <div className="moderation-pagination"><span>{pagination.total} records · Page {pagination.page} of {pagination.pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
        )}
      </div>

      {action && (
        <div className="moderation-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAction(); }}>
          <form className="moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-dialog-title" onSubmit={confirmAction}>
            <span className={`moderation-dialog-icon ${action.kind === 'service' || !action.isActive ? 'danger' : ''}`}><Icon name={action.kind === 'service' ? 'trash' : action.isActive ? 'check' : 'lock'} size={22} /></span>
            <h2 id="moderation-dialog-title">{actionTitle}</h2>
            <p>{action.kind === 'service'
              ? `“${action.item.name}” will be removed from the marketplace. Existing booking snapshots will be retained.`
              : action.isActive
                ? action.item.userType === 'provider'
                  ? `${action.item.name} will be able to sign in again and their published listings will become visible.`
                  : `${action.item.name} will be able to sign in and use their customer account again.`
                : action.item.userType === 'provider'
                  ? `${action.item.name} will be signed out immediately and their listings hidden. Their bookings and conversations will be retained.`
                  : `${action.item.name} will be signed out immediately. Their bookings and conversations will be retained.`}</p>
            <label htmlFor="moderation-reason">Reason for this action</label>
            <textarea id="moderation-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={3} required placeholder="Describe the policy violation or reason…" />
            <div className="moderation-dialog-footer"><button type="button" className="btn btn-secondary" onClick={closeAction} disabled={saving}>Cancel</button><button type="submit" className={action.kind === 'service' || !action.isActive ? 'moderation-confirm-danger' : 'btn btn-primary'} disabled={saving || reason.trim().length < 3}>{saving ? 'Saving…' : actionTitle}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminModeration;
