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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('docu_token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const data = await apiCall('auth/me');
                setUser(data.user);
                setWorkspace(data.workspace);
                localStorage.setItem('docu_user_role', data.role || 'member');
                setLoading(false);
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
                        BritSync <span className="logo-span" style={{ color: 'var(--primary)' }}>Docu</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            className="btn-icon" 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'none' }}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className="header-title">
                            <h1>{title}</h1>
                        </div>
                    </div>

                    <div className="user-profile-menu">
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
                                <div style={{
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
