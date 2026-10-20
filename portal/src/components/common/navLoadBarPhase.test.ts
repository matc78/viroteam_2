import { describe, expect, it } from "vitest";
import {
  initialNavLoadBarState,
  navLoadBarReducer,
  nextNavLoadPhase,
} from "./navLoadBarPhase";

describe("navLoadBarReducer", () => {
  it("incrémente runId à chaque entrée en filling", () => {
    let state = navLoadBarReducer(initialNavLoadBarState, "activate");
    expect(state).toEqual({ phase: "waiting", runId: 0 });
    state = navLoadBarReducer(state, "timer");
    expect(state).toEqual({ phase: "filling", runId: 1 });
    state = navLoadBarReducer(state, "deactivate");
    expect(state).toEqual({ phase: "done", runId: 1 });
    state = navLoadBarReducer(state, "activate");
    expect(state).toEqual({ phase: "filling", runId: 2 });
  });

  it("renvoie le même état si la phase ne change pas", () => {
    expect(navLoadBarReducer(initialNavLoadBarState, "timer")).toBe(
      initialNavLoadBarState,
    );
  });
});

describe("nextNavLoadPhase", () => {
  it("parcourt idle → waiting → filling → done → idle", () => {
    expect(nextNavLoadPhase("idle", "activate")).toBe("waiting");
    expect(nextNavLoadPhase("waiting", "timer")).toBe("filling");
    expect(nextNavLoadPhase("filling", "deactivate")).toBe("done");
    expect(nextNavLoadPhase("done", "timer")).toBe("idle");
  });

  it("n’affiche rien si la navigation finit pendant le délai anti-flash", () => {
    expect(nextNavLoadPhase("waiting", "deactivate")).toBe("idle");
  });

  it("repart en progression si une navigation démarre pendant le fondu", () => {
    expect(nextNavLoadPhase("done", "activate")).toBe("filling");
  });

  it("ignore les événements sans effet", () => {
    expect(nextNavLoadPhase("idle", "deactivate")).toBe("idle");
    expect(nextNavLoadPhase("idle", "timer")).toBe("idle");
    expect(nextNavLoadPhase("filling", "activate")).toBe("filling");
    expect(nextNavLoadPhase("filling", "timer")).toBe("filling");
  });
});
