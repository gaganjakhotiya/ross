/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains Google sheets util functions for
 * reading / writing user data. The code operates on a single sheetId
 * with a single Service Account auth token.
 *
 * This file code depends on two env variables:
 * 1. ROSS_TOKEN_FILENAME
 * 2. ROSS_GOOGLE_SHEET_ID
 *
 */

const { google } = require("googleapis");
const path = require("path");
const { getNthColumnNameFrom } = require("./utils");
const sheets = google.sheets("v4");

const SECRET_FILE_PATH = path.join(
  __dirname,
  "../../../token/",
  process.env.ROSS_TOKEN_FILENAME
);
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const GOOGLE_SHEET_ID = process.env.ROSS_GOOGLE_SHEET_ID;

const getClient = (function () {
  let auth;
  return function () {
    if (!auth) {
      auth = new google.auth.GoogleAuth({
        keyFile: SECRET_FILE_PATH,
        scopes: SCOPES,
      });
    }
    return auth.getClient();
  };
})();

async function checkIfSheetExists(sheetName) {
  console.log("[SHEETS_CHECK] Req:", sheetName);
  try {
    const client = await getClient();
    const readData = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: GOOGLE_SHEET_ID,
      valueRenderOption: "FORMATTED_VALUE",
      range: `${sheetName}A1:B2`,
    });

    console.log("[SHEETS_CHECK] Res:", sheetName, true);
    return true;
  } catch (e) {
    console.log("[SHEETS_CHECK] Res:", sheetName, false);
    return false;
  }
}

async function getFromSheet(range) {
  console.log("[SHEETS_READ] Req:", range);
  try {
    const client = await getClient();
    const readData = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: GOOGLE_SHEET_ID,
      valueRenderOption: "FORMATTED_VALUE",
      range,
    });

    console.log("[SHEETS_READ] Res:", range, JSON.stringify(readData.data));

    return readData.data;
  } catch (e) {
    console.error("[SHEETS_READ] Err:", range, exceptionToErrorMessage(e));
    throw exceptionToErrorMessage(e);
  }
}

async function putToSheet(range, values) {
  console.log("[SHEETS_WRITE] Req:", range, values);
  try {
    const client = await getClient();
    const writeData = await sheets.spreadsheets.values.update({
      auth: client,
      spreadsheetId: GOOGLE_SHEET_ID,
      valueInputOption: "RAW",
      requestBody: { values },
      range,
    });

    console.log("[SHEETS_WRITE] Res:", range, JSON.stringify(writeData.data));

    return writeData;
  } catch (e) {
    console.error("[SHEETS_WRITE] Err:", range, exceptionToErrorMessage(e));
    throw exceptionToErrorMessage(e);
  }
}

async function createNewSheet(name) {
  console.log("[SHEETS_NEW] Req:", name);
  try {
    const client = await getClient();
    const writeData = await sheets.spreadsheets.batchUpdate({
      auth: client,
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: name,
              },
            },
          },
        ],
      },
    });

    console.log("[SHEETS_NEW] Res:", JSON.stringify(writeData.data));

    return writeData;
  } catch (e) {
    console.error("[SHEETS_NEW] Err:", exceptionToErrorMessage(e));
    throw exceptionToErrorMessage(e);
  }
}

async function bulkFetchSheet(ranges) {
  console.log("[SHEETS_BULK_FETCH] Req:", JSON.stringify(ranges));
  try {
    const client = await getClient();
    const readData = (
      await sheets.spreadsheets.values.batchGet({
        auth: client,
        spreadsheetId: GOOGLE_SHEET_ID,
        ranges,
      })
    ).data.valueRanges;

    console.log("[SHEETS_BULK_FETCH] Res:", JSON.stringify(readData));

    return readData;
  } catch (e) {
    console.error("[SHEETS_BULK_FETCH] Err:", exceptionToErrorMessage(e));
    throw exceptionToErrorMessage(e);
  }
}

async function bulkUpdateSheet(requests) {
  console.log("[SHEETS_BULK_UPDATE] Req:", JSON.stringify(requests));
  try {
    const client = await getClient();
    const writeData = await sheets.spreadsheets.values.batchUpdate({
      auth: client,
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: requests, // [ { range: "Teams!A1:B1", values: [[1,2]] } ]
      },
    });

    console.log("[SHEETS_BULK_UPDATE] Res:", JSON.stringify(writeData.data));

    return writeData;
  } catch (e) {
    console.error("[SHEETS_BULK_UPDATE] Err:", exceptionToErrorMessage(e));
    throw exceptionToErrorMessage(e);
  }
}

async function fetchAndValidateRows(
  sheetName,
  columnHeaderList,
  optionalRowLimit,
  skipSliceHeaders = false,
  startRow = 1,
  startColumn = "A"
) {
  const endColumn = getNthColumnNameFrom(startColumn, columnHeaderList.length);

  // Fetch
  let rows = (
    await getFromSheet(
      `${sheetName}!${startColumn}${startRow}:${endColumn}${
        optionalRowLimit || ""
      }`
    )
  ).values;

  // Validate
  if (
    columnHeaderList.length !== rows[0].length ||
    rows[0].join("-") !== columnHeaderList.join("-")
  ) {
    throw `Incorrect schema detected. Sheet (${sheetName}) not supported.`;
  }

  return skipSliceHeaders ? rows : rows.slice(1);
}

function exceptionToErrorMessage(e) {
  return `${e.code}! ${e.errors.map(({ message }) => message).join("; ")}`;
}

exports.getFromSheet = getFromSheet;
exports.putToSheet = putToSheet;
exports.bulkFetchSheet = bulkFetchSheet;
exports.bulkUpdateSheet = bulkUpdateSheet;
exports.fetchAndValidateRows = fetchAndValidateRows;
exports.checkIfSheetExists = checkIfSheetExists;
exports.createNewSheet = createNewSheet;
