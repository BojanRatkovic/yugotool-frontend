import { FormField } from '@/components/form-field'
import { EffortSelect, ModelSelect } from '@/components/model-select'
import { Input } from '@/components/ui/input'
import type { OverrideValues } from '@/features/work-orders/utils/overrides'

/** Model / effort / budget overrides for one work order. Controlled by the parent form. */
export function OverrideFields({
  idPrefix,
  values,
  budgetErrors,
  onModel,
  onEffort,
  onBudget,
  disabled,
  layout = 'row',
}: {
  idPrefix: string
  values: OverrideValues
  budgetErrors: readonly unknown[]
  onModel: (value: OverrideValues['modelOverride']) => void
  onEffort: (value: OverrideValues['effortOverride']) => void
  onBudget: (value: string) => void
  disabled?: boolean
  /** `stack` for the narrow detail rail. */
  layout?: 'row' | 'stack'
}) {
  return (
    <div className={layout === 'row' ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-3'}>
      <FormField id={`${idPrefix}-model`} label="Model" errors={[]}>
        <ModelSelect
          id={`${idPrefix}-model`}
          value={values.modelOverride}
          defaultLabel="Line default"
          disabled={disabled}
          onChange={onModel}
        />
      </FormField>
      <FormField id={`${idPrefix}-effort`} label="Effort" errors={[]}>
        <EffortSelect
          id={`${idPrefix}-effort`}
          value={values.effortOverride}
          defaultLabel="Line default"
          disabled={disabled}
          onChange={onEffort}
        />
      </FormField>
      <FormField id={`${idPrefix}-budget`} label="Budget USD" errors={budgetErrors}>
        <Input
          id={`${idPrefix}-budget`}
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          placeholder="No cap"
          className="tabular"
          disabled={disabled}
          value={values.budget}
          onChange={(event) => onBudget(event.target.value)}
        />
      </FormField>
    </div>
  )
}
