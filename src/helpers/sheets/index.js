/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains Google sheets logic for
 * converting slack commands to sheets data.
 *
 */

const {
  checkIfSheetExists,
  createNewSheet,
  putToSheet,
  bulkUpdateSheet,
  getFromSheet,
} = require("./httpUtils");
const {
  fetchTemplateSheetData,
  fetchTeamsMapByName,
  fetchNewMemberCalendarFromTemplate,
  prepareNewTeamRow,
  getExistingMembersOfTeam,
  getUpdatedTeamRow,
  registerNewMember,
  getMemberStatusesForTeam,
  fetchMembersMapByHandle,
  getTemplateStartDate,
  fetchTeamsMapByChannelHandle,
  getTemplateEndDate,
  getSprintDetails,
  getTeamAndMemberWiseDailyStatus,
  getTeamAndMemberWiseLeaves,
  getSprintDateRangeRelativeToDate,
} = require("./datalayer");
const {
  ROSS_TEAM_LIST_SHEET_NAME,
  MEMBERS_HEADERS_EMAIL,
  MEMBERS_HEADERS_HANDLE,
  TEAMS_HEADERS_MEMBERS,
  TEAMS_HEADERS_OWNER,
  TEAMS_HEADERS_CHANNEL,
  TEAMS_HEADERS_LEADER,
  TEAMS_HEADERS_NAME,
  ROSS_TEAM_TEAMPLATE_SHEET_NAME,
  STATUS_HOLIDAY,
  STATUS_PLANNED_LEAVE,
  TEAM_SHEET_FIRST_MEMBER_COLUMN,
  STATUS_YET_TO_PLAN,
  STATUS_INACTIVE,
  ALLOWED_STATUS_TRANSITION,
  STATUS_TO_TEXT_MAP,
  STATUS_AVAILABLE,
  STATUS_CHECKED_IN,
  STATUS_UNPLANNED_LEAVE,
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
  VALID_STATUSES,
} = require("./constants");
const {
  getNthColumnNameFrom,
  getTeamCalendarRowNumberForDate,
  ddmmyyyyStringToDate,
  isFutureDate,
  getDaysBetweenDates,
  getTodayStartOfTheDayDateObject,
  isWeekend,
  getOrdinalDateString,
  getOrdinalNumberString,
  isOpeningHour,
  isClosingHour,
  getCurrentDateTimeIST,
} = require("./utils");
const {
  isValidCommaSeparatedDateString,
  getMemberMentionTextById,
} = require("../slack/utils");

async function createNewTeam(teamName, channelId, ownerId) {
  const teamsMapByName = await fetchTeamsMapByName();
  const teamsMapByChannelHandle = await fetchTeamsMapByChannelHandle();

  if (
    teamsMapByChannelHandle[channelId] !== undefined ||
    teamsMapByName[teamName] !== undefined ||
    (await checkIfSheetExists(teamName))
  ) {
    return { status: 304, message: "Team Name / Channel Already Registered!" };
  }

  const existingTeamsCount = Object.keys(teamsMapByName).length;
  // Create new sheet by team name
  await createNewSheet(teamName);
  const data = await fetchTemplateSheetData();
  // Push Template Cells to New Team Sheet
  await putToSheet(`${teamName}!A1`, data);
  // Update Team list sheet with the newly onboarded team details
  await putToSheet(
    `${ROSS_TEAM_LIST_SHEET_NAME}!A${1 + existingTeamsCount + 1}`,
    [prepareNewTeamRow(teamName, channelId, ownerId)]
  );
  return { status: 200 };
}

async function addNewTeamMember(teamHandle, memberEmail, memberHandle) {
  const teamsMap = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMap[teamHandle];

  if (!teamObject) {
    return { status: 400, message: "Team not found!" };
  } else if (!teamObject.rowNumber) {
    return { status: 500, message: "Team Row Number Not Found!" };
  }

  const teamName = teamObject[TEAMS_HEADERS_NAME];
  const existingMembers = await getExistingMembersOfTeam(teamName);

  if ((await existingMembers).indexOf(memberEmail) !== -1) {
    return { status: 304, message: "Member is already part of the team!" };
  }

  // Add new member to the Members Sheet
  await registerNewMember(memberEmail, memberHandle);

  const newMemberColumn = await fetchNewMemberCalendarFromTemplate();

  // Update member email in column
  newMemberColumn[0][0] = memberEmail;
  // Add a member specific column on the team sheet
  await putToSheet(
    `${teamName}!${getNthColumnNameFrom(
      TEAM_SHEET_FIRST_MEMBER_COLUMN,
      existingMembers.length + 1
    )}1`,
    newMemberColumn
  );

  const updatedTeamRow = getUpdatedTeamRow(
    teamObject,
    TEAM_STATUS_ACTIVE,
    existingMembers.length + 1
  );
  // Update team member count on the team list sheet
  await putToSheet(
    `${ROSS_TEAM_LIST_SHEET_NAME}!A${teamObject.rowNumber}`,
    updatedTeamRow
  );

  return { status: 200 };
}

async function updateTeamMemberStatus(
  teamHandle,
  memberHandle,
  statusDateString,
  updatedStatus
) {
  if (VALID_STATUSES.indexOf(updatedStatus) === -1) {
    throw "Invalid status captured!"
  }
  const statusDate = statusDateString
    ? ddmmyyyyStringToDate(statusDateString)
    : getTodayStartOfTheDayDateObject();
  const teamsMapByChannelHandle = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMapByChannelHandle[teamHandle];
  if (!teamObject) {
    return { status: 400, message: "Team not found!" };
  }
  const teamName = teamObject[TEAMS_HEADERS_NAME];
  const memberStatusMap = await getMemberStatusesForTeam(teamName, statusDate);
  const membersMapByHandle = await fetchMembersMapByHandle();
  const memberEmail = membersMapByHandle[memberHandle][MEMBERS_HEADERS_EMAIL];
  const memberDetail = memberStatusMap[memberEmail];
  const memberStatus = parseInt(memberDetail.status);
  if (memberStatus == updatedStatus) {
    return { status: 304, message: "No change in status!" };
  }
  if (ALLOWED_STATUS_TRANSITION[memberStatus].indexOf(updatedStatus) === -1) {
    const currentStatusStr = STATUS_TO_TEXT_MAP[memberStatus];
    const updatedStatusStr = STATUS_TO_TEXT_MAP[updatedStatus];
    return {
      status: 400,
      message: `Status transition from \`${currentStatusStr}\` to \`${updatedStatusStr}\` is not valid.`,
    };
  }
  const calendarStartDate = await getTemplateStartDate();
  const rowNumber = getTeamCalendarRowNumberForDate(
    statusDate,
    calendarStartDate
  );
  const columnLetter = memberDetail.columnLetter;
  await putToSheet(
    `${teamName}!${columnLetter}${rowNumber}:${columnLetter}${rowNumber}`,
    [[updatedStatus]]
  );
  return { status: 200 };
}

async function updateScrumMaster(
  teamHandle,
  requestingMemberHandle,
  newLeaderHandle
) {
  const teamsMap = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMap[teamHandle];

  if (!teamObject) {
    return { status: 400, message: "Team not found!" };
  } else if (!teamObject.rowNumber) {
    return { status: 500, message: "Team Row Number Not Found!" };
  }

  const teamOwnerHandle = teamObject[TEAMS_HEADERS_OWNER];
  const teamLeaderHandle = teamObject[TEAMS_HEADERS_LEADER];

  if (
    requestingMemberHandle !== teamOwnerHandle &&
    requestingMemberHandle !== teamLeaderHandle
  ) {
    return {
      status: 403,
      message:
        "User unauthorised. Only team owner and existing leader can perform this action.",
    };
  }

  const updatedTeamRow = getUpdatedTeamRow(
    teamObject,
    null,
    null,
    newLeaderHandle
  );
  // Update team member count on the team list sheet
  await putToSheet(
    `${ROSS_TEAM_LIST_SHEET_NAME}!A${teamObject.rowNumber}`,
    updatedTeamRow
  );

  return { status: 200 };
}

async function updateHolidayDates(commaDelimitedDateStrings) {
  if (!isValidCommaSeparatedDateString(commaDelimitedDateStrings)) {
    return { status: 400, message: "Invalid date list format." };
  }
  const dates = commaDelimitedDateStrings.split(",").map(ddmmyyyyStringToDate);
  if (dates.filter(isFutureDate).length !== dates.length) {
    return { status: 400, message: "All requested dates must be in future." };
  }
  const startDate = await getTemplateStartDate();
  const startColumn = TEAM_SHEET_FIRST_MEMBER_COLUMN;
  const teamsMapByName = await fetchTeamsMapByName();
  const teamsList = Object.values(teamsMapByName);
  const requests = []; // Ex: { range: "Teams!A1:B1", values: [[1,2]] }
  for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
    const offDate = dates[dateIndex];
    const rowNumber = getTeamCalendarRowNumberForDate(offDate, startDate);
    requests.push({
      range: `${ROSS_TEAM_TEAMPLATE_SHEET_NAME}!${startColumn}${rowNumber}`,
      values: [[STATUS_HOLIDAY]],
    });
    for (let teamIndex = 0; teamIndex < teamsList.length; teamIndex++) {
      let teamName = teamsList[teamIndex][TEAMS_HEADERS_NAME];
      let teamSize = +teamsList[teamIndex][TEAMS_HEADERS_MEMBERS];
      let endColumn = getNthColumnNameFrom(
        TEAM_SHEET_FIRST_MEMBER_COLUMN,
        teamSize
      );
      requests.push({
        range: `${teamName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`,
        values: [new Array(teamSize).fill(STATUS_HOLIDAY)],
      });
    }
  }
  await bulkUpdateSheet(requests);
  return { status: 200 };
}

async function updatePlannedLeaves(
  teamHandle,
  memberHandle,
  commaDelimitedDateStrings
) {
  if (!isValidCommaSeparatedDateString(commaDelimitedDateStrings)) {
    return { status: 400, message: "Invalid date list format." };
  }
  const dates = commaDelimitedDateStrings.split(",").map(ddmmyyyyStringToDate);

  const currentSprintDetails = await getSprintDetails().catch(() => {
    throw "This action is allowed only during an active sprint.";
  });

  const hasDayBeforeLastDayOfTheCurrentSprint =
    dates.filter(
      (selectedDate) =>
        getDaysBetweenDates(selectedDate, currentSprintDetails.endDate) <= 0
    ).length !== 0;
  if (hasDayBeforeLastDayOfTheCurrentSprint) {
    return {
      status: 400,
      message: "All requested dates must be beyond current sprint endDate.",
    };
  }

  const startDate = await getTemplateStartDate();
  const startColumn = TEAM_SHEET_FIRST_MEMBER_COLUMN;
  const teamsMapByChannelHandle = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMapByChannelHandle[teamHandle];

  if (!teamObject) {
    return { status: 400, message: "Team not onboarded." };
  }

  const teamName = teamObject[TEAMS_HEADERS_NAME];
  const memberMapByHandle = await fetchMembersMapByHandle();
  const memberObject = memberMapByHandle[memberHandle];

  if (!memberObject) {
    return { status: 400, message: "Team not tracked." };
  }

  const memberEmail = memberObject[MEMBERS_HEADERS_EMAIL];
  const teamMembersList = await getExistingMembersOfTeam(teamName);
  const memberIndex = teamMembersList.indexOf(memberEmail);

  if (memberIndex === -1) {
    return { status: 400, message: "Member is not part of the team." };
  }

  const columnLetter = getNthColumnNameFrom(startColumn, memberIndex + 1);
  const plannedLeaveCell = [[STATUS_PLANNED_LEAVE]];
  const requests = []; // Ex: { range: `${teamName}!${columnLetter}${rowNumber}`, values: plannedLeaveCell }

  for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
    const offDate = dates[dateIndex];
    const rowNumber = getTeamCalendarRowNumberForDate(offDate, startDate);
    requests.push({
      range: `${teamName}!${columnLetter}${rowNumber}`,
      values: plannedLeaveCell,
    });
  }
  await bulkUpdateSheet(requests);
  return { status: 200 };
}

async function updateTeamActiveStatus(teamHandle, isActive) {
  const teamsMap = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMap[teamHandle];
  if (!teamObject) {
    return {
      status: 400,
      message: "Invalid team handle. Team not registered.",
    };
  }

  const updatedTeamRow = getUpdatedTeamRow(
    teamObject,
    isActive ? TEAM_STATUS_ACTIVE : TEAM_STATUS_INACTIVE
  );
  const rowNumber = teamObject.rowNumber;
  await putToSheet(
    `${ROSS_TEAM_LIST_SHEET_NAME}!${rowNumber}:${rowNumber}`,
    updatedTeamRow
  );
  return { status: 200 };
}

async function updateTeamMemberActiveStatus(
  teamHandle,
  memberHandle,
  isActive,
  fromDate,
  toDate
) {
  fromDate = ddmmyyyyStringToDate(fromDate);
  if (!isFutureDate(fromDate)) {
    return {
      status: 400,
      message: "The provided 'fromDate' must be a future date.",
    };
  }
  if (toDate) {
    toDate = ddmmyyyyStringToDate(toDate);
    if (getDaysBetweenDates(toDate, fromDate) < 0) {
      return {
        status: 400,
        message: "The provided 'toDate' must be greater than 'fromDate'.",
      };
    }
  } else {
    toDate = await getTemplateEndDate();
  }

  const teamsMapByChannelHandle = await fetchTeamsMapByChannelHandle();
  const teamObject = teamsMapByChannelHandle[teamHandle];
  if (!teamObject) {
    return {
      status: 400,
      message: "Invalid team handle. Team not registered.",
    };
  }

  const membersMapByHandle = await fetchMembersMapByHandle();
  const memberObject = membersMapByHandle[memberHandle];
  if (!memberObject) {
    return {
      status: 400,
      message: "Invalid member handle. Member not registered.",
    };
  }

  const teamName = teamObject[TEAMS_HEADERS_NAME];
  const memberEmail = memberObject[MEMBERS_HEADERS_EMAIL];
  const existingMembersOfTeam = await getExistingMembersOfTeam(teamName);
  const memberIndex = existingMembersOfTeam.indexOf(memberEmail);
  if (memberIndex === -1) {
    return { status: 400, message: "Member is not part of the team." };
  }

  const calendarStartDate = await getTemplateStartDate();
  const columnLetter = getNthColumnNameFrom(
    TEAM_SHEET_FIRST_MEMBER_COLUMN,
    memberIndex + 1
  );
  const startRow = 1 + 1 + getDaysBetweenDates(fromDate, calendarStartDate);
  const totalUpdateDays = getDaysBetweenDates(toDate, fromDate) + 1;
  const endRow = startRow + totalUpdateDays;
  const sheetsRangeString = `${teamName}!${columnLetter}${startRow}:${columnLetter}${endRow}`;

  const existingCellValues = (await getFromSheet(sheetsRangeString)).values;
  const statusFlagCell = [isActive ? STATUS_YET_TO_PLAN : STATUS_INACTIVE];
  const updatedCellValues = existingCellValues.map((cell) =>
    cell[0] == STATUS_HOLIDAY ? cell : statusFlagCell
  );
  await putToSheet(sheetsRangeString, updatedCellValues);

  return { status: 200 };
}

async function validateOwnerExecutedCommand(messageContext) {
  const teamObject = (await fetchTeamsMapByChannelHandle())[
    messageContext.channel
  ];
  if (!teamObject) {
    return { status: 405, message: "Team not found." };
  }
  const teamOwner = teamObject[TEAMS_HEADERS_OWNER];
  if (teamOwner !== messageContext.member) {
    return {
      status: 403,
      message: `Command only authorised for current team owner - ${getMemberMentionTextById(
        teamOwner
      )}.`,
    };
  }
  return { status: 200 };
}

function filterAndGetMemberListMentionStringForCheckin(memberDetailList) {
  return memberDetailList
    .filter(
      (memberStatusDetails) =>
        memberStatusDetails.status == STATUS_AVAILABLE ||
        memberStatusDetails.status == STATUS_YET_TO_PLAN
    )
    .map((memberStatusDetails) =>
      getMemberMentionTextById(memberStatusDetails[MEMBERS_HEADERS_HANDLE])
    )
    .join(" ");
}

function filterAndGetMemberListMentionStringForPTO(memberDetailList) {
  return memberDetailList
    .filter(
      (memberStatusDetails) =>
        memberStatusDetails.status == STATUS_PLANNED_LEAVE
    )
    .map((memberStatusDetails) =>
      getMemberMentionTextById(memberStatusDetails[MEMBERS_HEADERS_HANDLE])
    )
    .join(" ");
}

function filterAndGetMemberListMentionStringForAck(memberDetailList) {
  return memberDetailList
    .filter(
      (memberStatusDetails) => memberStatusDetails.status == STATUS_CHECKED_IN
    )
    .map((memberStatusDetails) =>
      getMemberMentionTextById(memberStatusDetails[MEMBERS_HEADERS_HANDLE])
    )
    .join(" ");
}

async function fetchPendingReminders(
  selectedDate
) {
  selectedDate = selectedDate || getCurrentDateTimeIST();
  if (!(selectedDate instanceof Date)) {
    throw "Argument 'selectedDate' should be an instance of Date type.";
  }

  let teamWiseNotifications = {}; // {[channelId]: message}
  if (isWeekend(selectedDate)) {
    return teamWiseNotifications;
  }

  const sprintDetails = await getSprintDetails(selectedDate);
  const isHoliday =
    sprintDetails.holidayDates.filter(
      (d) => d.getTime() === selectedDate.getTime()
    ).length !== 0;
  if (isHoliday) {
    return teamWiseNotifications;
  }

  const isStartOfTheDay = isOpeningHour(selectedDate);
  const forbidPendingCheckings = isClosingHour(selectedDate);

  const teamWiseStatus = await getTeamAndMemberWiseDailyStatus(selectedDate);
  const isSprintStart = sprintDetails.completedDays == 0;
  const isSprintEnd = sprintDetails.remainingDays == 1;
  const nthDay = getOrdinalNumberString(sprintDetails.completedDays + 1);

  if (isSprintStart && isStartOfTheDay) {
    // Current sprint planned leave details
    const teamWiseLeaves = await getTeamAndMemberWiseLeaves(
      sprintDetails.startDate,
      sprintDetails.endDate
    );
    const teamWiseLeavesMap = teamWiseLeaves.teamWiseDetails.reduce(
      (accTeamsMap, teamDetails) => {
        const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
        accTeamsMap[teamHandle] = teamDetails;
        return accTeamsMap;
      },
      {}
    );

    // Last sprint unplanned leave details
    const prevSprintDates = await getSprintDateRangeRelativeToDate(
      selectedDate,
      -1
    );
    const teamWiseUnplannedLeaves = await getTeamAndMemberWiseLeaves(
      prevSprintDates.startDate,
      prevSprintDates.endDate
    );
    const teamWiseUnplannedLeavesMap =
      teamWiseUnplannedLeaves.teamWiseDetails.reduce(
        (accTeamsMap, teamDetails) => {
          const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
          accTeamsMap[teamHandle] = teamDetails;
          return accTeamsMap;
        },
        {}
      );

    // Notify: Sprint Id, start and end
    const sprintMsg = `:hourglass_flowing_sand: Hello! Today is the first day of the \`Sprint ${sprintDetails.id}\`\n\n`;

    // Capture All Holidays - Total Working Days
    const holidayDatesString =
      sprintDetails.holidayDates.map(getOrdinalDateString).join(", ") || "None";
    const holidayMsg = `:palm_tree: Holidays during this Sprint: \`${holidayDatesString}\`\n\n`;

    // Common message for all teams
    const commonMessageString = sprintMsg + holidayMsg;

    // Capture All PTOs - team wise
    teamWiseStatus.teamWiseDetails.forEach(function (teamDetails) {
      const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
      teamWiseNotifications[teamHandle] = commonMessageString;

      const memberDetailList = Object.values(teamDetails.memberWiseDetails);
      if (memberDetailList.length === 0) {
        return;
      }

      let awayMsg = `:away: Unplanned leaves summary of last Sprint:\n`;
      const memberWiseUnplannedLeavesDetails = Object.values(
        teamWiseUnplannedLeavesMap[teamHandle].memberWiseDetails
      );
      const awayMembersDatesMsg = memberWiseUnplannedLeavesDetails
        .map(function (memberDetail) {
          const memberHandle = memberDetail[MEMBERS_HEADERS_HANDLE];
          const memberLeaveDaysString = memberDetail.awayDates
            .map(getOrdinalDateString)
            .join(", ");

          return [
            getMemberMentionTextById(memberHandle),
            memberLeaveDaysString || "None",
          ];
        })
        .filter(([_, days]) => days !== "None")
        .map(
          ([memberMentionText, memberLeaveDaysString], index) =>
            `${index + 1}. ${memberMentionText}: \`${memberLeaveDaysString}\`\n`
        )
        .join("");
      if (awayMembersDatesMsg) {
        teamWiseNotifications[teamHandle] +=
          awayMsg + awayMembersDatesMsg + "\n";
      }

      let ptoMsg = `:man_in_lotus_position: Planned leaves for this Sprint:\n`;
      const memberWiseLeavesDetails = Object.values(
        teamWiseLeavesMap[teamHandle].memberWiseDetails
      );
      const ptoMembersDatesMsg = memberWiseLeavesDetails
        .map(function (memberDetail) {
          const memberHandle = memberDetail[MEMBERS_HEADERS_HANDLE];
          const memberLeaveDaysString = memberDetail.ptoDates
            .map(getOrdinalDateString)
            .join(", ");

          return [
            getMemberMentionTextById(memberHandle),
            memberLeaveDaysString || "None",
          ];
        })
        .filter(([_, days]) => days !== "None")
        .map(
          ([memberMentionText, memberLeaveDaysString], index) =>
            `${index + 1}. ${memberMentionText}: \`${memberLeaveDaysString}\`\n`
        )
        .join("");
      if (ptoMembersDatesMsg) {
        teamWiseNotifications[teamHandle] += ptoMsg + ptoMembersDatesMsg + "\n";
      }

      // Capture Members on PTO today
      let ptoTodayMsg = `:ooo: Team members on PTO today: `;
      const ptoMemberMentions =
        filterAndGetMemberListMentionStringForPTO(memberDetailList);

      if (ptoMemberMentions) {
        teamWiseNotifications[teamHandle] +=
          ptoTodayMsg + ptoMemberMentions + "\n";
      }

      // Capture Members Pending for checkin - team wise
      let checkinMsg = `:technologist: Alright! Let’s start with the daily updates from: `;
      const checkinMemberMentions =
        filterAndGetMemberListMentionStringForCheckin(memberDetailList);

      if (checkinMemberMentions) {
        teamWiseNotifications[teamHandle] += checkinMsg + checkinMemberMentions;
      }
    });
  } else if (isSprintEnd && isStartOfTheDay) {
    // Notify: Last day of the sprint
    const sprintMsg = `:hourglass: Hello! Today is the last day of the \`Sprint ${sprintDetails.id}\`\n\n`;
    const ticketMsg = `:jira-new: Please close all your completed tickets before EOD and add spillover reason to the rest.\n\n`;

    // Common message for all teams
    const commonMessageString = sprintMsg + ticketMsg;

    // Notify: PTOs captured for next sprint
    const nextSprintDates = await getSprintDateRangeRelativeToDate(
      selectedDate,
      1
    );
    const nextSprintTeamWiseLeaves = await getTeamAndMemberWiseLeaves(
      nextSprintDates.startDate,
      nextSprintDates.endDate
    );
    const nextSprintTeamWiseLeavesMap =
      nextSprintTeamWiseLeaves.teamWiseDetails.reduce(
        (accTeamsMap, teamDetails) => {
          const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
          accTeamsMap[teamHandle] = teamDetails;
          return accTeamsMap;
        },
        {}
      );

    // Capture All PTOs for next sprint - team wise
    teamWiseStatus.teamWiseDetails.forEach(function (teamDetails) {
      const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
      teamWiseNotifications[teamHandle] = commonMessageString;

      const memberDetailList = Object.values(teamDetails.memberWiseDetails);
      if (memberDetailList.length === 0) {
        return;
      }

      let ptoMsg = `:alarm_clock: PTO capture window closes today EOD for dates `;
      ptoMsg += `between \`${getOrdinalDateString(
        nextSprintDates.startDate
      )}\` `;
      ptoMsg += `and \`${getOrdinalDateString(nextSprintDates.endDate)}\`.\n`;
      ptoMsg += `:man_in_lotus_position: Planned leaves captured for the next Sprint so far:\n`;
      const nextSprintMemberWiseLeavesDetails = Object.values(
        nextSprintTeamWiseLeavesMap[teamHandle].memberWiseDetails
      );
      const ptoMembersDatesMsg = nextSprintMemberWiseLeavesDetails
        .map(function (memberDetail) {
          const memberHandle = memberDetail[MEMBERS_HEADERS_HANDLE];
          const memberLeaveDaysString = memberDetail.ptoDates
            .map(getOrdinalDateString)
            .join(", ");

          return [
            getMemberMentionTextById(memberHandle),
            memberLeaveDaysString || "None",
          ];
        })
        // Always show
        // .filter(([_, days]) => days !== "None")
        .map(
          ([memberMentionText, memberLeaveDaysString], index) =>
            `${index + 1}. ${memberMentionText}: \`${memberLeaveDaysString}\`\n`
        )
        .join("");
      if (ptoMembersDatesMsg) {
        teamWiseNotifications[teamHandle] += ptoMsg + ptoMembersDatesMsg + "\n";
      }

      // Capture Members on PTO today
      let ptoTodayMsg = `:ooo: Team members on PTO today: `;
      const ptoMemberMentions =
        filterAndGetMemberListMentionStringForPTO(memberDetailList);

      if (ptoMemberMentions) {
        teamWiseNotifications[teamHandle] +=
          ptoTodayMsg + ptoMemberMentions + "\n";
      }

      // Capture Members Pending for checkin - team wise
      let checkinMsg = `:technologist: Alright! Let’s start with the daily updates from: `;
      const checkinMemberMentions =
        filterAndGetMemberListMentionStringForCheckin(memberDetailList);

      if (checkinMemberMentions) {
        teamWiseNotifications[teamHandle] += checkinMsg + checkinMemberMentions;
      }
    });
  } else if (isStartOfTheDay) {
    // common message across teams
    const firstMessage = `:sunrise: Hello! Today is the \`${nthDay}\` day of the \`Sprint ${sprintDetails.id}\`\n\n`;

    // Capture Member on PTO - team wise
    // Capture Members Pending for checkin - team wise
    teamWiseStatus.teamWiseDetails.forEach(function (teamDetails) {
      const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
      teamWiseNotifications[teamHandle] = firstMessage;

      const memberDetailList = Object.values(teamDetails.memberWiseDetails);
      if (memberDetailList.length === 0) {
        return;
      }

      // Capture Members on PTO today
      let ptoTodayMsg = `:ooo: Team members on PTO today: `;
      const ptoMemberMentions =
        filterAndGetMemberListMentionStringForPTO(memberDetailList);

      if (ptoMemberMentions) {
        teamWiseNotifications[teamHandle] +=
          ptoTodayMsg + ptoMemberMentions + "\n";
      }

      // Capture Members Pending for checkin - team wise
      let checkinMsg = `:technologist: Alright! Let’s start with the daily updates from: `;
      const checkinMemberMentions =
        filterAndGetMemberListMentionStringForCheckin(memberDetailList);

      if (checkinMemberMentions) {
        teamWiseNotifications[teamHandle] += checkinMsg + checkinMemberMentions;
      }
    });
  } else {
    // Capture Members Pending for checkin - team wise
    // Capture Members Pending for ack - team wise
    teamWiseStatus.teamWiseDetails.forEach(function (teamDetails) {
      const teamHandle = teamDetails[TEAMS_HEADERS_CHANNEL];
      teamWiseNotifications[teamHandle] = "";

      const memberDetailList = Object.values(teamDetails.memberWiseDetails);
      if (memberDetailList.length === 0) {
        return;
      }

      // Capture Members Pending for checkin - team wise
      let checkinMsg = forbidPendingCheckings
        ? `:away: Members tagged as away in absence of timely checkin: `
        : `:technologist: Please share your updates: `;

      const checkinMemberMentions =
        filterAndGetMemberListMentionStringForCheckin(memberDetailList);

      if (checkinMemberMentions) {
        teamWiseNotifications[teamHandle] +=
          checkinMsg + checkinMemberMentions + "\n\n";
      }

      // Capture Members awaiting ack from leader
      // const teamLeaderHandle = teamDetails[TEAMS_HEADERS_LEADER];
      // let pendingAckMsg = `:handshake: ${getMemberMentionTextById(
      //   teamLeaderHandle
      // )} Please acknowledge updates from: `;
      // const pendingAckMemberMentions =
      //   filterAndGetMemberListMentionStringForAck(memberDetailList);

      // if (pendingAckMemberMentions) {
      //   teamWiseNotifications[teamHandle] +=
      //     pendingAckMsg + pendingAckMemberMentions;
      // }
    });

    if (forbidPendingCheckings) {
      await markCheckinPendingAsAway(teamWiseStatus);
    }
  }

  return teamWiseNotifications;
}

async function markCheckinPendingAsAway(teamWiseStatus) {
  // [ { range: "Teams!A1:B1", values: [[1,2]] } ]
  const requests = teamWiseStatus.teamWiseDetails.flatMap(function (
    teamDetails
  ) {
    const teamName = teamDetails[TEAMS_HEADERS_NAME];

    const memberDetailList = Object.values(teamDetails.memberWiseDetails);
    if (memberDetailList.length === 0) {
      return [];
    }

    return memberDetailList
      .filter(
        (memberStatusDetails) =>
          memberStatusDetails.status == STATUS_AVAILABLE ||
          memberStatusDetails.status == STATUS_YET_TO_PLAN
      )
      .map(({ teamSheetColumnLetter, teamSheetRowNumber }) => ({
        range: `${teamName}!${teamSheetColumnLetter}${teamSheetRowNumber}`,
        values: [[STATUS_UNPLANNED_LEAVE]],
      }));
  });

  return await bulkUpdateSheet(requests);
}

exports.createNewTeam = createNewTeam;
exports.addNewTeamMember = addNewTeamMember;
exports.updateTeamMemberStatus = updateTeamMemberStatus;
exports.updateScrumMaster = updateScrumMaster;
exports.updateHolidayDates = updateHolidayDates;
exports.updatePlannedLeaves = updatePlannedLeaves;
exports.updateTeamActiveStatus = updateTeamActiveStatus;
exports.updateTeamMemberActiveStatus = updateTeamMemberActiveStatus;
exports.validateOwnerExecutedCommand = validateOwnerExecutedCommand;
exports.fetchPendingReminders = fetchPendingReminders;
