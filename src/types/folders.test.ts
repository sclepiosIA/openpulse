import { type DocumentFolder, type FolderWithCounts, type FolderWithSharing, type FolderTreeNode, type FolderShareInfo, type FolderBreadcrumbItem, type UpdateFolderData, type DocumentViewStyle } from './folders';

function toTreeNode(
  folder: FolderWithCounts,
  children: FolderTreeNode[] = [],
  sharedWith?: FolderShareInfo[],
  isRestricted?: boolean
): FolderTreeNode {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_folder_id,
    folderType: folder.folder_type,
    icon: folder.icon,
    color: folder.color,
    children,
    documentsCount: folder.documents_count,
    subfoldersCount: folder.subfolders_count,
    isExpanded: false,
    isLoading: false,
    sharedWith,
    isRestricted,
  };
}

function applyUpdate(folder: DocumentFolder, update: UpdateFolderData): DocumentFolder {
  return {
    ...folder,
    name: update.name ?? folder.name,
    parent_folder_id: update.parent_folder_id ?? folder.parent_folder_id,
    icon: update.icon ?? folder.icon,
    color: update.color ?? folder.color,
    position: update.position ?? folder.position,
    updated_at: new Date().toISOString(),
  };
}

function columnsForStyle(style: DocumentViewStyle): number {
  switch (style) {
    case 'tree':
      return 1;
    case 'finder':
      return 2;
    case 'classic':
      return 3;
  }
}

function buildBreadcrumb(
  foldersById: Record<string, DocumentFolder>,
  currentId: string | null
): FolderBreadcrumbItem[] {
  const trail: FolderBreadcrumbItem[] = [];
  let cursor: string | null = currentId;

  if (cursor === null) {
    trail.push({ id: null, name: 'Racine' });
    return trail;
  }

  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    const f = foldersById[cursor];
    if (!f) break;
    trail.push({ id: f.id, name: f.name });
    cursor = f.parent_folder_id;
  }

  // Optionally add a root label if we ended at null parent
  if (cursor === null) {
    trail.push({ id: null, name: 'Racine' });
  }

  return trail.reverse();
}

describe('folders module types and transformations', () => {
  it('maps FolderWithCounts to FolderTreeNode and preserves counts and metadata', () => {
    const now = new Date().toISOString();

    const root: FolderWithCounts = {
      id: 'f_root',
      name: 'Mes documents',
      parent_folder_id: null,
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'folder',
      color: '#112233',
      position: 1,
      created_at: now,
      updated_at: now,
      documents_count: 4,
      subfolders_count: 2,
    };

    const child: FolderWithCounts = {
      id: 'f_child',
      name: 'Sous-dossier',
      parent_folder_id: 'f_root',
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'star',
      color: '#445566',
      position: 2,
      created_at: now,
      updated_at: now,
      documents_count: 1,
      subfolders_count: 0,
    };

    const childNode = toTreeNode(child);
    const rootNode = toTreeNode(root, [childNode]);

    expect(rootNode.id).toBe('f_root');
    expect(rootNode.parentId).toBeNull();
    expect(rootNode.folderType).toBe('personal');
    expect(rootNode.documentsCount).toBe(4);
    expect(rootNode.subfoldersCount).toBe(2);
    expect(rootNode.icon).toBe('folder');
    expect(rootNode.color).toBe('#112233');

    expect(rootNode.children).toHaveLength(1);
    expect(rootNode.children[0].id).toBe('f_child');
    expect(rootNode.children[0].parentId).toBe('f_root');
    expect(rootNode.children[0].documentsCount).toBe(1);
    expect(rootNode.children[0].subfoldersCount).toBe(0);
  });

  it('applies UpdateFolderData correctly to a DocumentFolder', () => {
    const now = new Date().toISOString();
    const folder: DocumentFolder = {
      id: 'f1',
      name: 'Cours',
      parent_folder_id: null,
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'book',
      color: '#abcdef',
      position: 5,
      created_at: now,
      updated_at: now,
    };

    const update: UpdateFolderData = {
      name: 'Cours 2026',
      color: '#123456',
      position: 7,
    };

    const updated = applyUpdate(folder, update);

    expect(updated.id).toBe('f1');
    expect(updated.name).toBe('Cours 2026');
    expect(updated.color).toBe('#123456');
    expect(updated.position).toBe(7);
    expect(updated.icon).toBe('book');
    expect(updated.parent_folder_id).toBeNull();
    // updated_at should be newer or at least different in format; ensure it parses
    expect(new Date(updated.updated_at).toString()).not.toBe('Invalid Date');
  });

  it('handles shared information and restriction flags when building a tree node', () => {
    const now = new Date().toISOString();

    const folderCounts: FolderWithCounts = {
      id: 'f_shared',
      name: 'Partagé',
      parent_folder_id: null,
      owner_id: 'u2',
      folder_type: 'shared',
      related_etablissement_id: null,
      icon: null,
      color: null,
      position: 3,
      created_at: now,
      updated_at: now,
      documents_count: 2,
      subfolders_count: 1,
    };

    const shared: FolderWithSharing = {
      ...folderCounts,
      is_restricted: true,
      permissions_count: 2,
      shared_with: [
        { type: 'user', name: 'Alice', avatar_url: null, color: null, access_level: 'editor' },
        { type: 'group', name: 'Equipe Pédago', avatar_url: null, color: '#00AA88', access_level: 'viewer' },
      ],
    };

    const node = toTreeNode(folderCounts, [], shared.shared_with, shared.is_restricted);

    expect(node.id).toBe('f_shared');
    expect(node.folderType).toBe('shared');
    expect(node.documentsCount).toBe(2);
    expect(node.subfoldersCount).toBe(1);
    expect(node.isRestricted).toBe(true);
    expect(node.sharedWith).toBeDefined();
    expect(node.sharedWith && node.sharedWith.length).toBe(2);
    expect(node.sharedWith && node.sharedWith[0].name).toBe('Alice');
    expect(node.sharedWith && node.sharedWith[1].type).toBe('group');
    expect(node.sharedWith && node.sharedWith[1].access_level).toBe('viewer');
  });

  it('returns expected columns count for each DocumentViewStyle', () => {
    expect(columnsForStyle('tree')).toBe(1);
    expect(columnsForStyle('finder')).toBe(2);
    expect(columnsForStyle('classic')).toBe(3);
  });

  it('builds a breadcrumb trail from current folder up to root', () => {
    const now = new Date().toISOString();

    const root: DocumentFolder = {
      id: 'r',
      name: 'Racine perso',
      parent_folder_id: null,
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'home',
      color: '#000000',
      position: 1,
      created_at: now,
      updated_at: now,
    };
    const parent: DocumentFolder = {
      id: 'p',
      name: 'Maths',
      parent_folder_id: 'r',
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'calc',
      color: null,
      position: 2,
      created_at: now,
      updated_at: now,
    };
    const current: DocumentFolder = {
      id: 'c',
      name: 'Géométrie',
      parent_folder_id: 'p',
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'shape',
      color: null,
      position: 3,
      created_at: now,
      updated_at: now,
    };

    const byId: Record<string, DocumentFolder> = { r: root, p: parent, c: current };
    const breadcrumb = buildBreadcrumb(byId, 'c');

    expect(breadcrumb.map(b => b.name)).toEqual(['Racine', 'Racine perso', 'Maths', 'Géométrie']);
    expect(breadcrumb[0].id).toBeNull();
    expect(breadcrumb[breadcrumb.length - 1].id).toBe('c');
  });

  it('returns only a root breadcrumb item when currentId is null', () => {
    const breadcrumb = buildBreadcrumb({}, null);
    expect(breadcrumb).toHaveLength(1);
    expect(breadcrumb[0]).toEqual({ id: null, name: 'Racine' });
  });
});