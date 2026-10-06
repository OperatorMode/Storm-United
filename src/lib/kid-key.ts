/** A child's key for colours in My Player (matched by first name across teams). */
export const kidKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
