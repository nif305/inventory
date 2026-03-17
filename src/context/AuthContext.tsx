'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { User, AppRole, AppStatus } from '@/features/auth/types/auth.types';
import { mockUsers } from '@/data/mock/users.mock';

interface UserUpdateInput {
  fullName?: string;
  email?: string;
  mobile?: string;
  extension?: string;
  department?: string;
  jobTitle?: string;
  operationalProject?: string;
  role?: AppRole;
  status?: AppStatus;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  allUsers: User[];
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  activateUser: (userId: string) => void;
  disableUser: (userId: string) => void;
  archiveUser: (userId: string) => void;
  changeUserRole: (userId: string, role: AppRole) => void;
  updateUserProfile: (userId: string, updates: UserUpdateInput) => { ok: boolean; message?: string };
  resetUserPassword: (
    userId: string,
    newPassword?: string
  ) => { ok: boolean; password?: string; message?: string };
  setUserMustChangePassword: (userId: string, value: boolean) => { ok: boolean; message?: string };
  switchViewRole: (role: 'manager' | 'warehouse' | 'user') => void;
  resetViewRole: () => void;
  originalUser: User | null;
  canUseRoleSwitch: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'inventory_users';
const CURRENT_USER_STORAGE_KEY = 'current_user';
const VIEW_ROLE_STORAGE_KEY = 'current_view_role';

const CORE_USERS: User[] = [
  {
    id: 'manager-naif',
    employeeId: 'NAUSS-001',
    fullName: 'نايف الشهراني',
    email: 'Nalshahrani@nauss.edu.sa',
    mobile: '0568122221',
    extension: '4483',
    department: 'إدارة عمليات التدريب',
    jobTitle: 'مدير إدارة عمليات التدريب',
    operationalProject: 'لا ينطبق',
    role: 'manager',
    status: 'active',
    avatar: null,
    undertaking: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    password: 'Zx.321321',
    passwordUpdatedAt: new Date().toISOString(),
    mustChangePassword: false,
  },
  {
    id: 'warehouse-nmuharib',
    employeeId: 'NAUSS-002',
    fullName: 'نواف المحارب',
    email: 'nmuharib@nauss.edu.sa',
    mobile: '0500000000',
    extension: '4483',
    department: 'المستودع',
    jobTitle: 'مسؤول المستودع',
    operationalProject: 'لا ينطبق',
    role: 'warehouse',
    status: 'active',
    avatar: null,
    undertaking: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    password: 'admin123',
    passwordUpdatedAt: new Date().toISOString(),
    mustChangePassword: false,
  },
];

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function generateTemporaryPassword() {
  const suffix = Math.random().toString(36).slice(-4).toUpperCase();
  return `Inv@${new Date().getFullYear()}${suffix}`;
}

function ensureUserShape(users: User[]): User[] {
  return users.map((user, index) => ({
    ...user,
    employeeId: user.employeeId || `EMP-${index + 1}`,
    fullName: user.fullName || 'مستخدم النظام',
    email: user.email || `user${index + 1}@nauss.edu.sa`,
    mobile: user.mobile || '',
    extension: user.extension || '',
    department: user.department || '',
    jobTitle: user.jobTitle || '',
    operationalProject: user.operationalProject || '',
    role: user.role || 'user',
    status: user.status || 'active',
    avatar: user.avatar ?? null,
    undertaking: user.undertaking || {
      accepted: true,
      acceptedAt: new Date().toISOString(),
    },
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || null,
    password: normalizeText(user.password) || `Pass@${String(index + 1).padStart(3, '0')}`,
    passwordUpdatedAt: user.passwordUpdatedAt || null,
    mustChangePassword: user.mustChangePassword ?? false,
  }));
}

function getSeedUsers(): User[] {
  return ensureUserShape(mockUsers as User[]);
}

function buildNormalizedUsers(storedUsers: User[] = []) {
  const seeds = getSeedUsers();
  const nonCoreStored = ensureUserShape(storedUsers).filter(
    (user) =>
      !CORE_USERS.some(
        (core) =>
          core.id === user.id || normalizeEmail(core.email) === normalizeEmail(user.email)
      )
  );

  const nonCoreSeeds = seeds.filter(
    (user) =>
      !CORE_USERS.some(
        (core) =>
          core.id === user.id || normalizeEmail(core.email) === normalizeEmail(user.email)
      ) &&
      !nonCoreStored.some(
        (stored) =>
          stored.id === user.id || normalizeEmail(stored.email) === normalizeEmail(user.email)
      )
  );

  return ensureUserShape([...CORE_USERS, ...nonCoreStored, ...nonCoreSeeds]);
}

function loadUsers(): User[] {
  if (typeof window === 'undefined') {
    return buildNormalizedUsers([]);
  }

  const raw = localStorage.getItem(USERS_STORAGE_KEY);

  if (!raw) {
    const users = buildNormalizedUsers([]);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return users;
  }

  try {
    const parsed = JSON.parse(raw) as User[];
    const users = buildNormalizedUsers(parsed);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return users;
  } catch {
    const users = buildNormalizedUsers([]);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return users;
  }
}

function saveUsers(users: User[]) {
  const normalized = buildNormalizedUsers(users);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(normalized));
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function applySessionCookies(user: User) {
  setCookie('inventory_platform_session', 'active');
  setCookie('user_id', user.id || '');
  setCookie('user_role', user.role || '');
  setCookie('user_status', user.status || '');
  setCookie('user_email', normalizeEmail(user.email));
  setCookie('user_name', user.fullName || '');
  setCookie('user_department', user.department || '');
  setCookie('user_employee_id', user.employeeId || '');
}

function clearSessionCookies() {
  clearCookie('inventory_platform_session');
  clearCookie('user_id');
  clearCookie('user_role');
  clearCookie('user_status');
  clearCookie('user_email');
  clearCookie('user_name');
  clearCookie('user_department');
  clearCookie('user_employee_id');
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const syncCurrentUserFromUsers = useCallback((users: User[]) => {
    const storedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);

    if (!storedUser) {
      setUser(null);
      setOriginalUser(null);
      clearSessionCookies();
      return null;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      const updatedUser = users.find((u) => u.id === parsedUser.id) || null;

      if (!updatedUser || updatedUser.status !== 'active') {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
        clearSessionCookies();
        setUser(null);
        setOriginalUser(null);
        return null;
      }

      const storedViewRole = localStorage.getItem(VIEW_ROLE_STORAGE_KEY) as AppRole | null;

      const allowedViewRole =
        updatedUser.role === 'manager'
          ? storedViewRole === 'manager' || storedViewRole === 'user'
            ? storedViewRole
            : null
          : updatedUser.role === 'warehouse'
          ? storedViewRole === 'warehouse' || storedViewRole === 'user'
            ? storedViewRole
            : null
          : null;

      setOriginalUser(updatedUser);

      const sessionUser = allowedViewRole
        ? ({ ...updatedUser, role: allowedViewRole } as User)
        : updatedUser;

      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(sessionUser);
      applySessionCookies(sessionUser);
      return sessionUser;
    } catch {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
      clearSessionCookies();
      setUser(null);
      setOriginalUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const users = loadUsers();
    setAllUsers(users);
    syncCurrentUserFromUsers(users);
    setIsLoading(false);
  }, [syncCurrentUserFromUsers]);

  const updateUsersState = useCallback(
    (updater: (users: User[]) => User[]) => {
      const currentUsers = loadUsers();
      const nextUsers = ensureUserShape(updater(currentUsers));
      saveUsers(nextUsers);
      const reloaded = loadUsers();
      setAllUsers(reloaded);
      syncCurrentUserFromUsers(reloaded);
      return reloaded;
    },
    [syncCurrentUserFromUsers]
  );

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);

    try {
      const users = loadUsers();
      setAllUsers(users);

      const normalizedIdentifier = normalizeEmail(identifier);
      const enteredPassword = normalizeText(password);

      if (!normalizedIdentifier) {
        throw new Error('يرجى إدخال البريد الإلكتروني');
      }

      if (!enteredPassword) {
        throw new Error('يرجى إدخال كلمة المرور');
      }

      const foundUser = users.find(
        (u) =>
          normalizeEmail(u.email) === normalizedIdentifier ||
          normalizeText(u.employeeId).toLowerCase() === normalizedIdentifier
      );

      if (!foundUser) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      if (foundUser.status === 'pending') throw new Error('الحساب قيد المراجعة');
      if (foundUser.status === 'rejected') throw new Error('تم رفض طلب هذا المستخدم');
      if (foundUser.status === 'disabled') throw new Error('الحساب موقوف');
      if (foundUser.status === 'archived') throw new Error('الحساب مؤرشف');

      if (normalizeText(foundUser.password) !== enteredPassword) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      const updatedUsers = users.map((u) =>
        u.id === foundUser.id ? { ...u, lastLoginAt: new Date().toISOString() } : u
      );

      saveUsers(updatedUsers);

      const reloaded = loadUsers();
      const activeUser = reloaded.find((u) => u.id === foundUser.id) || foundUser;

      setAllUsers(reloaded);
      localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
      setOriginalUser(activeUser);
      applySessionCookies(activeUser);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(activeUser));
      setUser(activeUser);

      window.location.replace('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveUser = useCallback(
    (userId: string) => {
      updateUsersState((users) =>
        users.map((u) => (u.id === userId ? { ...u, status: 'active' as AppStatus } : u))
      );
    },
    [updateUsersState]
  );

  const rejectUser = useCallback(
    (userId: string) => {
      updateUsersState((users) =>
        users.map((u) => (u.id === userId ? { ...u, status: 'rejected' as AppStatus } : u))
      );
    },
    [updateUsersState]
  );

  const activateUser = useCallback(
    (userId: string) => {
      updateUsersState((users) =>
        users.map((u) => (u.id === userId ? { ...u, status: 'active' as AppStatus } : u))
      );
    },
    [updateUsersState]
  );

  const disableUser = useCallback(
    (userId: string) => {
      updateUsersState((users) => {
        const managers = users.filter((u) => u.role === 'manager' && u.status === 'active');

        return users.map((u) => {
          if (u.id !== userId) return u;
          if (u.role === 'manager' && managers.length <= 1) return u;
          return { ...u, status: 'disabled' as AppStatus };
        });
      });
    },
    [updateUsersState]
  );

  const archiveUser = useCallback(
    (userId: string) => {
      updateUsersState((users) => {
        const managers = users.filter((u) => u.role === 'manager' && u.status === 'active');

        return users.map((u) => {
          if (u.id !== userId) return u;
          if (u.role === 'manager' && managers.length <= 1) return u;
          return { ...u, status: 'archived' as AppStatus };
        });
      });
    },
    [updateUsersState]
  );

  const changeUserRole = useCallback(
    (userId: string, role: AppRole) => {
      updateUsersState((users) => {
        const activeManagers = users.filter((u) => u.role === 'manager' && u.status === 'active');

        return users.map((u) => {
          if (u.id !== userId) return u;
          if (u.role === 'manager' && role !== 'manager' && activeManagers.length <= 1) return u;
          return { ...u, role };
        });
      });
    },
    [updateUsersState]
  );

  const updateUserProfile = useCallback(
    (userId: string, updates: UserUpdateInput) => {
      const users = loadUsers();
      const currentUser = users.find((u) => u.id === userId);

      if (!currentUser) {
        return { ok: false, message: 'المستخدم غير موجود' };
      }

      const normalizedEmail = normalizeText(updates.email || currentUser.email || '');
      const duplicatedEmail = users.find(
        (u) => u.id !== userId && normalizeEmail(u.email) === normalizeEmail(normalizedEmail)
      );

      if (duplicatedEmail) {
        return { ok: false, message: 'البريد الإلكتروني مستخدم من حساب آخر' };
      }

      updateUsersState((state) =>
        state.map((u) =>
          u.id === userId
            ? {
                ...u,
                fullName: normalizeText(updates.fullName) || u.fullName,
                email: normalizedEmail || u.email,
                mobile: updates.mobile?.trim() ?? u.mobile,
                extension: updates.extension?.trim() ?? u.extension,
                department: normalizeText(updates.department) || u.department,
                jobTitle: updates.jobTitle?.trim() ?? u.jobTitle,
                operationalProject: updates.operationalProject?.trim() ?? u.operationalProject,
                role: updates.role || u.role,
                status: updates.status || u.status,
              }
            : u
        )
      );

      return { ok: true };
    },
    [updateUsersState]
  );

  const resetUserPassword = useCallback(
    (userId: string, newPassword?: string) => {
      const users = loadUsers();
      const currentUser = users.find((u) => u.id === userId);

      if (!currentUser) {
        return { ok: false, message: 'المستخدم غير موجود' };
      }

      const nextPassword = normalizeText(newPassword) || generateTemporaryPassword();

      if (nextPassword.length < 6) {
        return { ok: false, message: 'كلمة المرور الجديدة قصيرة جدًا' };
      }

      updateUsersState((state) =>
        state.map((u) =>
          u.id === userId
            ? {
                ...u,
                password: nextPassword,
                passwordUpdatedAt: new Date().toISOString(),
                mustChangePassword: true,
              }
            : u
        )
      );

      return { ok: true, password: nextPassword };
    },
    [updateUsersState]
  );

  const setUserMustChangePassword = useCallback(
    (userId: string, value: boolean) => {
      const users = loadUsers();
      const currentUser = users.find((u) => u.id === userId);

      if (!currentUser) {
        return { ok: false, message: 'المستخدم غير موجود' };
      }

      updateUsersState((state) =>
        state.map((u) =>
          u.id === userId
            ? {
                ...u,
                mustChangePassword: value,
              }
            : u
        )
      );

      return { ok: true };
    },
    [updateUsersState]
  );

  const switchViewRole = useCallback(
    (role: 'manager' | 'warehouse' | 'user') => {
      const baseStoredUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (!baseStoredUser) return;

      const baseUser = JSON.parse(baseStoredUser) as User;

      const canSwitch =
        (baseUser.role === 'manager' && (role === 'manager' || role === 'user')) ||
        (baseUser.role === 'warehouse' && (role === 'warehouse' || role === 'user'));

      if (!canSwitch) return;

      const switchedUser = { ...baseUser, role } as User;

      localStorage.setItem(VIEW_ROLE_STORAGE_KEY, role);
      setOriginalUser(baseUser);
      setUser(switchedUser);
      applySessionCookies(switchedUser);
      router.replace('/dashboard');
    },
    [router]
  );

  const resetViewRole = useCallback(() => {
    const baseStoredUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!baseStoredUser) return;

    const baseUser = JSON.parse(baseStoredUser) as User;
    localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
    setOriginalUser(baseUser);
    setUser(baseUser);
    applySessionCookies(baseUser);
    router.replace('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    setIsLoading(true);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
    clearSessionCookies();
    setUser(null);
    setOriginalUser(null);
    window.location.replace('/login');
  }, []);

  const canUseRoleSwitch = useMemo(() => {
    if (!originalUser || originalUser.status !== 'active') return false;
    return originalUser.role === 'manager' || originalUser.role === 'warehouse';
  }, [originalUser]);

  const canManageUsers = useMemo(() => {
    return originalUser?.role === 'manager' && originalUser?.status === 'active';
  }, [originalUser]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
        جاري التحميل...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        allUsers,
        approveUser,
        rejectUser,
        activateUser,
        disableUser,
        archiveUser,
        changeUserRole,
        updateUserProfile,
        resetUserPassword,
        setUserMustChangePassword,
        switchViewRole,
        resetViewRole,
        originalUser,
        canUseRoleSwitch,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};