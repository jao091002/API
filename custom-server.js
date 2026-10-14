const dotenv = require('dotenv');
dotenv.config();

const next = require('next');
const app = require('./app');

const dev = process.argv.includes('--dev');
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
const port = process.env.APP_PORT || 3000;

nextApp.prepare().then(() => {
  app.use((req, res) => handle(req, res));
  app.listen(port, () => console.log(`Aplicação disponível em http://localhost:${port}`));
}).catch((error) => {
  console.error('Não foi possível iniciar a aplicação:', error);
  process.exit(1);
});
