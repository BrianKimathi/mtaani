import './loadEnv.js';
import app, { allowedOrigins } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`Bekye Swap API on http://localhost:${PORT}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
});
