import type { NewPerson } from "../store";

/** A person known only by name, as made from a picker's "Create" row. */
export const nameOnly = (name: string): NewPerson => ({
  name: name.trim(),
  phone: null,
  email: null,
  how_i_know_them: null,
  birthday: null,
  birth_year_unknown: false,
});
