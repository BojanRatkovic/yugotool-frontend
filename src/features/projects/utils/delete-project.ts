/** The typed confirmation matches the project name exactly (case-sensitive), ignoring outer spaces. */
export function confirmsDelete(typed: string, projectName: string): boolean {
  const name = projectName.trim()
  return name !== '' && typed.trim() === name
}
