import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos ZELTEK ERP...');

  // 1. Settings — Constantes financieras y de logística
  await prisma.settings.createMany({
    data: [
      { clave: 'tarifa_libra_aerea_usd', valor: '7.10', tipo: 'DECIMAL', descripcion: 'Precio/libra aéreo Miami a Managua ($7.10)' },
      { clave: 'tarifa_libra_maritima_usd', valor: '3.10', tipo: 'DECIMAL', descripcion: 'Precio/libra marítimo ($3.10)' },
      { clave: 'margen_minimo_pct', valor: '25', tipo: 'INTEGER', descripcion: 'Margen mínimo aceptado por equipo antes de alerta (25%)' },
      { clave: 'dias_garantia_seminuevo', valor: '120', tipo: 'INTEGER', descripcion: 'Garantía por defecto para equipos seminuevos (4 meses / 120 días)' },
      { clave: 'dias_garantia_nuevo', valor: '365', tipo: 'INTEGER', descripcion: 'Garantía por defecto para equipos nuevos (12 meses / 365 días)' },
      { clave: 'tasa_cambio_oficial', valor: '37.00', tipo: 'DECIMAL', descripcion: 'Tasa oficial NIO/USD inicial para conversiones automáticas' },
      { clave: 'tasa_cambio_fecha', valor: '2026-05-25', tipo: 'DATE', descripcion: 'Fecha de actualización de la tasa' },
      { clave: 'moneda_cobro_local', valor: 'NIO', tipo: 'VARCHAR', descripcion: 'Córdoba Nicaragüense como moneda de cobro local' },
      { clave: 'alerta_inbox_dias', valor: '5', tipo: 'INTEGER', descripcion: 'Días máximos en inbox sin triage antes de alerta' },
      { clave: 'pf_tap_ganancia', valor: '10.00', tipo: 'DECIMAL', descripcion: 'Profit First TAP: Porcentaje fondo de ganancia (10%)' },
      { clave: 'pf_tap_garantias', valor: '5.00', tipo: 'DECIMAL', descripcion: 'Profit First TAP: Porcentaje fondo de garantías (5%)' },
      { clave: 'pf_tap_opex', valor: '30.00', tipo: 'DECIMAL', descripcion: 'Profit First TAP: Porcentaje fondo de OPEX (30%)' },
      { clave: 'pf_tap_reparto', valor: '55.00', tipo: 'DECIMAL', descripcion: 'Profit First TAP: Porcentaje fondo de reparto de socios (55%)' },
      { clave: 'modo_migracion', valor: 'false', tipo: 'BOOLEAN', descripcion: 'Toggle para desactivar validaciones en importación de datos históricos' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Settings insertados');

  // 2. Inversores — Cuentas de capital iniciales (50/50)
  await prisma.inversores.createMany({
    data: [
      {
        id: 'a3b90df7-512c-497d-aa9f-7d12f3b9c811',
        nombre: 'Socio A',
        porcentaje_ganancia: 50.00,
        telefono: null,
        notas: 'Socio inversor inicial (50% de reparto neto mensual)',
        activo: true,
      },
      {
        id: 'e5d89cf2-623d-497b-bb8c-8e23f4c0d922',
        nombre: 'Zeltek (Capital Propio)',
        porcentaje_ganancia: 50.00,
        telefono: '+505 8888-8888',
        notas: 'Capital propio de Zeltek Nicaragua (50% de reparto neto mensual)',
        activo: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Inversores insertados');

  // 3. Usuario admin inicial
  // Contraseña temporal: ZeltekAdmin2026! (hash bcrypt rounds=12)
  await prisma.usuarios.createMany({
    data: [
      {
        id: 'b2c90ef8-723c-497a-cc9f-9d34f4b0e933',
        nombre: 'Administrador',
        email: 'admin@zeltek.nic',
        password_hash: '$2a$12$R9h/cIPzVE8.27u1zQ5yOOMW3/G9pD1Q/WvXUv4pXh/lBvC3iJzKm',
        rol: 'ADMIN',
        activo: true,
        intentos_fallidos: 0,
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Usuario admin insertado (email: admin@zeltek.nic / pass: ZeltekAdmin2026!)');

  // 4. Fondos financieros — Profit First (saldo inicial cero)
  await prisma.fondos_financieros.createMany({
    data: [
      { id: 'f1a90df7-512c-497d-aa9f-7d12f3b9c801', nombre: 'GANANCIA', saldo_usd: 0 },
      { id: 'f2b90df7-512c-497d-aa9f-7d12f3b9c802', nombre: 'GARANTIAS', saldo_usd: 0 },
      { id: 'f3c90df7-512c-497d-aa9f-7d12f3b9c803', nombre: 'OPEX', saldo_usd: 0 },
      { id: 'f4d90df7-512c-497d-aa9f-7d12f3b9c804', nombre: 'REPARTO_SOCIO_A', saldo_usd: 0 },
      { id: 'f5e90df7-512c-497d-aa9f-7d12f3b9c805', nombre: 'REPARTO_ZELTEK', saldo_usd: 0 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Fondos financieros Profit First creados');

  // 5. Categorías de accesorios iniciales
  await prisma.categorias_accesorio.createMany({
    data: [
      { nombre: 'Cargador Dell 65W Type-C', descripcion: 'Cargador USB-C 65W compatible Dell Latitude/Precision', requiere_asignacion_equipo: true },
      { nombre: 'Cargador Dell 45W Type-C', descripcion: 'Cargador USB-C 45W compatible Dell Latitude', requiere_asignacion_equipo: true },
      { nombre: 'Cable USB-C', descripcion: 'Cable USB-C genérico', requiere_asignacion_equipo: false },
      { nombre: 'Mouse Inalámbrico', descripcion: 'Mouse inalámbrico USB', requiere_asignacion_equipo: false },
      { nombre: 'Funda Laptop', descripcion: 'Funda protectora para laptop', requiere_asignacion_equipo: false },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Categorías de accesorios creadas');

  console.log('\n🎉 Seed completado exitosamente.');
  console.log('📧 Admin: admin@zeltek.nic');
  console.log('🔑 Password temporal: ZeltekAdmin2026!');
  console.log('⚠️  Cambia el password en el primer login.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
