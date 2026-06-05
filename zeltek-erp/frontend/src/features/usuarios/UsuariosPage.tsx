import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Key, Unlock, Shield, ShoppingBag, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';

type Rol = 'ADMIN' | 'VENDEDOR' | 'TECNICO';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
  ultimo_login: string | null;
  created_at: string;
}

const ROL_LABELS: Record<Rol, string> = {
  ADMIN: 'Admin',
  VENDEDOR: 'Vendedor',
  TECNICO: 'Técnico',
};

const ROL_COLORS: Record<Rol, string> = {
  ADMIN: 'bg-violet-600/20 text-violet-300',
  VENDEDOR: 'bg-blue-500/10 text-blue-400',
  TECNICO: 'bg-amber-500/10 text-amber-400',
};

const ROL_ICONS: Record<Rol, React.ReactNode> = {
  ADMIN: <Shield size={12} />,
  VENDEDOR: <ShoppingBag size={12} />,
  TECNICO: <Wrench size={12} />,
};

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esBloqueado(u: Usuario) {
  return u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date();
}

// ─── Formulario crear usuario ─────────────────────────────────────────────────

function FormCrearUsuario({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<Rol>('VENDEDOR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !email || !password) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/usuarios', { nombre, email, password, rol });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Nombre completo <span className="text-danger">*</span></label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="ej. María López"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Email <span className="text-danger">*</span></label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="usuario@zeltek.com"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Contraseña inicial <span className="text-danger">*</span></label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        <p className="text-slate-600 text-xs mt-1">El usuario podrá cambiarla después</p>
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Rol</label>
        <div className="grid grid-cols-3 gap-2">
          {(['ADMIN', 'VENDEDOR', 'TECNICO'] as Rol[]).map(r => (
            <button key={r} type="button" onClick={() => setRol(r)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm transition-colors ${
                rol === r ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-slate-700 text-slate-500 hover:border-slate-500'
              }`}>
              {ROL_ICONS[r]}
              {ROL_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!nombre || !email || !password || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

// ─── Modal editar usuario ─────────────────────────────────────────────────────

function FormEditarUsuario({
  usuario,
  onClose,
  onSuccess,
}: {
  usuario: Usuario;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [activo, setActivo] = useState(usuario.activo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.patch(`/usuarios/${usuario.id}`, { nombre, rol, activo });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Rol</label>
        <div className="grid grid-cols-3 gap-2">
          {(['ADMIN', 'VENDEDOR', 'TECNICO'] as Rol[]).map(r => (
            <button key={r} type="button" onClick={() => setRol(r)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm transition-colors ${
                rol === r ? 'border-violet-500 bg-violet-600/10 text-violet-300' : 'border-slate-700 text-slate-500 hover:border-slate-500'
              }`}>
              {ROL_ICONS[r]}
              {ROL_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <div onClick={() => setActivo(v => !v)}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${activo ? 'bg-success' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-slate-300 text-sm">{activo ? 'Usuario activo' : 'Usuario inactivo'}</span>
      </label>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ─── Modal reset password ─────────────────────────────────────────────────────

function FormResetPassword({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/usuarios/${usuario.id}/cambiar-password`, { nueva_password: password });
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="text-center py-4 space-y-3">
      <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
        <Key size={20} className="text-success" />
      </div>
      <p className="text-slate-100 font-medium">Contraseña cambiada</p>
      <p className="text-slate-500 text-sm">Las sesiones activas de {usuario.nombre} fueron cerradas.</p>
      <button onClick={onClose} className="px-6 py-2 rounded-xl bg-violet-600 text-white text-sm">Cerrar</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-slate-400 text-sm">
        Establecer nueva contraseña para <span className="text-slate-200 font-medium">{usuario.nombre}</span>.
        Sus sesiones activas serán cerradas.
      </p>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Nueva contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={password.length < 6 || loading}
          className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCrear, setModalCrear] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [resetPwd, setResetPwd] = useState<Usuario | null>(null);
  const [desbloqueando, setDesbloqueando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Usuario[] }>('/usuarios');
      setUsuarios(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function desbloquear(u: Usuario) {
    setDesbloqueando(u.id);
    try {
      await api.post(`/usuarios/${u.id}/desbloquear`);
      cargar();
    } finally {
      setDesbloqueando(null);
    }
  }

  const activos = usuarios.filter(u => u.activo).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Usuarios</h1>
          <p className="text-slate-500 text-sm mt-0.5">{activos} activos de {usuarios.length} registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando usuarios...</div>
      ) : (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border">
            {usuarios.map(u => {
              const bloqueado = esBloqueado(u);
              return (
                <div key={u.id} className={`flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/20 transition-colors ${!u.activo ? 'opacity-50' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    u.activo ? 'bg-violet-600/20 text-violet-300' : 'bg-slate-700 text-slate-500'
                  }`}>
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-100 text-sm font-medium">{u.nombre}</p>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROL_COLORS[u.rol]}`}>
                        {ROL_ICONS[u.rol]} {ROL_LABELS[u.rol]}
                      </span>
                      {bloqueado && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-danger/10 text-danger">Bloqueado</span>
                      )}
                      {!u.activo && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-500">Inactivo</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{u.email}</p>
                  </div>

                  {/* Último login */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-slate-600 text-xs">Último acceso</p>
                    <p className="text-slate-500 text-xs">{fmtFecha(u.ultimo_login)}</p>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    {bloqueado && (
                      <button onClick={() => desbloquear(u)} disabled={desbloqueando === u.id}
                        title="Desbloquear usuario"
                        className="p-1.5 rounded-lg text-warning hover:bg-warning/10 transition-colors">
                        <Unlock size={14} />
                      </button>
                    )}
                    <button onClick={() => setResetPwd(u)}
                      title="Cambiar contraseña"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                      <Key size={14} />
                    </button>
                    <button onClick={() => setEditando(u)}
                      className="px-3 py-1.5 rounded-lg border border-app-border text-slate-400 hover:text-slate-100 text-xs transition-colors">
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={modalCrear} onClose={() => setModalCrear(false)} title="Nuevo usuario">
        <FormCrearUsuario onClose={() => setModalCrear(false)} onSuccess={cargar} />
      </Modal>

      <Modal open={!!editando} onClose={() => setEditando(null)} title={editando ? `Editar — ${editando.nombre}` : ''}>
        {editando && (
          <FormEditarUsuario usuario={editando} onClose={() => setEditando(null)} onSuccess={cargar} />
        )}
      </Modal>

      <Modal open={!!resetPwd} onClose={() => setResetPwd(null)} title="Cambiar contraseña">
        {resetPwd && <FormResetPassword usuario={resetPwd} onClose={() => setResetPwd(null)} />}
      </Modal>
    </div>
  );
}
