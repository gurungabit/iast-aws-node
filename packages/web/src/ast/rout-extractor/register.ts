import { registerAST } from '../registry'
import { RoutExtractorForm } from './RoutExtractorForm'

registerAST({
  id: 'rout_extractor',
  name: 'RoutExtractor',
  description: 'Extract ROUT data from 412 files or FIRE terminal screen scraping',
  category: 'fire',
  keywords: ['rout', 'extractor', 'routing', '412', 'fire', 'policy', 'queue', 'section', 'occ'],
  version: '1.0.0',
  author: 'Core Team',
  supportsParallel: false,
  component: RoutExtractorForm,
})
