export type UserRole = "VIEWER" | "OPERATOR" | "ADMIN";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}