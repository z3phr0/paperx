/**
 * shadcn-style cn() helper — merges clsx output with tailwind-merge so
 * later classes win for conflicting Tailwind utilities.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
