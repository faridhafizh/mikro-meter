export async function register() {
  // Ensure the background scheduler only runs in the Node.js runtime
  // and not in Edge runtime or client environments.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('--- Registering Startup Instrumentation Hook ---');
    try {
      const { startScheduler } = await import('./lib/scheduler');
      startScheduler();
    } catch (error) {
      console.error('Failed to start background scheduler:', error);
    }
  }
}
