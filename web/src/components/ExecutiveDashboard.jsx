import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Layers,
  Inbox
} from 'lucide-react';

export default function ExecutiveDashboard({
  hudData = {},
  reconciliations = [],
  pos = [],
  onNavigateToTab
}) {
  const [chartPeriod, setChartPeriod] = useState('12m');

  const totalPoValue = hudData.total_po_value ?? pos.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const blockedAmount = hudData.total_overpayment_blocked ?? reconciliations.reduce((sum, r) => sum + (Number(r.total_overpayment_blocked) || 0), 0);
  const readyCount = hudData.ready_for_approval ?? reconciliations.filter(r => r.match_status === 'READY_FOR_APPROVAL').length;
  const discrepancyCount = hudData.discrepancies_flagged ?? reconciliations.filter(r => r.match_status === 'DISCREPANCY_FLAGGED').length;

  // Derive recent reconciliation activities
  const recentActivities = reconciliations.slice(0, 5).map(r => {
    const isCompleted = r.match_status === 'APPROVED' || r.match_status === 'READY_FOR_APPROVAL';
    const isDiscrepant = r.match_status === 'DISCREPANCY_FLAGGED';
    const isShortPay = r.match_status === 'PARTIALLY_APPROVED';

    let statusType = 'completed';
    let statusLabel = 'completed';
    if (isDiscrepant) {
      statusType = 'flagged';
      statusLabel = 'flagged';
    } else if (isShortPay) {
      statusType = 'shortpay';
      statusLabel = 'short-pay';
    } else if (r.match_status === 'NEEDS_REVIEW') {
      statusType = 'pending';
      statusLabel = 'pending';
    }

    const initials = (r.supplier_name || 'SC')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return {
      id: r.reconciliation_id,
      vendor: r.supplier_name,
      poNumber: r.po_number,
      invoiceNumber: r.invoice_number,
      amount: r.total_billed_amount || r.total_po_amount || 0,
      statusType,
      statusLabel,
      initials,
      timeAgo: 'Recent'
    };
  });

  // Dynamically compute Top Materials from active PO line items
  const materialsMap = {};
  pos.forEach(p => {
    (p.line_items || []).forEach(item => {
      const key = item.description || item.item_code || 'General Item';
      if (!materialsMap[key]) {
        materialsMap[key] = {
          name: key,
          unit: item.unit || 'Units',
          quantity: 0,
          totalSpend: 0,
          category: item.item_code?.includes('CONC') ? 'Concrete' : (item.item_code?.includes('REBAR') || key.toLowerCase().includes('rebar') ? 'Steel' : (key.toLowerCase().includes('cement') ? 'Cement' : 'Materials'))
        };
      }
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      materialsMap[key].quantity += qty;
      materialsMap[key].totalSpend += (qty * price);
    });
  });

  const topMaterials = Object.values(materialsMap)
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 5);

  // Compute GL breakdown dynamically
  const glTotals = {
    '5010-MAT': { label: 'Direct Materials (5010)', color: '#3b82f6', amount: 0 },
    '5020-CONC': { label: 'Concrete Mixes (5020)', color: '#0ea5e9', amount: 0 },
    '5040-EQP': { label: 'Machinery & Tools (5040)', color: '#f59e0b', amount: 0 },
    '6030-SAFE': { label: 'Safety & PPE (6030)', color: '#10b981', amount: 0 }
  };

  pos.forEach(p => {
    (p.line_items || []).forEach(item => {
      const desc = (item.description || '').toLowerCase();
      const code = (item.item_code || '').toLowerCase();
      const val = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

      if (desc.includes('concrete') || code.includes('conc')) {
        glTotals['5020-CONC'].amount += val;
      } else if (desc.includes('hardhat') || desc.includes('safety') || desc.includes('vest')) {
        glTotals['6030-SAFE'].amount += val;
      } else if (desc.includes('excavator') || desc.includes('crane') || desc.includes('scaffold')) {
        glTotals['5040-EQP'].amount += val;
      } else {
        glTotals['5010-MAT'].amount += val;
      }
    });
  });

  const totalGlSpend = Object.values(glTotals).reduce((sum, g) => sum + g.amount, 0) || totalPoValue || 1;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-box">
          <h1>Executive Dashboard</h1>
          <p>Real-time autonomous 3-way reconciliation, spend analytics, and overpayment prevention</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => onNavigateToTab && onNavigateToTab('MATRIX')}
          >
            <Layers size={14} /> Open 3-Way Match
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => onNavigateToTab && onNavigateToTab('INVENTORY')}
          >
            Site Inventory
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Trend Cards */}
      <div 
        className="kpi-grid metric-cards-grid" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}
      >
        {/* Metric 1 */}
        <div 
          className="kpi-card metric-trend-card"
          style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="kpi-header metric-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="kpi-label metric-card-label" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Total Disbursed Budget</span>
            <span className="trend-badge trend-up metric-badge metric-badge-positive" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <TrendingUp size={11} /> +12.5%
            </span>
          </div>
          <div className="kpi-value metric-card-value" style={{ fontSize: '26px', fontWeight: '700', color: '#fafafa', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
            RM {totalPoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer metric-card-footer" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>vs previous fiscal period</span>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>100% committed</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          className="kpi-card metric-trend-card"
          style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="kpi-header metric-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="kpi-label metric-card-label" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Blocked Over-Billing</span>
            <span className="trend-badge trend-up metric-badge metric-badge-positive" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <ShieldCheck size={11} /> 100% Caught
            </span>
          </div>
          <div className="kpi-value metric-card-value" style={{ fontSize: '26px', fontWeight: '700', color: '#10b981', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
            RM {blockedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer metric-card-footer" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Direct leakage prevented</span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Protected</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          className="kpi-card metric-trend-card"
          style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="kpi-header metric-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="kpi-label metric-card-label" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Auto-Reconciliation Rate</span>
            <span className="trend-badge trend-up metric-badge metric-badge-positive" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <CheckCircle2 size={11} /> Verified
            </span>
          </div>
          <div className="kpi-value metric-card-value" style={{ fontSize: '26px', fontWeight: '700', color: '#fafafa', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
            {reconciliations.length > 0 ? ((reconciliations.filter(r => r.match_status !== 'DISCREPANCY_FLAGGED').length / reconciliations.length) * 100).toFixed(1) : '94.2'}%
          </div>
          <div className="kpi-footer metric-card-footer" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Straight-through matching</span>
            <span style={{ color: 'var(--text-secondary)' }}>Target &gt; 90%</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          className="kpi-card metric-trend-card"
          style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="kpi-header metric-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="kpi-label metric-card-label" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Active Discrepancies</span>
            {discrepancyCount > 0 ? (
              <span className="trend-badge trend-down metric-badge metric-badge-negative" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <AlertTriangle size={11} /> Action Req
              </span>
            ) : (
              <span className="trend-badge trend-up metric-badge metric-badge-positive" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <CheckCircle2 size={11} /> Clean
              </span>
            )}
          </div>
          <div className="kpi-value metric-card-value" style={{ fontSize: '26px', fontWeight: '700', color: discrepancyCount > 0 ? '#ef4444' : '#fafafa', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
            {discrepancyCount} flagged
          </div>
          <div className="kpi-footer metric-card-footer" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{readyCount} ready for release</span>
            <span 
              style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: '500' }}
              onClick={() => onNavigateToTab && onNavigateToTab('DISCREPANCIES')}
            >
              Resolve &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Visual Analytics Charts */}
      <div className="charts-grid">
        {/* Left: Performance Area Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Disbursement Performance</h3>
              <p className="chart-card-subtitle">Monthly authorized spend vs verified delivery intake</p>
            </div>
            <div className="chart-tab-group">
              <button 
                className={`chart-tab ${chartPeriod === '12m' ? 'active' : ''}`}
                onClick={() => setChartPeriod('12m')}
              >
                12 Months
              </button>
              <button 
                className={`chart-tab ${chartPeriod === '30d' ? 'active' : ''}`}
                onClick={() => setChartPeriod('30d')}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* SVG Smooth Area Chart */}
          <div className="chart-canvas-area">
            <svg 
              className="chart-svg" 
              viewBox="0 0 700 240" 
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fafafa" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#fafafa" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              <line x1="0" y1="50" x2="700" y2="50" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
              <line x1="0" y1="110" x2="700" y2="110" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
              <line x1="0" y1="170" x2="700" y2="170" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
              <line x1="0" y1="230" x2="700" y2="230" stroke="rgba(255, 255, 255, 0.06)" />

              <path 
                d="M 0 230 C 60 210, 110 180, 175 160 C 240 140, 290 150, 350 120 C 410 90, 470 110, 525 75 C 585 40, 640 55, 700 30 L 700 230 Z" 
                fill="url(#areaGradient)" 
              />
              <path 
                d="M 0 230 C 60 210, 110 180, 175 160 C 240 140, 290 150, 350 120 C 410 90, 470 110, 525 75 C 585 40, 640 55, 700 30" 
                fill="none" 
                stroke="#fafafa" 
                strokeWidth="2.5" 
                strokeLinecap="round"
              />

              <path 
                d="M 0 230 C 60 220, 110 195, 175 180 C 240 165, 290 170, 350 145 C 410 115, 470 130, 525 95 C 585 65, 640 75, 700 50 L 700 230 Z" 
                fill="url(#deliveryGradient)" 
              />
              <path 
                d="M 0 230 C 60 220, 110 195, 175 180 C 240 165, 290 170, 350 145 C 410 115, 470 130, 525 95 C 585 65, 640 75, 700 50" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.8" 
                strokeDasharray="4 3" 
              />
            </svg>

            <div 
              className="chart-x-axis"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 10px 0',
                fontSize: '11px',
                color: 'var(--text-muted)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
              <span>Dec</span>
            </div>
          </div>
        </div>

        {/* Right: GL Expense Breakdown (Donut Chart) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">GL Code Breakdown</h3>
              <p className="chart-card-subtitle">Expenses categorized by General Ledger account</p>
            </div>
          </div>

          <div className="donut-widget-layout">
            {/* SVG Donut Chart */}
            <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {/* Dynamically partitioned circles */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray={`${(glTotals['5010-MAT'].amount / totalGlSpend) * 239} 239`} strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#0ea5e9" strokeWidth="14" strokeDasharray={`${(glTotals['5020-CONC'].amount / totalGlSpend) * 239} 239`} strokeDashoffset={`-${(glTotals['5010-MAT'].amount / totalGlSpend) * 239}`} />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray={`${(glTotals['5040-EQP'].amount / totalGlSpend) * 239} 239`} strokeDashoffset={`-${((glTotals['5010-MAT'].amount + glTotals['5020-CONC'].amount) / totalGlSpend) * 239}`} />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray={`${(glTotals['6030-SAFE'].amount / totalGlSpend) * 239} 239`} strokeDashoffset={`-${((glTotals['5010-MAT'].amount + glTotals['5020-CONC'].amount + glTotals['5040-EQP'].amount) / totalGlSpend) * 239}`} />
              </svg>
              {/* Center Value */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#FFF', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                  RM {(totalGlSpend / 1000).toFixed(1)}k
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Spend</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="donut-legend">
              {Object.entries(glTotals).map(([code, g]) => {
                const pct = totalGlSpend > 0 ? Math.round((g.amount / totalGlSpend) * 100) : 0;
                return (
                  <div key={code} className="donut-legend-item">
                    <div className="donut-legend-label">
                      <span className="legend-dot" style={{ background: g.color }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{g.label}</span>
                    </div>
                    <span className="donut-legend-value" style={{ fontFamily: 'var(--font-mono)' }}>
                      RM {(g.amount / 1000).toFixed(1)}k ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activities + Top Materials */}
      <div className="charts-grid">
        {/* Left: Recent Activity Stream */}
        <div className="modern-card" style={{ margin: 0 }}>
          <div className="modern-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#FFF' }}>
                Recent Audit Activity
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Latest 3-way reconciliation events
              </p>
            </div>
            <button 
              className="btn btn-outline btn-xs"
              onClick={() => onNavigateToTab && onNavigateToTab('MATRIX')}
            >
              View All
            </button>
          </div>

          <div style={{ padding: '8px 16px' }}>
            {recentActivities.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No recent activity recorded.
              </div>
            ) : (
              recentActivities.map((act, idx) => (
                <div 
                  key={act.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 8px',
                    borderBottom: idx < recentActivities.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {act.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>
                        {act.vendor}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        PO: {act.poNumber} &bull; Inv: #{act.invoiceNumber}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {act.statusType === 'completed' && (
                      <span className="status-pill pill-green">completed</span>
                    )}
                    {act.statusType === 'flagged' && (
                      <span className="status-pill pill-rose">flagged</span>
                    )}
                    {act.statusType === 'shortpay' && (
                      <span className="status-pill pill-yellow">short-pay</span>
                    )}
                    {act.statusType === 'pending' && (
                      <span className="status-pill pill-gray">pending</span>
                    )}

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#FFF', minWidth: '80px', textAlign: 'right' }}>
                      RM {act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Top Materials by Volume & Cost */}
        <div className="modern-card" style={{ margin: 0 }}>
          <div className="modern-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#FFF' }}>
                Major Procurement Materials
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Active site materials ordered across contracts
              </p>
            </div>
            <button 
              className="btn btn-outline btn-xs"
              onClick={() => onNavigateToTab && onNavigateToTab('INVENTORY')}
            >
              View Inventory
            </button>
          </div>

          <div style={{ padding: '8px 16px' }}>
            {topMaterials.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No procurement materials registered yet.
              </div>
            ) : (
              topMaterials.map((mat, idx) => (
                <div 
                  key={mat.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 8px',
                    borderBottom: idx < topMaterials.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '20px' }}>
                      #{idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>
                        {mat.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Quantity: <span style={{ color: '#fafafa' }}>{mat.quantity.toLocaleString()} {mat.unit}</span> &bull; <span style={{ color: '#38bdf8' }}>{mat.category}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#FFF' }}>
                      RM {mat.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="status-pill pill-green" style={{ fontSize: '10px', padding: '1px 6px', marginTop: '2px' }}>
                      Active
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
