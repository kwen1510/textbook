export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown runtime error";
}

export function getSafeRuntimeDiagnostics(error: unknown) {
  return {
    message: getErrorMessage(error),
    name: error instanceof Error ? error.name : "UnknownError",
  };
}
