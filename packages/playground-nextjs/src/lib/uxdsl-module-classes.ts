/** Keep public class names for shared page rules while adding a component's CSS Module names. */
export function scopedClasses(
  value: string | null | undefined | false,
  ...modules: ReadonlyArray<Record<string, string>>
): string {
  if (!value) return ''
  return value.split(/\s+/).filter(Boolean).flatMap(name => [
    name,
    ...modules.map(module => module[name]).filter(Boolean),
  ]).join(' ')
}
