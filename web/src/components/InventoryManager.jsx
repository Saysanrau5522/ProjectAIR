import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Building2, 
  Search, 
  Zap, 
  Check, 
  QrCode,
  Layers,
  TrendingDown,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle,
  Clock,
  Info
} from 'lucide-react';

import { getApiBase } from '../utils/token';
import { apiRequest } from '../utils/apiClient';

const API_BASE = getApiBase();

export default function InventoryManager({ onRefreshLedger }) {
  const [stocks, setStocks] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState(null);
  const [reorderSuccessModal, setReorderSuccessModal] = useState(null);

  // Threshold editing state
  const [editingStockId, setEditingStockId] = useState(null);
  const [editMinLevel, setEditMinLevel] = useState('');
  const [editBatchQty, setEditBatchQty] = useState('');
  const [savingThresholdId, setSavingThresholdId] = useState(null);
  const [deletingStockId, setDeletingStockId] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  const handleStartEditThreshold = (stock) => {
    setEditingStockId(stock.stock_id);
    setEditMinLevel(stock.min_reorder_level);
    setEditBatchQty(stock.reorder_quantity);
  };

  const handleSaveThreshold = async (stock) => {
    try {
      setSavingThresholdId(stock.stock_id);
      const minVal = parseFloat(editMinLevel) || 5;
      const batchVal = parseFloat(editBatchQty) || 100;
      const res = await apiRequest('/inventory/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: stock.stock_id,
          item_code: stock.item_code,
          description: stock.description,
          min_reorder_level: minVal,
          reorder_quantity: batchVal
        })
      });
      if (res && res.error) throw new Error(res.error);
      setFeedbackToast(`Safety threshold saved for SKU "${stock.item_code}" (Min: ${minVal}, Batch: ${batchVal}). Future POs for this item will automatically use this threshold!`);
      setTimeout(() => setFeedbackToast(null), 6000);
      setEditingStockId(null);
      await fetchInventory();
      if (onRefreshLedger) onRefreshLedger();
    } catch (err) {
      alert('Failed to update threshold: ' + err.message);
    } finally {
      setSavingThresholdId(null);
    }
  };

  const handleDeleteMaterial = async (stock) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove material "${stock.description}" (SKU: ${stock.item_code}) from the site inventory and database?\n\nThis will permanently delete this record from the database to save storage space.`
    );
    if (!confirmed) return;

    try {
      setDeletingStockId(stock.stock_id);
      const res = await apiRequest('/inventory/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stock.stock_id })
      });
      if (res && res.error) throw new Error(res.error);
      setFeedbackToast(`Material "${stock.description}" (${stock.item_code}) permanently removed from database.`);
      setTimeout(() => setFeedbackToast(null), 4000);
      await fetchInventory();
      if (onRefreshLedger) onRefreshLedger();
    } catch (err) {
      alert('Failed to delete material: ' + err.message);
    } finally {
      setDeletingStockId(null);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const url = selectedSite === 'ALL' 
        ? `/inventory` 
        : `/inventory?site_id=${encodeURIComponent(selectedSite)}`;
      const data = await apiRequest(url);
      setStocks(Array.isArray(data) ? data : []);

      const sitesData = await apiRequest('/sites');
      setSites(Array.isArray(sitesData) ? sitesData : []);
    } catch (err) {
      console.error('Failed to load inventory stock ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedSite]);

  const handleDraftReorderPo = async (stock) => {
    try {
      setReorderingId(stock.stock_id);
      const result = await apiRequest('/inventory/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stock.stock_id })
      });
      if (result && result.error) {
        throw new Error(result.error);
      }
      setReorderSuccessModal(result);
      await fetchInventory();
      if (onRefreshLedger) onRefreshLedger();
    } catch (err) {
      alert(`Replenishment Trigger Error: ${err.message}`);
    } finally {
      setReorderingId(null);
    }
  };

  const filteredStocks = stocks.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item.description || '').toLowerCase().includes(q) ||
      (item.item_code || '').toLowerCase().includes(q) ||
      (item.project_name || '').toLowerCase().includes(q)
    );
  });

  const criticalCount = stocks.filter(s => s.stock_status === 'CRITICAL_LOW').length;
  const lowCount = stocks.filter(s => s.stock_status === 'LOW').length;
  const totalUnits = stocks.reduce((sum, s) => sum + (parseFloat(s.current_quantity) || 0), 0);

  return (
    <div>
      {/* Header Banner */}
      <div className="page-header">
        <div className="page-title-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={22} color="var(--accent-blue)" />
            <h1>Site Inventory Ledger</h1>
          </div>
          <p>Zero-entry stock tracking &bull; Quantities automatically incremented upon Delivery Order verification &bull; 1-Click PO Replenishment</p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={fetchInventory}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'spin-anim' : ''} /> Sync Stocks
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Active SKUs</span>
            <span className="trend-badge trend-neutral">Catalog</span>
          </div>
          <div className="kpi-value">{stocks.length}</div>
          <div className="kpi-footer">Materials tracked on active job sites</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Critical Reorders</span>
            <span className={`trend-badge ${criticalCount > 0 ? 'trend-down' : 'trend-up'}`}>
              {criticalCount > 0 ? `${criticalCount} Low` : 'Optimal'}
            </span>
          </div>
          <div className="kpi-value" style={{ color: criticalCount > 0 ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
            {criticalCount}
          </div>
          <div className="kpi-footer">Items below safety reorder threshold</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Monitored Sites</span>
            <span className="trend-badge trend-neutral">Sites</span>
          </div>
          <div className="kpi-value">{sites.length}</div>
          <div className="kpi-footer">Consolidated project locations</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Verified Physical Units</span>
            <span className="trend-badge trend-up">On-Site</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>
            {totalUnits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="kpi-footer">Verified via delivery dockets</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="modern-card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '260px' }}>
            <label className="form-label" style={{ marginBottom: '4px' }}>Filter by Job Site</label>
            <select 
              className="form-select"
              value={selectedSite} 
              onChange={(e) => setSelectedSite(e.target.value)}
            >
              <option value="ALL">All Job Sites (Consolidated Enterprise)</option>
              {sites.map(s => (
                <option key={s.site_id} value={s.site_id}>
                  {s.project_name} ({s.site_id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '260px' }}>
            <label className="form-label" style={{ marginBottom: '4px' }}>Search Material or SKU</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px' }}
                placeholder="e.g. Portland Cement, Rebar 16mm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast Notification */}
      {feedbackToast && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#10b981',
          fontSize: '13px'
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{feedbackToast}</span>
          <button 
            type="button" 
            onClick={() => setFeedbackToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Physical Intake Rule Banner */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}>
        <Info size={18} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#fff' }}>Physical Intake Rule:</strong> Submitting a Purchase Order (PO) registers items on order, but <strong>on-hand physical stock remains 0.00</strong> until the supplier arrives and the site supervisor scans and verifies the physical <strong>Delivery Order (DO)</strong> docket at the site gate.
        </div>
      </div>

      {/* Inventory Table */}
      <div className="modern-card">
        <div className="modern-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Job Site</th>
                <th>Material &amp; SKU</th>
                <th>On-Hand Balance</th>
                <th>Safety Threshold</th>
                <th>Stock Status</th>
                <th>Last Receipt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No materials found matching your search.
                  </td>
                </tr>
              ) : (
                filteredStocks.map(stock => {
                  const curr = parseFloat(stock.current_quantity) || 0;
                  const min = parseFloat(stock.min_reorder_level) || 1;
                  const pct = Math.min(100, Math.round((curr / (min * 2)) * 100));
                  const isEditingThis = editingStockId === stock.stock_id;

                  return (
                    <tr key={stock.stock_id}>
                      <td>
                        <div style={{ fontWeight: '600', color: '#FFF' }}>{stock.project_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono' }}>
                          {stock.site_id}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '600', color: '#FFF' }}>{stock.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                          SKU: {stock.item_code}
                        </div>
                      </td>

                      <td>
                        <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: '600', color: curr > 0 ? '#FFF' : 'var(--text-muted)' }}>
                          {curr.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stock.unit} on-site</span>
                        </div>
                        {curr === 0 ? (
                          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} /> +{stock.reorder_quantity || 0} {stock.unit} on PO (Pending DO)
                          </div>
                        ) : (
                          /* Progress bar */
                          <div style={{ width: '110px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${pct}%`, 
                                height: '100%', 
                                background: stock.stock_status === 'CRITICAL_LOW' ? 'var(--accent-rose)' : stock.stock_status === 'LOW' ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                                transition: 'width 0.3s ease'
                              }} 
                            />
                          </div>
                        )}
                      </td>

                      <td>
                        {isEditingThis ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '160px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-muted)', width: '38px' }}>Min:</span>
                              <input
                                type="number"
                                value={editMinLevel}
                                onChange={(e) => setEditMinLevel(e.target.value)}
                                style={{ 
                                  background: '#18181b', 
                                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                                  borderRadius: '4px', 
                                  color: '#fff', 
                                  padding: '2px 6px', 
                                  fontSize: '12px', 
                                  width: '70px' 
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-muted)', width: '38px' }}>Batch:</span>
                              <input
                                type="number"
                                value={editBatchQty}
                                onChange={(e) => setEditBatchQty(e.target.value)}
                                style={{ 
                                  background: '#18181b', 
                                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                                  borderRadius: '4px', 
                                  color: '#fff', 
                                  padding: '2px 6px', 
                                  fontSize: '12px', 
                                  width: '70px' 
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                              <button
                                type="button"
                                className="btn-modern btn-modern-primary btn-xs"
                                style={{ padding: '2px 7px', fontSize: '11px' }}
                                onClick={() => handleSaveThreshold(stock)}
                                disabled={savingThresholdId === stock.stock_id}
                              >
                                <Save size={10} /> {savingThresholdId === stock.stock_id ? 'Saving...' : 'Save Preset'}
                              </button>
                              <button
                                type="button"
                                className="btn-modern btn-modern-secondary btn-xs"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                                onClick={() => setEditingStockId(null)}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <div className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Min: <strong style={{ color: '#FFF' }}>{stock.min_reorder_level}</strong> {stock.unit}
                              </div>
                              <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Batch: +{stock.reorder_quantity} {stock.unit}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-modern btn-modern-secondary btn-xs"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => handleStartEditThreshold(stock)}
                              title="Edit minimum threshold & order batch quantity (saves as SKU preset for future POs)"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                          </div>
                        )}
                      </td>

                      <td>
                        {(stock.stock_status === 'AWAITING_DELIVERY' || (curr === 0 && !stock.last_delivery_date)) ? (
                          <span className="status-pill pill-cyan" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.3)' }} title="Material ordered via PO. Physical stock intake occurs upon gate DO scanning.">
                            <Clock size={11} /> Awaiting Gate DO
                          </span>
                        ) : stock.stock_status === 'CRITICAL_LOW' ? (
                          <span className="status-pill pill-rose">
                            <AlertTriangle size={11} /> Critical Low
                          </span>
                        ) : stock.stock_status === 'LOW' ? (
                          <span className="status-pill pill-yellow">
                            <AlertTriangle size={11} /> Low Stock
                          </span>
                        ) : (
                          <span className="status-pill pill-green">
                            <CheckCircle2 size={11} /> Healthy
                          </span>
                        )}
                      </td>

                      <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {stock.last_delivery_date ? (
                          stock.last_delivery_date
                        ) : (
                          <span style={{ color: 'var(--accent-amber)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="No DO received yet. Materials arrive via supplier delivery docket.">
                            <Clock size={11} /> DO Pending
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            className={`btn btn-sm ${stock.stock_status === 'CRITICAL_LOW' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => handleDraftReorderPo(stock)}
                            disabled={reorderingId === stock.stock_id}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <Zap size={13} /> {reorderingId === stock.stock_id ? 'Drafting...' : 'Draft PO'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '5px 7px' }}
                            onClick={() => handleDeleteMaterial(stock)}
                            disabled={deletingStockId === stock.stock_id}
                            title="Permanently remove this material from database to save space"
                          >
                            <Trash2 size={12} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replenishment Success Modal */}
      {reorderSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--accent-emerald)" />
                <h3>Replenishment Purchase Order Generated</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setReorderSuccessModal(null)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '44px', 
                  height: '44px', 
                  borderRadius: 'var(--radius-full)', 
                  background: 'var(--accent-emerald-bg)',
                  color: 'var(--accent-emerald)',
                  marginBottom: '10px'
                }}>
                  <Check size={22} />
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#FFF' }}>
                  Purchase Order #{reorderSuccessModal.po_number}
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  A zero-entry replenishment contract has been registered in HQ procurement.
                </p>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Job Site</div>
                    <div style={{ fontWeight: '600', color: '#FFF', marginTop: '2px' }}>{reorderSuccessModal.project_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Preferred Supplier</div>
                    <div style={{ fontWeight: '600', color: 'var(--accent-blue)', marginTop: '2px' }}>{reorderSuccessModal.supplier_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Restock Batch</div>
                    <div className="tabular-nums" style={{ fontWeight: '600', color: '#FFF', marginTop: '2px' }}>
                      {reorderSuccessModal.reorder_quantity} {reorderSuccessModal.unit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Estimated PO Value</div>
                    <div className="tabular-nums" style={{ fontWeight: '600', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                      RM {(reorderSuccessModal.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <QrCode size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px', color: 'var(--accent-blue)' }} />
                A digital Scoped QR Token was generated so site supervisors can verify the incoming truck shipment via the mobile PWA scanner.
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => setReorderSuccessModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
