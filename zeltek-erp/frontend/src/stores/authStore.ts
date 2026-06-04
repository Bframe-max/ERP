import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'VENDEDOR' | 'TECNICO';
}

interface AuthStore {
  usuario: UsuarioSesion | null;
  setUsuario: (usuario: UsuarioSesion | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      usuario: null,
      setUsuario: (usuario) => set({ usuario }),
      logout: () => set({ usuario: null }),
    }),
    {
      name: 'zeltek-auth',
      partialize: (state) => ({ usuario: state.usuario }),
    },
  ),
);
