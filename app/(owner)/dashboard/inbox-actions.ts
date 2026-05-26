'use server';

import { fetchInboxPage, type InboxPage } from '@/lib/videos/list';

export async function loadMoreInbox(page: number): Promise<InboxPage> {
  return fetchInboxPage(page);
}
