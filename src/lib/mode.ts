export function isLocalMode() {
  return process.env.TEXTBOOK_MODE === "local";
}

export const localUser = {
  id: "local-user",
  email: "local@textbook",
  name: "Local user",
};
