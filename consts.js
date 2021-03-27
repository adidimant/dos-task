const STATUS_MESSAGES = {
    OK: '200 OK',
    SERVICE_UNAVAILABLE: '503 Service Unavailable'
};

const INSTANCES_STATUSES = {
    ONLINE: 'online',
    DISCONNECTED: 'disconnect'
};

const MONITORING_LOGS = {
    workerProcessOnlineMessage: (instanceId) => `Worker (process id - ${instanceId}) is online`,
    generateServerListenMessage: (port, instanceId) => `Server is listening on port ${port}, instanceId - ${instanceId}.`,
    startingShutdownMessage: `Got signal for shutting down. Graceful shutdown is starting (time - ${new Date().toISOString()})`,
    closedServerMessage: (instanceId) => `Closed server instance (instanceId - ${instanceId})`,
    finishedShutdownMessage: 'Server gracefulls shutted down.' //TODO - TYPo?
};
const KEYBOARD_SIGNAL = 'SIGINT';


module.exports = { STATUS_MESSAGES, INSTANCES_STATUSES, MONITORING_LOGS, KEYBOARD_SIGNAL };