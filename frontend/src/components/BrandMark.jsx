import { Link } from "react-router-dom";

export const BrandMark = ({ inverse = false }) => (
  <Link
    className={`brand-mark ${inverse ? "brand-mark--inverse" : ""}`}
    to="/"
    data-testid="brand-logo-link"
  >
    <img
      src="/assets/clelia-logo.png"
      alt="Clelia & Co."
      data-testid="brand-logo-image"
    />
  </Link>
);
