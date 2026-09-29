import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to reset password.");
        return;
      }

      setMessage("Password reset successfully. Redirecting to sign in...");
      setTimeout(() => navigate("/signin"), 2000);
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <h1 className="text-2xl font-semibold mb-6">Reset your password</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <div className="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="New password" autoComplete="new-password" placeholder="New password"
            className="h-13 w-full bg-slate-100 dark:bg-gray-900 rounded-2xl pl-4 pr-10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showPassword ? (
            <FaEyeSlash
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowPassword(false)}
            />
          ) : (
            <FaEye
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowPassword(true)}
            />
          )}
        </div>

        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-label="Confirm new password" autoComplete="new-password" placeholder="Confirm new password"
          className="h-13 w-full bg-slate-100 dark:bg-gray-900 rounded-2xl pl-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p role="alert" className="text-red-700 dark:text-red-400 text-sm">{error}</p>}
        {message && <p role="status" className="text-green-700 dark:text-green-400 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-13 w-full bg-blue-700 text-white rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        <Link to="/signin" className="text-center text-blue-700 dark:text-blue-400 mt-2 underline">
          Back to Sign In
        </Link>
      </form>
    </div>
  );
};

export default ResetPassword;
