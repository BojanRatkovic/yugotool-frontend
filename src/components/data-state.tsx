export function LoadError({ what, message }: { what: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">Couldn&rsquo;t load {what}.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
