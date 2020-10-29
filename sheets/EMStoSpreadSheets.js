function EMStoSpreadSheet() {
  Logger.clear() <<
    << << < HEAD
  const KEY = '' // Your Key in ''
  const ORG_SLUG = 'kpcc' // your  organization_id
  const LIMIT = 100 // how many questions to fetch at a time.
  const GEOCODING_API_KEY = 'AIzaSyBwLLUy0uvf6sCtVJqf4pmVlnhRjNLi0eY'
  const EMBED_ID = 'prompt_embed:4823'

  const COLUMNS = [
    'Id', 'Date received', 'Question/Concern', 'Name',
    'Contact Info', 'Zip Code', 'County', 'Send help info',
    'Send volunteer donate info', 'EMS link', 'Show assigned',
    'Show producer assigned', 'Engagement team assigned',
    'OUR OUTREACH', 'Date answered', 'Follow up?', 'Follow up date',
    'HOW DID THEY REACH US (what platform? Facebook, HVG text, etc)',
    'REPORTER WHO WANTS SOURCE'
  ]

  const EXEMPT_SHEETS = ['metadata', 'ANSWER CHEAT SHEET', 'QUESTIONS', 'OUT-OF-STATE QUESTIONS']

  const idCache = {}

  function dataToColumns(q, county) {
    return [
      q.id, new Date(q.created_at), q.display_text,
      q.name, q.email, getCustomField(q.custom_fields, 'Zip code'), county,
      getCustomField(q.custom_fields, "I'd like to learn about resources available"),
      getCustomField(q.custom_fields, "I'd like to learn about opportunities to volunteer or donate"),
      'https://ems.wearehearken.com/kpcc/admin/questions/' + q.id

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

  const listIdToName = {
    '7944': 'Symptoms',
    '7945': 'Safe Activities',
    '7946': 'Sanitizing',
    '7947': 'Closure',
    '7948': 'Stimulus',
    '7949': 'Testing/travel',
    '7950': 'Evictions',
    '7951': 'Small business',
    '7952': 'Food/Shopping',
    '7953': 'General',
    '7954': 'Senior'
  }

  function getSheetNameForQ(q, geocodeVal) {
    let inState = geocodeVal && geocodeVal['administrative_area_level_1'] == 'CA'
    let list_ids = q.lists.data.map((l) => l.id).filter((i) => i >= 7944 && i <= 7954)
    let lists = list_ids.map((i) => listIdToName[i.toString()])
    if (!lists || lists.length === 0) {
      lists = ['Unclassified']
    }
    return lists[0] + (inState ? '' : '| OUT-OF-STATE')
  }

  function appendRow(q) {
    let zipCode = getCustomField(q.custom_fields, 'Zip code')
    let geocodeVal = geocode(zipCode)

    let sheetName = getSheetNameForQ(q, geocodeVal)
    let sheet = getOrCreateSheet(sheetName)
    if (idExists(sheetName, q.id)) {
      return
    }
    sheet.appendRow(dataToColumns(q, geocodeVal && geocodeVal['administrative_area_level_2']));
    addToCache(sheetName, q.id)
  }


  function addToCache(sheetName, id) {
    if (!idCache[sheetName]) {
      idCache[sheetName] = []
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
      sheet.appendRow(COLUMNS)
    }
    return sheet;
  }

  function getCustomField(fields, name) {
    let val = fields.filter(function (f) {
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

  function getIdsInSheet(sheetName) {
    let sheet = getOrCreateSheet(sheetName);

    let lastRow = Math.round(activeSpreadsheet.getLastRow())
    if (lastRow < 2) {
      return []
    }

    let ids = readDataFromRange(activeSpreadsheet, 'A2:A' + lastRow)
    ids = ids.map(function (id) {
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


  function idExists(sheetName, id) {
    return (getRowInSheet(sheetName, id) > -1)
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
    if (response.data != null) {
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
    let response = fetchResponse(url + '&api_key=' + KEY)
    processResponse(response)
  }

  function buildIdCache() {
    let spreadsheet = SpreadsheetApp.getActive();
    let sheets = spreadsheet.getSheets();
    for (let sheet of sheets) {
      let sheetName = sheet.getName()
      if (!EXEMPT_SHEETS.includes(sheetName)) {
        idCache[sheetName] = getIdsInSheet(sheetName)
        Logger.log('caching ' + sheetName);
      }
    }
  }

  function geocode(zip) {
    if (!zip) {
      return
    }
    let geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json?components=postal_code:' +
      zip + '&key=' + GEOCODING_API_KEY
    let response = UrlFetchApp.fetch(geocodeUrl, {
      'muteHttpExceptions': true
    })
    let parsedResp = JSON.parse(response)
    return geocodeToComponents(parsedResp.results[0])
  }

  function geocodeToComponents(components) {
    if (!components) {
      return {}
    }
    let ret = {}
    let comps = components['address_components']
    comps.forEach((c) => {
      ret[c['types'][0]] = c.short_name
    });
    return ret
  }

  //deleteSheets()
  let lastTimeStamp = getLastTimeStamp()
  let newTimeStamp = lastTimeStamp
  buildIdCache()
  let baseUrl = 'https://api.wearehearken.com/api/v1/questions' +
    '?organization_slug=' + ORG_SLUG +

    '&api_key=' + KEY +
    '&_limit=' + LIMIT +
    '&created_at_gte=' + lastTimeStamp +
    '&source=' + EMBED_ID

  getAndProcess(baseUrl);
  sortDataSheets();

  return
}
