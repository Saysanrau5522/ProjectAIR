import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Plus, Trash2, CheckCircle, Smartphone, Building, QrCode, X } from 'lucide-react';

export default function CreatePoModal({
  isOpen,
  onClose,
  sites = [],
  onSubmitPo,
  onSelectTokenForMobile,
  initialSiteId = null
}) {
  const [poNumber, setPoNumber] = useState(`PO-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId || sites[0]?.site_id || '');
  const [customSiteName, setCustomSiteName] = useState('');
  const [isCustomSite, setIsCustomSite] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  const [lineItems, setLineItems] = useState([
    {
      item_code: '',
      description: '',
      unit: 'Units',
      quantity: 1,
      unit_price: 0
    }
  ]);

  const [createdPoResult, setCreatedPoResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialSiteId) {
      setSelectedSiteId(initialSiteId);
      setIsCustomSite(false);
    } else if (sites.length > 0) {
      if (!selectedSiteId || !sites.some(s => s.site_id === selectedSiteId)) {
        setSelectedSiteId(sites[0].site_id);
      }
      setIsCustomSite(false);
    } else {
      setIsCustomSite(true);
      setSelectedSiteId('');
    }
  }, [initialSiteId, sites, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setLineItems([
      ...lineItems,
      {
        item_code: '',
        description: '',
        unit: 'Units',
        quantity: 1,
        unit_price: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const totalPoAmount = lineItems.reduce((acc, item) => {
    return acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert('Please enter a supplier or vendor name.');
      return;
    }
    const validItems = lineItems.filter(it => it.description.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least one line item with a description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSubmitPo({
        po_number: poNumber,
        site_id: isCustomSite ? null : selectedSiteId,
        custom_site_name: isCustomSite ? customSiteName : null,
        supplier_name: supplierName,
        issue_date: issueDate,
        line_items: validItems.map(it => ({
          ...it,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0
        }))
      });
      setCreatedPoResult(res);
    } catch (err) {
      alert('Failed to create PO: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={16} color="var(--text-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Issue Purchase Order
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                HQ Procurement Ledger &bull; Linked Project Site Intake
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {createdPoResult ? (
          <div style={{ padding: '20px', background: '#141418', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              <CheckCircle size={18} />
              Purchase Order #{createdPoResult.po_number} Authorized &amp; Registered
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px' }}>
              Total Authorized: <strong style={{ color: '#fff' }}>${createdPoResult.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> &bull; Site: <strong style={{ color: '#fff' }}>{createdPoResult.project_name}</strong> &bull; Supplier: <strong style={{ color: '#fff' }}>{createdPoResult.supplier_name}</strong>
            </p>

            {/* QR Pass */}
            <div style={{ background: '#09090b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', display: 'inline-block' }}>
                <canvas 
                  ref={(el) => {
                    if (el && createdPoResult?.token) {
                      QRCode.toCanvas(el, createdPoResult.token, {
                        width: 130,
                        margin: 1,
                        color: { dark: '#09090b', light: '#ffffff' }
                      }).catch(e => console.error(e));
                    }
                  }} 
                  style={{ display: 'block' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <QrCode size={14} color="#38bdf8" />
                  Site Gate Pass &amp; Material Delivery QR
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                  Display at job site entrance. Delivery drivers and site supervisors scan this to verify material intake.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '6px 12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Site PIN:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '700', color: '#fafafa', letterSpacing: '1px' }}>
                    {createdPoResult.po_id ? createdPoResult.po_id.replace(/[^0-9]/g, '').slice(-4) || '8842' : '8842'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className="btn-modern btn-modern-secondary"
                onClick={() => {
                  onSelectTokenForMobile(createdPoResult.token);
                  onClose();
                }}
              >
                <Smartphone size={14} /> Open in Site Supervisor PWA
              </button>
              <button 
                type="button"
                className="btn-modern btn-modern-primary"
                onClick={onClose}
              >
                Done &amp; Return to Ledger
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  PO Number
                </label>
                <input 
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Project Site
                </label>
                {!isCustomSite && sites.length > 0 ? (
                  <select 
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                  >
                    {sites.map(s => (
                      <option key={s.site_id} value={s.site_id}>
                        {s.project_name} ({s.site_id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text"
                    placeholder="e.g. Tapak Pembinaan TRX / Klang Valley Depot"
                    value={customSiteName}
                    onChange={(e) => setCustomSiteName(e.target.value)}
                    style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                    required
                  />
                )}
                {sites.length > 0 ? (
                  <button 
                    type="button" 
                    onClick={() => setIsCustomSite(!isCustomSite)} 
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', marginTop: '5px', padding: 0 }}
                  >
                    {isCustomSite ? '← Select existing site' : '+ Add new site location'}
                  </button>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Type your project site location name above.
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Supplier / Vendor
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Pembekal Simen Sdn Bhd / Lafarge / YTL"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Issue Date
                </label>
                <input 
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                  required
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Procurement Line Items
                </span>
                <button 
                  type="button" 
                  className="btn-modern btn-modern-secondary btn-sm" 
                  onClick={handleAddItem}
                >
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Code</th>
                      <th>Description</th>
                      <th style={{ width: '90px' }}>Unit</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                      return (
                        <tr key={idx}>
                          <td>
                            <input 
                              type="text" 
                              placeholder="MAT-01"
                              value={item.item_code} 
                              onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="e.g. Portland Cement Grade 42.5 / High Tensile Rebar"
                              value={item.description} 
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px' }}
                              required
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Bags"
                              value={item.unit} 
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              value={item.quantity} 
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              value={item.unit_price} 
                              onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#10b981', fontSize: '13px' }}>
                            ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Footer Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', borderRadius: '8px', padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '22px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                Total Contract Authorized Value:
              </span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                ${totalPoAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-modern btn-modern-secondary" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-modern btn-modern-primary" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Issuing...' : 'Authorize & Issue PO'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
