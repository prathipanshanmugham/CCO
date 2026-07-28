import {
  ChartLineUp,
  Cube,
  FileArrowDown,
  GearSix,
  ListChecks,
  SignOut,
  UsersThree,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function StaffDashboardPage() {
  const [active, setActive] = useState("Order Queue");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const token = localStorage.getItem("clelia-staff-token");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/staff/orders`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setOrders)
      .catch((requestError) => {
        if (requestError.name !== "AbortError")
          setError(
            "Please sign in with a staff account to view the order queue.",
          );
      });
    return () => controller.abort();
  }, [token]);
  const nav = [
    [ListChecks, "Order Queue"],
    [Cube, "Production Tracker"],
    [UsersThree, "Clients"],
    [ChartLineUp, "Analytics"],
    [GearSix, "Settings"],
  ];
  return (
    <div className="staff-app" data-testid="staff-dashboard-page">
      <aside className="staff-sidebar" data-testid="staff-sidebar">
        <img
          src="/assets/clelia-logo.png"
          alt="Clelia & Co."
          data-testid="staff-logo-image"
        />
        <p className="staff-label">Atelier portal</p>
        <nav>
          {nav.map(([Icon, label]) => (
            <button
              key={label}
              onClick={() => setActive(label)}
              className={active === label ? "is-active" : ""}
              data-testid={`staff-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
            >
              <Icon size={20} weight="light" />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/staff/login" data-testid="staff-signout-link">
          <SignOut size={19} /> Sign out
        </Link>
      </aside>
      <main className="staff-content">
        <header>
          <div>
            <p className="eyebrow">
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }).format(new Date())}
            </p>
            <h1 data-testid="staff-page-title">{active}</h1>
          </div>
          <button
            className="icon-link staff-profile"
            data-testid="staff-profile-button"
          >
            AM
          </button>
        </header>
        {error ? (
          <p className="inline-error" data-testid="staff-dashboard-error">
            {error}
          </p>
        ) : (
          <>
            <section className="staff-metrics" data-testid="staff-metrics">
              <div>
                <span>Open orders</span>
                <strong>{orders?.length ?? "—"}</strong>
                <small>Current commissions</small>
              </div>
              <div>
                <span>In production</span>
                <strong>
                  {orders?.filter(
                    (order) => order.production_status === "In Production",
                  ).length ?? "—"}
                </strong>
                <small>In active production</small>
              </div>
              <div>
                <span>Awaiting QC</span>
                <strong>
                  {orders?.filter((order) => order.production_status === "QC")
                    .length ?? "—"}
                </strong>
                <small>Awaiting final review</small>
              </div>
              <div>
                <span>Value in pipeline</span>
                <strong>
                  ₹
                  {orders
                    ?.reduce((sum, order) => sum + (order.total || 0), 0)
                    .toLocaleString("en-IN") ?? "—"}
                </strong>
                <small>Across active orders</small>
              </div>
            </section>
            <section className="orders-panel">
              <div className="panel-heading">
                <div>
                  <h2>Active commissions</h2>
                  <p data-testid="orders-panel-description">
                    Refined work, moving through the atelier.
                  </p>
                </div>
                <button
                  className="button button--outline"
                  data-testid="order-filter-button"
                >
                  Filter orders
                </button>
              </div>
              <div className="orders-table" data-testid="staff-orders-table">
                <div className="table-row table-head">
                  <span>Commission</span>
                  <span>Piece</span>
                  <span>Stage</span>
                  <span>Due</span>
                  <span />
                </div>
                {orders?.map((order) => (
                  <div
                    className="table-row"
                    key={order.id}
                    data-testid={`staff-order-${String(order.id || "order").toLowerCase()}`}
                  >
                    <span>
                      <strong>
                        {String(order.id || "")
                          .slice(0, 8)
                          .toUpperCase()}
                      </strong>
                      <small>{order.customer_id}</small>
                    </span>
                    <span>
                      {String(order.design_id || "")
                        .slice(0, 8)
                        .toUpperCase()}
                      <small>
                        ₹{(order.total || 0).toLocaleString("en-IN")}
                      </small>
                    </span>
                    <span>
                      <i
                        className={`status-dot status-${(order.production_status || "New").toLowerCase().replaceAll(" ", "-")}`}
                      />
                      {order.production_status || "New"}
                    </span>
                    <span>{order.due_date || "Not set"}</span>
                    <button
                      className="table-action"
                      data-testid={`open-order-${String(order.id || "order").toLowerCase()}`}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        <section
          className="secure-panel"
          data-testid="secure-print-files-panel"
        >
          <div>
            <p className="eyebrow">Restricted production assets</p>
            <h2>Manufacturing files</h2>
            <p>
              Available only after verified payment confirmation. Every access
              is logged.
            </p>
          </div>
          <button
            className="button button--dark"
            onClick={() => setActive("Production Tracker")}
            data-testid="review-secure-files-button"
          >
            <FileArrowDown size={18} /> Review access
          </button>
        </section>
      </main>
    </div>
  );
}
