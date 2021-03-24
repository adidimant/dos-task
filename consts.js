const STATUS_MESSAGES = {
    OK: '200 OK',
    SERVICE_UNAVAILABLE: '503 Service Unavailable'
};

const MONITORING_LOGS = {
    generateServerListenMessage: (port) => `Server is listening on port ${port}.`,
    signalCalledMessage: (signal) => `Called signal: ${signal}, closing server`,
    serverShutdownMessage: 'Server gracefulls shutted down.'
};


module.exports = { STATUS_MESSAGES, MONITORING_LOGS };