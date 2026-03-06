export const OC_OPTIONS: ReadonlyArray<{ label: string; code: string }> = [
  { label: 'Illinois', code: '01' },
  { label: 'Rohnert Park', code: '02' },
  { label: 'Michigan', code: '04' },
  { label: 'Woodbury', code: '05' },
  { label: 'Lincoln', code: '06' },
  { label: 'Charlottesville', code: '07' },
  { label: 'Dallas', code: '08' },
  { label: 'Birmingham', code: '09' },
  { label: 'Murfreesboro', code: '11' },
  { label: 'Bakersfield', code: '12' },
  { label: 'Concordville', code: '13' },
  { label: 'Columbia', code: '14' },
  { label: 'DuPont/Salem', code: '15' },
  { label: 'Newark', code: '16' },
  { label: 'Parsippany', code: '17' },
  { label: 'Indiana', code: '18' },
  { label: 'Winter Haven', code: '19' },
  { label: 'Greeley', code: '20' },
  { label: 'Frederick', code: '21' },
  { label: 'Monroe', code: '22' },
  { label: 'Costa Mesa', code: '23' },
  { label: 'Tempe', code: '24' },
  { label: 'Austin', code: '25' },
  { label: 'Tulsa', code: '26' },
  { label: 'Atlanta', code: '27' },
  { label: 'Ballston Spa', code: '28' },
]

export function isOcCode(value: string): boolean {
  return /^\d{2}$/.test(value)
}
