export type AuthUser = {
  id: number;
  username: string;
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  status: number;
  api_enabled: number;
  rol: string | null;
  permissions?: {
    can_sales: boolean;
    can_warehouse: boolean;
    can_cxc: boolean;
    can_edit_ml_facturacion: boolean;
  };
};

export type LoginResponse = {
  ok: boolean;
  token_type: string;
  access_token: string;
  user: AuthUser;
};

export type MeResponse = {
  ok: boolean;
  user: AuthUser;
};
