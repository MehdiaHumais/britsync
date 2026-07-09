import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon } from 'lucide-react';
import Magnetic from '../ui/Magnetic';
import { useTheme } from '../../context/ThemeContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import './Navbar.css';

const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    // { name: 'Work', path: '/work' },
    { name: 'News', path: '/main/news/' },
    { name: 'About', path: '/about' },
    { name: 'Store', path: 'https://store.britsyncai.com/' },
    { name: 'Contact', path: '/contact' },
    { name: 'BritSync Docu', path: window.location.hostname === 'localhost' ? 'http://localhost:5173' : 'https://britsync-docu.britsync.co.uk' }
];

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { settings } = useSiteSettings();
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="nav-container">
                <Link to="/" className="nav-logo">
                    <img src="/vite.svg" alt="Vite Logo" className="logo-img" />
                    <span className="logo-text">{settings.siteTitle}</span>
                </Link>

                <div className="nav-menu-desktop">
                    <div className="nav-links">
                        {navLinks.map((link) => (
                            link.path.startsWith('/main/') || link.path.startsWith('/docu/') || link.path.startsWith('http') ? (
                                <a
                                    key={link.path}
                                    href={link.path}
                                    className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                                >
                                    {link.name}
                                    {location.pathname === link.path && (
                                        <motion.div className="nav-underline" layoutId="underline" />
                                    )}
                                </a>
                            ) : (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                                >
                                    {link.name}
                                    {location.pathname === link.path && (
                                        <motion.div className="nav-underline" layoutId="underline" />
                                    )}
                                </Link>
                            )
                        ))}
                    </div>

                    <div className="nav-actions">
                        <button className="theme-toggle" onClick={toggleTheme}>
                            <AnimatePresence mode="wait">
                                {theme === 'dark' ? (
                                    <motion.div
                                        key="moon"
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                    >
                                        <Moon size={20} color="white" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="sun"
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                    >
                                        <Sun size={20} color="black" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>

                        <Magnetic>
                            <Link to="/contact">
                                <button className="cta-button">
                                    Get Started
                                </button>
                            </Link>
                        </Magnetic>
                    </div>
                </div>

                <div className="mobile-actions">
                    <button className="theme-toggle" onClick={toggleTheme}>
                        <AnimatePresence mode="wait">
                            {theme === 'dark' ? (
                                <motion.div
                                    key="moon"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                >
                                    <Moon size={20} color="white" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="sun"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                >
                                    <Sun size={20} color="black" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                    <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        className="mobile-menu"
                        initial={{ opacity: 0, y: -20, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, y: 0, backdropFilter: 'blur(20px)' }}
                        exit={{ opacity: 0, y: -20, backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
                    >
                        <motion.div
                            className="mobile-links"
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: {
                                    opacity: 1,
                                    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
                                }
                            }}
                        >
                            {navLinks.map((link) => (
                                <motion.div
                                    key={link.path}
                                    variants={{
                                        hidden: { y: 20, opacity: 0 },
                                        visible: { y: 0, opacity: 1 }
                                    }}
                                >
                                    {link.path.startsWith('/main/') || link.path.startsWith('/docu/') || link.path.startsWith('http') ? (
                                        <a
                                            href={link.path}
                                            className={`mobile-link ${location.pathname === link.path ? 'active' : ''}`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <span className="link-number">0{navLinks.indexOf(link) + 1}</span>
                                            {link.name}
                                        </a>
                                    ) : (
                                        <Link
                                            to={link.path}
                                            className={`mobile-link ${location.pathname === link.path ? 'active' : ''}`}
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <span className="link-number">0{navLinks.indexOf(link) + 1}</span>
                                            {link.name}
                                        </Link>
                                    )}
                                </motion.div>
                            ))}
                            <motion.div
                                variants={{
                                    hidden: { y: 20, opacity: 0 },
                                    visible: { y: 0, opacity: 1 }
                                }}
                                className="mobile-socials"
                            >
                                <Link
                                    to="/contact"
                                    className="mobile-cta"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Start a Project
                                </Link>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
