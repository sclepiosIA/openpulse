import React from "react";
import { render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { foldersState, createFolderSpy } = vi.hoisted(() => {
  const state = { isCreating: false, mode: "idle" as "idle" | "success" | "error" };
  const spy = vi.fn(
    (
      vars: { name: string; parent_folder_id: string | null | undefined },
      options?: { onSuccess?: () => void }
    ) => {
      if (state.mode === "success") {
        options?.onSuccess?.();
        return Promise.resolve({ data: { id: "f1", name: vars.name }, error: null });
      }
      if (state.mode === "error") {
        return Promise.resolve({ data: null, error: { message: "x" } });
      }
      return Promise.resolve({ data: null, error: null });
    }
  );
  return { foldersState: state, createFolderSpy: spy };
});

vi.mock("lucide-react", () => {
  const FolderPlus = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return { FolderPlus };
});

vi.mock("@/components/ui/button", () => {
  const Button = ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  );
  return { Button };
});

vi.mock("@/components/ui/input", () => {
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;
  return { Input };
});

vi.mock("@/components/ui/label", () => {
  const Label = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  );
  return { Label };
});

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(
    null
  );

  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) => {
    return (
      <DialogContext.Provider
        value={{ open: Boolean(open), setOpen: (o: boolean) => onOpenChange?.(o) }}
      >
        <div data-testid="dialog-root">{children}</div>
      </DialogContext.Provider>
    );
  };

  const DialogTrigger = ({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children?: React.ReactNode;
  }) => {
    const ctx = React.useContext(DialogContext);
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      const onClick = (...args: unknown[]) => {
        if (typeof child.props.onClick === "function") child.props.onClick(...args);
        ctx?.setOpen(true);
      };
      return React.cloneElement(child, { onClick });
    }
    return <button onClick={() => ctx?.setOpen(true)}>{children}</button>;
  };

  const DialogContent = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const ctx = React.useContext(DialogContext);
    return ctx?.open ? <div data-testid="dialog-content" className={className}>{children}</div> : null;
  };

  const DialogHeader = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  );
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  const DialogDescription = ({ children }: { children?: React.ReactNode }) => <p>{children}</p>;
  const DialogFooter = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  );

  return {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  };
});

vi.mock("@/hooks/documents/useFolders", () => {
  const useFolders = (parentFolderId?: string | null) => {
    void parentFolderId;
    return {
      createFolder: createFolderSpy,
      isCreating: foldersState.isCreating,
    };
  };
  return { useFolders };
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

import { CreateFolderDialog } from "./CreateFolderDialog";

describe("CreateFolderDialog", () => {
  beforeEach(() => {
    createFolderSpy.mockClear();
    foldersState.mode = "idle";
    foldersState.isCreating = false;
  });

  it("renders default trigger and allows creating a folder successfully", async () => {
    const user = userEvent.setup();
    foldersState.mode = "success";
    const onCreated = vi.fn();

    render(<CreateFolderDialog parentFolderId="pf1" onCreated={onCreated} />);

    const trigger = screen.getByRole("button", { name: /nouveau dossier/i });
    await act(async () => {
      await user.click(trigger);
    });

    const input = screen.getByLabelText(/nom du dossier/i);
    await act(async () => {
      await user.type(input, "Projet A");
    });

    const submit = screen.getByRole("button", { name: "Créer" });
    await act(async () => {
      await user.click(submit);
    });

    expect(createFolderSpy).toHaveBeenCalledTimes(1);
    const callArgs = createFolderSpy.mock.calls[0];
    expect(callArgs[0]).toEqual({ name: "Projet A", parent_folder_id: "pf1" });
    expect(typeof callArgs[1]?.onSuccess).toBe("function");

    // After success: dialog closed and onCreated called
    expect(screen.queryByTestId("dialog-content")).toBeNull();
    expect(screen.queryByLabelText(/nom du dossier/i)).toBeNull();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("disables submit when name is empty or whitespace", async () => {
    const user = userEvent.setup();
    render(<CreateFolderDialog />);

    const trigger = screen.getByRole("button", { name: /nouveau dossier/i });
    await act(async () => {
      await user.click(trigger);
    });

    const input = screen.getByLabelText(/nom du dossier/i);
    const submit = screen.getByRole("button", { name: "Créer" });

    expect(submit).toBeDisabled();

    await act(async () => {
      await user.type(input, "   ");
    });
    expect(submit).toBeDisabled();

    await act(async () => {
      await user.clear(input);
      await user.type(input, "Docs");
    });
    expect(submit).not.toBeDisabled();
  });

  it("shows loading state when isCreating is true", async () => {
    const user = userEvent.setup();
    foldersState.isCreating = true;
    render(<CreateFolderDialog />);

    const trigger = screen.getByRole("button", { name: /nouveau dossier/i });
    await act(async () => {
      await user.click(trigger);
    });

    const loadingButton = screen.getByRole("button", { name: "Création..." });
    expect(loadingButton).toBeDisabled();
  });

  it("handles error during creation by not calling onCreated and keeping the name", async () => {
    const user = userEvent.setup();
    foldersState.mode = "error";
    const onCreated = vi.fn();
    render(<CreateFolderDialog parentFolderId="pf2" onCreated={onCreated} />);

    const trigger = screen.getByRole("button", { name: /nouveau dossier/i });
    await act(async () => {
      await user.click(trigger);
    });

    const input = screen.getByLabelText(/nom du dossier/i);
    await act(async () => {
      await user.type(input, "Erreur Test");
    });

    const submit = screen.getByRole("button", { name: "Créer" });
    await act(async () => {
      await user.click(submit);
    });

    expect(createFolderSpy).toHaveBeenCalledTimes(1);
    const args = createFolderSpy.mock.calls[0];
    expect(args[0]).toEqual({ name: "Erreur Test", parent_folder_id: "pf2" });

    expect(onCreated).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("Erreur Test");
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  it("provides a QueryClientProvider wrapper for hooks (renderHook smoke test)", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ createFolder: createFolderSpy, isCreating: foldersState.isCreating }),
      { wrapper }
    );
    expect(result.current.createFolder).toBe(createFolderSpy);
    expect(result.current.isCreating).toBe(foldersState.isCreating);
  });
})