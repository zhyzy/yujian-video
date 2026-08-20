require('./env');

const app = require('./app');

const PORT = Number(process.env.PORT || 3001);

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const logger = app.locals.logger || console;
    logger.info(`服务器运行在 http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
