import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/BottomNavigation';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { TasksProvider } from '@/lib/TasksContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recall — AI Work Reminder Assistant',
  description: 'A calm, minimal AI work reminder assistant.',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/recall-logo.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('recall-theme');
                  var isDark = saved === 'dark';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8F9FD] dark:bg-[#212121] text-zinc-900 dark:text-[#ececec] selection:bg-blue-100 dark:selection:bg-blue-900/60 selection:text-blue-900 dark:selection:text-blue-100 transition-colors duration-200">
        {/* Iridescent atmospheric ambient gradient matching palette with ChatGPT dark mode refinement */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[14%] left-1/2 -translate-x-1/2 w-[960px] h-[580px] bg-gradient-to-b from-[#0052FF]/[0.07] dark:from-[#0052FF]/[0.12] via-[#7928CA]/[0.04] dark:via-[#7928CA]/[0.08] to-transparent blur-3xl opacity-80 ambient-aura-1" />
          <div className="absolute top-[32%] right-[-10%] w-[520px] h-[520px] bg-gradient-to-bl from-[#00D2FF]/[0.06] dark:from-[#00D2FF]/[0.08] via-[#0052FF]/[0.03] to-transparent blur-3xl opacity-70 ambient-aura-2" />
          <div className="absolute top-[68%] left-[-12%] w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/[0.05] dark:from-[#7928CA]/[0.08] to-transparent blur-3xl opacity-60 ambient-aura-1" />
        </div>

        <TasksProvider>
          <WorkspaceShell>
            <Header />
            <main className="flex-1 min-h-0 flex flex-col max-w-[1020px] w-full mx-auto px-2 sm:px-6 pt-1 sm:pt-2">
              {children}
            </main>
            <BottomNavigation />
          </WorkspaceShell>
        </TasksProvider>
      </body>
    </html>
  );
}
