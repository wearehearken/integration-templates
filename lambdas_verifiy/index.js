const fetch = require('node-fetch')
const isValidPayload = (body) => {
  if (body._event !== 'new_question') {
    return false
  }
  let slug = body.organization && body.organization.slug
  if (slug !== process.env.ORG_SLUG) {
    return false
  }

  let source = body.payload && body.payload.source
  if (source !== process.env.EMBED_SOURCE) {
    return false
  }
  return true
}

const TOPICS_LISTS_MAP = [7944, 7945, 7946, 7947, 7948, 7949, 7950,  7951, 7952, 7953, 7954]
let resultClassification = null
const classifyQuestion = (question) => {
  let myHeaders = {
    "Content-Type": "application/json"
  }

  let raw = JSON.stringify([question.original_text]);

  let requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow',
    timeout: 6000
  }
  return fetch(process.env.CLASSIFIER_URL, requestOptions)
}


const refetchQuestion = (body) => {
  let myHeaders = {
    'Authorization': `Bearer ${process.env.EMS_API_KEY}`
  }

  let url = `${process.env.API_BASE_URL}/questions?organization_slug=${process.env.ORG_SLUG}&` +
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
  console.error(error)
  return {
    statusCode: 400,
    message: 'Error' + JSON.stringify(error)
  }
}


const topicToListMapping = (topicId) => {
  if (topicId === null) {
    return
  }
  if (topicId < 0 || topicId > TOPICS_LISTS_MAP.length - 1) {
    return
  }

  return TOPICS_LISTS_MAP[topicId]
}

const updateQuestionInEMS = (resp, questionId) => {
  validateResponse(resp, 'Classify Question')
  const topicId = resp[0][1][1]
  resultClassification = resp[0][1][0]
  const listId = topicToListMapping(topicId)
  var rawBody = JSON.stringify({'add':[questionId]});

  if (!listId) {
    throw new Error('Could not classify ' + questionId + '\n ' + JSON.stringify(resp))
  }

  let myHeaders = {
    'Authorization': `Bearer ${process.env.EMS_API_KEY}`
  }

  let url = `${process.env.API_BASE_URL}/lists/${listId}/questions`
  let requestOptions = {
    method: 'PATCH',
    withCredentials: true,
    credentials: 'include',
    headers: myHeaders,
    redirect: 'follow',
    body: rawBody
  };
  return fetch(url, requestOptions)
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

  const promise = new Promise(function(resolve, reject) {
    refetchQuestion(body)
      .then(parseResponse)
      .then(response => {
        validateResponse(response, 'refetch Question')

        if (response.total_objects <= 0) {
          console.log('Could not find question')
          reject(respondWithError('Could not find question'))
        } else {
          let question = response.data.filter((q) => q.id === body.payload.id)
          if (question.length === 0) {
            console.log('Could not find question 2')
            reject(respondWithError('Could not find question'))
          }
          return classifyQuestion(question[0])
        }
      })
      .then(parseResponse)
      .then(resp => updateQuestionInEMS(resp, body.payload.id))
      .then(parseResponse)
      .then(resp =>   {
          validateResponse(resp, 'Update question')

          resolve({
            statusCode: 200,
            body: JSON.stringify('Success:' + resultClassification)
          })
        })
      .catch(error => reject(respondWithError(error)))
  })
  return promise
};
