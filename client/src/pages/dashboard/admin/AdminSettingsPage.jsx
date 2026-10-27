import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Save, Moon, Sun, RefreshCw, Database } from "lucide-react";
import toast from "react-hot-toast";

export const AdminSettingsPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Settings saved (demo)");
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Admin Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          System-wide configuration and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Name</span>
            <span className="font-medium">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Role</span>
            <Badge variant="danger">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">Theme</span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              Switch to {theme === "dark" ? "Light" : "Dark"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-slate-500">MongoDB — connected</p>
              </div>
            </div>
            <Badge variant="success">Healthy</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Cache</p>
                <p className="text-xs text-slate-500">
                  Redis — optional for local dev
                </p>
              </div>
            </div>
            <Badge variant="warning">Optional</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button leftIcon={Save} onClick={handleSave} isLoading={saving}>
          Save Settings
        </Button>
      </div>
    </div>
  );
};
