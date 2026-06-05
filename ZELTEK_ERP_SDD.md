# ZELTEK ERP — Software Design Document (SDD) v2.5

> **DOCUMENTO MAESTRO** — Fuente única de verdad para todo el desarrollo.
> Autor: Denzel — Zeltek Nicaragua | Managua, Nicaragua | 2026
> Stack: React 18 + TypeScript | Node.js + Express | PostgreSQL + Prisma
> Arquitectura: Clean Architecture + Domain-Driven Design (DDD)

---

## REGLA #1 DEL PROYECTO

**Todo código debe respetar este documento.** Antes de escribir cualquier componente, endpoint, migración o función:

1. Verificar que la funcionalidad está definida en este SDD.
2. Respetar las reglas de negocio (prefijo RN-).
3. Usar los tokens de diseño de la sección 9.
4. Seguir la estructura del monorepo definida en la sección 3.
5. Registrar toda acción en audit_logs.

---

## LOS 13 PILARES DEL SISTEMA

| # | Pilar | Qué resuelve |
|---|-------|-------------|
| 1 | Bandeja de Entrada | Gmail → Google Apps Script → triage móvil sin API de eBay |
| 2 | Máquina de Estados | 8 estados del equipo con transiciones estrictas |
| 3 | Fórmula CTR | Costo Total Real calculado en backend con tarifas configurables |
| 4 | Checkout Blindado | Venta con foto obligatoria, factura PDF, garantía automática |
| 5 | Auth y Seguridad | Cookies HttpOnly, doble token, roles y bloqueo temporal |
| 6 | Capitales e Inversores | Cuentas de capital, pérdidas y reintegros independientes por socio |
| 7 | OPEX en Dos Monedas | Gastos operativos USD/NIO con conversión automática |
| 8 | Reparaciones y Taller | Órdenes de servicio técnico externo y reparaciones por garantía |
| 9 | Accesorios y Lotes | Inventario de cargadores y regalías, lotes y asignación a equipos |
| 10| Reportes Financieros | Estado de cuenta PDF por socio, Excel/CSV y P&L Statement mensual |
| 11| Productos (Catálogo) | Catálogo maestro de modelos para auto-rellenar especificaciones |
| 12| Usuarios y Configuración | Gestión de usuarios/roles y panel de settings sin código |
| 13| Secciones Transversales | Multimoneda, Escáner QR, Audit Trail y Compresión de Medios |


---

## 1. EL NEGOCIO — ZELTEK NICARAGUA

### 1.1 Líneas de Negocio

- **Laptops reacondicionadas**: Dell Latitude y Precision compradas en eBay, acondicionadas y revendidas.
- **Otros dispositivos**: Teléfonos y electrónicos reacondicionados.
- **Accesorios**: Cargadores Dell Type-C, cables, repuestos — comprados en lotes y vendidos sueltos o incluidos con laptops.
- **Servicios técnicos**: Mantenimiento preventivo y correctivo.

### 1.2 Ciclo de Vida de un Equipo

| Etapa | Nombre | Qué registra el sistema |
|-------|--------|------------------------|
| 1 | Orden de Compra | URL eBay, proveedor, precio USD, tracking |
| 2 | Recepción | Fecha llegada, número de serie, fotos |
| 3 | Diagnóstico | Batería, RAM, almacenamiento, pantalla |
| 4 | Preparación | Limpieza, repuestos, instalación OS, costo prep |
| 5 | Disponible | CTR calculado, precio de venta, fotos finales |
| 6 | Venta | Cliente, precio, método pago, factura, garantía |
| 7 | Post-venta | Garantía activa/vencida, reclamos |

---

## 2. PILAR 1 — BANDEJA DE ENTRADA (INBOX)

### 2.1 Flujo Completo

1. **eBay** → envía correo "Order Confirmed" a Gmail.
2. **n8n/Zapier** → detecta el correo, extrae: nombre artículo, precio, tracking, vendedor.
3. **n8n** → POST `/api/v1/inbox` con datos extraídos.
4. **Backend** → inserta en `compras_pendientes` con estado `pendiente_triage`.
5. **Admin (móvil)** → abre la Bandeja de Entrada.
6. **Triage**: "Ingresar a Inventario" → crea equipo con estado COMPRADO. "Descartar" → marca como descartado, NO afecta finanzas.

### 2.2 Reglas de Negocio — Inbox

**RN-INBOX-001: Deduplicación**
- `tracking_number` es UNIQUE en `compras_pendientes`. Si llega duplicado → rechazar y alertar.

**RN-INBOX-002: Triage Obligatorio**
- Sin triage > 5 días → alerta automática al admin.

**RN-INBOX-003: Compra Personal vs Negocio**
- "Ingresar" → crea equipo, costo_base suma a Capital en Tránsito.
- "Descartar" → `estado=descartado`, `deleted_at=NOW()`. Nunca se borra físicamente.

---

## 3. PILAR 2 — MÁQUINA DE ESTADOS DEL EQUIPO

### 3.1 Catálogo de Estados

| Estado | Tipo | Significado |
|--------|------|-------------|
| 🟡 COMPRADO | Activo | Pagado en eBay. En camino al casillero Miami. |
| 🟠 EN_BODEGA_MIAMI | Activo | Recibido por el courier en Miami. |
| 🔵 EN_TRANSITO | Activo | Viajando de Miami a Managua. |
| 🟣 EN_TALLER | Activo | En preparación: diagnóstico, limpieza, fotos. |
| 🟢 DISPONIBLE | Activo | Listo para entrega inmediata. Publicado. |
| ⚫ VENDIDO | Terminal | Cliente pagó y recibió. Garantía activa. |
| 🚨 EN_RECLAMO | Pausa | Disputa abierta PayPal/eBay. Capital sigue contando. |
| ❌ DEVUELTO | Terminal | Reclamo ganado/equipo devuelto. Resta del gasto mensual. |

### 3.2 Transiciones Permitidas

| Estado Actual | Puede pasar a... |
|--------------|------------------|
| COMPRADO | EN_BODEGA_MIAMI, EN_RECLAMO |
| EN_BODEGA_MIAMI | EN_TRANSITO, EN_RECLAMO |
| EN_TRANSITO | EN_TALLER, EN_RECLAMO |
| EN_TALLER | DISPONIBLE (solo si peso ingresado + mínimo 1 foto) |
| DISPONIBLE | VENDIDO (solo via checkout completo), EN_TALLER |
| EN_RECLAMO | DISPONIBLE (reclamo ganado), DEVUELTO (reclamo perdido) |
| VENDIDO | EN_RECLAMO (post-venta), EN_TALLER (garantía) |
| DEVUELTO | **ESTADO TERMINAL — sin transiciones** |

### 3.3 Reglas Especiales

**RN-STATE-001: EN_TALLER → DISPONIBLE (Bloqueante)**
- BLOQUEA si `peso_real_libras` es NULL o 0.
- BLOQUEA si `foto_urls` tiene menos de 1 elemento.
- BLOQUEA si `requiere_cargador = true` y NO tiene accesorio "Cargador" asignado como "incluido". Si `requiere_cargador = false` (ya viene con cargador o no aplica) → no verifica.
- Al aprobar: recalcula CTR con peso real + costo accesorios asignados.

**RN-STATE-002: Cualquier estado → EN_RECLAMO**
- Requiere: `descripcion_disputa` (text) y `plataforma_disputa` (PAYPAL | EBAY | OTRO).
- Capital del equipo SIGUE contando en "Capital Activo".

**RN-STATE-003: EN_RECLAMO → DEVUELTO**
- Si `reembolso_parcial > 0`: `nuevo_costo = costo_base - reembolso`.
- `visible_en_inventario = false`.
- Monto original se resta del "Gasto Mensual".

### 3.4 Implementación

El servicio `EquipoStateMachine` en `/backend/src/domain/equipos/` es el **ÚNICO** punto del sistema que puede cambiar estados. Recibe `(equipoId, estadoNuevo, usuarioId, notas?)` y valida contra la tabla de transiciones. Error 422 si la transición es inválida.

---

## 4. PILAR 3 — FÓRMULA CTR Y COSTOS

### 4.1 Fórmula

```
CTR = (Costo Base + Costo Logístico + Costo Acondicionamiento + Costo Accesorios Asignados) − Reembolso Parcial

Costo Base = Precio Subasta + Impuestos eBay/PayPal
Costo Logístico = Peso Real (libras) × Tarifa por Libra (de tabla settings)
Costo Acondicionamiento = Repuestos + Mano de Obra + Materiales
Costo Accesorios Asignados = Σ costo_unitario de accesorios vinculados al equipo (incluidos + regalías)
```

> **IMPORTANTE**: Al asignar cualquier accesorio (incluido o regalía) a una laptop, su costo se suma al CTR y la unidad se descuenta del inventario. Incluidos = obligatorios (cargador). Regalías = bonus opcionales (mouse, funda) — su costo igualmente impacta el margen.

### 4.2 Ejemplo Numérico

| Componente | Valor |
|-----------|-------|
| Precio subasta eBay | $145.00 |
| Tax eBay | $12.00 |
| **Costo Base** | **$157.00** |
| Peso real (4.5 lbs) × tarifa aérea ($5.50/lb) | $24.75 |
| Repuestos + mano obra | $13.00 |
| Cargador Dell 65W Type-C (incluido) | $8.50 |
| Mouse inalámbrico (regalía) | $3.20 |
| Reembolso parcial | $0.00 |
| **CTR FINAL** | **$206.45** |
| Precio Venta Sugerido (CTR × 1.25) | **$258.06** |

> El mouse "regalado" no es gratis — reduce el margen de esta laptop de 28.7% a 20.6% si se vende a $260.

### 4.3 Tabla: settings

| clave | valor | tipo | descripción |
|-------|-------|------|-------------|
| tarifa_libra_aerea_usd | 7.10 | DECIMAL | Precio/libra aéreo Miami→Managua (Configurado en 7.10) |
| tarifa_libra_maritima_usd | 3.10 | DECIMAL | Precio/libra marítimo (Configurado en 3.10) |
| margen_minimo_pct | 25 | INTEGER | Margen mínimo para alerta |
| dias_garantia_seminuevo | 120 | INTEGER | Días garantía por defecto para equipos seminuevos (4 meses) |
| dias_garantia_nuevo | 365 | INTEGER | Días garantía por defecto para equipos nuevos (12 meses/1 año) |
| tasa_cambio_oficial | 37.00 | DECIMAL | Tasa oficial USD/NIO (Configurada en 37.00) |
| tasa_cambio_fecha | 2026-05-25 | DATE | Última actualización tasa |
| moneda_cobro_local | NIO | VARCHAR | Moneda local |
| alerta_inbox_dias | 5 | INTEGER | Días sin triage antes de alerta |
| modo_migracion | false | BOOLEAN | Activa/desactiva validaciones relajadas para importar históricos |


### 4.4 Reglas de Negocio — Costos

**RN-COSTO-001**: CTR se recalcula automáticamente al cambiar componentes. Nunca negativo. Se congela al estado VENDIDO.

**RN-COSTO-002**: `precio_venta >= CTR × (1 + margen_minimo/100)`. Si el admin vende bajo el mínimo → advertencia roja pero NO bloquea — requiere justificación obligatoria.

**RN-COSTO-003**: Reembolso solo si `estado_incidencia = DISPUTA_ABIERTA`. Se registra en `historial_financiero`.

---

## 5. PILAR 4 — CHECKOUT A PRUEBA DE BALAS

### 5.1 Los 4 Pasos Obligatorios

| Paso | Acción | Validación |
|------|--------|-----------|
| 1 | Selección de Cliente | Buscar existente o crear inline. OBLIGATORIO. |
| 2 | Precio de Venta Final | Monto real en USD. Muestra CTR y margen en tiempo real. Si margen < mínimo → justificación obligatoria. |
| 3 | Método de Pago | EFECTIVO, TRANSFERENCIA_BAC, USDT. Referencia obligatoria para transferencia/USDT. |
| 4 | Evidencia de Entrega | Foto desde cámara: factura + equipo + serial visible. **SIN FOTO = SIN VENTA.** |

### 5.2 Reglas de Negocio — Ventas

**RN-VENTA-001**: `evidencia_entrega_url` es NOT NULL en BD. Foto < 10MB, se comprime a WebP antes de subir. Una vez guardada, NO puede eliminarse.

**RN-VENTA-002**: Garantía automática según condición del equipo: si `equipo.condicion = NUEVO` entonces `dias_garantia = dias_garantia_nuevo` (365 días); si es `SEMINUEVO` entonces `dias_garantia = dias_garantia_seminuevo` (120 días). La fecha límite es `garantia_vence = fecha_venta + dias_garantia`. Número de garantía único: `ZLT-GAR-2026-0001`.

**RN-VENTA-003**: PDF de factura se genera automáticamente. Botón "Compartir por WhatsApp".

---

## 6. PILAR 5 — AUTENTICACIÓN Y SEGURIDAD

### 6.1 Estrategia: Doble Token

| Token | Vida | Storage | Función |
|-------|------|---------|---------|
| Access Token (AT) | 15 min | Cookie HttpOnly | Autoriza cada request |
| Refresh Token (RT) | 30 días | Cookie HttpOnly + BD | Renueva AT. Revocable desde BD. |

### 6.2 Flujo de Login

1. POST `/auth/login` con `{ email, password }`.
2. Backend busca usuario. Si no existe → error genérico (nunca revelar si email existe).
3. Compara password con bcrypt hash. Si incorrecto → incrementa `intentos_fallidos`. Si llega a 5 → bloquea 30 min.
4. Si correcto → genera AT (JWT 15min) + RT (UUID en BD).
5. Envía ambos como cookies `HttpOnly + Secure + SameSite=Strict`.

### 6.3 Configuración de Cookies

```typescript
// Access Token Cookie
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 15 * 60 * 1000,  // 15 min
  path: "/api",
}

// Refresh Token Cookie
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 días
  path: "/api/v1/auth/refresh",
}
```

### 6.4 Sistema de Roles

| Permiso | ADMIN | VENDEDOR | TECNICO |
|---------|-------|----------|---------|
| Dashboard completo | ✅ | Solo ventas | Solo taller |
| Triage inbox | ✅ | ❌ | ❌ |
| Crear/editar equipos | ✅ | ❌ | Solo taller |
| Cambiar estado | Todos | Solo VENDIDO | Hasta DISPONIBLE |
| Registrar ventas | ✅ | ✅ | ❌ |
| Ver costos y CTR | ✅ | ❌ | ❌ |
| Modificar settings | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |

### 6.5 Endpoints Auth

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /auth/login | Login. Rate limited 5/15min. |
| POST | /auth/logout | Cierra sesión. Elimina RT de BD. |
| POST | /auth/logout-all | Cierra TODAS las sesiones. |
| POST | /auth/refresh | Renueva AT con RT. Automático. |
| GET | /auth/me | Datos del usuario autenticado. |
| GET | /auth/sesiones | Lista sesiones activas. |
| DELETE | /auth/sesiones/:id | Cerrar sesión específica. |
| PATCH | /auth/password | Cambiar password (requiere actual). |

### 6.6 Seguridad

- Rate limiting: 100 req/IP/15min global. 5 intentos login/IP/15min.
- Password: mínimo 12 chars, mayúscula+minúscula+número+símbolo. bcrypt salt=12.
- Helmet.js para headers HTTP.
- CORS estricto al dominio del frontend.
- Body limit 10MB.
- AT payload: `{ userId, rol, iat, exp }` — sin datos sensibles.

---

## 7. PILAR 6 — GESTIÓN DE CAPITALES, OPEX Y POST-VENTA

### 7.1 Cuentas de Capital — El Problema Real

El negocio funciona con capital de múltiples fuentes: tu socio aporta un monto, vos aportás otro, y eventualmente puede haber más inversores. Cada fuente de capital se debe administrar por separado porque:

- Cada socio necesita saber exactamente cuánto capital tiene en el negocio.
- Si se pierde una laptop (robo, extravío, disputa perdida), ese capital perdido le pertenece a alguien específico.
- Las pérdidas se recuperan de las ganancias mensuales, y el sistema debe rastrear cuánto se ha reintegrado y cuánto falta.

### 7.2 Tabla: inversores (Cuenta de Capital)

```
id                      UUID PK
nombre                  VARCHAR NOT NULL   -- "Socio A", "Zeltek (Capital Propio)"
porcentaje_ganancia     DECIMAL(5,2) NOT NULL  -- % de la ganancia neta mensual
capital_aportado_usd    DECIMAL(10,2) NOT NULL  -- total que ha dado al negocio
telefono                VARCHAR NULL
notas                   TEXT NULL
activo                  BOOLEAN DEFAULT true
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

> Los siguientes valores se CALCULAN en tiempo real (no se guardan — se consultan):
> - **Capital activo**: Σ CTR de equipos con `inversor_id` en estados (COMPRADO → DISPONIBLE)
> - **Capital perdido**: Σ monto de `perdidas_capital` del inversor
> - **Total reintegrado**: Σ monto de reintegros aplicados a sus pérdidas
> - **Pendiente de reintegrar**: Capital perdido − Total reintegrado
> - **Salud del capital**: capital_aportado − pendiente_de_reintegrar

### 7.3 Tabla: perdidas_capital (Registro de Pérdidas)

```
id                  UUID PK
inversor_id         UUID FK → inversores NOT NULL  -- de quién es el capital perdido
equipo_id           UUID FK → equipos NULL         -- equipo que causó la pérdida (si aplica)
motivo              ENUM(EXTRAVIO | ROBO | DISPUTA_PERDIDA | DANO_IRREPARABLE | OTRO)
descripcion         TEXT NOT NULL                  -- qué pasó exactamente
monto_perdido_usd   DECIMAL(10,2) NOT NULL         -- cuánto capital se perdió
monto_reintegrado_usd DECIMAL(10,2) DEFAULT 0      -- cuánto se ha recuperado hasta ahora
saldo_pendiente_usd DECIMAL COMPUTED               -- monto_perdido − monto_reintegrado
estado              ENUM(PENDIENTE | EN_RECUPERACION | RECUPERADO)
fecha_perdida       DATE NOT NULL
fecha_recuperacion  DATE NULL                      -- cuando saldo_pendiente llega a 0
registrado_por      UUID FK → usuarios
created_at          TIMESTAMPTZ
```

### 7.4 Tabla: reintegros_capital (Cada Abono)

```
id                  UUID PK
perdida_id          UUID FK → perdidas_capital NOT NULL  -- a qué pérdida se aplica
inversor_id         UUID FK → inversores NOT NULL
monto_usd           DECIMAL(10,2) NOT NULL               -- cuánto se abona este mes
mes_aplicado        DATE NOT NULL                        -- mes/año del reporte
notas               TEXT NULL                            -- "De las ganancias de mayo 2026"
registrado_por      UUID FK → usuarios
created_at          TIMESTAMPTZ
```

### 7.5 Ejemplo Completo — Ciclo de Capital

```
ENERO: Socio A aporta $1,000 de capital
       → capital_aportado = $1,000
       → Se compran 5 laptops con ese capital (cada una vinculada a inversor_id = Socio A)

FEBRERO: Una laptop se extravía ($200 de CTR)
         → Se crea perdida_capital: monto_perdido = $200, motivo = EXTRAVIO
         → El equipo pasa a estado DEVUELTO
         → Estado de cuenta del socio muestra:
           Capital aportado:     $1,000
           Capital activo:       $800 (4 laptops restantes)
           Capital perdido:      $200
           Reintegrado:          $0
           Pendiente reintegrar: $200  ← el negocio le "debe" esto

MARZO: El negocio genera $358.27 de ganancia neta
       → Antes de repartir, se aplica reintegro: $150
       → Se crea reintegro_capital: monto = $150, vinculado a la pérdida de febrero
       → La pérdida ahora tiene: monto_reintegrado = $150, saldo_pendiente = $50
       → Ganancia repartible: $358.27 - $150 = $208.27
       → Socio A (50%): $104.13
       → Zeltek (50%): $104.13

ABRIL: Se reintegran los $50 restantes de las ganancias
       → La pérdida cambia a estado RECUPERADO
       → El capital del socio vuelve a estar completo: $1,000
```

### 7.6 Distribución de Ingresos y Reparto Mensual (Profit First)

Zeltek Nicaragua implementa el método **Profit First (Ganancia Primero)** adaptado a un modelo de reventa con costo directo de mercancías (CTR). Las asignaciones porcentuales no se calculan sobre el ingreso bruto total, sino sobre el **Ingreso Real (Ganancia Bruta)** de cada equipo o accesorio vendido.

$$\text{Ingreso Real (Ganancia Bruta)} = \text{Precio de Venta} - \text{CTR}$$

#### Flujo de Distribución de Fondos (Checkout)
Al registrarse una venta (tanto de equipos como de accesorios), el sistema distribuye el dinero recibido de forma automática en los siguientes fondos virtuales:

1. **Fondo de Retorno de Capital (100% del CTR)**:
   * El monto del CTR (Costo Total Real) del equipo se devuelve íntegramente al balance de capital activo del inversor que lo financió (`inversor_id`). Este saldo vuelve a estar disponible para la compra de nuevos equipos.
2. **Distribución del Ingreso Real (TAPs)**:
   * El excedente (`Precio Venta - CTR`) se divide entre las cuentas virtuales usando los Porcentajes de Asignación Objetivo (TAPs) guardados en `settings`:
     * **Fondo de Ganancia (pf_tap_ganancia, default 10%)**: Reserva del negocio e incentivos.
     * **Fondo de Garantías (pf_tap_garantias, default 5%)**: Reservado para cubrir reparaciones por garantía.
     * **Fondo de OPEX (pf_tap_opex, default 30%)**: Presupuesto para el funcionamiento operativo ordinario.
     * **Fondo de Reparto Socios (pf_tap_reparto, default 55%)**: Ganancia distribuible a los socios.
   * El Fondo de Reparto Socios se divide internamente entre los socios activos según el porcentaje individual pactado (definido en `inversores.porcentaje_ganancia`). Por ejemplo, en una división de 50/50, cada socio recibe el 50% de la cantidad asignada a este fondo.

### 7.7 Funcionamiento de Fondos y Cuentas Virtuales

El ERP mantiene un control de saldos y registros históricos para cada fondo virtual:

* **Saldo de Fondos**: Cada fondo (`fondos_financieros`) tiene un saldo en USD que incrementa con las ventas y disminuye con los egresos correspondientes.
* **Egreso de OPEX**: Cada gasto operativo registrado en `gastos_operativos` se deduce automáticamente del saldo del Fondo de OPEX.
* **Egreso de Garantía**: El costo de repuestos y mano de obra de las reparaciones de tipo `garantias` resueltas se deduce automáticamente del Fondo de Garantías.
* **Retiros de Reparto**: El retiro de ganancias por parte de los socios se registra como débito al Fondo de Reparto correspondiente de cada inversor.

### 7.8 Reglas de Negocio — Capitales y Finanzas

**RN-CAP-001: Todo equipo tiene dueño de capital**
- El campo `inversor_id` en equipos es NOT NULL. Sin excepción.
- Si comprás con tu plata → usás el inversor "Zeltek Capital Propio".

**RN-CAP-002: Registro de pérdida**
- Al registrar una pérdida, el sistema vincula al equipo (si aplica) y lo marca como DEVUELTO.
- El monto de la pérdida es el CTR del equipo al momento de perderse y se le asigna como pérdida acumulada en la cuenta del inversor.
- Se registra en audit_logs como `REGISTRAR_PERDIDA`.

**RN-CAP-003: Reintegro de pérdidas**
- Las pérdidas de capital acumuladas no restan de la distribución mensual ordinaria del Fondo de Reparto de Socios.
- Las pérdidas se reintegran mediante transferencias manuales que realiza el administrador desde el **Fondo de Ganancia (Reserva)** hacia el capital aportado del inversor afectado.

**RN-FIN-001: Control Presupuestario de OPEX**
- Todos los gastos de la tabla `gastos_operativos` deben debitarse del fondo `OPEX`.
- Si el saldo del fondo `OPEX` cae por debajo de `$0.00`, el sistema permite registrar el gasto pero genera una **Alerta Crítica en el Dashboard**: *"Fondo de OPEX en números rojos. Los gastos exceden el presupuesto asignado de Profit First."*

**RN-FIN-002: Control de Costos de Garantía**
- Las reparaciones por garantía resueltas se pagan del fondo `GARANTIAS`.
- Si el fondo `GARANTIAS` es insuficiente, el monto restante se toma del fondo `GANANCIA` y se registra una alerta para ajustar el porcentaje de garantías.

**RN-CAP-005: Capital de accesorios**
- Los lotes de accesorios también tienen `inversor_id`. Si un lote de cargadores se compró con capital del Socio A, las pérdidas de ese lote afectan su cuenta de capital.

**RN-CAP-006: Múltiples inversores**
- El sistema soporta N inversores. Cada uno con su porcentaje y su cuenta de capital independiente.
- El reporte mensual muestra el reparto para cada inversor por separado.

### 7.9 Endpoints — Capital, Pérdidas y Fondos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /inversores | Listar con cálculos de capital en tiempo real. |
| POST | /inversores | Crear inversor/socio. ADMIN. |
| PATCH | /inversores/:id | Editar nombre, porcentaje, capital aportado. |
| GET | /inversores/:id/capital | Detalle completo: activo, perdido, reintegrado, pendiente. |
| GET | /inversores/:id/reporte | JSON para estado de cuenta mensual. |
| POST | /perdidas | Registrar pérdida de capital. Vincula equipo + inversor. |
| GET | /perdidas | Listar pérdidas con filtros: inversor, estado. |
| GET | /fondos | Listar saldos actuales de todos los fondos financieros. |
| GET | /fondos/:id/historial | Historial de depósitos y retiros de un fondo. |
| POST | /fondos/transferir | Transferencia manual entre fondos (ej. Ganancia -> Inversor para reintegro). |
| POST | /reintegros | Registrar reintegro de pérdida. Vincula pérdida + fondo origen. |
| GET | /reintegros | Historial de reintegros por inversor/mes. |

### 7.10 Gastos Operativos (OPEX) — Doble Moneda

Categorías: `LOGISTICA | MARKETING | HERRAMIENTAS | RENTA | SERVICIOS | OTRO`

> **NOTA**: `REINTEGRO_CAPITAL` ya NO es categoría de OPEX. Ahora tiene su propia tabla `reintegros_capital` con trazabilidad completa. Los reintegros se registran aparte de los gastos operativos.

**Flujo de registro de un gasto en NIO**:
1. Admin ingresa: concepto "Transporte", monto C$1,700, moneda "NIO".
2. Sistema toma la `tasa_cambio_oficial` de settings (ej: 36.85) y calcula: $1,700 ÷ 36.85 = $46.13 USD.
3. Guarda ambos: `monto_original = 1700`, `moneda_original = NIO`, `tasa_cambio_aplicada = 36.85`, `monto_usd = 46.13`.
4. Los reportes muestran dos columnas: "Gastos USD" y "Gastos Córdobas" — exactamente como tu Excel.

```
Ganancia Neta del Mes = Σ(ganancias productos) − Σ(OPEX) − Σ(reintegros del mes) − Σ(costo_reclamos)
```

### 7.3 Garantías y Reclamos

Estados del reclamo: `ABIERTO → EN_DIAGNOSTICO → RESUELTO | RECHAZADO`

**RN-GAR-001**: Al crear reclamo, validar `fecha_reclamo <= garantia_vence`. Si fuera de período → advertencia pero se permite con `cubierto_por_garantia = false`.

**RN-GAR-002 (Regla de Riesgo)**: Reclamo RESUELTO con `cubierto = true` y `costo_reparacion > 0` → se descuenta de la ganancia de esa venta en las métricas. Campos originales de la venta NO se modifican.

---

## 8. PILAR 7 — REPORTES Y AUTOMATIZACIÓN

### 8.1 Estado de Cuenta PDF por Inversor/Socio

Secciones del PDF (formato que replica tu Excel actual):
1. **Encabezado**: Logo Zeltek, nombre socio/inversor, período (mes/año).
2. **Productos vendidos**: Tabla con: producto, serial (o "NOSERIAL" para accesorios), ganancia individual. Total ganancia bruta.
3. **Gastos operativos — dos columnas**: "Gastos USD" y "Gastos Córdobas" — cada gasto muestra la moneda original y su conversión. Total OPEX.
4. **Reintegro a capital**: Si aplica en el período. Monto y nota explicativa.
5. **Resumen**: Ganancia bruta − OPEX − Reintegros = **Ganancia Neta**. Reparto socio (%) y Ganancia Zeltek.
6. **Inventario activo** ("Su dinero en la calle"): Equipos comprados con su capital que aún no se han vendido.
7. **Pie de página**: Fecha generación, disclaimer.

Generación: react-pdf en frontend (browser). Backend solo provee JSON vía `GET /inversores/:id/reporte?desde=&hasta=`.

### 8.2 Exportación Excel/CSV

- Librería: SheetJS (`xlsx`) en frontend — sin servidor.
- Vistas con exportación: Equipos, Ventas, Gastos, Clientes, Reclamos.
- Exporta datos con filtros activos. Máximo 5,000 filas.
- ADMIN ve todas las columnas. VENDEDOR no ve CTR, ganancias ni inversores.

### 8.3 Flujos n8n

| # | Flujo | Trigger |
|---|-------|---------|
| F-01 | Inbox eBay | Nuevo email "Order Confirmed" en Gmail |
| F-02 | Cierre de Mes | Cron día 1 de cada mes 8:00 AM |
| F-03 | Alerta Inbox Stale | Cron diario — inbox > 5 días sin triage |
| F-04 | Alerta Garantías | Cron diario — garantías vencen en 15 días |
| F-05 | Alerta Reclamos | Webhook — nuevo reclamo creado |

### 8.4 P&L Statement (Estado de Resultados)

Endpoint: `GET /reports/income-statement?inicio=YYYY-MM-DD&fin=YYYY-MM-DD`

```
GANANCIA BRUTA DEL MES   = Σ (precio_venta − CTR) de equipos + Σ ganancia accesorios sueltos
GASTOS OPERATIVOS (OPEX) = Σ monto_usd de gastos_operativos (NIO convertido)
REINTEGROS A CAPITAL     = Σ monto_usd de reintegros_capital del mes (tabla propia)
COSTO RECLAMOS           = Σ costo_reparacion de reclamos resueltos cubiertos
GANANCIA NETA DEL MES    = Ganancia Bruta − OPEX − Reintegros − Reclamos
REPARTO SOCIO(S)         = Ganancia Neta × porcentaje de cada socio
GANANCIA ZELTEK          = Ganancia Neta − Σ repartos socios
```

Márgenes calculados: Bruto (Utilidad Bruta / Ingresos), Operativo (EBIT / Ingresos), Neto (Utilidad Neta / Ingresos).

---

## 9. SECCIONES TRANSVERSALES

### 9.1 Multimoneda NIO/USD

- Todos los costos internos en USD. Córdoba es solo moneda de cobro.
- Al checkout: selección de moneda (USD | NIO | MIXTO).
- Si NIO: `equivalente_usd = monto_nio / tasa_cambio_oficial`.
- Se guarda `tasa_cambio_aplicada` como snapshot inmutable en cada venta.
- Si tasa tiene > 1 día sin actualizar → banner amarillo en dashboard.
- Reportes e inversores siempre en USD.

### 9.2 Escáner QR / Código de Barras

- Librería: `@zxing/browser` (funciona en Safari iPhone sin App Store).
- Componente reutilizable: `EscanerSerial` con prop `onEscaneo(serial)`.
- Campos con escáner: `numero_serie` (equipos), búsqueda inventario, verificación en checkout/garantía.
- Post-escaneo: GET `/equipos/serie/:serial` para verificar si ya existe.
- Si no hay cámara (desktop sin cámara) → botón se oculta, solo input manual.

### 9.3 Audit Trail

Tabla `audit_logs` — solo escritura, nunca UPDATE/DELETE.

Acciones auditables:

| Acción | Cuándo |
|--------|--------|
| CREAR_EQUIPO | Ingreso desde triage |
| CAMBIO_ESTADO | Cualquier transición StateMachine |
| EDITAR_PRECIO | Cambio de precio_venta_usd |
| EDITAR_CTR | Cambio en componentes del CTR |
| REGISTRAR_VENTA | Checkout completado |
| ABRIR_RECLAMO | Nuevo reclamo garantía |
| RESOLVER_RECLAMO | Estado → RESUELTO/RECHAZADO |
| MODIFICAR_SETTING | Cambio en settings |
| TRIAGE_INBOX | Ingresar o descartar del inbox |
| LOGIN_EXITOSO | Login correcto |
| MARCAR_LIQUIDADO | Reparto inversor liquidado |
| REGISTRAR_GASTO | Nuevo gasto operativo |
| CREAR_LOTE_ACCESORIOS | Nuevo lote de accesorios ingresado |
| ASIGNAR_ACCESORIO | Accesorio vinculado a un equipo (impacta CTR) |
| DESASIGNAR_ACCESORIO | Accesorio devuelto al inventario |
| VENDER_ACCESORIO | Venta suelta de accesorio |
| CREAR_REPARACION | Nueva orden de reparación |
| CAMBIO_ESTADO_REPARACION | Transición de estado en reparación |
| CREAR_USUARIO | Nuevo usuario creado |
| DESACTIVAR_USUARIO | Usuario activado/desactivado |
| RESET_PASSWORD | Password reseteado por admin |
| REGISTRAR_PERDIDA | Pérdida de capital registrada |
| REGISTRAR_REINTEGRO | Abono de reintegro a pérdida |

Campos: `usuario_id, accion, tabla_afectada, registro_id, campo_modificado, valor_anterior (JSONB), valor_nuevo (JSONB), ip_address, user_agent, notas, created_at`.

INSERT en audit_logs y operación principal son **atómicos** — si uno falla, ambos se revierten.

### 9.4 Compresión de Medios

| Tipo imagen | Ancho máx. | Formato | Calidad | Tamaño obj. |
|-------------|-----------|---------|---------|-------------|
| Fotos equipo | 1280px | WebP | 82% | < 250KB |
| Evidencia entrega | 1280px | WebP | 85% | < 300KB |
| Comprobante OPEX | 1024px | WebP | 80% | < 200KB |

- Frontend comprime ANTES de enviar. Backend rechaza > 500KB (HTTP 413).
- Cloudinary organizado: `zeltek/equipos/:id/`, `zeltek/ventas/:id/`, `zeltek/gastos/:id/`.
- Fotos nunca se eliminan — son evidencia histórica.

### 9.5 Progressive Web App (PWA)

Para permitir el uso nativo del ERP en dispositivos móviles (iOS/Android) durante operaciones de bodega y ventas:
- El frontend se compilará como una PWA utilizando `vite-plugin-pwa`.
- Permitirá instalación directa desde Safari (iOS) o Chrome (Android) mediante la opción "Añadir a la pantalla de inicio".
- Se configurará un `manifest.json` con los íconos de Zeltek ERP, theme color oscuro (alineado con la UI) y `display: standalone` para ocultar la barra del navegador.
- Habilitará una capa de caché básica con service workers para acelerar tiempos de carga y soportar fluctuaciones de red breves.

---

## 10. PILAR 10 — ACCESORIOS, LOTES Y ASIGNACIÓN

### 10.1 Lógica del Negocio

El negocio tiene **dos tipos de productos**:

| Tipo | Ejemplos | Tiene serial | Tiene garantía | Cómo se compra |
|------|----------|-------------|---------------|----------------|
| **Equipos** | Laptops, iPhones | ✅ Único | ✅ 90 días | Individual o lotes en eBay |
| **Accesorios** | Cargadores Dell Type-C, cables, fundas | ❌ Por tipo | ❌ Sin garantía | Lotes (ej: 10 cargadores) |

**Problema central**: La mayoría de laptops de eBay llegan SIN cargador. El negocio compra lotes de cargadores por separado. Al preparar una laptop (EN_TALLER), se le asigna un cargador del inventario de accesorios. Ese cargador:
1. Se descuenta del stock de accesorios.
2. Su costo se suma al CTR de la laptop.
3. La laptop no puede pasar a DISPONIBLE sin cargador asignado (si lo requiere).

Los cargadores que NO se asignan a laptops se venden sueltos como accesorios independientes.

### 12.2 Tabla: categorias_accesorio

```
id          UUID PK
nombre      VARCHAR UNIQUE NOT NULL   -- "Cargador Dell 65W Type-C", "Cable USB-C", etc.
descripcion TEXT NULL
requiere_asignacion_equipo  BOOLEAN DEFAULT false  -- true para cargadores
created_at  TIMESTAMPTZ
```

### 12.3 Tabla: lotes_accesorios

```
id                  UUID PK
numero_lote         VARCHAR UNIQUE        -- ZLT-LOTE-2026-001
categoria_id        UUID FK → categorias_accesorio NOT NULL
descripcion         TEXT                  -- "10x Cargadores Dell 65W Type-C"
cantidad_total      INTEGER NOT NULL      -- Unidades compradas en el lote
precio_lote_usd     DECIMAL(10,2) NOT NULL -- Precio total del lote
costo_unitario_usd  DECIMAL(10,2) COMPUTED -- precio_lote / cantidad_total
flete_lote_usd      DECIMAL(10,2) DEFAULT 0
costo_unitario_real  DECIMAL(10,2) COMPUTED -- (precio_lote + flete) / cantidad
proveedor           VARCHAR               -- Vendedor eBay o proveedor local
url_compra          TEXT NULL              -- URL del listing de eBay del lote
inversor_id         UUID FK → inversores NOT NULL
fecha_compra        DATE NOT NULL
notas               TEXT NULL
created_at          TIMESTAMPTZ
```

### 10.4 Tabla: accesorios_inventario (stock individual)

```
id                  UUID PK
lote_id             UUID FK → lotes_accesorios NOT NULL
categoria_id        UUID FK → categorias_accesorio NOT NULL
costo_unitario_usd  DECIMAL(10,2) NOT NULL  -- heredado del lote
estado              ENUM(disponible | asignado_equipo | vendido | defectuoso) NOT NULL
tipo_asignacion     ENUM(incluido | regalia) NULL  -- NULL si disponible/vendido
equipo_asignado_id  UUID FK → equipos NULL  -- si fue asignado a una laptop
venta_accesorio_id  UUID FK → ventas_accesorios NULL  -- si se vendió suelto
notas               TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

> **"incluido" vs "regalia"**: En ambos casos el accesorio SALE del inventario y su COSTO se suma al CTR de la laptop. La diferencia:
> - **incluido**: obligatorio (cargador). Sin este, la laptop NO pasa a DISPONIBLE.
> - **regalia**: bonus opcional (mouse, funda). El admin decide regalarlo. No bloquea transiciones.

### 12.5 Tabla: ventas_accesorios (venta suelta)

```
id                  UUID PK
numero_factura      VARCHAR UNIQUE   -- ZLT-ACC-2026-001
accesorio_id        UUID FK → accesorios_inventario NOT NULL
cliente_id          UUID FK → clientes NULL  -- puede ser venta sin cliente registrado
precio_venta_usd    DECIMAL(10,2) NOT NULL
costo_unitario_usd  DECIMAL(10,2) NOT NULL  -- congelado al momento
ganancia_usd        DECIMAL COMPUTED  -- precio_venta - costo_unitario
moneda_cobro        ENUM(USD | NIO | MIXTO)
monto_cobrado_nio   DECIMAL(12,2) NULL
tasa_cambio_aplicada DECIMAL(8,4) NOT NULL
metodo_pago         ENUM(EFECTIVO | TRANSFERENCIA_BAC | USDT)
vendedor_id         UUID FK → usuarios
fecha_venta         TIMESTAMPTZ
```

### 10.6 Nuevo campo en tabla: equipos

```
requiere_cargador    BOOLEAN DEFAULT true   -- se cambia a false si el equipo YA viene con cargador de eBay
costo_accesorios_usd DECIMAL(10,2) DEFAULT 0  -- suma de accesorios asignados
```

> El CTR ahora incluye `costo_accesorios_usd` en su cálculo:
> `ctr_usd = (costo_base + costo_logístico + costo_acondicionamiento + costo_accesorios) − reembolso`
>
> **Si la laptop viene con cargador de eBay**: el admin marca `requiere_cargador = false` al registrarla en EN_TALLER. El sistema no exige asignar cargador del inventario, no se suma costo extra al CTR, y la transición a DISPONIBLE no se bloquea por cargador faltante.

### 10.7 Flujo: Asignar Accesorio a Equipo (Incluido o Regalía)

| Paso | Actor | Acción del Sistema |
|------|-------|-------------------|
| 1 | Técnico/Admin (EN_TALLER) | Abre el equipo y presiona "Asignar Accesorio". |
| 2 | Sistema | Muestra lista de accesorios disponibles filtrados por categoría. Muestra stock actual. |
| 3 | Admin | Selecciona un accesorio y elige tipo: **"Incluido"** (cargador obligatorio) o **"Regalía"** (mouse, funda de regalo). |
| 4 | Sistema | Cambia `accesorio.estado` → `asignado_equipo`. Guarda `tipo_asignacion` (incluido o regalia). Vincula `equipo_asignado_id`. |
| 5 | Sistema | Suma `costo_unitario_usd` del accesorio al campo `costo_accesorios_usd` del equipo. **Tanto incluidos como regalías suman al CTR** — el costo del mouse regalado se absorbe en el margen de la laptop. |
| 6 | Sistema | Recalcula el CTR del equipo automáticamente. |
| 7 | Audit | Registra `ASIGNAR_ACCESORIO` con equipo_id, accesorio_id y tipo_asignacion. |

**Ejemplo**: Laptop CTR $194.75 + Cargador (incluido) $8.50 + Mouse (regalía) $3.20 = **CTR $206.45**. El mouse regalado no es "gratis" — reduce el margen de esa laptop específica.

### 12.8 Flujo: Ingresar Lote de Accesorios

| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Admin | Presiona "Nuevo Lote" en la vista de Accesorios. |
| 2 | Admin | Ingresa: categoría, cantidad, precio total del lote, flete, proveedor, inversor. |
| 3 | Sistema | Calcula `costo_unitario_real = (precio_lote + flete) / cantidad`. |
| 4 | Sistema | Crea N registros en `accesorios_inventario` con estado `disponible` y costo heredado. |
| 5 | Audit | Registra `CREAR_LOTE_ACCESORIOS` con lote_id y cantidad. |

### 12.9 Flujo: Venta Suelta de Accesorio

| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Vendedor | En la vista de Accesorios, selecciona un accesorio disponible y presiona "Vender". |
| 2 | Sistema | Mini-checkout: precio venta, método pago, cliente (opcional). |
| 3 | Sistema | Cambia `accesorio.estado` a `vendido`. Crea registro en `ventas_accesorios`. |
| 4 | Sistema | La ganancia del accesorio se suma al beneficio neto del mes. |

### 10.10 Reglas de Negocio — Accesorios

**RN-ACC-001: Bloqueo EN_TALLER → DISPONIBLE**
- Si `equipo.requiere_cargador = true` y NO tiene al menos 1 accesorio con `tipo_asignacion = incluido` de categoría "Cargador" → BLOQUEA.
- Mensaje: "Este equipo requiere cargador. Asignar uno del inventario antes de marcar como disponible."
- Si `requiere_cargador = false` → no bloquea. Esto cubre tres casos:
  - La laptop ya venía con su cargador de eBay (caso más común para marcar false).
  - Es un iPhone u otro dispositivo que no necesita cargador Dell.
  - El admin decidió que ese equipo se vende sin cargador (caso raro).
- El campo `requiere_cargador` se establece en la vista de EN_TALLER con un toggle visible: "¿El equipo ya incluye cargador?" → Sí = false, No = true (default).
- Las **regalías** (mouse, funda) nunca bloquean transiciones — son opcionales.

**RN-ACC-002: Unicidad de Asignación**
- Un accesorio con estado `asignado_equipo` no puede asignarse a otro equipo ni venderse suelto.
- Si se desvincula del equipo (ej: equipo devuelto), el accesorio vuelve a estado `disponible`, `tipo_asignacion = NULL`, y el CTR se recalcula restando su costo.

**RN-ACC-003: Costo al CTR (Incluidos y Regalías)**
- **Tanto incluidos como regalías** suman su `costo_unitario_usd` al campo `costo_accesorios_usd` del equipo.
- El costo de una regalía NO es "gratis" — reduce el margen de esa laptop. El admin ve el impacto en tiempo real al asignar.
- Ejemplo: CTR $194.75 + Cargador $8.50 (incluido) + Mouse $3.20 (regalía) = CTR $206.45. Si vende a $260, su margen baja de 28.7% a 20.6%.

**RN-ACC-004: Costo Unitario Real del Lote**
- `costo_unitario_real = (precio_lote + flete_lote) / cantidad_total`.
- Se distribuye equitativamente entre todas las unidades del lote.
- El costo del lote se rastrea al inversor vía `inversor_id`.

**RN-ACC-005: Stock y Alertas**
- Dashboard muestra stock por categoría: "Cargadores: 8 disponibles | 5 asignados | 3 vendidos".
- Alerta cuando stock disponible ≤ 3 unidades en cualquier categoría.
- El sistema nunca permite asignar o vender un accesorio que no esté en estado `disponible`.

**RN-ACC-006: Impacto Financiero**
- **Vendidos sueltos**: su ganancia se suma al P&L como ingreso independiente.
- **Asignados a equipos** (incluidos + regalías): su costo se absorbe en el CTR de la laptop — la ganancia se refleja cuando se vende la laptop.
- **Capital de lotes**: se atribuye al inversor del lote.
- En el reporte del inversor: los accesorios asignados no generan línea propia — su costo ya está en el CTR del equipo que se vendió.

### 12.11 KPIs de Accesorios (Dashboard)

| KPI | Fórmula |
|-----|---------|
| Stock Accesorios Disponible | COUNT(*) WHERE estado = disponible, agrupado por categoría |
| Accesorios Asignados (mes) | COUNT(*) WHERE estado = asignado AND updated_at >= inicio_mes |
| Ventas Accesorios (mes) | SUM(precio_venta_usd) de ventas_accesorios del mes |
| Costo Invertido Accesorios | SUM(precio_lote + flete) de lotes activos no agotados |
| Alerta Stock Bajo | Categorías con stock disponible ≤ 3 |

### 12.12 Endpoints — Accesorios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /accesorios/categorias | Listar categorías de accesorios. |
| POST | /accesorios/categorias | Crear categoría. ADMIN. |
| GET | /accesorios/lotes | Listar lotes con stock restante. |
| POST | /accesorios/lotes | Crear lote — genera N unidades en inventario. |
| GET | /accesorios | Listar inventario con filtros: categoría, estado. |
| GET | /accesorios/disponibles | Solo disponibles, agrupado por categoría con conteo. |
| POST | /accesorios/:id/asignar/:equipoId | Asignar accesorio a equipo. Recalcula CTR. |
| POST | /accesorios/:id/desasignar | Desasignar de equipo. Devuelve a disponible. Recalcula CTR. |
| POST | /accesorios/:id/vender | Venta suelta. Mini-checkout. |
| GET | /accesorios/stock-report | Reporte de stock por categoría. |

### 12.13 Auditoría de Accesorios

Acciones nuevas para audit_logs:

| Acción | Cuándo |
|--------|--------|
| CREAR_LOTE_ACCESORIOS | Nuevo lote ingresado al sistema |
| ASIGNAR_ACCESORIO | Accesorio vinculado a un equipo |
| DESASIGNAR_ACCESORIO | Accesorio devuelto al inventario |
| VENDER_ACCESORIO | Venta suelta de accesorio |

---

## 10B. MÓDULO: REPARACIONES (Servicios Técnicos)

### 10B.1 Descripción

Las reparaciones son servicios que Zeltek ofrece a clientes externos (equipos NO comprados en Zeltek) y servicios de garantía (equipos SÍ comprados en Zeltek). Son una línea de ingreso independiente del negocio de reventa.

### 10B.2 Tabla: ordenes_reparacion

```
id                    UUID PK
numero_orden          VARCHAR UNIQUE   -- ZLT-REP-2026-001
cliente_id            UUID FK → clientes NOT NULL
tipo                  ENUM(externa | garantia) NOT NULL  -- externa=equipo ajeno, garantia=equipo Zeltek
venta_id              UUID FK → ventas NULL  -- solo si tipo=garantia, vincula al equipo original
equipo_descripcion    TEXT NOT NULL     -- "MacBook Pro 2020" o "Dell Latitude 5420 SN:ABC123"
numero_serie_externo  VARCHAR NULL      -- serial del equipo del cliente (si aplica)
falla_reportada       TEXT NOT NULL
diagnostico_tecnico   TEXT NULL
estado                ENUM(RECIBIDO | EN_DIAGNOSTICO | PRESUPUESTADO | EN_REPARACION | LISTO | ENTREGADO | CANCELADO)
presupuesto_usd       DECIMAL(10,2) NULL  -- monto cotizado al cliente
aprobado_cliente      BOOLEAN NULL       -- NULL=pendiente, true=aceptó, false=rechazó
costo_repuestos_usd   DECIMAL(10,2) DEFAULT 0
costo_mano_obra_usd   DECIMAL(10,2) DEFAULT 0
costo_total_usd       DECIMAL(10,2)      -- Calculado en backend (repuestos + mano_obra) y guardado físicamente
precio_cobrado_usd    DECIMAL(10,2) NULL  -- lo que pagó el cliente (puede diferir del presupuesto; si es tipo=garantia y cubierto, es 0)
metodo_pago           ENUM(EFECTIVO | TRANSFERENCIA_BAC | USDT) NULL
moneda_cobro          ENUM(USD | NIO) NULL
tasa_cambio_aplicada  DECIMAL(8,4) NULL
tecnico_id            UUID FK → usuarios NULL
fecha_recepcion       TIMESTAMPTZ NOT NULL
fecha_diagnostico     TIMESTAMPTZ NULL
fecha_entrega         TIMESTAMPTZ NULL
notas                 TEXT NULL
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

### 10B.3 Flujo de Estados — Reparaciones

| Estado Actual | Puede pasar a... |
|--------------|------------------|
| RECIBIDO | EN_DIAGNOSTICO |
| EN_DIAGNOSTICO | PRESUPUESTADO, CANCELADO |
| PRESUPUESTADO | EN_REPARACION (si aprobado), CANCELADO (si rechazado) |
| EN_REPARACION | LISTO |
| LISTO | ENTREGADO |
| CANCELADO | **TERMINAL** |
| ENTREGADO | **TERMINAL** |

### 10B.4 Reglas de Negocio — Reparaciones

**RN-REP-001: Presupuesto obligatorio antes de reparar**
- El sistema NO permite pasar a EN_REPARACION sin un presupuesto aprobado por el cliente.
- Si `tipo = garantia` y está cubierto → `precio_cobrado = 0`, pero el presupuesto de costos internos sí se registra.

**RN-REP-002: Diferencia externa vs garantía**
- Si `tipo = externa` → el ingreso se suma a "Ventas del Mes" en el P&L como ingreso por servicios.
- Si `tipo = garantia` → el costo se registra como reclamo de garantía y reduce la ganancia de esa venta original.

**RN-REP-003: Entrega obligatoria**
- El estado ENTREGADO requiere confirmación (firma o foto del cliente retirando el equipo).
- Si el equipo lleva más de 30 días en estado LISTO sin ser retirado → alerta al admin.

### 10B.5 Endpoints — Reparaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /reparaciones | Listar con filtros: estado, tipo, técnico. |
| GET | /reparaciones/:id | Detalle completo con historial de estados. |
| POST | /reparaciones | Crear orden. Requiere cliente + descripción falla. |
| PATCH | /reparaciones/:id/estado | Avanzar estado. Valida transiciones. |
| PATCH | /reparaciones/:id/presupuesto | Registrar presupuesto. |
| PATCH | /reparaciones/:id/aprobar | Cliente aprueba/rechaza presupuesto. |
| PATCH | /reparaciones/:id/cobrar | Registrar pago al entregar. |

---

## 10C. MÓDULO: PRODUCTOS (Catálogo)

### 10C.1 Descripción

La vista "Productos" es el catálogo maestro de tipos de equipos y accesorios que maneja el negocio. No es el inventario (ese tiene unidades individuales con serial) — es la referencia de qué tipos de productos existen para clasificar rápidamente al ingresar un equipo.

### 10C.2 Tabla: catalogo_productos

```
id              UUID PK
nombre          VARCHAR NOT NULL   -- "Dell Latitude 5420", "Dell Precision 3560"
marca           VARCHAR NOT NULL   -- "Dell", "Apple", "HP"
tipo            ENUM(laptop | telefono | tablet | accesorio | otro)
categoria       VARCHAR NULL       -- "Latitude", "Precision", "iPhone", "Cargador"
especificaciones_default  JSONB NULL  -- { procesador: "i5-12th", ram: 16, ssd: 256 }
precio_venta_sugerido_usd DECIMAL(10,2) NULL  -- precio referencia para ese modelo
activo          BOOLEAN DEFAULT true
notas           TEXT NULL
created_at      TIMESTAMPTZ
```

### 10C.3 Uso del Catálogo

- Al crear un equipo en EN_TALLER, el admin puede seleccionar un producto del catálogo para auto-rellenar marca, modelo y specs por defecto — luego ajusta lo que sea diferente.
- Para accesorios: las categorías de accesorio se vinculan al catálogo para mantener consistencia.
- El catálogo NO tiene stock — solo es referencia. El stock real está en `equipos` y `accesorios_inventario`.

### 10C.4 Endpoints — Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /productos | Catálogo completo con filtros: tipo, marca. |
| POST | /productos | Crear entrada de catálogo. ADMIN. |
| PATCH | /productos/:id | Editar producto del catálogo. |
| DELETE | /productos/:id | Soft delete (desactivar). |

---

## 10D. MÓDULO: USUARIOS

### 10D.1 Descripción

Pantalla de gestión de usuarios del sistema. Solo accesible por ADMIN. Permite crear, editar, desactivar usuarios y ver sus sesiones activas.

### 10D.2 Pantalla de Usuarios

| Elemento | Comportamiento |
|----------|---------------|
| Lista de usuarios | Tabla con nombre, email, rol, estado (activo/inactivo), último login. |
| Crear usuario | Modal: nombre, email, password temporal, rol (ADMIN/VENDEDOR/TECNICO). |
| Editar usuario | Cambiar nombre, rol. NO puede ver ni cambiar password de otro usuario. |
| Desactivar | Toggle activo/inactivo. Usuario inactivo no puede iniciar sesión. |
| Reset password | Genera link o password temporal. El usuario lo cambia en su primer login. |
| Sesiones | Ver sesiones activas del usuario. Botón para cerrar sesión remota. |

### 10D.3 Endpoints — Usuarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /usuarios | Listar todos. Solo ADMIN. |
| POST | /usuarios | Crear usuario. Solo ADMIN. |
| PATCH | /usuarios/:id | Editar nombre, rol. Solo ADMIN. |
| PATCH | /usuarios/:id/activar | Activar/desactivar. Solo ADMIN. |
| POST | /usuarios/:id/reset-password | Genera password temporal. Solo ADMIN. |
| GET | /usuarios/:id/sesiones | Sesiones activas del usuario. |

### 10D.4 Reglas — Usuarios

**RN-USER-001**: No se puede eliminar un usuario — solo desactivar. Su historial de audit_logs debe permanecer.

**RN-USER-002**: El admin no puede desactivarse a sí mismo.

**RN-USER-003**: Al crear un usuario, el password temporal debe cumplir las mismas reglas de seguridad (12 chars, mayúscula, número, símbolo).

---

## 10E. MÓDULO: CONFIGURACIÓN

### 10E.1 Descripción

Pantalla donde el admin gestiona todos los settings del sistema sin tocar código. Organizada por categorías.

### 10E.2 Pantalla de Configuración

| Sección | Settings que muestra |
|---------|---------------------|
| **Logística** | tarifa_libra_aerea_usd, tarifa_libra_maritima_usd |
| **Finanzas** | margen_minimo_pct, tasa_cambio_oficial, tasa_cambio_fecha, moneda_cobro_local |
| **Profit First TAPs** | pf_tap_ganancia, pf_tap_garantias, pf_tap_opex, pf_tap_reparto |
| **Garantías** | dias_garantia_seminuevo, dias_garantia_nuevo |
| **Sistema** | alerta_inbox_dias |
| **Mi Cuenta** | Cambiar mi password, ver mis sesiones activas, cerrar todas mis sesiones |

Cada setting muestra: nombre legible, valor actual, campo editable, botón guardar. Al cambiar cualquier setting → registra `MODIFICAR_SETTING` en audit_logs con valor anterior y nuevo.

Banner de tasa de cambio: si `tasa_cambio_fecha` tiene > 1 día → banner amarillo permanente hasta actualizar.

### 10E.3 Reglas de Negocio — Configuración

**RN-CONFIG-001: Validación de TAPs (Profit First)**
- Los porcentajes de asignación objetivo (`pf_tap_ganancia`, `pf_tap_garantias`, `pf_tap_opex`, `pf_tap_reparto`) son modificables desde la pantalla de Configuración.
- Al intentar guardar cambios en cualquiera de estos cuatro TAPs, el sistema validará en frontend y backend:
  $$\text{pf\_tap\_ganancia} + \text{pf\_tap\_garantias} + \text{pf\_tap\_opex} + \text{pf\_tap\_reparto} = 100$$
- Si la suma no es exactamente 100%, la operación se rechaza con un error 422 y un mensaje: *"La suma de los porcentajes de Profit First debe ser exactamente 100%."*

---

## 10F. NAVEGACIÓN DEFINITIVA DEL SIDEBAR

### Desktop (sidebar fijo 256px)

```
─── PRINCIPAL ───────────────
◉  Dashboard          → /dashboard
📨 Inbox (3)           → /inbox           [badge si pendientes]
💻 Inventario          → /inventario
🔧 Reparaciones        → /reparaciones
💰 Ventas              → /ventas

─── ADMINISTRACIÓN ──────────
📦 Productos           → /productos       [catálogo]
🛒 Compras / Lotes     → /compras         [lotes accesorios + historial inbox]
📊 Reportes            → /reportes        [P&L, estado cuenta inversor]
🧾 Gastos              → /gastos          [OPEX]
🛡️ Garantías           → /garantias       [Pólizas vigentes y reclamos activos]
📈 Inversores          → /inversores

─── SISTEMA ─────────────────
👥 Usuarios            → /usuarios        [solo ADMIN]
⚙️ Configuración       → /configuracion   [settings, mi cuenta]

─── FOOTER ──────────────────
👤 Denzel (Admin)
   Cerrar sesión
```

### Mobile (Bottom Bar — 5 ítems + "Más")

```
[Dashboard] [Inventario] [Ventas] [Reparaciones] [···Más]
                                                    │
                                              Inbox (badge)
                                              Productos
                                              Compras
                                              Gastos
                                              Garantías
                                              Inversores
                                              Reportes
                                              Usuarios
                                              Configuración
                                              Cerrar sesión
```

---

## 11. MODELO DE DATOS COMPLETO

### 12.1 Convenciones

- UUID como PK en todas las tablas.
- Soft delete: `deleted_at TIMESTAMPTZ NULL`.
- Timestamps: `created_at`, `updated_at` automáticos.
- Schema definido en Prisma — nunca modificar BD directo.

### 12.2 Tabla: compras_pendientes (Inbox)

```
id                UUID PK
fuente            ENUM(GMAIL_EBAY | MANUAL)
nombre_articulo   TEXT NOT NULL
precio_usd        DECIMAL(10,2) NOT NULL
tracking_number   VARCHAR UNIQUE
vendedor_ebay     VARCHAR
url_ebay          TEXT
raw_email_data    JSONB
estado            ENUM(pendiente_triage | ingresado | descartado)
equipo_id         UUID FK → equipos NULL
descartado_razon  TEXT NULL
triaged_at        TIMESTAMPTZ NULL
triaged_by        UUID FK → usuarios NULL
created_at        TIMESTAMPTZ
```

### 12.3 Tabla: inversores

```
id                    UUID PK
nombre                VARCHAR NOT NULL
porcentaje_ganancia   DECIMAL(5,2) NOT NULL  -- entre 0 y 99
telefono              VARCHAR NULL
notas                 TEXT NULL
activo                BOOLEAN DEFAULT true
created_at            TIMESTAMPTZ
```

### 12.4 Tabla: equipos (TABLA CENTRAL)

```
id                        UUID PK
numero_serie              VARCHAR UNIQUE NOT NULL
inbox_id                  UUID FK → compras_pendientes NULL  -- Nullable para permitir migraciones e ingresos manuales
inversor_id               UUID FK → inversores NOT NULL
marca                     VARCHAR NOT NULL
modelo                    VARCHAR NOT NULL
tipo                      ENUM(laptop | telefono | tablet | otro)
procesador                VARCHAR
ram_gb                    INTEGER
almacenamiento_gb         INTEGER
tipo_almacenamiento       ENUM(ssd_nvme | ssd_sata | hdd)
bateria_ciclos            INTEGER NULL
bateria_salud_pct         INTEGER NULL
estado                    ENUM(COMPRADO | EN_BODEGA_MIAMI | EN_TRANSITO | EN_TALLER | DISPONIBLE | VENDIDO | EN_RECLAMO | DEVUELTO) NOT NULL
costo_base_usd            DECIMAL(10,2) NOT NULL
peso_real_libras           DECIMAL(6,2) NULL  -- obligatorio para → DISPONIBLE
tipo_envio                ENUM(aereo | maritimo)
costo_logistico_usd       DECIMAL(10,2)      -- Calculado en backend (peso × tarifa settings) y guardado físicamente
costo_acondicionamiento_usd DECIMAL(10,2)
reembolso_parcial_usd     DECIMAL(10,2) DEFAULT 0
ctr_usd                   DECIMAL(10,2)      -- Calculado en backend ((base + logístico + acond + accesorios) − reembolso) y guardado físicamente
precio_venta_sugerido_usd DECIMAL(10,2)      -- Calculado en backend (CTR × (1 + margen_min/100)) y guardado físicamente
precio_venta_usd          DECIMAL(10,2) NULL
estado_incidencia         ENUM(DISPUTA_ABIERTA | RESUELTO) NULL
plataforma_disputa        ENUM(PAYPAL | EBAY | OTRO) NULL
notas_resolucion          TEXT NULL
foto_urls                 TEXT[] DEFAULT {}
visible_en_inventario     BOOLEAN DEFAULT true
requiere_cargador         BOOLEAN DEFAULT true   -- false si ya viene con cargador de eBay
condicion                 ENUM(NUEVO | SEMINUEVO) DEFAULT SEMINUEVO -- Define garantía por defecto (4 meses/120 días seminuevo, 12 meses/365 días nuevo)
costo_accesorios_usd      DECIMAL(10,2) DEFAULT 0  -- Σ costo de accesorios asignados (incluidos + regalías)
deleted_at                TIMESTAMPTZ NULL
created_at                TIMESTAMPTZ
origen                    ENUM(SISTEMA | MIGRACION) DEFAULT SISTEMA
updated_at                TIMESTAMPTZ
```

### 12.5 Tabla: clientes

```
id                      UUID PK
nombre                  VARCHAR NOT NULL
telefono                VARCHAR NOT NULL
whatsapp                VARCHAR NULL
cedula                  VARCHAR NULL
email                   VARCHAR NULL
tipo_cliente            ENUM(PERSONA_NATURAL | EMPRESA)
nombre_empresa          VARCHAR NULL
total_compras           INTEGER DEFAULT 0  -- COMPUTED
valor_total_comprado_usd DECIMAL DEFAULT 0 -- COMPUTED
notas                   TEXT NULL
created_at              TIMESTAMPTZ
```

### 12.6 Tabla: ventas

```
id                            UUID PK
numero_factura                VARCHAR UNIQUE  -- ZLT-2026-0001
numero_garantia               VARCHAR UNIQUE  -- ZLT-GAR-2026-0001
equipo_id                     UUID FK → equipos NOT NULL
cliente_id                    UUID FK → clientes NOT NULL
precio_venta_usd              DECIMAL(10,2) NOT NULL
moneda_cobro                  ENUM(USD | NIO | MIXTO)
monto_cobrado_nio             DECIMAL(12,2) NULL
monto_cobrado_usd_parte       DECIMAL(10,2) NULL
tasa_cambio_aplicada          DECIMAL(8,4) NOT NULL  -- snapshot inmutable de la tasa oficial
ctr_al_momento_usd            DECIMAL(10,2) NOT NULL  -- CTR del equipo congelado al momento de la venta
ganancia_bruta_venta_usd      DECIMAL(10,2)           -- Calculado en backend (precio_venta - ctr_al_momento) y guardado físicamente
porcentaje_inversor_aplicado  DECIMAL(5,2)            -- Copia inmutable del acuerdo del inversor al momento de la venta
ganancia_bruta_inversor_est   DECIMAL(10,2)           -- Ganancia bruta estimada para inversor. No deduce OPEX/pérdidas mensuales.
ganancia_bruta_zeltek_est     DECIMAL(10,2)           -- Ganancia bruta estimada para Zeltek. No deduce OPEX/pérdidas mensuales.
capital_retorno_inversor_usd  DECIMAL(10,2)
reparto_liquidado             BOOLEAN DEFAULT false
fecha_liquidacion             TIMESTAMPTZ NULL
metodo_pago                   ENUM(EFECTIVO | TRANSFERENCIA_BAC | USDT)
referencia_pago               VARCHAR NULL            -- obligatorio para transferencia/USDT
dias_garantia                 INTEGER NOT NULL
garantia_vence                DATE                    -- Calculado en backend (fecha_venta + dias_garantia)
estado_garantia               ENUM(VIGENTE | EXPIRADA | EN_REVISION)  -- Calculado dinámicamente en consultas
evidencia_entrega_url         TEXT NOT NULL           -- foto factura + serial. CONSTRAINT NOT NULL.
justificacion_precio          TEXT NULL               -- obligatorio si el margen de venta < mínimo configurado
pf_tap_ganancia_aplicado      DECIMAL(5,2) NOT NULL   -- snapshot del TAP de ganancia (ej. 10.00)
pf_tap_garantias_aplicado     DECIMAL(5,2) NOT NULL   -- snapshot del TAP de garantías (ej. 5.00)
pf_tap_opex_aplicado          DECIMAL(5,2) NOT NULL   -- snapshot del TAP de OPEX (ej. 30.00)
pf_tap_reparto_aplicado       DECIMAL(5,2) NOT NULL   -- snapshot del TAP de reparto (ej. 55.00)
pf_monto_ganancia_usd         DECIMAL(10,2) NOT NULL  -- ganancia_bruta * pf_tap_ganancia_aplicado / 100
pf_monto_garantias_usd        DECIMAL(10,2) NOT NULL  -- ganancia_bruta * pf_tap_garantias_aplicado / 100
pf_monto_opex_usd             DECIMAL(10,2) NOT NULL  -- ganancia_bruta * pf_tap_opex_aplicado / 100
pf_monto_reparto_usd          DECIMAL(10,2) NOT NULL  -- ganancia_bruta * pf_tap_reparto_aplicado / 100
vendedor_id                   UUID FK → usuarios
fecha_venta                   TIMESTAMPTZ
```

### 12.7 Tabla: reclamos_garantia [ELIMINADA / FUSIONADA]

> **FUSIÓN DE TABLAS**: Esta tabla ha sido eliminada y fusionada con `ordenes_reparacion` (Módulo de Reparaciones). Para registrar un reclamo de garantía de Zeltek, se crea una orden de reparación con `tipo = garantia` y se vincula al `venta_id` correspondiente. Esto elimina la redundancia contable, unifica el flujo técnico del taller y consolida el cálculo de costos de reclamos en una sola base de datos.


### 12.8 Tabla: gastos_operativos

```
id                   UUID PK
concepto             VARCHAR NOT NULL
moneda_original      ENUM(USD | NIO) NOT NULL  -- en qué moneda se pagó realmente
monto_original       DECIMAL(12,2) NOT NULL    -- monto en la moneda original (ej: C$1,700)
tasa_cambio_aplicada DECIMAL(8,4) NULL         -- snapshot de tasa si moneda=NIO
monto_usd            DECIMAL(10,2) NOT NULL    -- si NIO: monto_original / tasa. Si USD: mismo valor
fecha                DATE NOT NULL
categoria            ENUM(LOGISTICA | MARKETING | HERRAMIENTAS | RENTA | SERVICIOS | OTRO)
comprobante_url      TEXT NULL
recurrente           BOOLEAN DEFAULT false
notas                TEXT NULL
registrado_por       UUID FK → usuarios
created_at           TIMESTAMPTZ
```

> **OPEX en dos monedas**: Algunos gastos se pagan en córdobas (transporte C$1,700, internet C$800) y otros en dólares (Amazon Prime $17.03). El sistema guarda el monto en la moneda original + la conversión a USD. Los reportes siempre muestran ambas columnas — exactamente como tu Excel actual.

> **REINTEGRO A CAPITAL**: Los reintegros de capital ya **NO** se registran en esta tabla de gastos operativos. Poseen su propia tabla independiente `reintegros_capital` y su flujo específico para asegurar una trazabilidad contable limpia y evitar duplicidad de deducciones en el P&L mensual.


### 12.9 Tabla: usuarios

```
id                UUID PK
nombre            VARCHAR NOT NULL
email             VARCHAR UNIQUE NOT NULL
password_hash     VARCHAR NOT NULL  -- bcrypt, rounds=12
rol               ENUM(ADMIN | VENDEDOR | TECNICO)
activo            BOOLEAN DEFAULT true
intentos_fallidos INTEGER DEFAULT 0
bloqueado_hasta   TIMESTAMPTZ NULL
ultimo_login      TIMESTAMPTZ NULL
ultimo_login_ip   VARCHAR NULL
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

### 12.10 Tabla: sesiones

```
id                  UUID PK
usuario_id          UUID FK → usuarios
refresh_token_hash  VARCHAR NOT NULL  -- SHA-256, no guardar plano
user_agent          TEXT
ip_address          VARCHAR
expires_at          TIMESTAMPTZ NOT NULL
ultima_actividad    TIMESTAMPTZ
created_at          TIMESTAMPTZ
```

### 12.11 Tabla: login_intentos

```
id               UUID PK
email_intentado  VARCHAR
ip_address       VARCHAR
exitoso          BOOLEAN
user_agent       TEXT
created_at       TIMESTAMPTZ
```

### 12.12 Tabla: historial_estados

```
id              UUID PK
equipo_id       UUID FK → equipos
estado_anterior ENUM
estado_nuevo    ENUM
notas           TEXT NULL
usuario_id      UUID FK → usuarios
created_at      TIMESTAMPTZ
```

### 12.13 Tabla: audit_logs

```
id               UUID PK
usuario_id       UUID FK → usuarios NULL  -- NULL para acciones sistema
accion           ENUM (ver catálogo sección 9.3)
tabla_afectada   VARCHAR NOT NULL
registro_id      UUID NOT NULL
campo_modificado VARCHAR NULL
valor_anterior   JSONB NULL
valor_nuevo      JSONB NULL
ip_address       VARCHAR
user_agent       TEXT
notas            TEXT NULL
created_at       TIMESTAMPTZ  -- inmutable, DEFAULT NOW()
```

### 12.14 Tabla: reportes_generados

```
id                UUID PK
numero_documento  VARCHAR UNIQUE  -- ZLT-EC-2026-001
tipo              ENUM(ESTADO_CUENTA_INVERSOR | REPORTE_VENTAS | REPORTE_OPEX)
inversor_id       UUID FK NULL
periodo_desde     DATE
periodo_hasta     DATE
generado_por      ENUM(USUARIO | N8N_AUTOMATICO)
usuario_id        UUID FK NULL
enviado_email     BOOLEAN DEFAULT false
enviado_whatsapp  BOOLEAN DEFAULT false
created_at        TIMESTAMPTZ
```

### 11.15 Tabla: categorias_accesorio

```
id                          UUID PK
nombre                      VARCHAR UNIQUE NOT NULL
descripcion                 TEXT NULL
requiere_asignacion_equipo  BOOLEAN DEFAULT false
created_at                  TIMESTAMPTZ
```

### 11.16 Tabla: lotes_accesorios

```
id                  UUID PK
numero_lote         VARCHAR UNIQUE        -- ZLT-LOTE-2026-001
categoria_id        UUID FK → categorias_accesorio NOT NULL
descripcion         TEXT
cantidad_total      INTEGER NOT NULL
precio_lote_usd     DECIMAL(10,2) NOT NULL
flete_lote_usd      DECIMAL(10,2) DEFAULT 0
costo_unitario_real DECIMAL(10,2) COMPUTED -- (precio + flete) / cantidad
proveedor           VARCHAR
url_compra          TEXT NULL
inversor_id         UUID FK → inversores NOT NULL
fecha_compra        DATE NOT NULL
notas               TEXT NULL
created_at          TIMESTAMPTZ
```

### 11.17 Tabla: accesorios_inventario

```
id                  UUID PK
lote_id             UUID FK → lotes_accesorios NOT NULL
categoria_id        UUID FK → categorias_accesorio NOT NULL
costo_unitario_usd  DECIMAL(10,2) NOT NULL
estado              ENUM(disponible | asignado_equipo | vendido | defectuoso) NOT NULL
tipo_asignacion     ENUM(incluido | regalia) NULL  -- incluido=cargador, regalia=mouse regalo
equipo_asignado_id  UUID FK → equipos NULL
venta_accesorio_id  UUID FK → ventas_accesorios NULL
notas               TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### 11.18 Tabla: ventas_accesorios

```
id                   UUID PK
numero_factura       VARCHAR UNIQUE   -- ZLT-ACC-2026-001
accesorio_id         UUID FK → accesorios_inventario NOT NULL
cliente_id           UUID FK → clientes NULL
precio_venta_usd     DECIMAL(10,2) NOT NULL
costo_unitario_usd   DECIMAL(10,2) NOT NULL  -- congelado
ganancia_usd         DECIMAL COMPUTED
moneda_cobro         ENUM(USD | NIO | MIXTO)
monto_cobrado_nio    DECIMAL(12,2) NULL
tasa_cambio_aplicada DECIMAL(8,4) NOT NULL
metodo_pago          ENUM(EFECTIVO | TRANSFERENCIA_BAC | USDT)
vendedor_id          UUID FK → usuarios
fecha_venta          TIMESTAMPTZ
```

### 11.19 Tabla: fondos_financieros

```
id              UUID PK
nombre          VARCHAR UNIQUE NOT NULL  -- 'GANANCIA' | 'GARANTIAS' | 'OPEX' | 'REPARTO_SOCIO_A' | 'REPARTO_ZELTEK'
saldo_usd       DECIMAL(10,2) NOT NULL DEFAULT 0
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### 11.20 Tabla: historial_fondos

```
id              UUID PK
fondo_id        UUID FK → fondos_financieros NOT NULL
monto_usd       DECIMAL(10,2) NOT NULL
tipo            ENUM('DEPOSITO', 'RETIRO') NOT NULL
concepto        VARCHAR(255) NOT NULL  -- "Distribución Venta ZLT-2026-0001", "Pago OPEX: Internet"
created_at      TIMESTAMPTZ
```

---

## 11.5 ESQUEMAS DE VALIDACIÓN ZOD (Compartidos)

Para garantizar la integridad total de los datos en ambos extremos (Frontend y Backend), el monorepo comparte los esquemas de validación escritos en **TypeScript** usando la librería **Zod**. Estos esquemas viven en `/shared/schemas/` y son el fundamento del desarrollo basado en especificaciones (Spec-Driven Development).

### 1. `loginSchema` (Autenticación)
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email({ message: 'Debe ser un correo electrónico válido' })
    .min(5, { message: 'El correo debe tener al menos 5 caracteres' }),
  password: z.string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una mayúscula' })
    .regex(/[a-z]/, { message: 'Debe contener al menos una minúscula' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
    .regex(/[^A-Za-z0-9]/, { message: 'Debe contener al menos un carácter especial' }),
});
```

### 2. `equipoSchema` (Ingreso/Edición de Equipos)
```typescript
import { z } from 'zod';

export const equipoSchema = z.object({
  numero_serie: z.string()
    .min(3, { message: 'El número de serie debe tener al menos 3 caracteres' })
    .toUpperCase(),
  marca: z.string().min(2, { message: 'La marca es obligatoria' }),
  modelo: z.string().min(2, { message: 'El modelo es obligatorio' }),
  tipo: z.enum(['laptop', 'telefono', 'tablet', 'otro']),
  condicion: z.enum(['NUEVO', 'SEMINUEVO']),
  inbox_id: z.string().uuid().nullable().optional(),
  inversor_id: z.string().uuid({ message: 'Debe seleccionar un inversor válido' }),
  costo_base_usd: z.number().positive({ message: 'El costo base debe ser un número positivo' }),
  requiere_cargador: z.boolean().default(true),
  procesador: z.string().optional().nullable(),
  ram_gb: z.number().int().positive().optional().nullable(),
  almacenamiento_gb: z.number().int().positive().optional().nullable(),
  tipo_almacenamiento: z.enum(['ssd_nvme', 'ssd_sata', 'hdd']).optional().nullable(),
  bateria_ciclos: z.number().int().nonnegative().optional().nullable(),
  bateria_salud_pct: z.number().int().min(0).max(100).optional().nullable(),
  notas: z.string().optional().nullable(),
});
```

### 3. `clienteSchema` (Registro de Clientes)
```typescript
import { z } from 'zod';

export const clienteSchema = z.object({
  nombre: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres' }),
  telefono: z.string().min(8, { message: 'Número de teléfono inválido (mínimo 8 dígitos)' }),
  whatsapp: z.string().optional().nullable(),
  cedula: z.string()
    .regex(/^[0-9]{3}-[0-9]{6}-[0-9]{4}[A-Z]$/, { message: 'Formato de cédula nicaragüense inválido (ej: 001-250596-0002A)' })
    .optional().nullable(),
  email: z.string().email({ message: 'Correo inválido' }).optional().nullable(),
  tipo_cliente: z.enum(['PERSONA_NATURAL', 'EMPRESA']).default('PERSONA_NATURAL'),
  nombre_empresa: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});
```

### 4. `checkoutSchema` (Checkout Blindado de Venta)
```typescript
import { z } from 'zod';

export const checkoutSchema = z.object({
  cliente_id: z.string().uuid({ message: 'Debe seleccionar un cliente válido' }),
  precio_venta_usd: z.number().positive({ message: 'El precio de venta debe ser mayor a 0' }),
  moneda_cobro: z.enum(['USD', 'NIO', 'MIXTO']),
  monto_cobrado_nio: z.number().nonnegative().optional().nullable(),
  monto_cobrado_usd_parte: z.number().nonnegative().optional().nullable(),
  metodo_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA_BAC', 'USDT']),
  referencia_pago: z.string().optional().nullable()
    .refine((val, ctx) => {
      // Si el pago es transferencia o USDT, la referencia es obligatoria
      const data = ctx.parent; 
      if (data && (data.metodo_pago === 'TRANSFERENCIA_BAC' || data.metodo_pago === 'USDT')) {
        return val && val.trim().length > 0;
      }
      return true;
    }, { message: 'La referencia de pago es obligatoria para transferencias y USDT' }),
  evidencia_entrega_url: z.string().url({ message: 'La foto de evidencia de entrega es obligatoria' }),
  justificacion_precio: z.string().optional().nullable(),
});
```

### 5. `gastoSchema` (Gastos Operativos - OPEX)
```typescript
import { z } from 'zod';

export const opexSchema = z.object({
  concepto: z.string().min(3, { message: 'El concepto debe tener al menos 3 caracteres' }),
  moneda_original: z.enum(['USD', 'NIO']),
  monto_original: z.number().positive({ message: 'El monto debe ser positivo' }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe estar en formato YYYY-MM-DD' }),
  categoria: z.enum(['LOGISTICA', 'MARKETING', 'HERRAMIENTAS', 'RENTA', 'SERVICIOS', 'OTRO']),
  comprobante_url: z.string().url().optional().nullable(),
  recurrente: z.boolean().default(false),
  notas: z.string().optional().nullable(),
});
```

### 6. `reparacionSchema` (Órdenes de Reparación y Garantía)
```typescript
import { z } from 'zod';

export const reparacionSchema = z.object({
  cliente_id: z.string().uuid({ message: 'Cliente inválido' }),
  tipo: z.enum(['externa', 'garantia']),
  venta_id: z.string().uuid().optional().nullable()
    .refine((val, ctx) => {
      // Si la reparación es por garantía de Zeltek, se debe asociar la venta
      const data = ctx.parent;
      if (data && data.tipo === 'garantia') {
        return val && val.trim().length > 0;
      }
      return true;
    }, { message: 'Para reparaciones de garantía se debe vincular la venta original' }),
  equipo_descripcion: z.string().min(5, { message: 'Debe describir la marca, modelo y specs del equipo' }),
  numero_serie_externo: z.string().optional().nullable(),
  falla_reportada: z.string().min(10, { message: 'Describa detalladamente la falla (mínimo 10 caracteres)' }),
  tecnico_id: z.string().uuid().optional().nullable(),
  notas: z.string().optional().nullable(),
});
```

---

## 11.6 CONFIGURACIÓN INICIAL Y DATA SEEDING (BOOTSTRAP)

Para arrancar el sistema en la Fase 0 (Fundación) con los requerimientos exactos del negocio de Zeltek Nicaragua, las tablas maestras y de settings se poblarán en la base de datos PostgreSQL de Supabase mediante un script `prisma/seed.ts`. Esto implementa la configuración inicial aprobada para producción.

### 1. Seed: `settings` (Constantes Financieras y de Logística)
```sql
-- Insertar la configuración inicial del negocio
INSERT INTO settings (clave, valor, tipo, descripcion, created_at, updated_at) VALUES
('tarifa_libra_aerea_usd', '7.10', 'DECIMAL', 'Precio/libra aéreo Miami a Managua ($7.10)', NOW(), NOW()),
('tarifa_libra_maritima_usd', '3.10', 'DECIMAL', 'Precio/libra marítimo ($3.10)', NOW(), NOW()),
('margen_minimo_pct', '25', 'INTEGER', 'Margen de ganancia mínimo aceptado por equipo antes de alerta (25%)', NOW(), NOW()),
('dias_garantia_seminuevo', '120', 'INTEGER', 'Garantía por defecto para laptops/teléfonos semineuvos (4 meses / 120 días)', NOW(), NOW()),
('dias_garantia_nuevo', '365', 'INTEGER', 'Garantía por defecto para laptops/teléfonos nuevos (12 meses / 365 días)', NOW(), NOW()),
('tasa_cambio_oficial', '37.00', 'DECIMAL', 'Tasa oficial NIO/USD inicial para conversiones automáticas', NOW(), NOW()),
('tasa_cambio_fecha', '2026-05-25', 'DATE', 'Fecha de actualización de la tasa', NOW(), NOW()),
('moneda_cobro_local', 'NIO', 'VARCHAR', 'Córdoba Nicaragüense como moneda de cobro local', NOW(), NOW()),
('alerta_inbox_dias', '5', 'INTEGER', 'Días máximos permitidos en inbox sin triage antes de emitir alerta', NOW(), NOW()),
('pf_tap_ganancia', '10.00', 'DECIMAL', 'Profit First TAP: Porcentaje de asignación para el fondo de ganancia (10%)', NOW(), NOW()),
('pf_tap_garantias', '5.00', 'DECIMAL', 'Profit First TAP: Porcentaje de asignación para el fondo de garantías (5%)', NOW(), NOW()),
('pf_tap_opex', '30.00', 'DECIMAL', 'Profit First TAP: Porcentaje de asignación para el fondo de OPEX (30%)', NOW(), NOW()),
('pf_tap_reparto', '55.00', 'DECIMAL', 'Profit First TAP: Porcentaje de asignación para el fondo de reparto de socios (55%)', NOW(), NOW()),
('modo_migracion', 'false', 'BOOLEAN', 'Toggle para desactivar validaciones en importación de datos viejos', NOW(), NOW());
```

### 2. Seed: `inversores` (Cuentas de Capital Iniciales)
Se configuran las dos cuentas iniciales de capital con reparto de ganancia mensual al 50/50:
```sql
-- Insertar inversores iniciales
INSERT INTO inversores (id, nombre, porcentaje_ganancia, telefono, notas, activo, created_at) VALUES
('a3b90df7-512c-497d-aa9f-7d12f3b9c811', 'Socio A', 50.00, NULL, 'Socio inversor inicial (50% de reparto neto mensual)', true, NOW()),
('e5d89cf2-623d-497b-bb8c-8e23f4c0d922', 'Zeltek (Capital Propio)', 50.00, '+505 8888-8888', 'Capital propio de Zeltek Nicaragua (50% de reparto neto mensual)', true, NOW());
```

### 3. Seed: `usuarios` (Primer Administrador)
Se registra el usuario principal del sistema con rol `ADMIN`. La contraseña inicial temporal se hashea con **bcrypt** (salt = 12 rounds) antes de guardarse en base de datos.
* **Nombre:** Administrador
* **Email:** admin@zeltek.nic
* **Rol:** ADMIN
* **Estado:** Activo (activo = true)
```sql
-- Hash bcrypt de contraseña temporal robusta para el primer inicio:
-- Contraseña original: "ZeltekAdmin2026!" -> hash generado en backend
INSERT INTO usuarios (id, nombre, email, password_hash, rol, activo, intentos_fallidos, created_at, updated_at) VALUES
('b2c90ef8-723c-497a-cc9f-9d34f4b0e933', 'Administrador', 'admin@zeltek.nic', '$2a$12$R9h/cIPzVE8.27u1zQ5yOOMW3/G9pD1Q/WvXUv4pXh/lBvC3iJzKm', 'ADMIN', true, 0, NOW(), NOW());
```

### 4. Seed: `fondos_financieros` (Inicialización de Fondos Virtuales)
Se crean los 5 fondos iniciales requeridos por el método Profit First con saldo en cero:
```sql
-- Inicializar los fondos con saldo cero
INSERT INTO fondos_financieros (id, nombre, saldo_usd, created_at, updated_at) VALUES
('f1a90df7-512c-497d-aa9f-7d12f3b9c801', 'GANANCIA', 0.00, NOW(), NOW()),
('f2b90df7-512c-497d-aa9f-7d12f3b9c802', 'GARANTIAS', 0.00, NOW(), NOW()),
('f3c90df7-512c-497d-aa9f-7d12f3b9c803', 'OPEX', 0.00, NOW(), NOW()),
('f4d90df7-512c-497d-aa9f-7d12f3b9c804', 'REPARTO_SOCIO_A', 0.00, NOW(), NOW()),
('f5e90df7-512c-497d-aa9f-7d12f3b9c805', 'REPARTO_ZELTEK', 0.00, NOW(), NOW());
```
```

---

## 11.7 ESQUEMA DE BASE DE DATOS PRISMA REAL (schema.prisma)

Para habilitar una sincronización instantánea y libre de errores en Supabase en la **Fase 0 (Fundación)**, se incluye el esquema de base de datos nativo listo para producción. Este archivo debe colocarse en `/backend/prisma/schema.prisma`. Define las tablas, tipos nativos de PostgreSQL, `ENUMS` específicos y las relaciones declaradas bajo las mejores prácticas de Prisma ORM.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ═══ ENUMS ═══

enum FuenteInbox {
  GMAIL_EBAY
  MANUAL
}

enum EstadoInbox {
  pendiente_triage
  ingresado
  descartado
}

enum TipoEquipo {
  laptop
  telefono
  tablet
  otro
}

enum CondicionEquipo {
  NUEVO
  SEMINUEVO
}

enum EstadoEquipo {
  COMPRADO
  EN_BODEGA_MIAMI
  EN_TRANSITO
  EN_TALLER
  DISPONIBLE
  VENDIDO
  EN_RECLAMO
  DEVUELTO
}

enum TipoEnvio {
  aereo
  maritimo
}

enum EstadoIncidencia {
  DISPUTA_ABIERTA
  RESUELTO
}

enum PlataformaDisputa {
  PAYPAL
  EBAY
  OTRO
}

enum TipoCliente {
  PERSONA_NATURAL
  EMPRESA
}

enum Moneda {
  USD
  NIO
  MIXTO
}

enum MetodoPago {
  EFECTIVO
  TRANSFERENCIA_BAC
  USDT
}

enum CategoriaGasto {
  LOGISTICA
  MARKETING
  HERRAMIENTAS
  RENTA
  SERVICIOS
  OTRO
}

enum MotivoPerdida {
  EXTRAVIO
  ROBO
  DISPUTA_PERDIDA
  DANO_IRREPARABLE
  OTRO
}

enum EstadoPerdida {
  PENDIENTE
  EN_RECUPERACION
  RECUPERADO
}

enum RolUsuario {
  ADMIN
  VENDEDOR
  TECNICO
}

enum OrigenDato {
  SISTEMA
  MIGRACION
}

enum EstadoAccesorio {
  disponible
  asignado_equipo
  vendido
  defectuoso
}

enum TipoAsignacionAccesorio {
  incluido
  regalia
}

enum TipoReparacion {
  externa
  garantia
}

enum EstadoReparacion {
  RECIBIDO
  EN_DIAGNOSTICO
  PRESUPUESTADO
  EN_REPARACION
  LISTO
  ENTREGADO
  CANCELADO
}

enum TipoReporte {
  ESTADO_CUENTA_INVERSOR
  REPORTE_VENTAS
  REPORTE_OPEX
}

enum GeneradorReporte {
  USUARIO
  N8N_AUTOMATICO
}

// ═══ TABLAS ═══

model compras_pendientes {
  id                String            @id @default(uuid()) @db.Uuid
  fuente            FuenteInbox       @default(MANUAL)
  nombre_articulo   String            @db.Text
  precio_usd        Decimal           @db.Decimal(10, 2)
  tracking_number   String?           @unique @db.VarChar(255)
  vendedor_ebay     String?           @db.VarChar(255)
  url_ebay          String?           @db.Text
  raw_email_data    Json?
  estado            EstadoInbox       @default(pendiente_triage)
  descartado_razon  String?           @db.Text
  triaged_at        DateTime?         @db.Timestamptz
  triaged_by        String?           @db.Uuid
  created_at        DateTime          @default(now()) @db.Timestamptz
  
  // Relaciones
  usuario_triage    usuarios?         @relation(fields: [triaged_by], references: [id])
  equipos           equipos[]
}

model inversores {
  id                  String               @id @default(uuid()) @db.Uuid
  nombre              String               @db.VarChar(255)
  porcentaje_ganancia Decimal              @db.Decimal(5, 2)
  telefono            String?              @db.VarChar(50)
  notas               String?              @db.Text
  activo              Boolean              @default(true)
  created_at          DateTime             @default(now()) @db.Timestamptz
  
  // Relaciones
  equipos             equipos[]
  perdidas_capital    perdidas_capital[]
  reintegros_capital  reintegros_capital[]
  lotes_accesorios    lotes_accesorios[]
  reportes_generados  reportes_generados[]
}

model equipos {
  id                          String             @id @default(uuid()) @db.Uuid
  numero_serie                String             @unique @db.VarChar(100)
  inbox_id                    String?            @db.Uuid
  inversor_id                 String             @db.Uuid
  marca                       String             @db.VarChar(100)
  modelo                      String             @db.VarChar(100)
  tipo                        TipoEquipo         @default(laptop)
  condicion                   CondicionEquipo    @default(SEMINUEVO)
  procesador                  String?            @db.VarChar(100)
  ram_gb                      Int?
  almacenamiento_gb           Int?
  tipo_almacenamiento         String?            @db.VarChar(50)
  bateria_ciclos              Int?
  bateria_salud_pct           Int?
  estado                      EstadoEquipo       @default(COMPRADO)
  costo_base_usd              Decimal            @db.Decimal(10, 2)
  peso_real_libras            Decimal?           @db.Decimal(6, 2)
  tipo_envio                  TipoEnvio?         @default(aereo)
  costo_logistico_usd         Decimal?           @db.Decimal(10, 2)
  costo_acondicionamiento_usd Decimal            @default(0) @db.Decimal(10, 2)
  reembolso_parcial_usd       Decimal            @default(0) @db.Decimal(10, 2)
  ctr_usd                     Decimal            @db.Decimal(10, 2)
  precio_venta_sugerido_usd   Decimal            @db.Decimal(10, 2)
  precio_venta_usd            Decimal?           @db.Decimal(10, 2)
  estado_incidencia           EstadoIncidencia?
  plataforma_disputa          PlataformaDisputa?
  notas_resolucion            String?            @db.Text
  foto_urls                   String[]           @default([])
  visible_en_inventario       Boolean            @default(true)
  requiere_cargador           Boolean            @default(true)
  costo_accesorios_usd        Decimal            @default(0) @db.Decimal(10, 2)
  origen                      OrigenDato         @default(SISTEMA)
  deleted_at                  DateTime?          @db.Timestamptz
  created_at                  DateTime           @default(now()) @db.Timestamptz
  updated_at                  DateTime           @updatedAt @db.Timestamptz

  // Relaciones
  inbox                       compras_pendientes? @relation(fields: [inbox_id], references: [id])
  inversor                    inversores         @relation(fields: [inversor_id], references: [id])
  ventas                      ventas?
  historial_estados           historial_estados[]
  accesorios_asignados        accesorios_inventario[]
  perdidas_capital            perdidas_capital[]
}

model clientes {
  id                      String               @id @default(uuid()) @db.Uuid
  nombre                  String               @db.VarChar(255)
  telefono                String               @db.VarChar(50)
  whatsapp                String?              @db.VarChar(50)
  cedula                  String?              @db.VarChar(50)
  email                   String?              @db.VarChar(255)
  tipo_cliente            TipoCliente          @default(PERSONA_NATURAL)
  nombre_empresa          String?              @db.VarChar(255)
  notas                   String?              @db.Text
  created_at              DateTime             @default(now()) @db.Timestamptz
  
  // Relaciones
  ventas                  ventas[]
  ordenes_reparacion      ordenes_reparacion[]
  ventas_accesorios       ventas_accesorios[]
}

model ventas {
  id                            String             @id @default(uuid()) @db.Uuid
  numero_factura                String             @unique @db.VarChar(100)
  numero_garantia               String             @unique @db.VarChar(100)
  equipo_id                     String             @unique @db.Uuid
  cliente_id                    String             @db.Uuid
  precio_venta_usd              Decimal            @db.Decimal(10, 2)
  moneda_cobro                  Moneda             @default(USD)
  monto_cobrado_nio             Decimal?           @db.Decimal(12, 2)
  monto_cobrado_usd_parte       Decimal?           @db.Decimal(10, 2)
  tasa_cambio_aplicada          Decimal            @db.Decimal(8, 4)
  ctr_al_momento_usd            Decimal            @db.Decimal(10, 2)
  ganancia_bruta_venta_usd      Decimal            @db.Decimal(10, 2)
  porcentaje_inversor_aplicado  Decimal            @db.Decimal(5, 2)
  ganancia_bruta_inversor_est   Decimal            @db.Decimal(10, 2)
  ganancia_bruta_zeltek_est     Decimal            @db.Decimal(10, 2)
  capital_retorno_inversor_usd  Decimal            @db.Decimal(10, 2)
  reparto_liquidado             Boolean            @default(false)
  fecha_liquidacion             DateTime?          @db.Timestamptz
  metodo_pago                   MetodoPago
  referencia_pago               String?            @db.VarChar(255)
  dias_garantia                 Int
  garantia_vence                DateTime           @db.Date
  evidencia_entrega_url         String             @db.Text
  justificacion_precio          String?            @db.Text
  pf_tap_ganancia_aplicado      Decimal            @db.Decimal(5, 2)
  pf_tap_garantias_aplicado     Decimal            @db.Decimal(5, 2)
  pf_tap_opex_aplicado          Decimal            @db.Decimal(5, 2)
  pf_tap_reparto_aplicado       Decimal            @db.Decimal(5, 2)
  pf_monto_ganancia_usd         Decimal            @db.Decimal(10, 2)
  pf_monto_garantias_usd        Decimal            @db.Decimal(10, 2)
  pf_monto_opex_usd             Decimal            @db.Decimal(10, 2)
  pf_monto_reparto_usd          Decimal            @db.Decimal(10, 2)
  vendedor_id                   String             @db.Uuid
  fecha_venta                   DateTime           @default(now()) @db.Timestamptz

  // Relaciones
  equipo                        equipos            @relation(fields: [equipo_id], references: [id])
  cliente                       clientes           @relation(fields: [cliente_id], references: [id])
  vendedor                      usuarios           @relation(fields: [vendedor_id], references: [id])
  ordenes_reparacion_garantia   ordenes_reparacion[]
}

model ordenes_reparacion {
  id                    String            @id @default(uuid()) @db.Uuid
  numero_orden          String            @unique @db.VarChar(100)
  cliente_id            String            @db.Uuid
  tipo                  TipoReparacion    @default(externa)
  venta_id              String?           @db.Uuid
  equipo_descripcion    String            @db.Text
  numero_serie_externo  String?           @db.VarChar(100)
  falla_reportada       String            @db.Text
  diagnostico_tecnico   String?           @db.Text
  estado                EstadoReparacion  @default(RECIBIDO)
  presupuesto_usd       Decimal?          @db.Decimal(10, 2)
  aprobado_cliente      Boolean?
  costo_repuestos_usd   Decimal           @default(0) @db.Decimal(10, 2)
  costo_mano_obra_usd   Decimal           @default(0) @db.Decimal(10, 2)
  costo_total_usd       Decimal           @db.Decimal(10, 2)
  precio_cobrado_usd    Decimal?          @db.Decimal(10, 2)
  metodo_pago           MetodoPago?
  moneda_cobro          Moneda?
  tasa_cambio_aplicada  Decimal?          @db.Decimal(8, 4)
  tecnico_id            String?           @db.Uuid
  fecha_recepcion       DateTime          @default(now()) @db.Timestamptz
  fecha_diagnostico     DateTime?         @db.Timestamptz
  fecha_entrega         DateTime?         @db.Timestamptz
  notas                 String?           @db.Text
  created_at            DateTime          @default(now()) @db.Timestamptz
  updated_at            DateTime          @updatedAt @db.Timestamptz

  // Relaciones
  cliente               clientes          @relation(fields: [cliente_id], references: [id])
  venta_original        ventas?           @relation(fields: [venta_id], references: [id])
  tecnico               usuarios?         @relation(fields: [tecnico_id], references: [id])
}

model gastos_operativos {
  id                   String          @id @default(uuid()) @db.Uuid
  concepto             String          @db.VarChar(255)
  moneda_original      Moneda          @default(USD)
  monto_original       Decimal         @db.Decimal(12, 2)
  tasa_cambio_aplicada Decimal?        @db.Decimal(8, 4)
  monto_usd            Decimal         @db.Decimal(10, 2)
  fecha                DateTime        @db.Date
  categoria            CategoriaGasto  @default(OTRO)
  comprobante_url      String?         @db.Text
  recurrente           Boolean         @default(false)
  notas                String?         @db.Text
  registrado_por       String          @db.Uuid
  created_at           DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  usuario              usuarios        @relation(fields: [registrado_por], references: [id])
}

model perdidas_capital {
  id                    String          @id @default(uuid()) @db.Uuid
  inversor_id           String          @db.Uuid
  equipo_id             String?         @db.Uuid
  motivo                MotivoPerdida
  descripcion           String          @db.Text
  monto_perdido_usd     Decimal         @db.Decimal(10, 2)
  monto_reintegrado_usd Decimal         @default(0) @db.Decimal(10, 2)
  estado                EstadoPerdida   @default(PENDIENTE)
  fecha_perdida         DateTime        @db.Date
  fecha_recuperacion    DateTime?       @db.Date
  registrado_por       String          @db.Uuid
  created_at            DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  inversor              inversores      @relation(fields: [inversor_id], references: [id])
  equipo                equipos?        @relation(fields: [equipo_id], references: [id])
  usuario               usuarios        @relation(fields: [registrado_por], references: [id])
  reintegros            reintegros_capital[]
}

model reintegros_capital {
  id                  String          @id @default(uuid()) @db.Uuid
  perdida_id          String          @db.Uuid
  inversor_id         String          @db.Uuid
  monto_usd           Decimal         @db.Decimal(10, 2)
  mes_aplicado        DateTime        @db.Date
  notas               String?         @db.Text
  registrado_por       String          @db.Uuid
  created_at          DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  perdida             perdidas_capital @relation(fields: [perdida_id], references: [id])
  inversor            inversores       @relation(fields: [inversor_id], references: [id])
  usuario             usuarios         @relation(fields: [registrado_por], references: [id])
}

model usuarios {
  id                String             @id @default(uuid()) @db.Uuid
  nombre            String             @db.VarChar(255)
  email             String             @unique @db.VarChar(255)
  password_hash     String             @db.VarChar(255)
  rol               RolUsuario         @default(VENDEDOR)
  activo            Boolean            @default(true)
  intentos_fallidos Int                @default(0)
  bloqueado_hasta   DateTime?          @db.Timestamptz
  ultimo_login      DateTime?          @db.Timestamptz
  ultimo_login_ip   String?            @db.VarChar(45)
  created_at        DateTime           @default(now()) @db.Timestamptz
  updated_at        DateTime           @updatedAt @db.Timestamptz

  // Relaciones
  compras_triage      compras_pendientes[]
  ventas_registradas  ventas[]
  ordenes_reparacion  ordenes_reparacion[]
  gastos_registrados  gastos_operativos[]
  perdidas_registradas perdidas_capital[]
  reintegros_registrados reintegros_capital[]
  ventas_accesorios   ventas_accesorios[]
  sesiones            sesiones[]
  historial_estados   historial_estados[]
  reportes_generados  reportes_generados[]
}

model sesiones {
  id                  String          @id @default(uuid()) @db.Uuid
  usuario_id          String          @db.Uuid
  refresh_token_hash  String          @db.VarChar(255)
  user_agent          String?         @db.Text
  ip_address          String?         @db.VarChar(45)
  expires_at          DateTime        @db.Timestamptz
  ultima_actividad    DateTime        @default(now()) @db.Timestamptz
  created_at          DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  usuario             usuarios        @relation(fields: [usuario_id], references: [id], onDelete: Cascade)
}

model login_intentos {
  id               String          @id @default(uuid()) @db.Uuid
  email_intentado  String          @db.VarChar(255)
  ip_address       String?         @db.VarChar(45)
  exitoso          Boolean
  user_agent       String?         @db.Text
  created_at       DateTime        @default(now()) @db.Timestamptz
}

model historial_estados {
  id              String          @id @default(uuid()) @db.Uuid
  equipo_id       String          @db.Uuid
  estado_anterior EstadoEquipo
  estado_nuevo    EstadoEquipo
  notas           String?         @db.Text
  usuario_id      String          @db.Uuid
  created_at      DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  equipo          equipos         @relation(fields: [equipo_id], references: [id])
  usuario         usuarios        @relation(fields: [usuario_id], references: [id])
}

model audit_logs {
  id               String          @id @default(uuid()) @db.Uuid
  usuario_id       String?         @db.Uuid
  accion           String          @db.VarChar(100)
  tabla_afectada   String          @db.VarChar(100)
  registro_id      String          @db.Uuid
  campo_modificado String?         @db.VarChar(100)
  valor_anterior   Json?
  valor_nuevo      Json?
  ip_address       String?         @db.VarChar(45)
  user_agent       String?         @db.Text
  notas            String?         @db.Text
  created_at       DateTime        @default(now()) @db.Timestamptz
}

model reportes_generados {
  id                String            @id @default(uuid()) @db.Uuid
  numero_documento  String            @unique @db.VarChar(100)
  tipo              TipoReporte
  inversor_id       String?           @db.Uuid
  periodo_desde     DateTime          @db.Date
  periodo_hasta     DateTime          @db.Date
  generado_por      GeneradorReporte  @default(USUARIO)
  usuario_id        String?           @db.Uuid
  enviado_email     Boolean           @default(false)
  enviado_whatsapp  Boolean           @default(false)
  created_at        DateTime          @default(now()) @db.Timestamptz

  // Relaciones
  inversor          inversores?       @relation(fields: [inversor_id], references: [id])
  usuario           usuarios?         @relation(fields: [usuario_id], references: [id])
}

model categorias_accesorio {
  id                          String                 @id @default(uuid()) @db.Uuid
  nombre                      String                 @unique @db.VarChar(100)
  descripcion                 String?                @db.Text
  requiere_asignacion_equipo  Boolean                @default(false)
  created_at                  DateTime               @default(now()) @db.Timestamptz
  
  // Relaciones
  lotes                       lotes_accesorios[]
  inventarios                 accesorios_inventario[]
}

model lotes_accesorios {
  id                  String               @id @default(uuid()) @db.Uuid
  numero_lote         String               @unique @db.VarChar(100)
  categoria_id        String               @db.Uuid
  descripcion         String               @db.Text
  cantidad_total      Int
  precio_lote_usd     Decimal              @db.Decimal(10, 2)
  flete_lote_usd      Decimal              @default(0) @db.Decimal(10, 2)
  costo_unitario_real Decimal              @db.Decimal(10, 2)
  proveedor           String               @db.VarChar(255)
  url_compra          String?              @db.Text
  inversor_id         String               @db.Uuid
  fecha_compra        DateTime             @db.Date
  notas               String?              @db.Text
  created_at          DateTime             @default(now()) @db.Timestamptz

  // Relaciones
  categoria           categorias_accesorio @relation(fields: [categoria_id], references: [id])
  inversor            inversores           @relation(fields: [inversor_id], references: [id])
  inventarios         accesorios_inventario[]
}

model accesorios_inventario {
  id                  String                   @id @default(uuid()) @db.Uuid
  lote_id             String                   @db.Uuid
  categoria_id        String                   @db.Uuid
  costo_unitario_usd  Decimal                  @db.Decimal(10, 2)
  estado              EstadoAccesorio          @default(disponible)
  tipo_asignacion     TipoAsignacionAccesorio?
  equipo_asignado_id  String?                  @db.Uuid
  venta_accesorio_id  String?                  @db.Uuid
  notas               String?                  @db.Text
  created_at          DateTime                 @default(now()) @db.Timestamptz
  updated_at          DateTime                 @updatedAt @db.Timestamptz

  // Relaciones
  lote                lotes_accesorios         @relation(fields: [lote_id], references: [id], onDelete: Cascade)
  categoria           categorias_accesorio     @relation(fields: [categoria_id], references: [id])
  equipo_asignado     equipos?                 @relation(fields: [equipo_asignado_id], references: [id])
  venta_accesorio     ventas_accesorios?       @relation(fields: [venta_accesorio_id], references: [id])
}

model ventas_accesorios {
  id                   String          @id @default(uuid()) @db.Uuid
  numero_factura       String          @unique @db.VarChar(100)
  cliente_id           String?         @db.Uuid
  precio_venta_usd     Decimal         @db.Decimal(10, 2)
  monto_cobrado_nio    Decimal?        @db.Decimal(12, 2)
  tasa_cambio_aplicada Decimal         @db.Decimal(8, 4)
  moneda_cobro         Moneda          @default(USD)
  metodo_pago          MetodoPago
  vendedor_id          String          @db.Uuid
  fecha_venta          DateTime        @default(now()) @db.Timestamptz

  // Relaciones
  cliente              clientes?       @relation(fields: [cliente_id], references: [id])
  vendedor             usuarios        @relation(fields: [vendedor_id], references: [id])
  accesorios           accesorios_inventario[]
}

model catalogo_productos {
  id                        String      @id @default(uuid()) @db.Uuid
  nombre                    String      @db.VarChar(255)
  marca                     String      @db.VarChar(100)
  tipo                      TipoEquipo  @default(laptop)
  categoria                 String?     @db.VarChar(100)
  especificaciones_default  Json?
  precio_venta_sugerido_usd Decimal?    @db.Decimal(10, 2)
  activo                    Boolean     @default(true)
  notas                     String?     @db.Text
  created_at                DateTime    @default(now()) @db.Timestamptz
}

model settings {
  clave       String   @id @db.VarChar(100)
  valor       String   @db.Text
  tipo        String   @db.VarChar(50)
  descripcion String   @db.Text
  created_at  DateTime @default(now()) @db.Timestamptz
  updated_at  DateTime @updatedAt @db.Timestamptz
}

model fondos_financieros {
  id          String             @id @default(uuid()) @db.Uuid
  nombre      String             @unique @db.VarChar(100) // 'GANANCIA' | 'GARANTIAS' | 'OPEX' | 'REPARTO_SOCIO_A' | 'REPARTO_ZELTEK'
  saldo_usd   Decimal            @default(0) @db.Decimal(10, 2)
  created_at  DateTime           @default(now()) @db.Timestamptz
  updated_at  DateTime           @updatedAt @db.Timestamptz
  
  // Relaciones
  historial   historial_fondos[]
}

model historial_fondos {
  id          String             @id @default(uuid()) @db.Uuid
  fondo_id    String             @db.Uuid
  monto_usd   Decimal            @db.Decimal(10, 2)
  tipo        String             @db.VarChar(10) // 'DEPOSITO' | 'RETIRO'
  concepto    String             @db.VarChar(255)
  created_at  DateTime           @default(now()) @db.Timestamptz

  // Relaciones
  fondo       fondos_financieros @relation(fields: [fondo_id], references: [id], onDelete: Cascade)
}
```

---

## 12. API REST — ENDPOINTS COMPLETOS

Base URL: `https://api.zeltek.nic/api/v1/`

Convenciones:
- Respuestas: `{ success, data, error, meta }`
- Auth: Bearer token JWT en cookie (automático).
- Paginación: `?page=1&limit=20`
- Fechas: ISO 8601.

### 12.1 Auth

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /auth/login | Login. Rate limited. |
| POST | /auth/logout | Cerrar sesión. |
| POST | /auth/logout-all | Cerrar todas las sesiones. |
| POST | /auth/refresh | Renovar AT con RT. |
| GET | /auth/me | Datos usuario autenticado. |
| GET | /auth/sesiones | Sesiones activas. |
| DELETE | /auth/sesiones/:id | Cerrar sesión específica. |
| PATCH | /auth/password | Cambiar password. |
| GET | /auth/intentos | Log de intentos. ADMIN. |

### 12.2 Inbox

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /inbox | n8n deposita correo. API key. |
| GET | /inbox | Lista pendientes triage. ADMIN. |
| POST | /inbox/:id/ingresar | Triage: ingresa a inventario. |
| POST | /inbox/:id/descartar | Triage: descarta. |

### 12.3 Equipos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /equipos | Listar con filtros. |
| GET | /equipos/disponibles | Inventario disponible con CTR. |
| GET | /equipos/:id | Detalle + historial estados. |
| GET | /equipos/serie/:serie | Buscar por serial. |
| POST | /equipos | Crear (solo desde triage). |
| PATCH | /equipos/:id | Actualizar campos. |
| PATCH | /equipos/:id/estado | Cambiar estado via StateMachine. |
| POST | /equipos/:id/fotos | Upload a Cloudinary. |
| POST | /equipos/:id/reclamo | Abrir disputa. |

### 12.4 Ventas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /ventas | Checkout completo (4 pasos). |
| GET | /ventas | Historial con filtros. |
| GET | /ventas/:id/factura | Regenerar PDF factura. |
| PATCH | /ventas/:id/liquidar | Marcar reparto como liquidado. |

### 12.5 Clientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /clientes | Listar con búsqueda. |
| POST | /clientes | Crear. También inline en checkout. |
| GET | /clientes/:id/historial | Compras y estado garantía. |

### 12.6 Garantías y Consultas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /garantias/verificar/:numero | Estado de garantía de un equipo (serial o factura). |
| POST | /reparaciones | Abrir caso de garantía. Se crea una orden de reparación con `tipo = garantia` y se asocia el `venta_id`. |
| GET | /reparaciones?tipo=garantia | Listar reclamos de garantía activos (órdenes de reparación de tipo garantia). |


### 12.7 Inversores

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /inversores | Listar activos. |
| POST | /inversores | Crear. ADMIN. |
| GET | /inversores/:id/reporte | JSON estado de cuenta. |
| GET | /inversores/reporte-mensual | Para n8n F-02. |

### 12.8 Gastos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /gastos | Listar con filtros mes/categoría. |
| POST | /gastos | Registrar gasto. |

### 12.9 Settings y Dashboard

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /settings | Toda la configuración. ADMIN. |
| PATCH | /settings/:clave | Actualizar un setting. |
| GET | /settings/tasa-cambio | Tasa actual y fecha. |
| PATCH | /settings/tasa-cambio | Actualizar tasa. |
| GET | /dashboard/kpis | KPIs en tiempo real. |


### 12.10 Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /reportes/generar-pdf | Solo n8n (API Key). JSON → PDF. |
| POST | /reportes/marcar-enviado | n8n confirma envío. |
| GET | /reportes/historial | Reportes generados. ADMIN. |
| GET | /reports/income-statement | P&L Statement. |
| POST | /reports/income-statement/pdf | PDF del P&L. |

### 12.11 Accesorios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /accesorios/categorias | Listar categorías. |
| POST | /accesorios/categorias | Crear categoría. ADMIN. |
| GET | /accesorios/lotes | Listar lotes con stock restante. |
| POST | /accesorios/lotes | Crear lote — genera N unidades. |
| GET | /accesorios | Inventario con filtros: categoría, estado. |
| GET | /accesorios/disponibles | Disponibles agrupado por categoría. |
| POST | /accesorios/:id/asignar/:equipoId | Asignar a equipo. Body: { tipo: "incluido" o "regalia" }. Recalcula CTR. |
| POST | /accesorios/:id/desasignar | Devolver a disponible. Recalcula CTR. |
| POST | /accesorios/:id/vender | Venta suelta. |
| GET | /accesorios/stock-report | Reporte stock por categoría. |

### 12.12 Auditoría

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /audit-logs | Historial completo. ADMIN. |
| GET | /audit-logs/equipo/:id | Historial de un equipo. |

---

## 13. DASHBOARD — KPIs FINANCIEROS

| KPI | Fórmula |
|-----|---------|
| Capital en Tránsito | SUM(costo_base_usd) WHERE estado IN (COMPRADO, EN_BODEGA_MIAMI, EN_TRANSITO) |
| Valor Inventario Activo | SUM(ctr_usd) WHERE estado IN (EN_TALLER, DISPONIBLE) |
| **Ingresos Reales del Mes (Ganancia Bruta)** | **Σ(precio_venta_usd − CTR) de todos los productos vendidos en el mes + Σ ganancia accesorios sueltos** |
| Saldo Fondo de Ganancia (Reserva) | `saldo_usd` WHERE nombre = 'GANANCIA' |
| Saldo Fondo de Garantías | `saldo_usd` WHERE nombre = 'GARANTIAS' |
| Saldo Fondo de OPEX (Disponible) | `saldo_usd` WHERE nombre = 'OPEX' |
| Saldo Fondo Reparto Socio A | `saldo_usd` WHERE nombre = 'REPARTO_SOCIO_A' |
| Saldo Fondo Reparto Zeltek | `saldo_usd` WHERE nombre = 'REPARTO_ZELTEK' |
| **Alerta Sobregiro OPEX** | **Muestra alerta roja en Dashboard si Saldo Fondo de OPEX < $0.00** |
| OPEX Gastado (mes) | SUM(monto_usd) de gastos_operativos WHERE fecha >= inicio_mes |
| Costo Reclamos / Garantía (mes) | SUM(costo_total_usd) de ordenes_reparacion WHERE tipo = garantia AND estado = ENTREGADO AND fecha_entrega >= inicio_mes |
| ⚠️ Capital Perdido Pendiente | SUM(saldo_pendiente_usd) de perdidas_capital WHERE estado != RECUPERADO |
| Garantías Activas en Taller | COUNT(*) de ordenes_reparacion WHERE tipo = garantia AND estado NOT IN (ENTREGADO, CANCELADO) |
| Garantías por Vencer | COUNT(*) de ventas WHERE garantia_vence BETWEEN NOW() AND NOW() + 15 días |
| Inbox Pendiente | COUNT(*) de compras_pendientes WHERE estado = pendiente_triage |
| Stock Accesorios | COUNT(*) por categoría de accesorios_inventario WHERE estado = disponible |
| Alerta Stock Bajo | Categorías de accesorios con ≤ 3 unidades disponibles |

---

## 14. ARQUITECTURA Y ESTRUCTURA DEL MONOREPO

### 15.1 Clean Architecture

| Capa | Responsabilidad |
|------|----------------|
| Domain | Entidades, interfaces, reglas de negocio puras |
| Application | Casos de uso (registrar compra, cambiar estado, checkout) |
| Infrastructure | PostgreSQL/Prisma, Cloudinary, email, n8n |
| Presentation | React (frontend) y Express routes (API) |

### 15.2 Estructura del Repositorio

```
zeltek-erp/
├── frontend/                    # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── features/            # Por módulo
│   │   │   ├── dashboard/
│   │   │   ├── inbox/
│   │   │   ├── inventario/
│   │   │   │   ├── components/  # Componentes UI del módulo
│   │   │   │   ├── hooks/       # useEquipos, useEstadoMachine
│   │   │   │   └── pages/       # Páginas del módulo
│   │   │   ├── reparaciones/
│   │   │   ├── ventas/
│   │   │   ├── productos/
│   │   │   ├── compras/
│   │   │   ├── accesorios/
│   │   │   ├── gastos/
│   │   │   ├── garantias/
│   │   │   ├── inversores/
│   │   │   ├── reportes/
│   │   │   ├── usuarios/
│   │   │   ├── configuracion/
│   │   │   └── settings/
│   │   ├── components/          # UI compartida: Button, Card, Table, Modal
│   │   ├── hooks/               # Hooks globales: useAuth, useSesion
│   │   ├── stores/              # Zustand stores
│   │   ├── lib/                 # API client, formatters, utils
│   │   │   ├── api.ts           # Axios client con interceptors
│   │   │   ├── exportarExcel.ts # SheetJS helper
│   │   │   └── comprimirImagen.ts # WebP compression
│   │   └── shared/
│   │       ├── components/
│   │       │   ├── EscanerSerial.tsx
│   │       │   └── EstadoBadge.tsx
│   │       └── pdf/
│   │           └── EstadoCuentaPDF.tsx  # Compartido con backend
│   ├── tailwind.config.ts
│   └── globals.css
│
├── backend/                     # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── domain/              # Entidades y reglas puras
│   │   │   ├── equipos/
│   │   │   │   └── EquipoStateMachine.ts
│   │   │   ├── ventas/
│   │   │   └── inversores/
│   │   ├── application/         # Casos de uso
│   │   │   ├── registrarVenta.ts
│   │   │   ├── triageInbox.ts
│   │   │   └── calcularCTR.ts
│   │   ├── infrastructure/      # Implementaciones externas
│   │   │   ├── prisma/
│   │   │   ├── cloudinary/
│   │   │   ├── auth/
│   │   │   │   └── cookieConfig.ts
│   │   │   └── audit/
│   │   │       └── auditLogger.ts
│   │   └── presentation/        # Express routes
│   │       ├── routes/
│   │       │   ├── auth.routes.ts
│   │       │   ├── equipos.routes.ts
│   │       │   ├── ventas.routes.ts
│   │       │   ├── inbox.routes.ts
│   │       │   └── reportes.routes.ts
│   │       └── middleware/
│   │           ├── verificaAuth.ts
│   │           └── verificaRol.ts
│   └── prisma/
│       └── schema.prisma
│
└── shared/                      # Compartido frontend + backend
    ├── types/                   # TypeScript interfaces
    │   ├── equipo.ts
    │   ├── venta.ts
    │   ├── cliente.ts
    │   └── inversor.ts
    └── schemas/                 # Zod validation schemas
        ├── equipoSchema.ts
        ├── ventaSchema.ts
        └── clienteSchema.ts
```

### 15.3 Stack Técnico

| Categoría | Tecnología | Rol |
|-----------|-----------|-----|
| Frontend | React 18 + TypeScript + Vite | SPA con rutas protegidas |
| UI | shadcn/ui + Tailwind CSS | Dark mode nativo |
| Estado | Zustand | Estado global (user, filtros) |
| Forms | React Hook Form + Zod | Validación compartida |
| Backend | Node.js + Express | API REST (Serverless) |
| ORM | Prisma | Migraciones y queries tipadas |
| BD | PostgreSQL (Supabase) | Base de datos principal (Free Tier - 500MB) |
| Storage | Supabase Storage | Fotos de equipos y evidencias (Free Tier - 1GB) |
| Auth helpers | @supabase/supabase-js | Client para Storage y funciones auxiliares |
| Auth | JWT + bcrypt | Cookies HttpOnly |
| Hosting FE | Vercel (free) | SSL automático y dominio propio (.nic) sin costo |
| Hosting BE | Vercel Serverless (free) | Express API envuelto en Serverless Functions (Costo $0, sin suspensión) |
| Fotos | Cloudinary (free 25GB) | Alternativa/extra para almacenamiento de imágenes |
| PDF | react-pdf | Facturas, estados de cuenta generados en frontend |
| Excel | SheetJS (xlsx) | Exportación en frontend (sin consumir servidor) |
| Escáner | @zxing/browser | Lectura de códigos de barras desde cámara móvil/desktop |
| Íconos | Lucide React | Outline style |
| Automatización | Google Apps Script / n8n self-hosted | GAS (Gmail detecta correos eBay y envía POST, gratis) o n8n local |

---

## 15. DESIGN SYSTEM — DARK MODE UI/UX

### 15.1 Paleta de Colores

| Token | Hex | Tailwind | Uso |
|-------|-----|---------|-----|
| App Background | #0F1117 | bg-slate-950 | Fondo base |
| Surface/Cards | #1A1F2E | bg-slate-900 | Cards, sidebar, modales |
| Sidebar | #141824 | bg-slate-950/80 | Panel navegación |
| Primary Accent | #7C3AED | bg-violet-600 | Botones primarios, nav activo |
| Hover/Links | #818CF8 | text-indigo-400 | Links, hover states |
| Positivo/Ingresos | #34D399 | text-emerald-400 | KPIs ganancias, DISPONIBLE |
| Alertas/Reclamos | #F43F5E | text-rose-500 | Reclamos, EN_RECLAMO |
| Advertencias | #FBBF24 | text-amber-400 | Inbox pendiente, tasa vieja |
| Info/Tránsito | #60A5FA | text-blue-400 | EN_TRANSITO |
| Texto Principal | #F1F5F9 | text-slate-100 | Títulos, valores |
| Texto Secundario | #94A3B8 | text-slate-400 | Labels, captions |
| Borde Sutil | #1E293B | border-slate-800 | Bordes cards, divisores |

### 15.2 Componentes

| Componente | Clases Tailwind |
|-----------|----------------|
| Card | `bg-slate-900 rounded-2xl border border-slate-800` |
| Button Primary | `bg-violet-600 hover:bg-violet-500 rounded-xl` |
| Button Secondary | `bg-slate-800 hover:bg-slate-700 rounded-xl` |
| Input | `bg-slate-800 border-slate-700 rounded-xl` |
| Table | `bg-slate-900` headers `text-slate-400 text-xs` |
| Modal | `bg-slate-900 rounded-2xl border-slate-800` overlay `bg-black/60 backdrop-blur-sm` |
| Sidebar Activo | `bg-violet-600 text-white rounded-xl` |
| Sidebar Inactivo | `text-slate-400 hover:text-slate-100 hover:bg-slate-800` |

### 15.3 Badges de Estado

| Estado | Background | Texto |
|--------|-----------|-------|
| COMPRADO | bg-yellow-950/50 | text-amber-400 |
| EN_BODEGA_MIAMI | bg-orange-950/50 | text-orange-400 |
| EN_TRANSITO | bg-blue-950/50 | text-blue-400 |
| EN_TALLER | bg-violet-950/50 | text-violet-400 |
| DISPONIBLE | bg-emerald-950/50 | text-emerald-400 |
| VENDIDO | bg-slate-800 | text-slate-300 |
| EN_RECLAMO | bg-rose-950/50 | text-rose-400 |
| DEVUELTO | bg-slate-900 | text-slate-500 line-through |

### 15.4 Layout Responsive

| Breakpoint | Sidebar |
|-----------|---------|
| Desktop ≥1024px | Fijo izquierdo 256px |
| Tablet 768–1023px | Colapsado solo íconos 64px |
| Mobile < 768px | Bottom Navigation Bar (5 ítems) |

### 15.5 Iconos (Lucide React)

Dashboard=LayoutDashboard, Inbox=Inbox, Inventario=Monitor, Reparaciones=Wrench, Ventas=ShoppingCart, Productos=Package, Compras=ShoppingBag, Clientes=Users, Garantías=ShieldAlert, Inversores=TrendingUp, Gastos=Receipt, Reportes=BarChart3, Usuarios=UserCog, Configuración=Settings2, Escáner=ScanLine, Excel=FileSpreadsheet, PDF=FileDown, WhatsApp=Share2, Alerta=AlertTriangle, Logout=LogOut.

### 15.6 Tipografía

```
Font principal: Inter (sans-serif)
Font código: JetBrains Mono (monospace)
KPI Value: text-3xl font-bold
Page Title: text-2xl font-bold
Section: text-lg font-semibold
Body: text-sm
Caption: text-xs text-slate-400
Serial/Factura: font-mono text-sm
```

### 15.7 Tailwind Config

```typescript
// tailwind.config.ts
export default {
  darkMode: ['class'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'app-bg':      '#0F1117',
        'app-surface': '#1A1F2E',
        'app-sidebar': '#141824',
        'app-border':  '#1E293B',
        'brand':       '#7C3AED',
        'brand-light': '#818CF8',
        'success':     '#34D399',
        'danger':      '#F43F5E',
        'warning':     '#FBBF24',
        'info':        '#60A5FA',
      },
      borderRadius: { card: '16px', btn: '12px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
}
```

---

## 16. FASES DE DESARROLLO

| # | Fase | Entregables | Duración |
|---|------|-------------|----------|
| 0 | Fundación | Monorepo, PostgreSQL Supabase, Express+Prisma, React+Vite, deploy Vercel (FE & BE Serverless) | 1 sem |
| 1 | Auth y Sesiones | Login cookies HttpOnly, doble token, roles, bloqueo, pantalla login | 1 sem |
| 2 | Inbox (Compras) | compras_pendientes, POST /inbox, UI triage, deduplicación, script GAS F-01 | 1.5 sem |
| 3 | Inventario + Estados | Tabla equipos + inversor_id, StateMachine, fotos, CTR, settings | 2 sem |
| 4 | Dashboard KPIs | 12 KPIs, badges inbox/taller, vista móvil optimizada | 1 sem |
| 5 | Clientes + Checkout | Tabla clientes, checkout 4 pasos, foto evidencia, factura PDF, reparto | 2 sem |
| 6 | Garantías + Taller | Módulo reparaciones (tipo=garantia), impacto rentabilidad, alertas | 1 sem |
| 7 | OPEX + Inversores | gastos_operativos, panel inversor, liquidar capital, historial | 1 sem |
| 8 | Reportes + Export | Estado cuenta PDF, Excel SheetJS, P&L Statement | 1.5 sem |
| 9 | Automatización | Google Apps Script (eBay Inbox, alertas, cierres de mes) | 1 sem |

**Total estimado: 13–14 semanas**

---

## 17. PROTOCOLO CLAUDE CODE

### 17.1 Prompt de Contexto

```
# CONTEXTO — ERP Zeltek Nicaragua v2.5
# Adjuntar ZELTEK_ERP_SDD.md como referencia

Proyecto: ERP Zeltek Nicaragua
Stack: React 18 + TS | Node.js + Express | PostgreSQL + Prisma
Arquitectura: Clean Architecture + DDD
Monorepo: /frontend | /backend | /shared
Design System: Dark Mode Navy/Slate + Violet accent + shadcn/ui

Sesión actual:
  Fase: [NÚMERO Y NOMBRE]
  Tarea: [DESCRIPCIÓN EXACTA]

Reglas de código:
  - TypeScript estricto: cero "any"
  - Validar con Zod (schemas en /shared/schemas)
  - Variables/funciones en español (DDD)
  - Lógica de negocio solo en /domain y /application
  - Cero lógica de negocio en routes ni componentes React
  - Manejo de errores explícito en async/await
  - Toda acción registrada en audit_logs
  - Imágenes comprimidas a WebP antes de subir
  - Colores solo de los tokens del Design System
```

### 17.2 Reglas para Claude Code

1. **Antes de crear un archivo**: verificar que la funcionalidad está en el SDD.
2. **Antes de crear una tabla**: verificar que está definida en la sección 10.
3. **Antes de crear un endpoint**: verificar que está en la sección 11.
4. **Usar los tipos de `/shared/types/`** — nunca definir interfaces inline.
5. **Validar con Zod** de `/shared/schemas/` — frontend y backend usan el mismo schema.
6. **Cambios de estado** solo via `EquipoStateMachine` — nunca UPDATE directo.
7. **Toda transacción financiera** registra en `audit_logs` — sin excepciones.
8. **Componentes UI** usan los tokens del Design System (sección 14) — nunca colores hardcodeados.

### 17.3 Checklist por Módulo

- [ ] StateMachine rechaza transiciones inválidas con error 422
- [ ] CTR se recalcula al cambiar peso/acondicionamiento
- [ ] EN_TALLER → DISPONIBLE bloqueado sin peso, sin foto, y sin cargador (si requiere)
- [ ] Asignar accesorio a equipo suma costo al CTR automáticamente
- [ ] Accesorio asignado no puede venderse suelto ni asignarse a otro equipo
- [ ] Lote de accesorios genera N unidades individuales en inventario
- [ ] Alerta cuando stock de una categoría de accesorio ≤ 3
- [ ] Venta no puede completarse sin evidencia_entrega_url
- [ ] KPIs usan las fórmulas exactas de la sección 12
- [ ] Inbox rechaza tracking duplicado
- [ ] DEVUELTO reduce gasto mensual automáticamente
- [ ] Settings se cambian sin código ni deploy
- [ ] Toda transición en historial_estados con usuario y timestamp
- [ ] Toda acción en audit_logs
- [ ] Funciona en celular (375px)
- [ ] Dark mode con tokens del design system

---

## 18. VARIABLES DE ENTORNO (.env)

El archivo `.env` vive en `/backend/.env` y **NUNCA se sube al repositorio** (está en `.gitignore`).

```env
# ═══ SUPABASE (PostgreSQL) ═══
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
# DATABASE_URL usa el connection pooler (puerto 6543) — para la app
# DIRECT_URL usa conexión directa (puerto 5432) — para migraciones Prisma

# ═══ SUPABASE STORAGE (fotos) ═══
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_KEY="eyJ..."  # solo backend — nunca exponer al frontend

# ═══ AUTENTICACIÓN (JWT) ═══
JWT_SECRET="[generar con: openssl rand -base64 64]"
JWT_REFRESH_SECRET="[generar con: openssl rand -base64 64 — diferente al anterior]"

# ═══ APP ═══
NODE_ENV="development"  # cambiar a "production" en deploy
PORT=3001
FRONTEND_URL="http://localhost:5173"  # para CORS — en prod: https://zeltek.nic
API_KEY_N8N="[clave secreta para que n8n acceda al inbox]"
```

> **Prisma con Supabase** necesita dos URLs: `DATABASE_URL` (pooler, para queries normales) y `DIRECT_URL` (para `prisma migrate`). En `schema.prisma`:
> ```prisma
> datasource db {
>   provider  = "postgresql"
>   url       = env("DATABASE_URL")
>   directUrl = env("DIRECT_URL")
> }
> ```

> **¿Cloudinary o Supabase Storage para fotos?** Ya que usás Supabase, podés usar Supabase Storage en lugar de Cloudinary — es gratuito hasta 1GB y está integrado. La compresión a WebP sigue siendo en el frontend antes de subir. Decisión en Fase 0.

---

## 19. MIGRACIÓN DE DATOS HISTÓRICOS

### 19.1 El Problema

Tenés datos históricos en Google Sheets y en una BD SQL Server del sistema anterior. El nuevo sistema tiene validaciones estrictas (fotos obligatorias, cargador asignado, peso, etc.) que no existían cuando registraste esos datos. Si intentás importar un equipo vendido hace 3 meses, el sistema te va a bloquear porque no tiene foto de evidencia.

### 19.2 Solución: Modo Migración

El sistema tiene un flag en `settings` llamado `modo_migracion` (BOOLEAN, default false). Cuando está activo:

| Validación normal | Comportamiento en modo migración |
|------------------|--------------------------------|
| Foto obligatoria para DISPONIBLE | Se permite sin foto. Campo `foto_urls` queda vacío. |
| Foto evidencia obligatoria en venta | Se permite sin evidencia. `evidencia_entrega_url` puede ser NULL. |
| Cargador obligatorio | No se valida. `requiere_cargador` se ignora. |
| Peso obligatorio | Se permite sin peso. `peso_real_libras` queda NULL. |
| StateMachine (transiciones secuenciales) | Se permite establecer cualquier estado directamente. |
| Fecha automática (`created_at = NOW()`) | Se permite backdatear: el admin ingresa la fecha real del evento. |
| Número de factura secuencial | Se permite ingresar el número original del sistema anterior. |
| Inversor obligatorio | Sigue obligatorio — asignar al inversor correcto del histórico. |
| CTR calculado | Se permite ingresar el CTR manualmente si no hay desglose. |
| audit_logs | Se registra con accion `MIGRACION_HISTORICA` y usuario del admin. |

### 19.3 Campo identificador de registros migrados

Todas las tablas principales tienen un campo adicional:

```
origen    ENUM(SISTEMA | MIGRACION) DEFAULT 'SISTEMA'
```

- `SISTEMA` = registro creado normalmente por el ERP.
- `MIGRACION` = registro importado del histórico. No tiene todas las validaciones.

Esto permite que los reportes puedan filtrar: "mostrar solo datos del nuevo sistema" o "incluir históricos".

### 19.4 Flujo de Migración

| Paso | Acción |
|------|--------|
| 1 | Admin activa `modo_migracion = true` en Settings. Sistema muestra banner naranja: "MODO MIGRACIÓN ACTIVO — validaciones relajadas." |
| 2 | Admin sube CSV/Excel con datos de Google Sheets o exporta desde SQL Server. |
| 3 | El sistema procesa el archivo fila por fila. Para cada registro: crea el equipo/venta/cliente con `origen = MIGRACION` y las fechas originales. |
| 4 | Los registros sin foto se crean con `foto_urls = []` y `evidencia_entrega_url = NULL`. |
| 5 | Los equipos ya vendidos se crean directamente en estado VENDIDO sin pasar por la StateMachine. |
| 6 | Al terminar la importación, admin desactiva `modo_migracion = false`. |
| 7 | El sistema vuelve a las validaciones normales. Los registros migrados quedan marcados con `origen = MIGRACION`. |

### 19.5 Endpoint de Importación Masiva

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /migracion/equipos | Importar equipos desde CSV/JSON. Modo migración requerido. |
| POST | /migracion/ventas | Importar ventas históricas. Vincula a equipos y clientes. |
| POST | /migracion/clientes | Importar clientes existentes. |
| POST | /migracion/gastos | Importar gastos operativos históricos. |
| GET | /migracion/validar | Valida un CSV antes de importar: muestra errores y warnings. |
| GET | /migracion/resumen | Cuántos registros se importaron por tabla. |

### 19.6 Formato CSV Esperado — Equipos

```csv
numero_serie,marca,modelo,tipo,ram_gb,almacenamiento_gb,costo_base_usd,ctr_usd,precio_venta_usd,estado,inversor_nombre,fecha_compra,fecha_venta
JC9Y6D3,Dell,Latitude 5420,laptop,16,256,157.00,194.75,260.00,VENDIDO,Socio A,2026-01-15,2026-02-20
G3KJ9K3,Dell,Latitude 5420,laptop,32,256,165.00,203.25,,DISPONIBLE,Socio A,2026-02-01,
DW0Z9K3,Dell,Latitude 5420,laptop,16,256,145.00,,,EN_TRANSITO,Zeltek Capital Propio,2026-03-10,
```

### 19.7 Reglas de Migración

**RN-MIG-001**: `modo_migracion` solo puede ser activado por ADMIN. Se registra en audit_logs.

**RN-MIG-002**: Durante la migración, los números de factura del sistema anterior se importan tal cual (ej: "FAC-001" del viejo sistema). Los nuevos números secuenciales (ZLT-2026-XXXX) empiezan después del último importado.

**RN-MIG-003**: Si un equipo migrado no tiene CTR desglosado, se permite ingresar el CTR total manualmente. El sistema no intenta calcular costo_logístico ni acondicionamiento — los deja en NULL.

**RN-MIG-004**: Los registros migrados son editables después de la migración (para corregir datos). Pero siguen marcados como `origen = MIGRACION`.

**RN-MIG-005**: El `modo_migracion` se desactiva automáticamente después de 24 horas como protección — no se puede quedar activo indefinidamente.

---

## 20. FASES DE DESARROLLO (con migración)

| # | Fase | Entregables | Duración |
|---|------|-------------|----------|
| 0 | Fundación | Monorepo, Supabase, Express+Prisma, React+Vite, deploy Vercel (FE & BE Serverless) | 1 sem |
| 0.5 | **Migración** | **Modo migración, endpoints importación, campo origen, importar históricos** | **1 sem** |
| 1 | Auth y Sesiones | Login cookies HttpOnly, doble token, roles, bloqueo, pantalla login | 1 sem |
| 2 | Inbox (Compras) | compras_pendientes, POST /inbox, UI triage, deduplicación, script GAS F-01 | 1.5 sem |
| 3 | Inventario + Estados | Equipos + inversor_id, StateMachine, fotos, CTR, settings, accesorios | 2 sem |
| 4 | Dashboard KPIs | KPIs, capital por socio, badges, vista móvil | 1 sem |
| 5 | Clientes + Checkout | Clientes, checkout 4 pasos, foto evidencia, factura PDF, multimoneda | 2 sem |
| 6 | Garantías + Taller | Módulo reparaciones (tipo=garantia), impacto rentabilidad, alertas | 1 sem |
| 7 | OPEX + Capital | gastos doble moneda, pérdidas_capital, reintegros, panel inversores | 1 sem |
| 8 | Reparaciones | ordenes_reparacion, estados, presupuestos, técnicos (externos + garantías) | 1 sem |
| 9 | Reportes + Export | Estado cuenta PDF, Excel SheetJS, P&L Statement | 1.5 sem |
| 10 | Automatización | Google Apps Script (eBay Inbox, alertas, cierres de mes) | 1 sem |

**Total estimado: 14–15 semanas**

---

## 21. COMANDOS DE INICIO — FASE 0

```bash
# 1. Crear estructura del monorepo
mkdir zeltek-erp && cd zeltek-erp
mkdir frontend backend shared
git init

# 2. Backend (Node.js + Express + Prisma)
cd backend
npm init -y
npm install express cors helmet dotenv jsonwebtoken bcryptjs zod
npm install prisma @prisma/client @supabase/supabase-js
npm install -D typescript @types/express @types/node @types/cors ts-node nodemon
npx tsc --init
npx prisma init

# 3. Frontend (React + Vite + Tailwind)
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install
npm install axios zustand react-hook-form zod @hookform/resolvers
npm install @supabase/supabase-js @zxing/browser xlsx
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init

# 4. Shared types
cd ../shared
mkdir types schemas

# 5. Configurar Supabase
# → supabase.com → crear proyecto "zeltek-erp"
# → Settings → Database → Connection string → copiar pooler y directa
# → Crear el .env en /backend/.env (ver sección 18)

# 6. Configurar Prisma con Supabase
cd ../backend
# Editar prisma/schema.prisma:
#   datasource db {
#     provider  = "postgresql"
#     url       = env("DATABASE_URL")
#     directUrl = env("DIRECT_URL")
#   }
npx prisma migrate dev --name init

# 7. Generar secretos para JWT
openssl rand -base64 64  # → pegar en JWT_SECRET del .env
openssl rand -base64 64  # → pegar en JWT_REFRESH_SECRET del .env

# 8. Verificar conexión
npx prisma studio  # abre la BD en el navegador — si ves las tablas, todo está bien
```

---

> **FIN DEL DOCUMENTO SDD v2.6**
> Este markdown es la fuente única de verdad.
> Cualquier cambio al sistema debe reflejarse aquí primero.
> Stack final: React + Node.js + Supabase (PostgreSQL) + Prisma
> Documento aprobado por: Denzel — Zeltek Nicaragua — 2026
