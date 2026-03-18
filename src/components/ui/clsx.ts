type ClassValue = string | undefined | null | false | ClassValue[];

export function clsx(...classes: ClassValue[]): string {
  return classes
    .flat(10 as 1)
    .filter(Boolean)
    .join(" ");
}
