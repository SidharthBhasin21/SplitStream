/** Expense categories (v1.1) — keep in sync with the CHECK constraint in
 *  supabase/phase6.sql. Icon names are FontAwesome glyphs. */

export const CATEGORIES = [
  "food",
  "travel",
  "rent",
  "shopping",
  "utilities",
  "entertainment",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  label: string;
  icon: string;
  /** Pastel avatar tint (design-ref): soft circle bg + saturated icon. */
  tint: { bg: string; fg: string };
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: { label: "Food", icon: "cutlery", tint: { bg: "#FCE8D8", fg: "#C96F22" } },
  travel: { label: "Travel", icon: "plane", tint: { bg: "#D8E9FC", fg: "#3B82C4" } },
  rent: { label: "Rent", icon: "home", tint: { bg: "#D9EFE7", fg: "#2F5D50" } },
  shopping: { label: "Shopping", icon: "shopping-bag", tint: { bg: "#E9E0F8", fg: "#7C5CBF" } },
  utilities: { label: "Utilities", icon: "bolt", tint: { bg: "#FBF3D0", fg: "#B08F1D" } },
  entertainment: { label: "Entertainment", icon: "film", tint: { bg: "#FADCE4", fg: "#C2496F" } },
  other: { label: "Other", icon: "tag", tint: { bg: "#E8ECEB", fg: "#5C6B68" } },
};

/** Rows from before the category column existed default to 'other'; guard
 *  against anything unexpected the same way. */
export function asCategory(value: string | null | undefined): Category {
  return (CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as Category)
    : "other";
}
