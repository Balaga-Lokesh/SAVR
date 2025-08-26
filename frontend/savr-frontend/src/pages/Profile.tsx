// src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, LogOut, Settings, User } from "lucide-react";

interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  contact_number: string;
  default_address?: {
    id: number;
    label: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    is_default: boolean;
  } | null;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("mfaVerified");
    sessionStorage.removeItem("temp_token");
    sessionStorage.removeItem("otp_dest");
    navigate("/login");
  };

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/v1/auth/me/", {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  if (loading) return <p className="p-4">Loading profile...</p>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        <User className="h-7 w-7" /> Your Profile
      </h1>
      <p className="text-muted-foreground mb-6">
        Manage your account, addresses and preferences.
      </p>

      {profile && (
        <div className="mb-6 space-y-2">
          <div><span className="font-semibold">Username:</span> {profile.username}</div>
          <div><span className="font-semibold">Email:</span> {profile.email}</div>
          <div><span className="font-semibold">Contact:</span> {profile.contact_number}</div>
          {profile.default_address && (
            <div>
              <span className="font-semibold">Default Address:</span>{" "}
              {profile.default_address.line1}, {profile.default_address.city} -{" "}
              {profile.default_address.pincode}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 flex flex-col gap-3">
          <div className="font-semibold">Addresses</div>
          <p className="text-sm text-muted-foreground">
            Add or update delivery addresses used at checkout.
          </p>
          <Button onClick={() => navigate("/addresses")} className="w-fit" variant="secondary">
            <MapPin className="h-4 w-4 mr-2" />
            Manage Addresses
          </Button>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="font-semibold">Preferences</div>
          <p className="text-sm text-muted-foreground">
            Coming soon: notifications, payment methods, and more.
          </p>
          <Button disabled className="w-fit">
            <Settings className="h-4 w-4 mr-2" />
            Edit Preferences
          </Button>
        </Card>

        <Card className="p-4 flex items-center justify-between md:col-span-2">
          <div>
            <div className="font-semibold">Sign out</div>
            <p className="text-sm text-muted-foreground">
              You’ll need to log in again next time.
            </p>
          </div>
          <Button variant="destructive" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
