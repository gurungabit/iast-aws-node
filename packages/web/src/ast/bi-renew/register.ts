import { registerAST } from '../registry'
import { BiRenewASTForm } from './BiRenewASTForm'

registerAST({
  name: 'bi-renew',
  label: 'BI Renew',
  description: 'BI Renewal processing with DB2 and SMB',
  FormComponent: BiRenewASTForm,
})
