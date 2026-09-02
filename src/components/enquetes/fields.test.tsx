/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadioField, CheckboxArrayField, ScaleField, TextField } from "./fields";

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.ComponentProps<"label">) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
  }) => <div data-testid="radio-group" {...props}>{children}</div>,
  RadioGroupItem: ({
    value,
    id,
  }: {
    value: string;
    id?: string;
  }) => <input data-testid={`radio-${value}`} type="radio" value={value} id={id} readOnly />,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
    id?: string;
  }) => (
    <input
      data-testid={id}
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.()}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    min,
    max,
    step,
    onValueChange,
  }: {
    value: number[];
    min: number;
    max: number;
    step?: number;
    onValueChange?: (v: number[]) => void;
  }) => (
    <input
      data-testid="slider"
      type="range"
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.ComponentProps<"div">) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.ComponentProps<"div">) => <div data-testid="card-content" {...props}>{children}</div>,
}));

describe("fields.tsx", () => {
  describe("RadioField", () => {
    it("renders label, required marker, options and precision textarea only when matching selected value", () => {
      const onChange = vi.fn();
      const onPrecisionChange = vi.fn();

      const { rerender } = render(
        <RadioField
          label="Motif"
          required
          value="a"
          onChange={onChange}
          options={[
            { value: "a", label: "Option A" },
            { value: "other", label: "Autre" },
          ]}
          precision={{
            value: "",
            onChange: onPrecisionChange,
            placeholder: "Détaillez",
            showWhen: "other",
          }}
        />,
      );

      expect(screen.getByText("Motif")).toBeInTheDocument();
      expect(screen.getByText("*")).toBeInTheDocument();
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Autre")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Détaillez")).not.toBeInTheDocument();

      rerender(
        <RadioField
          label="Motif"
          required
          value="other"
          onChange={onChange}
          options={[
            { value: "a", label: "Option A" },
            { value: "other", label: "Autre" },
          ]}
          precision={{
            value: "texte initial",
            onChange: onPrecisionChange,
            placeholder: "Détaillez",
            showWhen: "other",
          }}
        />,
      );

      const precision = screen.getByPlaceholderText("Détaillez");
      expect(precision).toBeInTheDocument();
      expect(precision).toHaveValue("texte initial");

      fireEvent.change(precision, { target: { value: "réponse précise" } });
      expect(onPrecisionChange).toHaveBeenCalledWith("réponse précise");
    });
  });

  describe("CheckboxArrayField", () => {
    it("renders options, toggles values and updates other input", () => {
      const onChange = vi.fn();
      const onOtherChange = vi.fn();

      render(
        <CheckboxArrayField
          label="Services"
          required
          values={["wifi"]}
          onChange={onChange}
          options={[
            { value: "wifi", label: "Wi‑Fi" },
            { value: "parking", label: "Parking" },
          ]}
          allowOther={{ value: "borne", onChange: onOtherChange }}
        />,
      );

      expect(screen.getByText("Services")).toBeInTheDocument();
      expect(screen.getByText("Wi‑Fi")).toBeInTheDocument();
      expect(screen.getByText("Parking")).toBeInTheDocument();

      const wifi = screen.getByTestId("cb-wifi");
      const parking = screen.getByTestId("cb-parking");

      expect(wifi).toBeChecked();
      expect(parking).not.toBeChecked();

      fireEvent.click(wifi);
      expect(onChange).toHaveBeenCalledWith([]);

      fireEvent.click(parking);
      expect(onChange).toHaveBeenCalledWith(["wifi", "parking"]);

      const otherInput = screen.getByPlaceholderText("Autre : précisez…");
      expect(otherInput).toHaveValue("borne");

      fireEvent.change(otherInput, { target: { value: "ascenseur" } });
      expect(onOtherChange).toHaveBeenCalledWith("ascenseur");
    });
  });

  describe("ScaleField", () => {
    it("renders scale bounds, current value and propagates slider changes", () => {
      const onChange = vi.fn();

      render(
        <ScaleField
          label="Satisfaction"
          required
          min={1}
          max={5}
          value={3}
          onChange={onChange}
          minLabel="Faible"
          maxLabel="Élevée"
        />,
      );

      expect(screen.getByText("Satisfaction")).toBeInTheDocument();
      expect(screen.getByText("1 — Faible")).toBeInTheDocument();
      expect(screen.getByText("5 — Élevée")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();

      const slider = screen.getByTestId("slider");
      expect(slider).toHaveAttribute("min", "1");
      expect(slider).toHaveAttribute("max", "5");
      expect(slider).toHaveValue("3");

      fireEvent.change(slider, { target: { value: "4" } });
      expect(onChange).toHaveBeenCalledWith(4);
    });
  });

  describe("TextField", () => {
    it("renders single-line input with counter and propagates changes", () => {
      const onChange = vi.fn();

      render(
        <TextField
          label="Nom"
          required
          value="abc"
          onChange={onChange}
          placeholder="Votre nom"
          maxLength={10}
        />,
      );

      expect(screen.getByText("Nom")).toBeInTheDocument();
      const input = screen.getByPlaceholderText("Votre nom");
      expect(input.tagName).toBe("INPUT");
      expect(input).toHaveValue("abc");
      expect(screen.getByText("3/10")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "abcd" } });
      expect(onChange).toHaveBeenCalledWith("abcd");
    });

    it("renders multiline textarea with default maxLength counter", () => {
      const onChange = vi.fn();

      render(
        <TextField
          label="Commentaire"
          value="bonjour"
          onChange={onChange}
          placeholder="Écrivez ici"
          multiline
        />,
      );

      const textarea = screen.getByPlaceholderText("Écrivez ici");
      expect(textarea.tagName).toBe("TEXTAREA");
      expect(textarea).toHaveValue("bonjour");
      expect(screen.getByText("7/2000")).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: "salut" } });
      expect(onChange).toHaveBeenCalledWith("salut");
    });
  });
});