import { render, fireEvent, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { FinderDropZone } from "./FinderDropZone";

const { cnMock, UploadMock, Loader2Mock } = vi.hoisted(() => {
  const cnMock = (...parts: Array<string | undefined | false>) =>
    parts.filter(Boolean).join(" ");
  const UploadMock = (props: any) => {
    // simple stable mock icon component
    return null;
  };
  const Loader2Mock = (props: any) => {
    return null;
  };
  return { cnMock, UploadMock, Loader2Mock };
});

vi.mock("@/lib/utils", () => {
  return {
    cn: cnMock,
  };
});

vi.mock("lucide-react", () => {
  return {
    Upload: UploadMock,
    Loader2: Loader2Mock,
  };
});

describe("FinderDropZone", () => {
  const createFile = (name = "file.txt", content = "hello", type = "text/plain") =>
    new File([content], name, { type });

  it("shows drag overlay when dragging files and hides on leave", async () => {
    const onFilesDropped = vi.fn();
    const childText = "children-content";
    const { container } = render(
      <FinderDropZone onFilesDropped={onFilesDropped} isUploading={false}>
        <div>{childText}</div>
      </FinderDropZone>
    );

    const wrapperDiv = container.firstElementChild as HTMLElement;
    const file = createFile("a.txt", "a");

    await act(async () => {
      fireEvent.dragEnter(wrapperDiv, {
        dataTransfer: { types: ["Files"], files: [file] },
      });
    });

    expect(screen.getByText("Déposez vos fichiers ici")).toBeTruthy();
    expect(screen.getByText("Les fichiers seront uploadés dans le dossier courant")).toBeTruthy();

    await act(async () => {
      fireEvent.dragLeave(wrapperDiv, {
        dataTransfer: { types: ["Files"], files: [file] },
      });
    });

    // After leaving, overlay should be removed
    expect(screen.queryByText("Déposez vos fichiers ici")).toBeNull();
  });

  it("calls onFilesDropped with files on drop inside an act", async () => {
    const onFilesDropped = vi.fn();
    render(
      <FinderDropZone onFilesDropped={onFilesDropped} isUploading={false}>
        <div>inner</div>
      </FinderDropZone>
    );

    const wrapperDiv = screen.getByText("inner").parentElement as HTMLElement;
    const file = createFile("upload.txt", "content");

    await act(async () => {
      fireEvent.drop(wrapperDiv, {
        dataTransfer: { files: [file], types: ["Files"] },
      });
    });

    expect(onFilesDropped).toHaveBeenCalledTimes(1);
    const calledWith = onFilesDropped.mock.calls[0][0];
    expect(Array.isArray(calledWith)).toBeTruthy();
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].name).toBe("upload.txt");
    expect(calledWith[0] instanceof File).toBeTruthy();
  });

  it("does not call onFilesDropped when dropped with no files", async () => {
    const onFilesDropped = vi.fn();
    render(
      <FinderDropZone onFilesDropped={onFilesDropped} isUploading={false}>
        <div>inner2</div>
      </FinderDropZone>
    );

    const wrapperDiv = screen.getByText("inner2").parentElement as HTMLElement;

    await act(async () => {
      fireEvent.drop(wrapperDiv, {
        dataTransfer: { files: [], types: [] },
      });
    });

    expect(onFilesDropped).not.toHaveBeenCalled();
  });

  it("shows uploading overlay with progress text when isUploading and uploadProgress provided", () => {
    render(
      <FinderDropZone onFilesDropped={vi.fn()} isUploading uploadProgress={{ current: 2, total: 5 }}>
        <div>child-upload</div>
      </FinderDropZone>
    );

    expect(screen.getByText("Upload 2/5...")).toBeTruthy();
    // Loader icon is mocked and does not render content, but overlay text confirms state
  });

  it("shows generic uploading text when isUploading and no uploadProgress", () => {
    render(
      <FinderDropZone onFilesDropped={vi.fn()} isUploading>
        <div>child-upload-2</div>
      </FinderDropZone>
    );

    expect(screen.getByText("Upload en cours...")).toBeTruthy();
  });

  it("does not display drag overlay when uploading even if dragEnter fires", async () => {
    const onFilesDropped = vi.fn();
    const { container } = render(
      <FinderDropZone onFilesDropped={onFilesDropped} isUploading>
        <div>child-drag-uploading</div>
      </FinderDropZone>
    );

    const wrapperDiv = container.firstElementChild as HTMLElement;
    const file = createFile("b.txt", "b");

    await act(async () => {
      fireEvent.dragEnter(wrapperDiv, {
        dataTransfer: { types: ["Files"], files: [file] },
      });
    });

    // While uploading, drag overlay must not appear
    expect(screen.queryByText("Déposez vos fichiers ici")).toBeNull();
  });

  it("uses a QueryClientProvider wrapper when using renderHook (query client options applied)", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => {
        // trivial hook to verify wrapper works; real hooks would use react-query
        return { ok: true };
      },
      { wrapper }
    );

    expect(result.current.ok).toBe(true);
  });
});