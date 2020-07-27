function EMStoSpreadSheet() {
  Logger.clear()
  const KEY ='PkEqknRRbHFIcw6nbeMbMVgGtcOd9hOwS8XNY5WmvSNgLsHMSLhlRLG77DF3X1gW'
  const ORG_SLUG = 'cpr' // your  organization_slug
  const LIMIT = 500 // how many questions to fetch at a time
  const MAX_LENGTH = 30 // maximum length of tab names
  const FILTERS = ''

  const COLUMNS = [
    'Id',	'Question',
    'Asker Name', 'Asker Email','Anonymous?',
    'Submitted at'
  ]

  const EXEMPT_SHEETS = ['metadata']
  const idCache = {}

  function dataToColumns(q) {
    return [
      q.id, q.display_text, q.name,
      q.email, q.anonymous, new Date(q.created_at)
    ]
  }

  function getLastTimeStamp() {
    let metadataSheet = getOrCreateSheet('metadata');
    let timestamp = metadataSheet
      .getRange('B2')
      .getValue();
    return timestamp;
  }

  function setLastTimeStamp(timestamp) {
    let metadataSheet = getOrCreateSheet('metadata');
    let metadata = metadataSheet
      .getRange('B2')
      .setValue(timestamp);
  }

  function getSheetNameForQ(q) {
    return q.embed_name.substr(0, MAX_LENGTH)
  }

  function appendRow(q) {
    let sheetName = getSheetNameForQ(q)
    let sheet = getOrCreateSheet(sheetName)
    if (idExists(sheetName, q.id)) {
      return
    }
    sheet.appendRow(dataToColumns(q));
    addToCache(sheetName, q.id)
  }

  function addToCache(sheetname, id) {
    if(idCache[sheetname]) {
      idCache[sheetname] =  []
    }
    idCache[sheetname].push(id)
  }

  function deleteRow(sheet, rowIndex) {
    sheet.deleteRow(rowIndex);
  }

  function getOrCreateSheet(name) {
    let activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = activeSpreadsheet.getSheetByName(name);

    if (sheet === null) {
      sheet = activeSpreadsheet.insertSheet(name);
      sheet.appendRow()
    }
    return sheet;
  }

  function getCustomField(fields, name) {
    let val = fields.filter(function(f) {
      return f.name === name
    })
    if (val.length > 0) {
      return val[0].value
    }
    return '';
  }

  function readDataFromRange(sheet, range) {
    let dataRange = sheet.getRange(range)
    return dataRange.getValues();
  }

  function sortDataSheets() {
    let spreadsheet = SpreadsheetApp.getActive();
    let sheets = spreadsheet.getSheets();
    for (let sheet of sheets) {
      let sheetName = sheet.getName()
      if (!EXEMPT_SHEETS.includes(sheetName)) {
        sheet.sort(1, false)
        Logger.log('Sorted ' + sheetName);
      }
    }
  }

  function getIdsInSheet(sheetname) {
    let activeSpreadsheet = getOrCreateSheet(sheetname);

    let lastRow = Math.round(activeSpreadsheet.getLastRow())
    if (lastRow < 2) {
      return []
    }

    let ids = readDataFromRange(activeSpreadsheet, 'A2:A' + lastRow)
    ids = ids.map(function(id) {
     return id[0]
    })
    return ids
  }

  function deleteIfExists(sheetName, id) {
    let rowIndex = getRowInSheet(sheetName, id)
    if (rowIndex <= -1) {
      return
    }
    sheet.deleteRow(rowIndex + 2)
  }

  function getRowInSheet(sheetName, id) {
    let ids = idCache[sheetName] || []
    return ids.indexOf(id)
  }

  function idExists(sheetname, id) {
    return (getRowInSheet(sheetname, id) > -1)
  }

  function deleteSheets() {
    let spreadsheet = SpreadsheetApp.getActive();
    let sheets = spreadsheet.getSheets();
    for (let sheet of sheets) {
      let sheetName = sheet.getName()
      if (!EXEMPT_SHEETS.includes(sheetName)) {
        spreadsheet.deleteSheet(sheet)
        Logger.log('Deleted ' + sheetName);
      }

    }
  }

  function fetchResponse(uri) {
    Logger.log('Fetching', uri);
    let response = UrlFetchApp.fetch(uri, {
      'muteHttpExceptions': true
    });
    return JSON.parse(response)
  }

  function processResponse(response) {
    let questionCount = 0
    if(response.data != null) {
     questionCount = response.data.length
    }
    Logger.log('Processing..' + questionCount + ' responses');

    // Add questions to approproate spreadsheet
    for (let i = 0; i < questionCount; i++) {
      appendRow(response.data[i])
    }
    // get the timestamp from first item if first page
    if (questionCount > 0 && response.offset == 0) {
      newTimeStamp = response.data[0].created_at
    }

    if (response.next_page) {
      Logger.log('Response has next page');
      getAndProcess(response.next_page);
    } else {
      setLastTimeStamp(newTimeStamp)
    }
    return
  }

  function getAndProcess(url) {
    let response = fetchResponse(url)
    processResponse(response)
  }

  function buildIdCache() {
    let spreadsheet = SpreadsheetApp.getActive();
    let sheets = spreadsheet.getSheets();
    for (let sheet of sheets) {
      let sheetName = sheet.getName()
      if ( !EXEMPT_SHEETS.includes(sheetName)) {
        idCache[sheetName] = getIdsInSheet(sheetName)
        Logger.log('caching ' + sheetName);
      }
    }
  }


  // deleteSheets()
  let lastTimeStamp = getLastTimeStamp()
  let newTimeStamp = lastTimeStamp
  buildIdCache()
  let baseUrl = 'https://api.wearehearken.com/api/v1/questions' +
    '?organization_slug=' + ORG_SLUG +
    '&api_key=' + KEY + FILTERS +
    '&_limit=' + LIMIT

  getAndProcess(baseUrl);
  sortDataSheets();

  return
}
