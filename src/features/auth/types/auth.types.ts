export type AppRole = 'manager' | 'warehouse' | 'user';
export type AppStatus = 'active' | 'pending' | 'disabled' | 'rejected' | 'archived';

export interface UndertakingState {
  accepted: boolean;
  acceptedAt?: string | null;
}

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobile?: string;
  extension?: string;
  department: string;
  jobTitle?: string;
  operationalProject?: string;
  role: AppRole;
  status: AppStatus;
  avatar?: string | null;
  undertaking: UndertakingState;
  createdAt?: string;
  lastLoginAt?: string | null;
  password?: string;
  passwordUpdatedAt?: string | null;
  mustChangePassword?: boolean;
}

export interface Session {
  token: string;
  user: User;
}