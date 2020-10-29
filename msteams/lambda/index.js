const request = require('request');

const truncate = (input, len) => input.length > len ? `${input.substring(0, len)}...` : input;

const valid_embed_ids = ['prompt_embed:12345']

const convertEpochToTimezone = (epoch, offset) => {
    const d = new Date(epoch);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);  //This converts to UTC 00:00
    const nd = new Date(utc + (3600000*offset))
    return nd.toDateString() + ' ' + nd.toLocaleTimeString()
}

const getThemeColor = (source) => {
    return '#64BEB3'
}

const getCardTitle = (payload) => {
    return 'NEW QUESTION:' + truncate(payload.original_text, 500)
}

const isNotifiable = (payload) => {
  if (!payload.id || !payload.organization_audience_member) {
    return false
  }
  if (!payload.source ||  !valid_embed_ids.includes(payload.source)) {
    return false
  }
  return true
}

const getCustomField = (customFields, fieldName) => {
    var val = customFields.filter(function(f) {
      return f.name.indexOf(fieldName) !== -1
    })
    if (val.length > 0) {
      return val[0].value
    }
    return '';
}

const getHookUrl = (category) => process.env[category.toUpperCase() + '_HOOK_URL']


exports.handler = async (event, context, callback) => {
  const eventBody = JSON.parse(event.body)
  const payload = eventBody.payload

  if (!isNotifiable(payload)) {
    return { statusCode: 200, body: 'Filtered out' }
  }

  let hookBody = {
	"@type": "MessageCard",
	"@context": "https://schema.org/extensions",
	"summary": "New question from" + payload.organization_audience_member.name,
	"themeColor": getThemeColor(),
	"title": getCardTitle(payload),
	"sections": [
		{
			"activityTitle": "**" + payload.organization_audience_member.name + "** <" +
        payload.organization_audience_member.email + '>',
			"activitySubtitle": 'Submitted on ' +
        convertEpochToTimezone(payload.created_at, process.env.TIMEZONE_OFFSET) +
        ' through **[' + payload.embed_name + '](' +  payload.source_url + ')**',
			"activityImage": process.env.IMAGE_URL,
			"facts": [
				{
					"name": "Status:",
                    "value": payload.question_status.name
				}
            ].concat(payload.custom_fields)
        }
	],
	"potentialAction": [
		{
			"@type": "OpenUri",
			"name": "View in EMS",
			"targets": [
				{
					"os": "default",
					"uri": "https://ems.wearehearken.com/" + eventBody.organization.slug + "/admin/questions/" + payload.id
				}
			]
		}
	]
}


  let options = {
    'method': 'POST',
    'url':  process.env.HOOK_URL,
    'headers': {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(hookBody)
  }


  const promise = new Promise(function(resolve, reject) {
    request(options, function(error, response) {
      if (error) {
        console.error(error, 'payload id:', payload.id)
        reject({
          statusCode: 500,
          body: JSON.stringify(error)
        })
      } else {
        resolve({
          statusCode: 200,
          body: 'Success!'
        })
      }
    })
  })
  return promise
};