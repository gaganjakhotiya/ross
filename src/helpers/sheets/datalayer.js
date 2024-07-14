/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains Google sheets logic for
 * reading / writing user data.
 *
 * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Sheets Schema as below
 * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Teams (A-G):
 * Name Channel Owner Leader Members Active
 * string cid uid uid int bool
 *
 * Sprints (A-C):
 * Sprint	Start	End
 * int date date
 *
 * Members (A-B):
 * E-mail	Handle
 * email uid
 *
 * Status (A-B):
 * Type	Value
 * string int
 *
 * Template
 * Date	Day	TestMember
 * date formula int
 *
 * Teams.Name
 * Date	Day	member1_email member2_email member3_email ...
 * date formula int int int ...
 *
 *
 */

const {
  ddmmyyyyStringToDate,
  getTeamCalendarRowNumberForDate,
  getDaysBetweenDates,
  isNotWeekend,
  isWeekend,
  getTodayStartOfTheDayDateObject,
  addDaysToDate,
} = require("./utils");
const {
  TEAMS_HEADERS,
  TEAMS_HEADERS_ACTIVE,
  TEAMS_HEADERS_CHANNEL,
  TEAMS_HEADERS_LEADER,
  TEAMS_HEADERS_MEMBERS,
  TEAMS_HEADERS_NAME,
  TEAMS_HEADERS_OWNER,
  MEMBERS_HEADERS,
  MEMBERS_HEADERS_EMAIL,
  MEMBERS_HEADERS_HANDLE,
  ROSS_TEAM_LIST_SHEET_NAME,
  ROSS_MEMBER_LIST_SHEET_NAME,
  ROSS_TEAM_TEAMPLATE_SHEET_NAME,
  TEMPLATE_HEADERS,
  TEAM_SHEET_FIRST_MEMBER_COLUMN,
  STATUS_HOLIDAY,
  ROSS_SPRINTS_SHEET_NAME,
  STATUS_PLANNED_LEAVE,
  STATUS_YET_TO_PLAN,
  TEAM_STATUS_ACTIVE,
  STATUS_UNPLANNED_LEAVE,
  XL_TTL,
  XM_TTL,
} = require("./constants");
const {
  fetchAndValidateRows,
  getFromSheet,
  putToSheet,
  bulkFetchSheet,
} = require("./httpUtils");
const { convertHeadersAndRowsToMap, getNthColumnNameFrom } = require("./utils");
const { defaultAsyncMemoizer } = require("./cache");

function prepareNewMemberRow(memberEmail, memberHandle) {
  return [memberEmail, memberHandle];
}

function prepareNewTeamRow(teamName, channelId, ownerId) {
  // Ref: TEAMS_HEADERS
  return [teamName, channelId, ownerId, ownerId, 0, 1];
}

function getUpdatedTeamRow(teamObject, active, memberCount, leaderId) {
  // Ref: TEAMS_HEADERS
  return [
    [
      teamObject[TEAMS_HEADERS_NAME],
      teamObject[TEAMS_HEADERS_CHANNEL],
      teamObject[TEAMS_HEADERS_OWNER],
      leaderId || teamObject[TEAMS_HEADERS_LEADER],
      memberCount || teamObject[TEAMS_HEADERS_MEMBERS],
      active === null ? teamObject[TEAMS_HEADERS_ACTIVE] : active,
    ],
  ];
}

async function registerNewMember(memberEmail, memberHandle) {
  const memberRows = await fetchAndValidateRows(
    ROSS_MEMBER_LIST_SHEET_NAME,
    MEMBERS_HEADERS,
    null,
    true
  );

  const memberMap = convertHeadersAndRowsToMap(
    MEMBERS_HEADERS,
    memberRows.slice(1),
    MEMBERS_HEADERS_EMAIL
  );

  if (!!memberMap[memberEmail]) {
    return { status: 304, message: "Member Already Registered!" };
  }

  const nextRowNumber = memberRows.length + 1;
  putToSheet(
    `${ROSS_MEMBER_LIST_SHEET_NAME}!${nextRowNumber}:${nextRowNumber}`,
    [prepareNewMemberRow(memberEmail, memberHandle)]
  );
}

async function fetchTeamsMapByName() {
  /*
    Ref: TEAMS_HEADERS
    [
        ["Name", "Channel", "Owner", "Leader", "Members", "Active"],
        ["Vihanga", "C06SWDQUNKS", "U042CPY14FN", "U042CPY14FN", "4", "1"]
    ]
  */
  const teamRows = await fetchAndValidateRows(
    ROSS_TEAM_LIST_SHEET_NAME,
    TEAMS_HEADERS
  );

  return convertHeadersAndRowsToMap(
    TEAMS_HEADERS,
    teamRows,
    TEAMS_HEADERS_NAME
  );
}

async function fetchTeamsMapByChannelHandle() {
  const teamsMapByName = await memoFetchTeamsMapByName();
  return Object.values(teamsMapByName).reduce(function (acc, teamObject) {
    acc[teamObject[TEAMS_HEADERS_CHANNEL]] = teamObject;
    return acc;
  }, {});
}

async function fetchMembersMapByHandle() {
  /*
    [
        ["E-mail", "Handle"],
        ["gagan.jakhotiya@bigbasket.com", "U042CPY14FN"]
    ]
  */
  const memberRows = await fetchAndValidateRows(
    ROSS_MEMBER_LIST_SHEET_NAME,
    MEMBERS_HEADERS
  );

  return convertHeadersAndRowsToMap(
    MEMBERS_HEADERS,
    memberRows,
    MEMBERS_HEADERS_HANDLE
  );
}

async function fetchMembersMapByEmail() {
  const memberMapByHandle = await memoFetchMembersMapByHandle();
  return Object.values(memberMapByHandle).reduce(function (acc, memberObject) {
    acc[memberObject[MEMBERS_HEADERS_EMAIL]] = memberObject;
    return acc;
  }, {});
}

async function fetchTemplateSheetData() {
  /*
    [
        ["Date", "Day"],
        ["13-04-2024", "SAT"]
    ]
  */
  return await fetchAndValidateRows(
    ROSS_TEAM_TEAMPLATE_SHEET_NAME,
    TEMPLATE_HEADERS.slice(0, -1),
    "",
    true
  );
}

async function fetchNewMemberCalendarFromTemplate(memberEmail) {
  /*
    [
        ["TestMember"],
        ["-2"]
    ]
  */
  const calendarColumn = await fetchAndValidateRows(
    ROSS_TEAM_TEAMPLATE_SHEET_NAME,
    TEMPLATE_HEADERS.slice(2),
    "",
    true,
    1,
    TEAM_SHEET_FIRST_MEMBER_COLUMN
  );

  calendarColumn[0][0] = memberEmail;

  return calendarColumn;
}

async function getTemplateStartDate() {
  const ddmmyyyyString = (
    await getFromSheet(`${ROSS_TEAM_TEAMPLATE_SHEET_NAME}!A2:A2`)
  ).values[0][0];
  return ddmmyyyyStringToDate(ddmmyyyyString);
}

async function getTemplateEndDate() {
  const columnResponse = (
    await getFromSheet(`${ROSS_TEAM_TEAMPLATE_SHEET_NAME}!A:A`)
  ).values;
  const ddmmyyyyString = columnResponse[columnResponse.length - 1][0];
  return ddmmyyyyStringToDate(ddmmyyyyString);
}

async function getHolidaysBetween(startDate, endDate) {
  if (!(startDate instanceof Date && endDate instanceof Date)) {
    throw "Expected Date object for value of startDate and endDate arguments.";
  }
  const templateStartDate = await memoGetTemplateStartDate();
  const startRowNumber = getTeamCalendarRowNumberForDate(
    startDate,
    templateStartDate
  );
  const endRowNumber = getTeamCalendarRowNumberForDate(
    endDate,
    templateStartDate
  );
  const columnResponse = (
    await getFromSheet(
      `${ROSS_TEAM_TEAMPLATE_SHEET_NAME}!A${startRowNumber}:C${endRowNumber}`
    )
  ).values;
  return columnResponse
    .map((dateDayStatusRow) => ({
      date: ddmmyyyyStringToDate(dateDayStatusRow[0]),
      status: dateDayStatusRow[2],
    }))
    .filter((sprintDay) => sprintDay.status == STATUS_HOLIDAY)
    .map((sprintDay) => sprintDay.date);
}

const getSprintSheet = defaultAsyncMemoizer(async function getSprintSheet() {
  return (await getFromSheet(`${ROSS_SPRINTS_SHEET_NAME}!A:C`)).values;
}, XL_TTL);

async function getSprintDateRangeRelativeToDate(inputDate, relativeIndex) {
  if (!(inputDate instanceof Date)) {
    throw "Argument inputDate should be an instance of Date type.";
  }
  if (typeof relativeIndex !== "number") {
    throw "Argument relativeIndex should be of type number.";
  }
  const columnResponse = await getSprintSheet();

  let inputDateSprintRowIndex = -1;
  columnResponse.slice(1).forEach((sprintRow, slicedIndex) => {
    const sprintStartDate = ddmmyyyyStringToDate(sprintRow[1]);
    const sprintEndDate = ddmmyyyyStringToDate(sprintRow[2]);
    sprintEndDate.setHours(23,59,59);
    if (inputDate >= sprintStartDate && inputDate <= sprintEndDate) {
      inputDateSprintRowIndex = slicedIndex + 1;
    }
  });

  const relativeSprintRowIndex = inputDateSprintRowIndex + relativeIndex;

  if (
    relativeSprintRowIndex <= 0 ||
    relativeSprintRowIndex >= columnResponse.length
  ) {
    throw "Relative Sprint not found";
  }

  const relativeSrintRow = columnResponse[relativeSprintRowIndex];

  return {
    id: parseInt(relativeSrintRow[0]),
    startDate: ddmmyyyyStringToDate(relativeSrintRow[1]),
    endDate: ddmmyyyyStringToDate(relativeSrintRow[2]),
  };
}

async function getSprintDetails(inputDate) {
  inputDate = inputDate || getTodayStartOfTheDayDateObject();
  if (!(inputDate instanceof Date)) {
    throw "Argument inputDate should be an instance of Date type.";
  }
  const columnResponse = await getSprintSheet();

  let currentSprintRow = columnResponse.slice(1).filter((sprintRow) => {
    const sprintStartDate = ddmmyyyyStringToDate(sprintRow[1]);
    const sprintEndDate = ddmmyyyyStringToDate(sprintRow[2]);
    sprintEndDate.setHours(23,59,59);
    return inputDate >= sprintStartDate && inputDate <= sprintEndDate;
  })[0];

  if (!currentSprintRow) {
    throw "The value of `inputDate` doesn't belong to any defined sprints.";
  }

  const startDate = ddmmyyyyStringToDate(currentSprintRow[1]);
  const endDate = ddmmyyyyStringToDate(currentSprintRow[2]);
  const holidays = await memoGetHolidaysBetween(startDate, endDate);

  let completedDays = getDaysBetweenDates(inputDate, startDate);
  let remainingDays = getDaysBetweenDates(endDate, inputDate) + 1;

  // No worry about present day. This won't get executed.
  holidays.forEach((holidayDate) => {
    if (holidayDate > inputDate) {
      remainingDays--;
    } else {
      completedDays--;
    }
  });

  return {
    id: currentSprintRow[0],
    inputDate,
    startDate,
    endDate,
    completedDays,
    remainingDays,
    holidayDates: holidays.filter(isNotWeekend),
    weekendDates: holidays.filter(isWeekend),
  };
}

async function getExistingMembersOfTeam(teamName) {
  const teamCalendarHeaders = await getFromSheet(`${teamName}!1:1`);
  return teamCalendarHeaders.values[0].slice(2);
}

async function getMemberStatusesForTeam(teamName, date) {
  if (!(date instanceof Date)) {
    throw "Input date should be of type Date in getMemberStatusesForTeam";
  }

  const templateStartDate = await memoGetTemplateStartDate();
  const rowNumber = getTeamCalendarRowNumberForDate(date, templateStartDate);
  const headers = await getFromSheet(`${teamName}!1:1`);
  const statuses = await getFromSheet(`${teamName}!${rowNumber}:${rowNumber}`);
  return headers.values[0].slice(2).reduce(function (acc, memberEmail, index) {
    acc[memberEmail] = {
      email: memberEmail,
      columnLetter: getNthColumnNameFrom(
        TEAM_SHEET_FIRST_MEMBER_COLUMN,
        index + 1
      ),
      status: statuses.values[0][index + 2],
    };
    return acc;
  }, {});
}

async function getTeamLeaderByChannelHandle(teamHandle) {
  return (await memoFetchTeamsMapByChannelHandle())[teamHandle][
    TEAMS_HEADERS_LEADER
  ];
}

/*
Sample Response:
{
  "startDate": "2024-04-19T18:30:00.000Z",
  "endDate": "2024-04-29T18:30:00.000Z",
  "startRowNumber": 21,
  "endRowNumber": 31,
  "teamWiseDetails": [
    {
      "rowNumber": 3,
      "Name": "TestTeam",
      "Channel": "TEAMHANDLE",
      "Owner": "LEADHANDLE",
      "Leader": "LEADHANDLE",
      "Members": "2",
      "Active": "1",
      "memberWiseDetails": {
        "test1@bigbasket.com": {
          "rowNumber": 6,
          "E-mail": "test1@bigbasket.com",
          "Handle": "MEM1HANDLE",
          "teamSheetColumnLetter": "C",
          "ptoDates": ["2024-04-22T18:30:00.000Z", "2024-04-28T18:30:00.000Z"],
          "awayDates": []
        },
        "test2@bigbasket.com": {
          "rowNumber": 7,
          "E-mail": "test2@bigbasket.com",
          "Handle": "MEM2HANDLE",
          "teamSheetColumnLetter": "D",
          "ptoDates": [
            "2024-04-23T18:30:00.000Z",
            "2024-04-24T18:30:00.000Z",
            "2024-04-28T18:30:00.000Z"
          ],
          "awayDates": ["2024-04-22T18:30:00.000Z"]
        }
      }
    }
  ]
}
*/
async function getTeamAndMemberWiseLeaves(startDate, endDate) {
  if (!(startDate instanceof Date && endDate instanceof Date)) {
    throw "Expected Date object for value of startDate and endDate arguments.";
  }
  const templateStartDate = await memoGetTemplateStartDate();
  const startRowNumber = getTeamCalendarRowNumberForDate(
    startDate,
    templateStartDate
  );
  const endRowNumber = getTeamCalendarRowNumberForDate(
    endDate,
    templateStartDate
  );

  const teamsMapByChannelHandle = await memoFetchTeamsMapByChannelHandle();
  const activeTeams = Object.values(teamsMapByChannelHandle).filter(
    (teamObject) => teamObject[TEAMS_HEADERS_ACTIVE] == TEAM_STATUS_ACTIVE
  );
  const fetchRanges = activeTeams.flatMap((teamObject) => {
    const teamName = teamObject[TEAMS_HEADERS_NAME];
    const startColumn = TEAM_SHEET_FIRST_MEMBER_COLUMN;
    return [
      `${teamName}!${startColumn}1:1`,
      `${teamName}!${startColumn}${startRowNumber}:${endRowNumber}`,
    ];
  });
  const memberMapByEmail = await memoFetchMembersMapByEmail();
  const bulkFetchResponse = await bulkFetchSheet(fetchRanges);
  const teamWiseDetails = activeTeams.map((teamObject, index) => {
    const teamMemberEmailOrdered = bulkFetchResponse[2 * index].values[0];
    const teamMemberStatusOrdered =
      bulkFetchResponse[2 * index + 1].values || [];
    return {
      ...teamObject,
      memberWiseDetails: teamMemberEmailOrdered.reduce(function (
        acc,
        memberEmail,
        memberEmailIndex
      ) {
        const relativeMemberColumnPosition = memberEmailIndex + 1;
        acc[memberEmail] = {
          ...memberMapByEmail[memberEmail],
          teamSheetColumnLetter: getNthColumnNameFrom(
            TEAM_SHEET_FIRST_MEMBER_COLUMN,
            relativeMemberColumnPosition
          ),
          ptoDates: teamMemberStatusOrdered
            .map(function (dateSpecificStatusesRow, indexFromStartDate) {
              if (
                dateSpecificStatusesRow[memberEmailIndex] ==
                STATUS_PLANNED_LEAVE
              ) {
                return addDaysToDate(startDate, indexFromStartDate);
              }
              return null;
            })
            .filter((value) => Boolean(value)),
          awayDates: teamMemberStatusOrdered
            .map(function (dateSpecificStatusesRow, indexFromStartDate) {
              if (
                dateSpecificStatusesRow[memberEmailIndex] ==
                STATUS_UNPLANNED_LEAVE
              ) {
                return addDaysToDate(startDate, indexFromStartDate);
              }
              return null;
            })
            .filter((value) => Boolean(value)),
        };
        return acc;
      },
      {}),
    };
  });

  return {
    startDate,
    endDate,
    startRowNumber,
    endRowNumber,
    teamWiseDetails,
  };
}

/*
Sample Response:
{
  "selectedDate": "2024-04-28T18:30:00.000Z",
  "selectedDateRowNumber": 30,
  "teamWiseDetails": [
    {
      "rowNumber": 3,
      "Name": "TestTeam",
      "Channel": "TEAMHANDLE",
      "Owner": "LEADHANDLE",
      "Leader": "LEADHANDLE",
      "Members": "2",
      "Active": "1",
      "memberWiseDetails": {
        "test1@bigbasket.com": {
          "rowNumber": 6,
          "E-mail": "test1@bigbasket.com",
          "Handle": "MEM1HANDLE",
          "teamSheetRowNumber": 30,
          "teamSheetColumnLetter": "C",
          "status": "-3"
        },
        "test2@bigbasket.com": {
          "rowNumber": 7,
          "E-mail": "test2@bigbasket.com",
          "Handle": "MEM2HANDLE",
          "teamSheetRowNumber": 30,
          "teamSheetColumnLetter": "D",
          "status": "-3"
        }
      }
    }
  ]
}
*/
async function getTeamAndMemberWiseDailyStatus(selectedDate) {
  if (!(selectedDate instanceof Date)) {
    throw "Argument selectedDate should be an instance of Date type.";
  }
  const teamsMapByChannelHandle = await memoFetchTeamsMapByChannelHandle();
  const activeTeams = Object.values(teamsMapByChannelHandle).filter(
    (teamObject) => teamObject[TEAMS_HEADERS_ACTIVE] == TEAM_STATUS_ACTIVE
  );
  const templateStartDate = await memoGetTemplateStartDate();

  const selectedDateRowNumber = getTeamCalendarRowNumberForDate(
    selectedDate,
    templateStartDate
  );

  const fetchRanges = activeTeams.flatMap((teamObject) => {
    const teamName = teamObject[TEAMS_HEADERS_NAME];
    const startColumn = TEAM_SHEET_FIRST_MEMBER_COLUMN;
    return [
      `${teamName}!${startColumn}1:1`,
      `${teamName}!${startColumn}${selectedDateRowNumber}:${selectedDateRowNumber}`,
    ];
  });
  const memberMapByEmail = await memoFetchMembersMapByEmail();
  const bulkFetchResponse = await bulkFetchSheet(fetchRanges);
  const teamWiseDetails = activeTeams.map((teamObject, index) => {
    const teamMemberEmailOrdered = bulkFetchResponse[2 * index].values[0];
    const teamMemberStatusOrdered =
      (bulkFetchResponse[2 * index + 1].values || [])[0] || [];
    return {
      ...teamObject,
      memberWiseDetails: teamMemberEmailOrdered.reduce(function (
        acc,
        memberEmail,
        memberEmailIndex
      ) {
        acc[memberEmail] = {
          ...memberMapByEmail[memberEmail],
          teamSheetRowNumber: selectedDateRowNumber,
          teamSheetColumnLetter: getNthColumnNameFrom(
            TEAM_SHEET_FIRST_MEMBER_COLUMN,
            memberEmailIndex + 1
          ),
          status:
            teamMemberStatusOrdered[memberEmailIndex] || STATUS_YET_TO_PLAN,
        };
        return acc;
      },
      {}),
    };
  });

  return {
    selectedDate,
    selectedDateRowNumber,
    teamWiseDetails,
  };
}

const memoFetchTeamsMapByName = defaultAsyncMemoizer(
  fetchTeamsMapByName,
  XM_TTL
);
const memoFetchTeamsMapByChannelHandle = defaultAsyncMemoizer(
  fetchTeamsMapByChannelHandle,
  XM_TTL
);
const memoFetchMembersMapByHandle = defaultAsyncMemoizer(
  fetchMembersMapByHandle,
  XM_TTL
);
const memoFetchMembersMapByEmail = defaultAsyncMemoizer(
  fetchMembersMapByEmail,
  XM_TTL
);
const memoFetchTemplateSheetData = defaultAsyncMemoizer(
  fetchTemplateSheetData,
  XL_TTL
);
const memoFetchNewMemberCalendarFromTemplate = defaultAsyncMemoizer(
  fetchNewMemberCalendarFromTemplate,
  XL_TTL
);
const memoGetTemplateStartDate = defaultAsyncMemoizer(
  getTemplateStartDate,
  XL_TTL
);
const memoGetTemplateEndDate = defaultAsyncMemoizer(getTemplateEndDate, XL_TTL);
const memoGetSprintDateRangeRelativeToDate = defaultAsyncMemoizer(
  getSprintDateRangeRelativeToDate,
  XL_TTL
);
const memoGetSprintDetails = defaultAsyncMemoizer(getSprintDetails, XL_TTL);
const memoGetHolidaysBetween = defaultAsyncMemoizer(getHolidaysBetween, XL_TTL);

exports.prepareNewTeamRow = prepareNewTeamRow;
exports.getUpdatedTeamRow = getUpdatedTeamRow;
exports.registerNewMember = registerNewMember;

exports.fetchTeamsMapByName = memoFetchTeamsMapByName;
exports.fetchTeamsMapByChannelHandle = memoFetchTeamsMapByChannelHandle;
exports.fetchMembersMapByHandle = memoFetchMembersMapByHandle;
exports.fetchMembersMapByEmail = memoFetchMembersMapByEmail;
exports.fetchTemplateSheetData = memoFetchTemplateSheetData;
exports.fetchNewMemberCalendarFromTemplate =
  memoFetchNewMemberCalendarFromTemplate;
exports.getTemplateStartDate = memoGetTemplateStartDate;
exports.getTemplateEndDate = memoGetTemplateEndDate;
exports.getSprintDateRangeRelativeToDate = memoGetSprintDateRangeRelativeToDate;
exports.getSprintDetails = memoGetSprintDetails;
exports.getHolidaysBetween = memoGetHolidaysBetween;

exports.getExistingMembersOfTeam = getExistingMembersOfTeam;
exports.getMemberStatusesForTeam = getMemberStatusesForTeam;
exports.getTeamLeaderByChannelHandle = getTeamLeaderByChannelHandle;
exports.getTeamAndMemberWiseLeaves = getTeamAndMemberWiseLeaves;
exports.getTeamAndMemberWiseDailyStatus = getTeamAndMemberWiseDailyStatus;
