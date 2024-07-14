/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-08
 * Description: This file contains Ross Slack Bot command validators and handlers.
 *
 */

const sheets = require("../sheets");
const {
  isValidEmail,
  isValidMemberHandle,
  isValidCheckinMessage,
  isAdminOriginMessage,
  throwToResponse,
  rossCronState,
} = require("./utils");
const { handleFailureResponse } = require("./httpUtils");
const {
  STATUS_UNPLANNED_LEAVE,
  STATUS_CHECKED_IN,
  STATUS_ACKNOWLEDGED,
} = require("../sheets/constants");
const {
  CHECKIN_KEYWORDS,
  CMD_ONBOARD,
  CMD_TRACK,
  CMD_PTO,
  CMD_AWAY,
  CMD_CHECKIN,
  CMD_LEADER,
  CMD_OFF,
  CMD_DEACTIVATE,
  CMD_ACTIVATE,
  CMD_WORK,
  CMD_HELP,
  CMD_DECACHE,
  CMD_ACK,
} = require("./constants");
const slackResponse = require("./response");
const { getTeamLeaderByChannelHandle } = require("../sheets/datalayer");
const { defaultAsyncMemoizer } = require("../sheets/cache");

const ADMIN_ACCESS_ERROR_MSG = "Admin command not allowed.";
const prepareExactArgMatchError = (cmd, count) =>
  `Invalid \`${cmd}\` command. Exactly ${count} argument(s) required.`;
const prepareAtleastArgMatchError = (cmd, count) =>
  `Invalid \`${cmd}\` command. Atleast ${count} argument(s) required.`;

function validateOnboardCommand(messageContext, cmdArgs) {
  // @Ross onboard team_name
  let errorString;
  let argumentsThreshold = 3;
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(
      CMD_ONBOARD,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleOnboardCommand(messageContext, teamName) {
  console.log("[ROSS_COMMAND] onboard");
  const response = await sheets
    .createNewTeam(teamName, messageContext.channel, messageContext.member)
    .catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  defaultAsyncMemoizer.decache();
  return failureResponse === false
    ? slackResponse.onSuccessfulOnboard(messageContext)
    : failureResponse;
}

function validateTrackCommand(messageContext, cmdArgs) {
  // @Ross track team_member_handle team_member_email
  let errorString;
  let argumentsThreshold = 4;
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_TRACK, argumentsThreshold - 2);
  } else if (!isValidMemberHandle(cmdArgs[2])) {
    errorString = `Invalid \`${CMD_TRACK}\` command. Invalid \`team_member_handle\` found.`;
  } else if (!isValidEmail(cmdArgs[3])) {
    errorString =
      "Invalid `${CMD_TRACK}` command. Invalid `team_member_email` found.";
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleTrackCommand(
  messageContext,
  teamMemberHandle,
  teamMemberEmail
) {
  console.log("[ROSS_COMMAND] track");
  const response = await sheets
    .addNewTeamMember(messageContext.channel, teamMemberEmail, teamMemberHandle)
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulTrack(messageContext, teamMemberHandle)
    : failureResponse;
}

function validatePtoCommand(messageContext, cmdArgs) {
  // @Ross pto comma_seperated_dd-mm-yyyy
  let errorString;
  let argumentsThreshold = 3;
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_PTO, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handlePtoCommand(messageContext, commaDelimitedDateStrings) {
  console.log("[ROSS_COMMAND] pto");
  const response = await sheets
    .updatePlannedLeaves(
      messageContext.channel,
      messageContext.member,
      commaDelimitedDateStrings
    )
    .catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulPto(messageContext)
    : failureResponse;
}

function validateAwayCommand(messageContext, cmdArgs) {
  // @Ross away
  let errorString;
  let argumentsThreshold = 2;
  if (cmdArgs.length < argumentsThreshold) {
    errorString = prepareAtleastArgMatchError(CMD_AWAY, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleAwayCommand(messageContext) {
  console.log("[ROSS_COMMAND] away");
  const response = await sheets
    .updateTeamMemberStatus(
      messageContext.channel,
      messageContext.member,
      null,
      STATUS_UNPLANNED_LEAVE
    )
    .catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulAway(messageContext)
    : failureResponse;
}

function validateCheckinCommand(messageContext, cmdArgs) {
  // @Ross checkin message
  let errorString;
  let argumentsThreshold = 3;
  if (cmdArgs.length < argumentsThreshold) {
    errorString = prepareExactArgMatchError(
      CMD_CHECKIN,
      argumentsThreshold - 2
    );
  } else if (!isValidCheckinMessage(cmdArgs[2])) {
    errorString = `Invalid \`checkin\` input. Please make sure to follow the \`${CHECKIN_KEYWORDS.join(
      ", "
    )}\` pattern in a code-block format.`;
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleCheckinCommand(messageContext, message) {
  console.log("[ROSS_COMMAND] checkin");
  const response = await sheets
    .updateTeamMemberStatus(
      messageContext.channel,
      messageContext.member,
      null,
      STATUS_CHECKED_IN
    )
    .catch(throwToResponse);
  const leaderHandle = await getTeamLeaderByChannelHandle(
    messageContext.channel
  ).catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulCheckin(messageContext, leaderHandle)
    : failureResponse;
}

function validateAckCommand(messageContext, cmdArgs) {
  // @Ross ack team_member_handle Optional<message>
  let errorString;
  let argumentsThreshold = 3;
  if (cmdArgs.length < argumentsThreshold) {
    errorString = prepareAtleastArgMatchError(CMD_ACK, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleAckCommand(
  messageContext,
  teamMemberHandle,
  optionalMessage
) {
  console.log("[ROSS_COMMAND] ack");
  const response = await sheets
    .updateTeamMemberStatus(
      messageContext.channel,
      teamMemberHandle,
      null,
      STATUS_ACKNOWLEDGED
    )
    .catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulAck(messageContext, teamMemberHandle)
    : failureResponse;
}

function validateLeaderCommand(messageContext, cmdArgs) {
  // @Ross leader team_member_handle
  let errorString;
  let argumentsThreshold = 3;
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_LEADER, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleLeaderCommand(messageContext, teamMemberHandle) {
  console.log("[ROSS_COMMAND] leader");
  const response = await sheets
    .updateScrumMaster(
      messageContext.channel,
      messageContext.member,
      teamMemberHandle
    )
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulLeader(messageContext, teamMemberHandle)
    : failureResponse;
}

function validateOffCommand(messageContext, cmdArgs) {
  // @Ross off comma_seperated_dd-mm-yyyy
  let errorString;
  let argumentsThreshold = 3;
  if (!isAdminOriginMessage(messageContext)) {
    return { status: 403, error: ADMIN_ACCESS_ERROR_MSG };
  }
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_OFF, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleOffCommand(messageContext, commaDelimitedDateStrings) {
  console.log("[ROSS_COMMAND] off");
  const response = await sheets
    .updateHolidayDates(commaDelimitedDateStrings)
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulOff(messageContext)
    : failureResponse;
}

function validateDeactivateCommand(messageContext, cmdArgs) {
  // @Ross deactivate team_member_handle from_date Optional<to_date>
  let errorString;
  let argumentsThreshold = 4;
  // if (!isAdminOriginMessage(messageContext)) {
  //   return { status: 403, error: "Admin command not allowed." };
  // }
  if (cmdArgs.length < argumentsThreshold) {
    errorString = prepareAtleastArgMatchError(
      CMD_DEACTIVATE,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleDeactivateCommand(
  messageContext,
  teamMemberHandle,
  fromDate,
  optionalToDate
) {
  console.log("[ROSS_COMMAND] deactivate");
  const validationResponse = await sheets.validateOwnerExecutedCommand(
    messageContext
  );
  if (validationResponse.status !== 200) {
    return await handleFailureResponse(messageContext, validationResponse);
  }

  const response = await sheets
    .updateTeamMemberActiveStatus(
      messageContext.channel,
      teamMemberHandle,
      0,
      fromDate,
      optionalToDate
    )
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulDeactivateTeamMember(messageContext)
    : failureResponse;
}

function validateActivateCommand(messageContext, cmdArgs) {
  // @Ross activate team_member_handle from_date Optional<to_date>
  let errorString;
  let argumentsThreshold = 4;
  // if (!isAdminOriginMessage(messageContext)) {
  //   return { status: 403, error: "Admin command not allowed." };
  // }
  if (cmdArgs.length < argumentsThreshold) {
    errorString = prepareAtleastArgMatchError(
      CMD_ACTIVATE,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleActivateCommand(
  messageContext,
  teamMemberHandle,
  fromDate,
  optionalToDate
) {
  console.log("[ROSS_COMMAND] activate");
  const validationResponse = await sheets.validateOwnerExecutedCommand(
    messageContext
  );
  if (validationResponse.status !== 200) {
    return await handleFailureResponse(messageContext, validationResponse);
  }

  const response = await sheets
    .updateTeamMemberActiveStatus(
      messageContext.channel,
      teamMemberHandle,
      1,
      fromDate,
      optionalToDate
    )
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulActivateTeamMember(messageContext)
    : failureResponse;
}

function validateDeactivateTeamCommand(messageContext, cmdArgs) {
  // @Ross deactivate
  let errorString;
  let argumentsThreshold = 2;
  // if (!isAdminOriginMessage(messageContext)) {
  //   return { status: 403, error: "Admin command not allowed." };
  // }
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(
      CMD_DEACTIVATE,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleDeactivateTeamCommand(messageContext) {
  console.log("[ROSS_COMMAND] deactivate");
  const validationResponse = await sheets.validateOwnerExecutedCommand(
    messageContext
  );
  if (validationResponse.status !== 200) {
    return await handleFailureResponse(messageContext, validationResponse);
  }

  const response = await sheets
    .updateTeamActiveStatus(messageContext.channel, false)
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulDeactivateTeam(messageContext)
    : failureResponse;
}

function validateActivateTeamCommand(messageContext, cmdArgs) {
  // @Ross activate
  let errorString;
  let argumentsThreshold = 2;
  // if (!isAdminOriginMessage(messageContext)) {
  //   return { status: 403, error: "Admin command not allowed." };
  // }
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(
      CMD_ACTIVATE,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleActivateTeamCommand(messageContext) {
  console.log("[ROSS_COMMAND] activate");
  const validationResponse = await sheets.validateOwnerExecutedCommand(
    messageContext
  );
  if (validationResponse.status !== 200) {
    return await handleFailureResponse(messageContext, validationResponse);
  }

  const response = await sheets
    .updateTeamActiveStatus(messageContext.channel, true)
    .catch(throwToResponse);
  defaultAsyncMemoizer.decache();
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulActivateTeam(messageContext)
    : failureResponse;
}

function validateWorkCommand(messageContext, cmdArgs) {
  // @Ross work once/on/off
  let errorString;
  let argumentsThreshold = 3;
  if (!isAdminOriginMessage(messageContext)) {
    return { status: 403, error: ADMIN_ACCESS_ERROR_MSG };
  }
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_WORK, argumentsThreshold - 2);
  } else if (
    ["once", "on", "off"].indexOf(String(cmdArgs[2]).toLowerCase()) === -1
  ) {
    errorString = `Valid argument values for \`${CMD_WORK}\` command are \`once\`, \`on\` and \`off\`.`;
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleWorkCommand(messageContext, flag) {
  console.log("[ROSS_COMMAND] work");
  if (flag !== "once") {
    if (flag === "on") {
      rossCronState.enableRossCron();
    } else {
      rossCronState.disableRossCron();
    }
    return slackResponse.onSuccessfulWork(messageContext, {}, false);
  }
  const response = await sheets.fetchPendingReminders().catch(throwToResponse);
  const failureResponse = await handleFailureResponse(messageContext, response);
  return failureResponse === false
    ? slackResponse.onSuccessfulWork(messageContext, response, true)
    : failureResponse;
}

function validateDecacheCommand(messageContext, cmdArgs) {
  // @Ross decache
  let errorString;
  let argumentsThreshold = 2;
  if (!isAdminOriginMessage(messageContext)) {
    return { status: 403, error: ADMIN_ACCESS_ERROR_MSG };
  }
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(
      CMD_DECACHE,
      argumentsThreshold - 2
    );
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleDecacheCommand(messageContext) {
  console.log("[ROSS_COMMAND] decache");
  defaultAsyncMemoizer.decache();
  return slackResponse.onSuccessfulDecache(messageContext);
}

function validateHelpCommand(messageContext, cmdArgs) {
  // @Ross help
  let errorString;
  let argumentsThreshold = 2;
  if (cmdArgs.length != argumentsThreshold) {
    errorString = prepareExactArgMatchError(CMD_HELP, argumentsThreshold - 2);
  } else {
    return { status: 200 };
  }
  return { status: 400, error: errorString };
}

async function handleHelpCommand(messageContext) {
  console.log("[ROSS_COMMAND] help");
  return slackResponse.onSuccessfulHelp(messageContext);
}

async function handleInvalidCommand(messageContext) {
  console.log("[ROSS_COMMAND] invalid_command");
  return slackResponse.onSuccessfulInvalidCommand(messageContext);
}

// Team Commands
exports.validateOnboardCommand = validateOnboardCommand;
exports.handleOnboardCommand = handleOnboardCommand;
exports.validateTrackCommand = validateTrackCommand;
exports.handleTrackCommand = handleTrackCommand;
exports.validatePtoCommand = validatePtoCommand;
exports.handlePtoCommand = handlePtoCommand;
exports.validateAwayCommand = validateAwayCommand;
exports.handleAwayCommand = handleAwayCommand;
exports.validateCheckinCommand = validateCheckinCommand;
exports.handleCheckinCommand = handleCheckinCommand;
exports.validateAckCommand = validateAckCommand;
exports.handleAckCommand = handleAckCommand;
exports.validateLeaderCommand = validateLeaderCommand;
exports.handleLeaderCommand = handleLeaderCommand;
exports.validateHelpCommand = validateHelpCommand;
exports.handleHelpCommand = handleHelpCommand;

// TODO: Move to team from admin
exports.validateDeactivateCommand = validateDeactivateCommand;
exports.handleDeactivateCommand = handleDeactivateCommand;
exports.validateActivateCommand = validateActivateCommand;
exports.handleActivateCommand = handleActivateCommand;
exports.validateDeactivateTeamCommand = validateDeactivateTeamCommand;
exports.handleDeactivateTeamCommand = handleDeactivateTeamCommand;
exports.validateActivateTeamCommand = validateActivateTeamCommand;
exports.handleActivateTeamCommand = handleActivateTeamCommand;

// Admin Commands
exports.validateOffCommand = validateOffCommand;
exports.handleOffCommand = handleOffCommand;
exports.validateWorkCommand = validateWorkCommand;
exports.handleWorkCommand = handleWorkCommand;
exports.validateDecacheCommand = validateDecacheCommand;
exports.handleDecacheCommand = handleDecacheCommand;

// Invalid
exports.handleInvalidCommand = handleInvalidCommand;
