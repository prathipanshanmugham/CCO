import { List, UserCircle } from "@phosphor-icons/react";
import { Link, NavLink } from "react-router-dom";
import { BrandMark } from "./BrandMark";

const links = [
  ["How it works", "/how-it-works"],
  ["Inspiration", "/inspiration"],
  ["Care & Craft", "/care"],
];

export const SiteShell = ({ children }) => (
  <div className="site-shell">
    <header className="site-header" data-testid="site-header">
      <button className="mobile-menu" data-testid="mobile-menu-button" aria-label="Open navigation"><List size={24} /></button>
      <BrandMark />
      <nav className="main-nav" data-testid="main-navigation">
        {links.map(([label, path]) => <NavLink key={path} to={path} data-testid={`navigation-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <Link to="/vault" className="text-link" data-testid="design-vault-link">Design Vault</Link>
        <Link to="/login" className="icon-link" aria-label="Your account" data-testid="customer-login-link"><UserCircle size={25} weight="light" /></Link>
        <Link to="/studio" className="button button--small" data-testid="start-design-button">Begin a design</Link>
      </div>
    </header>
    <main>{children}</main>
    <footer className="site-footer" data-testid="site-footer">
      <div><BrandMark inverse /><p data-testid="footer-description">Crafted around your story, considered for generations.</p></div>
      <div className="footer-links"><Link to="/contact" data-testid="footer-contact-link">Contact</Link><Link to="/policies" data-testid="footer-policies-link">Policies</Link><Link to="/staff/login" data-testid="footer-staff-link">Atelier access</Link></div>
      <p data-testid="footer-copyright">© 2026 Clelia & Co. All rights reserved.</p>
    </footer>
  </div>
);