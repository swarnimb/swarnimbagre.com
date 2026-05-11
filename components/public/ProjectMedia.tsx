'use client'

import { BeforeAfterMedia } from './BeforeAfterMedia'
import { StillMedia } from './StillMedia'
import { DemoLoop } from './DemoLoop'

interface ProjectMediaProps {
  kind?: string;
  variant?: string;
}

/* ProjectMedia — animated/static scenes drawn with HTML+CSS+SVG.
   No external assets. Always playing. Variant lets cards differ. */
export function ProjectMedia({ kind = "demo", variant = "rings" }: ProjectMediaProps) {
  if (kind === "before-after") return <BeforeAfterMedia variant={variant} />;
  if (kind === "still")        return <StillMedia variant={variant} />;
  return <DemoLoop variant={variant} />;
}
