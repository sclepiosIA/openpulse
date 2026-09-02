/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MaterielList } from "./MaterielList";

const { BASE_MATERIEL } = vi.hoisted(() => ({
  BASE_MATERIEL: {
    pc_mac: { assigne: false, modele: "", numero_serie: "" },
    laptop: { assigne: false, modele: "", numero_serie: "" },
    smartphone: { assigne: false, modele: "", numero_serie: "", numero: "" },
    licences: [
      { nom: "Office", numero: "LIC-001" },
      { nom: "Adobe", numero: "LIC-002" },
    ],
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      data-testid={`checkbox-${id}`}
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => <input placeholder={placeholder} value={value} onChange={onChange} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ariaLabel,
    "aria-label": ariaLabelAttr,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    ariaLabel?: string;
    "aria-label"?: string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabelAttr ?? ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Laptop: () => <svg data-testid="icon-laptop" />,
  Smartphone: () => <svg data-testid="icon-smartphone" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Trash2: () => <svg data-testid="icon-trash" />,
}));

describe("MaterielList", () => {
  it("affiche le titre et les licences existantes", () => {
    const onUpdate = vi.fn();

    render(<MaterielList materiel={BASE_MATERIEL} onUpdate={onUpdate} />);

    expect(screen.getByText("Matériel")).toBeInTheDocument();
    expect(screen.getByText("Licences logicielles")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getByText("LIC-001")).toBeInTheDocument();
    expect(screen.getByText("Adobe")).toBeInTheDocument();
    expect(screen.getByText("LIC-002")).toBeInTheDocument();
  });

  it("toggle PC/MAC et transmet un objet métier mis à jour", () => {
    const onUpdate = vi.fn();

    render(<MaterielList materiel={BASE_MATERIEL} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId("checkbox-pc_mac"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      ...BASE_MATERIEL,
      pc_mac: { ...BASE_MATERIEL.pc_mac, assigne: true },
    });
  });

  it("affiche les champs d'un matériel assigné et met à jour le modèle smartphone", () => {
    const onUpdate = vi.fn();
    const materiel = {
      ...BASE_MATERIEL,
      smartphone: { assigne: true, modele: "iPhone 14", numero_serie: "SN-123", numero: "0601020304" },
    };

    render(<MaterielList materiel={materiel} onUpdate={onUpdate} />);

    expect(screen.getByDisplayValue("iPhone 14")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SN-123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0601020304")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("iPhone 14"), { target: { value: "Pixel 8" } });

    expect(onUpdate).toHaveBeenCalledWith({
      ...materiel,
      smartphone: { ...materiel.smartphone, modele: "Pixel 8" },
    });
  });

  it("ajoute une licence seulement si nom et numéro sont renseignés", () => {
    const onUpdate = vi.fn();

    render(<MaterielList materiel={BASE_MATERIEL} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByPlaceholderText("Nom de la licence"), { target: { value: "Figma" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Numéro"), { target: { value: "LIC-777" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      ...BASE_MATERIEL,
      licences: [...BASE_MATERIEL.licences, { nom: "Figma", numero: "LIC-777" }],
    });
  });

  it("supprime la licence correspondant à l'index cliqué", () => {
    const onUpdate = vi.fn();

    render(<MaterielList materiel={BASE_MATERIEL} onUpdate={onUpdate} />);

    const buttons = screen.getAllByRole("button");
    const deleteButtons = buttons.filter((button) => button.getAttribute("aria-label") === null);
    fireEvent.click(deleteButtons[0]);

    expect(onUpdate).toHaveBeenCalledWith({
      ...BASE_MATERIEL,
      licences: [{ nom: "Adobe", numero: "LIC-002" }],
    });
  });

  it("met à jour le numéro de série du laptop assigné", () => {
    const onUpdate = vi.fn();
    const materiel = {
      ...BASE_MATERIEL,
      laptop: { assigne: true, modele: "ThinkPad", numero_serie: "OLD-SN" },
    };

    render(<MaterielList materiel={materiel} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByDisplayValue("OLD-SN"), { target: { value: "NEW-SN-42" } });

    expect(onUpdate).toHaveBeenCalledWith({
      ...materiel,
      laptop: { ...materiel.laptop, numero_serie: "NEW-SN-42" },
    });
  });
});