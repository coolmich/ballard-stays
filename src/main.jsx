import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Hydrate route dates — localStorage restores them as strings.
try {
  const raw = JSON.parse(localStorage.getItem("bs-route") || "null");
  if (raw?.data?.dates) {
    if (raw.data.dates.checkin) raw.data.dates.checkin = new Date(raw.data.dates.checkin);
    if (raw.data.dates.checkout) raw.data.dates.checkout = new Date(raw.data.dates.checkout);
    localStorage.setItem("bs-route", JSON.stringify(raw));
  }
} catch {
  // ignore malformed storage
}

createRoot(document.getElementById("root")).render(<App />);
