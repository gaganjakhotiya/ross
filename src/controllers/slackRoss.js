/*
 * Author: Gagan Jakhotiya
 * Date: 2024-05-08
 * Description: This file contains execution entry points for the Ross Slack Bot.
 *
 */

const schedule = require("node-schedule");
const slackHttpUtils = require("../helpers/slack/httpUtils");
const slack = require("../helpers/slack");
const {
  rossCronState,
  isValidRossEnv,
  suppressAsyncExceptions,
} = require("../helpers/slack/utils");
const {
  ROSS_USER_ID,
  DAILY_WORK_CRON_EXPR,
} = require("../helpers/slack/constants");
const { defaultAsyncMemoizer } = require("../helpers/sheets/cache");
const {
  isWorkingHour,
  isOpeningHour,
  getCurrentDateTimeIST,
} = require("../helpers/sheets/utils");

async function commandHandler(req, res) {
  console.log(
    "[ROSS_REQUEST]",
    JSON.stringify({
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers,
    })
  );

  if (!isValidRossEnv()) {
    return slackHttpUtils.prepareValidResponse(req, res);
  }

  const slackEventData = req.body.event || {};
  const messageContext = {
    member: slackEventData.user,
    channel: slackEventData.channel,
    message: slackEventData.text,
    threadTs: slackEventData.thread_ts || slackEventData.ts,
    messageTs: slackEventData.ts,
  };

  // Ignore Ross's own messages
  if (messageContext.member === ROSS_USER_ID) {
    return slackHttpUtils.prepareValidResponse(req, res);
  }

  await slack.queuedCommandProcessor(messageContext).catch((error) => {
    const message = "Panic! " + String(error);
    return slackHttpUtils.handleFailureResponse(messageContext, {
      status: 500,
      message: message.length <= 50 ? message : message.slice(0, 50) + "...",
    });
  });

  return slackHttpUtils.prepareValidResponse(req, res);
}

async function cronHandler() {
  if (!rossCronState.isRossCronEnabled()) return;

  const now = getCurrentDateTimeIST();
  console.log("[ROSS] Cron triggered!", now);

  // Google cache GC
  if (isOpeningHour(now)) {
    defaultAsyncMemoizer.decache();
  } else {
    defaultAsyncMemoizer.clearInvalidCaches();
  }

  // Trigger Work
  if (isWorkingHour(now)) {
    slack.mockWorkCommand();
  }
}

(function () {
  if (!isValidRossEnv()) return;
  console.log("[ROSS] Cron scheduled!", DAILY_WORK_CRON_EXPR);
  schedule.scheduleJob(
    DAILY_WORK_CRON_EXPR,
    suppressAsyncExceptions(cronHandler)
  );
})();

exports.command = suppressAsyncExceptions(commandHandler);
