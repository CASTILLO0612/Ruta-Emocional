export interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phone?: string;
  role: 'patient' | 'psychologist';
  createdAt: Date;
  updatedAt: Date;
}
