import React, { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import UpgradeModal from '../components/ui/UpgradeModal';
import { Save, RefreshCw, Link2, Trash2, Server, Terminal, X, Fingerprint, Check } from 'lucide-react';
import { Select } from '../components/ui/Select';
import { BackupCredentialsModal } from '../components/BackupCredentialsModal';

export const Settings: React.FC = () => {
    const [workspace, setWorkspace] = useState<any>(null);
    const [name, setName] = useState('');
    const [brandColor, setBrandColor] = useState('#2563eb');
    const [logoUrl, setLogoUrl] = useState('');
    
    // Domain auto-join settings
    const [domain, setDomain] = useState('');
    const [domainJoinEnabled, setDomainJoinEnabled] = useState(false);
    const [requireApprovalForJoin, setRequireApprovalForJoin] = useState(true);
    const [autoApproveDomain, setAutoApproveDomain] = useState(false);
    const [defaultDomainRole, setDefaultDomainRole] = useState('member');

    // Webhooks settings
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
    const [newHookUrl, setNewHookUrl] = useState('');
    const [newHookEvents, setNewHookEvents] = useState<string[]>(['DOCUMENT_COMPLETED', 'DOCUMENT_DECLINED']);
    const [showCreateHook, setShowCreateHook] = useState(false);
    const [savingHook, setSavingHook] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'autojoin' | 'webhooks'>('general');
    
    // Upgrade modal locks
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [lockedFeature, setLockedFeature] = useState('');

    const [userRole, setUserRole] = useState(localStorage.getItem('docu_user_role') || 'member');
    const canSave = userRole === 'admin' || userRole === 'owner';

    // Fingerprint backup credentials
    const [fpStatus, setFpStatus] = useState<{ is_fingerprint_user: boolean; has_backup_credentials: boolean; email: string } | null>(null);
    const [showBackupModal, setShowBackupModal] = useState(false);

    const fetchFingerprintStatus = async () => {
        try {
            const data = await apiCall('auth/fingerprint/status');
            setFpStatus(data);
        } catch {
            // not a fingerprint user, ignore
        }
    };

    const fetchSettings = async () => {
        try {
            const data = await apiCall('settings');
            setWorkspace(data);
            setName(data.name || '');
            setBrandColor(data.brand_color || '#2563eb');
            setLogoUrl(data.logo_url || '');
            
            // Auto join settings
            setDomain(data.domain || '');
            setDomainJoinEnabled(!!data.domain_join_enabled);
            setRequireApprovalForJoin(!!data.require_approval_for_join);
            setAutoApproveDomain(!!data.auto_approve_domain_users);
            setDefaultDomainRole(data.default_role_for_domain_users || 'member');

            const role = localStorage.getItem('docu_user_role') || 'member';
            setUserRole(role);

            // Fetch webhooks & logs
            if (['business', 'enterprise'].includes(data.plan)) {
                const wList = await apiCall('webhooks');
                setWebhooks(wList || []);
                const lList = await apiCall('webhooks/logs');
                setWebhookLogs(lList || []);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchFingerprintStatus();
    }, []);

    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        setSaving(true);
        try {
            const res = await apiCall('settings/logo', {
                method: 'POST',
                body: formData
            });
            setLogoUrl(res.logo_url);
            alert('Logo uploaded successfully!');
        } catch (err: any) {
            alert(err.message || 'Logo upload failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data = await apiCall('settings', {
                method: 'PATCH',
                body: { name, brand_color: brandColor, logo_url: logoUrl }
            });
            setWorkspace(data);
            alert('General settings updated successfully!');
        } catch (err: any) {
            alert(err.message || 'Save settings failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDomainJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspace) return;

        // Auto approve domain matches require business plan gating check
        if (autoApproveDomain && !['business', 'enterprise'].includes(workspace.plan)) {
            setLockedFeature('Auto-approve Domain Joins');
            setShowUpgrade(true);
            return;
        }

        setSaving(true);
        try {
            const res = await apiCall(`workspaces/${workspace._id}/domain-settings`, {
                method: 'PATCH',
                body: {
                    domain: domain,
                    domain_join_enabled: domainJoinEnabled,
                    require_approval_for_join: requireApprovalForJoin,
                    auto_approve_domain_users: autoApproveDomain,
                    default_role_for_domain_users: defaultDomainRole
                }
            });
            setWorkspace(res);
            alert('Domain settings updated successfully!');
        } catch (err: any) {
            alert(err.message || 'Save domain settings failed');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHookUrl) return;

        setSavingHook(true);
        try {
            await apiCall('webhooks', {
                method: 'POST',
                body: {
                    url: newHookUrl,
                    events: newHookEvents
                }
            });
            setShowCreateHook(false);
            setNewHookUrl('');
            setNewHookEvents(['DOCUMENT_COMPLETED', 'DOCUMENT_DECLINED']);
            
            // Reload hooks
            const wList = await apiCall('webhooks');
            setWebhooks(wList || []);
            alert('Webhook endpoint registered successfully!');
        } catch (err: any) {
            alert(err.message || 'Failed to register webhook');
        } finally {
            setSavingHook(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!window.confirm('Delete this webhook configuration?')) return;
        try {
            await apiCall(`webhooks/${id}`, { method: 'DELETE' });
            setWebhooks(prev => prev.filter(w => w._id !== id));
        } catch (err: any) {
            alert(err.message || 'Deletion failed');
        }
    };

    if (loading) {
        return (
            <DashboardLayout title="Settings">
                <div style={{ display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            </DashboardLayout>
        );
    }

    const hasBusinessFeature = ['business', 'enterprise'].includes(workspace?.plan);

    return (
        <DashboardLayout title="Workspace Settings">
            {/* Tabs Selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem', gap: '1.5rem' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '0.75rem 0.5rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid #3b82f6' : '2px solid transparent',
                        color: activeTab === 'general' ? '#3b82f6' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    General Settings
                </button>
                <button
                    onClick={() => setActiveTab('autojoin')}
                    style={{
                        padding: '0.75rem 0.5rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'autojoin' ? '2px solid #3b82f6' : '2px solid transparent',
                        color: activeTab === 'autojoin' ? '#3b82f6' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    Auto-Join Settings
                </button>
                <button
                    onClick={() => setActiveTab('webhooks')}
                    style={{
                        padding: '0.75rem 0.5rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'webhooks' ? '2px solid #3b82f6' : '2px solid transparent',
                        color: activeTab === 'webhooks' ? '#3b82f6' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    Developer Webhooks
                </button>
            </div>

            {/* Read Only Warn */}
            {!canSave && (
                <div style={{
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: '#d46b08',
                    fontSize: '0.85rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                    maxWidth: '650px'
                }}>
                    <span>⚠️ Read-Only Workspace. Only admins/owners can modify settings.</span>
                </div>
            )}

            {/* General Settings Panel */}
            {activeTab === 'general' && (
                <div style={{ maxWidth: '600px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', color: '#0f172a' }}>General Configurations</h3>
                    
                    <form onSubmit={handleSaveGeneral}>
                        <div className="form-group">
                            <label className="form-label">Workspace / Company Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={!canSave}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Brand Highlight Color</label>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    style={{
                                        border: 'none',
                                        outline: 'none',
                                        background: 'transparent',
                                        width: '44px',
                                        height: '44px',
                                        cursor: 'pointer'
                                    }}
                                    disabled={!canSave}
                                />
                                <input
                                    type="text"
                                    className="form-input"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    style={{ width: '120px' }}
                                    disabled={!canSave}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label">Workspace Logo</label>
                            {logoUrl && (
                                <div style={{ marginBottom: '0.8rem' }}>
                                    <img src={logoUrl} alt="Workspace Logo" style={{ maxHeight: '60px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px' }} />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoFileChange}
                                disabled={!canSave}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    fontSize: '0.85rem',
                                    color: '#64748b'
                                }}
                            />
                        </div>

                        {canSave && (
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? (
                                    <>
                                        <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} /> Save Settings
                                    </>
                                )}
                            </button>
                        )}
                    </form>
                </div>
            )}

            {/* Auto Join settings Panel */}
            {activeTab === 'autojoin' && (
                <div style={{ maxWidth: '600px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '8px', background: '#ecfdf5', color: '#10b981', borderRadius: '8px' }}>
                            <Link2 size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Domain Auto-Join Discovery</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', lineHeight: 1.5 }}>
                                Automatically detect and suggest workspace requests to new signups registering with matching corporate email domains.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveDomainJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group">
                            <label className="form-label">Authorized Company Domain Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. acme.com (leave blank to disable)"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                disabled={!canSave}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                                <input
                                    type="checkbox"
                                    checked={domainJoinEnabled}
                                    onChange={(e) => setDomainJoinEnabled(e.target.checked)}
                                    disabled={!canSave}
                                />
                                <span>Enable domain auto-join suggestion rules</span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                                <input
                                    type="checkbox"
                                    checked={requireApprovalForJoin}
                                    onChange={(e) => setRequireApprovalForJoin(e.target.checked)}
                                    disabled={!canSave}
                                />
                                <span>Require admin approval before joining</span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                                <input
                                    type="checkbox"
                                    checked={autoApproveDomain}
                                    onChange={(e) => setAutoApproveDomain(e.target.checked)}
                                    disabled={!canSave}
                                />
                                <span>Auto-approve matching domain users (Business plan only)</span>
                            </label>
                        </div>

                        <div className="form-group">
                            <Select
                                label="Default Role for Domain Joinees"
                                value={defaultDomainRole}
                                onChange={(val) => setDefaultDomainRole(val)}
                                disabled={!canSave}
                                options={[
                                    { value: 'admin', label: 'Admin Role' },
                                    { value: 'member', label: 'Member Role' },
                                    { value: 'viewer', label: 'Viewer Role' }
                                ]}
                            />
                        </div>

                        {canSave && (
                            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
                                <Save size={16} /> Save Rules
                            </button>
                        )}
                    </form>
                </div>
            )}

            {/* Developer Webhooks settings Panel */}
            {activeTab === 'webhooks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {!hasBusinessFeature ? (
                        <div className="empty-state" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '3.5rem 1.5rem', maxWidth: '650px', margin: '0' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '12px',
                                background: 'rgba(124, 58, 237, 0.05)',
                                color: '#7c3aed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <Server size={28} />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Developer Webhooks</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '420px', margin: '0.5rem auto 1.5rem auto', lineHeight: 1.5 }}>
                                Fire real-time notification HTTP calls to your developer servers on signature completion and decline events. Requires a Business Plan.
                            </p>
                            <button 
                                onClick={() => {
                                    setLockedFeature('Developer Webhooks');
                                    setShowUpgrade(true);
                                }}
                                className="btn btn-primary"
                                style={{ background: '#7c3aed', border: 'none' }}
                            >
                                Upgrade Workspace Plan
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ maxWidth: '650px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                        <div style={{ padding: '8px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '8px' }}>
                                            <Server size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Webhook Deliveries</h3>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Configure notification URLs to process signing telemetry.</p>
                                        </div>
                                    </div>
                                    {canSave && (
                                        <button className="btn btn-primary" onClick={() => setShowCreateHook(true)} style={{ background: '#7c3aed', border: 'none' }}>
                                            Add Endpoint
                                        </button>
                                    )}
                                </div>

                                {webhooks.length === 0 ? (
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>No webhook endpoints configured.</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {webhooks.map(w => (
                                            <div key={w._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{w.url}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                                                        Secret: <span style={{ fontFamily: 'monospace' }}>{w.secret_token}</span>
                                                    </div>
                                                </div>
                                                {canSave && (
                                                    <button 
                                                        onClick={() => handleDeleteWebhook(w._id)}
                                                        className="btn btn-danger"
                                                        style={{ padding: '0.4rem', borderRadius: '6px' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Logs telemetry */}
                            <div style={{ maxWidth: '650px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '8px', background: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}>
                                        <Terminal size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Webhook Attempt logs</h3>
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Verify HTTP post dispatches and verify statuses.</p>
                                    </div>
                                </div>

                                {webhookLogs.length === 0 ? (
                                    <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>No webhook logs tracked yet.</span>
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                        <table className="docu-table" style={{ fontSize: '0.75rem', margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th>Event Type</th>
                                                    <th>HTTP Status</th>
                                                    <th>Duration</th>
                                                    <th>Error Info</th>
                                                    <th>Timestamp</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {webhookLogs.map(l => (
                                                    <tr key={l._id}>
                                                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{l.event_type}</td>
                                                        <td>
                                                            <span className={`badge ${l.response_status >= 200 && l.response_status < 300 ? 'badge-completed' : 'badge-viewed'}`}>
                                                                {l.response_status || 'FAIL'}
                                                            </span>
                                                        </td>
                                                        <td>{l.duration_ms}ms</td>
                                                        <td style={{ color: l.error_message ? '#ef4444' : '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {l.error_message || 'None'}
                                                        </td>
                                                        <td>{new Date(l.createdAt).toLocaleTimeString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Create Webhook Modal */}
            {showCreateHook && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <form onSubmit={handleCreateWebhook} className="modal-container" style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>Register Webhook</h2>
                            <button type="button" className="close-btn" onClick={() => setShowCreateHook(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label className="form-label">Target URL Address *</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://api.yourdomain.com/webhooks/docu"
                                    value={newHookUrl}
                                    onChange={(e) => setNewHookUrl(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subscription Events (Comma Separated)</label>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                    Default events: <strong>DOCUMENT_COMPLETED, DOCUMENT_DECLINED</strong>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateHook(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={savingHook}>
                                {savingHook ? 'Registering...' : 'Register Endpoint'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Fingerprint Backup Credentials */}
            {fpStatus && (
                <div style={{
                    maxWidth: '600px', background: 'white', border: '1px solid #e2e8f0',
                    borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <div style={{ padding: '8px', background: '#eff6ff', color: '#2563eb', borderRadius: '8px' }}>
                            <Fingerprint size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                Fingerprint Account
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {fpStatus.has_backup_credentials
                                    ? `Backup email: ${fpStatus.email}`
                                    : 'No backup credentials set. Add email/password to log in from other devices.'}
                            </p>
                        </div>
                    </div>
                    {fpStatus.has_backup_credentials ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Check size={16} /> Backup credentials configured
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowBackupModal(true)}
                            style={{
                                padding: '0.6rem 1.25rem', borderRadius: '8px',
                                border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            Set Backup Credentials
                        </button>
                    )}
                </div>
            )}

            <BackupCredentialsModal
                open={showBackupModal}
                onClose={() => setShowBackupModal(false)}
                onComplete={() => { setShowBackupModal(false); fetchFingerprintStatus(); }}
            />

            {/* Global Upgrade gating blocker */}
            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                lockedFeature={lockedFeature}
                requiredPlan="business"
                currentPlan={workspace?.plan || 'free'}
            />
        </DashboardLayout>
    );
};

export default Settings;
