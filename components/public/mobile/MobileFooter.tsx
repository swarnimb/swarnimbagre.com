'use client';

import { ReactNode } from 'react';

interface MobileFooterProps {
  line: ReactNode;
}

export function MobileFooter({ line }: MobileFooterProps) {
  return (
    <footer style={{
      marginTop: 40,
      paddingTop: 16,
      borderTop: "1px solid var(--hairline)",
      font: "var(--meta-sm)",
      color: "var(--fg-muted)",
      letterSpacing: 0,
      fontFamily: "var(--font-mono)",
      lineHeight: 1.5,
    }}>
      {line}
    </footer>
  );
}
