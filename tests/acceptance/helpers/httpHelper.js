const userSettings = require('../helpers/userSettings')
const _ = require('lodash')
const fetch = require('node-fetch')
/**
 *
 * @param {string} userId
 *
 * @returns {{Authorization: string}}
 */
exports.createAuthHeader = function (userId) {
  const password = userSettings.getPasswordForUser(userId)
  return {
    Authorization: 'Basic ' +
      Buffer.from(userId + ':' + password).toString('base64')
  }
}
/**
 *
 * @param {string} userId
 *
 * @returns {{<header>: string}}
 */
exports.createOCSRequestHeaders = function (userId) {
  return {
    ...this.createAuthHeader(userId),
    'OCS-APIREQUEST': true
  }
}
/**
 *
 * @param {node-fetch.Response} response
 * @param {string} message
 *
 * @throws Error
 * @returns {node-fetch.Response}
 */
exports.checkStatus = function (response, message) {
  if (response.ok) { // response.status >= 200 && response.status < 300
    return response
  } else {
    throw Error(message + ' Status:' + response.status + ' ' + response.statusText)
  }
}

exports.checkOCSStatus = function (response, message) {
  const statusCode = _.get(response, 'ocs.meta.statuscode')
  if (statusCode === 200) {
    return response
  } else {
    throw Error(message + ' Status:' + statusCode)
  }
}

// exports.requestEndpoint = function (url, option, userId = 'admin', headers = {}) {
//   const reqheaders = { ...headers, ...this.createOCSRequestHeaders(userId) }
//   const options = {
//     ...option,
//     reqheaders
//   }
//   return fetch(url, options)
// }

exports.requestEndpoint = function (url, params, userId = 'admin') {
  const headers = this.createOCSRequestHeaders(userId)
  const options = {
    ...params,
    headers
  }
  return fetch(url, options)
}
