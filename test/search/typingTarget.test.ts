import { describe, expect, it } from "vitest";
import { isTypingTarget } from "../../src/search/typingTarget.js";

const el = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelector("[data-t]") as HTMLElement;
};

describe("isTypingTarget", () => {
  it("is true in inputs, textareas, selects and contenteditable", () => {
    expect(isTypingTarget(el("<input data-t>"))).toBe(true);
    expect(isTypingTarget(el("<textarea data-t></textarea>"))).toBe(true);
    expect(isTypingTarget(el("<select data-t></select>"))).toBe(true);
    expect(isTypingTarget(el('<div contenteditable="true"><p data-t></p></div>'))).toBe(true);
  });

  it("is false elsewhere", () => {
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(el("<button data-t></button>"))).toBe(false);
    expect(isTypingTarget(el('<div contenteditable="false"><p data-t></p></div>'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
