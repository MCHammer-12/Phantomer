import { useEffect, useState } from "react";
import { Moon, Sun, Settings, UserPlus, Trash2, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SettingSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [users, setUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState<string>("");

  const USERS_KEY = "tc_users";
  const CURRENT_USER_KEY = "tc_current_user";

  // useEffect only runs on the client, so we check for mounting before rendering
  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      if (Array.isArray(saved)) setUsers(saved);
      const cur = localStorage.getItem(CURRENT_USER_KEY);
      if (cur) setCurrentUser(cur);
    } catch {
      // ignore
    }
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const saveUsers = (list: string[]) => {
    setUsers(list);
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  };

  const addUser = () => {
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    if (users.includes(trimmed)) {
      setNewUserName("");
      return;
    }
    const next = [...users, trimmed];
    saveUsers(next);
    setNewUserName("");
  };

  const removeUser = (name: string) => {
    const next = users.filter((u) => u !== name);
    saveUsers(next);
    if (currentUser === name) {
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_KEY);
      window.dispatchEvent(new CustomEvent("tc_user_changed", { detail: null }));
    }
  };

  const chooseUser = (name: string) => {
    setCurrentUser(name);
    localStorage.setItem(CURRENT_USER_KEY, name);
    // Notify listeners (Dashboard) to refetch
    window.dispatchEvent(new CustomEvent("tc_user_changed", { detail: name }));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center space-x-2">
            <Sun className="h-4 w-4" />
            <Label htmlFor="theme-toggle">Dark mode</Label>
            <Moon className="h-4 w-4" />
          </div>
          <Switch 
            id="theme-toggle"
            checked={theme === "dark"}
            onCheckedChange={(checked) => {
              setTheme(checked ? "dark" : "light");
            }}
          />
        </div>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Users
        </div>

        {/* Existing users list */}
        <div className="max-h-52 overflow-auto px-2 pb-1">
          {users.length === 0 ? (
            <div className="text-xs text-muted-foreground px-1 py-1">No users yet</div>
          ) : (
            users.map((u) => (
              <div key={u} className="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-muted/50">
                <button
                  className="flex items-center gap-2 text-sm"
                  onClick={() => chooseUser(u)}
                  title={`Switch to ${u}`}
                >
                  {currentUser === u ? <Check className="h-3.5 w-3.5" /> : <span className="inline-block w-3.5" />}
                  <span className={currentUser === u ? "font-semibold underline" : ""}>{u}</span>
                </button>
                <button
                  className="opacity-70 hover:opacity-100"
                  onClick={() => removeUser(u)}
                  title={`Remove ${u}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add user inline */}
        <div className="flex items-center gap-2 px-2 pb-2">
          <input
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Add user (e.g., Michael)"
            className="flex-1 px-2 py-1 rounded-md bg-background border border-border text-sm"
          />
          <Button size="sm" variant="secondary" onClick={addUser} title="Add user">
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { SettingSelect as ThemeToggle };