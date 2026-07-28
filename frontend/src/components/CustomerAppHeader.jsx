import { ArrowLeft, UserCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";

export function CustomerAppHeader() {
  const [open, setOpen] = useState(false);
  const signedIn = Boolean(localStorage.getItem("clelia-customer-token"));
  return (
    <header className="customer-app-header" data-testid="customer-app-header">
      <div className="customer-app-container">
        <Link
          className="customer-back-link"
          to="/"
          data-testid="orders-back-to-studio-link"
        >
          <ArrowLeft size={18} />
          <span>Back to designer</span>
        </Link>
        <div className="customer-account-wrap">
          <button
            className="customer-avatar"
            onClick={() => setOpen(!open)}
            aria-label="Account menu"
            data-testid="customer-account-menu-button"
          >
            {signedIn ? "C" : <UserCircle size={23} />}
          </button>
          {open && (
            <div
              className="customer-account-menu"
              data-testid="customer-account-menu"
            >
              {signedIn ? (
                <>
                  <strong>Your Clelia account</strong>
                  <span>Designs and orders</span>
                  <Link to="/vault">My Designs</Link>
                  <Link to="/orders">My Orders</Link>
                  <Link to="/profile">Profile & Address</Link>
                  <hr />
                  <Link className="account-muted" to="/staff/login">
                    Staff Login
                  </Link>
                  <hr />
                  <button
                    onClick={() => {
                      localStorage.removeItem("clelia-customer-token");
                      setOpen(false);
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">Sign In</Link>
                  <Link to="/signup">Create Account</Link>
                  <hr />
                  <Link className="account-muted" to="/staff/login">
                    Staff Login
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
