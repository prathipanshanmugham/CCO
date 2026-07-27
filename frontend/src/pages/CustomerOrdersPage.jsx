import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Package } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const token = localStorage.getItem("clelia-customer-token");

  useEffect(() => {
    fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setOrders)
      .catch(() => setError("Please sign in to see your orders."));
  }, [token]);

  if (error)
    return (
      <main className="orders-application" data-testid="customer-orders-page">
        <Link
          to="/login"
          className="underlined-link"
          data-testid="orders-sign-in-link"
        >
          Sign in to view orders
        </Link>
        <p className="inline-error" data-testid="orders-error-message">
          {error}
        </p>
      </main>
    );
  if (!orders)
    return (
      <main className="orders-application" data-testid="customer-orders-page">
        <p data-testid="orders-loading-state">Loading your orders…</p>
      </main>
    );
  return (
    <main className="orders-application" data-testid="customer-orders-page">
      <header>
        <Link to="/" data-testid="orders-back-to-studio-link">
          <ArrowLeft size={17} /> Back to designer
        </Link>
        <h1>My Orders</h1>
      </header>
      {orders.length === 0 ? (
        <section className="orders-empty" data-testid="orders-empty-state">
          <Package size={36} />
          <h2>Your story starts here.</h2>
          <p>Once you confirm a design, its progress will appear here.</p>
          <Link
            className="button button--plum"
            to="/"
            data-testid="orders-create-design-link"
          >
            Create a design
          </Link>
        </section>
      ) : (
        <section
          className="customer-order-list"
          data-testid="customer-orders-list"
        >
          {orders.map((order) => (
            <article key={order.id} data-testid={`customer-order-${order.id}`}>
              <div>
                <p className="eyebrow">{order.production_status}</p>
                <h2>{order.design_id}</h2>
                <p>Payment: {order.payment_status.replaceAll("_", " ")}</p>
              </div>
              <div>
                <strong>
                  {order.total
                    ? `₹${order.total.toLocaleString("en-IN")}`
                    : "Quote in progress"}
                </strong>
                {order.payment_status !== "confirmed" && order.total ? (
                  <button
                    className="button button--plum"
                    data-testid={`pay-order-${order.id}`}
                  >
                    <CreditCard size={17} /> Pay securely
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
