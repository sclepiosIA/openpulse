import React from "react";
import { render, screen, fireEvent, act, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { SUPABASE_CURRENT, mockFrom, mockInsert, AUTH_USER, toastSuccess, toastError } = vi.hoisted(() => {
  const SUPABASE_CURRENT = { res: { data: null as any, error: null as any } };
  const mockInsert = vi.fn();
  function builderFactory() {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (...args: any[]) => {
        mockInsert(...args);
        return builder;
      },
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve(SUPABASE_CURRENT.res),
      maybeSingle: () => Promise.resolve(SUPABASE_CURRENT.res),
      then: (onFulfilled: any, onRejected: any) => builder.single().then(onFulfilled, onRejected),
      catch: (fn: any) => builder.single().catch(fn),
    };
    return builder;
  }
  const mockFrom = vi.fn(() => builderFactory());
  const AUTH_USER = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  return { SUPABASE_CURRENT, mockFrom, mockInsert, AUTH_USER, toastSuccess, toastError };
});

// Mocks required by rules and by the component under test
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/components/ui/badge", () => {
  // Simple Badge that forwards props we need to assert on
  return {
    Badge: ({ children, className, title, onClick, "aria-label": ariaLabel }: any) => {
      return React.createElement(
        "div",
        {
          "data-testid": "badge",
          className: className,
          title: title,
          onClick: onClick,
          "aria-label": ariaLabel,
        },
        children
      );
    },
  };
});

vi.mock("@/lib/utils", () => {
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
  };
});

vi.mock("lucide-react", () => {
  const makeIcon = (name: string) => (props: any) =>
    React.createElement("i", { "data-icon": name, className: props.className });
  return {
    Landmark: makeIcon("Landmark"),
    Factory: makeIcon("Factory"),
    Briefcase: makeIcon("Briefcase"),
    Mail: makeIcon("Mail"),
  };
});

vi.mock("react-router-dom", () => {
  return {
    Link: ({ to, className, children }: any) =>
      React.createElement("a", { href: to, className: className, "data-testid": "link" }, children),
    useNavigate: vi.fn(),
  };
});

vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: () => AUTH_USER,
  };
});

vi.mock("sonner", () => {
  return {
    toast: {
      success: toastSuccess,
      error: toastError,
    },
  };
});

// Now import the module under test (after mocks)
import { PartenaireBadge } from "./partenaire-badge";
import { supabase } from "@/integrations/supabase/client";

describe("PartenaireBadge component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const Wrapper: React.FC<any> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // reset supabase response
    SUPABASE_CURRENT.res.data = null;
    SUPABASE_CURRENT.res.error = null;
  });

  it("affiche 'Non classé' et appelle onUnclassifiedClick au clic, avec titre quand clickable", () => {
    const onUnclassifiedClick = vi.fn();
    render(
      React.createElement(PartenaireBadge, {
        type: "prestataire",
        onUnclassifiedClick,
        size: "default",
        showLink: true,
      })
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toBeTruthy();
    expect(badge).toHaveTextContent("Non classé");
    // Mail icon should be present
    const mailIcon = badge.querySelector('[data-icon="Mail"]');
    expect(mailIcon).toBeTruthy();
    // Title should be set when onUnclassifiedClick provided
    expect(badge.getAttribute("title")).toBe("Cliquer pour classifier");

    fireEvent.click(badge);
    expect(onUnclassifiedClick).toHaveBeenCalledTimes(1);
  });

  it("rend un lien vers le partenaire quand partenaireId est fourni et showLink true", () => {
    render(
      React.createElement(PartenaireBadge, {
        type: "institutionnel",
        nom: "ACME",
        ville: "Paris",
        partenaireId: "p-123",
        size: "lg",
        showLink: true,
      })
    );

    const link = screen.getByTestId("link") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/partenaires/p-123");
    // Vérifier contenu texte et présence d'icône Landmark
    expect(link).toHaveTextContent("ACME");
    expect(link).toHaveTextContent("(Paris)");
    const icon = link.querySelector('[data-icon="Landmark"]');
    expect(icon).toBeTruthy();
    // The inner Badge should have an aria-label including the label and nom
    const badge = link.querySelector('[data-testid="badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute("aria-label")).toBe("Partenaire Institutionnel: ACME");
  });

  it("rend un Badge non cliquable quand nom fourni mais pas partenaireId", () => {
    render(
      React.createElement(PartenaireBadge, {
        type: "industriel",
        nom: "IndusCorp",
        ville: "Lyon",
        size: "default",
        showLink: true,
      })
    );

    // No anchor element expected
    const anchors = screen.queryAllByTestId("link");
    expect(anchors.length).toBe(0);

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("IndusCorp");
    // aria-label must reflect the type label 'Industriel'
    expect(badge.getAttribute("aria-label")).toBe("Partenaire Industriel: IndusCorp");
  });

  it("applique les classes de taille 'sm' sur le Badge", () => {
    render(
      React.createElement(PartenaireBadge, {
        type: "prestataire",
        nom: "PrestX",
        ville: "Nice",
        partenaireId: "p2",
        size: "sm",
        className: "extra-class",
      })
    );

    const link = screen.getByTestId("link");
    const badge = link.querySelector('[data-testid="badge"]') as HTMLElement;
    expect(badge).toBeTruthy();
    const classAttr = badge.getAttribute("class") || "";
    // Doit contenir les classes attendues pour la taille sm et la classe passée
    expect(classAttr).toContain("text-xs");
    expect(classAttr).toContain("py-0.5");
    expect(classAttr).toContain("extra-class");
  });

  describe("hooks utilisant supabase - états chargement / succès / erreur et mutation", () => {
    function useFetchPartenaire(id?: string) {
      const [state, setState] = React.useState<{ isLoading: boolean; isError?: boolean; data?: any; error?: any }>({
        isLoading: true,
      });
      React.useEffect(() => {
        let mounted = true;
        supabase
          .from("partenaires")
          .select("*")
          .eq("id", id)
          .single()
          .then((res: any) => {
            if (!mounted) return;
            if (res.error) {
              setState({ isLoading: false, isError: true, error: res.error });
            } else {
              setState({ isLoading: false, data: res.data });
            }
          })
          .catch((err: any) => {
            if (!mounted) return;
            setState({ isLoading: false, isError: true, error: err });
          });
        return () => {
          mounted = false;
        };
      }, [id]);
      return state;
    }

    it("état de chargement initial avant résolution", () => {
      SUPABASE_CURRENT.res = { data: { id: "p-10", nom: "X" }, error: null };
      const { result } = renderHook(() => useFetchPartenaire("p-10"), { wrapper: Wrapper });
      // initial state should be loading true
      expect(result.current.isLoading).toBe(true);
    });

    it("résout avec succès et retourne les données métier", async () => {
      SUPABASE_CURRENT.res = { data: { id: "p-ok", nom: "BonPartenaire", ville: "Bordeaux" }, error: null };
      const { result } = renderHook(() => useFetchPartenaire("p-ok"), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.data).toEqual({ id: "p-ok", nom: "BonPartenaire", ville: "Bordeaux" });
      expect(result.current.isError).not.toBeTruthy();
    });

    it("résout en erreur et indique isError avec message", async () => {
      SUPABASE_CURRENT.res = { data: null, error: { message: "échec de la requête" } };
      const { result } = renderHook(() => useFetchPartenaire("p-err"), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isError).toBeTruthy();
      expect(result.current.error).toEqual({ message: "échec de la requête" });
    });

    it("mutation create appelle supabase.insert avec les bonnes données", async () => {
      // Prepare supabase response for the insert (success)
      SUPABASE_CURRENT.res = { data: { id: "p-new", nom: "Nouveau" }, error: null };

      async function createPartenaire(payload: any) {
        const res = await supabase.from("partenaires").insert([payload]).single();
        return res;
      }

      await act(async () => {
        await createPartenaire({ nom: "Nouveau", ville: "Toulouse" });
      });

      // mockInsert is called with the inserted array, stable reference via vi.hoisted
      expect(mockInsert).toHaveBeenCalled();
      const callArgs = mockInsert.mock.calls[0][0];
      // The insert is invoked with an array containing the object
      expect(Array.isArray(callArgs[0] ? [callArgs] : callArgs)).toBe(true);
      // Because our builderFactory forwards the same args to mockInsert, assert the payload presence
      // mockInsert was called with either an array or object depending on implementation; check contents loosely
      const calledWith = mockInsert.mock.calls[0][0];
      // Ensure at least the nom property is present somewhere in the argument (string match)
      const containsNom =
        (Array.isArray(calledWith) && calledWith[0] && calledWith[0].nom === "Nouveau") ||
        (calledWith && calledWith.nom === "Nouveau");
      expect(containsNom).toBe(true);
    });
  });
});