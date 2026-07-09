import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiCall } from '../../utils/api';
import { LayoutDashboard, FileText, Layers, Users, Contact, Settings, LogOut, Bell, Menu, X, BarChart2 } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);
    const [workspace, setWorkspace] = useState<any>(null);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loading, setLoading] = useState(true);
    const [usage, setUsage] = useState<any>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('docu_token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const data = await apiCall('auth/me');
                if (data.user && !data.user.onboarding_completed) {
                    navigate('/onboarding');
                    return;
                }
                setUser(data.user);
                setWorkspace(data.workspace);
                setWorkspaces(data.workspaces || []);
                localStorage.setItem('docu_user_role', data.role || 'member');
                setLoading(false);
                
                // Fetch usage
                apiCall('usage/current').then(u => setUsage(u)).catch(e => console.error(e));
                
                // Fetch notifications
                const notifs = await apiCall('notifications');
                setNotifications(notifs);
            } catch (err) {
                console.error('Auth verification failed:', err);
                localStorage.removeItem('docu_token');
                navigate('/login');
            }
        };

        checkAuth();
    }, [navigate]);

    const handleSwitchWorkspace = async (wsId: string) => {
        try {
            const data = await apiCall('auth/switch-workspace', {
                method: 'POST',
                body: { workspaceId: wsId }
            });
            localStorage.setItem('docu_token', data.token);
            window.location.reload();
        } catch (err) {
            console.error('Switch workspace failed:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('docu_token');
        navigate('/login');
    };

    const handleMarkAllRead = async () => {
        try {
            await apiCall('notifications/read-all', { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date() })));
        } catch (err) {
            console.error('Mark read failed:', err);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    const menuItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
        { name: 'Documents', path: '/documents', icon: <FileText size={20} /> },
        { name: 'Templates', path: '/templates', icon: <Layers size={20} /> },
        { name: 'Contacts', path: '/contacts', icon: <Contact size={20} /> },
        { name: 'Reports', path: '/reports', icon: <BarChart2 size={20} /> },
        { name: 'Team', path: '/team', icon: <Users size={20} /> },
        { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    ];

    const unreadCount = notifications.filter(n => !n.read_at).length;

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <img 
                        src={`${import.meta.env.BASE_URL}logo.png`} 
                        alt="BritSync Logo" 
                        style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px',
                            objectFit: 'cover',
                            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)'
                        }} 
                    />
                    <span className="logo-text" style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                        BritSync Docu
                    </span>
                </div>
                
                <ul className="sidebar-menu">
                    {menuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <li key={item.path}>
                                <Link 
                                    to={item.path} 
                                    className={`menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.icon}
                                    <span>{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {usage && (
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(248, 250, 252, 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                            <span>Monthly Quota</span>
                            <span style={{ textTransform: 'capitalize', color: usage.plan === 'business' ? '#10b981' : usage.plan === 'pro' ? '#3b82f6' : '#64748b' }}>{usage.plan}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                            <span>{usage.used} / {usage.limit} docs</span>
                            <span>{usage.percent}%</span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: usage.percent >= 90 ? '#ef4444' : usage.percent >= 75 ? '#f59e0b' : '#3b82f6', width: `${usage.percent}%`, borderRadius: '3px' }}></div>
                        </div>
                    </div>
                )}

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
                        <div className="avatar">
                            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{user?.full_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{workspace?.name || 'My Workspace'}</div>
                        </div>
                    </div>
                    <button 
                        className="btn btn-secondary" 
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.5rem 0.75rem', color: '#ef4444', borderColor: 'transparent', background: 'transparent' }}
                        onClick={handleLogout}
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="main-content">
                {/* Header */}
                <header className="header">
                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            className="mobile-hamburger" 
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h1 style={{ margin: 0 }}>{title}</h1>
                            {workspace && (
                                <div className="workspace-switcher-wrapper" style={{ position: 'relative', display: 'inline-block', maxWidth: '160px' }}>
                                    <button 
                                        className="workspace-switcher-btn"
                                        style={{ 
                                            background: '#f1f5f9', 
                                            border: '1px solid #cbd5e1', 
                                            borderRadius: '8px', 
                                            padding: '6px 12px', 
                                            fontSize: '0.8rem', 
                                            fontWeight: 700, 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            color: '#1e293b',
                                            transition: 'all 0.2s',
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => setShowSwitcher(!showSwitcher)}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏢 {workspace.name}</span> ▾
                                    </button>
                                    
                                    {showSwitcher && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            marginTop: '8px',
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                            width: '240px',
                                            zIndex: 999,
                                            padding: '6px'
                                        }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '6px 8px', letterSpacing: '0.5px' }}>
                                                Workspaces
                                            </div>
                                            {workspaces.map((ws) => (
                                                <button
                                                    key={ws._id}
                                                    onClick={() => {
                                                        handleSwitchWorkspace(ws._id);
                                                        setShowSwitcher(false);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        padding: '8px',
                                                        border: 'none',
                                                        background: ws._id === workspace._id ? '#f1f5f9' : 'transparent',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: ws._id === workspace._id ? 700 : 500,
                                                        color: ws._id === workspace._id ? '#2563eb' : '#334155',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                                        {ws.workspace_type === 'PERSONAL' ? '👤' : '🏢'} {ws.name}
                                                    </span>
                                                    {ws._id === workspace._id && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>✓</span>}
                                                </button>
                                            ))}
                                            <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
                                            <button
                                                onClick={() => {
                                                    setShowSwitcher(false);
                                                    navigate('/onboarding?action=create');
                                                }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.78rem',
                                                    color: '#2563eb',
                                                    fontWeight: 600
                                                }}
                                            >
                                                ➕ Create Company Workspace
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowSwitcher(false);
                                                    navigate('/onboarding?action=join');
                                                }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.78rem',
                                                    color: '#475569',
                                                    fontWeight: 600
                                                }}
                                            >
                                                🔍 Request to Join Company
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="user-profile-menu" style={{ flexShrink: 0 }}>
                        {/* Notifications Bell */}
                        <div style={{ position: 'relative' }}>
                            <button 
                                className="btn-icon" 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', color: '#64748b', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                                onClick={() => setShowNotifications(!showNotifications)}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-2px',
                                        right: '-2px',
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>{unreadCount}</span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="notification-dropdown" style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '35px',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: 'var(--shadow-lg)',
                                    borderRadius: '8px',
                                    width: '320px',
                                    zIndex: 100,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Notifications</span>
                                        {unreadCount > 0 && (
                                            <button onClick={handleMarkAllRead} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Mark all read</button>
                                        )}
                                    </div>
                                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>No notifications</div>
                                        ) : (
                                            notifications.map((n) => (
                                                <div key={n._id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', background: n.read_at ? 'transparent' : '#f8fafc' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>{n.title}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{n.message}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.4rem' }}>{new Date(n.createdAt).toLocaleDateString('en-GB')}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="avatar">
                            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    </div>
                </header>

                <main className="page-body">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
