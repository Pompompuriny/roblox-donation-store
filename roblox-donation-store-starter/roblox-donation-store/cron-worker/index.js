export default {
  async scheduled(event, env) {
    const response = await fetch(`${env.SITE_URL.replace(/\/$/, '')}/api/internal/sweep`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SWEEP_SECRET}` }
    });
    if (!response.ok) console.error('Sweep HTTP', response.status);
  }
};
