import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QA Automation',
  description: 'Project, test definition, and run history shell for browser QA.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
