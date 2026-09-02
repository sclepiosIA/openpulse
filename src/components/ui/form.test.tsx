// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form"
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField,
} from "./form"

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

vi.mock("@/components/ui/label", () => ({
  Label: React.forwardRef<
    HTMLLabelElement,
    React.LabelHTMLAttributes<HTMLLabelElement>
  >(({ children, ...props }, ref) => (
    <label ref={ref} {...props}>
      {children}
    </label>
  )),
}))

vi.mock("@radix-ui/react-slot", () => ({
  Slot: React.forwardRef<
    HTMLElement,
    React.HTMLAttributes<HTMLElement> & { children?: React.ReactElement }
  >(({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        ...(children.props as object),
      })
    }
    return React.createElement("div", { ...props, ref }, children)
  }),
}))

type TestFormValues = {
  email: string
}

function FormHarness({
  defaultValues,
  onMethods,
  withError = false,
}: {
  defaultValues?: Partial<TestFormValues>
  onMethods?: (methods: UseFormReturn<TestFormValues>) => void
  withError?: boolean
}) {
  const methods = useForm<TestFormValues>({
    defaultValues: {
      email: "",
      ...defaultValues,
    },
  })

  React.useEffect(() => {
    onMethods?.(methods)
    if (withError) {
      methods.setError("email", { type: "manual", message: "Email requis" })
    }
  }, [methods, onMethods, withError])

  return (
    <Form {...methods}>
      <form>
        <FormField
          control={methods.control}
          name="email"
          render={({ field }) => (
            <FormItem data-testid="item">
              <FormLabel data-testid="label">Adresse e-mail</FormLabel>
              <FormControl>
                <input data-testid="input" {...field} />
              </FormControl>
              <FormDescription data-testid="description">
                Entrez votre e-mail
              </FormDescription>
              <FormMessage data-testid="message">Message par défaut</FormMessage>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

function HookReader() {
  const value = useFormField()
  return (
    <div>
      <span data-testid="name">{String(value.name)}</span>
      <span data-testid="id">{value.id}</span>
      <span data-testid="item-id">{value.formItemId}</span>
      <span data-testid="description-id">{value.formDescriptionId}</span>
      <span data-testid="message-id">{value.formMessageId}</span>
      <span data-testid="invalid">{String(value.invalid)}</span>
    </div>
  )
}

describe("form.tsx", () => {
  it("rend les composants de formulaire avec les attributs d'accessibilité attendus sans erreur", () => {
    render(<FormHarness />)

    const label = screen.getByTestId("label")
    const input = screen.getByTestId("input")
    const description = screen.getByTestId("description")
    const message = screen.getByTestId("message")

    expect(label).toHaveAttribute("for", input.getAttribute("id") ?? "")
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(description).toHaveTextContent("Entrez votre e-mail")
    expect(message).toHaveTextContent("Message par défaut")
    expect(input).toHaveAttribute(
      "aria-describedby",
      description.getAttribute("id") ?? "",
    )
    expect(label.className).not.toContain("text-destructive")
  })

  it("propage les ids et l'état métier via useFormField", () => {
    const methodsRef: { current?: UseFormReturn<TestFormValues> } = {}

    function Harness() {
      const methods = useForm<TestFormValues>({
        defaultValues: { email: "demo@test.dev" },
      })

      React.useEffect(() => {
        methodsRef.current = methods
      }, [methods])

      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse e-mail</FormLabel>
                <FormControl>
                  <input {...field} />
                </FormControl>
                <FormDescription>Description</FormDescription>
                <FormMessage>Fallback</FormMessage>
                <HookReader />
              </FormItem>
            )}
          />
        </Form>
      )
    }

    render(<Harness />)

    const id = screen.getByTestId("id").textContent ?? ""
    const itemId = screen.getByTestId("item-id").textContent ?? ""
    const descriptionId = screen.getByTestId("description-id").textContent ?? ""
    const messageId = screen.getByTestId("message-id").textContent ?? ""

    expect(screen.getByTestId("name")).toHaveTextContent("email")
    expect(id).not.toBe("")
    expect(itemId).toBe(`${id}-form-item`)
    expect(descriptionId).toBe(`${id}-form-item-description`)
    expect(messageId).toBe(`${id}-form-item-message`)
    expect(screen.getByTestId("invalid")).toHaveTextContent("false")
    expect(methodsRef.current?.getValues("email")).toBe("demo@test.dev")
  })

  it("affiche les styles et attributs d'erreur quand le champ est invalide", async () => {
    render(<FormHarness withError />)

    const label = await screen.findByTestId("label")
    const input = await screen.findByTestId("input")
    const description = await screen.findByTestId("description")
    const message = await screen.findByTestId("message")

    expect(label.className).toContain("text-destructive")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(message).toHaveTextContent("Email requis")
    expect(input).toHaveAttribute(
      "aria-describedby",
      `${description.getAttribute("id")} ${message.getAttribute("id")}`,
    )
  })

  it("ne rend pas FormMessage sans enfant ni erreur", () => {
    function EmptyMessageHarness() {
      const methods = useForm<TestFormValues>({
        defaultValues: { email: "" },
      })

      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input data-testid="input" {...field} />
                </FormControl>
                <FormMessage data-testid="message" />
              </FormItem>
            )}
          />
        </Form>
      )
    }

    render(<EmptyMessageHarness />)

    expect(screen.getByTestId("input")).toBeInTheDocument()
    expect(screen.queryByTestId("message")).toBeNull()
  })

  it("lève une erreur si useFormField est utilisé hors FormProvider", () => {
    function InvalidHookUsage() {
      useFormField()
      return <div>invalid</div>
    }

    expect(() => render(<InvalidHookUsage />)).toThrow()
  })
})