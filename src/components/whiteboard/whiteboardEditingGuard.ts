type WhiteboardApi = {
  getAppState: () => {
    editingTextElement?: unknown
    editingElement?: unknown
    newElement?: unknown
    editingLinearElement?: unknown
  }
}

export function isWhiteboardTextEditing(
  api: WhiteboardApi | null,
  activeElement: Element | null
) {
  if (!api) return false

  try {
    const appState = api.getAppState()
    if (
      appState.editingTextElement ||
      appState.editingElement ||
      appState.newElement ||
      appState.editingLinearElement
    ) {
      return true
    }
  } catch {
    // L'API peut disparaître pendant le démontage d'Excalidraw.
  }

  return Boolean(
    activeElement &&
      (activeElement.classList.contains('excalidraw-wysiwyg') ||
        activeElement.tagName === 'TEXTAREA')
  )
}
