/* @vitest-environment jsdom */
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { Calendar } from "./calendar";

const { dayPickerMock, cnMock, buttonVariantsMock } = vi.hoisted(() => {
  return {
    dayPickerMock: vi.fn(),
    cnMock: vi.fn((...args: Array<string | undefined | null | false>) =>
      args.filter(Boolean).join(" ")
    ),
    buttonVariantsMock: vi.fn(({ variant }: { variant?: string } = {}) =>
      variant ? `btn-${variant}` : "btn-default"
    ),
  };
});

vi.mock("react-day-picker", () => ({
  DayPicker: (props: Record<string, unknown>) => {
    dayPickerMock(props);
    return React.createElement(
      "div",
      {
        "data-testid": "day-picker",
        "data-classname": String(props.className ?? ""),
        "data-show-outside-days": String(props.showOutsideDays),
      },
      React.createElement("pre", { "data-testid": "day-picker-props" }, JSON.stringify(props))
    );
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}));

vi.mock("@/components/ui/button", () => ({
  buttonVariants: buttonVariantsMock,
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-left", ...props }),
  ChevronRight: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-right", ...props }),
}));

describe("Calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend DayPicker avec les valeurs par défaut et les classNames métier attendus", () => {
    render(<Calendar />);

    expect(dayPickerMock).toHaveBeenCalledTimes(1);
    const props = dayPickerMock.mock.calls[0][0] as {
      showOutsideDays: boolean;
      className: string;
      classNames: Record<string, string>;
      components: {
        IconLeft: React.ComponentType<Record<string, unknown>>;
        IconRight: React.ComponentType<Record<string, unknown>>;
      };
    };

    expect(props.showOutsideDays).toBe(true);
    expect(props.className).toBe("p-3");
    expect(props.classNames.months).toBe("flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0");
    expect(props.classNames.nav_button).toBe("btn-outline h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100");
    expect(props.classNames.day).toBe("btn-ghost h-9 w-9 p-0 font-normal aria-selected:opacity-100");
    expect(props.classNames.day_selected).toContain("bg-primary text-primary-foreground");
    expect(props.classNames.day_hidden).toBe("invisible");

    const Left = props.components.IconLeft;
    const Right = props.components.IconRight;

    render(
      <div>
        <Left />
        <Right />
      </div>
    );

    const leftIcon = screen.getByTestId("icon-left");
    const rightIcon = screen.getByTestId("icon-right");

    expect(leftIcon.getAttribute("class")).toBe("h-4 w-4");
    expect(rightIcon.getAttribute("class")).toBe("h-4 w-4");

    expect(buttonVariantsMock).toHaveBeenCalledWith({ variant: "outline" });
    expect(buttonVariantsMock).toHaveBeenCalledWith({ variant: "ghost" });
  });

  it("fusionne className et classNames fournis avec les valeurs par défaut", () => {
    render(
      <Calendar
        className="custom-root"
        classNames={{
          month: "custom-month",
          day_today: "custom-today",
        }}
      />
    );

    const props = dayPickerMock.mock.calls[0][0] as {
      className: string;
      classNames: Record<string, string>;
    };

    expect(props.className).toBe("p-3 custom-root");
    expect(props.classNames.month).toBe("custom-month");
    expect(props.classNames.day_today).toBe("custom-today");
    expect(props.classNames.caption).toBe("flex justify-center pt-1 relative items-center");
    expect(props.classNames.nav_button_previous).toBe("absolute left-1");
  });

  it("propage les props supplémentaires à DayPicker et peut désactiver showOutsideDays", () => {
    const onSelect = vi.fn();
    const selected = new Date(2024, 4, 12);

    render(
      <Calendar
        showOutsideDays={false}
        mode="single"
        selected={selected}
        onSelect={onSelect}
      />
    );

    const props = dayPickerMock.mock.calls[0][0] as {
      showOutsideDays: boolean;
      mode: string;
      selected: Date;
      onSelect: typeof onSelect;
    };

    expect(props.showOutsideDays).toBe(false);
    expect(props.mode).toBe("single");
    expect(props.selected).toBe(selected);
    expect(props.onSelect).toBe(onSelect);
  });
});