import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import './AdminPromotions.css';

const emptyForm = { code: '', discountPercent: '10', maxUses: '', expiresAt: '' };

const AdminPromotions = () => {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/admin/promotions');
      setPromotions(data.promotions ?? []);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createPromotion = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const promotion = await apiRequest('/admin/promotions', {
        method: 'POST',
        body: {
          ...form,
          maxUses: form.maxUses || null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null
        }
      });
      setPromotions((current) => [promotion.promotion, ...current]);
      setForm(emptyForm);
      toast.success('Promotion code created');
    } catch (requestError) {
      setError(requestError.message || 'Could not create promotion');
    } finally {
      setSaving(false);
    }
  };

  const togglePromotion = async (promotion) => {
    try {
      const result = await apiRequest(`/admin/promotions/${encodeURIComponent(promotion.code)}`, {
        method: 'PATCH', body: { isActive: !promotion.isActive }
      });
      setPromotions((current) => current.map((item) => item.code === result.code
        ? { ...item, isActive: result.isActive } : item));
      toast.success(result.isActive ? 'Promotion activated' : 'Promotion deactivated');
    } catch (requestError) {
      setError(requestError.message || 'Could not update promotion');
    }
  };

  return <section className="admin-promotions-page"><div className="container">
    <header className="promotion-heading"><div><span>GROW YOUR BUSINESS</span><h1><Icon name="tag" size={25} /> Promotions</h1><p>Create discount codes to bring customers back and boost bookings.</p></div></header>
    {error && <div className="promotion-error-banner" role="alert">{error}</div>}
    <div className="promotion-admin-grid">
      <form className="promotion-create-card" onSubmit={createPromotion}>
        <h2>Create a code</h2>
        <label>Code<input required minLength="3" maxLength="32" pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
        <div className="promotion-fields-row">
          <label>Discount (%)<input type="number" min="1" max="90" required value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></label>
          <label>Maximum uses<input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" /></label>
        </div>
        <label>Expires at (optional)<input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create promotion'}</button>
      </form>
      <div className="promotion-list-card"><h2>Promotion codes <span>{promotions.length}</span></h2>
        {loading ? <div className="spinner" /> : promotions.length === 0 ? <div className="promotion-empty"><Icon name="tag" size={24} /><p>No promotion codes yet.</p></div> : <div className="promotion-table-wrap"><table className="promotion-table"><thead><tr><th>Code</th><th>Discount</th><th>Redemptions</th><th>Expires</th><th>Status</th><th /></tr></thead><tbody>{promotions.map((item) => <tr key={item.code}>
          <td><strong>{item.code}</strong></td><td>{item.discountPercent}%</td><td>{item.uses}{item.maxUses ? ` / ${item.maxUses}` : ' / ∞'}</td><td>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Never'}</td><td><span className={`promotion-status ${item.isActive ? 'active' : ''}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td><button type="button" className="promotion-toggle" onClick={() => togglePromotion(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</button></td>
        </tr>)}</tbody></table></div>}
      </div>
    </div>
  </div></section>;
};

export default AdminPromotions;
