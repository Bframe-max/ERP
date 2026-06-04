import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './presentation/routes/auth.routes';
import inboxRoutes from './presentation/routes/inbox.routes';
import equiposRoutes from './presentation/routes/equipos.routes';
import ventasRoutes from './presentation/routes/ventas.routes';
import clientesRoutes from './presentation/routes/clientes.routes';
import inversoresRoutes from './presentation/routes/inversores.routes';
import gastosRoutes from './presentation/routes/gastos.routes';
import reparacionesRoutes from './presentation/routes/reparaciones.routes';
import accesoriosRoutes from './presentation/routes/accesorios.routes';
import productosRoutes from './presentation/routes/productos.routes';
import usuariosRoutes from './presentation/routes/usuarios.routes';
import settingsRoutes from './presentation/routes/settings.routes';
import reportesRoutes from './presentation/routes/reportes.routes';
import dashboardRoutes from './presentation/routes/dashboard.routes';
import auditRoutes from './presentation/routes/audit.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS — solo el dominio del frontend
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting global: 100 req/IP/15min
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta en 15 minutos.' },
});
app.use(globalLimiter);

// Body parsing — límite 10MB (para fotos comprimidas)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '1.0.0', sistema: 'ZELTEK ERP' } });
});

// Rutas API v1
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/inbox`, inboxRoutes);
app.use(`${API}/equipos`, equiposRoutes);
app.use(`${API}/ventas`, ventasRoutes);
app.use(`${API}/clientes`, clientesRoutes);
app.use(`${API}/inversores`, inversoresRoutes);
app.use(`${API}/gastos`, gastosRoutes);
app.use(`${API}/reparaciones`, reparacionesRoutes);
app.use(`${API}/accesorios`, accesoriosRoutes);
app.use(`${API}/productos`, productosRoutes);
app.use(`${API}/usuarios`, usuariosRoutes);
app.use(`${API}/settings`, settingsRoutes);
app.use(`${API}/reportes`, reportesRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/audit-logs`, auditRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
});

// Error handler global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

export default app;
