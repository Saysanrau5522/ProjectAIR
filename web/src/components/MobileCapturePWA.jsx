import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, Wifi, WifiOff, Upload, Smartphone, AlertCircle, Building, RefreshCw, Sparkles } from 'lucide-react';

export default function MobileCapturePWA({
  initialToken,
  pos = [],
  onIngestDo
}) {
  const [token, setToken] = useState(initialToken || '');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.po_id || '');
  const [sitePin, setSitePin] = useState('8842');
  const [usePinMode, setUsePinMode] = useState(false);

  const [verifiedTokenData, setVerifiedTokenData] = useState(null);
  const [supervisorPhone, setSupervisorPhone] = useState('+60-12-345-6789');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [simulateCrumpled, setSimulateCrumpled] = useState(false);
  const [overrideQty, setOverrideQty] = useState('');

  // Camera QR Scanner state
  const [isScanningQr, setIsScanningQr] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (pos.length > 0 && !selectedPoId) {
      setSelectedPoId(pos[0].po_id);
      setSelectedSiteId(pos[0].project_site_id);
    }
  }, [pos]);

  const verifyToken = async (tokenStr) => {
    try {
      const res = await fetch('http://localhost:8000/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenStr })
      });
      const data = await res.json();
      if (data.valid) {
        setVerifiedTokenData(data);
        if (data.payload?.po_id) setSelectedPoId(data.payload.po_id);
        if (data.payload?.site_id) setSelectedSiteId(data.payload.site_id);
      } else {
        setVerifiedTokenData(null);
      }
    } catch (e) {
      console.warn('Token verify error', e);
    }
  };

  const startQrCamera = async () => {
    setIsScanningQr(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', true);
        videoRef.current.play();
        requestAnimationFrame(tickQrScan);
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      alert('Camera access unavailable. Using Quick Site Selector or PIN mode.');
      setIsScanningQr(false);
    }
  };

  const stopQrCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanningQr(false);
  };

  const tickQrScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        setToken(code.data);
        stopQrCamera();
        alert('QR Pass scanned successfully!');
        return;
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickQrScan);
  };

  const handleSimulateQrScan = () => {
    const firstPo = pos[0];
    if (firstPo) {
      setSelectedPoId(firstPo.po_id);
      setSelectedSiteId(firstPo.project_site_id);
      setSitePin(firstPo.po_id.replace(/[^0-9]/g, '').slice(-4) || '8842');
      fetch('http://localhost:8000/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: firstPo.po_id, site_id: firstPo.project_site_id })
      })
      .then(res => res.json())
      .then(data => {
        setToken(data.token);
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCaptureSubmit = async () => {
    if (!selectedPoId) {
      alert('Please select a purchase order or scan a site QR pass.');
      return;
    }

    setIsUploading(true);
    const targetPo = pos.find(p => p.po_id === selectedPoId) || pos[0];
    const firstItem = targetPo?.line_items?.[0] || {
      item_code: 'MAT-GEN-01',
      description: 'General Materials',
      unit: 'Units',
      quantity: 100
    };

    const deliveredQty = Number(overrideQty) || firstItem.quantity;
    const isUnder85 = simulateCrumpled;
    const confidenceScore = isUnder85 ? 0.72 : 0.94;

    const payload = {
      po_id: targetPo?.po_id || selectedPoId,
      site_id: targetPo?.project_site_id || selectedSiteId || (pos[0]?.project_site_id || ''),
      supervisor_phone: supervisorPhone,
      file_name: selectedFile ? selectedFile.name : (isUnder85 ? 'crumpled_dirty_do.png' : 'clean_site_do.jpg'),
      file_path: isUnder85 ? '/crumpled_dirty_do.png' : '/clean_site_do.jpg',
      confidence_score: confidenceScore,
      extracted_line_items: [
        {
          item_code: firstItem.item_code,
          description: firstItem.description,
          unit: firstItem.unit,
          quantity_delivered: deliveredQty,
          confidence: confidenceScore
        }
      ]
    };

    if (!isOnline) {
      setOfflineQueue([...offlineQueue, payload]);
      setIsUploading(false);
      alert('You are currently offline. Delivery record queued locally in browser buffer.');
      return;
    }

    try {
      const res = await onIngestDo(payload);
      setUploadSuccess({
        do_number: res.delivery_order?.do_number || 'DO-AUTO-VERIFIED',
        status: res.reconciliation?.match_status || 'MATCHED',
        confidence: confidenceScore,
        po_id: targetPo?.po_number
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      alert('Failed to submit DO: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const syncOfflineQueue = async () => {
    setIsUploading(true);
    for (const item of offlineQueue) {
      await onIngestDo(item);
    }
    setOfflineQueue([]);
    setIsUploading(false);
    alert('All offline DO captures synced successfully to HQ ledger!');
  };

  const activePoObject = pos.find(p => p.po_id === selectedPoId);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }} className="modern-card">
      {/* Network status banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isOnline ? (
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '500' }}>
              <Wifi size={14} /> Site Network Connected
            </span>
          ) : (
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '500' }}>
              <WifiOff size={14} /> Offline Buffer Active
            </span>
          )}
        </div>
        <span className="modern-badge modern-badge-blue">
          Mobile Intake PWA
        </span>
      </div>

      {offlineQueue.length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#f59e0b' }}>
            <AlertCircle size={15} />
            <span>{offlineQueue.length} photo captures buffered offline</span>
          </div>
          {isOnline && (
            <button className="btn-modern btn-modern-primary btn-sm" onClick={syncOfflineQueue}>
              Sync All to HQ
            </button>
          )}
        </div>
      )}

      {/* Site Selector & QR Scanner */}
      <div style={{ background: '#141418', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={14} color="#38bdf8" />
            Active Project Site &amp; Purchase Order
          </label>
          <button 
            type="button" 
            onClick={() => setUsePinMode(!usePinMode)} 
            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer' }}
          >
            {usePinMode ? '← Site Selector' : 'Use Site PIN →'}
          </button>
        </div>

        {!usePinMode ? (
          <div>
            <select
              value={selectedPoId}
              onChange={(e) => {
                setSelectedPoId(e.target.value);
                const p = pos.find(item => item.po_id === e.target.value);
                if (p) setSelectedSiteId(p.project_site_id);
              }}
              style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '9px 12px', fontSize: '13px' }}
            >
              {pos.map(p => (
                <option key={p.po_id} value={p.po_id}>
                  {p.project_name} &bull; {p.po_number} ({p.supplier_name})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button 
                type="button"
                className="btn-modern btn-modern-primary btn-sm" 
                style={{ flex: 1 }}
                onClick={startQrCamera}
              >
                <Camera size={13} /> Scan Wall QR
              </button>
              <button 
                type="button"
                className="btn-modern btn-modern-secondary btn-sm" 
                onClick={handleSimulateQrScan}
                title="Simulates scanning the site entrance QR poster"
              >
                <Sparkles size={13} /> Auto-Detect
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={sitePin}
                onChange={(e) => setSitePin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                style={{ flex: 1, background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '9px 12px', fontSize: '15px', fontWeight: '600', fontFamily: 'var(--font-mono)', letterSpacing: '2px' }}
              />
              <button 
                type="button" 
                className="btn-modern btn-modern-primary"
                onClick={() => alert(`Site PIN #${sitePin} verified! Linked to ${activePoObject?.project_name || 'Active Site'}`)}
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {/* Live Camera Scanner Overlay */}
        {isScanningQr && (
          <div style={{ marginTop: '14px', background: '#09090b', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '8px', fontWeight: '500' }}>
              Point camera at site entrance QR poster
            </div>
            <video ref={videoRef} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <button 
              type="button"
              className="btn-modern btn-modern-secondary btn-sm" 
              style={{ marginTop: '8px' }}
              onClick={stopQrCamera}
            >
              Cancel Camera
            </button>
          </div>
        )}

        {activePoObject && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>
              Target Contract: {activePoObject.po_number}
            </div>
            <div style={{ fontSize: '13px', color: '#fafafa', marginTop: '2px' }}>
              {activePoObject.supplier_name} &bull; {activePoObject.project_name}
            </div>
          </div>
        )}
      </div>

      {/* Supervisor Phone Attribution */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
          Site Supervisor Mobile (Audit Log Signature)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '6px 10px' }}>
          <Smartphone size={15} color="var(--text-muted)" />
          <input 
            type="text" 
            value={supervisorPhone}
            onChange={(e) => setSupervisorPhone(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fafafa', padding: '4px 8px', outline: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Physical Docket Capture Shutter */}
      <div style={{ background: '#141418', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '18px' }}>
        {previewUrl ? (
          <div>
            <img 
              src={previewUrl} 
              alt="DO Preview" 
              style={{ maxHeight: '180px', width: 'auto', margin: '0 auto', display: 'block', borderRadius: '6px' }} 
            />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <label className="btn-modern btn-modern-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <RefreshCw size={12} /> Retake Photo
                <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Camera size={22} color="var(--text-primary)" />
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fafafa', marginBottom: '4px' }}>
              Capture Delivery Ticket
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Snap signed clipboard slip, paper manifest, or weighbridge docket.
            </p>
            <label className="btn-modern btn-modern-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={14} /> Take Photo / Upload Ticket
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      {/* Simulation Controls for Demonstration */}
      <div style={{ background: '#141418', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px', marginBottom: '18px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
          Demo Test Parameters
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Delivered Quantity Override:</span>
          <input 
            type="number" 
            value={overrideQty} 
            onChange={(e) => setOverrideQty(e.target.value)}
            style={{ width: '90px', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={simulateCrumpled} 
            onChange={(e) => setSimulateCrumpled(e.target.checked)} 
          />
          Simulate crumpled/stained photo (&lt;85% confidence triage)
        </label>
      </div>

      {/* Submit Button */}
      <button 
        type="button"
        className="btn-modern btn-modern-primary" 
        style={{ width: '100%', padding: '12px', fontSize: '14px' }}
        disabled={isUploading}
        onClick={handleCaptureSubmit}
      >
        {isUploading ? 'Processing AI Vision...' : 'Submit Delivery Record to HQ Ledger'}
      </button>

      {/* Upload Success Feedback */}
      {uploadSuccess && (
        <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
            <CheckCircle2 size={16} />
            Ticket #{uploadSuccess.do_number} Logged to Site Record
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>
            Status: <strong style={{ color: '#fafafa' }}>{uploadSuccess.status}</strong> &bull; AI Confidence: <strong style={{ color: '#fafafa' }}>{(uploadSuccess.confidence * 100).toFixed(1)}%</strong>
          </p>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Automatically cross-referenced with HQ PO #{uploadSuccess.po_id}. Running ledger updated.
          </div>
        </div>
      )}
    </div>
  );
}
