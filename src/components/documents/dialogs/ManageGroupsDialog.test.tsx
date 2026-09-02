// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManageGroupsDialog } from "./ManageGroupsDialog";

const {
  AUTH_STATE,
  GROUPS,
  EMPTY_GROUPS,
  MEMBERS,
  EMPTY_MEMBERS,
  SEARCH_RESULTS,
  EMPTY_SEARCH_RESULTS,
  createGroupMutate,
  deleteGroupMutate,
  addMemberMutate,
  removeMemberMutate,
  useUserGroupsMock,
  useGroupMembersMock,
  useProfileSearchMock,
  useCreateGroupMock,
  useDeleteGroupMock,
  useAddGroupMemberMock,
  useRemoveGroupMemberMock,
  onOpenChangeMock,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  GROUPS: [
    {
      id: "g1",
      name: "Équipe RH",
      description: "Ressources humaines",
      color: "#123456",
      member_count: 2,
    },
    {
      id: "g2",
      name: "Comptabilité",
      description: null,
      color: null,
      member_count: 0,
    },
  ],
  EMPTY_GROUPS: [],
  MEMBERS: [
    {
      id: "m1",
      user_id: "u2",
      profile: { prenom: "Alice", nom: "Martin", email: "alice@test.local" },
    },
    {
      id: "m2",
      user_id: "u3",
      profile: { prenom: "Bob", nom: "Durand", email: "bob@test.local" },
    },
  ],
  EMPTY_MEMBERS: [],
  SEARCH_RESULTS: [
    { id: "u3", prenom: "Bob", nom: "Durand", email: "bob@test.local" },
    { id: "u4", prenom: "Charlie", nom: "Petit", email: "charlie@test.local" },
  ],
  EMPTY_SEARCH_RESULTS: [],
  createGroupMutate: vi.fn(),
  deleteGroupMutate: vi.fn(),
  addMemberMutate: vi.fn(),
  removeMemberMutate: vi.fn(),
  useUserGroupsMock: vi.fn(),
  useGroupMembersMock: vi.fn(),
  useProfileSearchMock: vi.fn(),
  useCreateGroupMock: vi.fn(),
  useDeleteGroupMock: vi.fn(),
  useAddGroupMemberMock: vi.fn(),
  useRemoveGroupMemberMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const ariaLabel = props["aria-label"];
    return (
      <button {...props} aria-label={ariaLabel}>
        {props.children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon,
    Plus: Icon,
    Trash2: Icon,
    Users: Icon,
    ArrowLeft: Icon,
    Loader2: Icon,
    UserPlus: Icon,
  };
});

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/profile/useProfileSearch", () => ({
  useProfileSearch: (term: string, options: { queryKey: string }) => useProfileSearchMock(term, options),
}));

vi.mock("@/hooks/documents/useUserGroups", () => ({
  useUserGroups: () => useUserGroupsMock(),
  useCreateGroup: () => useCreateGroupMock(),
  useDeleteGroup: () => useDeleteGroupMock(),
  useGroupMembers: (groupId: string | null) => useGroupMembersMock(groupId),
  useAddGroupMember: () => useAddGroupMemberMock(),
  useRemoveGroupMember: () => useRemoveGroupMemberMock(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("ManageGroupsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));

    useUserGroupsMock.mockReturnValue({
      data: GROUPS,
      isLoading: false,
    });

    useCreateGroupMock.mockReturnValue({
      mutate: createGroupMutate,
      isPending: false,
    });

    useDeleteGroupMock.mockReturnValue({
      mutate: deleteGroupMutate,
      isPending: false,
    });

    useGroupMembersMock.mockImplementation((groupId: string | null) => ({
      data: groupId ? MEMBERS : MEMBERS,
      isLoading: false,
    }));

    useAddGroupMemberMock.mockReturnValue({
      mutate: addMemberMutate,
      isPending: false,
    });

    useRemoveGroupMemberMock.mockReturnValue({
      mutate: removeMemberMutate,
      isPending: false,
    });

    useProfileSearchMock.mockImplementation((term: string) => ({
      data: term.length >= 2 ? SEARCH_RESULTS : EMPTY_SEARCH_RESULTS,
      isLoading: false,
      isError: false,
      error: null,
    }));
  });

  it("affiche l'état de chargement de la liste des groupes", () => {
    useUserGroupsMock.mockReturnValue({
      data: GROUPS,
      isLoading: true,
    });

    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Groupes d'utilisateurs")).toBeInTheDocument();
    expect(screen.queryByText("Équipe RH")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucun groupe créé")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun groupe n'existe", () => {
    useUserGroupsMock.mockReturnValue({
      data: EMPTY_GROUPS,
      isLoading: false,
    });

    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Aucun groupe créé")).toBeInTheDocument();
    expect(screen.queryByText("Équipe RH")).not.toBeInTheDocument();
  });

  it("affiche les groupes et permet de créer un groupe avec le nom nettoyé", () => {
    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Équipe RH")).toBeInTheDocument();
    expect(screen.getByText("Ressources humaines")).toBeInTheDocument();
    expect(screen.getByText("Comptabilité")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Nom du groupe...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Nouveau groupe  " } });
    fireEvent.click(screen.getByRole("button", { name: /créer/i }));

    expect(createGroupMutate).toHaveBeenCalledWith({ name: "Nouveau groupe" });
    expect(input.value).toBe("");
  });

  it("n'appelle pas la création si le nom est vide ou espaces", () => {
    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByPlaceholderText("Nom du groupe...");
    fireEvent.change(input, { target: { value: "   " } });

    expect(screen.getByRole("button", { name: /créer/i })).toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(createGroupMutate).not.toHaveBeenCalled();
  });

  it("supprime un groupe après confirmation", () => {
    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(deleteButtons[0]);

    expect(globalThis.confirm).toHaveBeenCalledWith("Supprimer ce groupe ?");
    expect(deleteGroupMutate).toHaveBeenCalledWith("g1");
  });

  it("n'appelle pas la suppression si la confirmation est refusée", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(deleteButtons[0]);

    expect(deleteGroupMutate).not.toHaveBeenCalled();
  });

  it("ouvre le détail d'un groupe, affiche ses membres, ajoute un membre non présent et retire un membre", () => {
    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText("Équipe RH"));

    expect(screen.getAllByText("Équipe RH")[0]).toBeInTheDocument();
    expect(screen.getByText("Ressources humaines")).toBeInTheDocument();
    expect(screen.getByText("Membres (2)")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getAllByText("Bob Durand")).toHaveLength(1);
    expect(screen.getByText("AM")).toBeInTheDocument();
    expect(screen.getByText("BD")).toBeInTheDocument();

    const memberSearchInput = screen.getByPlaceholderText("Ajouter un membre...");
    fireEvent.change(memberSearchInput, { target: { value: "ch" } });

    expect(screen.getByText("Charlie Petit")).toBeInTheDocument();
    expect(screen.getAllByText("Bob Durand")).toHaveLength(1);

    fireEvent.click(screen.getByText("Charlie Petit"));
    expect(addMemberMutate).toHaveBeenCalledWith({ groupId: "g1", userId: "u4" });
    expect((screen.getByPlaceholderText("Ajouter un membre...") as HTMLInputElement).value).toBe("");

    const removeButtons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(removeButtons[0]);
    expect(removeMemberMutate).toHaveBeenCalledWith({ memberId: "m1", groupId: "g1" });
  });

  it("affiche le chargement des membres puis l'état vide", () => {
    useGroupMembersMock.mockReturnValue({
      data: EMPTY_MEMBERS,
      isLoading: true,
    });

    const { rerender } = render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText("Équipe RH"));
    expect(screen.getByText("Membres (0)")).toBeInTheDocument();
    expect(screen.queryByText("Aucun membre")).not.toBeInTheDocument();

    useGroupMembersMock.mockReturnValue({
      data: EMPTY_MEMBERS,
      isLoading: false,
    });

    rerender(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />);
    expect(screen.getByText("Aucun membre")).toBeInTheDocument();
  });

  it("revient à la liste des groupes via le bouton retour", () => {
    render(<ManageGroupsDialog open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText("Équipe RH"));
    expect(screen.getByPlaceholderText("Ajouter un membre...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));

    expect(screen.getByText("Groupes d'utilisateurs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nom du groupe...")).toBeInTheDocument();
  });
});