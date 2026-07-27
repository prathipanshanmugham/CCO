import { ArrowRight, Sparkle, ShieldCheck } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { SiteShell } from "../components/SiteShell";

const ringImage = "https://images.unsplash.com/photo-1514612497953-05d1e5e171fa?auto=format&fit=crop&w=1600&q=88";
const craftImage = "https://images.unsplash.com/photo-1624588057318-5f1b2eb81012?auto=format&fit=crop&w=1100&q=85";

export default function HomePage() {
  return <SiteShell>
    <section className="hero" data-testid="home-hero">
      <img className="hero-image" src={ringImage} alt="Bespoke diamond ring" data-testid="hero-jewellery-image" />
      <div className="hero-overlay" />
      <div className="hero-copy">
        <p className="eyebrow" data-testid="hero-eyebrow">Clelia & Co. Design Studio</p>
        <h1 data-testid="hero-heading">A piece only<br />you could imagine.</h1>
        <p data-testid="hero-description">Shape a future heirloom with our design intelligence and master jewellers.</p>
        <Link to="/studio" className="button button--ivory" data-testid="hero-design-button">Create your piece <ArrowRight size={17} /></Link>
      </div>
      <p className="hero-scroll" data-testid="hero-scroll-note">Scroll to discover</p>
    </section>
    <section className="editorial-intro" data-testid="brand-introduction">
      <p className="eyebrow">Designed in conversation</p>
      <h2>From a private thought<br />to a lasting form.</h2>
      <p>Describe what you see in your mind. Our design studio turns your story into considered concepts, then brings your chosen piece to life in the hands of our atelier.</p>
      <Link className="underlined-link" to="/how-it-works" data-testid="how-it-works-link">Discover the process <ArrowRight size={16} /></Link>
    </section>
    <section className="process-band" data-testid="process-summary">
      <div className="process-media"><img src={craftImage} alt="Jewellery artisan at work" data-testid="craftsmanship-image" /></div>
      <div className="process-copy"><p className="eyebrow">A new kind of personal</p><h2>Designed with intelligence.<br />Made by hand.</h2><div className="process-list"><p><Sparkle size={22} weight="light" /> Design concepts, made from your words.</p><p><ShieldCheck size={22} weight="light" /> Atelier expertise at every decision.</p></div><Link className="button button--plum" to="/studio" data-testid="process-begin-design-button">Enter the studio</Link></div>
    </section>
  </SiteShell>;
}