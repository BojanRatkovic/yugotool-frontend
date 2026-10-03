import { useQuery } from '@tanstack/react-query'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { repoQueries } from '@/features/projects/api/repo-queries'

/**
 * Branches of the picked repo. Falls back to a free-text input when there's
 * no path yet or the branch list can't be loaded.
 */
export function BranchSelect({
  id,
  repoPath,
  value,
  onChange,
}: {
  id: string
  repoPath: string
  value: string
  onChange: (branch: string) => void
}) {
  const branches = useQuery({ ...repoQueries.branches(repoPath), enabled: repoPath !== '' })

  if (branches.data === undefined || branches.data.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={branches.isFetching ? 'Loading branches…' : 'main'}
        className="font-mono"
      />
    )
  }

  const options =
    branches.data.includes(value) || value === '' ? branches.data : [value, ...branches.data]
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full font-mono">
        <SelectValue placeholder="Pick a branch" />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-64">
        {options.map((branch) => (
          <SelectItem key={branch} value={branch} className="font-mono">
            {branch}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
