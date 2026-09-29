import { useEffect, useState } from 'react'
import { FaCamera, FaEye, FaEyeSlash } from 'react-icons/fa'
import { API_BASE_URL } from '../api/config'
import { useTheme } from '../hooks/useTheme'
import PageHeader from '../Components/PageHeader'
import EmptyState from '../Components/EmptyState'

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const ProfileForm = ({ profile, onUpdated }) => {
  const [formData, setFormData] = useState({
    fullName: profile.fullname || "",
    surname: profile.surname || "",
    country: profile.country || "",
    phoneNumber: profile.phonenumber || "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to update profile.");
        return;
      }

      setMessage(data.message);
      onUpdated(data.user);
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold mb-2">User Profile</h2>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-slate-500 dark:text-gray-400 text-sm break-all">{profile.email}</span>
        {profile.is_verified ? (
          <span className="text-xs text-green-700 dark:text-green-400 border border-green-700 dark:border-green-400 rounded-full px-2 py-0.5 shrink-0">
            Verified
          </span>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400 border border-amber-700 dark:border-amber-400 rounded-full px-2 py-0.5 shrink-0">
            Not verified
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          aria-label="Full name" autoComplete="given-name" placeholder="Full name"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="surname"
          value={formData.surname}
          onChange={handleChange}
          aria-label="Surname" autoComplete="family-name" placeholder="Surname"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="country"
          value={formData.country}
          onChange={handleChange}
          aria-label="Country" autoComplete="country-name" placeholder="Country"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          aria-label="Phone number" autoComplete="tel" placeholder="Phone number"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p role="alert" className="text-red-700 dark:text-red-400 text-sm">{error}</p>}
        {message && <p role="status" className="text-green-700 dark:text-green-400 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-blue-600 text-white rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
};

const PreferencesForm = ({ profile, onUpdated }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [currency, setCurrency] = useState(profile.preferences?.currency || "USD");
  const [language, setLanguage] = useState(profile.preferences?.language || "en");
  const [emailNotifications, setEmailNotifications] = useState(
    profile.preferences?.emailNotifications ?? true
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const desiredTheme = isDarkMode ? "dark" : "light";

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/preferences`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ currency, language, emailNotifications, theme: desiredTheme }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to update preferences.");
        return;
      }

      setMessage(data.message);
      onUpdated({ ...profile, preferences: data.preferences });
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold mb-5">Preferences</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500 dark:text-gray-400">Display currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ZAR">ZAR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-500 dark:text-gray-400">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-gray-400">Theme</span>
          <button type="button" onClick={toggleTheme} className="text-sm text-blue-500">
            {isDarkMode ? "Dark (switch to light)" : "Light (switch to dark)"}
          </button>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-gray-400">Email notifications</span>
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
        </label>

        {error && <p role="alert" className="text-red-700 dark:text-red-400 text-sm">{error}</p>}
        {message && <p role="status" className="text-green-700 dark:text-green-400 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-blue-600 text-white rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save preferences"}
        </button>
      </form>
    </div>
  );
};

const ChangePasswordForm = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/change-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to change password.");
        return;
      }

      setMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold mb-5">Change password</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative flex items-center">
          <input
            type={showPasswords ? "text" : "password"}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showPasswords ? (
            <FaEyeSlash className="absolute right-3 cursor-pointer" onClick={() => setShowPasswords(false)} />
          ) : (
            <FaEye className="absolute right-3 cursor-pointer" onClick={() => setShowPasswords(true)} />
          )}
        </div>

        <input
          type={showPasswords ? "text" : "password"}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type={showPasswords ? "text" : "password"}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="h-12 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p role="alert" className="text-red-700 dark:text-red-400 text-sm">{error}</p>}
        {message && <p role="status" className="text-green-700 dark:text-green-400 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-blue-600 text-white rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
};

const ProfileAndSetting = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
          headers: authHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Unable to load profile.");
          return;
        }

        setProfile(data.user);
      } catch {
        setError("Unable to connect to Anchor Exchange server.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const navItems = [
    { key: "profile", label: "User Profile", icon: "/src/assets/Group.png" },
    { key: "referrals", label: "Referrals", icon: "/src/assets/refrel.png" },
    { key: "preferences", label: "Preferences", icon: "/src/assets/refrel.png" },
    { key: "api", label: "API keys", icon: "/src/assets/api.png" },
    { key: "history", label: "Login history", icon: "/src/assets/history.png" },
    { key: "2fa", label: "2FA", icon: "/src/assets/2FA.png" },
    { key: "password", label: "Change password", icon: "/src/assets/password.png" },
  ];

  const emptyStateCopy = {
    referrals: {
      icon: "🎁",
      title: "Referrals",
      description: "Referral rewards aren't available on Anchor Exchange yet. Check back later.",
    },
    api: {
      icon: "🔑",
      title: "API Access",
      description: "API key management isn't available on Anchor Exchange yet. Check back later.",
    },
    history: {
      icon: "🕓",
      title: "Login History",
      description: "Login session history isn't tracked on Anchor Exchange yet. Check back later.",
    },
    "2fa": {
      icon: "🛡️",
      title: "Two-Factor Authentication",
      description: "2FA isn't available on Anchor Exchange yet. Check back later.",
    },
  };

  return (
    <div>
      <PageHeader title="User Profile" crumbs={[{ label: "Home", to: "/" }, { label: "Profile & Settings" }]} />

      <div className='flex flex-col md:flex-row gap-6 md:gap-15 pt-6 md:pt-25 px-4 md:pr-20 md:pl-20'>
        {/* side navbar */}
        <div>
            <div className="flex flex-col items-center">
                <div className="relative">
                    <div className="w-30 h-30 rounded-full bg-slate-300 dark:bg-image-color"></div>

                    <div className="w-8 h-8 rounded-full bg-blue-600 flex justify-center items-center absolute bottom-1 left-22 text-white">
                        <FaCamera />
                    </div>
                </div>
            </div>

            <div className="text-center pr-1 pl-1 pt-5">
                <p className="font-bold">
                  {profile ? `${profile.fullname} ${profile.surname}` : "Loading..."}
                </p>
                <p className="text-slate-500 dark:text-gray-400">{profile?.email}</p>
            </div>

            <div className="flex flex-col gap-3 pt-10">

            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full h-12 rounded-full flex flex-row gap-3 items-center px-4 text-left transition-colors ${
                  activeTab === item.key
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-100 dark:hover:bg-hero-dark"
                }`}
              >
                <img src={item.icon} alt="" />
                <p className="font-bold">{item.label}</p>
              </button>
            ))}

        </div>
        </div>

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-line-color"></div>

        {/* main content */}
        <div className="flex-1 min-w-0">
          {loading && <p className="text-slate-500 dark:text-gray-400">Loading profile...</p>}
          {!loading && error && <p className="text-red-500">{error}</p>}

          {!loading && !error && profile && (
            <>
              {activeTab === "profile" && (
                <ProfileForm profile={profile} onUpdated={setProfile} />
              )}
              {activeTab === "preferences" && (
                <PreferencesForm profile={profile} onUpdated={setProfile} />
              )}
              {activeTab === "password" && <ChangePasswordForm />}
              {emptyStateCopy[activeTab] && (
                <EmptyState
                  icon={emptyStateCopy[activeTab].icon}
                  title={emptyStateCopy[activeTab].title}
                  description={emptyStateCopy[activeTab].description}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileAndSetting
