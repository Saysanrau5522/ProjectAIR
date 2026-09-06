import React from 'react';
import { Building, Plus, FileText, Smartphone, MapPin } from 'lucide-react';

export default function ProjectSitesManager({
  sites = [],
  pos = [],
  onOpenCreatePo,
  onOpenCreateInvoice,
  onSelectTokenForMobile
}) {
  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building size={18} color="var(--text-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Project Sites &amp; Active Contracts
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Job Site Gateways &bull; Purchase Order Allocations &bull; Delivery Passes
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-modern btn-modern-secondary btn-sm" onClick={onOpenCreateInvoice}>
            <FileText size={13} /> Log Invoice
          </button>
          <button className="btn-modern btn-modern-primary btn-sm" onClick={() => onOpenCreatePo()}>
            <Plus size={13} /> Issue New PO
          </button>
        </div>
      </div>

      {sites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: '#141418', borderRadius: '10px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Building size={24} color="#38bdf8" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
            No Project Sites Registered Yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            Issue your first Purchase Order to establish a job site location. Each project site will automatically receive its own intake gateway, spend ledger, and delivery pass.
          </p>
          <button className="btn-modern btn-modern-primary" onClick={() => onOpenCreatePo()}>
            <Plus size={14} /> Issue First Purchase Order
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
          {sites.map(site => {
          const sitePos = pos.filter(p => p.project_site_id === site.site_id);
          const totalSpend = sitePos.reduce((sum, p) => sum + (p.total_amount || 0), 0);

          return (
            <div key={site.site_id} style={{ background: '#141418', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', color: '#fafafa', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={15} color="#38bdf8" />
                      {site.project_name}
                    </h3>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {site.site_id}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: '700', color: '#10b981' }}>
                      ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Authorized Spend</div>
                  </div>
                </div>

                {/* Connected POs */}
                <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Linked Purchase Orders ({sitePos.length})
                  </div>
                  {sitePos.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                      No contracts active. Click "+ Issue PO" to allocate budget.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {sitePos.map(po => (
                        <div 
                          key={po.po_id}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', borderRadius: '6px', padding: '8px 10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}
                        >
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa', fontSize: '12px' }}>
                              {po.po_number}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              {po.supplier_name}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ${po.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  className="btn-modern btn-modern-secondary btn-sm"
                  onClick={() => onOpenCreatePo(site.site_id)}
                >
                  <Plus size={12} /> Add PO for Site
                </button>
                {sitePos.length > 0 && (
                  <button 
                    type="button"
                    className="btn-modern btn-modern-primary btn-sm"
                    onClick={() => onSelectTokenForMobile && onSelectTokenForMobile('')}
                  >
                    <Smartphone size={12} /> Mobile Intake
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
