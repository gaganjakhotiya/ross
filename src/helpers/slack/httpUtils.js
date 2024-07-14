/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains Slack API util functions.
 *
 */

const request = require("request");
const {
  ROSS_BOT_OAUTH_TOKEN,
  ROSS_POST_ENDPOINT,
  ROSS_REACT_ENDPOINT,
  HTTP_STATUS_TO_EMOJI_MAP,
  FAILURE_FALLBACK_EMOJI,
} = require("./constants");
const { getMemberMentionTextById, isValidChannelId } = require("./utils");

function prepareValidResponse(req, res) {
  return res.status(200).send((req.body || {}).challenge || "OK");
}

async function handleFailureResponse(messageContext, response) {
  if (
    response !== null &&
    typeof response === "object" &&
    response.status > 300
  ) {
    console.log("[ERROR]", response);
    const { channel, member } = messageContext;
    const dynMessage = response.message || response.error;
    return await sendMessage(
      channel,
      `${
        HTTP_STATUS_TO_EMOJI_MAP[response.status] || FAILURE_FALLBACK_EMOJI
      } Oh no ${getMemberMentionTextById(member)}! That didn't quiet work. ${
        dynMessage.slice(0, 100) + (dynMessage.length > 100 ? "..." : "")
      }`,
      messageContext.threadTs
    );
  }
  return false;
}

function sendMessage(channelId, msg, optionalThreadTs, optionalAttachments) {
  console.log("[SLACK_POST] Req:", channelId, msg);
  return new Promise(function (resolve, reject) {
    if (!isValidChannelId(channelId) || !msg) {
      return reject("Invalid sendMessage arguments.");
    }
    request(
      {
        url: ROSS_POST_ENDPOINT,
        method: "POST",
        json: {
          channel: channelId,
          text: msg,
          thread_ts: optionalThreadTs,
          attachments: optionalAttachments,
        },
        headers: {
          "Content-type": "application/json; charset=utf-8",
          Authorization: `Bearer ${ROSS_BOT_OAUTH_TOKEN}`,
        },
      },
      function (error, response, body) {
        if (error) {
          console.error("[SLACK_POST] Err:", error);
          resolve(false);
          return;
        }

        console.log(
          "[SLACK_POST] Res:",
          response.statusCode,
          JSON.stringify(body)
        );
        resolve(true);
      }
    );
  });
}

function addReaction(channelId, name, messageTs) {
  console.log("[SLACK_REACT] Req:", channelId, name, messageTs);
  return new Promise(function (resolve, reject) {
    if (!isValidChannelId(channelId) || !name || !messageTs) {
      return reject("Invalid addReaction arguments.");
    }
    request(
      {
        url: ROSS_REACT_ENDPOINT,
        method: "POST",
        json: {
          name: name,
          channel: channelId,
          timestamp: messageTs,
        },
        headers: {
          "Content-type": "application/json; charset=utf-8",
          Authorization: `Bearer ${ROSS_BOT_OAUTH_TOKEN}`,
        },
      },
      function (error, response, body) {
        if (error) {
          console.error("[SLACK_REACT] Err:", error);
          resolve(false);
          return;
        }

        console.log(
          "[SLACK_REACT] Res:",
          response.statusCode,
          JSON.stringify(body)
        );
        resolve(true);
      }
    );
  });
}

exports.prepareValidResponse = prepareValidResponse;
exports.handleFailureResponse = handleFailureResponse;
exports.sendMessage = sendMessage;
exports.addReaction = addReaction;
