export function designHistory(state, action) {
  if (action.type === "load")
    return {
      present: { ...action.design, savedAt: undefined },
      past: [],
      future: [],
    };
  if (action.type === "set") {
    const next =
      typeof action.next === "function"
        ? action.next(state.present)
        : action.next;
    if (next === state.present) return state;
    return {
      present: next,
      past: action.record
        ? [...state.past.slice(-99), state.present]
        : state.past,
      future: action.record ? [] : state.future,
    };
  }
  if (action.type === "undo" && state.past.length)
    return {
      present: state.past.at(-1),
      past: state.past.slice(0, -1),
      future: [...state.future, state.present],
    };
  if (action.type === "redo" && state.future.length)
    return {
      present: state.future.at(-1),
      past: [...state.past, state.present],
      future: state.future.slice(0, -1),
    };
  return state;
}
