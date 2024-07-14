/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains Slack command logic.
 *
 * Following is the list of mention-event commands that Ross serves.
 *
 * description,channel context,user context,command,arg1,arg2,arg3,arg4
 * onboard a team,team,No,onboard,team_name,,,
 * track a member,team,No,track,team_member_handle,team_member_email,,
 * set planned leaves,team,Yes,pto,comma_seperated_dd-mm-yyyy,,,
 * mark unplanned leave,team,Yes,away,,,,
 * share daily update,team,Yes,checkin,message,,,
 * acknowledge an update,team,Yes,ack,team_member_handle,Optional<message>,,
 * set scrum master,team,Yes,leader,team_member_handle,,,
 * set holiday,admin,No,off,comma_seperated_dd-mm-yyyy,,,
 * set member as inactive,admin,No,deactivate,team_member_handle,from_date,Optional<to_date>,
 * set member as active,admin,No,activate,team_member_handle,from_date,Optional<to_date>,
 * set team as inactive,admin,No,deactivate,,,,
 * set team as active,admin,No,activate,,,,
 * trigger team updates,admin,No,work,once/on/off,,,
 * clear cache,admin,No,decache,,,,
 * get help,admin / team,No,help,,,,
 *
 */

const {
  getCleanedString,
  getMemberMentionTextById,
  getMemberIdByTextMention,
  isValidMemberId,
  isValidChannelId,
  isValidEmail,
  prepareCommandMessage,
} = require("./utils");
const {
  validateOnboardCommand,
  handleOnboardCommand,
  validateTrackCommand,
  handleTrackCommand,
  validatePtoCommand,
  handlePtoCommand,
  validateAwayCommand,
  handleAwayCommand,
  validateCheckinCommand,
  handleCheckinCommand,
  validateAckCommand,
  handleAckCommand,
  validateLeaderCommand,
  handleLeaderCommand,
  validateOffCommand,
  handleOffCommand,
  validateDeactivateCommand,
  handleDeactivateCommand,
  validateActivateCommand,
  handleActivateCommand,
  validateDeactivateTeamCommand,
  handleDeactivateTeamCommand,
  validateActivateTeamCommand,
  handleActivateTeamCommand,
  validateWorkCommand,
  handleWorkCommand,
  validateDecacheCommand,
  handleDecacheCommand,
  validateHelpCommand,
  handleHelpCommand,
} = require("./commands");
const {
  ROSS_USER_ID,
  ROSS_ADMIN_CHANNEL_ID,
  CMD_ONBOARD,
  CMD_TRACK,
  CMD_PTO,
  CMD_AWAY,
  CMD_CHECKIN,
  CMD_ACK,
  CMD_LEADER,
  CMD_OFF,
  CMD_DEACTIVATE,
  CMD_ACTIVATE,
  CMD_WORK,
  CMD_DECACHE,
  CMD_HELP,
} = require("./constants");
const { defaultRossQueueifyer } = require("./queue");
const { handleFailureResponse } = require("./httpUtils");

const queuedCommandProcessor = defaultRossQueueifyer(messageToCommand);

async function messageToCommand(messageContext) {
  if (
    !isValidMemberId(messageContext.member) ||
    !isValidChannelId(messageContext.channel) ||
    typeof messageContext.message !== "string"
  ) {
    return {
      status: 400,
      error: `Invalid "userId" or "channelId" or message is not a string.`,
    };
  }
  const cleanedMessage = getCleanedString(messageContext.message);
  if (!cleanedMessage.startsWith(getMemberMentionTextById(ROSS_USER_ID))) {
    errorString = "Message doesn't start with @Ross.";
    console.warn(`[ROSS_VALIDATE]`, errorString, cleanedMessage);
    return { status: 404, error: errorString };
  }

  const cmdArgs = cleanedMessage.split(" ");
  const command = cmdArgs[1].trim().toLowerCase();
  let validationResponse, handlerResponse;

  console.log("SWITCH", command);

  switch (command) {
    case CMD_ONBOARD:
      // @Ross onboard team_name
      validationResponse = validateOnboardCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleOnboardCommand(
          messageContext,
          cmdArgs[2]
        );
      }
      break;
    case CMD_TRACK:
      // @Ross track team_member_handle team_member_email
      validationResponse = validateTrackCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        const emailLinkStartsWith = "<mailto:";
        let memberEmail = cmdArgs[3].trim().toLowerCase();
        // <mailto:gagan.jakhotiya@bigbasket.com|gagan.jakhotiya@bigbasket.com>
        if (memberEmail.startsWith(emailLinkStartsWith)) {
          memberEmail = memberEmail
            .slice(emailLinkStartsWith.length)
            .split("|")[0];
        }
        if (!isValidEmail(memberEmail)) {
          validationResponse = {
            status: 400,
            error: "Invalid email link format.",
          };
        } else {
          handlerResponse = await handleTrackCommand(
            messageContext,
            getMemberIdByTextMention(cmdArgs[2]),
            memberEmail
          );
        }
      }
      break;
    case CMD_PTO:
      // @Ross pto comma_seperated_dd-mm-yyyy
      validationResponse = validatePtoCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handlePtoCommand(messageContext, cmdArgs[2]);
      }
      break;
    case CMD_AWAY:
      // @Ross away
      validationResponse = validateAwayCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleAwayCommand(messageContext);
      }
      break;
    case CMD_CHECKIN:
      // @Ross checkin message
      let cmdArgsMerged = [...cmdArgs.slice(0, 2), cmdArgs.slice(2).join(" ")];
      validationResponse = validateCheckinCommand(messageContext, cmdArgsMerged);
      if (validationResponse.status === 200) {
        handlerResponse = await handleCheckinCommand(
          messageContext,
          cmdArgsMerged[2]
        );
      }
      break;
    case CMD_ACK:
      // @Ross ack team_member_handle Optional<message>
      validationResponse = validateAckCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleAckCommand(
          messageContext,
          getMemberIdByTextMention(cmdArgs[2]),
          cmdArgs.slice(3).join(" ")
        );
      }
      break;
    case CMD_LEADER:
      // @Ross leader team_member_handle
      validationResponse = validateLeaderCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleLeaderCommand(
          messageContext,
          getMemberIdByTextMention(cmdArgs[2])
        );
      }
      break;
    case CMD_OFF:
      // @Ross off comma_seperated_dd-mm-yyyy
      validationResponse = validateOffCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleOffCommand(messageContext, cmdArgs[2]);
      }
      break;
    case CMD_DEACTIVATE:
      // @Ross deactivate team_member_handle from_date Optional<to_date>
      validationResponse = validateDeactivateCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleDeactivateCommand(
          messageContext,
          getMemberIdByTextMention(cmdArgs[2]),
          cmdArgs[3],
          cmdArgs[4]
        );
      } else {
        // @Ross deactivate
        validationResponse = validateDeactivateTeamCommand(
          messageContext,
          cmdArgs
        );
        if (validationResponse.status === 200) {
          handlerResponse = await handleDeactivateTeamCommand(messageContext);
        } else {
          validationResponse.error =
            "Invalid 'deactivate' command. Use 'help' command for details.";
        }
      }
      break;
    case CMD_ACTIVATE:
      // @Ross activate team_member_handle from_date Optional<to_date>
      validationResponse = validateActivateCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleActivateCommand(
          messageContext,
          getMemberIdByTextMention(cmdArgs[2]),
          cmdArgs[3],
          cmdArgs[4]
        );
      } else {
        // @Ross activate
        validationResponse = validateActivateTeamCommand(
          messageContext,
          cmdArgs
        );
        if (validationResponse.status === 200) {
          handlerResponse = await handleActivateTeamCommand(messageContext);
        } else {
          validationResponse.error =
            "Invalid 'activate' command. Use 'help' command for details.";
        }
      }
      break;
    case CMD_WORK:
      // @Ross work on/off/once
      validationResponse = validateWorkCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleWorkCommand(
          messageContext,
          cmdArgs[2].toLowerCase()
        );
      }
      break;
    case CMD_DECACHE:
      // @Ross decache
      validationResponse = validateDecacheCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleDecacheCommand(messageContext);
      }
      break;
    case CMD_HELP:
      // @Ross help
      validationResponse = validateHelpCommand(messageContext, cmdArgs);
      if (validationResponse.status === 200) {
        handlerResponse = await handleHelpCommand(messageContext);
      }
      break;
    default:
      validationResponse = {
        status: 404,
        error: "Invalid Command! Try `@Ross help`.",
      };
      break;
  }
  if (validationResponse.status !== 200) {
    console.warn("[ROSS_VALIDATE]", validationResponse.error, cleanedMessage);
  }
  const failureResponse = await handleFailureResponse(
    messageContext,
    validationResponse
  );
  return failureResponse || handlerResponse;
}

function mockWorkCommand() {
  const messageContext = {
    member: "U0000000000", // Mock
    channel: ROSS_ADMIN_CHANNEL_ID, // Mock
    message: prepareCommandMessage(CMD_WORK, "once"),
  };
  return queuedCommandProcessor(messageContext);
}

exports.messageToCommand = messageToCommand;
exports.queuedCommandProcessor = queuedCommandProcessor;
exports.mockWorkCommand = mockWorkCommand;
