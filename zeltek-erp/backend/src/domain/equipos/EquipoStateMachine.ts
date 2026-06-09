/**
 * ÚNICO punto del sistema que puede cambiar el estado de un equipo.
 * Implementa las transiciones definidas en SDD Pilar 2 — Sección 3.2.
 */

type EstadoEquipo =
  | 'COMPRADO'
  | 'EN_BODEGA_MIAMI'
  | 'EN_TRANSITO'
  | 'EN_TALLER'
  | 'DISPONIBLE'
  | 'VENDIDO'
  | 'EN_RECLAMO'
  | 'DEVUELTO';

const TRANSICIONES: Record<EstadoEquipo, EstadoEquipo[]> = {
  COMPRADO:        ['EN_BODEGA_MIAMI', 'EN_RECLAMO'],
  EN_BODEGA_MIAMI: ['EN_TRANSITO', 'EN_RECLAMO'],
  EN_TRANSITO:     ['EN_TALLER', 'EN_RECLAMO'],
  EN_TALLER:       ['DISPONIBLE'],
  DISPONIBLE:      ['VENDIDO', 'EN_TALLER'],
  VENDIDO:         ['EN_RECLAMO', 'EN_TALLER'],
  EN_RECLAMO:      ['DISPONIBLE', 'DEVUELTO'],
  DEVUELTO:        [],
};

export interface ValidacionDisponible {
  peso_real_libras: number | null;
  requiere_cargador: boolean;
  tiene_cargador_asignado: boolean;
}

export class EquipoStateMachineError extends Error {
  constructor(
    message: string,
    public readonly codigo: string,
  ) {
    super(message);
    this.name = 'EquipoStateMachineError';
  }
}

export class EquipoStateMachine {
  static validarTransicion(
    estadoActual: EstadoEquipo,
    estadoNuevo: EstadoEquipo,
  ): void {
    const permitidos = TRANSICIONES[estadoActual];

    if (!permitidos.includes(estadoNuevo)) {
      throw new EquipoStateMachineError(
        `Transición inválida: ${estadoActual} → ${estadoNuevo}. ` +
        `Transiciones permitidas: ${permitidos.join(', ') || 'ninguna (estado terminal)'}`,
        'TRANSICION_INVALIDA',
      );
    }
  }

  // RN-STATE-001: Validaciones bloqueantes para EN_TALLER → DISPONIBLE
  static validarDisponible(datos: ValidacionDisponible): void {
    if (!datos.peso_real_libras || datos.peso_real_libras <= 0) {
      throw new EquipoStateMachineError(
        'El equipo no puede marcarse como DISPONIBLE sin peso real registrado.',
        'PESO_REQUERIDO',
      );
    }

    if (datos.requiere_cargador && !datos.tiene_cargador_asignado) {
      throw new EquipoStateMachineError(
        'Este equipo requiere cargador. Asignar uno del inventario antes de marcar como DISPONIBLE.',
        'CARGADOR_REQUERIDO',
      );
    }
  }

  static esTransicionValida(estadoActual: EstadoEquipo, estadoNuevo: EstadoEquipo): boolean {
    return TRANSICIONES[estadoActual].includes(estadoNuevo);
  }

  static transicionesPermitidas(estadoActual: EstadoEquipo): EstadoEquipo[] {
    return TRANSICIONES[estadoActual];
  }
}
