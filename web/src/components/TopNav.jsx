import React from 'react';
import { 
  Search, 
  Plus, 
  RefreshCw, 
  UserCheck, 
  Bell, 
  FileText,
  SlidersHorizontal
} from 'lucide-react';

export default function TopNav({
  currentRole,
  setCurrentRole,
  actorId,
  setActorId,
  onRefresh,
  onOpenCreatePo,
  onOpenCreateInvoice,
  loading = false
}) {
  return (
    <header className="top-navbar">
      <div className="nav-left">
        {/* Quick Search */}
        <div className="global-search-box">
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            className="global-search-input" 
            placeholder="Search POs, vendors, sites..." 
          />
          <span className="kbd-shortcut">⌘K</span>
        </div>
      </div>

      <div className="nav-right">
        {/* Quick Action: Issue PO */}
        <button 
          className="btn btn-outline btn-sm"
          onClick={onOpenCreatePo}
          title="Create a new Purchase Order linked to a project site"
        >
          <Plus size={14} /> Issue PO
        </button>

        {/* Quick Action: Log Invoice (Signature solid white button like reference image) */}
        <button 
          className="btn btn-primary btn-sm"
          onClick={onOpenCreateInvoice}
          title="Log supplier invoice and run 3-way match"
        >
          <FileText size={14} /> Log Invoice
        </button>

        {/* Maker-Checker Role Selector */}
        <div className="role-select-box">
          <UserCheck size={14} color="var(--accent-blue)" />
          <select 
            className="role-select"
            value={currentRole} 
            onChange={(e) => {
              const role = e.target.value;
              setCurrentRole(role);
              if (role === 'FINANCE_CONTROLLER') setActorId('FINANCE_CONTROLLER_BOB');
              else if (role === 'AP_SPECIALIST') setActorId('AP_SPECIALIST_ALICE');
              else setActorId('SUPERVISOR_DAVE');
            }}
          >
            <option value="FINANCE_CONTROLLER">FINANCE CONTROLLER (CHECKER)</option>
            <option value="AP_SPECIALIST">AP SPECIALIST (MAKER)</option>
            <option value="SITE_SUPERVISOR">SITE SUPERVISOR (PWA)</option>
          </select>
        </div>

        {/* Sync Button */}
        <button 
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading}
          title="Sync ledger with SQLite backend"
        >
          <RefreshCw size={13} className={loading ? 'spin-anim' : ''} />
        </button>
      </div>
    </header>
  );
}
