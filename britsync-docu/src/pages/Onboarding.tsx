import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { Users, User, ArrowRight, Check, Search, Building, CreditCard, RefreshCw } from 'lucide-react';

export const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [choice, setChoice] = useState<'none' | 'create' | 'join'>('none');
    const [companyName, setCompanyName] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedWs, setSelectedWs] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [user, setUser] = useState<any>(null);
    const [verifyingPayment, setVerifyingPayment] = useState(false);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'create') setChoice('create');
        if (action === 'join') setChoice('join');

        const checkoutSuccess = searchParams.get('checkout_success');
        const sessionId = searchParams.get('session_id');

        if (checkoutSuccess && sessionId) {
            setVerifyingPayment(true);
            apiCall(`onboarding/verify-checkout?session_id=${sessionId}`)
                .then(data => {
                    localStorage.setItem('docu_token', data.token);
                    setSuccessMessage('Payment successful! Your company workspace has been provisioned and is ready for use.');
                    setTimeout(() => {
                        window.location.href = '/docu/dashboard';
                    }, 3000);
                })
                .catch(err => {
                    console.error('Checkout verification failed:', err);
                    setError(err.message || 'Payment verification failed. Please contact support.');
                })
                .finally(() => {
                    setVerifyingPayment(false);
                });
            return;
        }

        // Fetch current user details
        apiCall('auth/me').then(data => {
            setUser(data.user);
        }).catch(err => {
            console.error('Failed to load user:', err);
            navigate('/login');
        });
    }, [searchParams, navigate]);

    const handlePersonal = async () => {
        setLoading(true);
        setError('');
        try {
            await apiCall('onboarding/complete', {
                method: 'POST',
                body: { choice: 'personal' }
            });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to complete onboarding');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) return;

        setLoading(true);
        setError('');
        try {
            // Redirect to Stripe Checkout Session
            const data = await apiCall('billing/create-checkout-session', {
                method: 'POST',
                body: {
                    action: 'create_company',
                    company_name: companyName,
                    plan: selectedPlan,
                    interval: 'monthly'
                }
            });

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('Failed to initiate checkout session');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create checkout session');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setError('');
        try {
            const results = await apiCall(`workspaces/search?query=${encodeURIComponent(searchQuery)}`);
            setSearchResults(results);
            if (results.length === 0) {
                setError('No workspaces found matching your query.');
            }
        } catch (err: any) {
            setError(err.message || 'Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async () => {
        if (!selectedWs) return;
        setLoading(true);
        setError('');
        try {
            await apiCall('onboarding/complete', {
                method: 'POST',
                body: { choice: 'join-company', workspace_code: selectedWs.workspace_code }
            });
            setSuccessMessage(`Your request to join ${selectedWs.name} was successfully sent! You can continue using your Personal Workspace while you wait for admin approval.`);
            setTimeout(() => {
                navigate('/dashboard');
            }, 5000);
        } catch (err: any) {
            setError(err.message || 'Failed to submit join request');
        } finally {
            setLoading(false);
        }
    };

    if (verifyingPayment) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                color: '#0f172a',
                fontFamily: '"Inter", sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <RefreshCw className="spinner" size={48} style={{ color: '#3b82f6', marginBottom: '1.5rem' }} />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Verifying Subscription Payment...</h3>
                    <p style={{ color: '#64748b', marginTop: '0.5rem' }}>We are securing your company workspace. Please do not close this window.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            fontFamily: '"Inter", sans-serif',
            color: '#0f172a',
            padding: '2rem 1.5rem'
        }}>
            <div style={{ width: '100%', maxWidth: '800px' }}>
                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                            BritSync <span style={{ color: '#3b82f6' }}>Docu</span>
                        </span>
                    </div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.75px', color: '#0f172a' }}>
                        Welcome, {user?.full_name || 'there'}!
                    </h2>
                    <p style={{ fontSize: '0.95rem', color: '#475569', marginTop: '0.5rem' }}>
                        Select how you would like to start signing and sending documents today.
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderRadius: '12px',
                        padding: '1rem',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {successMessage ? (
                    <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        textAlign: 'center',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#10b981',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                        }}>
                            <Check size={24} />
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46', marginBottom: '0.5rem' }}>Success!</h4>
                        <p style={{ fontSize: '0.9rem', color: '#1e3a8a', lineHeight: 1.6 }}>{successMessage}</p>
                    </div>
                ) : choice === 'none' ? (
                    /* Onboarding Options Cards Grid */
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {/* Personal Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transition: 'all 0.3s',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={handlePersonal}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <User size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Personal Use</h3>
                            <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem', flexGrow: 1 }}>
                                I want to sign and manage documents privately in my personal workspace.
                            </p>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Continue Personal <ArrowRight size={14} />
                            </span>
                        </div>

                        {/* Create Company Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transition: 'all 0.3s',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={() => setChoice('create')}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <Building size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Create Company</h3>
                            <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem', flexGrow: 1 }}>
                                I want to create a workspace for my company, invite managers, send bulk requests, and manage billing.
                            </p>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Setup Corporate <ArrowRight size={14} />
                            </span>
                        </div>

                        {/* Join Company Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transition: 'all 0.3s',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={() => setChoice('join')}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
                                <Users size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Join Workspace</h3>
                            <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem', flexGrow: 1 }}>
                                I want to join an existing company workspace matching my organization's code or name.
                            </p>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Find & Request <ArrowRight size={14} />
                            </span>
                        </div>
                    </div>
                ) : choice === 'create' ? (
                    /* Create Company Form Card with Stripe Selection - Premium White styling */
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)'
                    }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Create Company Workspace</h3>
                        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '2rem' }}>
                            Choose a corporate plan to unlock team settings, custom branding, templates, and high-volume document execution.
                        </p>

                        <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ color: '#334155', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Company / Workspace Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Acme Corp"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    required
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        color: '#0f172a',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        width: '100%',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Plan Options Grid */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <label className="form-label" style={{ color: '#334155', fontSize: '0.85rem', fontWeight: 600 }}>Select Plan Tier:</label>
                                
                                {/* Pro Plan */}
                                <div 
                                    onClick={() => setSelectedPlan('pro')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1.25rem',
                                        borderRadius: '12px',
                                        border: selectedPlan === 'pro' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                        background: selectedPlan === 'pro' ? 'rgba(59,130,246,0.05)' : '#ffffff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>🏢 Pro Company</div>
                                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                                            50 documents/mo • Up to 5 team members • Templates & Branding
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>0.50 INR</div>
                                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>per month</div>
                                    </div>
                                </div>

                                {/* Business Plan */}
                                <div 
                                    onClick={() => setSelectedPlan('business')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1.25rem',
                                        borderRadius: '12px',
                                        border: selectedPlan === 'business' ? '2px solid #10b981' : '1px solid #e2e8f0',
                                        background: selectedPlan === 'business' ? 'rgba(16,185,129,0.05)' : '#ffffff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>🚀 Business Company</div>
                                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                                            500 documents/mo • Up to 50 team members • Bulk send & Signer OTP
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>1.00 INR</div>
                                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>per month</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setChoice('none')}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, justifyContent: 'center', borderColor: '#cbd5e1', color: '#475569', background: 'transparent' }}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ 
                                        flex: 1, 
                                        justifyContent: 'center', 
                                        background: selectedPlan === 'business' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                        boxShadow: selectedPlan === 'business' ? '0 4px 12px rgba(16,185,129,0.1)' : '0 4px 12px rgba(59,130,246,0.1)'
                                    }}
                                    disabled={loading}
                                >
                                    <CreditCard size={16} style={{ marginRight: '6px' }} />
                                    {loading ? 'Redirecting...' : 'Subscribe & Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* Join Company Form Card - Premium White styling */
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)'
                    }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Request to join company</h3>
                        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '2rem' }}>
                            Search for your company workspace by its custom name or unique 8-character workspace code.
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="Enter company name or workspace code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        color: '#0f172a',
                                        borderRadius: '8px',
                                        padding: '10px 10px 10px 35px',
                                        width: '100%',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            </div>
                            <button onClick={handleSearch} className="btn btn-primary" style={{ background: '#3b82f6' }} disabled={loading}>
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Select your company:</label>
                                {searchResults.map((ws) => (
                                    <div 
                                        key={ws._id}
                                        onClick={() => setSelectedWs(ws)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '1rem',
                                            background: selectedWs?._id === ws._id ? 'rgba(59, 130, 246, 0.05)' : '#ffffff',
                                            border: selectedWs?._id === ws._id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '1.5rem' }}>🏢</span>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{ws.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Code: {ws.workspace_code}</div>
                                            </div>
                                        </div>
                                        {selectedWs?._id === ws._id && (
                                            <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 800 }}>SELECTED</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => { setChoice('none'); setSearchResults([]); setSelectedWs(null); }}
                                className="btn btn-secondary"
                                style={{ flex: 1, justifyContent: 'center', borderColor: '#cbd5e1', color: '#475569', background: 'transparent' }}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleJoinRequest}
                                className="btn btn-primary"
                                style={{ flex: 1, justifyContent: 'center', background: '#f59e0b' }}
                                disabled={loading || !selectedWs}
                            >
                                {loading ? 'Submitting...' : 'Send Join Request'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
