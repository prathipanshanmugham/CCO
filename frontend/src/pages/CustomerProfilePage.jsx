import { useEffect, useState } from "react";
import { CustomerAppHeader } from "../components/CustomerAppHeader";

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const token = localStorage.getItem("clelia-customer-token");
  useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setMessage("Please sign in to update your profile."));
  }, [token]);
  const save = async (event) => {
    event.preventDefault();
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone || undefined,
        }),
      },
    );
    const data = await response.json();
    setMessage(
      response.ok
        ? "Your profile has been saved."
        : data.detail || "We could not save your profile.",
    );
    if (response.ok) setProfile(data);
  };
  return (
    <>
      <CustomerAppHeader />
      <main className="orders-application">
        <div className="orders-container profile-form-page">
          <h1>Profile & Address</h1>
          {!profile ? (
            <p>{message || "Loading your profile…"}</p>
          ) : (
            <form onSubmit={save}>
              <label>
                Full name
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                  data-testid="profile-name-input"
                />
              </label>
              <label>
                Email address
                <input
                  value={profile.email}
                  disabled
                  data-testid="profile-email-input"
                />
              </label>
              <label>
                Mobile number
                <input
                  value={profile.phone || ""}
                  onChange={(event) =>
                    setProfile({ ...profile, phone: event.target.value })
                  }
                  placeholder="10-digit mobile number"
                  data-testid="profile-phone-input"
                />
              </label>
              <button
                className="button button--plum"
                data-testid="save-profile-button"
              >
                Save changes
              </button>
            </form>
          )}
          {message && (
            <p className="design-success" data-testid="profile-message">
              {message}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
