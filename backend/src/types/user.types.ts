export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
}
