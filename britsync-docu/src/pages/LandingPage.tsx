import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    PenTool, FileText, CheckCircle2, ArrowRight, Layers, Users, Zap, 
    ShieldCheck, Play, Check, Shield, Cpu, RefreshCw, Lock,
    Grid as GridIcon, Compass, Sparkle
} from 'lucide-react';
import AnimatedSignatureHero from '../components/ui/AnimatedSignatureHero';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedTemplateCat, setSelectedTemplateCat] = useState('legal');

    const workflowSteps = [
        {
            num: '01',
            title: 'Upload Original Document',
            desc: 'Securely upload PDFs from local files. Files are encrypted and cached in your private workspace.'
        },
        {
            num: '02',
            title: 'Place Smart Fields',
            desc: 'Drag & place text inputs, checkbox toggles, date signers, initials, dropdown option items, and signature pads.'
        },
        {
            num: '03',
            title: 'Define Signer Workflow',
            desc: 'Define sequential sign priorities or parallel routes. Add manually or lookup your contacts directory.'
        },
        {
            num: '04',
            title: 'Compile and Lock PDF',
            desc: 'Once signers execute fields, pdf-lib merges the values, locks signature vectors, and appends a verified Cryptographic Audit Certificate.'
        }
    ];

    const templates = [
        { name: 'Mutual NDA Agreement', category: 'legal', fields: 8, speed: '9 mins avg' },
        { name: 'Full-Time Employment Offer', category: 'hr', fields: 12, speed: '2 hours avg' },
        { name: 'Freelance Service Agreement', category: 'legal', fields: 6, speed: '14 mins avg' },
        { name: 'Commercial Rental Lease', category: 'realestate', fields: 15, speed: '1 day avg' },
        { name: 'Consulting Retainer SLA', category: 'business', fields: 7, speed: '35 mins avg' },
        { name: 'Board Member Consent Form', category: 'legal', fields: 4, speed: '5 mins avg' },
        { name: 'Medical Release Waiver', category: 'hr', fields: 9, speed: '11 mins avg' }
    ];

    return (
        <div style={{ backgroundColor: '#fafbfd', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", sans-serif', overflowX: 'hidden' }}>
            {/* Landing Navbar */}
            <nav style={{
                height: '75px',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 3.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => navigate('/docu')}>
                    <img 
                        src={`${import.meta.env.BASE_URL}logo.png`}
                        alt="BritSync Logo" 
                        style={{ 
                            width: '38px', 
                            height: '38px', 
                            borderRadius: '10px', 
                            objectFit: 'cover',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
                        }} 
                    />
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.6px' }}>
                        BritSync <span style={{ color: '#2563eb' }}>Docu</span>
                    </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                    <a href="#features" style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#2563eb'} onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Features</a>
                    <a href="#preview" style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#2563eb'} onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Product Tour</a>
                    <a href="#security" style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#2563eb'} onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Security</a>
                    <a href="#pricing" style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#2563eb'} onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Pricing</a>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 700 }} onClick={() => navigate('/login')}>Login</button>
                        <button className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 700, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }} onClick={() => navigate('/signup')}>Get Started</button>
                    </div>
                </div>
            </nav>

            {/* Split Hero Section with premium Grid background */}
            <section style={{ 
                padding: '7rem 3.5rem 6.5rem 3.5rem', 
                maxWidth: '1280px', 
                margin: '0 auto', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '5rem',
                flexWrap: 'wrap',
                position: 'relative'
            }}>
                {/* Visual grid backdrop */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    opacity: 0.2,
                    zIndex: -1,
                    pointerEvents: 'none'
                }} />

                {/* Hero Text */}
                <div style={{ flex: 1.2, minWidth: '320px', textAlign: 'left' }}>
                    {/* Badge removed */}
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.8px', lineHeight: 1.1, marginBottom: '1.5rem' }}>
                        Send, sign, and manage documents <span style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>digitally in minutes.</span>
                    </h1>
                    <p style={{ fontSize: '1.15rem', color: '#475569', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '540px' }}>
                        Upload a PDF, place smart fields, send a secure signing link, and receive a completed legally auditable PDF without printing, scanning, or manual follow-up.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
                        <button className="btn btn-primary" style={{ padding: '0.9rem 2.5rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 10px 15px -3px rgba(37,99,235,0.25)' }} onClick={() => navigate('/signup')}>
                            Start Free <ArrowRight size={16} />
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.9rem 2.5rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: '10px' }} onClick={() => navigate('/login')}>
                            Sign In
                        </button>
                        <button className="btn" style={{ background: 'transparent', border: 'none', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }} onClick={() => {
                            const el = document.getElementById('preview');
                            el?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                            <Play size={16} style={{ fill: '#2563eb', stroke: '#2563eb' }} /> Watch Demo
                        </button>
                    </div>

                    {/* Trust Metrics Underneath */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                        {[
                            { title: '2-min setup', desc: 'No complex API integration required.' },
                            { title: 'SHA-256 secure', desc: 'Protected by cryptographic hash logs.' },
                            { title: 'LTA Certificate', desc: 'Full audit logs trail on completion.' },
                            { title: 'Team-ready', desc: 'Manage workspaces and invite members.' }
                        ].map((m, idx) => (
                            <div key={idx} style={{ flex: 1, minWidth: '110px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{m.title}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{m.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hero Animated Signature Visual */}
                <div style={{
                    flex: 0.95,
                    minWidth: '320px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <AnimatedSignatureHero />
                </div>
            </section>

            {/* Section 1: Trusted Workflow Strip */}
            <div style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1.5px', display: 'block', marginBottom: '2.5rem' }}>E-Signature Workflow in 4 Simple Stages</span>
                
                <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem', position: 'relative' }}>
                    {[
                        { title: '1. Upload PDF File', desc: 'Drop contracts or legal agreements safely in your secure database storage.', icon: <FileText size={20} /> },
                        { title: '2. Prepare Smart Fields', desc: 'Place dropdown selection sets, signature inputs, dates, and validation logic.', icon: <Layers size={20} /> },
                        { title: '3. Dispath Secure Link', desc: 'Email signer directly, or set hierarchical signing sequence orders.', icon: <Zap size={20} /> },
                        { title: '4. Download Final PDF', desc: 'Flattened PDF document generated with immutable cryptographic logs attached.', icon: <ShieldCheck size={20} /> }
                    ].map((step, idx, arr) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                border: '1px solid #bfdbfe',
                                color: '#2563eb',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.25rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
                            }}>
                                {step.icon}
                            </div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>{step.title}</h4>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, padding: '0 1rem', textAlign: 'center' }}>{step.desc}</p>
                            
                            {/* Horizontal connector line on desktop */}
                            {idx < arr.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '25px',
                                    left: 'calc(50% + 40px)',
                                    width: 'calc(100% - 80px)',
                                    height: '1px',
                                    borderTop: '2px dashed #e2e8f0',
                                    zIndex: 1
                                }} className="hidden-mobile" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 2: High Fidelity Product Preview Mockup */}
            <section id="preview" style={{ padding: '7rem 2.5rem', backgroundColor: '#f8fafc' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', background: '#eff6ff', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
                        <Compass size={12} /> Product Walkthrough
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', marginBottom: '0.5rem' }}>Redesigned Admin Control Center</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '4rem', maxWidth: '600px', margin: '0 auto 4rem auto' }}>Oversee documents statuses, track signing pipelines, and manage templates within a single centralized page.</p>

                    {/* Glassmorphic Browser Mockup Frame */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '20px',
                        boxShadow: '0 30px 60px -15px rgba(0,0,0,0.1), 0 10px 20px -10px rgba(0,0,0,0.05)',
                        overflow: 'hidden',
                        maxWidth: '1000px',
                        margin: '0 auto'
                    }}>
                        {/* Browser Top Window bar */}
                        <div style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            height: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 1rem',
                            gap: '0.4rem'
                        }}>
                            <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }} />
                            <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '50%' }} />
                            <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%' }} />
                            <div style={{
                                flex: 1,
                                background: '#e2e8f0',
                                height: '22px',
                                borderRadius: '6px',
                                margin: '0 4rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94a3b8',
                                fontSize: '0.65rem',
                                fontFamily: 'monospace'
                            }}>
                                https://britsync.co.uk/docu/dashboard
                            </div>
                        </div>

                        {/* Inside Frame Workspace */}
                        <div style={{ display: 'flex', height: '480px', textAlign: 'left' }}>
                            {/* Left Side Navigation bar */}
                            <div style={{ width: '180px', borderRight: '1px solid #e2e8f0', background: '#f8fafc', padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ height: '8px', background: '#e2e8f0', width: '60%', borderRadius: '4px', marginBottom: '1rem', marginLeft: '0.5rem' }} />
                                {[
                                    { text: 'Dashboard', active: true },
                                    { text: 'Documents' },
                                    { text: 'Templates' },
                                    { text: 'Contacts' },
                                    { text: 'Settings' }
                                ].map((item, idx) => (
                                    <div key={idx} style={{
                                        padding: '0.5rem 0.75rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        borderRadius: '6px',
                                        background: item.active ? '#eff6ff' : 'transparent',
                                        color: item.active ? '#2563eb' : '#475569'
                                    }}>
                                        {item.text}
                                    </div>
                                ))}
                            </div>

                            {/* Main dashboard content mockup */}
                            <div style={{ flex: 1, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'hidden' }}>
                                {/* Greeting */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ height: '14px', background: '#334155', width: '120px', borderRadius: '4px' }} />
                                        <div style={{ height: '8px', background: '#94a3b8', width: '180px', borderRadius: '4px', marginTop: '6px' }} />
                                    </div>
                                    <div style={{ width: '90px', height: '28px', background: '#2563eb', borderRadius: '6px' }} />
                                </div>

                                {/* Mini Stats row */}
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {[
                                        { label: 'Total Docs', val: '48', color: '#2563eb' },
                                        { label: 'Completed', val: '36', color: '#10b981' },
                                        { label: 'Awaiting Sign', val: '9', color: '#f59e0b' },
                                        { label: 'Completion Rate', val: '84%', color: '#6366f1' }
                                    ].map((stat, idx) => (
                                        <div key={idx} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', background: '#ffffff' }}>
                                            <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{stat.label}</span>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: stat.color, marginTop: '2px' }}>{stat.val}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Main panel layout split */}
                                <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                                    {/* Document listing */}
                                    <div style={{ flex: 2, border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Active signature contracts</span>
                                        {[
                                            { name: 'Vendor_Agreement_v2.pdf', sender: 'Alex Rivera', status: 'viewed', color: '#f59e0b' },
                                            { name: 'Employment_Offer_CEO.pdf', sender: 'Sarah Connor', status: 'completed', color: '#10b981' },
                                            { name: 'Board_Consents_Resolution.pdf', sender: 'Marcus Aurelius', status: 'sent', color: '#2563eb' }
                                        ].map((doc, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>{doc.name}</div>
                                                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>Recipient: {doc.sender}</div>
                                                </div>
                                                <span style={{ fontSize: '0.55rem', padding: '2px 6px', borderRadius: '4px', color: doc.color, background: `${doc.color}15`, textTransform: 'uppercase', fontWeight: 800 }}>
                                                    {doc.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action items/Timeline */}
                                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Recent audit logs</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                                            {[
                                                { text: 'Contract signed by Sarah', time: '2 mins ago' },
                                                { text: 'Document Viewed by Sarah', time: '1 hour ago' },
                                                { text: 'New contract draft saved', time: '4 hours ago' }
                                            ].map((log, idx) => (
                                                <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '0.65rem' }}>
                                                    <div style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%', marginTop: '3px' }} />
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: '#475569' }}>{log.text}</div>
                                                        <div style={{ color: '#94a3b8', fontSize: '0.55rem', marginTop: '1px' }}>{log.time}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 3: Feature Grid */}
            <section id="features" style={{ padding: '7rem 2.5rem', backgroundColor: '#ffffff' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', background: '#eff6ff', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
                        <Sparkle size={12} /> Robust Features
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-1px' }}>Everything You Need To Secure Deals</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '4.5rem', maxWidth: '600px', margin: '0 auto 4.5rem auto' }}>Scale your operational agility with digital signatures built for modern business contracts.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem' }}>
                        {[
                            { title: 'Interactive Field Toolbox', desc: 'Place text, signatures, dropdowns, checkboxes, dates, and initials. Customize layouts effortlessly.', icon: <Layers size={20} /> },
                            { title: 'Handdrawn & Typed Signatures', desc: 'Signers can draw freehand signatures, choose stylized typing fonts, or upload images.', icon: <PenTool size={20} /> },
                            { title: 'Automated Reminders', desc: 'Stop worrying about manual follow-up. Set cron reminder schedules to prompt signers automatically.', icon: <RefreshCw size={20} /> },
                            { title: 'Sequential & Parallel Sign', desc: 'Set up strict custom hierarchies, or notify multiple signers simultaneously.', icon: <Zap size={20} /> },
                            { title: 'Secure Cryptographic Audit', desc: 'Appends SHA-256 checksums, log events, user agent configurations, and timestamps.', icon: <Shield size={20} /> },
                            { title: 'Contacts Picker CRM', desc: 'Select recipients from directories, group vendors/clients, and auto-populate details.', icon: <Users size={20} /> },
                            { title: 'Reusable Template Library', desc: 'Instantiate offer letters, invoices, and SLA agreements instantly with standard templates.', icon: <Cpu size={20} /> },
                            { title: 'Workspace Theme Branding', desc: 'Custom upload brand logos, headers, emails, and custom brand colors on signing interfaces.', icon: <Compass size={20} /> }
                        ].map((feat, idx) => (
                            <div key={idx} style={{
                                background: '#f8fafc',
                                padding: '2rem 1.75rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                textAlign: 'left',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(37,99,235,0.08)';
                                e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                            >
                                <div style={{ color: '#2563eb', marginBottom: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                                    {feat.icon}
                                </div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>{feat.title}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 4: Stepper Flow */}
            <section style={{ padding: '7rem 2.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-1px' }}>Signature Lifecycle Stages</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '4.5rem' }}>Automate documents from creation drafts to locked PDFs in 4 stages.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                        {workflowSteps.map((step, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                gap: '2rem',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                padding: '2rem',
                                alignItems: 'center',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <div style={{
                                    fontSize: '2rem',
                                    fontWeight: 900,
                                    color: '#2563eb',
                                    fontFamily: 'monospace',
                                    background: '#eff6ff',
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {step.num}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{step.title}</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 5: Security and Cryptographic Audit - Navy dark layout card */}
            <section id="security" style={{ padding: '7.5rem 2.5rem', backgroundColor: '#0f172a', color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute',
                    width: '350px',
                    height: '350px',
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%)',
                    filter: 'blur(40px)',
                    top: '-50px',
                    right: '-50px',
                    pointerEvents: 'none'
                }} />
                
                <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '320px', textAlign: 'left' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1.25rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <Lock size={12} /> Enterprise Grade Security
                        </div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1.25rem', lineHeight: 1.15 }}>Legally Binding Cryptographic Integrity</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                            Every contract signed through BritSync Docu includes an appended cryptographic Audit Certificate. We register digital verification points to verify document integrity.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[
                                { title: 'Audit Trail Registry', desc: 'Securely logs IP locations, user agent specs, and precise signing time coordinates.' },
                                { title: 'Cryptographic SHA-256 Lock', desc: 'Protects PDF hashes, preventing post-signature file manipulation.' },
                                { title: 'Tokenized Recipient verification', desc: 'Ensures access tokens are delivered only to verified email targets.' }
                            ].map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '3px' }}>
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>{item.title}</h4>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '320px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc' }}>Audit_Log_Verification.json</span>
                            <span style={{ fontSize: '0.6rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>SECURED</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#a7f3d0', display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: 1.4 }}>
                            <div>{`{`}</div>
                            <div style={{ paddingLeft: '1rem' }}>{`"document_id": "647f12e88a3b8b11a910",`}</div>
                            <div style={{ paddingLeft: '1rem' }}>{`"hash_original": "8f2b7a9c8b7762...1d5e",`}</div>
                            <div style={{ paddingLeft: '1rem' }}>{`"hash_final": "3c9d8a7f1a238b...9f0a",`}</div>
                            <div style={{ paddingLeft: '1rem' }}>
                                {`"signer_events": [`}
                                <div style={{ paddingLeft: '1rem', color: '#94a3b8' }}>
                                    {`{`}
                                    <div style={{ paddingLeft: '1rem' }}>{`"email": "sarah.connor@sky.net",`}</div>
                                    <div style={{ paddingLeft: '1rem' }}>{`"action": "SIGNED",`}</div>
                                    <div style={{ paddingLeft: '1rem' }}>{`"ip": "194.164.95.174",`}</div>
                                    <div style={{ paddingLeft: '1rem' }}>{`"timestamp": "2026-06-21T13:25:49Z"`}</div>
                                    {`},`}
                                </div>
                                <div style={{ paddingLeft: '1rem', color: '#94a3b8' }}>...</div>
                                {`]`}
                            </div>
                            <div>{`}`}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 6: Template Gallery Section */}
            <section style={{ padding: '7rem 2.5rem', backgroundColor: '#ffffff' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', background: '#eff6ff', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
                        <GridIcon size={12} /> Ready-Made Layouts
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-1px' }}>Pre-baked Document Templates</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '3.5rem' }}>Select standard models to send deal terms in seconds.</p>

                    {/* Selector tabs */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'legal', label: 'Legal & Compliance' },
                            { id: 'hr', label: 'Human Resources' },
                            { id: 'realestate', label: 'Real Estate' },
                            { id: 'business', label: 'Business & Consulting' }
                        ].map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedTemplateCat(cat.id)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    borderRadius: '9999px',
                                    border: selectedTemplateCat === cat.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                    background: selectedTemplateCat === cat.id ? '#eff6ff' : 'white',
                                    color: selectedTemplateCat === cat.id ? '#2563eb' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Template cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', justifyItems: 'center' }}>
                        {templates.filter(t => t.category === selectedTemplateCat).map((tpl, idx) => (
                            <div key={idx} style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '1.5rem',
                                width: '100%',
                                maxWidth: '280px',
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '160px',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>{tpl.name}</h4>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Fields layout: {tpl.fields} placed</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>{tpl.speed}</span>
                                    <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', borderRadius: '6px' }} onClick={() => navigate('/signup')}>
                                        Use Template
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" style={{ padding: '7rem 2.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-1px' }}>Simple, Transparent Pricing Plans</h2>
                    <p style={{ color: '#64748b', fontSize: '1.05rem', marginBottom: '4.5rem' }}>Select the plan that fits your business signing scale.</p>
                    
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[
                            { name: 'Starter Plan', price: '0', desc: 'For individuals and testing', features: ['3 documents per month', 'Single signer placement', 'Basic Audit Trail', 'Email support'] },
                            { name: 'Professional Plan', price: '19', desc: 'For growing freelancers and teams', features: ['Unlimited documents', 'Multiple recipients', 'Sequential signing order', 'Reusable templates', 'Priority support'], recommended: true },
                            { name: 'Enterprise Plan', price: '49', desc: 'For workspaces needing customization', features: ['Everything in Pro', 'Custom brand color & logo', 'Workspace role permissions', 'Bulk CSV sending', 'Dedicated API access'] }
                        ].map((plan, idx) => (
                            <div key={idx} style={{
                                background: 'white',
                                border: plan.recommended ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                borderRadius: '18px',
                                padding: '3.5rem 2.25rem',
                                flex: 1,
                                minWidth: '290px',
                                maxWidth: '320px',
                                textAlign: 'left',
                                boxShadow: plan.recommended ? '0 25px 30px -8px rgba(37, 99, 235, 0.08)' : 'var(--shadow-sm)',
                                position: 'relative'
                            }}>
                                {plan.recommended && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-12px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: '#2563eb',
                                        color: 'white',
                                        padding: '0.35rem 1.1rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        borderRadius: '9999px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>RECOMMENDED</span>
                                )}
                                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>{plan.name}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 2rem 0', minHeight: '40px', lineHeight: 1.4 }}>{plan.desc}</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '2rem' }}>
                                    <span style={{ fontSize: '2.75rem', fontWeight: 900, color: '#0f172a' }}>£{plan.price}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.25rem' }}>/mo</span>
                                </div>
                                <button className={`btn ${plan.recommended ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', marginBottom: '2.5rem', justifyContent: 'center', height: '44px', borderRadius: '8px', fontWeight: 800 }} onClick={() => navigate('/signup')}>
                                    Get Started
                                </button>
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: 0 }}>
                                    {plan.features.map((feat, fIdx) => (
                                        <li key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#475569' }}>
                                            <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 7: Final CTA */}
            <section style={{ padding: '6.5rem 2rem', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', textAlign: 'center' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1.25rem' }}>Ready to replace printing and scanning?</h2>
                    <p style={{ color: '#bfdbfe', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: 1.5 }}>
                        Join thousands of companies executing contracts, signing NDAs, and closing hiring processes digitally.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn" style={{ padding: '0.85rem 2.5rem', background: '#ffffff', color: '#1e40af', fontWeight: 800, borderRadius: '8px', fontSize: '0.95rem' }} onClick={() => navigate('/signup')}>
                            Start Free
                        </button>
                        <button className="btn" style={{ padding: '0.85rem 2.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontWeight: 800, borderRadius: '8px', fontSize: '0.95rem' }} onClick={() => navigate('/login')}>
                            Sign In
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                background: 'white',
                borderTop: '1px solid #e2e8f0',
                padding: '3rem 3.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
                marginTop: 'auto'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: '#2563eb', padding: '0.35rem', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center' }}>
                        <PenTool size={14} />
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        BritSync <span style={{ color: '#2563eb' }}>Docu</span>
                    </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>&copy; {new Date().getFullYear()} BritSync Docu. All rights reserved.</p>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <a href="#" style={{ fontSize: '0.85rem', color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
                    <a href="#" style={{ fontSize: '0.85rem', color: '#94a3b8', textDecoration: 'none' }}>Terms of Service</a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
