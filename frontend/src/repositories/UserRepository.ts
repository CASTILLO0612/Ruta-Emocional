import { apiRequest } from '../services/apiClient';
import { User } from '../models/User';

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await apiRequest<User>(`/users/${userId}`, 'GET');
    return user;
  } catch (error) {
    return null;
  }
}
