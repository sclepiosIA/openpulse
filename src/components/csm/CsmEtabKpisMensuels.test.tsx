import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const HO = vi.hoisted(() => {
  const React = require("react");

  // Stable mock functions
  const upsert = vi.fn();
  const remove = vi.fn();

  // Sample data used by the mocked hook
  const successData = [
    {
      id: "k1",
      mois: "Jan",
      taux_uhcd_backend: 10,
      taux_uhcd_compte: 20,
      passages_total: 100,
      dossiers_traites: 50,
      taux_utilisation: null,
      sort_order: 0,
    },
    {
      id: "k2",
      mois: "Feb",
      taux_uhcd_backend: null,
      taux_uhcd_compte: null,
      passages_total: null,
      dossiers_traites: null,
      taux_utilisation: 60,
      sort_order: 1,
    },
  ];

  // Simple UI component mocks returning native elements
  const Table = (props) => React.createElement("table", props);
  const TableBody = (props) => React.createElement("tbody", props);
  const TableCell = (props) => React.createElement("td", props);
  const TableHead = (props) => React.createElement("th", props);
  const TableHeader = (props) => React.createElement("thead", props);
  const TableRow = (props) => React.createElement("tr", props);

  const Card = (props) => React.createElement("div", props);
  const CardContent = (props) => React.createElement("div", props);
  const CardHeader = (props) => React.createElement("div", props);
  const CardTitle = (props) => React.createElement("h3", props);

  const Button = ({ children, onClick, ...rest }) =>
    React.createElement(
      "button",
      { onClick, ...rest },
      children,
    );

  // Progress exposes value as data-value to assert easily
  const Progress = ({ value, className }) =>
    React.createElement("div", { "data-value": value, className }, String(value ?? ""));

  // Icons
  const Plus = () => React.createElement("svg", null);
  const Trash2 = () => React.createElement("svg", null);
  const Activity = () => React.createElement("svg", null);

  // EditableCell: stable component that provides identifiable test ids for save buttons
  const EditableCell = ({ value, placeholder, onSave }) =>
    React.createElement(
      "div",
      null,
      React.createElement("input", {
        "data-testid": `input-${value ?? placeholder}`,
        defaultValue: value ?? "",
        "aria-label": `input-${value ?? placeholder}`,
      }),
      React.createElement(
        "button",
        {
          "data-testid": `save-${value ?? placeholder}`,
          onClick: () => onSave("NEWVALUE"),
        },
        "save",
      ),
    );

  const cn = (...parts) => parts.filter(Boolean).join(" ");

  // Mock implementation of the hook: returns different shapes based on etablissementId param
  const mockUseCsmKpisMensuels = vi.fn((etablissementId) => {
    if (etablissementId === "loading") {
      return { data: [], isLoading: true, upsert, remove };
    }
    if (etablissementId === "error") {
      return { data: null, error: { message: "boom" }, isError: true, upsert, remove };
    }
    // default success
    return { data: successData, upsert, remove };
  });

  return {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Progress,
    Plus,
    Trash2,
    Activity,
    EditableCell,
    cn,
    upsert,
    remove,
    successData,
    mockUseCsmKpisMensuels,
  };
});

// Mock all internal imports used by the component
vi.mock("@/components/ui/table", () => ({
  Table: HO.Table,
  TableBody: HO.TableBody,
  TableCell: HO.TableCell,
  TableHead: HO.TableHead,
  TableHeader: HO.TableHeader,
  TableRow: HO.TableRow,
}));

vi.mock("@/components/ui/card", () => ({
  Card: HO.Card,
  CardContent: HO.CardContent,
  CardHeader: HO.CardHeader,
  CardTitle: HO.CardTitle,
}));

vi.mock("@/components/ui/button", () => ({
  Button: HO.Button,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: HO.Progress,
}));

vi.mock("lucide-react", () => ({
  Plus: HO.Plus,
  Trash2: HO.Trash2,
  Activity: HO.Activity,
}));

vi.mock("@/components/csm/EditableCell", () => ({
  EditableCell: HO.EditableCell,
}));

vi.mock("@/hooks/csm/useCsmKpisMensuels", () => ({
  useCsmKpisMensuels: HO.mockUseCsmKpisMensuels,
}));

vi.mock("@/lib/utils", () => ({
  cn: HO.cn,
}));

// Now import the component under test (after mocks)
import { CsmEtabKpisMensuels } from "./CsmEtabKpisMensuels";

describe("CsmEtabKpisMensuels", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  const Wrapper = ({ children }) => React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    HO.upsert.mockClear();
    HO.remove.mockClear();
    HO.mockUseCsmKpisMensuels.mockClear();
  });

  it("hook: exposes loading, success and error shapes via the mocked hook", () => {
    // loading
    const { result: r1 } = renderHook(() => HO.mockUseCsmKpisMensuels("loading"), { wrapper: Wrapper });
    expect(r1.current.isLoading).toBe(true);
    expect(Array.isArray(r1.current.data)).toBe(true);
    // success
    const { result: r2 } = renderHook(() => HO.mockUseCsmKpisMensuels("any"), { wrapper: Wrapper });
    expect(Array.isArray(r2.current.data)).toBe(true);
    expect(r2.current.data.length).toBe(2);
    expect(r2.current.data[0].mois).toBe("Jan");
    expect(typeof r2.current.upsert).toBe("function");
    expect(typeof r2.current.remove).toBe("function");
    // error
    const { result: r3 } = renderHook(() => HO.mockUseCsmKpisMensuels("error"), { wrapper: Wrapper });
    expect(r3.current.isError).toBe(true);
    expect(r3.current.error).toEqual(expect.objectContaining({ message: "boom" }));
  });

  it("renders KPI rows and displays computed average and progress values", () => {
    render(React.createElement(CsmEtabKpisMensuels, { etablissementId: "any" }), { wrapper: Wrapper });

    // Average should be Moy. 55% for the mocked data: computed taux 50 and 60 -> avg 55
    expect(screen.getByText("Moy. 55%")).toBeTruthy();

    // Progress values rendered as data-value attributes
    const progressElements = screen.getAllByText(/^(50|60)$/).map((el) => el);
    // There should be two displayed numeric progress texts: "50" and "60"
    expect(progressElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
  });

  it("clicking delete calls remove with the correct id", async () => {
    render(React.createElement(CsmEtabKpisMensuels, { etablissementId: "any" }), { wrapper: Wrapper });

    // There are two delete buttons with aria-label="Supprimer"
    const deleteButtons = screen.getAllByLabelText("Supprimer");
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    expect(HO.remove).toHaveBeenCalledTimes(1);
    expect(HO.remove).toHaveBeenCalledWith("k1");
  });

  it("adding a period calls upsert with computed mois and sort_order", async () => {
    render(React.createElement(CsmEtabKpisMensuels, { etablissementId: "my-id" }), { wrapper: Wrapper });

    const addButton = screen.getByText("Ajouter une période");
    expect(addButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(HO.upsert).toHaveBeenCalledTimes(1);
    expect(HO.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: "my-id",
        mois: "Mois 3",
        sort_order: -1,
      }),
    );
  });

  it("editing periode cell triggers upsert with the new mois value", async () => {
    render(React.createElement(CsmEtabKpisMensuels, { etablissementId: "any" }), { wrapper: Wrapper });

    // Our EditableCell mock creates a save button with data-testid `save-${valueOrPlaceholder}`
    const saveBtn = screen.getByTestId("save-Jan");
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(HO.upsert).toHaveBeenCalled();
    expect(HO.upsert).toHaveBeenCalledWith(expect.objectContaining({ mois: "NEWVALUE", id: "k1" }));
  });
});