import React from 'react';
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

export default function AuditLogViewer({ auditLogs = [] }) {
  const getActionBadge = (action, isViolation) => {
    if (isViolation) {
      return <span className="modern-badge modern-badge-rose">{action}</span>;
    }
    if (action.includes('APPROVED')) {
      return <span className="modern-badge modern-badge-emerald">{action}</span>;
    }
    if (action.includes('DISPUTE')) {
      return <span className="modern-badge modern-badge-amber">{action}</span>;
    }
    if (action.includes('REPLENISHMENT')) {
      return <span className="modern-badge modern-badge-blue">{action}</span>;
    }
    return <span className="modern-badge" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)' }}>{action}</span>;
  };

  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="var(--text-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Immutable Audit Trail
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Append-Only Governance Ledger &bull; Cryptographic Actor Attribution
            </p>
          </div>
        </div>

        <div>
          <span className="modern-badge" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)' }}>
            {auditLogs.length} Events Logged
          </span>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
        Every document intake, OCR confidence score, Maker resolution, Checker approval, and dispute dispatch is permanently stamped in this audit ledger with strict role separation.
      </p>

      {auditLogs.length === 0 ? (
        <div style={{ background: '#141418', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
          <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            No Audit Logs Recorded
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            System events and user actions will be recorded here automatically.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '160px' }}>Timestamp</th>
                <th>Entity Target</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Audit Context / Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const isSecurityViolation = log.entity_type === 'SECURITY_VIOLATION';
                return (
                  <tr key={log.log_id} style={{ background: isSecurityViolation ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '12px' }}>
                      #{log.log_id}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <Clock size={11} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', opacity: 0.6 }} />
                      {log.created_at}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#38bdf8' }}>
                        {log.entity_type} <span style={{ color: 'var(--text-muted)' }}>[{log.entity_id}]</span>
                      </span>
                    </td>
                    <td>
                      {getActionBadge(log.action, isSecurityViolation)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#fafafa' }}>
                      {log.actor_id}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {log.actor_role}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: isSecurityViolation ? '#fca5a5' : 'var(--text-secondary)' }}>
                      {log.metadata || log.after_state || 'State updated'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
