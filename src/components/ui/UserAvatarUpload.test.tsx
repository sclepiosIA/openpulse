import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserAvatarUpload } from "./UserAvatarUpload";

const {
  toastSpy,
  debugErrorSpy,
  userAvatarSpy,
  removeSpy,
  uploadSpy,
  getPublicUrlSpy,
  updateSpy,
  eqSpy,
  mockFrom,
  storageFromSpy,
  PUBLIC_URL,
} = vi.hoisted(() => {
  const toastSpy = vi.fn();
  const debugErrorSpy = vi.fn();
  const userAvatarSpy = vi.fn();
  const removeSpy = vi.fn();
  const uploadSpy = vi.fn();
  const getPublicUrlSpy = vi.fn();
  const updateSpy = vi.fn();
  const eqSpy = vi.fn();
  const mockFrom = vi.fn();
  const storageFromSpy = vi.fn();
  const PUBLIC_URL = "https://cdn.local/storage/v1/object/public/user-avatars/u-target/123-avatar.png";

  return {
    toastSpy,
    debugErrorSpy,
    userAvatarSpy,
    removeSpy,
    uploadSpy,
    getPublicUrlSpy,
    updateSpy,
    eqSpy,
    mockFrom,
    storageFromSpy,
    PUBLIC_URL,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorSpy,
  },
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock("./UserAvatar", () => ({
  UserAvatar: (props: { avatarUrl?: string | null; name: string; size?: string; className?: string }) => {
    userAvatarSpy(props);
    return (
      <div
        data-testid="user-avatar"
        data-avatar-url={props.avatarUrl ?? ""}
        data-name={props.name}
        data-size={props.size ?? ""}
        className={props.className}
      />
    );
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Camera: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="camera-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="remove-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: storageFromSpy,
    },
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("UserAvatarUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    removeSpy.mockResolvedValue({ data: null, error: null });
    uploadSpy.mockResolvedValue({ data: { path: "u-target/123-avatar.png" }, error: null });
    getPublicUrlSpy.mockReturnValue({ data: { publicUrl: PUBLIC_URL } });

    eqSpy.mockResolvedValue({ data: [{ id: "profile-1", avatar_url: PUBLIC_URL }], error: null });
    updateSpy.mockReturnValue({
      eq: eqSpy,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "profile-1", avatar_url: PUBLIC_URL }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "profile-1", avatar_url: PUBLIC_URL }, error: null }),
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve(onFulfilled({ data: [{ id: "profile-1", avatar_url: PUBLIC_URL }], error: null })),
      catch: () => Promise.resolve(),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: updateSpy,
          delete: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "profile-1" }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "profile-1" }, error: null }),
          then: (onFulfilled: (value: unknown) => unknown) =>
            Promise.resolve(onFulfilled({ data: [{ id: "profile-1" }], error: null })),
          catch: () => Promise.resolve(),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(onFulfilled({ data: null, error: null })),
        catch: () => Promise.resolve(),
      };
    });

    storageFromSpy.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      remove: removeSpy,
      upload: uploadSpy,
      getPublicUrl: getPublicUrlSpy,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve(onFulfilled({ data: null, error: null })),
      catch: () => Promise.resolve(),
    }));
  });

  it("affiche l'avatar courant et les informations métier initiales", () => {
    renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        targetAuthUserId="u-target"
        profileId="profile-1"
        currentAvatarUrl="https://cdn.local/storage/v1/object/public/user-avatars/u-target/old.png"
        userName="Ada Lovelace"
        size="xl"
        className="custom-class"
      />,
    );

    const avatar = screen.getByTestId("user-avatar");
    expect(avatar).toHaveAttribute(
      "data-avatar-url",
      "https://cdn.local/storage/v1/object/public/user-avatars/u-target/old.png",
    );
    expect(avatar).toHaveAttribute("data-name", "Ada Lovelace");
    expect(avatar).toHaveAttribute("data-size", "xl");
    expect(screen.getByText("Cliquez pour modifier")).toBeInTheDocument();
    expect(screen.getByTestId("camera-icon")).toBeInTheDocument();
    expect(screen.getByTestId("remove-icon")).toBeInTheDocument();
  });

  it("upload une image valide, supprime l'ancien avatar, met à jour le profil et déclenche le callback", async () => {
    const onAvatarChange = vi.fn();

    const { container } = renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        targetAuthUserId="u-target"
        profileId="profile-1"
        currentAvatarUrl="https://cdn.local/storage/v1/object/public/user-avatars/u-target/old.png"
        userName="Ada"
        onAvatarChange={onAvatarChange}
        size="lg"
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("file input introuvable");
    }

    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });

    expect(storageFromSpy).toHaveBeenCalledWith("user-avatars");
    expect(removeSpy).toHaveBeenCalledWith(["u-target/old.png"]);
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^u-target\/\d+\.png$/),
      file,
      { cacheControl: "3600", upsert: true },
    );
    expect(getPublicUrlSpy).toHaveBeenCalledWith(expect.stringMatching(/^u-target\/\d+\.png$/));
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(updateSpy).toHaveBeenCalledWith({ avatar_url: PUBLIC_URL });
    expect(eqSpy).toHaveBeenCalledWith("id", "profile-1");
    expect(onAvatarChange).toHaveBeenCalledWith(PUBLIC_URL);
    expect(toastSpy).toHaveBeenCalledWith({
      title: "Photo mise à jour",
      description: "La photo de profil a été mise à jour avec succès",
    });

    await waitFor(() => {
      expect(screen.getByTestId("user-avatar")).toHaveAttribute("data-avatar-url", PUBLIC_URL);
    });

    expect((input as HTMLInputElement).value).toBe("");
  });

  it("refuse un format de fichier non image", async () => {
    const { container } = renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        profileId="profile-1"
        currentAvatarUrl={null}
        userName="Ada"
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("file input introuvable");
    }

    const file = new File(["txt"], "doc.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Format non supporté",
        description: "Veuillez sélectionner une image (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalledWith("profiles");
  });

  it("refuse un fichier trop volumineux", async () => {
    const { container } = renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        profileId="profile-1"
        currentAvatarUrl={null}
        userName="Ada"
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("file input introuvable");
    }

    const file = new File(["big"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 + 1 });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 2 Mo",
        variant: "destructive",
      });
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalledWith("profiles");
  });

  it("affiche une erreur si l'upload échoue et remet l'interface", async () => {
    uploadSpy.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    const { container } = renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        targetAuthUserId="u-target"
        profileId="profile-1"
        currentAvatarUrl="https://cdn.local/storage/v1/object/public/user-avatars/u-target/old.png"
        userName="Ada"
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("file input introuvable");
    }

    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de mettre à jour la photo de profil",
        variant: "destructive",
      });
    });

    expect(debugErrorSpy).toHaveBeenCalledWith("Error uploading avatar:", { message: "x" });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("user-avatar")).toHaveAttribute(
      "data-avatar-url",
      "https://cdn.local/storage/v1/object/public/user-avatars/u-target/old.png",
    );
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("supprime l'avatar existant, met à jour le profil à null et déclenche le callback", async () => {
    const onAvatarChange = vi.fn();

    renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        profileId="profile-1"
        currentAvatarUrl="https://cdn.local/storage/v1/object/public/user-avatars/u-current/existing.png"
        userName="Ada"
        onAvatarChange={onAvatarChange}
      />,
    );

    const removeButton = screen.getByRole("button");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ avatar_url: null });
    });

    expect(removeSpy).toHaveBeenCalledWith(["u-current/existing.png"]);
    expect(eqSpy).toHaveBeenCalledWith("id", "profile-1");
    expect(onAvatarChange).toHaveBeenCalledWith(null);
    expect(toastSpy).toHaveBeenCalledWith({
      title: "Photo supprimée",
      description: "La photo de profil a été supprimée",
    });

    await waitFor(() => {
      expect(screen.getByTestId("user-avatar")).toHaveAttribute("data-avatar-url", "");
    });
  });

  it("affiche une erreur si la suppression échoue", async () => {
    eqSpy.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        profileId="profile-1"
        currentAvatarUrl="https://cdn.local/storage/v1/object/public/user-avatars/u-current/existing.png"
        userName="Ada"
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de supprimer la photo de profil",
        variant: "destructive",
      });
    });

    expect(debugErrorSpy).toHaveBeenCalledWith("Error removing avatar:", { message: "x" });
    expect(screen.getByTestId("user-avatar")).toHaveAttribute(
      "data-avatar-url",
      "https://cdn.local/storage/v1/object/public/user-avatars/u-current/existing.png",
    );
  });

  it("affiche le loader pendant l'upload", async () => {
    let resolveUpload: ((value: { data: null; error: null }) => void) | undefined;
    uploadSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const { container } = renderWithClient(
      <UserAvatarUpload
        currentAuthUserId="u-current"
        profileId="profile-1"
        currentAvatarUrl={null}
        userName="Ada"
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("file input introuvable");
    }

    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });

    if (resolveUpload) {
      resolveUpload({ data: null, error: null });
    }

    await waitFor(() => {
      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
    });
  });
});