import { db } from '../../lib/db';
import { evidenceVault } from '../../domain/evidence/EvidenceVault';
import { DEFAULT_PROJECT_ID, removeProjectStorage } from './projectStorage';
import { storageManager } from './StorageManager';

/**
 * Delete an engagement and every artifact associated with it: chats, security
 * data in IndexedDB and all namespaced localStorage module state.
 *
 * The default engagement is protected because migration seeds user data there.
 */
export async function deleteEngagement(projectId: string): Promise<void> {
  if (!projectId || projectId === DEFAULT_PROJECT_ID) {
    throw new Error('The default engagement cannot be deleted.');
  }

  const chats = await db.getChats();
  await Promise.all(
    chats
      .filter((chat) => (chat.workspaceId || DEFAULT_PROJECT_ID) === projectId)
      .map((chat) => db.deleteChat(chat.id))
  );

  await Promise.all([
    storageManager.clearAssets(projectId),
    storageManager.clearFindings(projectId),
    storageManager.clearScope(projectId),
    storageManager.clearChecklists(projectId),
    evidenceVault.clearEvidence(projectId),
  ]);

  await db.deleteProject(projectId);
  removeProjectStorage(projectId);
}
