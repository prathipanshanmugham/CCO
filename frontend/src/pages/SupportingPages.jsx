import {
  ArrowRight,
  Camera,
  CaretRight,
  Heart,
  Package,
  Sparkle,
  UserCircle,
} from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SiteShell } from "../components/SiteShell";

const images = [
  "https://images.unsplash.com/photo-1514612497953-05d1e5e171fa?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1613945407943-59cd755fd69e?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=85",
];

export function EditorialPage({ title, eyebrow, copy }) {
  return (
    <SiteShell>
      <section className="editorial-page" data-testid="editorial-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="editorial-lead" data-testid="editorial-page-copy">
          {copy}
        </p>
        <div className="editorial-image-grid">
          {images.map((image, index) => (
            <img
              key={image}
              src={image}
              alt="Clelia & Co. jewellery"
              data-testid={`editorial-image-${index + 1}`}
            />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

export function VaultPage() {
  return (
    <SiteShell>
      <section className="vault-page" data-testid="design-vault-page">
        <div>
          <p className="eyebrow">Your private collection</p>
          <h1>Design Vault</h1>
          <p>
            Keep every thought, favourite and finished piece in one considered
            place.
          </p>
        </div>
        <div className="vault-empty">
          <Heart size={34} weight="thin" />
          <h2>Your vault is waiting.</h2>
          <p>
            Start a bespoke design and it will appear here for you to revisit.
          </p>
          <Link
            className="button button--plum"
            to="/studio"
            data-testid="vault-start-design-button"
          >
            Begin a design <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

export function OrdersPage() {
  return (
    <SiteShell>
      <section className="orders-page" data-testid="my-orders-page">
        <p className="eyebrow">Your commissions</p>
        <h1>My Orders</h1>
        <div className="order-empty">
          <Package size={34} weight="thin" />
          <h2>Your story is just beginning.</h2>
          <p>
            When your private quote becomes a commission, its atelier journey
            will appear here.
          </p>
          <Link
            to="/studio"
            className="underlined-link"
            data-testid="orders-start-design-link"
          >
            Create a piece <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

export function ViewerPage({ ar = false }) {
  return (
    <SiteShell>
      <section
        className="viewer-page"
        data-testid={ar ? "ar-tryon-page" : "3d-viewer-page"}
      >
        <div>
          <p className="eyebrow">
            {ar ? "Private fitting room" : "Design in dimension"}
          </p>
          <h1>{ar ? "Try it on." : "View your piece."}</h1>
          <p>
            {ar
              ? "Use your camera to see a curated concept in your world."
              : "Rotate, inspect and consider every detail before it enters the atelier."}
          </p>
          <button
            className="button button--plum"
            data-testid={ar ? "start-camera-button" : "start-turntable-button"}
          >
            {ar ? (
              <>
                <Camera size={18} /> Open camera
              </>
            ) : (
              <>
                <Sparkle size={18} /> Start turntable
              </>
            )}
          </button>
        </div>
        <div className="viewer-stage" data-testid="jewellery-viewer-stage">
          <img src={images[0]} alt="Jewellery concept preview" />
          <span>{ar ? "Camera preview ready" : "360° preview"}</span>
        </div>
      </section>
    </SiteShell>
  );
}

export function LoginPage({ staff = false, signup = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const endpoint = staff
      ? "/api/auth/staff/login"
      : signup
        ? "/api/auth/register"
        : "/api/auth/login";
    const body = staff
      ? { email, password, otp }
      : signup
        ? { name: "Clelia Customer", email, password }
        : { email, password };
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (!response.ok)
      return setError(
        typeof data.detail === "string"
          ? data.detail
          : "Please check your details and try again.",
      );
    localStorage.setItem(
      staff ? "clelia-staff-token" : "clelia-customer-token",
      data.token,
    );
    navigate(
      staff && data.user.role === "manager"
        ? "/staff/settings"
        : staff
          ? "/staff"
          : "/",
    );
  };
  return (
    <div
      className="auth-page"
      data-testid={
        staff
          ? "staff-login-page"
          : signup
            ? "customer-signup-page"
            : "customer-login-page"
      }
    >
      <Link to="/" className="auth-logo" data-testid="auth-logo-link">
        <img src="/assets/clelia-logo.png" alt="Clelia & Co." />
      </Link>
      <div className="auth-card">
        <p className="eyebrow">
          {staff ? "Atelier access" : "Your private account"}
        </p>
        <h1>
          {staff
            ? "Welcome back."
            : signup
              ? "Begin your story."
              : "A home for your ideas."}
        </h1>
        <p>
          {staff
            ? "Sign in with your atelier credentials and verification code."
            : signup
              ? "Create an account to keep every design, consultation and commission close."
              : "Sign in to save designs, track commissions and return to your vault."}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Full name
              <input
                placeholder="Your name"
                data-testid="customer-name-input"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid={`${staff ? "staff" : "customer"}-email-input`}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid={`${staff ? "staff" : "customer"}-password-input`}
            />
          </label>
          {staff && (
            <label>
              Authenticator code
              <input
                inputMode="numeric"
                maxLength="6"
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                data-testid="staff-totp-input"
              />
            </label>
          )}
          <button
            className="button button--plum auth-submit"
            data-testid={`${staff ? "staff" : signup ? "customer-signup" : "customer-login"}-submit`}
          >
            {signup ? "Create account" : "Continue"} <CaretRight size={17} />
          </button>
        </form>
        {error && (
          <p className="inline-error" data-testid="auth-error-message">
            {error}
          </p>
        )}
        {!staff && (
          <>
            <div className="auth-divider">or</div>
            <button
              className="button button--outline auth-google"
              data-testid="google-login-button"
            >
              Continue with Google
            </button>
            <p className="auth-switch">
              {signup ? "Already have an account?" : "New to Clelia?"}{" "}
              <Link
                to={signup ? "/login" : "/signup"}
                data-testid="customer-signup-link"
              >
                {signup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  return (
    <SiteShell>
      <section className="profile-page" data-testid="profile-page">
        <p className="eyebrow">Personal details</p>
        <h1>Your profile</h1>
        <div className="profile-grid">
          <div className="profile-avatar">
            <UserCircle size={72} weight="thin" />
          </div>
          <form>
            <label>
              Full name
              <input placeholder="Your name" data-testid="profile-name-input" />
            </label>
            <label>
              Email address
              <input
                placeholder="you@example.com"
                data-testid="profile-email-input"
              />
            </label>
            <button
              className="button button--plum"
              data-testid="save-profile-button"
            >
              Save changes
            </button>
          </form>
        </div>
      </section>
    </SiteShell>
  );
}
