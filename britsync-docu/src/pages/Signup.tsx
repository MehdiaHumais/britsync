import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { Mail, Lock, User, RefreshCw, AlertCircle, Eye, EyeOff, Check, Fingerprint } from 'lucide-react';
import { triggerFingerprint } from '../utils/fingerprint';
import { BackupCredentialsModal } from '../components/BackupCredentialsModal';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fpLoading, setFpLoading] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            setEmail(emailParam);
        }
    }, []);

    const handleFingerprint = async () => {
        setFpLoading(true);
        setError('');
        try {
            const deviceToken = await triggerFingerprint();
            const data = await apiCall('auth/fingerprint/register', {
                method: 'POST',
                body: { device_token: deviceToken, device_name: '', device_info: navigator.userAgent }
            });
            localStorage.setItem('docu_token', data.token);
            if (data.is_new) {
                setShowBackupModal(true);
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Fingerprint authentication failed');
        } finally {
            setFpLoading(false);
        }
    };

    const handleBackupComplete = () => {
        setShowBackupModal(false);
        navigate('/dashboard');
    };

    const handleBackupLater = () => {
        setShowBackupModal(false);
        navigate('/dashboard');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName || !email || !password || !confirmPassword) return;

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const data = await apiCall('auth/signup', {
                method: 'POST',
                body: { 
                    full_name: fullName, 
                    email, 
                    password
                }
            });
            localStorage.setItem('docu_token', data.token);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container" style={{
            minHeight: '100vh',
            display: 'flex',
            flexWrap: 'wrap',
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
                <div style={{ width: '100%', maxWidth: '440px', textAlign: 'left' }}>
                    {/* Logo */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '2rem' }} onClick={() => navigate('/')}>
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

                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-0.75px' }}>Create your account</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.75rem' }}>Start signing and sending secure documents in seconds</p>

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
                            marginBottom: '1.25rem'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Full Name *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Sarah Connor"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                />
                                <User size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Email Address *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="sarah@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                />
                                <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="At least 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', height: '42px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                    minLength={6}
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

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Confirm Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', height: '42px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    disabled={loading}
                                    minLength={6}
                                />
                                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer', lineHeight: 1.4 }}>
                            <input type="checkbox" id="terms-agree" required style={{ cursor: 'pointer', width: '15px', height: '15px', marginTop: '2px', flexShrink: 0 }} />
                            <label htmlFor="terms-agree">I agree to the Terms of Service and Privacy Policy, and consent to electronic signature processing guidelines.</label>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '44px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', marginTop: '0.5rem' }} disabled={loading}>
                            {loading ? (
                                <>
                                    <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Creating account...
                                </>
                            ) : (
                                'Get Started Free'
                            )}
                        </button>
                    </form>

                    {isMobile && (<>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                    </div>

                    <button
                        type="button"
                        onClick={handleFingerprint}
                        disabled={fpLoading}
                        style={{
                            width: '100%', padding: '0.7rem', borderRadius: '8px',
                            border: '1px solid #e2e8f0', background: 'white',
                            color: '#0f172a', fontSize: '0.85rem', fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '0.6rem',
                            transition: 'all 0.15s'
                        }}
                        onMouseOver={e => (e.currentTarget.style.borderColor = '#2563eb')}
                        onMouseOut={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                    >
                        {fpLoading ? (
                            <><RefreshCw size={16} className="spinner" /> Scanning...</>
                        ) : (
                            <><Fingerprint size={18} style={{ color: '#2563eb' }} /> Continue with Fingerprint</>
                        )}
                    </button>
                    </>)}

                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1.5rem', textAlign: 'center' }}>
                        Already have an account? <Link to="/login" style={{ color: '#2563eb', fontWeight: 700 }}>Sign in</Link>
                    </p>
                </div>
            </div>

            <BackupCredentialsModal
                open={showBackupModal}
                onClose={handleBackupLater}
                onComplete={handleBackupComplete}
            />

            {/* Right Column: Visual Benefits Checklist & Onboarding Board */}
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
                    top: '30%',
                    right: '10%',
                    pointerEvents: 'none'
                }} />

                {/* Floating Onboarding Checklist Mockup */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '440px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Start Roadmap</span>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem', letterSpacing: '-0.5px' }}>Onboarding Checklist</h3>
                        <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5, marginTop: '0.5rem' }}>Setting up a legally binding signature workspace takes less than 60 seconds.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {[
                            { num: 1, label: 'Create workspace', desc: 'Auto-allocate separate private databases for company files and templates.', done: true },
                            { num: 2, label: 'Upload your first PDF', desc: 'Securely transfer contracts, offer agreements, or invoice files.', done: false },
                            { num: 3, label: 'Place signature fields', desc: 'Place interactive visual overlays on target document coordinates.', done: false },
                            { num: 4, label: 'Download certificate', desc: 'Receive flattened PDFs with appended cryptographic logs.', done: false }
                        ].map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                gap: '1rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                padding: '1rem',
                                alignItems: 'center'
                            }}>
                                {item.done ? (
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Check size={14} strokeWidth={3} />
                                    </div>
                                ) : (
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid rgba(255, 255, 255, 0.2)', color: 'rgba(255, 255, 255, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        {item.num}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: item.done ? '#ffffff' : '#e2e8f0' }}>{item.label}</h4>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
