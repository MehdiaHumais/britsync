import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { Mail, Lock, RefreshCw, AlertCircle, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setLoading(true);
        setError('');
        try {
            const data = await apiCall('auth/login', {
                method: 'POST',
                body: { email, password }
            });
            localStorage.setItem('docu_token', data.token);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Invalid email or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            backgroundColor: '#ffffff',
            fontFamily: '"Inter", sans-serif'
        }}>
            {/* Left Column: Form Card */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 2rem',
                zIndex: 10
            }}>
                <div style={{ width: '100%', maxWidth: '420px', textAlign: 'left' }}>
                    {/* Logo */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '2.5rem' }} onClick={() => navigate('/')}>
                        <img 
                            src={`${import.meta.env.BASE_URL}logo.png`} 
                            alt="BritSync Logo" 
                            style={{ 
                                width: '34px', 
                                height: '34px', 
                                borderRadius: '8px', 
                                objectFit: 'cover',
                                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)'
                            }} 
                        />
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                            BritSync <span style={{ color: '#2563eb' }}>Docu</span>
                        </span>
                    </div>

                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-0.75px' }}>Welcome back</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '2rem' }}>Sign in to manage and execute your digital documents</p>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            background: '#fef2f2',
                            border: '1px solid #fee2e2',
                            borderRadius: '8px',
                            padding: '0.85rem',
                            color: '#ef4444',
                            fontSize: '0.8rem',
                            marginBottom: '1.5rem'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', height: '44px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                />
                                <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                                <Link to="/forgot-password" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Forgot password?</Link>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', height: '44px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                />
                                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                            <input type="checkbox" id="remember-me" style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
                            <label htmlFor="remember-me" style={{ cursor: 'pointer' }}>Keep me logged in for 30 days</label>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '44px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', marginTop: '0.5rem' }} disabled={loading}>
                            {loading ? (
                                <>
                                    <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2rem', textAlign: 'center' }}>
                        New to BritSync Docu? <Link to="/signup" style={{ color: '#2563eb', fontWeight: 700 }}>Create an account</Link>
                    </p>
                </div>
            </div>

            {/* Right Column: Visual Features Dashboard Panel */}
            <div style={{
                flex: 1,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '4rem',
                position: 'relative',
                overflow: 'hidden'
            }} className="hidden-mobile">
                {/* Visual grid overlay */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    opacity: 0.8,
                    pointerEvents: 'none'
                }} />
                
                {/* Blur Radial background */}
                <div style={{
                    position: 'absolute',
                    width: '380px',
                    height: '380px',
                    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0) 70%)',
                    filter: 'blur(50px)',
                    top: '20%',
                    left: '20%',
                    pointerEvents: 'none'
                }} />

                {/* Floating Mockup Layout Stack */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '440px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Visual 1: Testimonial Card */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', marginBottom: '0.75rem' }}>
                            <Sparkles size={14} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trusted SaaS Platform</span>
                        </div>
                        <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#e2e8f0', fontStyle: 'italic', fontWeight: 500 }}>
                            "BritSync Docu helps our team execute client agreements without printing, scanning, or chasing signatures. The audit trail certificate is a lifesaver."
                        </p>
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '28px', height: '28px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                AM
                            </div>
                            <div>
                                <h5 style={{ fontSize: '0.75rem', fontWeight: 800, margin: 0 }}>Angela Martin</h5>
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Operations Coordinator</span>
                            </div>
                        </div>
                    </div>

                    {/* Visual 2: Document Completed Status widget */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h5 style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0 }}>NDA_Agreement_Final.pdf</h5>
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Completed 12 mins ago</span>
                            </div>
                        </div>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                            VERIFIED
                        </span>
                    </div>

                    {/* Visual 3: Chronological timeline node */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Recent signing events</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }} />
                            <span style={{ fontSize: '0.7rem', color: '#e2e8f0' }}>Sarah Connor signed document</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%' }} />
                            <span style={{ fontSize: '0.7rem', color: '#e2e8f0' }}>Email invitation sent to Sarah</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
