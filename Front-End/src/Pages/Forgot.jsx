import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const Forgot = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to process request.");
        return;
      }

      setMessage(data.message);
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <h1 className="text-2xl font-semibold mb-2">Forgot password</h1>
      <p className="text-center mb-6 text-slate-500 dark:text-gray-400">
        Enter the email associated with your account and we'll send you a link to reset your
        password.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address" autoComplete="email" placeholder="Email address"
          className="h-13 w-full bg-slate-100 dark:bg-gray-900 rounded-2xl pl-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p role="alert" className="text-red-700 dark:text-red-400 text-sm">{error}</p>}
        {message && <p role="status" className="text-green-700 dark:text-green-400 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-13 w-full bg-blue-600 text-white rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <Link to="/signin" className="text-center text-blue-600 dark:text-blue-400 mt-2">
          Back to Sign In
        </Link>
      </form>
    </div>
  );
};

export default Forgot;
