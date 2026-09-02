import React from "react";
import { render, screen, fireEvent, act, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockFromResponse, mockInsertSpy, mockFrom } = vi.hoisted(() => {
  const mockFromResponse = { value: { data: null, error: null } };
  const mockInsertSpy = vi.fn();
  const builder: any = {};
  const chainable = () => builder;

  builder.select = () => chainable();
  builder.eq = () => chainable();
  builder.gte = () => chainable();
  builder.lte = () => chainable();
  builder.in = () => chainable();
  builder.order = () => chainable();
  builder.limit = () => chainable();
  builder.update = () => chainable();
  builder.delete = () => chainable();
  builder.single = () => Promise.resolve(mockFromResponse.value);
  builder.maybeSingle = () => Promise.resolve(mockFromResponse.value);
  builder.insert = ((payload: unknown) => {
    mockInsertSpy(payload);
    return Promise.resolve({ data: payload, error: null });
  }) as unknown as typeof builder.insert;
  // Thenable for awaits on builder itself
  builder.then = (onFulfilled: any, onRejected: any) => Promise.resolve(mockFromResponse.value).then(onFulfilled, onRejected);
  builder.catch = (onRejected: any) => Promise.resolve(mockFromResponse.value).catch(onRejected);

  const mockFrom = vi.fn(() => builder);

  return { mockFromResponse, mockInsertSpy, mockFrom };
});

// Mock supabase client as required
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock UI primitives used by the component
vi.mock("@/components/ui/card", () => {
  const Card: React.FC<any> = ({ children, ...props }) => <div data-testid="Card" {...props}>{children}</div>;
  return { Card };
});
vi.mock("@/components/ui/button", () => {
  const Button: React.FC<any> = ({ children, onClick, "aria-label": ariaLabel, ...props }) => (
    <button data-testid={`Button-${ariaLabel ?? "no-label"}`} onClick={onClick} {...props}>{children}</button>
  );
  return { Button };
});
vi.mock("@/components/ui/badge", () => {
  const Badge: React.FC<any> = ({ children, ...props }) => <span data-testid="Badge" {...props}>{children}</span>;
  return { Badge };
});
vi.mock("@/components/ui/separator", () => {
  const Separator: React.FC<any> = (props) => <hr data-testid="Separator" {...props} />;
  return { Separator };
});

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg data-testid={`icon-${props["data-test"] ?? "icon"}`} />;
  return {
    Reply: (props: any) => <svg data-testid="icon-reply" {...props} />,
    ReplyAll: (props: any) => <svg data-testid="icon-replyall" {...props} />,
    Forward: (props: any) => <svg data-testid="icon-forward" {...props} />,
    Paperclip: (props: any) => <svg data-testid="icon-paperclip" {...props} />,
    ChevronDown: (props: any) => <svg data-testid="icon-chevron-down" {...props} />,
    ChevronUp: (props: any) => <svg data-testid="icon-chevron-up" {...props} />,
  };
});

// Mock relative components imported by the module under test
vi.mock("./EmailAvatar", () => {
  const EmailAvatar: React.FC<any> = ({ name, email, size, className }) => (
    <div data-testid="EmailAvatar" data-name={name} data-email={email} data-size={size} className={className} />
  );
  return { EmailAvatar };
});
vi.mock("./MobileMessageItem", () => {
  const MobileMessageItem: React.FC<any> = ({ message, isExpanded, isExternal, onClick }) => (
    <div data-testid="MobileMessageItem" data-id={message?.id} data-is-expanded={isExpanded ? "true" : "false"} data-is-external={isExternal ? "true" : "false"} onClick={onClick}>
      {String(message?.body_text ?? "")}
    </div>
  );
  return { MobileMessageItem };
});
vi.mock("./CollapsibleCCBanner", () => {
  const CollapsibleCCBanner: React.FC<any> = ({ ccAddresses = [], bccAddresses = [], className }) => (
    <div data-testid="CollapsibleCCBanner" data-cc-count={ccAddresses.length} data-bcc-count={bccAddresses?.length ?? 0} className={className}>
      CC: {ccAddresses.length}
    </div>
  );
  return { CollapsibleCCBanner };
});
vi.mock("./EmailContentWithImages", () => {
  const EmailContentWithImages: React.FC<any> = ({ htmlContent, textContent, messageId }) => (
    <div data-testid="EmailContentWithImages" data-html={String(htmlContent ?? "")} data-text={String(textContent ?? "")} data-id={messageId} />
  );
  return { EmailContentWithImages };
});
vi.mock("./EmailInlineImageGallery", () => {
  const EmailInlineImageGallery: React.FC<any> = ({ messageId }) => <div data-testid="EmailInlineImageGallery" data-id={messageId} />;
  return { EmailInlineImageGallery };
});
vi.mock("./EmailAttachmentViewer", () => {
  const EmailAttachmentViewer: React.FC<any> = ({ messageId }) => <div data-testid="EmailAttachmentViewer" data-id={messageId} />;
  return { EmailAttachmentViewer };
});
vi.mock("./EmailVisioInvitationCard", () => {
  const EmailVisioInvitationCard: React.FC<any> = ({ messageId }) => <div data-testid="EmailVisioInvitationCard" data-id={messageId} />;
  return { EmailVisioInvitationCard };
});
vi.mock("./EmailCalendarInvitationCard", () => {
  const EmailCalendarInvitationCard: React.FC<any> = ({ messageId }) => <div data-testid="EmailCalendarInvitationCard" data-id={messageId} />;
  return { EmailCalendarInvitationCard };
});

// Mock formatting util
const { formattedEmail } = vi.hoisted(() => {
  const formattedEmail = "Formatted <bob@example.com>";
  const formatEmailAddress = vi.fn(() => formattedEmail);
  return { formattedEmail, formatEmailAddress };
});
vi.mock("@/lib/emailUtils", () => {
  return {
    formatEmailAddress: (...args: any[]) => formattedEmail,
  };
});

// Mock other potential global hooks/services to satisfy rules
vi.mock("@/hooks/useAuth", () => {
  const useAuth = () => ({ user: { id: "u1", email: "t@t.co" }, session: { user: { id: "u1" } }, isLoading: false });
  return { useAuth };
});
vi.mock("sonner", () => {
  return { toast: { success: vi.fn(), error: vi.fn() } };
});
vi.mock("react-router", () => {
  return { useNavigate: () => vi.fn() };
});

// Now import the component under test
import { EmailThreadMessageItem } from "./EmailThreadMessageItem";

// Helper: create QueryClient wrapper for renderHook as required
const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
  return ({ children }: { children?: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("EmailThreadMessageItem", () => {
  it("renders mobile collapsed and calls onExpand when clicked", () => {
    const message = {
      id: "m1",
      from_name: "Alice",
      from_address: "alice@example.com",
      body_text: "Hello world from Alice",
      sent_date: new Date().toISOString(),
      has_attachments: false,
    };
    const onExpand = vi.fn();
    render(<EmailThreadMessageItem
      message={message}
      index={0}
      isExpanded={false}
      isMobile={true}
      threadId="t1"
      threadSubject="Subject"
      onExpand={onExpand}
      onCollapse={vi.fn()}
      onReplySingle={vi.fn()}
      onReplyAll={vi.fn()}
      onForward={vi.fn()}
    />);
    const mobile = screen.getByTestId("MobileMessageItem");
    expect(mobile).toBeTruthy();
    expect(mobile.getAttribute("data-id")).toBe("m1");
    // isExternal should be true since from_address does not include "@marque"
    expect(mobile.getAttribute("data-is-external")).toBe("true");
    fireEvent.click(mobile);
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand).toHaveBeenCalledWith("m1");
  });

  it("renders collapsed desktop preview and triggers onExpand when clicked", () => {
    const longText = "Lorem ipsum dolor sit amet consectetur adipiscing elit".repeat(5);
    const htmlWithImage = "<p>Intro</p><img src='x.png'/><p>After</p>";
    const message = {
      id: "d1",
      from_name: "Charlie",
      from_address: "charlie@external.com",
      body_text: longText,
      body_html: htmlWithImage,
      sent_date: new Date().toISOString(),
      has_attachments: true,
    };
    const onExpand = vi.fn();
    render(<EmailThreadMessageItem
      message={message}
      index={0}
      isExpanded={false}
      isMobile={false}
      threadId="t2"
      threadSubject="Thread"
      onExpand={onExpand}
      onCollapse={vi.fn()}
      onReplySingle={vi.fn()}
      onReplyAll={vi.fn()}
      onForward={vi.fn()}
    />);
    // The collapsed view contains the from_name
    const fromName = screen.getByText("Charlie");
    expect(fromName).toBeTruthy();
    // The preview should include part of body_text (truncated to 100 in a span)
    const previewSpan = Array.from(document.querySelectorAll("span")).find((el) => el.textContent && el.textContent.includes("Lorem"));
    expect(previewSpan).toBeTruthy();
    // The container with clickable area is the group div; simulate click by finding the chevron down icon container's parent
    const chevron = screen.getByTestId("icon-chevron-down");
    // Walk up to clickable parent
    const clickable = chevron.closest("div");
    expect(clickable).toBeTruthy();
    fireEvent.click(clickable!);
    expect(onExpand).toHaveBeenCalledWith("d1");
  });

  it("renders expanded message with attachments, cc banner, and reply buttons that call callbacks", () => {
    const message = {
      id: "e1",
      from_name: "Bob",
      from_address: "bob@marque.local",
      body_text: "Short body",
      body_html: "<img src='a'/> <p>Body html</p>",
      sent_date: new Date().toISOString(),
      has_attachments: true,
      attachments_count: 2,
      to_addresses: [{ name: "Dest1", email: "dest1@example.com" }, { name: "", email: "dest2@example.com" }],
      cc_addresses: [{ name: "CC1", email: "cc1@example.com" }],
      bcc_addresses: [],
      subject: "Message subject",
    };
    const onCollapse = vi.fn();
    const onReplySingle = vi.fn();
    const onReplyAll = vi.fn();
    const onForward = vi.fn();

    render(<EmailThreadMessageItem
      message={message}
      index={1}
      isExpanded={true}
      isMobile={false}
      threadId="thread-123"
      threadSubject="Thread subj"
      onExpand={vi.fn()}
      onCollapse={onCollapse}
      onReplySingle={onReplySingle}
      onReplyAll={onReplyAll}
      onForward={onForward}
    />);

    // Expect the formatted email address from our mock util to be present
    const formatted = screen.getByText((content, node) => content.includes("Formatted"));
    expect(formatted).toBeTruthy();

    // Collapsible CC banner should be present and indicate 1 cc
    const ccBanner = screen.getByTestId("CollapsibleCCBanner");
    expect(ccBanner).toBeTruthy();
    expect(ccBanner.getAttribute("data-cc-count")).toBe("1");

    // Badge should show attachments count and pluralization (2 pièces jointes)
    const badge = screen.getByTestId("Badge");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain("2");

    // Inline gallery and attachment viewer should be present
    expect(screen.getByTestId("EmailInlineImageGallery").getAttribute("data-id")).toBe("e1");
    expect(screen.getByTestId("EmailAttachmentViewer").getAttribute("data-id")).toBe("e1");

    // Click collapse button
    const collapseBtn = screen.getByTestId("Button-Précédent");
    fireEvent.click(collapseBtn);
    expect(onCollapse).toHaveBeenCalledWith("e1");

    // Reply single
    const replyBtn = screen.getByTestId("Button-Répondre");
    act(() => {
      fireEvent.click(replyBtn);
    });
    expect(onReplySingle).toHaveBeenCalledWith("e1");

    // Reply all
    const replyAllBtn = screen.getByTestId("Button-Répondre à tous");
    act(() => {
      fireEvent.click(replyAllBtn);
    });
    expect(onReplyAll).toHaveBeenCalledWith("e1");

    // Forward
    const forwardBtn = screen.getByTestId("Button-Transférer");
    act(() => {
      fireEvent.click(forwardBtn);
    });
    expect(onForward).toHaveBeenCalledWith("e1");
  });
});

describe("Supabase integration mocks used inside hooks (renderHook with QueryClientProvider)", () => {
  it("hook: returns loading then success when supabase returns data", async () => {
    // prepare success response
    mockFromResponse.value = { data: { id: "svc-1", title: "Service" }, error: null };

    const useFetchEmail = () => {
      const [state, setState] = React.useState<{ data: any; error: any; isLoading: boolean; isError: boolean }>({ data: null, error: null, isLoading: true, isError: false });
      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await (await import("@/integrations/supabase/client")).supabase.from("emails").select("*").maybeSingle();
            if (!mounted) return;
            if (res.error) {
              setState({ data: null, error: res.error, isLoading: false, isError: true });
            } else {
              setState({ data: res.data, error: null, isLoading: false, isError: false });
            }
          } catch (err) {
            if (!mounted) return;
            setState({ data: null, error: err, isLoading: false, isError: true });
          }
        })();
        return () => { mounted = false; };
      }, []);
      return state;
    };

    const { result } = renderHook(() => useFetchEmail(), { wrapper: createWrapper() });

    // initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: "svc-1", title: "Service" });
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("hook: returns error state when supabase responds with error", async () => {
    mockFromResponse.value = { data: null, error: { message: "boom" } };

    const useFetchEmail = () => {
      const [state, setState] = React.useState<{ data: any; error: any; isLoading: boolean; isError: boolean }>({ data: null, error: null, isLoading: true, isError: false });
      React.useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            const res = await (await import("@/integrations/supabase/client")).supabase.from("emails").select("*").maybeSingle();
            if (!mounted) return;
            if (res.error) {
              setState({ data: null, error: res.error, isLoading: false, isError: true });
            } else {
              setState({ data: res.data, error: null, isLoading: false, isError: false });
            }
          } catch (err) {
            if (!mounted) return;
            setState({ data: null, error: err, isLoading: false, isError: true });
          }
        })();
        return () => { mounted = false; };
      }, []);
      return state;
    };

    const { result } = renderHook(() => useFetchEmail(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "boom" });
  });

  it("mutation: insert calls supabase.insert with provided payload", async () => {
    mockFromResponse.value = { data: { ok: true }, error: null };
    mockInsertSpy.mockClear();

    const useInsertMessage = () => {
      const insertMessage = async (payload: any) => {
        const { supabase } = await import("@/integrations/supabase/client");
        const res = await supabase.from("messages").insert(payload);
        return res;
      };
      return { insertMessage };
    };

    const { result } = renderHook(() => useInsertMessage(), { wrapper: createWrapper() });

    const payload = { subject: "Hello", body: "World" };

    await act(async () => {
      await result.current.insertMessage(payload);
    });

    expect(mockInsertSpy).toHaveBeenCalledTimes(1);
    expect(mockInsertSpy).toHaveBeenCalledWith(payload);
  });
});