exports.ENABLE_ROSS = process.env.ENABLE_ROSS;
exports.ROSS_ADMIN_CHANNEL_ID = process.env.ROSS_ADMIN_CHANNEL_ID;
exports.ROSS_USER_ID = process.env.ROSS_USER_ID;
exports.ROSS_BOT_OAUTH_TOKEN = process.env.ROSS_BOT_OAUTH_TOKEN;
exports.ROSS_POST_ENDPOINT = process.env.ROSS_POST_ENDPOINT;
exports.ROSS_REACT_ENDPOINT = process.env.ROSS_REACT_ENDPOINT;

exports.CMD_ONBOARD = "onboard";
exports.CMD_TRACK = "track";
exports.CMD_PTO = "pto";
exports.CMD_AWAY = "away";
exports.CMD_CHECKIN = "checkin";
exports.CMD_ACK = "ack";
exports.CMD_LEADER = "leader";
exports.CMD_OFF = "off";
exports.CMD_DEACTIVATE = "deactivate";
exports.CMD_ACTIVATE = "activate";
exports.CMD_WORK = "work";
exports.CMD_DECACHE = "decache";
exports.CMD_HELP = "help";

exports.CHECKIN_KEYWORDS = ["blocker", "release", "today", "yesterday"];
exports.HTTP_STATUS_TO_EMOJI_MAP = {
  200: ":white_check_mark:",
  304: ":exclamation:",
  400: ":x:",
  403: ":no_entry_sign:",
  404: ":question:",
  405: ":no_entry:",
  500: ":boom:",
  503: ":warning:",
};
exports.FAILURE_FALLBACK_EMOJI = ":bangbang:";
exports.DAILY_WORK_CRON_EXPR = "0 */1 * * MON-FRI";
