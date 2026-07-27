import { ArrowLeft, Question } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const steps = [
  "Type",
  "Describe",
  "Specify",
  "Create",
  "3D & Try-On",
  "Confirm",
];

export function ToolShell({ step, children, onHelp }) {
  return (
    <div className="tool-shell" data-testid="design-tool-shell">
      <header className="tool-header" data-testid="tool-header">
        <a
          className="tool-brand"
          href="https://cleliaandco.com"
          data-testid="return-to-store-logo-link"
        >
          <img src="/assets/clelia-logo.png" alt="Clelia & Co." />
        </a>
        <div className="tool-progress" data-testid="tool-progress">
          <p data-testid="step-label">Step {step} of 6</p>
          <ol>
            {steps.map((label, index) => (
              <li
                className={
                  step === index + 1
                    ? "is-current"
                    : step > index + 1
                      ? "is-complete"
                      : ""
                }
                key={label}
                data-testid={`progress-step-${index + 1}`}
              >
                <span>{index + 1}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>
        </div>
        <Link
          className="tool-account"
          to="/login"
          aria-label="Your account"
          data-testid="tool-account-link"
        >
          Account
        </Link>
      </header>
      <main className="tool-content">{children}</main>
      <footer className="tool-footer" data-testid="tool-footer">
        <a
          href="https://cleliaandco.com"
          data-testid="footer-return-to-store-link"
        >
          <ArrowLeft size={16} /> Back to cleliaandco.com
        </a>
        <button
          onClick={onHelp}
          aria-label="How this works"
          data-testid="open-help-button"
        >
          <Question size={16} />
        </button>
      </footer>
    </div>
  );
}
