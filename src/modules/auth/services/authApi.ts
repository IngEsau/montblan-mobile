import { apiRequest } from '../../../shared/api/http';
import { LoginResponse, MeResponse } from '../types';

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
  me: (token: string) =>
    apiRequest<MeResponse>('/auth/me', {
      token,
    }),
};
