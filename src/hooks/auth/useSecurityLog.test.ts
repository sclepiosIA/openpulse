/* @vitest-environment jsdom */

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSecurityLog } from "./useSecurityLog";

const {
  USER_AGENT,
  rpcMock,
  debugErrorMock,
  rpcSuccessResult,
  rpcError,
} = vi.hoisted(() => ({
  USER_AGENT: "vitest-jsdom",
  rpcMock: vi.fn(),
  debugErrorMock: vi.fn(),
  rpcSuccessResult: { data: null, error: null },
  rpcError: new Error("rpc failed"),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useSecurityLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue(rpcSuccessResult);
    Object.defineProperty(window.navigator, "userAgent", {
      value: USER_AGENT,
      configurable: true,
    });
  });

  it("expose logAction et appelle le RPC avec les valeurs métier attendues", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityLog(), { wrapper });

    expect(typeof result.current.logAction).toBe("function");

    const details = {
      previous_value: "disabled",
      new_value: "enabled",
      affected_records: 2,
      ip_source: "server",
      reason: "admin update",
      extra_flag: true,
      optional_null: null,
    };

    await act(async () => {
      await result.current.logAction("enable_2fa", "user_settings", details, "res-1");
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("log_security_event", {
      p_action: "enable_2fa",
      p_resource: "user_settings",
      p_details: {
        previous_value: "disabled",
        new_value: "enabled",
        affected_records: 2,
        ip_source: "server",
        reason: "admin update",
        extra_flag: true,
        optional_null: null,
      },
      p_resource_id: "res-1",
      p_ip_address: undefined,
      p_user_agent: USER_AGENT,
    });
  });

  it("n'envoie pas p_details ni p_resource_id quand absents", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityLog(), { wrapper });

    await act(async () => {
      await result.current.logAction("logout", "session");
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("log_security_event", {
      p_action: "logout",
      p_resource: "session",
      p_details: undefined,
      p_resource_id: undefined,
      p_ip_address: undefined,
      p_user_agent: USER_AGENT,
    });
  });

  it("clone les détails via JSON pour envoyer une valeur sérialisée", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityLog(), { wrapper });

    const details = {
      reason: "update",
      affected_records: 1,
    };

    await act(async () => {
      await result.current.logAction("update_policy", "policy", details, "policy-9");
    });

    const sentPayload = rpcMock.mock.calls[0]?.[1] as {
      p_details?: { reason?: string; affected_records?: number };
    };

    expect(sentPayload.p_details).toEqual({
      reason: "update",
      affected_records: 1,
    });
    expect(sentPayload.p_details).not.toBe(details);
  });

  it("capture une erreur RPC sans la relancer", async () => {
    rpcMock.mockRejectedValueOnce(rpcError);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityLog(), { wrapper });

    await expect(
      act(async () => {
        await result.current.logAction("delete_access", "role", { reason: "cleanup" }, "role-2");
      }),
    ).resolves.toBeUndefined();

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});