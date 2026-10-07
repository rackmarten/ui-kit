// True when a keypress on `target` is text entry, so a single-key shortcut
// like GlobalSearch's '/' must leave it alone. The contenteditable check
// also reads the attribute, since jsdom has no isContentEditable.
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
};
