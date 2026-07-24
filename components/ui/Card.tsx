import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

/**
 * Soft-tactile surface (design v3): a white/dark rounded card that "floats"
 * on the paper background with a soft, tinted shadow. The single source of
 * truth for card elevation — use it everywhere a surface is needed so the
 * whole app shares one depth language.
 */

// Ink-tinted soft shadow. Cross-platform: iOS reads shadow*, Android reads
// elevation. Low opacity + large radius = the gentle "floating" look.
export const softShadow = {
  shadowColor: "#16293B", // ink
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.07,
  shadowRadius: 24,
  elevation: 5,
} as const;

// Lighter shadow for smaller/secondary surfaces (chips, circular buttons).
export const softShadowSm = {
  shadowColor: "#16293B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
} as const;

interface CardProps extends ViewProps {
  children: ReactNode;
  /** Extra classes (padding, margins, layout). Defaults to comfortable padding. */
  className?: string;
  /** Shadow depth: "md" for prominent surfaces, "sm" for list rows/chips,
   *  "none" for a flat/inset surface. */
  shadow?: "md" | "sm" | "none";
}

const SHADOWS = { md: softShadow, sm: softShadowSm, none: undefined } as const;

export function Card({
  children,
  className = "",
  shadow = "md",
  style,
  ...rest
}: CardProps) {
  return (
    <View
      className={`rounded-[28px] bg-white dark:bg-gray-900 ${className}`}
      style={[SHADOWS[shadow], style]}
      {...rest}
    >
      {children}
    </View>
  );
}
