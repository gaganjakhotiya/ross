const { ROSS_USER_ID } = require("./constants");
const { sendMessage, addReaction } = require("./httpUtils");
const {
  getChannelMentionTextById,
  getMemberMentionTextById,
} = require("./utils");

// @Ross onboard team_name
exports.onSuccessfulOnboard = function (messageContext) {
  const message =
    ":wave: Hello " +
    getChannelMentionTextById(messageContext.channel) +
    " team! :technologist: " +
    getMemberMentionTextById(ROSS_USER_ID) +
    " is now here to help you run your daily catch-ups.\n\nFirst things first! Start by telling me the team members you wish to track to get daily updates from by using the `track` command.\nEx: `@Ross track @Rachel rachel.green@bigbasket.com`\n\n" +
    getMemberMentionTextById(messageContext.member) +
    " you are the owner and scrum leader of this team currently. Scrum leader is responsible for acknowledging team membersʼ daily updates. A team owner or scrum leader can change the scrum leader anytime by using the `leader` command.\nEx: `@Ross leader @Chandler`\n\nYou can always use `@Ross help` command to know more<https://files.slack.com/files-pri/T0J980HKM-F0700U55S0G/ross.png|.> :smile:";

  return sendMessage(messageContext.channel, message);
};

// @Ross track team_member_handle team_member_email
exports.onSuccessfulTrack = function (messageContext, teamMemberHandle) {
  const message =
    ":rocket: " +
    getMemberMentionTextById(teamMemberHandle) +
    " you’ve been successfully onboarded to the daily scrum _Ross-ter_ :wink: for the team " +
    getChannelMentionTextById(messageContext.channel) +
    ".\n\nI will work with you on all your working days to capture your scrum updates and future sprint PTOs. You must follow the scrum update template while sharing your updates. Updates must be shared before 12 PM on a working day to avoid getting marked as *On Unplanned Leave*.\n\n:memo: *Example Scrum Update*, you must use `checkin` command with a code block to share your updates in below format:\n`@Ross checkin`\n```Yesterday: Worked on X\nToday: Working on Y\nBlocker: Dependancy on Z\nRelease: On track```\n" +
    getMemberMentionTextById(ROSS_USER_ID) +
    " will check weather the updates are captured on all above 4 fronts or not before capturing them.\n\n:memo: *Example PTO update*, this update is valid only if shared at least 1 sprint in advance:\n`@Ross pto 13-11-2024,14-11-2024,15-11-2024`\n\n:memo: *Example unplanned leave update*, applicable for the same day only:\n`@Ross away`\n\n:memo: Your scrum leader, post your update, is responsible for acknowledging your updates as follows:\n`@Ross ack @Joey Optional&lt;message&gt;`";

  return sendMessage(messageContext.channel, message, messageContext.threadTs);
};

// @Ross pto comma_seperated_dd-mm-yyyy
exports.onSuccessfulPto = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross away
exports.onSuccessfulAway = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross checkin message
exports.onSuccessfulCheckin = function (messageContext, leaderHandle) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross ack team_member_handle Optional<message>
exports.onSuccessfulAck = function (messageContext, teamMemberHandle) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross leader team_member_handle
exports.onSuccessfulLeader = function (messageContext, newLeaderHandle) {
  const message = `${newLeaderHandle} is now the Scrum Leader.`;

  return sendMessage(messageContext.channel, message, messageContext.threadTs);
};

// @Ross off comma_seperated_dd-mm-yyyy
exports.onSuccessfulOff = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross deactivate team_handle team_member_handle from_date Optional<to_date>
exports.onSuccessfulDeactivateTeamMember = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross deactivate team_handle
exports.onSuccessfulDeactivateTeam = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross activate team_handle team_member_handle from_date Optional<to_date>
exports.onSuccessfulActivateTeamMember = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross activate team_handle
exports.onSuccessfulActivateTeam = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross work
exports.onSuccessfulWork = function (
  messageContext,
  channelToNotificationMap,
  isOnce
) {
  if (!isOnce) {
    return addReaction(
      messageContext.channel,
      "thumbsup",
      messageContext.messageTs
    );
  }

  return Promise.allSettled(
    Object.entries(channelToNotificationMap || {})
      .map(([channelId, message]) =>
        sendMessage(channelId, message)
      )
  );
};

// @Ross decache
exports.onSuccessfulDecache = function (messageContext) {
  return addReaction(
    messageContext.channel,
    "thumbsup",
    messageContext.messageTs
  );
};

// @Ross help
exports.onSuccessfulHelp = function (messageContext) {
  const message =
    getMemberMentionTextById(ROSS_USER_ID) +
    " is a bot to capture a team’s daily stand-up updates. " +
    getMemberMentionTextById(ROSS_USER_ID) +
    " is a channel and user context aware bot. " +
    getMemberMentionTextById(ROSS_USER_ID) +
    " identifies a team as an independent slack channel. A single member can be linked to multiple teams. If a member is active on multiple teams, " +
    getMemberMentionTextById(ROSS_USER_ID) +
    " will work to capture updates for that member against each of his/her teams.\n\nTo interface with " +
    getMemberMentionTextById(ROSS_USER_ID) +
    " use the following command format:\n`@Ross command [arg1 arg2 arg3 ...]`\n\n\n:rocket: Here is a list of commands that can be used in all _the team channels_:\n\n\n1. To onboard a new team (valid only on a channel that is not linked yet, user executing this command is marked as the team owner and scrum leader)\n    ◦ `@Ross onboard team_name` \n2. To track a team member (valid only for Slack users with a BigBasket email ID)\n    ◦ `@Ross track @MemberSlackHandle <mailto:member@bigbasket.com|member@bigbasket.com>`\n3. To report planned leaves (valid only if shared at least 1 sprint in advance)\n    ◦ `@Ross pto comma_seperated_dd-mm-yyyy`\n4. To report unplanned leave (valid only for the same day)\n    a. `@Ross away`\n5. To share daily update (valid only in a specific format and must be shared before 12 PM on a working day)\n    a. `@Ross checkin UpdateTemplate&lt;message&gt;`\n6. To acknowledge a team member update (authorised only for the team owner and current scrum leader)\n    a. `@Ross ack @MemberSlackHandle`\n7. To change scrum leader (authorised only for the team owner and current scrum leader)\n    a. `@Ross leader @MemberSlackHandle`\n8. To deactivate a tracked team member (authorised only for the team owner)\n    a. `@Ross deactivate @MemberSlackHandle from_date Optional&lt;to_date&gt;`\n9. To activate a tracked team member (authorised only for the team owner)\n    a. `@Ross activate @MemberSlackHandle from_date Optional&lt;to_date&gt;`\n10. To deactivate an onboarded team (authorised only for the team owner)\n    a. `@Ross deactivate`\n11. To activate an onboarded team (authorised only for the team owner)\n    a. `@Ross activate`\n\n\n:rocket: And, following is a list of commands that can be used only in _the bot admin channel_:\n\n\n1. To mark specific dates as holidays\n    a. `@Ross off comma_seperated_dd-mm-yyyy`\n2. To toggle team updates job\n    a. `@Ross work &lt;on/off/once&gt;`\n3. To clear cache\n    a. `@Ross decache`\n\n\n*P.S.*: `UpdateTemplate` has following format as in the example command below.\n\n`@Ross checkin`\n```Yesterday: Worked on X\nToday: Working on Y\nBlocker: Dependancy on Z\nRelease: On track```\n" +
    getMemberMentionTextById(ROSS_USER_ID) +
    " will check weather the updates are captured on all above 4 fronts or not before capturing them.";

  return sendMessage(messageContext.channel, message, messageContext.threadTs);
};

// @Ross invalid_command
exports.onSuccessfulInvalidCommand = function (messageContext) {
  return sendMessage(
    messageContext.channel,
    "Invalid Command! Try `@Ross help` command.",
    messageContext.threadTs
  );
};
