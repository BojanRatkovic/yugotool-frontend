import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/form-field'
import { SecretInput } from '@/components/secret-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useConnectProductive } from '@/features/integrations/api/productive-queries'
import { organizationsToPick, tokenError } from '@/features/integrations/utils/productive'
import { errorMessage } from '@/lib/api-client'
import type { ProductiveOrganization } from '@/lib/contracts'

const TOKEN_ID = 'productive-token'

/**
 * Connect Productive with a personal API token. The API finds the token's
 * organizations: one connects straight away, several ask which one.
 */
export function ProductiveConnectDialog({
  open,
  onOpenChange,
  replacing = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Already connected: the new token replaces the saved one. */
  replacing?: boolean
}) {
  const connect = useConnectProductive()
  const [token, setToken] = useState('')
  const [organizations, setOrganizations] = useState<ProductiveOrganization[] | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const fieldError = tokenError(connect.error)

  function close(next: boolean) {
    if (!next) {
      setToken('')
      setOrganizations(null)
      setOrganizationId(null)
      connect.reset()
    }
    onOpenChange(next)
  }

  function submit() {
    connect.mutate(
      { token: token.trim(), ...(organizationId === null ? {} : { organizationId }) },
      {
        onSuccess: (connection) => {
          toast.success(`Productive connected to ${connection.organizationName}.`)
          close(false)
        },
        onError: (error) => {
          const pick = organizationsToPick(error)
          if (pick !== null) {
            setOrganizations(pick)
            setOrganizationId(pick[0]?.id ?? null)
            connect.reset()
          } else if (tokenError(error) === null) {
            toast.error(`Couldn't connect Productive: ${errorMessage(error)}`)
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (token.trim() !== '') submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {replacing ? 'Replace Productive token' : 'Connect Productive'}
            </DialogTitle>
            <DialogDescription>
              Create a personal token in Productive under Settings → API integrations. YugoTool
              only reads projects and tasks; it never changes anything in Productive.
            </DialogDescription>
          </DialogHeader>
          <FormField
            id={TOKEN_ID}
            label="API token"
            errors={fieldError === null ? [] : [fieldError]}
          >
            <SecretInput
              id={TOKEN_ID}
              value={token}
              onChange={(value) => {
                setToken(value)
                setOrganizations(null)
                setOrganizationId(null)
                if (connect.error !== null) connect.reset()
              }}
              onBlur={() => undefined}
              placeholder="Paste the token"
              inputProps={{
                autoFocus: true,
                ...(fieldError === null
                  ? {}
                  : { 'aria-invalid': true, 'aria-describedby': `${TOKEN_ID}-error` }),
              }}
            />
          </FormField>
          {organizations === null ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                This token reaches {organizations.length} organizations. Which one?
              </legend>
              <RadioGroup
                value={organizationId ?? undefined}
                onValueChange={setOrganizationId}
                className="gap-1.5"
              >
                {organizations.map((organization) => (
                  <Label
                    key={organization.id}
                    htmlFor={`productive-org-${organization.id}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 font-normal has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-accent"
                  >
                    <RadioGroupItem
                      id={`productive-org-${organization.id}`}
                      value={organization.id}
                    />
                    {organization.name}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={token.trim() === '' || connect.isPending}>
              {connect.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {connect.isPending ? 'Checking…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
