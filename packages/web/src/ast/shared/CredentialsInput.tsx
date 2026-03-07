import { Input } from '../../components/ui/Input'

interface CredentialsInputProps {
  username: string
  password: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  disabled?: boolean
}

export function CredentialsInput({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  disabled,
}: CredentialsInputProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="User ID"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        disabled={disabled}
        autoComplete="username"
        required
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder="Password"
        disabled={disabled}
        autoComplete="current-password"
        required
      />
    </div>
  )
}
