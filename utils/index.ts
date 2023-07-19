export const getUrl = () => {
  return window.location.href;
};

export const serialize = (state: object) => {
  const string = JSON.stringify(state);
  const encoded = btoa(string);
  return encoded;
};

export const deserialize = (encoded: string) => {
  if (!encoded) return;

  const string = atob(encoded);
  const state = JSON.parse(string);
  return state
};