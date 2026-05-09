import { describe, expect, it } from "vitest";
import { analyzeIntake } from "../lib/navigation-engine";
import { getDoctorAvatarState } from "./virtual-doctor-avatar";

describe("virtual doctor avatar state mapping", () => {
  it("maps emergency prompts to the emergency avatar state", () => {
    const result = analyzeIntake("medical", "我胸口痛，又呼吸困難，應該點做？");

    expect(getDoctorAvatarState({ result, isSubmitting: false, input: "" })).toBe("emergency");
  });

  it("uses listening while the user is typing before submission", () => {
    expect(
      getDoctorAvatarState({
        result: null,
        isSubmitting: false,
        input: "頭痛兩日",
      }),
    ).toBe("listening");
  });
});
