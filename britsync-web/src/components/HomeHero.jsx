import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import TypewriterReveal from './ui/TypewriterReveal';
import Button from './ui/Button';
import InteractiveParticles from './ui/InteractiveParticles';
import TechBackground from './ui/TechBackground';
import HeroVisual from './HeroVisual';
import './HomeHero.css';

const HomeHero = () => {
    const title = "Build Smarter\nDigital Systems.";
    const subtitle = "We create high-performance websites, scalable web applications, and digital platforms that help modern businesses launch faster and operate smarter.";

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    return (
        <section className="home-hero-section">
            {/* Background modules */}
            <TechBackground />
            <InteractiveParticles />

            {/* Gradient background overlays */}
            <div className="home-hero-glow-1" />
            <div className="home-hero-glow-2" />
            <div className="home-hero-grid-pattern" />

            <div className="home-hero-container">
                <div className="home-hero-grid">
                    {/* Left Column: Core Brand Positioning */}
                    <motion.div 
                        className="hero-content-left"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Title Headline */}
                        <motion.div className="hero-headline-wrap" variants={itemVariants}>
                            <TypewriterReveal text={title} className="hero-headline-text" delay={0.4} align="left" />
                        </motion.div>

                        {/* Paragraph description */}
                        <motion.p className="hero-paragraph" variants={itemVariants}>
                            {subtitle}
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div className="hero-btn-group" variants={itemVariants}>
                            <Link to="/contact">
                                <Button className="btn-hero-primary" isMagnetic={false}>
                                    Start a Project
                                </Button>
                            </Link>
                            <Link to="/work">
                                <Button className="btn-hero-secondary" isMagnetic={false}>
                                    Explore Work
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Trust line */}
                        <motion.div className="hero-trust-tag monospace" variants={itemVariants}>
                            <span>//</span> Trusted for modern web and digital product development.
                        </motion.div>
                    </motion.div>

                    {/* Right Column: Interactive Dashboard visual */}
                    <div className="hero-content-right">
                        <HeroVisual />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HomeHero;
