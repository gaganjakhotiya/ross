/*
 * Author: Gagan Jakhotiya
 * Date: 2024-05-05
 * Description: This file contains factory impl of queueifying
 * any async function.
 *
 */
const { scheduleJob } = require("node-schedule");

// Every second
const DEFAULT_QUEUE_CRON_EXPR = "*/1 * * * * *";

function asyncQueueifyFactory(cronExpression) {
  const queueStore = [];

  function getQueueWait() {
    return queueStore.length;
  }

  function queueProcessor() {
    if (getQueueWait()) {
      queueStore.shift()();
    }
  }

  console.log("[QUEUE] Added: " + cronExpression);
  const scheduled = scheduleJob(cronExpression, queueProcessor);

  function destroyQueue() {
    scheduled.cancel();
  }

  function asyncFnQueueify(asyncFn) {
    return function (...args) {
      console.log("[QUEUE]", asyncFn.name, args);
      return new Promise(function (resolve, reject) {
        const queuedFn = () =>
          asyncFn(...args)
            .then(resolve)
            .catch(reject);
        queueStore.push(queuedFn);
      });
    };
  }

  asyncFnQueueify.getQueueWait = getQueueWait;
  asyncFnQueueify.destroyQueue = destroyQueue;

  return asyncFnQueueify;
}

exports.asyncQueueifyFactory = asyncQueueifyFactory;
exports.defaultRossQueueifyer = asyncQueueifyFactory(DEFAULT_QUEUE_CRON_EXPR);
