// ============================================================================
// Icono por artículo (Inventario)
// ============================================================================
// El reporte no trae una imagen por artículo, así que se deduce el icono por
// palabras clave de la descripción/grupo. El primero que coincida gana; si no
// coincide ninguno se usa el icono genérico de salud.
// ============================================================================
import {
  RiTempColdFill,
  RiTempHotFill,
  RiSyringeFill,
  RiCapsuleFill,
  RiFirstAidKitFill,
  RiMedicineBottleFill,
  RiHandSanitizerFill,
  RiHandHeartFill,
  RiStethoscopeLine,
  RiHeartPulseFill,
  RiLungsFill,
  RiTestTubeFill,
  RiFlaskFill,
  RiSurgicalMaskFill,
  RiVirusFill,
  RiHospitalFill,
  RiMicroscopeLine,
  RiArchiveFill,
  RiShieldCrossFill,
} from 'react-icons/ri'

const REGLAS = [
  { icono: RiTempColdFill, claves: ['frio', 'cadena de frio', 'nevera', 'refriger', 'termolabil', 'refrigerado', 'temperatura controlada'] },
  { icono: RiTempHotFill, claves: ['caliente', 'termico', 'termoterapia'] },
  { icono: RiSyringeFill, claves: ['jeringa', 'aguja', 'inyect', 'inyeccion', 'vacutainer', 'lanceta'] },
  { icono: RiCapsuleFill, claves: ['capsula', 'tableta', 'pastilla', 'comprimido', 'gragea', 'blister'] },
  { icono: RiFirstAidKitFill, claves: ['cura', 'curita', 'vendaje', 'venda', 'gasa', 'adhesivo', 'primeros auxilios'] },
  { icono: RiMedicineBottleFill, claves: ['jarabe', 'solucion', 'suspension', 'frasco', 'gotas', 'ampolla', 'emulsion'] },
  { icono: RiHandSanitizerFill, claves: ['alcohol', 'gel', 'antibacterial', 'desinfectante', 'sanitizante', 'jabon', 'antisepsia'] },
  { icono: RiHandHeartFill, claves: ['guante', 'latex', 'nitrilo'] },
  { icono: RiSurgicalMaskFill, claves: ['mascarilla', 'tapabocas', 'respirador', 'careta'] },
  { icono: RiStethoscopeLine, claves: ['estetoscopio', 'tensiometro', 'glucometro', 'nebulizador', 'oximetro', 'equipo medico'] },
  { icono: RiHeartPulseFill, claves: ['corazon', 'cardiaco', 'cardiovascular', 'presion arterial'] },
  { icono: RiLungsFill, claves: ['oxigeno', 'pulmon', 'respiratorio', 'canula'] },
  { icono: RiTestTubeFill, claves: ['reactivo', 'laboratorio', 'tubo', 'muestra', 'cultivo'] },
  { icono: RiFlaskFill, claves: ['matraz', 'flask'] },
  { icono: RiMicroscopeLine, claves: ['microscopio', 'lupa'] },
  { icono: RiVirusFill, claves: ['virus', 'vacuna', 'inmunolog', 'antigeno'] },
  { icono: RiHospitalFill, claves: ['hospital', 'clinica', 'consulta'] },
  { icono: RiArchiveFill, claves: ['papeleria', 'archivo', 'oficina', 'impresion', 'toner', 'resma', 'carpeta'] },
]

const normalizar = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

// Devuelve el componente de icono para la descripción/grupo indicados.
export function iconoArticulo(...textos) {
  const texto = normalizar(textos.filter(Boolean).join(' '))
  if (texto) {
    for (const regla of REGLAS) {
      if (regla.claves.some((clave) => texto.includes(clave))) return regla.icono
    }
  }
  return RiShieldCrossFill
}