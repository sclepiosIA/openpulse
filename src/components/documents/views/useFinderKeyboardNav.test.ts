// @vitest-environment jsdom
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinderKeyboardNav } from './useFinderKeyboardNav';

const { LOCAL_ITEMS, NEXTCLOUD_ITEMS, PREVIEW_DOCUMENT, PREVIEW_FILE } = vi.hoisted(() => ({
  LOCAL_ITEMS: [
    { id: 'folder-1', itemType: 'folder' as const, name: 'Folder A' },
    { id: 'doc-1', itemType: 'document' as const, title: 'Document A' },
  ],
  NEXTCLOUD_ITEMS: [
    { id: 'nc-folder-1', itemType: 'folder' as const, basename: 'NC Folder' },
    { id: 'nc-file-1', itemType: 'file' as const, basename: 'NC File.pdf' },
  ],
  PREVIEW_DOCUMENT: { id: 'doc-preview', itemType: 'document' as const, title: 'Preview Doc' },
  PREVIEW_FILE: { id: 'nc-file-preview', itemType: 'file' as const, basename: 'Preview.pdf' },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

function dispatchKey(key: string, target?: EventTarget | null) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  if (target) {
    Object.defineProperty(event, 'target', { value: target, configurable: true });
  }
  document.dispatchEvent(event);
  return event;
}

describe('useFinderKeyboardNav', () => {
  it('navigue en local avec ArrowDown/ArrowUp, ouvre dossier avec ArrowRight et preview document avec Enter/Espace', () => {
    const setSelectedIndicesSpy = vi.fn();
    const selectItemAtIndex = vi.fn();
    const handleFolderSelect = vi.fn();
    const onDocumentPreview = vi.fn();
    const goBack = vi.fn();
    const setNextcloudSelectedIndices = vi.fn();
    const handleNextcloudFolderSelect = vi.fn();
    const selectNextcloudItemAtIndex = vi.fn();
    const handleNextcloudDownload = vi.fn();

    const { rerender } = renderHook(
      ({ selectedIndices, previewDocument }) =>
        useFinderKeyboardNav({
          activeSource: 'local',
          activeItems: LOCAL_ITEMS,
          activeColumnIndex: 0,
          selectedIndices,
          setSelectedIndices: setSelectedIndicesSpy,
          localPathLength: 2,
          previewDocument,
          onDocumentPreview,
          handleFolderSelect,
          selectItemAtIndex,
          activeNextcloudItems: NEXTCLOUD_ITEMS,
          activeNextcloudColumnIndex: 0,
          nextcloudSelectedIndices: [0],
          setNextcloudSelectedIndices,
          nextcloudPathLength: 1,
          previewNextcloudFile: null,
          handleNextcloudFolderSelect,
          selectNextcloudItemAtIndex,
          handleNextcloudDownload,
          goBack,
        }),
      {
        initialProps: { selectedIndices: [0], previewDocument: PREVIEW_DOCUMENT },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      dispatchKey('ArrowDown');
    });

    expect(setSelectedIndicesSpy).toHaveBeenCalledTimes(1);
    const downUpdater = setSelectedIndicesSpy.mock.calls[0][0] as (prev: number[]) => number[];
    expect(downUpdater([0])).toEqual([1]);
    expect(selectItemAtIndex).toHaveBeenCalledWith(1);

    rerender({ selectedIndices: [1], previewDocument: PREVIEW_DOCUMENT });

    act(() => {
      dispatchKey('ArrowUp');
    });

    const upUpdater = setSelectedIndicesSpy.mock.calls[1][0] as (prev: number[]) => number[];
    expect(upUpdater([1])).toEqual([0]);
    expect(selectItemAtIndex).toHaveBeenCalledWith(0);

    rerender({ selectedIndices: [0], previewDocument: PREVIEW_DOCUMENT });

    act(() => {
      dispatchKey('ArrowRight');
    });

    expect(handleFolderSelect).toHaveBeenCalledWith(LOCAL_ITEMS[0], 0, 'commit');

    rerender({ selectedIndices: [1], previewDocument: PREVIEW_DOCUMENT });

    act(() => {
      dispatchKey('Enter');
    });

    expect(onDocumentPreview).toHaveBeenCalledWith(LOCAL_ITEMS[1]);

    act(() => {
      dispatchKey(' ');
    });

    expect(onDocumentPreview).toHaveBeenCalledWith(PREVIEW_DOCUMENT);
  });

  it('gère le retour local avec ArrowLeft/Backspace seulement si le chemin contient plus d’un niveau', () => {
    const setSelectedIndicesSpy = vi.fn();
    const selectItemAtIndex = vi.fn();
    const handleFolderSelect = vi.fn();
    const onDocumentPreview = vi.fn();
    const goBack = vi.fn();
    const setNextcloudSelectedIndices = vi.fn();
    const handleNextcloudFolderSelect = vi.fn();
    const selectNextcloudItemAtIndex = vi.fn();
    const handleNextcloudDownload = vi.fn();

    const { rerender } = renderHook(
      ({ localPathLength }) =>
        useFinderKeyboardNav({
          activeSource: 'local',
          activeItems: LOCAL_ITEMS,
          activeColumnIndex: 0,
          selectedIndices: [0],
          setSelectedIndices: setSelectedIndicesSpy,
          localPathLength,
          previewDocument: null,
          onDocumentPreview,
          handleFolderSelect,
          selectItemAtIndex,
          activeNextcloudItems: NEXTCLOUD_ITEMS,
          activeNextcloudColumnIndex: 0,
          nextcloudSelectedIndices: [0],
          setNextcloudSelectedIndices,
          nextcloudPathLength: 1,
          previewNextcloudFile: null,
          handleNextcloudFolderSelect,
          selectNextcloudItemAtIndex,
          handleNextcloudDownload,
          goBack,
        }),
      {
        initialProps: { localPathLength: 2 },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      dispatchKey('ArrowLeft');
      dispatchKey('Backspace');
    });

    expect(goBack).toHaveBeenCalledTimes(2);

    rerender({ localPathLength: 1 });

    act(() => {
      dispatchKey('ArrowLeft');
      dispatchKey('Backspace');
    });

    expect(goBack).toHaveBeenCalledTimes(2);
  });

  it('ignore les événements provenant d’un input, textarea ou élément dans un dialog', () => {
    const setSelectedIndicesSpy = vi.fn();
    const selectItemAtIndex = vi.fn();
    const handleFolderSelect = vi.fn();
    const onDocumentPreview = vi.fn();
    const goBack = vi.fn();
    const setNextcloudSelectedIndices = vi.fn();
    const handleNextcloudFolderSelect = vi.fn();
    const selectNextcloudItemAtIndex = vi.fn();
    const handleNextcloudDownload = vi.fn();

    renderHook(
      () =>
        useFinderKeyboardNav({
          activeSource: 'local',
          activeItems: LOCAL_ITEMS,
          activeColumnIndex: 0,
          selectedIndices: [0],
          setSelectedIndices: setSelectedIndicesSpy,
          localPathLength: 2,
          previewDocument: PREVIEW_DOCUMENT,
          onDocumentPreview,
          handleFolderSelect,
          selectItemAtIndex,
          activeNextcloudItems: NEXTCLOUD_ITEMS,
          activeNextcloudColumnIndex: 0,
          nextcloudSelectedIndices: [0],
          setNextcloudSelectedIndices,
          nextcloudPathLength: 1,
          previewNextcloudFile: null,
          handleNextcloudFolderSelect,
          selectNextcloudItemAtIndex,
          handleNextcloudDownload,
          goBack,
        }),
      { wrapper: createWrapper() },
    );

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const dialogChild = document.createElement('button');
    dialog.appendChild(dialogChild);
    document.body.appendChild(dialog);

    act(() => {
      dispatchKey('ArrowDown', input);
      dispatchKey('Enter', textarea);
      dispatchKey('ArrowRight', dialogChild);
    });

    expect(setSelectedIndicesSpy).not.toHaveBeenCalled();
    expect(selectItemAtIndex).not.toHaveBeenCalled();
    expect(handleFolderSelect).not.toHaveBeenCalled();
    expect(onDocumentPreview).not.toHaveBeenCalled();

    dialog.remove();
  });

  it('navigue en nextcloud, entre dans un dossier, télécharge un fichier et revient en arrière', () => {
    const setSelectedIndicesSpy = vi.fn();
    const selectItemAtIndex = vi.fn();
    const handleFolderSelect = vi.fn();
    const onDocumentPreview = vi.fn();
    const goBack = vi.fn();
    const setNextcloudSelectedIndices = vi.fn();
    const handleNextcloudFolderSelect = vi.fn();
    const selectNextcloudItemAtIndex = vi.fn();
    const handleNextcloudDownload = vi.fn();

    const { rerender } = renderHook(
      ({ nextcloudSelectedIndices, previewNextcloudFile, nextcloudPathLength }) =>
        useFinderKeyboardNav({
          activeSource: 'nextcloud',
          activeItems: LOCAL_ITEMS,
          activeColumnIndex: 0,
          selectedIndices: [0],
          setSelectedIndices: setSelectedIndicesSpy,
          localPathLength: 1,
          previewDocument: null,
          onDocumentPreview,
          handleFolderSelect,
          selectItemAtIndex,
          activeNextcloudItems: NEXTCLOUD_ITEMS,
          activeNextcloudColumnIndex: 0,
          nextcloudSelectedIndices,
          setNextcloudSelectedIndices,
          nextcloudPathLength,
          previewNextcloudFile,
          handleNextcloudFolderSelect,
          selectNextcloudItemAtIndex,
          handleNextcloudDownload,
          goBack,
        }),
      {
        initialProps: {
          nextcloudSelectedIndices: [0],
          previewNextcloudFile: PREVIEW_FILE,
          nextcloudPathLength: 2,
        },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      dispatchKey('ArrowDown');
    });

    expect(setNextcloudSelectedIndices).toHaveBeenCalledTimes(1);
    const downUpdater = setNextcloudSelectedIndices.mock.calls[0][0] as (prev: number[]) => number[];
    expect(downUpdater([0])).toEqual([1]);
    expect(selectNextcloudItemAtIndex).toHaveBeenCalledWith(1);

    rerender({
      nextcloudSelectedIndices: [0],
      previewNextcloudFile: PREVIEW_FILE,
      nextcloudPathLength: 2,
    });

    act(() => {
      dispatchKey('ArrowRight');
    });

    expect(handleNextcloudFolderSelect).toHaveBeenCalledWith(NEXTCLOUD_ITEMS[0], 'commit');
    const enterFolderUpdater = setNextcloudSelectedIndices.mock.calls[1][0] as (prev: number[]) => number[];
    expect(enterFolderUpdater([0])).toEqual([0, 0]);

    rerender({
      nextcloudSelectedIndices: [1],
      previewNextcloudFile: PREVIEW_FILE,
      nextcloudPathLength: 2,
    });

    act(() => {
      dispatchKey('Enter');
    });

    expect(handleNextcloudDownload).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchKey(' ');
    });

    expect(handleNextcloudDownload).toHaveBeenCalledTimes(2);

    act(() => {
      dispatchKey('Backspace');
    });

    expect(goBack).toHaveBeenCalledTimes(1);
    const backUpdater = setNextcloudSelectedIndices.mock.calls[2][0] as (prev: number[]) => number[];
    expect(backUpdater([0, 1])).toEqual([0]);
  });

  it('n’effectue aucune action de navigation quand les listes sont vides ou aux bornes', () => {
    const setSelectedIndicesSpy = vi.fn();
    const selectItemAtIndex = vi.fn();
    const handleFolderSelect = vi.fn();
    const onDocumentPreview = vi.fn();
    const goBack = vi.fn();
    const setNextcloudSelectedIndices = vi.fn();
    const handleNextcloudFolderSelect = vi.fn();
    const selectNextcloudItemAtIndex = vi.fn();
    const handleNextcloudDownload = vi.fn();

    renderHook(
      () =>
        useFinderKeyboardNav({
          activeSource: 'local',
          activeItems: [],
          activeColumnIndex: 0,
          selectedIndices: [0],
          setSelectedIndices: setSelectedIndicesSpy,
          localPathLength: 1,
          previewDocument: null,
          onDocumentPreview,
          handleFolderSelect,
          selectItemAtIndex,
          activeNextcloudItems: [],
          activeNextcloudColumnIndex: 0,
          nextcloudSelectedIndices: [0],
          setNextcloudSelectedIndices,
          nextcloudPathLength: 1,
          previewNextcloudFile: null,
          handleNextcloudFolderSelect,
          selectNextcloudItemAtIndex,
          handleNextcloudDownload,
          goBack,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      dispatchKey('ArrowDown');
      dispatchKey('ArrowUp');
      dispatchKey('ArrowRight');
      dispatchKey('Enter');
      dispatchKey('ArrowLeft');
      dispatchKey('Backspace');
    });

    expect(setSelectedIndicesSpy).not.toHaveBeenCalled();
    expect(selectItemAtIndex).not.toHaveBeenCalled();
    expect(handleFolderSelect).not.toHaveBeenCalled();
    expect(onDocumentPreview).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
    expect(setNextcloudSelectedIndices).not.toHaveBeenCalled();
    expect(handleNextcloudFolderSelect).not.toHaveBeenCalled();
    expect(selectNextcloudItemAtIndex).not.toHaveBeenCalled();
    expect(handleNextcloudDownload).not.toHaveBeenCalled();
  });
});