import { useEffect, useState } from "react";
import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ManagerSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState("");
  const token = localStorage.getItem("clelia-staff-token");

  useEffect(() => {
    fetch(`${API}/manager/content`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setSettings)
      .catch(() =>
        setStatus(
          "Please sign in as a Manager to edit customer-facing settings.",
        ),
      );
  }, [token]);

  const save = async () => {
    setStatus("");
    const response = await fetch(`${API}/manager/content`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok)
      return setStatus(
        "We could not save those changes. Please review the required values and try again.",
      );
    setSettings(await response.json());
    setStatus("Your changes are now live in the customer tool.");
  };

  if (!settings)
    return (
      <main className="manager-settings" data-testid="manager-settings-page">
        <Link to="/staff" data-testid="manager-back-link">
          <ArrowLeft size={17} /> Back to staff workspace
        </Link>
        <h1>Customer tool settings</h1>
        <p data-testid="manager-settings-status">
          {status || "Loading settings…"}
        </p>
      </main>
    );
  return (
    <main className="manager-settings" data-testid="manager-settings-page">
      <Link to="/staff" data-testid="manager-back-link">
        <ArrowLeft size={17} /> Back to staff workspace
      </Link>
      <p className="eyebrow">Manager controls</p>
      <h1>Customer tool settings</h1>
      <section>
        <h2>Jewellery types</h2>
        {settings.jewellery_types.map((item, index) => (
          <label className="manager-row" key={`${item.name}-${index}`}>
            <input
              value={item.name}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  jewellery_types: settings.jewellery_types.map(
                    (type, itemIndex) =>
                      itemIndex === index
                        ? { ...type, name: event.target.value }
                        : type,
                  ),
                })
              }
              data-testid={`manager-type-name-${index}`}
            />
            <input
              type="checkbox"
              checked={item.visible}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  jewellery_types: settings.jewellery_types.map(
                    (type, itemIndex) =>
                      itemIndex === index
                        ? { ...type, visible: event.target.checked }
                        : type,
                  ),
                })
              }
              data-testid={`manager-type-visible-${index}`}
            />{" "}
            Visible
          </label>
        ))}
      </section>
      <section>
        <h2>Gold rate per gram</h2>
        <input
          type="number"
          min="1"
          value={settings.gold_rate_per_gram}
          onChange={(event) =>
            setSettings({
              ...settings,
              gold_rate_per_gram: Number(event.target.value),
            })
          }
          data-testid="manager-gold-rate-input"
        />
      </section>
      <section>
        <h2>Checkout handoff</h2>
        <select
          value={settings.payment_mode}
          onChange={(event) =>
            setSettings({ ...settings, payment_mode: event.target.value })
          }
          data-testid="manager-payment-mode-select"
        >
          <option value="self_contained">Keep checkout in the tool</option>
          <option value="handoff">
            Send customers to the main store checkout
          </option>
        </select>
      </section>
      <button
        className="button button--plum"
        onClick={save}
        data-testid="save-manager-settings-button"
      >
        <FloppyDisk size={18} /> Save and publish
      </button>
      <p className="manager-status" data-testid="manager-settings-status">
        {status}
      </p>
    </main>
  );
}
