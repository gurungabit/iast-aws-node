import { Input } from '../../components/ui/Input'

interface CredentialsInputProps {
  userId: string
  password: string
  onUserIdChange: (value: string) => void
  onPasswordChange: (value: string) => void
  disabled?: boolean
}

export function CredentialsInput({
  userId,
  password,
  onUserIdChange,
  onPasswordChange,
  disabled,
}: CredentialsInputProps) {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Input
          label="User ID"
          value={userId}
          onChange={(e) => onUserIdChange(e.target.value)}
          placeholder="HERC01"
          disabled={disabled}
          autoComplete="username"
        />
      </div>
      <div className="flex-1">
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Password"
          disabled={disabled}
          autoComplete="current-password"
        />
      </div>
    </div>
  )
}
