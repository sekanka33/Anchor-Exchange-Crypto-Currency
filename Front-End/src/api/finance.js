import { API_BASE_URL } from "./config";

// Public money settings from the backend (currencies, limits, fees, networks,
// demo status). The backend enforces all of them; the UI only displays them.
let cached = null;

export const getFinanceConfig = () => {
  if (!cached) {
    cached = fetch(`${API_BASE_URL}/api/config/finance`)
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load exchange settings");
        return res.json();
      })
      .catch((error) => {
        cached = null; // let the next caller retry
        throw error;
      });
  }
  return cached;
};
