import React, { useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Key, Smartphone, ShieldCheck } from 'lucide-react';

export default function QrTokenGenerator({
  pos = [],
  onGenerateToken,
  onSelectTokenForMobile
}) {
  const [selectedPo, setSelectedPo] = useState(pos[0]?.po_id || '');
  const [siteId, setSiteId] = useState(pos[0]?.project_site_id || '');
  const [expiresDays, setExpiresDays] = useState(14);
  const [generatedResult, setGeneratedResult] = useState(null);

  const handleGenerate = async () => {
    if (!selectedPo) return;
    const res = await onGenerateToken(selectedPo, siteId, expiresDays);
    setGeneratedResult(res);
  };

  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCode size={18} color="var(--text-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Issue Scoped Site QR Pass
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Cryptographic Gate Pass Generation &bull; HMAC-SHA256 Signed
            </p>
          </div>
        </div>

        <div>
          <span className="modern-badge modern-badge-blue">
            Zero-Onboarding PWA
          </span>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
        Site supervisors and truck drivers access the intake PWA via signed, time-boxed QR passes generated per PO and job site. This eliminates manual logins while securing the endpoint against unverified submissions.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Purchase Order
          </label>
          <select 
            style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
            value={selectedPo}
            onChange={(e) => {
              setSelectedPo(e.target.value);
              const p = pos.find(item => item.po_id === e.target.value);
              if (p) setSiteId(p.project_site_id);
            }}
          >
            {pos.map(po => (
              <option key={po.po_id} value={po.po_id}>
                {po.po_number} - {po.supplier_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Site Scope Identifier
          </label>
          <input 
            type="text" 
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Pass Validity (Days)
          </label>
          <input 
            type="number" 
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
            style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      <button 
        type="button" 
        className="btn-modern btn-modern-primary"
        onClick={handleGenerate}
      >
        <Key size={14} /> Generate Scoped Pass
      </button>

      {generatedResult && (
        <div style={{ marginTop: '24px', padding: '20px', background: '#141418', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '14px', fontWeight: '600', marginBottom: '14px' }}>
            <ShieldCheck size={16} />
            Cryptographic Site Gate Pass Generated
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', display: 'inline-block', textAlign: 'center' }}>
              <canvas 
                ref={(el) => {
                  if (el && generatedResult?.token) {
                    const qrUrl = `${window.location.origin}/?tab=MOBILE_PWA&token=${encodeURIComponent(generatedResult.token)}`;
                    QRCode.toCanvas(el, qrUrl, {
                      width: 150,
                      margin: 1,
                      color: { dark: '#09090b', light: '#ffffff' }
                    }).catch(e => console.error(e));
                  }
                }} 
                style={{ display: 'block' }}
              />
              <span style={{ fontSize: '10px', color: '#09090b', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                SCAN WITH PHONE CAMERA
              </span>
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '15px', color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>
                Pass for PO: {pos.find(p => p.po_id === selectedPo)?.po_number || selectedPo}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Scope: <strong style={{ color: '#fafafa' }}>{siteId}</strong> &bull; Validity: <strong style={{ color: '#fafafa' }}>{expiresDays} days</strong>
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '6px 12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Site PIN:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: '700', color: '#fafafa', letterSpacing: '1px' }}>
                  {selectedPo ? selectedPo.replace(/[^0-9]/g, '').slice(-4) || '8842' : '8842'}
                </span>
              </div>
              <div>
                <button 
                  type="button"
                  className="btn-modern btn-modern-secondary btn-sm"
                  onClick={() => onSelectTokenForMobile(generatedResult.token)}
                >
                  <Smartphone size={13} /> Open in Mobile PWA View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
