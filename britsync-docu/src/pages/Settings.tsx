import React, { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Save, RefreshCw } from 'lucide-react';

export const Settings: React.FC = () => {
    const [_workspace, setWorkspace] = useState<any>(null);
    const [name, setName] = useState('');
    const [brandColor, setBrandColor] = useState('#2563eb');
    const [logoUrl, setLogoUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userRole, setUserRole] = useState(localStorage.getItem('docu_user_role') || 'member');
    const canSave = userRole === 'admin' || userRole === 'owner';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await apiCall('settings');
                setWorkspace(data);
                setName(data.name || '');
                setBrandColor(data.brand_color || '#2563eb');
                setLogoUrl(data.logo_url || '');
                const role = localStorage.getItem('docu_user_role') || 'member';
                setUserRole(role);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data = await apiCall('settings', {
                method: 'PATCH',
                body: { name, brand_color: brandColor, logo_url: logoUrl }
            });
            setWorkspace(data);
            alert('Settings updated successfully!');
        } catch (err: any) {
            alert(err.message || 'Save settings failed');
        } finally {
            setSaving(false);
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

    return (
        <DashboardLayout title="Workspace Settings">
            <div style={{ maxWidth: '600px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
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
                        fontWeight: 600
                    }}>
                        <span>⚠️ Read-Only Workspace. Only admins/owners can modify settings.</span>
                    </div>
                )}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem' }}>General Settings</h3>
                
                <form onSubmit={handleSave}>
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
                        <label className="form-label">Logo URL</label>
                        <input
                            type="url"
                            className="form-input"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            disabled={!canSave}
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
        </DashboardLayout>
    );
};

export default Settings;
