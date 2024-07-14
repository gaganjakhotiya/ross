/*
 * Author: Gagan Jakhotiya
 * Date: 2024-04-04
 * Description: This file contains sheets utilities.
 */

function getNthColumnNameFrom(startColumn, totalColumnCount) {
  if (totalColumnCount <= 0 || typeof totalColumnCount !== "number") {
    throw "Invalid 'totalColumnCount' value passed.";
  }
  return String.fromCharCode(startColumn.charCodeAt() + totalColumnCount - 1);
}

function convertHeadersAndRowsToMap(headers, rows, primaryKey) {
  if (headers.indexOf(primaryKey) === -1) {
    throw "Primary Key not found.";
  }

  return rows
    .map(function (rowItem, index) {
      let rowObject = { rowNumber: index + 1 + 1 };
      for (index = 0; index < rowItem.length; index++) {
        rowObject[headers[index]] = rowItem[index];
      }
      return rowObject;
    })
    .reduce(function (sheetObject, rowObject) {
      sheetObject[rowObject[primaryKey]] = rowObject;
      return sheetObject;
    }, {});
}

function ddmmyyyyStringToDate(ddmmyyyyString) {
  const [dd, mm, yyyy, ..._] = ddmmyyyyString.split("-");
  const parsedDate = Date.parse(`${mm}-${dd}-${yyyy}`);
  if (isNaN(parsedDate)) {
    throw "Invalid Date String;";
  }
  return new Date(parsedDate);
}

function ddmmyyyyStringFromDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  return `${dd}-${mm}-${yyyy}`;
}

function isOpeningHour(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return date.getUTCHours() == 9; // TODO: Confirm IST
}

function isWorkingHour(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return date.getUTCHours() >= 9 && date.getUTCHours() <= 12; // TODO: Confirm IST
}

function isClosingHour(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return date.getUTCHours() == 12; // TODO: Confirm IST
}

function getTodayStartOfTheDayDateObject() {
  const today = convertToISTDate(new Date());
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function getCurrentDateTimeIST() {
  return convertToISTDate(new Date());
}

function convertToISTDate(inputDate) {
  const inputDateInMillis = inputDate.getTime();
  const tzOffsetInMillis = inputDate.getTimezoneOffset() * 60 * 1000;
  const istOffsetInMillis = 330 * 60 * 1000; // 330 Minutes
  return new Date(inputDateInMillis + tzOffsetInMillis + istOffsetInMillis);
}

function isFutureDate(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return (
    new Date(date).setUTCHours(0, 0, 0, 0) > getTodayStartOfTheDayDateObject()
  );
}

function isWeekend(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return date.getDay() % 6 === 0;
}

function isNotWeekend(date) {
  return !isWeekend(date);
}

function addDaysToDate(inputDate, daysToAdd) {
  var outputDate = new Date(inputDate);
  outputDate.setDate(outputDate.getDate() + daysToAdd);
  return outputDate;
}

function getDaysBetweenDates(endDate, startDate) {
  if (startDate instanceof Date && endDate instanceof Date) {
    return Math.floor(
      (new Date(endDate.getTime()).setHours(0, 0, 0, 0) -
        new Date(startDate.getTime()).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );
  } else {
    throw "Input arguments are not of type Date.";
  }
}

function getTeamCalendarRowNumberForDate(targetDate, startDate) {
  const daysDiff = getDaysBetweenDates(targetDate, startDate);
  if (daysDiff >= 0) {
    return 1 + daysDiff + 1;
  } else {
    throw "Cannot have targetDate older than startDate.";
  }
}

function getOrdinalNumberString(n) {
  return (
    n +
    (n > 0
      ? ["th", "st", "nd", "rd"][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10]
      : "")
  );
}

function getOrdinalDateString(date) {
  if (!(date instanceof Date)) {
    throw "Date type object expected.";
  }
  return (
    getOrdinalNumberString(date.getDate()) + " " + date.getShortMonthName()
  );
}

Date.prototype.monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

Date.prototype.getMonthName = function () {
  return this.monthNames[this.getMonth()];
};

Date.prototype.getShortMonthName = function () {
  return this.getMonthName().substr(0, 3);
};

Date.prototype.getISTHours = function () {
  let utcHours = this.getUTCHours();
  let istHours = utcHours + 5;
  if (this.getUTCMinutes() >= 30) {
    istHours += 1;
  }
  istHours = istHours % 24;
  return istHours;
};

exports.getNthColumnNameFrom = getNthColumnNameFrom;
exports.convertHeadersAndRowsToMap = convertHeadersAndRowsToMap;
exports.ddmmyyyyStringToDate = ddmmyyyyStringToDate;
exports.ddmmyyyyStringFromDate = ddmmyyyyStringFromDate;
exports.isOpeningHour = isOpeningHour;
exports.isWorkingHour = isWorkingHour;
exports.isClosingHour = isClosingHour;
exports.isFutureDate = isFutureDate;
exports.isWeekend = isWeekend;
exports.isNotWeekend = isNotWeekend;
exports.addDaysToDate = addDaysToDate;
exports.getDaysBetweenDates = getDaysBetweenDates;
exports.getTeamCalendarRowNumberForDate = getTeamCalendarRowNumberForDate;
exports.getCurrentDateTimeIST = getCurrentDateTimeIST;
exports.getTodayStartOfTheDayDateObject = getTodayStartOfTheDayDateObject;
exports.getOrdinalNumberString = getOrdinalNumberString;
exports.getOrdinalDateString = getOrdinalDateString;
