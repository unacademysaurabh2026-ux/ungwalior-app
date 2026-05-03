// ================================================================
//  Google Apps Script — Unacademy Gwalior LMS Backend
//  Paste this entire file into Google Apps Script Editor
//  Then deploy as Web App (Anyone can access)
// ================================================================

// Your Spreadsheet ID (from the URL of your Google Sheet)
const SPREADSHEET_ID = '1gQd93EJxCVF5A7mfEm8zQVS8iHpX8QDJ-OlDtERACtg';

const SHEETS = {
  batches  : 'Batches',
  students : 'Students',
  lectures : 'Lectures',
};

function doPost(e) {
  try {
    // Support both application/json and text/plain (no-cors browser requests)
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action;
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);

    let result = { success: true };

    if      (action === 'addBatch')       addBatch(ss, data);
    else if (action === 'updateBatch')    updateBatch(ss, data);
    else if (action === 'deleteBatch')    deleteRow(ss, SHEETS.batches, data.id);
    else if (action === 'addStudent')     addStudent(ss, data);
    else if (action === 'updateStudent')  updateStudent(ss, data);
    else if (action === 'deleteStudent')  deleteRow(ss, SHEETS.students, data.id);
    else if (action === 'toggleStudent')  toggleStudent(ss, data);
    else if (action === 'addLecture')     addLecture(ss, data);
    else if (action === 'updateLecture')  updateLecture(ss, data);
    else if (action === 'deleteLecture')  deleteRow(ss, SHEETS.lectures, data.id);
    else if (action === 'loginStudent')   result = loginStudent(ss, data);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Health check endpoint
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', version: '2.0' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function addBatch(ss, data) {
  const sheet = ss.getSheetByName(SHEETS.batches);
  sheet.appendRow([data.id, data.name]);
}

function updateBatch(ss, data) {
  const sheet  = ss.getSheetByName(SHEETS.batches);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      sheet.getRange(i + 1, 2).setValue(data.name);
      break;
    }
  }
}

function addStudent(ss, data) {
  const sheet = ss.getSheetByName(SHEETS.students);
  // Added password column (column F)
  sheet.appendRow([data.id, data.name, data.email, data.batchId, 'true', data.password]); // 'true' as plain string, not boolean
}

function updateStudent(ss, data) {
  const sheet  = ss.getSheetByName(SHEETS.students);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      sheet.getRange(i + 1, 2).setValue(data.name);      // column B = name
      sheet.getRange(i + 1, 3).setValue(data.email);     // column C = email
      sheet.getRange(i + 1, 4).setValue(data.batchId);   // column D = batchId
      if (data.password) {
        sheet.getRange(i + 1, 6).setValue(data.password); // column F = password
      }
      break;
    }
  }
}

function addLecture(ss, data) {
  const sheet = ss.getSheetByName(SHEETS.lectures);
  sheet.appendRow([data.id, data.title, data.batchId, data.ytId, data.subject, data.date]);
}

function updateLecture(ss, data) {
  const sheet  = ss.getSheetByName(SHEETS.lectures);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      sheet.getRange(i + 1, 2).setValue(data.title);
      sheet.getRange(i + 1, 3).setValue(data.batchId);
      sheet.getRange(i + 1, 4).setValue(data.ytId);
      sheet.getRange(i + 1, 5).setValue(data.subject);
      break;
    }
  }
}

function toggleStudent(ss, data) {
  const sheet  = ss.getSheetByName(SHEETS.students);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id)) {
      // Write plain lowercase string 'true' or 'false'
      // Do NOT write boolean — Google Sheets booleans export as TRUE/FALSE uppercase
      // which creates parsing confusion in CSV. Plain text 'true'/'false' is reliable.
      const activeVal = (data.active === true || data.active === 'true') ? 'true' : 'false';
      sheet.getRange(i + 1, 5).setValue(activeVal);
      break;
    }
  }
}

function deleteRow(ss, sheetName, id) {
  const sheet  = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// ================================================================
//  NEW FUNCTION: Verify Student Login (ID & Password)
// ================================================================
function loginStudent(ss, data) {
  const sheet  = ss.getSheetByName(SHEETS.students);
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    const studentId = values[i][0];
    const studentPassword = values[i][5]; // column F = password
    const isActive = values[i][4];
    
    if (studentId === data.id && studentPassword === data.password) {
      if (isActive === 'true' || isActive === true) {
        return {
          success: true,
          message: 'Login successful',
          name: values[i][1],
          email: values[i][2],
          batchId: values[i][3]
        };
      } else {
        return {
          success: false,
          message: 'Your account is inactive'
        };
      }
    }
  }
  
  return {
    success: false,
    message: 'Invalid ID or password'
  };
}

// ================================================================
//  RUN THIS ONCE to create all sheets with headers
// ================================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Batches sheet
  let s = ss.getSheetByName(SHEETS.batches);
  if (!s) s = ss.insertSheet(SHEETS.batches);
  s.getRange(1,1,1,2).setValues([['id','name']]);

  // Students sheet (WITH PASSWORD COLUMN)
  s = ss.getSheetByName(SHEETS.students);
  if (!s) s = ss.insertSheet(SHEETS.students);
  s.getRange(1,1,1,6).setValues([['id','name','email','batchId','active','password']]);

  // Lectures sheet
  s = ss.getSheetByName(SHEETS.lectures);
  if (!s) s = ss.insertSheet(SHEETS.lectures);
  s.getRange(1,1,1,6).setValues([['id','title','batchId','ytId','subject','date']]);

  Logger.log('✅ All sheets created with password column!');
}
