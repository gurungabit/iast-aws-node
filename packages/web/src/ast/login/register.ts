import { registerAST } from '../registry'
import { LoginASTForm } from './LoginASTForm'

registerAST({
  name: 'login',
  label: 'Login',
  description: 'Login to TSO and process policies',
  FormComponent: LoginASTForm,
})
