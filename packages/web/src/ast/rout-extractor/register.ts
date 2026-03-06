import { registerAST } from '../registry'
import { RoutExtractorForm } from './RoutExtractorForm'

registerAST({
  name: 'rout-extractor',
  label: 'Route Extractor',
  description: 'Extract route data from ROUT inquiry',
  FormComponent: RoutExtractorForm,
})
