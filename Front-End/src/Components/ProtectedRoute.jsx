import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { homeFor } from "../context/AuthContext";

// Route guards. They decide from the role the *server* reported (see
// AuthProvider), wait until that check finishes before redirecting (so a
// refresh never flashes the wrong page or bounces between routes), and
// only shape navigation: every API behind these pages enforces the same
// rules itself.

const SessionCheck = () => {
  const { status, retry } = useAuth();

  if (status === "error") {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-lg font-semibold">We couldn't verify your session.</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">Check your connection and try again.</p>
        <button type="button" onClick={retry} className="h-10 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          Try again
        </button>
      </div>
    );
  }

  return (
    <p role="status" className="flex flex-1 items-center justify-center p-8 text-center text-gray-600 dark:text-gray-400">
      Checking your session…
    </p>
  );
};

const isPending = (status) => status === "loading" || status === "error";

// Signed-in pages. `role` limits the page to "user" or "admin"; the other
// role is sent to its own home, and visitors to sign in (then back here).
const ProtectedRoute = ({ children, role }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (isPending(status)) return <SessionCheck />;

  if (status !== "authenticated") {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }

  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;

  return children;
};

// Customer-facing pages anyone may browse (Home, Markets, Exchange, ...).
// Administrators don't use the customer app, so they're sent to /admin.
export const CustomerRoute = ({ children }) => {
  const { status, user } = useAuth();

  if (isPending(status)) return <SessionCheck />;
  if (status === "authenticated" && user.role === "admin") return <Navigate to="/admin" replace />;

  return children;
};

// Where to go after signing in. Admins always land on /admin, whatever they
// originally asked for (except finishing a QR approval). Users return to the page that sent them to sign in,
// if it's a local customer page, otherwise their dashboard.
const destinationAfterSignIn = (role, from) => {
  const isLocalPath = typeof from === "string" && from.startsWith("/") && !from.startsWith("//");
  // Approving a desktop QR login from a phone works for either role.
  if (isLocalPath && from.startsWith("/qr-auth?")) return from;
  if (role === "admin") return "/admin";
  if (!isLocalPath || /^\/(admin|signin|signup)(\/|\?|$)/.test(from)) return homeFor(role);
  return from;
};

// Sign in / sign up. Once a session exists (right after a successful login,
// or when a signed-in user opens these pages) this sends them on.
export const GuestRoute = ({ children }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (isPending(status)) return <SessionCheck />;
  if (status === "authenticated") {
    return <Navigate to={destinationAfterSignIn(user.role, location.state?.from)} replace />;
  }

  return children;
};

export default ProtectedRoute;
