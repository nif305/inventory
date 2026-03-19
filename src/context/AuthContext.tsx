'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Role = 'manager' | 'warehouse' | 'user';
type Status = 'active' | 'disabled';

export type AppUser = {
  id: string;
  employeeId?: string;
  fullName: string;
  email: string;
  mobile?: string;
  extension?: string;
  department?: string;
  jobTitle?: string;
  operationalProject?: string;
  role: Role;
  status: Status;
  avatar?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  mustChangePassword?: boolean;
};

type LoginResponse = {
  data?: AppUser;
  error?: string;
};

type AuthContextType = {
  user: AppUser | null;
  originalUser: AppUser | null;
  allUsers: AppUser[];
  loading: boolean;
  isAuthenticated: boolean;
  canUseRoleSwitch: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
  switchViewRole: (role: Role) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'inventory-auth-user';
const AUTH_ORIGINAL_STORAGE_KEY = 'inventory-auth-original-user';

function normalizeRole(role?: string | null): Role {
  const value = (role || '').toLowerCase();
  if (value === 'manager') return 'manager';
  if (value === 'warehouse') return 'warehouse';
  return 'user';
}

function normalizeStatus(status?: string | null): Status {
  const value = (status || '').toLowerCase();
  if (value === 'disabled') return 'disabled';
  return 'active';
}

function normalizeUser(user: any): AppUser {
  return {
    id: user?.id || '',
    employeeId: user?.employeeId || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    extension: user?.extension || '',
    department: user?.department || '',
    jobTitle: user?.jobTitle || '',
    operationalProject: user?.operationalProject || user?.department || '',
    role: normalizeRole(user?.role),
    status: normalizeStatus(user?.status),
    avatar: user?.avatar || null,
    createdAt: user?.createdAt || null,
    lastLoginAt: user?.lastLoginAt || null,
    mustChangePassword: !!user?.mustChangePassword,
  };
}

function saveAuthUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function saveOriginalAuthUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    localStorage.removeItem(AUTH_ORIGINAL_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_ORIGINAL_STORAGE_KEY, JSON.stringify(user));
}

function loadStoredUser(key: string): AppUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [originalUser, setOriginalUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const rows = Array.isArray(json?.data) ? json.data.map(normalizeUser) : [];
      setAllUsers(rows);
    } catch {
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    const storedUser = loadStoredUser(AUTH_STORAGE_KEY);
    const storedOriginalUser = loadStoredUser(AUTH_ORIGINAL_STORAGE_KEY);

    if (storedUser) {
      setUser(storedUser);
    }

    if (storedOriginalUser) {
      setOriginalUser(storedOriginalUser);
    } else if (storedUser) {
      setOriginalUser(storedUser);
      saveOriginalAuthUser(storedUser);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      refreshUsers();
    }
  }, [user, refreshUsers]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json: LoginResponse = await res.json().catch(() => ({
      error: 'تعذر تسجيل الدخول',
    }));

    if (!res.ok || !json?.data) {
      throw new Error(json?.error || 'تعذر تسجيل الدخول');
    }

    const normalized = normalizeUser(json.data);

    if (normalized.status === 'disabled') {
      throw new Error('الحساب موقوف. يرجى التواصل مع المدير.');
    }

    setUser(normalized);
    setOriginalUser(normalized);
    saveAuthUser(normalized);
    saveOriginalAuthUser(normalized);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setOriginalUser(null);
    setAllUsers([]);
    saveAuthUser(null);
    saveOriginalAuthUser(null);
    window.location.href = '/login';
  }, []);

  const switchViewRole = useCallback(
    (role: Role) => {
      if (!originalUser) return;

      const allowed =
        (originalUser.role === 'manager' && (role === 'manager' || role === 'user')) ||
        (originalUser.role === 'warehouse' && (role === 'warehouse' || role === 'user'));

      if (!allowed) return;

      const nextUser = { ...originalUser, role };
      setUser(nextUser);
      saveAuthUser(nextUser);
    },
    [originalUser]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      originalUser,
      allUsers,
      loading,
      isAuthenticated: !!user,
      canUseRoleSwitch:
        originalUser?.role === 'manager' || originalUser?.role === 'warehouse',
      login,
      logout,
      refreshUsers,
      switchViewRole,
    }),
    [user, originalUser, allUsers, loading, login, logout, refreshUsers, switchViewRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}