/**
 * Static lookup tables for policy type resolution.
 *
 * Two mapping structures:
 * 1. FORM_LINE_TYPES: (SystemPolicyType, SystemFormLine) -> policy type description
 * 2. PDQ_DISPLAY_TO_TYPE: PDQ display code -> policy type description
 */

/** (SystemPolicyType code, FormLine subcode) -> RoutType description */
const FORM_LINE_TYPES = new Map<string, string>([
  // A = Farm/Ranch
  ['A:', 'FARM'],
  ['A:2', 'FARM'],
  ['A:3', 'FARM'],
  ['A:FH', 'FARM'],
  // B = Boatowners
  ['B:', 'BOAT'],
  ['B:0', 'BOAT'],
  ['B:1', 'BOAT'],
  // C = Rental Condo Unitowners
  ['C:', 'RCUP'],
  ['C:6', 'RCUP'],
  // D = Flood
  ['D:0', 'FLD'],
  // E = Contractors
  ['E:', 'CONT'],
  ['E:3', 'CONT'],
  // F = Residential Fire
  ['F:', 'FIRE'],
  ['F:A', 'FIRE'],
  ['F:V', 'FIRE'],
  // G = CEA
  ['G:', 'CEA'],
  ['G:W', 'CEA'],
  ['G:3', 'CEA'],
  ['G:4', 'CEA'],
  ['G:6', 'CEA'],
  // H = Homeowners
  ['H:', 'HO'],
  ['H:HO', 'HO'],
  ['H:2', 'HO 2'],
  ['H:3', 'HO 3'],
  ['H:4', 'HO 4'],
  ['H:5', 'HO 5'],
  ['H:6', 'HO 6'],
  ['H:8', 'HO W'],
  ['H:9', 'HO 4'],
  ['H:W', 'HO W'],
  ['H:A', 'HO A'],
  // L = PLUP
  ['L:', 'PLUP'],
  ['L:1', 'PLUP'],
  ['L:2', 'PLUP'],
  ['L:3', 'PLUP'],
  ['L:4', 'PLUP'],
  // M = Monthly payment / Commercial
  ['M:', ''],
  ['M:00', 'COMP'],
  ['M:02', 'COMP'],
  ['M:10', 'COML'],
  ['M:16', 'INMA'],
  ['M:17', 'INMA'],
  ['M:60', 'BOND'],
  ['M:62', 'LIAB'],
  ['M:64', 'COML'],
  ['M:68', 'UMBR'],
  ['M:74', 'DBL'],
  // N = Miscellaneous Business
  ['N:', 'MISC'],
  ['N:1', 'MISC'],
  ['N:3', 'MISC'],
  // P = Personal Articles
  ['P:', 'PAP'],
  ['P:0', 'PAP'],
  ['P:A', 'PAP'],
  ['P:I', 'PAP'],
  ['P:P', 'PAP'],
  // Q = Earthquake
  ['Q:5', 'EQ 5'],
  ['Q:6', 'EQ 6'],
  // R = Rental Dwelling
  ['R:', 'RD 3'],
  ['R:3', 'RD 3'],
  ['R:RD', 'RD 3'],
  // T = Manufactured Home
  ['T:', 'MH 3'],
  ['T:MH', 'MH 3'],
  ['T:3', 'MH 3'],
  // U = Business Office
  ['U:', 'OFF'],
  ['U:3', 'OFF'],
  // V = Condominium
  ['V:', 'COND'],
  ['V:3', 'COND'],
  // W = Apartment
  ['W:', 'APT'],
  ['W:3', 'APT'],
  // Y = Church
  ['Y:', 'CHUR'],
  ['Y:3', 'CHUR'],
  // Z = Business - Mercantile/Service
  ['Z:', 'BUS'],
  ['Z:2', 'MERC'],
  ['Z:3', 'MERC'],
])

/** PDQ display string -> policy type id (RoutType) */
const PDQ_DISPLAY_TO_TYPE = new Map<string, string>([
  ['APARTMENT', 'APT'],
  ['APT UNITOWNERS', 'APTU'],
  ['BUSINESS-CONDO', 'BCON'],
  ['BOATOWNERS', 'BOAT'],
  ['FIDELITY BOND', 'BOND'],
  ['SURETY BOND', 'BOND'],
  ['BUSINESS-MER/SR', 'BUS'],
  ['CEA', 'CEA'],
  ['CHURCH POLICY', 'CHUR'],
  ['COMM INSURANCE', 'COML'],
  ['WORKERS COMP', 'COMP'],
  ['CONDOMINIUM', 'COND'],
  ['CONDO UNITOWNRS', 'CONB'],
  ['CONTRACTORS', 'CONT'],
  ["COMM'L GEN LIAB", 'CGL'],
  ['CPL-LIABILITY', 'CPL'],
  ['DIS BEN LIAB', 'DBL'],
  ['EARTHQUAKE - 5', 'EQ 5'],
  ['EARTHQUAKE - 6', 'EQ 6'],
  ['FARM/RANCH', 'FARM'],
  ['FARM/RANCH - 3', 'FARM'],
  ['FARM/RANCH - 2', 'FARM'],
  ['FARM/RANCH - 3T', 'FARM'],
  ['FCPL-LIABILITY', 'FCPL'],
  ['RESIDENTL FIRE', 'FIRE'],
  ['FLOOD-DWELLING', 'FLD'],
  ['HOMEOWNER BASIC', 'HO 2'],
  ['HOMEOWNERS - 3', 'HO 3'],
  ['HOMEOWNERS - 4', 'HO 4'],
  ['HO - RENTERS', 'HO 4'],
  ['HO 4 COMPANION', 'HO 4'],
  ['HOMEOWNER EXTRA', 'HO 5'],
  ['COND UNIT OWNRS', 'HO 6'],
  ['HO - CONDO UNIT', 'HO 6'],
  ['HO-A-LIMITED', 'HO A'],
  ['HO - HOMEOWNERS', 'HO W'],
  ['HO W COMPANION', 'HO W'],
  ['INLAND MARINE', 'INMA'],
  ['PERSONAL LIAB', 'LIAB'],
  ['FARM LIABILITY', 'LIAB'],
  ['RENTAL LIAB', 'LIAB'],
  ['BUS-MERCANTILE', 'MERC'],
  ['MANUF HOME', 'MH'],
  ['MANF HOME - 3', 'MH 3'],
  ['MOBILEHOME - 3', 'MH 3'],
  ['BUSINESS - MISC', 'MISC'],
  ['BUSINESS-OFFICE', 'OFF'],
  ['PERSNL ARTICLES', 'PAP'],
  ['PERS LIAB UMB', 'PLUP'],
  ['RENT CONDO UNIT', 'RCUP'],
  ['RENTAL DWELL 3', 'RD 3'],
  ['BUS-SERVICE', 'SERV'],
  ['TCPP-SERV/CONT', 'TCPP'],
  ['COMM UMB LIAB', 'UMBR'],
  ['COMM LIAB UMB', 'UMBR'],
])

/** Look up policy type from system type code and form line */
export function getPolicyType(sysType: string, formLine: string): string {
  const code = sysType.trim()
  const fl = formLine.trim()

  // Try exact match first
  const exact = FORM_LINE_TYPES.get(`${code}:${fl}`)
  if (exact !== undefined) return exact

  // Fall back to empty-string FormLine entry
  return FORM_LINE_TYPES.get(`${code}:`) ?? ''
}

/** Look up policy type from PDQ display string */
export function getPolicyTypeFromPdq(pdqDisplay: string): string | null {
  return PDQ_DISPLAY_TO_TYPE.get(pdqDisplay.trim().toUpperCase()) ?? null
}
