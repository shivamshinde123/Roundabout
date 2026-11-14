'use client';

import { useEffect } from 'react';
import { markMessagesReadAction } from '@/app/(app)/tasks/actions';

/** Marks the owner's messages on this task as read once the panel is shown. */
export function MarkRead({ taskId, unread }: { taskId: string; unread: boolean }) {
  useEffect(() => {
    if (unread) void markMessagesReadAction(taskId);
  }, [taskId, unread]);
  return null;
}
