import { useState } from 'react'
import type { ASTFormProps } from '../registry'
import { CredentialsInput } from '../shared/CredentialsInput'
import { TaskListEditor } from '../shared/TaskListEditor'
import { Button } from '../../components/ui/Button'

interface PolicyItem {
  id: string
  label: string
  value: string
}

export function LoginASTForm({ onRun, disabled }: ASTFormProps) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [policies, setPolicies] = useState<PolicyItem[]>([])

  const handleRun = () => {
    onRun({
      username: userId,
      password,
      policyNumbers: policies.map((p) => p.value),
    })
  }

  const canRun = userId && password

  return (
    <div className="space-y-3">
      <CredentialsInput
        userId={userId}
        password={password}
        onUserIdChange={setUserId}
        onPasswordChange={setPassword}
        disabled={disabled}
      />
      <TaskListEditor
        tasks={policies}
        onChange={setPolicies}
        placeholder="Policy number (9 chars)"
        label="Policy Numbers"
        disabled={disabled}
      />
      <Button onClick={handleRun} disabled={disabled || !canRun} className="w-full">
        Run Login AST
      </Button>
    </div>
  )
}
