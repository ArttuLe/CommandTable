// What the create-token dialog collects, and how it becomes a CREATE_TOKEN.
//
// Tokens used to be five window.prompts in a row, each one answerable only in order and none of
// them visible to the next. The form is one screen, so the rules about what a filled-in form
// means live here rather than in the middle of the component.

export interface TokenForm {
  name: string;
  typeLine: string;
  power: string;
  toughness: string;
  quantity: string;
}

export interface TokenDraft {
  adhoc: { name: string; typeLine: string; power?: string; toughness?: string };
  quantity: number;
}

export const EMPTY_TOKEN_FORM: TokenForm = { name: '', typeLine: '', power: '', toughness: '', quantity: '1' };

/** Most tokens are creatures named after what they are, so the name writes the type line. */
export function defaultTypeLine(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Token Creature — ${trimmed}` : '';
}

/** Null when the form can't make a token yet, which is also what disables the Create button. */
export function tokenFromForm(form: TokenForm): TokenDraft | null {
  const name = form.name.trim();
  const quantity = Number(form.quantity);
  if (!name || !Number.isInteger(quantity) || quantity < 1) return null;

  return {
    adhoc: {
      name,
      typeLine: form.typeLine.trim() || defaultTypeLine(name),
      power: form.power.trim() || undefined,
      toughness: form.toughness.trim() || undefined,
    },
    quantity,
  };
}
