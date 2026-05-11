'use client'

import type { ReactNode } from 'react'

interface PageProps {
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 clamp(20px, 4vw, 48px) 64px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </main>
  );
}
