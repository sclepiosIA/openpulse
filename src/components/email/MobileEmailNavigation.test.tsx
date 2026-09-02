import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MobileEmailNavigation } from "./MobileEmailNavigation";

const { ACCOUNTS } = vi.hoisted(() => ({
  ACCOUNTS: [
    { id: "acc-1", email_address: "first@example.test", display_name: "Premier compte" },
    { id: "acc-2", email_address: "second@example.test", display_name: null },
  ],
}));

vi.mock("lucide-react", () => ({
  Menu: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-menu" aria-hidden="true" {...props} />,
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mail" aria-hidden="true" {...props} />,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" aria-hidden="true" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/drawer", async () => {
  const ReactModule = await import("react");

  type DrawerContextValue = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

  const DrawerContext = ReactModule.createContext<DrawerContextValue | null>(null);

  const Drawer = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      <div data-testid="drawer-root">{children}</div>
    </DrawerContext.Provider>
  );

  const DrawerTrigger = ({
    children,
    asChild,
  }: {
    children: React.ReactElement;
    asChild?: boolean;
  }) => {
    const context = ReactModule.useContext(DrawerContext);
    if (!context) return children;

    const handleClick = () => context.onOpenChange(true);

    if (asChild && ReactModule.isValidElement(children)) {
      return ReactModule.cloneElement(children, {
        onClick: handleClick,
      });
    }

    return <button onClick={handleClick}>{children}</button>;
  };

  const DrawerContent = ({ children }: { children: React.ReactNode }) => {
    const context = ReactModule.useContext(DrawerContext);
    if (!context?.open) return null;
    return <div data-testid="drawer-content">{children}</div>;
  };

  const DrawerHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DrawerTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const DrawerDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

  return {
    Drawer,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
  };
});

describe("MobileEmailNavigation", () => {
  it("ouvre le drawer et affiche les sections ainsi que les comptes synchronisés", () => {
    const onTabChange = vi.fn();
    const onAccountChange = vi.fn();

    render(
      <MobileEmailNavigation
        currentTab="inbox"
        onTabChange={onTabChange}
        pendingCount={3}
        emailAccounts={ACCOUNTS}
        currentAccountId="acc-1"
        onAccountChange={onAccountChange}
      />,
    );

    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Accédez aux différentes sections et comptes emails")).toBeInTheDocument();
    expect(screen.getByText("Comptes synchronisés (2)")).toBeInTheDocument();
    expect(screen.getByText("first@example.test")).toBeInTheDocument();
    expect(screen.getByText("Premier compte")).toBeInTheDocument();
    expect(screen.getByText("second@example.test")).toBeInTheDocument();
    expect(screen.getByText("Sections")).toBeInTheDocument();

    const inboxButton = screen.getByRole("button", { name: /Boîte de réception/i });
    const classificationButton = screen.getByRole("button", { name: /Classification/i });
    const etablissementsButton = screen.getByRole("button", { name: /Par établissement/i });
    const draftsButton = screen.getByRole("button", { name: /Brouillons/i });
    const settingsButton = screen.getByRole("button", { name: /Paramètres/i });

    expect(inboxButton).toBeInTheDocument();
    expect(classificationButton).toBeInTheDocument();
    expect(etablissementsButton).toBeInTheDocument();
    expect(draftsButton).toBeInTheDocument();
    expect(settingsButton).toBeInTheDocument();

    expect(within(settingsButton).getByText("3")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon-check")).toHaveLength(1);
    expect(inboxButton.className).toContain("bg-primary/10");
    expect(settingsButton.className).not.toContain("bg-primary/10");
  });

  it("change d'onglet puis ferme le drawer", () => {
    const onTabChange = vi.fn();
    const onAccountChange = vi.fn();

    render(
      <MobileEmailNavigation
        currentTab="inbox"
        onTabChange={onTabChange}
        pendingCount={2}
        emailAccounts={ACCOUNTS}
        currentAccountId="acc-1"
        onAccountChange={onAccountChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Classification/i }));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("classification");
    expect(onAccountChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("drawer-content")).not.toBeInTheDocument();
  });

  it("change de compte puis ferme le drawer", () => {
    const onTabChange = vi.fn();
    const onAccountChange = vi.fn();

    render(
      <MobileEmailNavigation
        currentTab="settings"
        onTabChange={onTabChange}
        pendingCount={1}
        emailAccounts={ACCOUNTS}
        currentAccountId="acc-1"
        onAccountChange={onAccountChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /second@example\.test/i }));

    expect(onAccountChange).toHaveBeenCalledTimes(1);
    expect(onAccountChange).toHaveBeenCalledWith("acc-2");
    expect(onTabChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("drawer-content")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section des comptes si aucun compte n'est fourni et masque le badge si pendingCount vaut 0", () => {
    const onTabChange = vi.fn();
    const onAccountChange = vi.fn();

    render(
      <MobileEmailNavigation
        currentTab="drafts"
        onTabChange={onTabChange}
        pendingCount={0}
        emailAccounts={[]}
        currentAccountId=""
        onAccountChange={onAccountChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.queryByText(/Comptes synchronisés/)).not.toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: /Paramètres/i });
    const draftsButton = screen.getByRole("button", { name: /Brouillons/i });

    expect(settingsButton).toBeInTheDocument();
    expect(within(settingsButton).queryByText("0")).not.toBeInTheDocument();
    expect(draftsButton.className).toContain("bg-primary/10");
    expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
  });
});