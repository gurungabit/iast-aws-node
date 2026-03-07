/**
 * SMB share path configuration by office code.
 *
 * Maps office codes to their UNC share paths for iAST file access.
 * Each office belongs to a zone with a specific network path.
 */

/** DFS share root — all SMB paths connect through this share */
export const DFS_SHARE = '\\\\Opr.statefarm.org\\dfs'

interface OfficePath {
  zone: string
  office: string
  zoneOcs: string[]
  path: string
}

const OFFICE_PATHS: OfficePath[] = [
  { zone: 'Corporate Headquarters', office: '00', zoneOcs: ['00'], path: '\\\\Opr.statefarm.org\\dfs\\corp\\00\\WORKGROUP\\iAST' },
  { zone: 'GREAT LAKES', office: '01', zoneOcs: ['01', '04', '18'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\GREAT LAKES\\WORKGROUP\\iAST' },
  { zone: 'CALIFORNIA', office: '02', zoneOcs: ['02', '12', '23'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CALIFORNIA\\WORKGROUP\\iAST' },
  { zone: 'GREAT LAKES', office: '04', zoneOcs: ['01', '04', '18'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\GREAT LAKES\\WORKGROUP\\iAST' },
  { zone: 'HEARTLAND', office: '05', zoneOcs: ['05', '06'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\HEARTLAND\\WORKGROUP\\iAST' },
  { zone: 'HEARTLAND', office: '06', zoneOcs: ['05', '06'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\HEARTLAND\\WORKGROUP\\iAST' },
  { zone: 'MID-ATLANTIC', office: '07', zoneOcs: ['07', '21'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\MID-ATLANTIC\\WORKGROUP\\iAST' },
  { zone: 'TEXAS', office: '08', zoneOcs: ['08', '25'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\TEXAS\\WORKGROUP\\iAST' },
  { zone: 'SOUTHERN', office: '09', zoneOcs: ['09', '27'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\SOUTHERN\\WORKGROUP\\iAST' },
  { zone: 'MID-AMERICA', office: '11', zoneOcs: ['11', '16'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\MID-AMERICA\\WORKGROUP\\iAST' },
  { zone: 'CALIFORNIA', office: '12', zoneOcs: ['02', '12', '23'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CALIFORNIA\\WORKGROUP\\iAST' },
  { zone: 'NORTHEAST', office: '13', zoneOcs: ['13', '17', '28'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\NORTHEAST\\WORKGROUP\\iAST' },
  { zone: 'CENTRAL', office: '14', zoneOcs: ['14', '22', '26'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CENTRAL\\WORKGROUP\\iAST' },
  { zone: 'PACIFIC NORTHWEST', office: '15', zoneOcs: ['15'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\PACIFIC NORTHWEST\\WORKGROUP\\iAST' },
  { zone: 'MID-AMERICA', office: '16', zoneOcs: ['11', '16'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\MID-AMERICA\\WORKGROUP\\iAST' },
  { zone: 'NORTHEAST', office: '17', zoneOcs: ['13', '17', '28'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\NORTHEAST\\WORKGROUP\\iAST' },
  { zone: 'GREAT LAKES', office: '18', zoneOcs: ['01', '04', '18'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\GREAT LAKES\\WORKGROUP\\iAST' },
  { zone: 'FLORIDA', office: '19', zoneOcs: ['19'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\FLORIDA\\WORKGROUP\\iAST' },
  { zone: 'GREAT WESTERN', office: '20', zoneOcs: ['20', '24'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\GREAT WESTERN\\WORKGROUP\\iAST' },
  { zone: 'MID-ATLANTIC', office: '21', zoneOcs: ['07', '21'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\MID-ATLANTIC\\WORKGROUP\\iAST' },
  { zone: 'CENTRAL', office: '22', zoneOcs: ['14', '22', '26'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CENTRAL\\WORKGROUP\\iAST' },
  { zone: 'CALIFORNIA', office: '23', zoneOcs: ['02', '12', '23'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CALIFORNIA\\WORKGROUP\\iAST' },
  { zone: 'GREAT WESTERN', office: '24', zoneOcs: ['20', '24'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\GREAT WESTERN\\WORKGROUP\\iAST' },
  { zone: 'TEXAS', office: '25', zoneOcs: ['08', '25'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\TEXAS\\WORKGROUP\\iAST' },
  { zone: 'CENTRAL', office: '26', zoneOcs: ['14', '22', '26'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\CENTRAL\\WORKGROUP\\iAST' },
  { zone: 'SOUTHERN', office: '27', zoneOcs: ['09', '27'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\SOUTHERN\\WORKGROUP\\iAST' },
  { zone: 'NORTHEAST', office: '28', zoneOcs: ['13', '17', '28'], path: '\\\\Opr.statefarm.org\\dfs\\ZONE\\NORTHEAST\\WORKGROUP\\iAST' },
]

/** FTP 412 file path (used for rout-extractor 412 files) */
export const FTP_412_PATH = '\\\\Opr.statefarm.org\\dfs\\CORP\\00\\WORKGROUP\\FTP\\FTP_412'

/** FTP 412 Canada path */
export const FTP_412_CANADA_PATH = '\\\\Opr.statefarm.org\\dfs\\ZONE\\CANADA\\WORKGROUP\\FTP\\FTP_412'

/** FTP share path (used for RW1AA271 reports in bi-renew) */
export const FTP_SHARE = '\\\\Opr.statefarm.org\\dfs\\CORP\\00\\WORKGROUP\\FTP\\Auto_AST_FTP'

export function getPathByOffice(office: string): string | undefined {
  return OFFICE_PATHS.find((e) => e.office === office)?.path
}

export function getZoneByOffice(office: string): string | undefined {
  return OFFICE_PATHS.find((e) => e.office === office)?.zone
}

export function getZoneOcsByOffice(office: string): string[] | undefined {
  return OFFICE_PATHS.find((e) => e.office === office)?.zoneOcs
}

export function buildFilePath(office: string, department: 'FIRE' | 'AUTO', filename: string): string {
  const basePath = getPathByOffice(office)
  if (!basePath) throw new Error(`Office code '${office}' not found`)
  return `${basePath}\\${department}\\${filename}`
}

export { OFFICE_PATHS }
