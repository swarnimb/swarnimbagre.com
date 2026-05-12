import { Inter } from 'next/font/google';
import '../styles/admin.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`admin-root ${inter.variable}`}>{children}</div>
  );
}
