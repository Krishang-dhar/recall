'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { GlobalSearchModal } from './GlobalSearchModal';
import { RecallFlowOverlay } from './RecallFlowOverlay';

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ children }) => {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Default to open on wider screens
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recall_sidebar_open');
      if (saved !== null) {
        setIsSidebarOpen(saved === 'true');
      } else if (window.innerWidth >= 1200) {
        setIsSidebarOpen(true);
      }
    } catch (e) {}
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('recall_sidebar_open', String(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        handleToggleSidebar();
      }
    }

    function handleToggleSidebarEvent() {
      handleToggleSidebar();
    }

    function handleOpenSearch() {
      setIsSearchOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-sidebar', handleToggleSidebarEvent);
    window.addEventListener('open-history-drawer', handleToggleSidebarEvent);
    window.addEventListener('open-global-search', handleOpenSearch);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-sidebar', handleToggleSidebarEvent);
      window.removeEventListener('open-history-drawer', handleToggleSidebarEvent);
      window.removeEventListener('open-global-search', handleOpenSearch);
    };
  }, []);

  const handleNewChat = () => {
    setActiveChatId(null);
    router.push('/');
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveChatId(conversationId);
    router.push(`/?chatId=${conversationId}`);
  };

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        activeConversationId={activeChatId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectChat={handleSelectConversation}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {children}
      </div>

      <RecallFlowOverlay />
    </div>
  );
};
