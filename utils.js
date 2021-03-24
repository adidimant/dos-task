const gracefulShutdown = require('http-graceful-shutdown');
const _ = require('lodash');
const { MONITORING_LOGS } = require('./consts');

const loadLimitsConfig = () => {
    const configParams = ['TIME_UNIT_IN_SEC', 'MAX_REQUESTS_PER_TIME_UNIT', 'OLD_REQUESTS_CLEANUP_TIME_IN_SEC'];
    return _.reduce(_.pick(process.env, configParams), (accumulator, value, key) => {
        accumulator[key] = parseInt(value); return accumulator;
    }, {});
};

const shutdownFunction = (signal) => {
    return new Promise((resolve) => {
        console.log(MONITORING_LOGS.signalCalledMessage(signal));
        process.env.OPEN_FOR_REQUESTS = 'false';
        setTimeout(() => {
            resolve();
        }, 1000);
    });
};

const postShutdownMessage = () => console.log(MONITORING_LOGS.serverShutdownMessage);

const shutdownListener = (server) => {
    gracefulShutdown(server,
        {
            signals: 'SIGINT SIGTERM',
            timeout: 10000,
            development: false,
            forceExit: true,
            onShutdown: shutdownFunction,
            finally: postShutdownMessage
        }
    );
};

module.exports = { loadLimitsConfig, shutdownListener };
