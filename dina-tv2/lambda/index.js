const fetch = require('node-fetch')

const isValidPayload = (body) => {
  let slug = body.organization && body.organization.slug
  if (slug !== process.env.ORG_SLUG) {
    return false
  }

  return true
}

const truncateToNWords = (str, n) => {
  let newString = str.split(" ").splice(0, n).join(" ")
  return (newString.length < str.length) ? newString + '...' : newString
}

const getpostalCode = (question) => {
  let postalCode = question.custom_fields.filter((f) => f.type == 'postal_code')
  return postalCode ? postalCode[0].value : null
}

const getBody = (question) => {
  let descr = `<p>${question.display_text}</p><hr/><p><b>Submitted by</b>: ${question.name}\<${question.email}\></p>`
  
  if (question.embed_name) {
    descr += `<p><b>Source</b>:<a target='_blank' href='${question.source_url}'>${question.embed_name}</a></p>`
  } else {
    descr += `<p><b>Source</b>:<a target='_blank' href='${question.source_url}'>${question.source}</a></p>`
  }

  let customFields = question.custom_fields.map((f) => `<li><b>${f.name}</b>: ${f.value}</li>`).join(' ')
  descr += '<b>Custom Fields</b><ul>' + customFields + '</ul>'
  descr += `<p><b>Lists</b>: ${getListNames(question)}</p>`
  descr += `<p><i><a target='_blank' href='${getQuestionURL(question.id)}'>Open in EMS</a></i></p>`
  return descr
}

const getQuestionURL = (id) => `https://ems.wearehearken.com/${process.env.ORG_SLUG}/admin/questions/${id}`

const getListNames = (question) =>
  question.lists.data.map((l) => l.name).join(' ')

const toDinaFormat = (question) => {
  return JSON.stringify({
    "body": [{
      "uri": "hearken-" + question.id,
      "infosource": "Hearken",
      "version": 2,
      "versioncreated": new Date(question.created_at).toISOString(),
      "urgency": 3,
      "pubstatus": "usable",
      "ednotes": question.notes,
      "headline": truncateToNWords(question.display_text, 10),
      "body_html": getBody(question),
      "located": getpostalCode(question),
      "href": getQuestionURL(question.id),
      "section": getListNames(question)
    }]
  })
}

const sendToDiNa = (question) => {
  let myHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.DINA_API_KEY
  }

  let requestOptions = {
    method: 'POST',
    headers: myHeaders,
    withCredentials: true,
    credentials: 'include',
    body: toDinaFormat(question),
    redirect: 'follow',
    timeout: 60000
  }
  
  return fetch(process.env.DINA_URL, requestOptions)
}

const refetchQuestion = (body) => {
  let myHeaders = {
    'Authorization': `Bearer ${process.env.EMS_API_KEY}`
  }

  let url = `${process.env.EMS_API_BASE_URL}/questions?organization_slug=${process.env.ORG_SLUG}&` +
    `created_at_gte=${body.payload.created_at}&created_at_lte=${body.payload.created_at}`
  let requestOptions = {
    method: 'GET',
    withCredentials: true,
    credentials: 'include',
    headers: myHeaders,
    redirect: 'follow'
  };
  return fetch(url, requestOptions)
}

const respondWithError = (error) => {
  console.error('responding  with error',  error)
  return {
    statusCode: 400,
    message: 'Error' + JSON.stringify(error)
  }
}

const parseResponse = (resp) => {
  return resp.json()
}

const validateResponse = (resp, stage) => {
  if (resp.status >= 400 && resp.status < 600) {
    console.error(stage, resp)
    throw new Error('Status:' + resp.status + '|' + resp.message + 'Stage:' + stage)
  }
  return
}

exports.handler = async (event) => {
  let body = JSON.parse(event.body)

  if (!isValidPayload(body)) {
    return {
      statusCode: 200,
      body: JSON.stringify('Filtered')
    };
  }

  const promise = new Promise(function (resolve, reject) {
    refetchQuestion(body)
      .then(parseResponse)
      .then(response => {
        validateResponse(response, 'refetch Question')

        if (response.total_objects <= 0) {
          console.error('Could not find question')
          reject(respondWithError('Could not find question'))
        } else {
          let question = response.data.filter((q) => q.id === body.payload.id)
          if (question.length === 0) {
            console.error('Could not find question')
            reject(respondWithError('Could not find question'))
          }
          sendToDiNa(question[0])
           .then(parseResponse)
           .then((resp) => {
               console.log("Response from DiNa",resp)
               if (resp === null) {
                 resolve({
                  statusCode: 200,
                  body: JSON.stringify('Success')
                 })
               }
            })
            .catch((resp) => {
              reject(respondWithError('Error' + resp))
            })
        }
      })
      .catch(error => reject(respondWithError(error)))
  })
  return promise
};
