import React from 'react';
import { TodoPage } from '@/components/todos/TodoPage';
import { usePageTitle } from '@/hooks/shared/usePageTitle';

export default function Todos() {
  usePageTitle('Todos');

  return (
    <div className="h-[calc(100vh-4rem)]">
      <TodoPage isPWAMode={false} />
    </div>
  );
}
