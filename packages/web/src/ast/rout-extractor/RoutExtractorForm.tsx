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

export function RoutExtractorForm({ onRun, disabled }: ASTFormProps) {
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
        placeholder="Policy number"
        label="Policy Numbers"
        disabled={disabled}
      />
      <Button onClick={handleRun} disabled={disabled || !userId || !password} className="w-full">
        Run Route Extractor
      </Button>
    </div>
  )
}
