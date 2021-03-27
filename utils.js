const _ = require('lodash');
const getIP = require('ipware')().get_ip;
const { MONITORING_LOGS, INSTANCES_STATUSES } = require('./consts');

const loadLimitsConfig = () => {
    const configParams = ['TIME_UNIT_IN_SEC', 'MAX_REQUESTS_PER_TIME_UNIT', 'OLD_REQUESTS_CLEANUP_TIME_IN_SEC']; //TODO - consider move to consts
    return _.reduce(_.pick(process.env, configParams), (accumulator, value, key) => {
        accumulator[key] = parseInt(value); return accumulator;
    }, {});
};

const parseRequestData = (req) => ({
    clientId: req.query.clientId,
    clientIp: getIP(req).clientIp
});

const gracefulShutdown = (cluster, serverInstancesManager) => async () => {
    if (serverInstancesManager.shutdownInProgress) {
        return;
    }
    serverInstancesManager.shutdownInProgress = true;

    console.log(MONITORING_LOGS.startingShutdownMessage);

    try {
        if (cluster.isMaster) {
            await shutdownWorkers(cluster, serverInstancesManager);
            console.log(MONITORING_LOGS.finishedShutdownMessage);
            process.exit(0);
        }
    } catch (e) {
        //logAndExit(1) //TODO - fix
    }
};

const shutdownWorkers = (cluster, serverInstancesManager) => {
    return new Promise((resolve, reject) => {
        if (!cluster.isMaster) {
            return resolve();
        }
        const workers = _.filter(cluster.workers, worker => !!worker); // Filter all the valid workers
        if (_.isEmpty(workers) === 0) {
            return resolve();
        }
        let workersAlive = 0, iterations = 0;

        const workersKiller = () => {  // Count the number of alive workers and keep looping until the number is zero.
            iterations++;
            _.forEach(workers, (worker) => {
                if (!worker.isDead()) {
                    workersAlive++;
                    if (iterations === 1) { // On the first execution of the function, send the received signal to all the workers
                        serverInstancesManager[worker.process.pid] = INSTANCES_STATUSES.DISCONNECTED;
                        worker.disconnect();
                        worker.kill(); // Will gracefully wait for disconnection to by completed
                    }
                }
            });
            if (workersAlive === 0) { // Clear the interval when all workers are dead
                clearInterval(interval);
                return resolve();
            }
            workersAlive = 0;
        };
        const interval = setInterval(workersKiller, 1000);
    });
};

module.exports = { loadLimitsConfig, gracefulShutdown, parseRequestData };
