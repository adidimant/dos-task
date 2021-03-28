const STATUS_MESSAGES = {
    OK: '200 OK',
    SERVICE_UNAVAILABLE: '503 Service Unavailable'
};

const INSTANCES_STATUSES = {
    ONLINE: 'online',
    DISCONNECTED: 'disconnect'
};

const MONITORING_LOGS = {
    workerProcessOnlineMessage: (instanceId) => `Worker (instanceId - ${instanceId}) is online`,
    passedAllEstablishmentTests: 'Passed all establishment tests!',
    failedEstablishmentTests: (failedTests) => `Failed establishment tests: ${failedTests}`,
    generateServerListenMessage: (port, instanceId) => `Server is listening on port ${port}${(instanceId ? `, instanceId - ${instanceId}.` : ' (Master)')}`,
    startingShutdownMessage: `Got signal for shutting down. Graceful shutdown is starting(time - ${new Date().toISOString()})`,
    disconnectedServerMessage: (instanceId) => `Sudden server instance disconnection (instanceId - ${instanceId})`,
    closedServerMessage: (instanceId) => `Closed server instance(instanceId - ${instanceId})`,
    finishedShutdownMessage: 'Server gracefully shutted down.',
    failedGracefulShutdown: (err) => `Encountered a sudden error during graceful shutdown, exiting main server. error - ${err}`
};

const ESTABLISHMENT_TESTS = {
    ALL_WORKERS_ACTIVE: 'All workers active',
    SUDDEN_DISCONNECTION: 'Sudden worker disconnection'
};

const KEYBOARD_SIGNAL = 'SIGINT';
const BASE_URL = 'http://localhost';
const INTERNAL_PORT_BASE = 2999;
const EXTERNAL_PORT = 8080;

const DISCONNECTION_HANDELED_ERROR_CODES = ['ECONNREFUSED', 'EPIPE', 'EADDRNOTAVAIL', 'ECONNRESET'];


module.exports = { STATUS_MESSAGES, INSTANCES_STATUSES, MONITORING_LOGS, BASE_URL, INTERNAL_PORT_BASE, EXTERNAL_PORT, KEYBOARD_SIGNAL, DISCONNECTION_HANDELED_ERROR_CODES, ESTABLISHMENT_TESTS };