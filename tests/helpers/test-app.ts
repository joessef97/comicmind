export async function loadTestApp() {
  const { app } = await import("../../backend/src/app");
  return app;
}