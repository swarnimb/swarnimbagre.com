'use client';

import { ReactNode } from 'react';

interface MobilePageProps {
  children: ReactNode;
}

export function MobilePage({ children }: MobilePageProps) {
  return (
    <main style={{
      minHeight: "100%",
      padding: "0 20px 40px",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      // Push past the iOS notch / dynamic island
      paddingTop: 60,
    }}>
      {children}
    </main>
  );
}
