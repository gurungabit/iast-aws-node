import { registerAST } from '../registry'
import { BiRenewASTForm } from './BiRenewASTForm'

registerAST({
  id: 'bi_renew',
  name: 'BI Renew',
  description: 'Process BI renewal pending records from DB2 with office report validation',
  category: 'auto',
  keywords: ['bi', 'renew', 'renewal', 'billing', 'invoice', 'auto', 'pending'],
  version: '1.0.0',
  author: 'Core Team',
  supportsParallel: true,
  component: BiRenewASTForm,
})
