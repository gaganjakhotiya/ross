/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-08
 * Description: This file contains Ross Slack Bot utility functions.
 *
 */

const {
  CHECKIN_KEYWORDS,
  ROSS_ADMIN_CHANNEL_ID,
  ROSS_USER_ID,
  ROSS_BOT_OAUTH_TOKEN,
  ROSS_POST_ENDPOINT,
  ROSS_REACT_ENDPOINT,
  ENABLE_ROSS,
} = require("./constants");

// <https://files.slack.com/files-pri/T0J980HKM-F06TE6KH8BG/ross_scrum.png|<200e> >

function isValidRossEnv() {
  return Boolean(
    ENABLE_ROSS === "true" &&
      ROSS_BOT_OAUTH_TOKEN &&
      ROSS_POST_ENDPOINT &&
      ROSS_REACT_ENDPOINT
  );
}

function isValidMemberHandle(handle) {
  return typeof handle === "string" && /^<@U[A-Z0-9]{8,10}>$/.test(handle);
}

function isValidMemberId(handle) {
  return typeof handle === "string" && /^U[A-Z0-9]{8,10}$/.test(handle);
}

function isValidChannelHandle(handle) {
  return typeof handle === "string" && /^<#C[A-Z0-9]{8,10}\|>$/.test(handle);
}

function isValidChannelId(handle) {
  return typeof handle === "string" && /^C[A-Z0-9]{8,10}$/.test(handle);
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^(\<mailto\:)?[a-zA-Z0-9.]+@bigbasket\.com(|.*\>)?$/gim.test(email)
  );
}

function isValidCommaSeparatedDateString(delimitedDateString) {
  return (
    typeof delimitedDateString === "string" &&
    /(\d{2}-\d{2}-\d{4},)*(\d{2}-\d{2}-\d{4})/.test(delimitedDateString)
  );
}

function getCleanedString(str) {
  return str.replaceAll("\n", " ").trim().replace(/\s\s+/g, " ");
}

function getChannelMentionTextById(channelId) {
  return `<#${channelId}|>`;
}

function getMemberMentionTextById(userId) {
  return `<@${userId}>`;
}

function getChannelIdByTextMention(channelMention) {
  return channelMention.replaceAll(/[<>#@|]/g, "");
}

function getMemberIdByTextMention(userMention) {
  return userMention.replaceAll(/[<>#@|]/g, "");
}

function isValidCheckinMessage(message) {
  return CHECKIN_KEYWORDS.reduce((isValid, keyword) => {
    return (
      isValid && new RegExp("```.*(" + keyword + ").*```", "gim").test(message)
    );
  }, true);
}

function isAdminOriginMessage(messageContext) {
  return messageContext.channel === ROSS_ADMIN_CHANNEL_ID;
}

function throwToResponse(exception) {
  return { status: 405, error: exception.stack };
}

function prepareCommandMessage(command, ...args) {
  return `${getMemberMentionTextById(ROSS_USER_ID)} ${command} ${args.join(
    " "
  )}`;
}

function mockAdminCommand(command, ...args) {
  return {
    member: ROSS_USER_ID,
    channel: ROSS_ADMIN_CHANNEL_ID,
    message: prepareCommandMessage(command, ...args),
  };
}

const rossCronState = (function () {
  let isRossCronEnabledFlag = true;
  return {
    enableRossCron: () => (isRossCronEnabledFlag = true),
    disableRossCron: () => (isRossCronEnabledFlag = false),
    isRossCronEnabled: () => isRossCronEnabledFlag,
  };
})();

const suppressAsyncExceptions = (fn) => {
  return (...args) => {
    return Promise.resolve(fn(...args)).catch(e => {
      console.log("[SUPPRESSED_EXCEPTION]", String(e));
    })
  }
}

exports.isValidRossEnv = isValidRossEnv;
exports.isValidMemberHandle = isValidMemberHandle;
exports.isValidMemberId = isValidMemberId;
exports.isValidChannelHandle = isValidChannelHandle;
exports.isValidChannelId = isValidChannelId;
exports.isValidEmail = isValidEmail;
exports.isValidCommaSeparatedDateString = isValidCommaSeparatedDateString;
exports.getCleanedString = getCleanedString;
exports.getChannelMentionTextById = getChannelMentionTextById;
exports.getMemberMentionTextById = getMemberMentionTextById;
exports.getChannelIdByTextMention = getChannelIdByTextMention;
exports.getMemberIdByTextMention = getMemberIdByTextMention;
exports.isValidCheckinMessage = isValidCheckinMessage;
exports.isAdminOriginMessage = isAdminOriginMessage;
exports.throwToResponse = throwToResponse;
exports.prepareCommandMessage = prepareCommandMessage;
exports.mockAdminCommand = mockAdminCommand;
exports.rossCronState = rossCronState;
exports.suppressAsyncExceptions = suppressAsyncExceptions;
