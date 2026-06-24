import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
    FileText, CheckCircle2, Clock, Plus, 
    FileUp, Activity, Eye, Download, ShieldCheck, Sparkles, 
    AlertCircle, Send, Check, PenTool, ArrowRight,
    Cpu, TrendingUp, Workflow, Layers
} from 'lucide-react';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [allDocs, setAllDocs] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState('');
    const [userRole, setUserRole] = useState(localStorage.getItem('docu_user_role') || 'member');
    
    // Cloud integration states
    const [cloudConnections, setCloudConnections] = useState<any>({
        googleDrive: true,
        dropbox: false,
        oneDrive: false,
        salesforce: true
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [docsRes, activitiesRes, userRes] = await Promise.all([
                    apiCall('documents'),
                    apiCall('dashboard/activity'),
                    apiCall('auth/me').catch(() => null)
                ]);
                setAllDocs(docsRes || []);
                setActivities(activitiesRes || []);
                if (userRes && userRes.user) {
                    setCurrentUser(userRes.user);
                }
                if (userRes && userRes.role) {
                    setUserRole(userRes.role);
                    localStorage.setItem('docu_user_role', userRes.role);
                }
            } catch (err) {
                console.error('Failed to load dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleTemplateClick = () => {
        if (userRole === 'viewer') {
            showToastMsg('Permission denied: Viewers cannot create documents.');
            return;
        }
        navigate('/documents/new');
    };

    const showToastMsg = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleResendReminder = async (id: string) => {
        try {
            await apiCall(`documents/${id}/resend`, { method: 'POST' });
            showToastMsg('Reminder notification email dispatched!');
        } catch (err: any) {
            alert(err.message || 'Failed to dispatch reminder');
        }
    };

    const toggleConnection = (key: string) => {
        setCloudConnections((prev: any) => ({
            ...prev,
            [key]: !prev[key]
        }));
        showToastMsg(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} sync updated!`);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    // Calculate dynamic stats
    const totalDocs = allDocs.length;
    const completedDocs = allDocs.filter(d => d.status === 'completed').length;
    const pendingDocs = allDocs.filter(d => ['sent', 'viewed'].includes(d.status)).length;
    // Completion rate
    const completionRate = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;
    
    // Find documents awaiting current user's signature
    const awaitingMySignature = allDocs.filter(doc => {
        if (!currentUser || !['sent', 'viewed'].includes(doc.status)) return false;
        return doc.recipients?.some((r: any) => 
            r.email?.toLowerCase() === currentUser.email?.toLowerCase() && 
            ['sent', 'viewed'].includes(r.status) && 
            r.role === 'signer'
        );
    });

    // Find documents stuck waiting for others (Bottlenecks)
    const signerBottlenecks = allDocs.filter(doc => {
        if (!['sent', 'viewed'].includes(doc.status)) return false;
        const activeSigner = doc.recipients?.find((r: any) => ['sent', 'viewed'].includes(r.status));
        return activeSigner && activeSigner.email?.toLowerCase() !== currentUser?.email?.toLowerCase();
    }).slice(0, 3);
    
    // Recent Documents filtering
    const filteredDocs = allDocs.filter(doc => {
        return doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.recipients?.[0]?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.recipients?.[0]?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Stats Grid configurations
    const cardItems = [
        { title: 'Total Agreements', value: totalDocs, description: 'All contract models', icon: <FileText size={16} />, color: '#3b82f6', bg: '#eff6ff', hoverClass: 'stats-card-hover-blue' },
        { title: 'Awaiting Action', value: pendingDocs, description: 'Outbound signature loops', icon: <Clock size={16} />, color: '#f59e0b', bg: '#fffbeb', hoverClass: 'stats-card-hover-orange' },
        { title: 'Completed Signed', value: completedDocs, description: 'SHA-256 cryptographically sealed', icon: <CheckCircle2 size={16} />, color: '#10b981', bg: '#ecfdf5', hoverClass: 'stats-card-hover-green' },
        { title: 'Signing Velocity', value: `${completionRate}%`, description: 'Average turnaround conversion', icon: <TrendingUp size={16} />, color: '#8b5cf6', bg: '#f5f3ff', hoverClass: 'stats-card-hover-purple' }
    ];

    if (loading) {
        return (
            <DashboardLayout title="Dashboard">
                <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Workspace Command Center">
            {/* Header Greeting Banner */}
            <div className="dashboard-welcome-card" style={{ marginBottom: '2rem' }}>
                <div className="dashboard-welcome-glow" />
                <div className="dashboard-welcome-glow-2" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 2 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 800, width: 'max-content', marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.12)' }}>
                            <Sparkles size={12} style={{ color: '#60a5fa' }} /> workspace active: {currentUser?.workspace_id?.name || 'BritSync Enterprise'}
                        </div>
                        <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'white', letterSpacing: '-0.75px', margin: 0 }}>
                            {getGreeting()}, {currentUser?.full_name || 'Signer'}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.4rem', maxWidth: '600px', lineHeight: 1.5 }}>
                            Verify security audits, configure cloud sync relays, and check signing metrics from your bento operations deck.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate('/verify')}>
                            <ShieldCheck size={15} style={{ color: '#34d399' }} /> Verify Audit
                        </button>
                        {userRole !== 'viewer' && (
                            <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, boxShadow: '0 4px 12px rgba(37,99,235,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate('/documents/new')}>
                                <Plus size={15} /> New Document
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bento Layout Operations Deck */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Bento Grid Top Row - Analytics & Checklist */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* SVG Analytics Graph - Double Curve Document Velocity */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingUp size={16} style={{ color: '#8b5cf6' }} /> Document Velocity Trends
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Comparison of documents sent vs successfully completed over time.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }} />
                                    <span style={{ color: '#64748b' }}>Dispatched</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} />
                                    <span style={{ color: '#64748b' }}>Completed</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, position: 'relative', borderBottom: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            <svg viewBox="0 0 500 130" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <defs>
                                    <linearGradient id="curveBlue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                    </linearGradient>
                                    <linearGradient id="curveGreen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                
                                {/* Grid lines */}
                                <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                <line x1="0" y1="70" x2="500" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                <line x1="0" y1="110" x2="500" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                                {/* Double bezier path overlays */}
                                <path d="M 0,110 Q 80,60 160,85 T 320,30 T 500,10 L 500,130 L 0,130 Z" fill="url(#curveBlue)" />
                                <path d="M 0,110 Q 80,60 160,85 T 320,30 T 500,10" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

                                <path d="M 0,120 Q 80,85 160,95 T 320,55 T 500,20 L 500,130 L 0,130 Z" fill="url(#curveGreen)" />
                                <path d="M 0,120 Q 80,85 160,95 T 320,55 T 500,20" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                                
                                {/* Interactive indicator dots */}
                                <circle cx="320" cy="30" r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                                <circle cx="320" cy="55" r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
                            </svg>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>
                            <span>Jan</span>
                            <span>Feb</span>
                            <span>Mar</span>
                            <span>Apr</span>
                            <span>May</span>
                            <span>Jun</span>
                        </div>
                    </div>

                    {/* Integrated Cloud Storage & CRM Hub Toggle */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Workflow size={16} style={{ color: '#06b6d4' }} /> Cloud Integration Hub
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                                Synchronize executed contracts to remote cloud repositories and CRM directories.
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {/* Google Drive */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', background: cloudConnections.googleDrive ? '#10b981' : '#cbd5e1', borderRadius: '50%', boxShadow: cloudConnections.googleDrive ? '0 0 8px #10b981' : 'none' }} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Google Drive Relay</span>
                                    </div>
                                    <button onClick={() => toggleConnection('googleDrive')} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.65rem', border: '1px solid #cbd5e1', background: cloudConnections.googleDrive ? '#eff6ff' : 'white', color: cloudConnections.googleDrive ? '#2563eb' : '#64748b', borderRadius: '6px', cursor: 'pointer' }}>
                                        {cloudConnections.googleDrive ? 'Connected' : 'Sync Offline'}
                                    </button>
                                </div>
                                {/* Salesforce */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', background: cloudConnections.salesforce ? '#10b981' : '#cbd5e1', borderRadius: '50%', boxShadow: cloudConnections.salesforce ? '0 0 8px #10b981' : 'none' }} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Salesforce CRM Directory</span>
                                    </div>
                                    <button onClick={() => toggleConnection('salesforce')} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.65rem', border: '1px solid #cbd5e1', background: cloudConnections.salesforce ? '#eff6ff' : 'white', color: cloudConnections.salesforce ? '#2563eb' : '#64748b', borderRadius: '6px', cursor: 'pointer' }}>
                                        {cloudConnections.salesforce ? 'Connected' : 'Sync Offline'}
                                    </button>
                                </div>
                                {/* Dropbox */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', background: cloudConnections.dropbox ? '#10b981' : '#cbd5e1', borderRadius: '50%', boxShadow: cloudConnections.dropbox ? '0 0 8px #10b981' : 'none' }} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Dropbox Repository</span>
                                    </div>
                                    <button onClick={() => toggleConnection('dropbox')} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.65rem', border: '1px solid #cbd5e1', background: cloudConnections.dropbox ? '#eff6ff' : 'white', color: cloudConnections.dropbox ? '#2563eb' : '#64748b', borderRadius: '6px', cursor: 'pointer' }}>
                                        {cloudConnections.dropbox ? 'Connected' : 'Sync Offline'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Metrics Dashboard Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {cardItems.map((card, idx) => (
                        <div 
                            key={idx} 
                            className={`stats-grid-card ${card.hoverClass}`}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0' }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.25px' }}>{card.title}</span>
                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>{card.value}</div>
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{card.description}</span>
                            </div>
                            <div style={{
                                background: card.bg,
                                color: card.color,
                                padding: '0.65rem',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {card.icon}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bento Grid Middle Row - Action items & Bottlenecks */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Action Required: Awaiting Your Signature */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                                    <PenTool size={16} style={{ color: '#2563eb' }} /> Action Required
                                </h3>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: awaitingMySignature.length > 0 ? '#ef4444' : '#10b981', background: awaitingMySignature.length > 0 ? '#fef2f2' : '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                                    {awaitingMySignature.length} Pending Signature{awaitingMySignature.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {awaitingMySignature.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                                        <Check size={16} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Inbox Clean</h4>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>All documents assigned to you are successfully signed.</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {awaitingMySignature.map(doc => {
                                        const userRec = doc.recipients?.find((r: any) => r.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                                        return (
                                            <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #eff6ff, #f8fafc)', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.85rem 1rem', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                                    <div style={{ background: '#2563eb', color: 'white', padding: '0.45rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <FileText size={14} />
                                                    </div>
                                                    <div style={{ overflow: 'hidden' }}>
                                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc.document_name}</h4>
                                                        <p style={{ fontSize: '0.65rem', color: '#64748b', margin: '1px 0 0 0' }}>Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB')}</p>
                                                    </div>
                                                </div>
                                                <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.4rem 0.8rem', background: '#2563eb', color: 'white', borderRadius: '6px', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={() => navigate(`/public/sign/${userRec?.secure_token}`)}>
                                                    Sign <ArrowRight size={11} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Signer Bottlenecks Widget (Pending others) */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                                    <AlertCircle size={16} style={{ color: '#d97706' }} /> Signer Bottlenecks
                                </h3>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: '6px' }}>
                                    {signerBottlenecks.length} Outbound Delay{signerBottlenecks.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.4 }}>
                                Agreements waiting for third-party signatures. Send a direct reminder nudge.
                            </p>

                            {signerBottlenecks.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Bottlenecks</h4>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>All pending signature cycles are actively moving.</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {signerBottlenecks.map(doc => {
                                        const pendingSigner = doc.recipients?.find((r: any) => ['sent', 'viewed'].includes(r.status));
                                        return (
                                            <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.85rem 1rem', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                                    <div style={{ background: '#d97706', color: 'white', padding: '0.45rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Clock size={14} />
                                                    </div>
                                                    <div style={{ overflow: 'hidden' }}>
                                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#78350f', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc.document_name}</h4>
                                                        <p style={{ fontSize: '0.65rem', color: '#92400e', margin: '1px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Pending: {pendingSigner?.name || pendingSigner?.email}</p>
                                                    </div>
                                                </div>
                                                {userRole !== 'viewer' && (
                                                    <button className="btn" style={{ fontSize: '0.7rem', padding: '0.4rem 0.8rem', background: '#d97706', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={() => handleResendReminder(doc._id)}>
                                                        <Send size={10} /> Nudge
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bento Grid Bottom Row - Recent list, Activity, Quick Send Templates */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Recent Documents list */}
                    <div className="premium-card" style={{ flex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '340px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Recent Agreements</h3>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', borderRadius: '6px' }} onClick={() => navigate('/documents')}>
                                    View All
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search by name or email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', height: '32px', borderRadius: '6px' }}
                                />
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                {filteredDocs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px' }}>
                                        <FileUp size={24} style={{ opacity: 0.5, margin: '0 auto 0.5rem auto', display: 'block' }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>No agreements found</span>
                                    </div>
                                ) : (
                                    <table className="docu-table" style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                                <th style={{ padding: '0.5rem' }}>Name</th>
                                                <th style={{ padding: '0.5rem' }}>Status</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDocs.slice(0, 4).map(doc => (
                                                <tr key={doc._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ fontWeight: 800, padding: '0.6rem 0.5rem', color: '#0f172a', maxWidth: '140px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={doc.document_name}>{doc.document_name}</td>
                                                    <td style={{ padding: '0.6rem 0.5rem' }}>
                                                        <span className={`badge badge-${doc.status}`} style={{ fontSize: '0.6rem', padding: '2px 6px', textTransform: 'uppercase' }}>{doc.status}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>
                                                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.45rem', borderRadius: '4px' }} onClick={() => navigate(`/documents/${doc._id}/editor`)} title="View/Edit">
                                                                <Eye size={12} />
                                                            </button>
                                                            {doc.status === 'completed' && doc.final_file_url && (
                                                                <a href={doc.final_file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Download Signed PDF">
                                                                    <Download size={12} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bento Template Dispatcher */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Layers size={16} style={{ color: '#ec4899' }} /> Template Presets
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                                Instantly generate pre-configured agreement files from presets.
                            </p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div onClick={handleTemplateClick} style={{ padding: '0.85rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease' }} className="stats-card-hover-purple">
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b21a8', margin: '0 0 4px 0' }}>NDA Preset</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#9333ea' }}>Confidentiality deal</span>
                                </div>
                                <div onClick={handleTemplateClick} style={{ padding: '0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease' }} className="stats-card-hover-blue">
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 4px 0' }}>Consulting</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#2563eb' }}>Work agreements</span>
                                </div>
                                <div onClick={handleTemplateClick} style={{ padding: '0.85rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease' }} className="stats-card-hover-orange">
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9a3412', margin: '0 0 4px 0' }}>Offer Letter</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#ea580c' }}>New hire sign-on</span>
                                </div>
                                <div onClick={handleTemplateClick} style={{ padding: '0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease' }} className="stats-card-hover-green">
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', margin: '0 0 4px 0' }}>Consent Form</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#16a34a' }}>Permission slip</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Audit Logs */}
                    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '340px' }}>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginBottom: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Cpu size={16} style={{ color: '#2563eb' }} /> Security Audit Feed
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', textAlign: 'left', marginTop: '1rem' }}>
                                {activities.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8', fontSize: '0.75rem', background: '#f8fafc', borderRadius: '10px' }}>
                                        <Activity size={20} style={{ margin: '0 auto 0.5rem auto', display: 'block', opacity: 0.5 }} />
                                        No activity logs generated.
                                    </div>
                                ) : (
                                    activities.slice(0, 4).map(act => (
                                        <div key={act._id} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.7rem' }}>
                                            <div style={{
                                                background: '#eff6ff',
                                                borderRadius: '50%',
                                                width: '24px',
                                                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Activity size={11} style={{ color: '#2563eb' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <span style={{ fontWeight: 800, color: '#1e293b' }}>
                                                    {act.user_id?.full_name || 'Signer'}
                                                </span>{' '}
                                                <span style={{ color: '#64748b' }}>
                                                    {act.event_type.replace(/_/g, ' ').toLowerCase()}
                                                </span>{' '}
                                                <strong style={{ color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100px', verticalAlign: 'bottom' }}>
                                                    {act.document_id?.document_name}
                                                </strong>
                                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                                    {new Date(act.createdAt).toLocaleString('en-GB')}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* Toast feedback */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    background: '#1e293b',
                    color: 'white',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    zIndex: 2000
                }}>
                    <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                    <span>{toast}</span>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
