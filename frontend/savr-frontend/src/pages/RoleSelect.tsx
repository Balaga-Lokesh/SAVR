import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const RoleSelect: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6 text-center">Who is logging in?</h2>
        <div className="space-y-3">
          <Button className="w-full" onClick={() => { sessionStorage.setItem('auth_role', 'user'); navigate('/login'); }}>I'm a User</Button>
          <Button className="w-full" variant="outline" onClick={() => { sessionStorage.setItem('auth_role', 'admin'); navigate('/admin/login'); }}>I'm an Admin</Button>
          <Button className="w-full" variant="ghost" onClick={() => { sessionStorage.setItem('auth_role', 'agent'); navigate('/agent/login'); }}>I'm a Delivery Partner</Button>
        </div>
  <p className="text-xs text-muted-foreground mt-4">Admins and partners must be provisioned by the main admin. Public signup is for regular users only.</p>
      </div>
    </div>
  );
};

export default RoleSelect;
