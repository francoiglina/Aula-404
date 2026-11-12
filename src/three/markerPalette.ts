/**
 * Paleta oficial sincronizada con los materiales reales de Three.js y los archivos .glb:
 * - dpwii_parcial2_marcadores_persona.glb (`marcador_persona_01`, emissive sRGB: #4ad0ff, anillo: #38bdf8)
 * - dpwii_parcial2_marcadores_objeto.glb (`marcador_objeto_01`, emissive sRGB: #ff6588, anillo: #f43f5e)
 * - Escaleras procedurales en SchoolEngine (`color: #facc15`, `emissive: #ca8a04`)
 * - Puerta desbloqueada del Salón 2C (`thresholdRing: #10b981`)
 */
export const MARKER_3D_COLORS = {
  personaje: {
    fill: '#4ad0ff',
    ring: '#38bdf8',
    halo: 'rgba(74, 208, 255, 0.75)',
  },
  objeto: {
    fill: '#ff6588',
    ring: '#f43f5e',
    halo: 'rgba(255, 101, 136, 0.78)',
  },
  escalera: {
    fill: '#facc15',
    ring: '#ca8a04',
    halo: 'rgba(250, 204, 21, 0.75)',
  },
  puerta: {
    fill: '#10b981',
    ring: '#34d399',
    halo: 'rgba(16, 185, 129, 0.78)',
  },
} as const;
