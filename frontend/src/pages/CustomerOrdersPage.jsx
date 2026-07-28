import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Package } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { CustomerAppHeader } from "../components/CustomerAppHeader";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const token = localStorage.getItem("clelia-customer-token");

  useEffect(() => {
    fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(response.status),
      )
      .then(setOrders)
      .catch((status) =>
        setError(
          status === 401
            ? "Please sign in to see your orders."
            : "We could not load your orders. Please try again.",
        ),
      );
  }, [token]);

  const startPayment = async (orderId) => {
    const response = await fetch(`${API}/orders/${orderId}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ payment_option: "full" }),
    });
    const data = await response.json();
    setPaymentMessage(
      response.ok
        ? "Your secure payment window is ready to open."
        : data.detail || "We could not start secure payment. Please try again.",
    );
  };

  if (error)
    return (
      <>
        <CustomerAppHeader />
        <main className="orders-application" data-testid="customer-orders-page">
          <section className="orders-empty">
            <div className="orders-empty-icon">
              <Package size={48} />
            </div>
            <h2>Your story starts here.</h2>
            <p>{error}</p>
            <Link
              to="/login"
              className="button button--plum"
              data-testid="orders-sign-in-link"
            >
              Sign in to view orders
            </Link>
          </section>
        </main>
      </>
    );
  if (!orders)
    return (
      <>
        <CustomerAppHeader />
        <main className="orders-application" data-testid="customer-orders-page">
          <p data-testid="orders-loading-state">Loading your orders…</p>
        </main>
      </>
    );
  return (
    <>
      <CustomerAppHeader />
      <main className="orders-application" data-testid="customer-orders-page">
        <div className="orders-container">
          <header>
            <h1>My Orders</h1>
          </header>
          {orders.length === 0 ? (
            <section className="orders-empty" data-testid="orders-empty-state">
              <div className="orders-empty-icon">
                <Package size={48} />
              </div>
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
                <article
                  className="customer-order-card"
                  key={order.id}
                  data-testid={`customer-order-${order.id}`}
                >
                  <div>
                    <p className="eyebrow">{order.production_status}</p>
                    <h2>
                      Bespoke piece {String(order.id).slice(0, 8).toUpperCase()}
                    </h2>
                    <p>
                      Payment:{" "}
                      {(order.payment_status || "pending").replaceAll("_", " ")}
                    </p>
                    <p>
                      Due{" "}
                      {order.due_date ||
                        new Date(order.created_at).toLocaleDateString("en-IN")}
                    </p>
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
                        onClick={() => startPayment(order.id)}
                        data-testid={`pay-order-${order.id}`}
                      >
                        <CreditCard size={17} /> Pay securely
                      </button>
                    ) : null}
                    <Link
                      className="underlined-link"
                      to={`/orders/${order.id}`}
                      data-testid={`view-order-${order.id}`}
                    >
                      View details
                    </Link>
                  </div>
                </article>
              ))}
              {paymentMessage && (
                <p className="inline-error" data-testid="payment-message">
                  {paymentMessage}
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
