import React, { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Users, Plus, Trash2, Mail, X, Send } from 'lucide-react';
import { Select } from '../components/ui/Select';

export const TeamManagement: React.FC = () => {
    const [members, setMembers] = useState<any[]>([]);
    const [joinRequests, setJoinRequests] = useState<any[]>([]);
    const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(localStorage.getItem('docu_user_role') || 'member');
    const canManageTeam = userRole === 'admin' || userRole === 'owner';

    // Invite Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [inviting, setInviting] = useState(false);

    const fetchJoinRequests = async (workspaceId: string) => {
        try {
            const list = await apiCall(`workspaces/${workspaceId}/admin/join-requests`);
            setJoinRequests(list || []);
        } catch (err) {
            console.error('Failed to fetch join requests:', err);
        }
    };

    const fetchTeam = async () => {
        try {
            const list = await apiCall('team');
            setMembers(list);
            
            const meRes = await apiCall('auth/me');
            setActiveWorkspace(meRes.workspace);
            if (meRes.workspace && (meRes.role === 'admin' || meRes.role === 'owner')) {
                await fetchJoinRequests(meRes.workspace._id);
            }
            
            const role = localStorage.getItem('docu_user_role') || 'member';
            setUserRole(role);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveRequest = async (requestId: string, action: 'approve' | 'reject') => {
        if (!activeWorkspace) return;
        try {
            await apiCall(`workspaces/${activeWorkspace._id}/admin/join-requests/${requestId}/resolve`, {
                method: 'POST',
                body: { action, role: 'member' }
            });
            await fetchJoinRequests(activeWorkspace._id);
            await fetchTeam();
        } catch (err: any) {
            alert(err.message || 'Action failed');
        }
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviting(true);
        try {
            await apiCall('team/invite', {
                method: 'POST',
                body: { email: inviteEmail, role: inviteRole }
            });
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteRole('member');
            fetchTeam();
            alert('Invitation sent successfully!');
        } catch (err: any) {
            alert(err.message || 'Invitation failed');
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!window.confirm('Remove this member from the workspace?')) return;
        try {
            await apiCall(`team/${memberId}`, { method: 'DELETE' });
            fetchTeam();
        } catch (err: any) {
            alert(err.message || 'Failed to remove member');
        }
    };

    const handleChangeRole = async (memberId: string, role: string) => {
        try {
            await apiCall(`team/${memberId}/role`, {
                method: 'PATCH',
                body: { role }
            });
            fetchTeam();
        } catch (err: any) {
            alert(err.message || 'Failed to change role');
        }
    };

    return (
        <DashboardLayout title="Team Management">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Workspace Members</h2>
                </div>
                {canManageTeam && (
                    <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                        <Plus size={16} /> Invite Member
                    </button>
                )}
            </div>

            {/* Pending Join Requests Section */}
            {canManageTeam && joinRequests.length > 0 && (
                <div style={{
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '2.5rem',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#d46b08', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⏳ Pending Join Requests ({joinRequests.length})</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {joinRequests.map((req) => (
                            <div 
                                key={req._id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: '#ffffff',
                                    border: '1px solid #f0f0f0',
                                    borderRadius: '8px'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, color: '#1f1f1f', fontSize: '0.9rem' }}>{req.user_id?.full_name}</div>
                                    <div style={{ color: '#8c8c8c', fontSize: '0.8rem', marginTop: '2px' }}>{req.user_id?.email}</div>
                                    <div style={{ color: '#bfbfbf', fontSize: '0.72rem', marginTop: '4px' }}>
                                        Requested: {new Date(req.createdAt).toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        onClick={() => handleResolveRequest(req._id, 'reject')}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', color: '#ff4d4f', borderColor: '#ff4d4f', background: 'transparent' }}
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => handleResolveRequest(req._id, 'approve')}
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', background: '#52c41a', borderColor: '#52c41a' }}
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="card-table-wrapper" style={{ margin: 0 }}>
                {loading ? (
                    <div style={{ display: 'flex', padding: '4rem', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : members.length === 0 ? (
                    <div className="empty-state">
                        <Users className="empty-state-icon" size={48} />
                        <h3>No team members</h3>
                    </div>
                ) : (
                    <table className="docu-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member._id}>
                                    <td style={{ fontWeight: 700 }}>{member.user_id?.full_name || 'Invited User'}</td>
                                    <td>{member.user_id?.email}</td>
                                    <td>
                                        {member.role === 'owner' ? (
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#64748b' }}>Owner</span>
                                        ) : !canManageTeam ? (
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{member.role}</span>
                                        ) : (
                                            <div style={{ width: '120px' }}>
                                                <Select
                                                    value={member.role}
                                                    onChange={(val) => handleChangeRole(member._id, val)}
                                                    options={[
                                                        { value: 'admin', label: 'Admin' },
                                                        { value: 'member', label: 'Member' },
                                                        { value: 'viewer', label: 'Viewer' }
                                                    ]}
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${member.status === 'joined' ? 'badge-completed' : 'badge-viewed'}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {canManageTeam && member.role !== 'owner' && (
                                            <button className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleRemoveMember(member._id)} title="Remove Team Member">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <form onSubmit={handleInvite} className="modal-container" style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>Invite Workspace Member</h2>
                            <button type="button" className="close-btn" onClick={() => setShowInviteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label className="form-label">Email Address *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="colleague@company.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                        style={{ paddingLeft: '2.5rem' }}
                                    />
                                    <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <Select
                                    label="Role"
                                    value={inviteRole}
                                    onChange={(val) => setInviteRole(val)}
                                    options={[
                                        { value: 'admin', label: 'Admin (Manage documents, templates, contacts)' },
                                        { value: 'member', label: 'Member (Create and send documents)' },
                                        { value: 'viewer', label: 'Viewer (Read-only access)' }
                                    ]}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={inviting}>
                                <Send size={16} /> {inviting ? 'Inviting...' : 'Send Invite'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </DashboardLayout>
    );
};

export default TeamManagement;
