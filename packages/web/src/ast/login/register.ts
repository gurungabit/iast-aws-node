import { registerAST } from '../registry'
import { LoginASTForm } from './LoginASTForm'

registerAST({
  id: 'login',
  name: 'TSO Login',
  description: 'Automated TSO login with policy processing',
  category: 'fire',
  keywords: ['login', 'tso', 'policy', 'fire'],
  version: '1.0.0',
  author: 'Core Team',
  supportsParallel: true,
  component: LoginASTForm,
})
