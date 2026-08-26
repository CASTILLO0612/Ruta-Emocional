import { apiRequest } from '../services/apiClient';
import { User } from '../models/User';

export async function upsertUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    await apiRequest('/auth/register', 'POST', user);
  } catch (error) {
    throw new Error(`Error al guardar usuario: ${error}`);
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await apiRequest<User>(`/users/${userId}`, 'GET');
    return user;
  } catch (error) {
    return null;
  }
}
