import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const WithdrawalConfirm = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Confirming your withdrawal...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("This confirmation link is missing a token.");
      return;
    }

    const confirm = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/withdrawals/confirm?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(data.message || "Confirmation failed.");
          return;
        }

        setStatus("success");
        setMessage(data.message || "Withdrawal confirmed and processed.");
      } catch {
        setStatus("error");
        setMessage("Unable to connect to Anchor Exchange server.");
      }
    };

    confirm();
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6">
      <h1 className="text-3xl font-bold">Anchor Exchange</h1>

      <p
        role="status"
        className={`mt-6 text-lg ${
          status === "error" ? "text-red-700 dark:text-red-400" : status === "success" ? "text-green-700 dark:text-green-400" : ""
        }`}
      >
        {message}
      </p>

      {status !== "loading" && (
        <Link to="/wallet" className="mt-6 text-blue-700 dark:text-blue-400 underline">
          Go to Wallet
        </Link>
      )}
    </div>
  );
};

export default WithdrawalConfirm;
