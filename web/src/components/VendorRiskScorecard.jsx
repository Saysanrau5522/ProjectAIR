import React, { useState, useEffect } from 'react';
import { 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  DollarSign, 
  Calendar, 
  FileText, 
  RefreshCw,
  Search,
  TrendingDown
} from 'lucide-react';

import { getApiBase } from '../utils/token';
import { apiRequest } from '../utils/apiClient';

const API_BASE = getApiBase();

export default function VendorRiskScorecard() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRiskProfiles = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/vendors/risk');
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load vendor risk profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskProfiles();
  }, []);

  const filtered = vendors.filter(v => 
    (v.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gradeACount = vendors.filter(v => v.risk_grade === 'A').length;
  const gradeCCount = vendors.filter(v => v.risk_grade === 'C').length;
  const totalBlocked = vendors.reduce((sum, v) => sum + (v.total_overpayment_blocked || 0), 0);

  return (
    <div>
      {/* Header Banner */}
      <div className="page-header">
        <div className="page-title-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={22} color="var(--accent-purple)" />
            <h1>Vendor Risk Scoring &amp; Contract Analytics</h1>
          </div>
          <p>Empirical contractor fulfillment accuracy &bull; Friday under-delivery detection &bull; Contract renegotiation intelligence</p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={fetchRiskProfiles}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'spin-anim' : ''} /> Re-Analyze
        </button>
      </div>

      {/* KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Grade A Suppliers</span>
            <span className="trend-badge trend-up">Preferred</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>
            {gradeACount}
          </div>
          <div className="kpi-footer">Zero-friction fulfillment records</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">High Risk (Grade C)</span>
            <span className={`trend-badge ${gradeCCount > 0 ? 'trend-down' : 'trend-neutral'}`}>
              {gradeCCount > 0 ? 'Action Needed' : 'None'}
            </span>
          </div>
          <div className="kpi-value" style={{ color: gradeCCount > 0 ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
            {gradeCCount}
          </div>
          <div className="kpi-footer">Frequent variance &amp; overbillings</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Friday Risk Detector</span>
            <span className="trend-badge trend-neutral">Temporal</span>
          </div>
          <div className="kpi-value">
            {vendors.filter(v => v.friday_underdelivery_rate > 15).length} Vendors
          </div>
          <div className="kpi-footer">Under-delivery before weekend shutdown</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Blocked Leakage</span>
            <span className="trend-badge trend-up">Savings</span>
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>
            RM {totalBlocked.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="kpi-footer">Intercepted unsubstantiated claims</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="modern-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            className="form-input"
            style={{ paddingLeft: '34px' }}
            placeholder="Search supplier name or trade contractor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
        </div>
      </div>

      {/* Scorecards Grid */}
      {filtered.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Award size={22} color="#a855f7" />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#FFF', marginBottom: '6px' }}>
            No Vendor Risk Profiles Yet
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, maxWidth: '420px', marginInline: 'auto' }}>
            Vendor compliance scores, Friday under-delivery rates, and contract negotiation intelligence are generated automatically as live delivery and invoice reconciliations occur.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
          {filtered.map(vendor => {
          const isGradeA = vendor.risk_grade === 'A';
          const isGradeC = vendor.risk_grade === 'C';

          return (
            <div 
              key={vendor.supplier_name} 
              className="modern-card"
              style={{ margin: 0, display: 'flex', flexDirection: 'column' }}
            >
              <div className="modern-card-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#FFF' }}>
                    {vendor.supplier_name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Total Procurement: <span className="tabular-nums" style={{ color: '#FFF', fontWeight: '600' }}>RM {(vendor.total_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  {isGradeA && (
                    <span className="status-pill pill-green">
                      <CheckCircle2 size={12} /> Grade A (Preferred)
                    </span>
                  )}
                  {vendor.risk_grade === 'B' && (
                    <span className="status-pill pill-yellow">
                      <AlertTriangle size={12} /> Grade B (Monitored)
                    </span>
                  )}
                  {isGradeC && (
                    <span className="status-pill pill-rose">
                      <ShieldAlert size={12} /> Grade C (High Risk)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Discrepancy Rate</div>
                    <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: '700', color: isGradeA ? 'var(--accent-emerald)' : 'var(--accent-amber)', marginTop: '2px' }}>
                      {vendor.discrepancy_rate}%
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Friday Shortfalls</div>
                    <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: '700', color: vendor.friday_underdelivery_rate > 20 ? 'var(--accent-rose)' : 'var(--accent-blue)', marginTop: '2px' }}>
                      {vendor.friday_underdelivery_rate}%
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Blocked Leakage</div>
                    <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: '700', color: vendor.total_overpayment_blocked > 0 ? 'var(--accent-amber)' : '#FFF', marginTop: '2px' }}>
                      RM {(vendor.total_overpayment_blocked || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* Contract Negotiation Insights */}
                <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent-blue)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <FileText size={13} /> Contract Negotiation Intelligence
                  </div>
                  
                  {vendor.contract_insights && vendor.contract_insights.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {vendor.contract_insights.map((insight, idx) => (
                        <li key={idx} style={{ lineHeight: '1.4' }}>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Fulfillment accuracy within agreed tolerances. Eligible for standard credit window renewals.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
